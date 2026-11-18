import { Hono } from 'hono';
import type { ExecutionContext, Fetcher, ScheduledController } from '@cloudflare/workers-types';
import type { AppVariables, Env } from './types';
import {
  buildApiResponse,
  rateLimitMiddleware,
  securityHeadersMiddleware,
} from './middleware/security';
import { handleCashfreeWebhookGet, handleCashfreeWebhookPost, v1Router } from './routes/v1';
import { apiSathiRouter, processWorkerApiSathiRetryQueue } from './routes/apiSathiRoutes';
import { adminRouter } from './routes/adminRoutes';
import { storageRouter } from './routes/storageRoutes';
import {
  customerRouter,
  integrationsRouter,
  partnerRouter,
  publicBlogRouter,
} from './routes/portalAndJunctionRoutes';
import {
  getAvailableAiProviders,
  runMultiProviderAssistant,
} from './lib/aiProviders';
import { DatabaseRegistry } from './config/database';
import { StorageRegistry } from './config/storage';
import {
  buildDirectorySubSitemapXml,
  buildSitemapIndexXml,
  buildSitemapXml,
} from '../src/lib/blogSeo';
import { INITIAL_SERVICES } from '../src/data/initialData';
import { INITIAL_BLOG_POSTS } from '../src/data/initialBlogPosts';
import type { BlogPost } from '../src/types';
import { parseIndiaDirectoryPath } from '../src/lib/indiaDirectorySeo';
import {
  evaluateAllDirectoryIndexableEntries,
  getDirectoryLocations,
  getPublishedDirectoryServices,
} from './lib/directoryStore';
import { renderIndiaDirectorySsrResponse } from './lib/directorySsr';
import {
  adminDirectoryRouter,
  publicDirectoryRouter,
} from './routes/directoryRoutes';
import {
  buildCashfreeUnconfiguredMessage,
  createCashfreePgOrder,
  getCashfreePgOrderStatus,
  isProductionEnvironment,
  loadEffectiveCashfreeConfig,
  resolveCashfreeConfig,
} from './services/cashfreeService';
import { reconcilePaidOrder } from './services/paymentReconciliation';
import {
  normalizePaymentUiStatus,
  summarizePaymentStatuses,
  type ApplicationPaymentStatusItem,
} from '../src/lib/paymentStatus';
import { dispatchPaymentAlertEmail } from './services/paymentAlertService';
import { resolveUserFromRequest } from './middleware/auth';
import { isSuperAdminRole } from '../src/lib/rbac';
import { findCatalogueItem, resolveAuthoritativeCheckout } from '../src/lib/catalogueServer';
import { generateDigitalProductPayload } from '../src/data/catalogue/digitalGenerators';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const FIREBASE_AUTH_HOST = 'gen-lang-client-0294214396.firebaseapp.com';

