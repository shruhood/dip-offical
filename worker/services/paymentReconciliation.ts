import type { Env } from '../types';
import { DatabaseRegistry } from '../config/database';
import { calculatePartnerCommission, fromPaise, toPaise } from '../../src/lib/finance';
import {
  formatCashfreePaymentMethod,
  getCashfreeOrderRefunds,
  getCashfreePgOrderStatus,
  isPaymentAmountMatching,
  loadEffectiveCashfreeConfig,
  logCashfreeEvent,
  normalizeCashfreeLifecycleState,
} from './cashfreeService';
import { recordAuditEvent } from './auditService';
import { dispatchPaymentAlertEmail } from './paymentAlertService';
import { findCatalogueItem } from '../../src/lib/catalogueServer';
import type { CommissionRule } from '../../src/types';

export interface ReconcilePaidOrderInput {
  orderId: string;
  cfOrderId?: string;
  cfPaymentId?: string;
  paymentMethod?: string;
  paymentAmountInr?: number;
  bankReference?: string;
  paymentMessage?: string;
  paidAt?: string;
  webhookSignature?: string;
  rawGatewayJson?: string;
  actorId?: string;
  ip?: string;
}

export interface ReconcilePaidOrderResult {
  ok: boolean;
  reconciled: boolean;
  amountMismatch?: boolean;
  errorCode?: string;
  message: string;
  applicationId?: string;
  invoiceNumber?: string;
}

export interface ReconcileRefundOutcomeInput {
  refundId: string;
  orderId: string;
  cfRefundId?: string;
  cfPaymentId?: string;
  refundAmountInr?: number;
  refundArn?: string;
  refundMode?: string;
  refundStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'ONHOLD';
  statusDescription?: string;
  processedAt?: string;
  rawGatewayJson?: string;
  actorId?: string;
  ip?: string;
}

export interface ReconcileRefundOutcomeResult {
  ok: boolean;
  updated: boolean;
  message: string;
  refundId: string;
  orderId: string;
  paymentStatus?: string;
  commissionReversed?: boolean;
}

