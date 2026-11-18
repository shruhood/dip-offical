export type PaymentAlertEventStatus =
  | 'Paid'
  | 'Failed'
  | 'Initiated'
  | 'Pending'
  | 'Refund Initiated'
  | 'Refunded'
  | 'Refund Failed';

export interface PaymentAlertDispatchInput {
  applicationId: string;
  orderId?: string;
  transactionId?: string;
  refundId?: string;
  refundArn?: string;
  status: PaymentAlertEventStatus;
  serviceName: string;
  amountInr: number;
  recipientEmail: string;
  recipientName?: string;
  paymentMethod?: string;
  eventTime?: string;
  reasonNote?: string;
}

export interface PaymentAlertDispatchResult {
  emailDeliveryStatus: 'Sent' | 'Queued' | 'Failed' | 'Channel Unconfigured';
  emailConfigured: boolean;
  emailMessageId?: string;
  errorMessage?: string;
  subject: string;
  textSummary: string;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPaymentAlertEmailContent(params: {
  input: PaymentAlertDispatchInput;
  appDomain?: string;
}): { subject: string; html: string; text: string } {
  const { input } = params;
  const domain = (params.appDomain || 'https://digitalindiaproject.com').replace(/\/+$/, '');
  const amountText = `₹${Number(input.amountInr || 0).toLocaleString('en-IN')}`;
  const orderRef = input.orderId || input.applicationId;
  const txnRef = input.refundId || input.transactionId || orderRef;
  const method = input.paymentMethod || 'Cashfree PG';
  const recipientName = input.recipientName || 'Applicant';

  let subject = `[Digital India Project] Payment Update (${amountText}) — ${input.applicationId}`;
  let text = '';
  let accentHex = '#0F172A';
  let surfaceHex = '#F1F5F9';
  let badgeText = 'PAYMENT UPDATE';
  let headline = `Payment Update for ${escapeHtml(input.applicationId)}`;
  let guidance = 'Track your order and payment status directly inside your dashboard.';

  if (input.status === 'Paid') {
    subject = `[Digital India Project] Payment Confirmed (${amountText}) — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nYour payment of ${amountText} for ${input.serviceName} (${input.applicationId}) has been confirmed.\nOrder ID: ${orderRef}\nTransaction ID: ${txnRef}\nMethod: ${method}\n\nTrack your application and download your receipt at: ${domain}/dashboard\n\nRegards,\nDigital India Project`;
    accentHex = '#138808';
    surfaceHex = '#ECFDF5';
    badgeText = 'PAYMENT CONFIRMED';
    headline = `Payment of ${escapeHtml(amountText)} Confirmed`;
    guidance = 'Your payment has been reconciled and your service application is now queued for compliance desk processing.';
  } else if (input.status === 'Failed') {
    subject = `[Digital India Project] Action Needed: Payment Failed — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nYour payment attempt of ${amountText} for ${input.serviceName} (${input.applicationId}) did not complete.\nOrder ID: ${orderRef}\nReference ID: ${txnRef}\n\nPlease retry payment from Payments & Invoices in your dashboard: ${domain}/dashboard\n\nRegards,\nDigital India Project`;
    accentHex = '#DC2626';
    surfaceHex = '#FEF2F2';
    badgeText = 'PAYMENT FAILED';
    headline = `Payment of ${escapeHtml(amountText)} Did Not Complete`;
    guidance = 'No charge has been finalized for this attempt. Please return to Payments & Invoices in your dashboard to complete payment and avoid delays.';
  } else if (input.status === 'Initiated' || input.status === 'Pending') {
    subject = `[Digital India Project] Payment ${input.status} (${amountText}) — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nYour payment order of ${amountText} for ${input.serviceName} (${input.applicationId}) is currently ${input.status.toLowerCase()}.\nOrder ID: ${orderRef}\n\nYou can complete or verify payment status anytime from your dashboard: ${domain}/dashboard\n\nRegards,\nDigital India Project`;
    accentHex = '#B45309';
    surfaceHex = '#FFFBEB';
    badgeText = input.status === 'Initiated' ? 'PAYMENT INITIATED' : 'PAYMENT PENDING';
    headline = `Payment of ${escapeHtml(amountText)} is ${escapeHtml(input.status)}`;
    guidance = 'If you already completed UPI or bank authorization, status will sync automatically via Cashfree webhook.';
  } else if (input.status === 'Refund Initiated') {
    subject = `[Digital India Project] Refund Initiated (${amountText}) — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nA refund of ${amountText} for ${input.serviceName} (${input.applicationId}) has been initiated via Cashfree.\nOrder ID: ${orderRef}\nRefund Reference: ${txnRef}\n${input.reasonNote ? `Note: ${input.reasonNote}\n` : ''}\nRefund settlement typically completes within 3-5 working days.\n\nRegards,\nDigital India Project`;
    accentHex = '#0369A1';
    surfaceHex = '#F0F9FF';
    badgeText = 'REFUND INITIATED';
    headline = `Refund of ${escapeHtml(amountText)} Initiated`;
    guidance = 'Your refund has been submitted to Cashfree PG and will be credited back to the original payment method.';
  } else if (input.status === 'Refunded') {
    subject = `[Digital India Project] Refund Completed (${amountText}) — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nYour refund of ${amountText} for ${input.serviceName} (${input.applicationId}) has been completed.\nOrder ID: ${orderRef}\nRefund Reference: ${txnRef}${input.refundArn ? `\nBank ARN/UTR: ${input.refundArn}` : ''}\n\nView details in your dashboard: ${domain}/dashboard\n\nRegards,\nDigital India Project`;
    accentHex = '#138808';
    surfaceHex = '#ECFDF5';
    badgeText = 'REFUND COMPLETED';
    headline = `Refund of ${escapeHtml(amountText)} Settled`;
    guidance = `Your refund has been processed by Cashfree${input.refundArn ? ` (ARN/UTR: ${input.refundArn})` : ''}.`;
  } else if (input.status === 'Refund Failed') {
    subject = `[Digital India Project] Refund Status Alert — ${input.applicationId}`;
    text = `Dear ${recipientName},\n\nThe refund attempt of ${amountText} for ${input.serviceName} (${input.applicationId}) requires attention.\nOrder ID: ${orderRef}\nRefund Reference: ${txnRef}\n${input.reasonNote ? `Gateway Note: ${input.reasonNote}\n` : ''}\nOur finance team has been notified and will assist promptly.\n\nRegards,\nDigital India Project`;
    accentHex = '#DC2626';
    surfaceHex = '#FEF2F2';
    badgeText = 'REFUND FAILED';
    headline = `Refund of ${escapeHtml(amountText)} Requires Review`;
    guidance = input.reasonNote || 'Our finance compliance team has flagged this refund for manual settlement retry.';
  }

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #E2E8F0;background:#FFFFFF;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:#FF671F;text-transform:uppercase;">Digital India Project</div>
          <div style="margin-top:8px;display:inline-block;padding:4px 10px;border-radius:6px;background:${surfaceHex};color:${accentHex};font-size:11px;font-weight:700;">${badgeText}</div>
          <h1 style="margin:12px 0 4px;font-size:20px;line-height:1.3;color:#0F172A;">${headline}</h1>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#475569;">Hello ${escapeHtml(recipientName)}, ${escapeHtml(guidance)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size:13px;border-collapse:collapse;">
            <tr>
              <td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Service</td>
              <td style="text-align:right;font-weight:600;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(input.serviceName)}</td>
            </tr>
            <tr>
              <td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Application ID</td>
              <td style="text-align:right;font-family:monospace;font-weight:600;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(input.applicationId)}</td>
            </tr>
            <tr>
              <td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Order ID</td>
              <td style="text-align:right;font-family:monospace;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(orderRef)}</td>
            </tr>
            <tr>
              <td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Reference ID</td>
              <td style="text-align:right;font-family:monospace;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(txnRef)}</td>
            </tr>
            ${input.refundArn ? `<tr><td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Refund ARN / UTR</td><td style="text-align:right;font-family:monospace;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(input.refundArn)}</td></tr>` : ''}
            <tr>
              <td style="color:#64748B;border-bottom:1px solid #F1F5F9;">Amount</td>
              <td style="text-align:right;font-weight:700;color:${accentHex};border-bottom:1px solid #F1F5F9;">${escapeHtml(amountText)}</td>
            </tr>
            <tr>
              <td style="color:#64748B;">Payment Method</td>
              <td style="text-align:right;color:#0F172A;">${escapeHtml(method)}</td>
            </tr>
          </table>
          <div style="margin-top:20px;">
            <a href="${escapeHtml(domain)}/dashboard" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#FF671F;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;">Open Customer Dashboard</a>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export async function dispatchPaymentAlertEmail(params: {
  resendApiKey?: string;
  appDomain?: string;
  businessEmail?: string;
  paymentsEmail?: string;
  input: PaymentAlertDispatchInput;
}): Promise<PaymentAlertDispatchResult> {
  const { resendApiKey, appDomain, businessEmail, paymentsEmail, input } = params;
  const { subject, html, text } = buildPaymentAlertEmailContent({ input, appDomain });
  const recipient = String(input.recipientEmail || '').trim();
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);

  if (!resendApiKey || !String(resendApiKey).trim()) {
    return {
      emailDeliveryStatus: 'Channel Unconfigured',
      emailConfigured: false,
      subject,
      textSummary: text,
      errorMessage: 'RESEND_API_KEY not configured in runtime environment',
    };
  }

  if (!hasValidEmail) {
    return {
      emailDeliveryStatus: 'Failed',
      emailConfigured: true,
      subject,
      textSummary: text,
      errorMessage: 'Valid recipient email is required',
    };
  }

  const chosenSender =
    paymentsEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentsEmail)
      ? paymentsEmail
      : businessEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)
      ? businessEmail
      : 'payments@digitalindiaproject.com';

  const fromEmail = `Digital India Project <${chosenSender}>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(resendApiKey).trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html,
        text,
      }),
    });

    const json = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) {
      return {
        emailDeliveryStatus: 'Failed',
        emailConfigured: true,
        subject,
        textSummary: text,
        errorMessage: json?.message || `Email provider HTTP ${response.status}`,
      };
    }

    return {
      emailDeliveryStatus: 'Sent',
      emailConfigured: true,
      emailMessageId: json?.id,
      subject,
      textSummary: text,
    };
  } catch (err: any) {
    return {
      emailDeliveryStatus: 'Failed',
      emailConfigured: true,
      subject,
      textSummary: text,
      errorMessage: err?.message || 'Failed to contact email provider',
    };
  }
}