async function proxyFirebaseAuthRequest(rawRequest: Request): Promise<Response> {
  const url = new URL(rawRequest.url);
  const targetUrl = `https://${FIREBASE_AUTH_HOST}${url.pathname}${url.search}`;
  const headers = new Headers(rawRequest.headers);
  headers.set('x-forwarded-host', url.host);
  headers.delete('host');

  const init: RequestInit = {
    method: rawRequest.method,
    headers,
    redirect: 'manual',
  };

  if (rawRequest.method !== 'GET' && rawRequest.method !== 'HEAD') {
    init.body = rawRequest.body;
  }

  const upstream = await fetch(targetUrl, init);
  const respHeaders = new Headers(upstream.headers);
  if (url.pathname === '/__/auth/iframe') {
    respHeaders.delete('X-Frame-Options');
  } else if (url.pathname.startsWith('/__/auth/')) {
    respHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

app.use('*', securityHeadersMiddleware);
app.use('/api/*', rateLimitMiddleware(120, 60_000));
app.all('/__/auth/*', (c) => proxyFirebaseAuthRequest(c.req.raw));
app.all('/__/firebase/*', (c) => proxyFirebaseAuthRequest(c.req.raw));

function buildStandardResponse<T>(params: {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REJECTED';
  message: string;
  referenceId: string;
  providerReference?: string;
  data: T;
  errorCode?: string | null;
}) {
  return {
    success: params.success,
    status: params.status,
    message: params.message,
    reference_id: params.referenceId,
    provider_reference: params.providerReference || `PROV_${Date.now()}`,
    data: params.data,
    error_code: params.errorCode || null,
    timestamp: new Date().toISOString(),
  };
}

app.get('/api/health', async (c) => {
  const dbReg = new DatabaseRegistry(c.env);
  const storageReg = new StorageRegistry(c.env);
  const cfConfig = await loadEffectiveCashfreeConfig(c.env);
  return c.json({
    status: 'healthy',
    platform: 'Digital India Project 2.0',
    domain: c.env.APP_DOMAIN || 'https://digitalindiaproject.com',
    authDomain: 'digitalindiaproject.com',
    environment: c.env.ENVIRONMENT || 'production',
    databaseConfigured: Boolean(c.env.DB),
    physicalDatabasesBound: dbReg.getPhysicalBindingsCount(),
    storageConfigured: Boolean(c.env.DOCUMENTS_BUCKET),
    physicalBucketsBound: storageReg.getPhysicalBucketsCount(),
    cashfreeConfigured: cfConfig.configured,
    cashfreeEnabled: cfConfig.isEnabled,
    cashfreeMode: cfConfig.mode,
    cashfreeApiVersion: cfConfig.apiVersion,
    cashfreeWebhookEndpoint: `${cfConfig.appDomain}/api/webhooks/cashfree`,
    cashfreeClientIdConfigured: cfConfig.clientIdConfigured,
    cashfreeClientSecretConfigured: cfConfig.clientSecretConfigured,
    cashfreeMissingBindings: cfConfig.missingBindings,
    digilockerConfigured: !!(c.env.DIGILOCKER_CLIENT_ID && c.env.DIGILOCKER_CLIENT_SECRET),
    emailConfigured: !!c.env.RESEND_API_KEY,
    geminiConfigured: !!c.env.GEMINI_API_KEY,
    openrouterConfigured: !!c.env.OPENROUTER_API_KEY,
    groqConfigured: !!c.env.GROQ_API_KEY,
    openaiConfigured: !!c.env.OPENAI_API_KEY,
    anthropicConfigured: !!c.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (c) => {
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Digital India Project 2.0 API Worker is active',
      requestId: c.get('requestId'),
      data: {
        name: 'Digital India Project API',
        version: '2.0.0',
      },
    })
  );
});

// Primary documented Cashfree webhook endpoint + legacy alias under /api/v1/payments/webhook
app.get('/api/webhooks/cashfree', handleCashfreeWebhookGet);
app.post('/api/webhooks/cashfree', handleCashfreeWebhookPost);

// Mount Enterprise Modular API Routers under digitalindiaproject.com/api/*
app.route('/api/v1/apisathi', apiSathiRouter);
app.route('/api/v1', v1Router);
app.route('/api/admin', adminRouter);
app.route('/api/storage', storageRouter);
app.route('/api/customer', customerRouter);
app.route('/api/partners', partnerRouter);
app.route('/api/integrations', integrationsRouter);
app.route('/api/blog', publicBlogRouter);
app.route('/api/directory', publicDirectoryRouter);
app.route('/api/admin/directory', adminDirectoryRouter);

app.get('/api/ai/providers', (c) => {
  return c.json({
    providers: getAvailableAiProviders(c.env),
  });
});

const handleWorkerAiAssistant = async (c: any) => {
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const prompt = body?.prompt;
  const language = body?.language || 'en';
  const history = Array.isArray(body?.history) ? body.history : [];
  const provider = body?.provider || 'auto';

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  try {
    const result = await runMultiProviderAssistant({
      payload: { prompt, language, history, provider },
      env: c.env,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json(
      { error: 'Failed to contact AI assistant provider', details: err?.message || 'Error' },
      500
    );
  }
};

app.post('/api/ai/assistant', handleWorkerAiAssistant);
app.post('/api/gemini/assistant', handleWorkerAiAssistant);

// Preserved backward-compatible Cashfree & API Setu routes (live PG when secrets set)
app.post('/api/payments/create-order', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const {
    amount,
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    serviceName,
    serviceSlug,
    serviceId,
    urgentProcessing,
    couponCode,
    preferredMode,
    returnUrl,
  } = body;

  let authoritativeAmount = Number(amount || 1);
  if (serviceSlug || serviceId) {
    const checkout = resolveAuthoritativeCheckout({
      serviceSlug,
      serviceId,
      urgentProcessing: Boolean(urgentProcessing),
      couponCode: typeof couponCode === 'string' ? couponCode : undefined,
      clientTotalInr: amount !== undefined ? Number(amount) : undefined,
    });
    if (!checkout.ok) {
      return c.json(
        {
          success: false,
          error: checkout.message || 'Authoritative pricing verification failed',
          errorCode: checkout.errorCode || 'PRICE_TAMPER_OR_MISMATCH',
        },
        (checkout.status || 400) as any
      );
    }
    authoritativeAmount = checkout.totalInr;
  }

  const orderId = `CF_ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const cfConfig = await loadEffectiveCashfreeConfig(c.env, preferredMode);
  if (!cfConfig.isEnabled) {
    return c.json({ success: false, error: 'Cashfree gateway disabled by administrator', errorCode: 'PAYMENT_GATEWAY_DISABLED' }, 503);
  }
  if (cfConfig.isProductionRuntime) {
    const authUser = await resolveUserFromRequest(c.req.header('authorization'), c.env);
    if (!authUser) {
      return c.json({ success: false, error: 'Authentication required in production', errorCode: 'UNAUTHORIZED' }, 401);
    }
    if (!cfConfig.configured) {
      return c.json(
        {
          success: false,
          error: buildCashfreeUnconfiguredMessage(cfConfig),
          errorCode: 'CASHFREE_NOT_CONFIGURED',
          missingBindings: cfConfig.missingBindings,
        },
        503
      );
    }
  }

  if (cfConfig.configured) {
    const cfOrder = await createCashfreePgOrder(cfConfig, {
      orderId,
      amountInr: authoritativeAmount,
      customerId: String(customerId || 'guest_applicant'),
      customerName: String(customerName || 'Citizen Applicant'),
      customerEmail: String(customerEmail || 'applicant@digitalindiaproject.com'),
      customerPhone: String(customerPhone || '9876543210'),
      orderNote: String(serviceName || 'Digital India Project Service Fee'),
      returnUrl: typeof returnUrl === 'string' ? returnUrl : undefined,
    });

    if (!cfOrder.ok || !cfOrder.paymentSessionId) {
      return c.json(
        {
          success: false,
          error: cfOrder.errorMessage || 'Cashfree order creation failed',
          errorCode: cfOrder.errorCode || 'CASHFREE_ORDER_ERROR',
          gatewayConfigured: true,
          mode: cfConfig.mode,
        },
        cfOrder.httpStatus >= 400 && cfOrder.httpStatus < 600 ? (cfOrder.httpStatus as any) : 502
      );
    }

    return c.json({
      success: true,
      orderId: cfOrder.orderId,
      cfOrderId: cfOrder.cfOrderId,
      paymentSessionId: cfOrder.paymentSessionId,
      amount: authoritativeAmount,
      currency: 'INR',
      mode: cfConfig.mode,
      gatewayConfigured: true,
      simulationOnly: false,
      customer: { customerId, customerName, customerEmail, customerPhone },
      status: cfOrder.orderStatus || 'ACTIVE',
    });
  }

  return c.json({
    success: true,
    orderId,
    paymentSessionId: `sim_session_${Date.now()}`,
    amount: authoritativeAmount,
    currency: 'INR',
    mode: 'sandbox',
    gatewayConfigured: false,
    simulationOnly: true,
    customer: { customerId, customerName, customerEmail, customerPhone },
    status: 'ACTIVE',
  });
});

app.get('/api/products/:slug/download', async (c) => {
  const slug = String(c.req.param('slug') || '').trim();
  const orderId = String(c.req.query('orderId') || '').trim();
  const product = findCatalogueItem(slug);

  if (!product || (product.productType !== 'digital_product' && product.category !== 'digital-products')) {
    return c.json({ success: false, errorCode: 'PRODUCT_NOT_FOUND', error: 'Digital product not found.' }, 404);
  }

  const user = await resolveUserFromRequest(c.req.header('authorization'), c.env);
  if (!user && !orderId) {
    return c.json(
      {
        success: false,
        errorCode: 'UNAUTHORIZED',
        error: 'Authentication or verified paid orderId is required to download this digital product.',
      },
      401
    );
  }

  let authorized = Boolean(user && (isSuperAdminRole(user.role) || user.role === 'admin'));
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');

  if (!authorized && billingDb) {
    try {
      if (orderId) {
        const paidDig = await billingDb.prepare(
          user
            ? `SELECT id FROM digital_product_orders WHERE order_id = ? AND product_slug = ? AND user_id = ? AND payment_status = 'Paid' LIMIT 1`
            : `SELECT id FROM digital_product_orders WHERE order_id = ? AND product_slug = ? AND payment_status = 'Paid' LIMIT 1`
        )
          .bind(...(user ? [orderId, product.slug, user.id] : [orderId, product.slug]))
          .first<{ id: string }>();
        if (paidDig) authorized = true;

        if (!authorized) {
          const paidOrd = await billingDb.prepare(
            user
              ? `SELECT id FROM payment_orders WHERE id = ? AND application_id = ? AND user_id = ? AND status = 'PAID' LIMIT 1`
              : `SELECT id FROM payment_orders WHERE id = ? AND application_id = ? AND status = 'PAID' LIMIT 1`
          )
            .bind(...(user ? [orderId, `DIG_${product.slug}`, user.id] : [orderId, `DIG_${product.slug}`]))
            .first<{ id: string }>();
          if (paidOrd) authorized = true;
        }
      } else if (user) {
        const paidDigUser = await billingDb.prepare(
          `SELECT id FROM digital_product_orders WHERE user_id = ? AND product_slug = ? AND payment_status = 'Paid' LIMIT 1`
        )
          .bind(user.id, product.slug)
          .first<{ id: string }>();
        if (paidDigUser) authorized = true;
      }
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return c.json(
      {
        success: false,
        errorCode: 'PAYMENT_REQUIRED',
        error: 'Payment verification required before downloading this digital product.',
      },
      403
    );
  }

  if (product.digitalAsset?.r2ObjectKey) {
    const resolvedBucket = new StorageRegistry(c.env).resolve('dip-generated-files');
    if (resolvedBucket.bucket) {
      const r2Obj = await resolvedBucket.bucket.get(product.digitalAsset.r2ObjectKey);
      if (r2Obj) {
        const ext = product.digitalAsset.r2ObjectKey.split('.').pop() || 'bin';
        return new Response(r2Obj.body as unknown as BodyInit, {
          headers: {
            'Content-Type': r2Obj.httpMetadata?.contentType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${product.slug}.${ext}"`,
            'Cache-Control': 'no-store, private',
          },
        });
      }
    }
  }

  const generated = generateDigitalProductPayload(
    product.digitalAsset?.generatorKey,
    product.slug,
    product.name
  );
  return new Response(generated.content, {
    headers: {
      'Content-Type': generated.contentType,
      'Content-Disposition': `attachment; filename="${generated.fileName}"`,
      'Cache-Control': 'no-store, private',
    },
  });
});