export async function reconcilePaidOrder(
  env: Env,
  input: ReconcilePaidOrderInput
): Promise<ReconcilePaidOrderResult> {
  const { orderId } = input;
  if (!orderId) {
    return { ok: false, reconciled: false, errorCode: 'MISSING_ORDER_ID', message: 'orderId is required' };
  }

  const dbReg = new DatabaseRegistry(env);
  const [{ db: billingDb }, { db: workflowDb }, { db: coreDb }, { db: partnersDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_billing'),
    dbReg.resolveAndEnsure('dip_workflow'),
    dbReg.resolveAndEnsure('dip_core'),
    dbReg.resolveAndEnsure('dip_partners'),
  ]);

  if (!billingDb) {
    return { ok: true, reconciled: false, message: 'No billing D1 database bound; skipped ledger reconciliation' };
  }

  const orderRow = await billingDb
    .prepare(
      `SELECT id, application_id, user_id, service_slug, service_fee_paise, govt_fee_paise, tax_paise, total_paise, currency, status
       FROM payment_orders WHERE id = ? LIMIT 1`
    )
    .bind(orderId)
    .first<{
      id: string;
      application_id: string;
      user_id: string;
      service_slug: string | null;
      service_fee_paise: number;
      govt_fee_paise: number;
      tax_paise: number;
      total_paise: number;
      currency?: string;
      status: string;
    }>();

  if (!orderRow) {
    return {
      ok: true,
      reconciled: false,
      message: `No pre-existing payment_orders record found for ${orderId}`,
    };
  }

  if (
    input.paymentAmountInr !== undefined &&
    Number.isFinite(input.paymentAmountInr) &&
    !isPaymentAmountMatching(orderRow.total_paise, input.paymentAmountInr)
  ) {
    await billingDb
      .prepare(
        `UPDATE payment_orders
         SET last_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        `Amount mismatch: expected INR ${fromPaise(orderRow.total_paise)}, gateway reported INR ${input.paymentAmountInr}`,
        orderId
      )
      .run()
      .catch(() => null);

    await recordAuditEvent(env, {
      actorId: input.actorId || orderRow.user_id,
      actorRole: 'system',
      action: 'PAYMENT_AMOUNT_MISMATCH_BLOCKED',
      resourceType: 'payment_order',
      resourceId: orderId,
      summary: `Blocked settlement for ${orderId}: expected ₹${fromPaise(orderRow.total_paise)}, gateway reported ₹${input.paymentAmountInr}`,
      ip: input.ip,
    });
    return {
      ok: false,
      reconciled: false,
      amountMismatch: true,
      errorCode: 'PAYMENT_AMOUNT_MISMATCH',
      message: `Payment amount mismatch detected for order ${orderId}: expected ₹${fromPaise(orderRow.total_paise)}, received ₹${input.paymentAmountInr}.`,
      applicationId: orderRow.application_id,
    };
  }

  const paidAtIso = input.paidAt || new Date().toISOString();
  const paymentMethod = input.paymentMethod || 'Cashfree PG';
  const cfPaymentId = input.cfPaymentId || `CF_PAY_${orderId}`;

  if (orderRow.status !== 'PAID' && orderRow.status !== 'REFUNDED' && orderRow.status !== 'PARTIALLY_REFUNDED') {
    await billingDb
      .prepare(`UPDATE payment_orders SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(orderId)
      .run()
      .catch(() => null);

    await billingDb
      .prepare(
        `UPDATE payment_orders SET payment_status_normalized = 'PAID', cf_order_id = COALESCE(?, cf_order_id), last_error = NULL WHERE id = ?`
      )
      .bind(input.cfOrderId || null, orderId)
      .run()
      .catch(() => null);
  }

  // Isolate sandbox end-to-end test orders (TEST_CF_*) so production ledgers, GST invoices, and partner commissions stay clean
  if (orderId.startsWith('TEST_CF_')) {
    await recordAuditEvent(env, {
      actorId: input.actorId || orderRow.user_id,
      actorRole: 'system',
      action: 'SANDBOX_TEST_PAYMENT_RECONCILED',
      resourceType: 'payment_order',
      resourceId: orderId,
      summary: `Verified sandbox test webhook reconciliation for ${orderId} (${paymentMethod}) without mutating live ledger`,
      ip: input.ip,
    });
    return {
      ok: true,
      reconciled: true,
      message: `Sandbox test order ${orderId} reconciled (live ledger & commissions isolated)`,
      applicationId: orderRow.application_id,
    };
  }

  const paymentId = `pay_${orderId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const serviceFeeInr = Math.round(fromPaise(orderRow.service_fee_paise));
  const govtFeeInr = Math.round(fromPaise(orderRow.govt_fee_paise));
  const totalAmountInr = Math.round(fromPaise(orderRow.total_paise));
  const taxAmountInr = Math.round(fromPaise(orderRow.tax_paise));

  await billingDb
    .prepare(
      `INSERT INTO payments (
        id, order_id, application_id, user_id, cf_payment_id, amount, govt_fee, total_amount,
        status, payment_method, webhook_signature, bank_reference, currency, order_amount_paise,
        payment_message, gateway_response_json, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Success', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET
        cf_payment_id = COALESCE(excluded.cf_payment_id, payments.cf_payment_id),
        status = CASE WHEN payments.status IN ('Refunded', 'Partially Refunded') THEN payments.status ELSE 'Success' END,
        payment_method = COALESCE(excluded.payment_method, payments.payment_method),
        webhook_signature = COALESCE(excluded.webhook_signature, payments.webhook_signature),
        bank_reference = COALESCE(excluded.bank_reference, payments.bank_reference),
        payment_message = COALESCE(excluded.payment_message, payments.payment_message),
        gateway_response_json = COALESCE(excluded.gateway_response_json, payments.gateway_response_json),
        paid_at = COALESCE(payments.paid_at, excluded.paid_at)`
    )
    .bind(
      paymentId,
      orderId,
      orderRow.application_id,
      orderRow.user_id,
      cfPaymentId,
      serviceFeeInr,
      govtFeeInr,
      totalAmountInr,
      paymentMethod,
      input.webhookSignature || null,
      input.bankReference || null,
      orderRow.currency || 'INR',
      orderRow.total_paise,
      input.paymentMessage || null,
      input.rawGatewayJson ? input.rawGatewayJson.slice(0, 4000) : null,
      paidAtIso
    )
    .run()
    .catch(async () => {
      await billingDb
        .prepare(
          `INSERT OR IGNORE INTO payments (id, order_id, application_id, user_id, cf_payment_id, amount, govt_fee, total_amount, status, payment_method, webhook_signature, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Success', ?, ?, ?)`
        )
        .bind(
          paymentId,
          orderId,
          orderRow.application_id,
          orderRow.user_id,
          cfPaymentId,
          serviceFeeInr,
          govtFeeInr,
          totalAmountInr,
          paymentMethod,
          input.webhookSignature || null,
          paidAtIso
        )
        .run()
        .catch(() => null);
    });

  let invoicePrefix = 'DIP-INV-2026';
  if (coreDb) {
    try {
      const stmt = coreDb.prepare(`SELECT invoice_prefix FROM business_settings WHERE id = ? LIMIT 1`);
      const settings = await (typeof stmt.bind === 'function'
        ? stmt.bind('default').first<{ invoice_prefix: string }>()
        : stmt.first?.<{ invoice_prefix: string }>());
      if (settings?.invoice_prefix?.trim()) {
        invoicePrefix = settings.invoice_prefix.trim().replace(/-+$/, '');
      }
    } catch {
      // Fall back to default invoice prefix
    }
  }

  const cleanSuffix = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  const invoiceNumber = `${invoicePrefix}-${cleanSuffix}`;
  const invoiceId = `inv_${orderId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  await billingDb
    .prepare(
      `INSERT OR IGNORE INTO invoices (id, invoice_number, payment_id, application_id, user_id, subtotal, gst_amount, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      invoiceId,
      invoiceNumber,
      paymentId,
      orderRow.application_id,
      orderRow.user_id,
      serviceFeeInr,
      taxAmountInr,
      totalAmountInr
    )
    .run()
    .catch(() => null);

  if (orderRow.application_id.startsWith('DIG_')) {
    await billingDb
      .prepare(`UPDATE digital_product_orders SET payment_status = 'Paid' WHERE order_id = ?`)
      .bind(orderId)
      .run()
      .catch(() => null);
  } else if (workflowDb && !orderRow.application_id.startsWith('DRAFT_')) {
    const appRow = await workflowDb
      .prepare(`SELECT id, user_id, service_id, status FROM applications WHERE id = ? LIMIT 1`)
      .bind(orderRow.application_id)
      .first<{ id: string; user_id: string; service_id: string; status: string }>()
      .catch(() => null);

    if (
      appRow &&
      (appRow.status === 'Draft' ||
        appRow.status === 'Submitted' ||
        appRow.status === 'Payment Pending' ||
        appRow.status === 'Awaiting Payment')
    ) {
      await workflowDb
        .prepare(
          `UPDATE applications
           SET status = 'Payment Confirmed',
               customer_remarks = 'Payment confirmed via authoritative Cashfree gateway reconciliation.',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(appRow.id)
        .run()
        .catch(() => null);

      await workflowDb
        .prepare(
          `INSERT INTO application_events (id, application_id, event_type, previous_status, new_status, actor_user_id, actor_role, customer_message)
           VALUES (?, ?, 'PAYMENT_CONFIRMED', ?, 'Payment Confirmed', ?, 'system', ?)`
        )
        .bind(
          `evt_${crypto.randomUUID()}`,
          appRow.id,
          appRow.status,
          input.actorId || orderRow.user_id,
          `Payment of ₹${totalAmountInr.toLocaleString('en-IN')} reconciled (Order ${orderId}, Invoice ${invoiceNumber}).`
        )
        .run()
        .catch(() => null);
    }

    const targetPartnersDb = partnersDb || billingDb;
    if (targetPartnersDb && billingDb) {
      try {
        const partnerLink = await targetPartnersDb
          .prepare(
            `SELECT pc.partner_id, p.partner_type
             FROM partner_customers pc
             JOIN partners p ON p.id = pc.partner_id
             WHERE pc.customer_user_id = ? AND p.approval_status = 'Approved'
             LIMIT 1`
          )
          .bind(orderRow.user_id)
          .first<{ partner_id: string; partner_type: string }>()
          .catch(() => null);

        if (partnerLink?.partner_id) {
          const rulesRes = await billingDb
            .prepare(`SELECT * FROM commission_rules WHERE is_active = 1`)
            .all<any>()
            .catch(() => ({ results: [] }));
          const dbRules: CommissionRule[] = (rulesRes.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            partnerId: r.partner_id || undefined,
            partnerType: r.partner_type || undefined,
            serviceId: r.service_id || undefined,
            commissionType: r.commission_type === 'fixed' ? 'fixed' : 'percentage',
            fixedAmountPaise: Number(r.fixed_amount_paise || 0),
            percentageBps: Number(r.percentage_bps || 0),
            minOrderPaise: Number(r.min_order_paise || 0),
            isActive: r.is_active !== 0,
          }));

          const service = orderRow.service_slug ? findCatalogueItem(orderRow.service_slug) : undefined;
          const comp = calculatePartnerCommission({
            partnerId: partnerLink.partner_id,
            partnerType: partnerLink.partner_type as any,
            serviceId: service?.id || appRow?.service_id || orderRow.service_slug || 'general',
            serviceFeePaise: orderRow.service_fee_paise || toPaise(service?.serviceCharge || 0),
            rules: dbRules,
          });

          if (comp.netPayablePaise > 0) {
            await billingDb
              .prepare(
                `INSERT OR IGNORE INTO commission_ledger (
                  id, partner_id, application_id, rule_id, entry_type,
                  gross_amount_paise, commission_paise, tds_paise, net_paise, status, notes
                ) VALUES (?, ?, ?, ?, 'EARNED', ?, ?, ?, ?, 'Approved', ?)`
              )
              .bind(
                `comm_${crypto.randomUUID()}`,
                partnerLink.partner_id,
                orderRow.application_id,
                comp.matchedRuleId || null,
                comp.grossServiceFeePaise,
                comp.commissionPaise,
                comp.tdsPaise,
                comp.netPayablePaise,
                `Auto-credited on confirmed Cashfree order ${orderId}`
              )
              .run()
              .catch(() => null);
          }
        }
      } catch {
        // Non-fatal commission credit guard
      }
    }
  }

  // Persist idempotent payment confirmation notification
  if (coreDb) {
    const cleanOrderKey = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanAppKey = orderRow.application_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const notifId = `notif_pay_${cleanAppKey}_paid_${cleanOrderKey}`;
    const serviceLabel =
      (orderRow.service_slug ? findCatalogueItem(orderRow.service_slug)?.name : undefined) ||
      'Digital India Service';

    await coreDb
      .prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
         VALUES (?, ?, 'in_app', ?, ?, 0)`
      )
      .bind(
        notifId,
        orderRow.user_id,
        `Payment Confirmed: ₹${totalAmountInr.toLocaleString('en-IN')} (${orderRow.application_id})`,
        `Payment of ₹${totalAmountInr.toLocaleString('en-IN')} via ${paymentMethod} confirmed for ${serviceLabel}. Invoice: ${invoiceNumber}.`
      )
      .run()
      .catch(() => null);

    if (env.RESEND_API_KEY) {
      const userRow = await coreDb
        .prepare(`SELECT name, email FROM users WHERE id = ? LIMIT 1`)
        .bind(orderRow.user_id)
        .first<{ name?: string; email?: string }>()
        .catch(() => null);
      if (userRow?.email) {
        await dispatchPaymentAlertEmail({
          resendApiKey: env.RESEND_API_KEY,
          appDomain: env.APP_DOMAIN,
          businessEmail: env.BUSINESS_EMAIL,
          paymentsEmail: env.PAYMENTS_EMAIL,
          input: {
            applicationId: orderRow.application_id,
            orderId,
            transactionId: cfPaymentId,
            status: 'Paid',
            serviceName: serviceLabel,
            amountInr: totalAmountInr,
            recipientEmail: userRow.email,
            recipientName: userRow.name || 'Applicant',
            paymentMethod,
            eventTime: paidAtIso,
          },
        }).catch(() => null);
      }
    }
  }

  await recordAuditEvent(env, {
    actorId: input.actorId || orderRow.user_id,
    actorRole: 'system',
    action: 'PAYMENT_RECONCILED',
    resourceType: 'payment_order',
    resourceId: orderId,
    summary: `Reconciled order ${orderId} (₹${totalAmountInr}, Invoice ${invoiceNumber})`,
    ip: input.ip,
  });

  return {
    ok: true,
    reconciled: true,
    message: `Payment reconciled (Invoice ${invoiceNumber})`,
    applicationId: orderRow.application_id,
    invoiceNumber,
  };
}

export async function reconcileRefundOutcome(
  env: Env,
  input: ReconcileRefundOutcomeInput
): Promise<ReconcileRefundOutcomeResult> {
  const dbReg = new DatabaseRegistry(env);
  const [{ db: billingDb }, { db: workflowDb }, { db: partnersDb }, { db: coreDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_billing'),
    dbReg.resolveAndEnsure('dip_workflow'),
    dbReg.resolveAndEnsure('dip_partners'),
    dbReg.resolveAndEnsure('dip_core'),
  ]);

  if (!billingDb) {
    return {
      ok: false,
      updated: false,
      message: 'Billing database unavailable',
      refundId: input.refundId,
      orderId: input.orderId,
    };
  }

  const refRow = await billingDb
    .prepare(
      `SELECT r.*, p.id AS p_id, p.order_id AS p_order_id, p.application_id AS p_app_id,
              p.user_id AS p_user_id, p.total_amount AS p_total_inr, p.order_amount_paise AS p_total_paise,
              p.refunded_paise AS p_refunded_paise, p.status AS p_status
       FROM refunds r
       LEFT JOIN payments p ON p.id = r.payment_id OR p.order_id = r.order_id
       WHERE r.id = ? OR r.cf_refund_id = ?
       LIMIT 1`
    )
    .bind(input.refundId, input.cfRefundId || input.refundId)
    .first<any>()
    .catch(() => null);

  let payment = refRow?.p_id
    ? {
        id: refRow.p_id,
        order_id: refRow.p_order_id || input.orderId,
        application_id: refRow.p_app_id,
        user_id: refRow.p_user_id,
        total_amount: Number(refRow.p_total_inr || 0),
        order_amount_paise: Number(refRow.p_total_paise || toPaise(Number(refRow.p_total_inr || 0))),
        refunded_paise: Number(refRow.p_refunded_paise || 0),
        status: refRow.p_status,
      }
    : await billingDb
        .prepare(`SELECT * FROM payments WHERE order_id = ? LIMIT 1`)
        .bind(input.orderId)
        .first<any>()
        .catch(() => null);

  const orderFallback =
    !payment || !payment.order_amount_paise
      ? await billingDb
          .prepare(`SELECT id, application_id, user_id, total_paise FROM payment_orders WHERE id = ? LIMIT 1`)
          .bind(input.orderId)
          .first<{ id: string; application_id: string; user_id: string; total_paise: number }>()
          .catch(() => null)
      : null;

  if (!payment && orderFallback) {
    payment = {
      id: `pay_${orderFallback.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      order_id: orderFallback.id,
      application_id: orderFallback.application_id,
      user_id: orderFallback.user_id,
      total_amount: Math.round(fromPaise(Number(orderFallback.total_paise || 0))),
      order_amount_paise: Number(orderFallback.total_paise || 0),
      refunded_paise: 0,
      status: 'Success',
    };
  } else if (payment && orderFallback) {
    payment = {
      ...payment,
      id: payment.id || `pay_${orderFallback.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      order_id: payment.order_id || orderFallback.id,
      application_id: payment.application_id || orderFallback.application_id,
      user_id: payment.user_id || orderFallback.user_id,
      order_amount_paise: Number(payment.order_amount_paise || orderFallback.total_paise || toPaise(Number(payment.total_amount || 0))),
    };
  }

  const refundPaise =
    input.refundAmountInr !== undefined && Number.isFinite(input.refundAmountInr)
      ? toPaise(input.refundAmountInr)
      : Number(refRow?.refund_amount_paise || toPaise(Number(refRow?.amount || 0)));

  const localRefundStatus =
    input.refundStatus === 'SUCCESS'
      ? 'Processed'
      : input.refundStatus === 'FAILED' || input.refundStatus === 'CANCELLED'
      ? 'Failed'
      : 'Approved';

  const nowIso = input.processedAt || new Date().toISOString();

  if (refRow) {
    await billingDb
      .prepare(
        `UPDATE refunds
         SET status = CASE WHEN status = 'Processed' AND ? != 'Processed' THEN status ELSE ? END,
             gateway_status = ?,
             cf_refund_id = COALESCE(?, cf_refund_id),
             refund_arn = COALESCE(?, refund_arn),
             refund_mode = COALESCE(?, refund_mode),
             refund_amount_paise = CASE WHEN refund_amount_paise > 0 THEN refund_amount_paise ELSE ? END,
             processed_by = COALESCE(?, processed_by),
             processed_at = CASE WHEN ? = 'SUCCESS' THEN COALESCE(processed_at, ?) ELSE processed_at END,
             updated_at = ?,
             gateway_response_json = COALESCE(?, gateway_response_json)
         WHERE id = ?`
      )
      .bind(
        localRefundStatus,
        localRefundStatus,
        input.refundStatus,
        input.cfRefundId || null,
        input.refundArn || null,
        input.refundMode || null,
        refundPaise,
        input.actorId || 'cashfree_webhook',
        input.refundStatus,
        nowIso,
        nowIso,
        input.rawGatewayJson ? input.rawGatewayJson.slice(0, 4000) : null,
        refRow.id
      )
      .run()
      .catch(() => null);
  } else if (payment) {
    // External refund initiated directly from Cashfree Dashboard -> materialize locally idempotently
    await billingDb
      .prepare(
        `INSERT OR IGNORE INTO refunds (
          id, payment_id, order_id, application_id, cf_refund_id, amount, refund_amount_paise,
          refund_arn, refund_mode, gateway_status, reason, status, initiated_by, processed_by, processed_at, updated_at, gateway_response_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Gateway Refund Sync', ?, 'cashfree_webhook', 'cashfree_webhook', ?, ?, ?)`
      )
      .bind(
        input.refundId,
        payment.id,
        payment.order_id,
        payment.application_id,
        input.cfRefundId || null,
        Math.round(fromPaise(refundPaise)),
        refundPaise,
        input.refundArn || null,
        input.refundMode || 'STANDARD',
        input.refundStatus,
        localRefundStatus,
        input.refundStatus === 'SUCCESS' ? nowIso : null,
        nowIso,
        input.rawGatewayJson ? input.rawGatewayJson.slice(0, 4000) : null
      )
      .run()
      .catch(() => null);
  }

  let paymentStatusOut: string | undefined;
  let commissionReversed = false;

  if (input.refundStatus === 'SUCCESS' && payment) {
    const sumRow = await billingDb
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN refund_amount_paise > 0 THEN refund_amount_paise ELSE amount * 100 END), 0) AS sum_paise
         FROM refunds
         WHERE (payment_id = ? OR order_id = ?) AND (status = 'Processed' OR gateway_status = 'SUCCESS')`
      )
      .bind(payment.id, payment.order_id)
      .first<{ sum_paise: number }>()
      .catch(() => ({ sum_paise: refundPaise }));

    const paidPaise = Number(payment.order_amount_paise || toPaise(Number(payment.total_amount || 0)));
    const totalRefundedPaise = Math.max(Number(sumRow?.sum_paise || 0), refundPaise);
    const isFullRefund = paidPaise > 0 && totalRefundedPaise >= paidPaise - 100; // within 1 INR rounding
    const nextPaymentStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';
    const nextOrderStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    paymentStatusOut = nextPaymentStatus;

    await billingDb
      .prepare(`UPDATE payments SET status = ?, refunded_paise = ? WHERE id = ?`)
      .bind(nextPaymentStatus, totalRefundedPaise, payment.id)
      .run()
      .catch(() => null);

    await billingDb
      .prepare(
        `UPDATE payment_orders
         SET status = ?, payment_status_normalized = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(nextOrderStatus, nextOrderStatus, payment.order_id)
      .run()
      .catch(() => null);

    if (workflowDb && payment.application_id && !payment.application_id.startsWith('DIG_')) {
      const targetAppStatus = isFullRefund ? 'Refunded' : 'Refund Initiated';
      await workflowDb
        .prepare(
          `UPDATE applications
           SET status = ?,
               customer_remarks = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status != 'Refunded'`
        )
        .bind(
          targetAppStatus,
          `${isFullRefund ? 'Full' : 'Partial'} refund of ₹${Math.round(fromPaise(refundPaise)).toLocaleString('en-IN')} completed${input.refundArn ? ` (ARN: ${input.refundArn})` : ''}.`,
          payment.application_id
        )
        .run()
        .catch(() => null);

      await workflowDb
        .prepare(
          `INSERT INTO application_events (id, application_id, event_type, new_status, actor_user_id, actor_role, customer_message)
           VALUES (?, ?, 'REFUND_COMPLETED', ?, ?, 'system', ?)`
        )
        .bind(
          `evt_${crypto.randomUUID()}`,
          payment.application_id,
          targetAppStatus,
          input.actorId || 'cashfree_webhook',
          `Cashfree refund ${input.refundId} settled (₹${Math.round(fromPaise(refundPaise)).toLocaleString('en-IN')}).`
        )
        .run()
        .catch(() => null);
    }

    const targetPartnersDb = partnersDb || billingDb;
    if (targetPartnersDb && payment.application_id) {
      const earnedComm = await targetPartnersDb
        .prepare(`SELECT * FROM commission_ledger WHERE application_id = ? AND entry_type = 'EARNED' LIMIT 1`)
        .bind(payment.application_id)
        .first<any>()
        .catch(() => null);

      if (earnedComm) {
        const commBasisPaise = Math.abs(
          Number(earnedComm.commission_paise ?? earnedComm.amount_paise ?? 0)
        );
        const ratio = paidPaise > 0 ? Math.min(1, refundPaise / paidPaise) : 1;
        const grossRev = -Math.round(Math.abs(Number(earnedComm.gross_amount_paise || commBasisPaise)) * ratio);
        const commRev = -Math.round(commBasisPaise * ratio);
        const tdsRev = -Math.round(Math.abs(Number(earnedComm.tds_paise || 0)) * ratio);
        const netRev = -Math.round(Math.abs(Number(earnedComm.net_paise || commBasisPaise)) * ratio);

        const revRes = await targetPartnersDb
          .prepare(
            `INSERT OR IGNORE INTO commission_ledger (
              id, partner_id, application_id, rule_id, entry_type,
              gross_amount_paise, commission_paise, tds_paise, net_paise, status, notes
            ) VALUES (?, ?, ?, ?, 'REVERSAL', ?, ?, ?, ?, 'Reversed', ?)`
          )
          .bind(
            `comm_rev_${input.refundId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            earnedComm.partner_id,
            payment.application_id,
            earnedComm.rule_id || null,
            grossRev,
            commRev,
            tdsRev,
            netRev,
            `Automatic ${isFullRefund ? 'full' : 'proportional'} commission clawback on refund ${input.refundId}`
          )
          .run()
          .catch(() => null);

        if ((revRes?.meta?.changes || 0) > 0) {
          commissionReversed = true;
        }
      }
    }

    if (coreDb && payment.user_id) {
      const amtInr = Math.round(fromPaise(refundPaise));
      await coreDb
        .prepare(
          `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
           VALUES (?, ?, 'in_app', ?, ?, 0)`
        )
        .bind(
          `notif_ref_${input.refundId.replace(/[^a-zA-Z0-9_-]/g, '_')}_done`,
          payment.user_id,
          `Refund Settled: ₹${amtInr.toLocaleString('en-IN')} (${payment.application_id})`,
          `Your refund of ₹${amtInr.toLocaleString('en-IN')} for order ${payment.order_id} is complete${input.refundArn ? ` (ARN: ${input.refundArn})` : ''}.`
        )
        .run()
        .catch(() => null);

      if (env.RESEND_API_KEY) {
        const userRow = await coreDb
          .prepare(`SELECT name, email FROM users WHERE id = ? LIMIT 1`)
          .bind(payment.user_id)
          .first<{ name?: string; email?: string }>()
          .catch(() => null);
        if (userRow?.email) {
          await dispatchPaymentAlertEmail({
            resendApiKey: env.RESEND_API_KEY,
            appDomain: env.APP_DOMAIN,
            businessEmail: env.BUSINESS_EMAIL,
            paymentsEmail: env.PAYMENTS_EMAIL,
            input: {
              applicationId: payment.application_id,
              orderId: payment.order_id,
              refundId: input.refundId,
              refundArn: input.refundArn,
              status: 'Refunded',
              serviceName: 'Digital India Service',
              amountInr: amtInr,
              recipientEmail: userRow.email,
              recipientName: userRow.name || 'Applicant',
              paymentMethod: input.refundMode || 'Original Payment Method',
              eventTime: nowIso,
            },
          }).catch(() => null);
        }
      }
    }
  } else if (input.refundStatus === 'FAILED' && coreDb && payment?.user_id) {
    const amtInr = Math.round(fromPaise(refundPaise));
    await coreDb
      .prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
         VALUES (?, ?, 'in_app', ?, ?, 0)`
      )
      .bind(
        `notif_ref_${input.refundId.replace(/[^a-zA-Z0-9_-]/g, '_')}_fail`,
        payment.user_id,
        `Refund Failed: ₹${amtInr.toLocaleString('en-IN')} (${payment.application_id})`,
        input.statusDescription || `Cashfree refund ${input.refundId} failed and requires support intervention.`
      )
      .run()
      .catch(() => null);
  }

  await recordAuditEvent(env, {
    actorId: input.actorId || 'cashfree_webhook',
    actorRole: 'system',
    action: `REFUND_${input.refundStatus}`,
    resourceType: 'refund',
    resourceId: input.refundId,
    summary: `Refund ${input.refundId} (order ${input.orderId}) status=${input.refundStatus}${input.refundArn ? `, ARN=${input.refundArn}` : ''}`,
    ip: input.ip,
  });

  return {
    ok: true,
    updated: true,
    message: `Refund ${input.refundId} synced as ${localRefundStatus}`,
    refundId: input.refundId,
    orderId: input.orderId,
    paymentStatus: paymentStatusOut,
    commissionReversed,
  };
}

export interface ProcessWebhookPayloadInput {
  parsed?: Record<string, any>;
  payload?: Record<string, any>;
  rawBody?: string;
  timestamp?: string;
  eventType?: string;
  orderId?: string;
  cfPaymentId?: string;
  eventId?: string;
  signatureVerified?: boolean;
  signatureHashPrefix?: string;
  actorId?: string;
  ip?: string;
  isReplay?: boolean;
  existingEventRowId?: string;
}

export interface ProcessWebhookPayloadResult {
  ok: boolean;
  httpStatus: number;
  deduplicated?: boolean;
  ignoredMonotonic?: boolean;
  amountMismatch?: boolean;
  eventId: string;
  orderId: string;
  eventType: string;
  resolvedOrderStatus: string;
  message: string;
}

export async function processCashfreeWebhookEvent(
  env: Env,
  input: ProcessWebhookPayloadInput
): Promise<ProcessWebhookPayloadResult> {
  const safeParsed = input.parsed ?? input.payload ?? {};
  const safeRawBody =
    typeof input.rawBody === 'string' && input.rawBody.length > 0
      ? input.rawBody
      : JSON.stringify(safeParsed);
  const eventType = String(
    input.eventType || safeParsed?.type || safeParsed?.event || 'PAYMENT_SUCCESS_WEBHOOK'
  ).toUpperCase();
  const orderId = String(
    input.orderId ||
      safeParsed?.data?.order?.order_id ||
      safeParsed?.data?.refund?.order_id ||
      safeParsed?.order_id ||
      ''
  );
  const cfPaymentId =
    input.cfPaymentId ||
    (safeParsed?.data?.payment?.cf_payment_id ? String(safeParsed.data.payment.cf_payment_id) : undefined);
  const cfOrderId = safeParsed?.data?.order?.cf_order_id
    ? String(safeParsed.data.order.cf_order_id)
    : undefined;
  const refundObj = safeParsed?.data?.refund;
  const refundId = refundObj?.refund_id ? String(refundObj.refund_id) : undefined;
  const cfRefundId = refundObj?.cf_refund_id ? String(refundObj.cf_refund_id) : undefined;
  const eventTime = String(
    safeParsed?.event_time ||
      safeParsed?.data?.payment?.payment_time ||
      refundObj?.processed_at ||
      input.timestamp ||
      ''
  );

  // Preserve backward compatibility for eventId while distinguishing distinct event types / refunds
  const baseRef = cfRefundId || refundId || cfPaymentId || eventTime || crypto.randomUUID();
  const eventId =
    input.eventId ||
    (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && cfPaymentId && !input.isReplay
      ? cfPaymentId
      : `${eventType}:${baseRef}`);

  const dbReg = new DatabaseRegistry(env);
  const { db: billingDb } = await dbReg.resolveAndEnsure('dip_billing');

  // 1. Refund status webhooks
  if (eventType === 'REFUND_STATUS_WEBHOOK' || Boolean(refundObj)) {
    const rawRefundStatus = String(refundObj?.refund_status || 'PENDING').toUpperCase();
    const refundStatus: ReconcileRefundOutcomeInput['refundStatus'] =
      rawRefundStatus === 'SUCCESS'
        ? 'SUCCESS'
        : rawRefundStatus === 'FAILED'
        ? 'FAILED'
        : rawRefundStatus === 'CANCELLED'
        ? 'CANCELLED'
        : rawRefundStatus === 'ONHOLD'
        ? 'ONHOLD'
        : 'PENDING';

    if (billingDb && !input.isReplay) {
      const dup = await billingDb
        .prepare(`SELECT id, processing_status FROM payment_webhook_events WHERE event_id = ? LIMIT 1`)
        .bind(eventId)
        .first<{ id: string; processing_status?: string }>()
        .catch(() => null);

      if (dup && dup.processing_status !== 'FAILED') {
        return {
          ok: true,
          httpStatus: 200,
          deduplicated: true,
          eventId,
          orderId,
          eventType,
          resolvedOrderStatus: refundStatus,
          message: 'Duplicate refund webhook event acknowledged idempotently',
        };
      }

      if (!dup) {
        await billingDb
          .prepare(
            `INSERT INTO payment_webhook_events (
              id, event_id, order_id, event_type, signature_verified, payload_hash,
              payment_id, refund_id, processing_status, event_timestamp, raw_payload_json
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'PROCESSED', ?, ?)`
          )
          .bind(
            `whe_${crypto.randomUUID()}`,
            eventId,
            orderId,
            eventType,
            input.signatureHashPrefix || 'verified',
            cfPaymentId || (refundObj?.cf_payment_id ? String(refundObj.cf_payment_id) : null),
            refundId || cfRefundId || null,
            eventTime || null,
            safeRawBody.slice(0, 4000)
          )
          .run()
          .catch(async () => {
            await billingDb
              .prepare(
                `INSERT INTO payment_webhook_events (id, event_id, order_id, event_type, signature_verified, payload_hash)
                 VALUES (?, ?, ?, ?, 1, ?)`
              )
              .bind(`whe_${crypto.randomUUID()}`, eventId, orderId, eventType, input.signatureHashPrefix || 'verified')
              .run();
          });
      }
    }

    const refRes = await reconcileRefundOutcome(env, {
      refundId: refundId || cfRefundId || `ref_${orderId}`,
      orderId,
      cfRefundId,
      cfPaymentId: refundObj?.cf_payment_id ? String(refundObj.cf_payment_id) : cfPaymentId,
      refundAmountInr:
        refundObj?.refund_amount !== undefined ? Number(refundObj.refund_amount) : undefined,
      refundArn: refundObj?.refund_arn ? String(refundObj.refund_arn) : undefined,
      refundMode: refundObj?.refund_mode ? String(refundObj.refund_mode) : undefined,
      refundStatus,
      statusDescription: refundObj?.status_description ? String(refundObj.status_description) : undefined,
      processedAt: refundObj?.processed_at ? String(refundObj.processed_at) : undefined,
      rawGatewayJson: safeRawBody,
      actorId: input.actorId || 'cashfree_webhook',
      ip: input.ip,
    });

    const resolvedRefundOrderStatus =
      refRes.paymentStatus === 'Refunded'
        ? 'REFUNDED'
        : refRes.paymentStatus === 'Partially Refunded'
        ? 'PARTIALLY_REFUNDED'
        : refundStatus;

    return {
      ok: refRes.ok,
      httpStatus: refRes.ok ? 200 : 500,
      eventId,
      orderId,
      eventType,
      resolvedOrderStatus: resolvedRefundOrderStatus,
      message: refRes.message,
    };
  }

  // 2. Payment lifecycle webhooks
  const paymentStatus = String(safeParsed?.data?.payment?.payment_status || '').toUpperCase();
  const rawPaidAmt = safeParsed?.data?.payment?.payment_amount ?? safeParsed?.data?.order?.order_amount;
  const paymentAmountInr =
    rawPaidAmt !== undefined && rawPaidAmt !== null && Number.isFinite(Number(rawPaidAmt))
      ? Number(rawPaidAmt)
      : undefined;
  const paymentTime =
    typeof safeParsed?.data?.payment?.payment_time === 'string'
      ? safeParsed.data.payment.payment_time
      : undefined;
  const bankReference = safeParsed?.data?.payment?.bank_reference
    ? String(safeParsed.data.payment.bank_reference)
    : undefined;
  const paymentMessage = safeParsed?.data?.payment?.payment_message
    ? String(safeParsed.data.payment.payment_message)
    : undefined;
  const paymentGroup = safeParsed?.data?.payment?.payment_method
    ? formatCashfreePaymentMethod(safeParsed.data.payment.payment_method)
    : typeof safeParsed?.data?.payment?.payment_group === 'string'
    ? safeParsed.data.payment.payment_group
    : 'Cashfree Webhook';

  const resolvedOrderStatus =
    eventType === 'PAYMENT_SUCCESS_WEBHOOK' || paymentStatus === 'SUCCESS'
      ? 'PAID'
      : eventType === 'PAYMENT_FAILED_WEBHOOK' || paymentStatus === 'FAILED'
      ? 'FAILED'
      : eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' || paymentStatus === 'USER_DROPPED'
      ? 'DROPPED'
      : 'PENDING';

  const normalizedLifecycle = normalizeCashfreeLifecycleState(resolvedOrderStatus, paymentStatus);

  if (billingDb) {
    if (!input.isReplay) {
      const dup = await billingDb
        .prepare(`SELECT id, processing_status FROM payment_webhook_events WHERE event_id = ? LIMIT 1`)
        .bind(eventId)
        .first<{ id: string; processing_status?: string }>()
        .catch(() => null);

      if (dup && dup.processing_status !== 'FAILED') {
        return {
          ok: true,
          httpStatus: 200,
          deduplicated: true,
          eventId,
          orderId,
          eventType,
          resolvedOrderStatus,
          message: 'Duplicate webhook event acknowledged idempotently',
        };
      }

      if (!dup) {
        await billingDb
          .prepare(
            `INSERT INTO payment_webhook_events (
              id, event_id, order_id, event_type, signature_verified, payload_hash,
              payment_id, processing_status, event_timestamp, raw_payload_json
            ) VALUES (?, ?, ?, ?, 1, ?, ?, 'PROCESSED', ?, ?)`
          )
          .bind(
            `whe_${crypto.randomUUID()}`,
            eventId,
            orderId,
            eventType,
            input.signatureHashPrefix || 'verified',
            cfPaymentId || null,
            eventTime || null,
            safeRawBody.slice(0, 4000)
          )
          .run()
          .catch(async () => {
            await billingDb
              .prepare(
                `INSERT INTO payment_webhook_events (id, event_id, order_id, event_type, signature_verified, payload_hash)
                 VALUES (?, ?, ?, ?, 1, ?)`
              )
              .bind(`whe_${crypto.randomUUID()}`, eventId, orderId, eventType, input.signatureHashPrefix || 'verified')
              .run();
          });
      }
    }

    if (orderId) {
      // Check monotonic guard: never downgrade an already-settled order
      const currentOrd = await billingDb
        .prepare(`SELECT status, user_id, application_id, total_paise FROM payment_orders WHERE id = ? LIMIT 1`)
        .bind(orderId)
        .first<{ status: string; user_id: string; application_id: string; total_paise: number }>()
        .catch(() => null);

      if (resolvedOrderStatus === 'PAID') {
        const rec = await reconcilePaidOrder(env, {
          orderId,
          cfOrderId,
          cfPaymentId: cfPaymentId || eventId,
          paymentMethod: paymentGroup,
          paymentAmountInr,
          bankReference,
          paymentMessage,
          paidAt: paymentTime,
          webhookSignature: input.signatureHashPrefix || 'verified',
          rawGatewayJson: safeRawBody,
          actorId: input.actorId,
          ip: input.ip,
        });
        if (rec.amountMismatch) {
          await billingDb
            .prepare(
              `UPDATE payment_webhook_events
               SET processing_status = 'FAILED', error_message = ?
               WHERE event_id = ?`
            )
            .bind(rec.message, eventId)
            .run()
            .catch(() => null);
          return {
            ok: false,
            httpStatus: 409,
            amountMismatch: true,
            eventId,
            orderId,
            eventType,
            resolvedOrderStatus: 'FAILED',
            message: rec.message,
          };
        }
      } else if (
        currentOrd &&
        (currentOrd.status === 'PAID' ||
          currentOrd.status === 'REFUNDED' ||
          currentOrd.status === 'PARTIALLY_REFUNDED')
      ) {
        logCashfreeEvent('warn', 'webhook_monotonic_ignored', {
          orderId,
          currentStatus: currentOrd.status,
          incomingStatus: resolvedOrderStatus,
          eventId,
        });
        return {
          ok: true,
          httpStatus: 200,
          ignoredMonotonic: true,
          eventId,
          orderId,
          eventType,
          resolvedOrderStatus: currentOrd.status,
          message: `Ignored out-of-order ${resolvedOrderStatus} webhook because order ${orderId} is already ${currentOrd.status}`,
        };
      } else if (
        resolvedOrderStatus === 'FAILED' ||
        resolvedOrderStatus === 'DROPPED' ||
        resolvedOrderStatus === 'PENDING'
      ) {
        await billingDb
          .prepare(
            `UPDATE payment_orders
             SET status = ?, payment_status_normalized = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(
            resolvedOrderStatus,
            normalizedLifecycle,
            resolvedOrderStatus === 'PENDING' ? null : paymentMessage || `Gateway status: ${resolvedOrderStatus}`,
            orderId
          )
          .run()
          .catch(async () => {
            await billingDb
              .prepare(`UPDATE payment_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
              .bind(resolvedOrderStatus, orderId)
              .run();
          });
      }
    }
  }

  return {
    ok: true,
    httpStatus: 200,
    eventId,
    orderId,
    eventType,
    resolvedOrderStatus,
    message: 'Verified webhook processed',
  };
}

export async function runCashfreeReconciliationSweep(
  env: Env,
  options?: { limit?: number; actorId?: string; ip?: string }
): Promise<{
  checkedOrders: number;
  checkedCount: number;
  reconciledPaid: number;
  reconciledPaidCount: number;
  updatedNonPaid: number;
  updatedFailedCount: number;
  skippedCount: number;
  refundsSynced: number;
  amountMismatches: number;
  details: Array<{ orderId: string; previousStatus: string; nextStatus: string; action: string }>;
  errors: Array<{ orderId: string; error: string }>;
  gatewayConfigured: boolean;
  mode: string;
}> {
  const cfConfig = await loadEffectiveCashfreeConfig(env);
  const limit = Math.min(50, Math.max(1, options?.limit || 20));
  const dbReg = new DatabaseRegistry(env);
  const { db: billingDb } = await dbReg.resolveAndEnsure('dip_billing');

  const summary = {
    checkedOrders: 0,
    checkedCount: 0,
    reconciledPaid: 0,
    reconciledPaidCount: 0,
    updatedNonPaid: 0,
    updatedFailedCount: 0,
    skippedCount: 0,
    refundsSynced: 0,
    amountMismatches: 0,
    details: [] as Array<{ orderId: string; previousStatus: string; nextStatus: string; action: string }>,
    errors: [] as Array<{ orderId: string; error: string }>,
    gatewayConfigured: cfConfig.configured,
    mode: cfConfig.mode,
  };

  if (!billingDb || !cfConfig.configured) {
    return summary;
  }

  // 1. Sync pending/active/created/dropped orders against live Cashfree PG
  const pendingOrders = await billingDb
    .prepare(
      `SELECT id, application_id, user_id, status, total_paise
       FROM payment_orders
       WHERE status IN ('CREATED', 'ACTIVE', 'PENDING', 'PROCESSING', 'DROPPED', 'FAILED')
         AND id NOT LIKE 'TEST_CF_%'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<{ id: string; application_id: string; user_id: string; status: string; total_paise: number }>()
    .catch(() => ({ results: [] }));

  for (const ord of pendingOrders.results || []) {
    summary.checkedOrders += 1;
    summary.checkedCount += 1;
    const live = await getCashfreePgOrderStatus(cfConfig, ord.id);
    if (!live.ok) {
      summary.skippedCount += 1;
      summary.errors.push({ orderId: ord.id, error: live.errorMessage || 'Failed to query Cashfree' });
      continue;
    }

    if (live.paid) {
      const rec = await reconcilePaidOrder(env, {
        orderId: ord.id,
        cfOrderId: live.cfOrderId,
        cfPaymentId: live.cfPaymentId,
        paymentMethod: live.paymentMethod,
        paymentAmountInr: live.paymentAmount,
        bankReference: live.bankReference,
        paymentMessage: live.paymentMessage,
        paidAt: live.paymentTime,
        rawGatewayJson: JSON.stringify({ order: live.rawOrder, payment: live.rawPayment }),
        actorId: options?.actorId || 'reconciliation_sweep',
        ip: options?.ip,
      });
      if (rec.amountMismatch) {
        summary.amountMismatches += 1;
        summary.skippedCount += 1;
      } else if (rec.reconciled) {
        summary.reconciledPaid += 1;
        summary.reconciledPaidCount += 1;
        summary.details.push({
          orderId: ord.id,
          previousStatus: ord.status,
          nextStatus: 'PAID',
          action: 'RECONCILED_PAID',
        });
      }
    } else if (live.orderStatus === 'EXPIRED' || live.orderStatus === 'FAILED' || live.orderStatus === 'CANCELLED') {
      const nextStatus = live.orderStatus === 'CANCELLED' ? 'DROPPED' : live.orderStatus;
      if (nextStatus !== ord.status) {
        await billingDb
          .prepare(
            `UPDATE payment_orders
             SET status = ?, payment_status_normalized = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(nextStatus, live.normalizedState, live.paymentMessage || null, ord.id)
          .run()
          .catch(() => null);
        summary.updatedNonPaid += 1;
        summary.updatedFailedCount += 1;
        summary.details.push({
          orderId: ord.id,
          previousStatus: ord.status,
          nextStatus,
          action: 'UPDATED_TERMINAL_STATUS',
        });
      } else {
        summary.skippedCount += 1;
      }
    } else {
      summary.skippedCount += 1;
    }
  }

  // 2. Sync pending refunds with Cashfree PG Refunds API
  const pendingRefunds = await billingDb
    .prepare(
      `SELECT id, order_id, gateway_status
       FROM refunds
       WHERE status IN ('Approved', 'Pending') AND gateway_status = 'PENDING' AND order_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(Math.min(limit, 15))
    .all<{ id: string; order_id: string; gateway_status: string }>()
    .catch(() => ({ results: [] }));

  for (const ref of pendingRefunds.results || []) {
    const orderRefunds = await getCashfreeOrderRefunds(cfConfig, ref.order_id);
    if (!orderRefunds.ok) continue;
    const matched = orderRefunds.refunds.find((r) => r.refundId === ref.id || r.cfRefundId === ref.id);
    if (matched && matched.refundStatus !== 'PENDING') {
      await reconcileRefundOutcome(env, {
        refundId: ref.id,
        orderId: ref.order_id,
        cfRefundId: matched.cfRefundId,
        cfPaymentId: matched.cfPaymentId,
        refundAmountInr: matched.refundAmount,
        refundArn: matched.refundArn,
        refundMode: matched.refundMode,
        refundStatus: matched.refundStatus,
        statusDescription: matched.statusDescription,
        processedAt: matched.processedAt,
        rawGatewayJson: matched.raw ? JSON.stringify(matched.raw) : undefined,
        actorId: options?.actorId || 'reconciliation_sweep',
        ip: options?.ip,
      });
      summary.refundsSynced += 1;
    }
  }

  await recordAuditEvent(env, {
    actorId: options?.actorId || 'system',
    actorRole: 'admin',
    action: 'CASHFREE_RECONCILIATION_SWEEP',
    resourceType: 'payment_orders',
    resourceId: 'sweep',
    summary: `Checked ${summary.checkedOrders} orders: +${summary.reconciledPaid} paid, ~${summary.updatedNonPaid} status updates, ${summary.refundsSynced} refunds synced`,
    ip: options?.ip,
  });

  return summary;
}