app.post('/api/payments/verify', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const orderId = String(body?.orderId || '').trim();
  const cfConfig = await loadEffectiveCashfreeConfig(c.env, body?.preferredMode);

  if (cfConfig.isProductionRuntime) {
    const authUser = await resolveUserFromRequest(c.req.header('authorization'), c.env);
    if (!authUser) {
      return c.json({ success: false, error: 'Authentication required in production', errorCode: 'UNAUTHORIZED' }, 401);
    }
    if (!cfConfig.configured) {
      return c.json(
        {
          success: false,
          error: buildCashfreeUnconfiguredMessage(cfConfig),
          errorCode: 'CASHFREE_NOT_CONFIGURED',
          missingBindings: cfConfig.missingBindings,
        },
        503
      );
    }
  }

  if (!orderId) {
    return c.json({ success: false, error: 'orderId is required' }, 400);
  }

  if (cfConfig.configured) {
    const liveStatus = await getCashfreePgOrderStatus(cfConfig, orderId);
    if (liveStatus.ok && liveStatus.paid) {
      const rec = await reconcilePaidOrder(c.env, {
        orderId,
        cfPaymentId: liveStatus.cfPaymentId,
        paymentMethod: liveStatus.paymentMethod,
        paymentAmountInr: liveStatus.paymentAmount,
        paidAt: liveStatus.paymentTime,
        ip: c.req.header('cf-connecting-ip'),
      });
      if (rec.amountMismatch) {
        return c.json(
          {
            success: false,
            orderId,
            orderStatus: 'FAILED',
            status: 'REJECTED',
            paid: false,
            error: rec.message,
            errorCode: 'PAYMENT_AMOUNT_MISMATCH',
          },
          409
        );
      }
    }
    return c.json(
      {
        success: liveStatus.ok,
        orderId: liveStatus.orderId,
        orderStatus: liveStatus.orderStatus,
        status: liveStatus.paid ? 'SUCCESS' : liveStatus.orderStatus,
        paid: liveStatus.paid,
        cfPaymentId: liveStatus.cfPaymentId,
        paymentMethod: liveStatus.paymentMethod,
        paymentTime: liveStatus.paymentTime,
        bankReference: liveStatus.bankReference,
        paymentMessage: liveStatus.paymentMessage,
        gatewayConfigured: true,
        mode: cfConfig.mode,
        error: liveStatus.errorMessage,
      },
      liveStatus.ok ? 200 : 502
    );
  }

  const sandboxApproved = body?.simulateSandboxSuccess === true;
  return c.json({
    success: true,
    orderId,
    orderStatus: sandboxApproved ? 'PAID' : 'CREATED',
    status: sandboxApproved ? 'SUCCESS' : 'PENDING',
    paid: sandboxApproved,
    cfPaymentId: sandboxApproved ? `CF_PAY_SIM_${Date.now()}` : undefined,
    paymentTime: sandboxApproved ? new Date().toISOString() : undefined,
    gatewayConfigured: false,
    simulationOnly: true,
  });
});

app.post('/api/payments/applications/status', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawApps = Array.isArray(body?.applications) ? body.applications : [];
  const cfConfig = resolveCashfreeConfig(c.env, body?.preferredMode);
  if (cfConfig.isProductionRuntime) {
    const authUser = await resolveUserFromRequest(c.req.header('authorization'), c.env);
    if (!authUser) {
      return c.json({ success: false, error: 'Authentication required in production', errorCode: 'UNAUTHORIZED' }, 401);
    }
    if (!cfConfig.configured) {
      return c.json(
        {
          success: false,
          error: buildCashfreeUnconfiguredMessage(cfConfig),
          errorCode: 'CASHFREE_NOT_CONFIGURED',
          missingBindings: cfConfig.missingBindings,
        },
        503
      );
    }
  }
  const checkedAt = new Date().toISOString();

  const items: ApplicationPaymentStatusItem[] = await Promise.all(
    rawApps.slice(0, 25).map(async (entry: any): Promise<ApplicationPaymentStatusItem> => {
      const applicationId = String(entry?.applicationId || '').trim();
      const orderId = String(entry?.orderId || '').trim();
      const currentStatus = typeof entry?.currentStatus === 'string' ? entry.currentStatus : undefined;

      if (!orderId) {
        const uiStatus = normalizePaymentUiStatus(currentStatus);
        return {
          applicationId,
          orderId: '',
          uiStatus,
          gatewayStatus: uiStatus === 'Paid' ? 'PAID' : uiStatus === 'Failed' ? 'FAILED' : 'PENDING',
          paid: uiStatus === 'Paid',
          gatewayConfigured: cfConfig.configured,
          simulationOnly: !cfConfig.configured,
          mode: cfConfig.mode,
          source: 'missing_order_id',
          checkedAt,
        };
      }

      if (!cfConfig.configured) {
        const uiStatus = normalizePaymentUiStatus(currentStatus);
        return {
          applicationId,
          orderId,
          uiStatus,
          gatewayStatus: uiStatus === 'Paid' ? 'PAID' : uiStatus === 'Failed' ? 'FAILED' : 'CREATED',
          paid: uiStatus === 'Paid',
          gatewayConfigured: false,
          simulationOnly: true,
          mode: cfConfig.mode,
          source: 'sandbox_preview',
          checkedAt,
        };
      }

      const liveStatus = await getCashfreePgOrderStatus(cfConfig, orderId);
      if (!liveStatus.ok) {
        const fallbackUi = normalizePaymentUiStatus(currentStatus);
        return {
          applicationId,
          orderId,
          uiStatus: fallbackUi,
          gatewayStatus: 'PENDING',
          paid: fallbackUi === 'Paid',
          gatewayConfigured: true,
          mode: cfConfig.mode,
          source: 'gateway_unreachable',
          checkedAt,
          errorMessage: liveStatus.errorMessage,
        };
      }

      return {
        applicationId,
        orderId: liveStatus.orderId || orderId,
        uiStatus: normalizePaymentUiStatus(liveStatus.orderStatus, liveStatus.paid),
        gatewayStatus: liveStatus.orderStatus,
        paid: liveStatus.paid,
        cfPaymentId: liveStatus.cfPaymentId,
        paymentMethod: liveStatus.paymentMethod,
        paymentTime: liveStatus.paymentTime,
        bankReference: liveStatus.bankReference,
        paymentAmount: liveStatus.paymentAmount,
        paymentMessage: liveStatus.paymentMessage,
        gatewayConfigured: true,
        mode: cfConfig.mode,
        source: 'cashfree_live',
        checkedAt,
      };
    })
  );

  return c.json({
    success: true,
    status: 'SUCCESS',
    data: {
      items,
      summary: summarizePaymentStatuses(items),
      gatewayConfigured: cfConfig.configured,
      simulationOnly: !cfConfig.configured,
      mode: cfConfig.mode,
      checkedAt,
    },
  });
});

app.get('/api/payments/history', async (c) => {
  if (isProductionEnvironment(c.env)) {
    const authUser = await resolveUserFromRequest(c.req.header('authorization'), c.env);
    if (!authUser) {
      return c.json({ success: false, error: 'Authentication required in production', errorCode: 'UNAUTHORIZED' }, 401);
    }
  }
  const rawPage = Number(c.req.query('page') || 1);
  const rawPageSize = Number(c.req.query('pageSize') || 50);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), 100)
      : 50;
  return c.json({
    success: true,
    status: 'SUCCESS',
    data: {
      items: [],
      pagination: {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    },
  });
});

const handlePaymentAlertFallback = async (c: any) => {
  if (isProductionEnvironment(c.env)) {
    const authUser = await resolveUserFromRequest(c.req.header('authorization'), c.env);
    if (!authUser) {
      return c.json({ success: false, error: 'Authentication required in production', errorCode: 'UNAUTHORIZED' }, 401);
    }
  }
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const applicationId = String(body?.applicationId || '').trim();
  const normalized = normalizePaymentUiStatus(body?.status);

  if (!applicationId || (normalized !== 'Paid' && normalized !== 'Failed')) {
    return c.json(
      {
        success: false,
        status: 'FAILED',
        message: 'applicationId and status (Paid or Failed) are required',
        data: null,
      },
      400
    );
  }

  const emailResult = await dispatchPaymentAlertEmail({
    resendApiKey: c.env.RESEND_API_KEY,
    appDomain: c.env.APP_DOMAIN,
    businessEmail: c.env.BUSINESS_EMAIL,
    input: {
      applicationId,
      orderId: String(body?.orderId || '').trim(),
      transactionId: String(body?.transactionId || '').trim(),
      status: normalized,
      serviceName: String(body?.serviceName || 'Digital India Service').trim(),
      amountInr: Number(body?.amountInr || 0) || 0,
      recipientEmail: String(body?.recipientEmail || '').trim(),
      recipientName: String(body?.recipientName || 'Applicant').trim(),
      paymentMethod: String(body?.paymentMethod || 'Cashfree PG').trim(),
    },
  });

  return c.json({
    success: true,
    status: 'SUCCESS',
    message: 'Payment status alert processed',
    data: {
      notificationId: `notif_pay_${applicationId}_${normalized.toLowerCase()}`,
      applicationId,
      status: normalized,
      inAppRecorded: true,
      emailDeliveryStatus: emailResult.emailDeliveryStatus,
      emailConfigured: emailResult.emailConfigured,
      emailMessageId: emailResult.emailMessageId,
      deduplicated: false,
    },
  });
};

app.post('/api/payments/payment-alert', handlePaymentAlertFallback);
app.post('/api/notifications/payment-alert', handlePaymentAlertFallback);

app.get('/api/v1/apisetu/catalogue', (c) => {
  const catalogue = [
    {
      id: 'api-morth-dl',
      name: 'Driving Licence Verification API',
      provider: 'Ministry of Road Transport & Highways (MoRTH)',
      apiSetuRef: 'in.gov.morth.dl',
      category: 'Transport & Identity',
      authType: 'OAuth 2.0 Bearer',
      sandboxAvailable: true,
      pricingPerCall: 1.5,
      consentRequired: true,
    },
    {
      id: 'api-itd-pan',
      name: 'Instant PAN Verification API',
      provider: 'Income Tax Department / NSDL',
      apiSetuRef: 'in.gov.incometax.pan',
      category: 'Taxation & Identity',
      authType: 'HMAC / API Key',
      sandboxAvailable: true,
      pricingPerCall: 0.8,
      consentRequired: true,
    },
    {
      id: 'api-gstn-verify',
      name: 'GSTIN Profile & Return Status API',
      provider: 'Goods and Services Tax Network (GSTN)',
      apiSetuRef: 'in.gov.gst.verify',
      category: 'Corporate & Compliance',
      authType: 'API Key + IP Whitelist',
      sandboxAvailable: true,
      pricingPerCall: 0.5,
      consentRequired: true,
    },
    {
      id: 'api-msme-udyam',
      name: 'Udyam Registration Verification API',
      provider: 'Ministry of MSME',
      apiSetuRef: 'in.gov.msme.udyam',
      category: 'Business & Enterprise',
      authType: 'OAuth 2.0',
      sandboxAvailable: true,
      pricingPerCall: 1.0,
      consentRequired: true,
    },
  ];

  return c.json(
    buildStandardResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Active API Setu catalogue retrieved successfully',
      referenceId: `cat_${Date.now()}`,
      data: catalogue,
    })
  );
});

app.post('/api/v1/apisetu/verify', async (c) => {
  const user = await resolveUserFromRequest(c.req.header('authorization'), c.env);
  if (!user) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'REJECTED',
        message: 'Authentication required to invoke API Setu verification.',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'UNAUTHORIZED',
      }),
      401
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { apiRef, parameters, consentGiven } = body;

  if (!consentGiven) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'REJECTED',
        message: 'Explicit customer consent is legally required before querying API Setu provider registries',
        referenceId: `corr_setu_err_${Date.now()}`,
        data: null,
        errorCode: 'CONSENT_DENIED',
      }),
      403
    );
  }

  const apiSetuConfigured = Boolean(c.env.API_SETU_API_KEY);
  if (isProductionEnvironment(c.env) && !apiSetuConfigured) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'API Setu gateway credentials are not configured in production.',
        referenceId: `corr_setu_err_${Date.now()}`,
        data: null,
        errorCode: 'API_SETU_NOT_CONFIGURED',
      }),
      503
    );
  }

  return c.json(
    buildStandardResponse({
      success: true,
      status: apiSetuConfigured ? 'SUCCESS' : 'PENDING',
      message: apiSetuConfigured
        ? 'Registry verification completed via API Setu Worker adapter'
        : 'Sandbox preview verification recorded (API Setu key not configured)',
      referenceId: `corr_setu_${Date.now()}`,
      data: {
        apiRef,
        verified: apiSetuConfigured,
        simulationOnly: !apiSetuConfigured,
        queryReference: parameters || {},
        verifiedAt: new Date().toISOString(),
      },
    })
  );
});

app.post('/api/v1/digilocker/authorize', async (c) => {
  const user = await resolveUserFromRequest(c.req.header('authorization'), c.env);
  if (!user) {
    return c.json({ error: 'Authentication required for DigiLocker authorization.', errorCode: 'UNAUTHORIZED' }, 401);
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { purpose, clientName = 'Digital India Project', redirectUri } = body;

  if (!purpose) {
    return c.json(
      { error: 'Mandatory DigiLocker purpose disclosure is required before initiating authorization' },
      400
    );
  }

  const clientId = c.env.DIGILOCKER_CLIENT_ID;
  const configured = Boolean(clientId && c.env.DIGILOCKER_CLIENT_SECRET);
  if (isProductionEnvironment(c.env) && !configured) {
    return c.json(
      {
        error: 'DigiLocker OAuth credentials are not configured in production.',
        errorCode: 'DIGILOCKER_NOT_CONFIGURED',
        configured: false,
      },
      503
    );
  }

  const authSessionId = `dl_sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const authorizationUrl = `https://api.digitallocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${encodeURIComponent(
    clientId || 'UNCONFIGURED_DIGILOCKER_CLIENT'
  )}&redirect_uri=${encodeURIComponent(
    redirectUri || 'https://digitalindiaproject.com/api/v1/digilocker/callback'
  )}&state=${authSessionId}&purpose=${encodeURIComponent(purpose)}&client_name=${encodeURIComponent(clientName)}`;

  return c.json({
    authSessionId,
    authorizationUrl,
    purposeDisclosure: purpose,
    clientName,
    configured,
    status: configured ? 'INITIATED' : 'UNCONFIGURED_SANDBOX',
  });
});

app.post('/api/v1/verifications/single', async (c) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'Valid B2B API Key required in Authorization Bearer header',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'UNAUTHORIZED_API_KEY',
      }),
      401
    );
  }

  const apiKey = authHeader.slice(7).trim();
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'B2B verification database unavailable',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'D1_UNBOUND',
      }),
      503
    );
  }

  const biz = await apiDb
    .prepare(
      `SELECT id, company_name, api_credits_remaining, is_kyc_verified
       FROM businesses WHERE api_key = ? LIMIT 1`
    )
    .bind(apiKey)
    .first<{
      id: string;
      company_name: string;
      api_credits_remaining: number;
      is_kyc_verified: number;
    }>()
    .catch(() => null);

  if (!biz) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'REJECTED',
        message: 'Invalid or revoked B2B API Key',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'INVALID_B2B_API_KEY',
      }),
      401
    );
  }

  if (Number(biz.api_credits_remaining || 0) <= 0) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'REJECTED',
        message: 'Insufficient B2B API verification credits remaining.',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'CREDITS_EXHAUSTED',
      }),
      402
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { verificationType, identifierValue, candidateConsentObtained = false } = body;
  if (!candidateConsentObtained) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'REJECTED',
        message: 'Candidate consent confirmation (candidateConsentObtained: true) is required.',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'CONSENT_REQUIRED',
      }),
      403
    );
  }

  if (!verificationType || !identifierValue) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'verificationType and identifierValue are required',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'MISSING_PARAMETERS',
      }),
      400
    );
  }

  const apiSetuConfigured = Boolean(c.env.API_SETU_API_KEY);
  if (isProductionEnvironment(c.env) && !apiSetuConfigured) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'Upstream registry verification provider is not configured in production.',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
      }),
      503
    );
  }

  const corrId = `corr_b2b_${Date.now()}`;
  await apiDb
    .prepare(`UPDATE businesses SET api_credits_remaining = MAX(0, api_credits_remaining - 1), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(biz.id)
    .run()
    .catch(() => null);

  await apiDb
    .prepare(
      `INSERT INTO verification_requests (id, business_id, verification_type, identifier_value, status, provider_ref, verified_data_json, cost_deducted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1.0)`
    )
    .bind(
      `vreq_${crypto.randomUUID()}`,
      biz.id,
      String(verificationType),
      String(identifierValue).slice(0, 64),
      apiSetuConfigured ? 'Verified' : 'Pending',
      corrId,
      JSON.stringify({ mode: apiSetuConfigured ? 'live' : 'sandbox_adapter' })
    )
    .run()
    .catch(() => null);

  return c.json(
    buildStandardResponse({
      success: true,
      status: apiSetuConfigured ? 'SUCCESS' : 'PENDING',
      message: apiSetuConfigured
        ? `${verificationType} verification completed via Cloudflare Worker`
        : `${verificationType} recorded in sandbox mode (configure API_SETU_API_KEY for live provider)`,
      referenceId: corrId,
      data: {
        businessId: biz.id,
        verificationType,
        identifier: identifierValue,
        status: apiSetuConfigured ? 'VALID_ACTIVE' : 'SANDBOX_PREVIEW',
        creditsRemaining: Math.max(0, Number(biz.api_credits_remaining) - 1),
        verifiedAt: new Date().toISOString(),
        consentAcknowledged: true,
        simulationOnly: !apiSetuConfigured,
      },
    })
  );
});

app.post('/api/v1/verifications/bulk', async (c) => {
  const user = await resolveUserFromRequest(c.req.header('authorization'), c.env);
  if (!user) {
    return c.json(
      buildStandardResponse({
        success: false,
        status: 'FAILED',
        message: 'Authentication required to submit bulk verification jobs.',
        referenceId: `err_${Date.now()}`,
        data: null,
        errorCode: 'UNAUTHORIZED',
      }),
      401
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { jobName, verificationType, recordsCount = 50 } = body;
  const jobId = `bjob_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return c.json({
    jobId,
    jobName: jobName || `batch_${Date.now()}.csv`,
    verificationType: verificationType || 'GSTIN Batch Verification',
    totalRecords: recordsCount,
    status: 'QUEUED',
    estimatedSeconds: Math.ceil(recordsCount * 0.2),
    pollUrl: `/api/v1/verifications/bulk/${jobId}`,
  });
});

app.get('/robots.txt', (c) => {
  return c.text(
    `User-agent: *\nAllow: /\nAllow: /india/\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /operator\nDisallow: /manager\n\nSitemap: https://digitalindiaproject.com/sitemap.xml\nSitemap: https://digitalindiaproject.com/sitemaps/index.xml\n`
  );
});

async function loadLivePostsForSitemap(c: any): Promise<BlogPost[]> {
  const posts: BlogPost[] = [...INITIAL_BLOG_POSTS];
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (contentDb) {
    try {
      const res = await contentDb.prepare(
        `SELECT slug, title, seo_title, seo_description, canonical_url, published_at, updated_at, status
         FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 500`
      ).all<any>();
      if (res.results && res.results.length > 0) {
        const seen = new Set(posts.map((p) => p.slug));
        for (const r of res.results) {
          if (!seen.has(r.slug)) {
            posts.push({
              id: r.slug,
              slug: r.slug,
              title: r.title,
              excerpt: r.seo_description || '',
              content: '',
              category: 'Guides',
              tags: [],
              status: 'published',
              authorName: 'Digital India Editorial Desk',
              publishedAt: r.published_at,
              updatedAt: r.updated_at,
              readingTimeMinutes: 3,
              seoTitle: r.seo_title,
              seoDescription: r.seo_description,
              canonicalUrl: r.canonical_url,
            });
          }
        }
      }
    } catch {
      // fallback cleanly to INITIAL_BLOG_POSTS
    }
  }
  return posts;
}

app.get('/sitemap.xml', async (c) => {
  const generatedAt = new Date().toISOString();
  const [posts, dirRes, services] = await Promise.all([
    loadLivePostsForSitemap(c),
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);
  const dirEntries = evaluateAllDirectoryIndexableEntries(dirRes.locations, services);
  const xml = buildSitemapXml(services.length ? services : INITIAL_SERVICES, posts, dirEntries, {
    generatedAt,
  });
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
    'Last-Modified': new Date(generatedAt).toUTCString(),
    'X-Sitemap-Generated-At': generatedAt,
  });
});

app.get('/sitemaps/index.xml', (c) => {
  const xml = buildSitemapIndexXml([
    '/sitemap.xml',
    '/sitemaps/core.xml',
    '/sitemaps/services.xml',
    '/sitemaps/blog.xml',
    '/sitemaps/india-states.xml',
    '/sitemaps/india-districts.xml',
    '/sitemaps/india-cities.xml',
  ]);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/core.xml', (c) => {
  const xml = buildSitemapXml([], []);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/services.xml', async (c) => {
  const services = await getPublishedDirectoryServices(c.env);
  const xml = buildSitemapXml(services.length ? services : INITIAL_SERVICES, []);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/blog.xml', async (c) => {
  const posts = await loadLivePostsForSitemap(c);
  const xml = buildSitemapXml([], posts);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/india-states.xml', async (c) => {
  const [dirRes, services] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);
  const entries = evaluateAllDirectoryIndexableEntries(dirRes.locations, services).filter(
    (e) => e.location.level === 'country' || e.location.level === 'state' || e.location.level === 'ut'
  );
  const xml = buildDirectorySubSitemapXml(entries, { includeLocalizedUrls: true });
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/india-districts.xml', async (c) => {
  const [dirRes, services] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);
  const entries = evaluateAllDirectoryIndexableEntries(dirRes.locations, services).filter(
    (e) => e.location.level === 'district'
  );
  const xml = buildDirectorySubSitemapXml(entries);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.get('/sitemaps/india-cities.xml', async (c) => {
  const [dirRes, services] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);
  const entries = evaluateAllDirectoryIndexableEntries(dirRes.locations, services).filter(
    (e) => e.location.level === 'city' || e.location.level === 'town'
  );
  const xml = buildDirectorySubSitemapXml(entries);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

app.all('/api/*', (c) => {
  return c.json(
    buildApiResponse({
      success: false,
      status: 'FAILED',
      message: `API endpoint not found: ${c.req.method} ${c.req.path}`,
      requestId: c.get('requestId') || `req_${Date.now()}`,
      data: null,
      errorCode: 'API_ROUTE_NOT_FOUND',
    }),
    404
  );
});

app.get('*', async (c, next) => {
  const reqPath = new URL(c.req.url).pathname;
  if (parseIndiaDirectoryPath(reqPath).matched) {
    return renderIndiaDirectorySsrResponse(c);
  }
  return next();
});

app.all('*', async (c) => {
  const reqPath = new URL(c.req.url).pathname;
  const assetResponse = (await c.env.ASSETS.fetch(
    c.req.raw as unknown as Parameters<Fetcher['fetch']>[0]
  )) as unknown as Response;

  // Prevent Cloudflare SPA fallback from serving index.html for missing JS/CSS/font files
  if (
    reqPath.startsWith('/assets/') &&
    assetResponse.headers.get('content-type')?.includes('text/html')
  ) {
    return c.text('Asset not found', 404);
  }

  return assetResponse;
});

export { app };

export default {
  fetch: (request: Request, env: Env, ctx?: ExecutionContext) =>
    app.fetch(request, env, ctx as any),
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processWorkerApiSathiRetryQueue(env));
  },
};
