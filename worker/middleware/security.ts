import type { MiddlewareHandler } from 'hono';
import type { AppVariables, Env } from '../types';

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();

export function buildApiResponse<T>(params: {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REJECTED';
  message: string;
  requestId: string;
  data: T;
  referenceId?: string;
  providerReference?: string;
  errorCode?: string | null;
  meta?: Record<string, unknown>;
}) {
  return {
    success: params.success,
    status: params.status,
    message: params.message,
    request_id: params.requestId,
    reference_id: params.referenceId || params.requestId,
    provider_reference: params.providerReference || `DIP_${Date.now()}`,
    data: params.data,
    ...(params.meta ? { meta: params.meta } : {}),
    error_code: params.errorCode || null,
    timestamp: new Date().toISOString(),
  };
}

export const securityHeadersMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const requestId = c.req.header('x-request-id') || `req_${crypto.randomUUID()}`;
  c.set('requestId', requestId);
  c.set('user', null);

  await next();

  c.res.headers.set('X-Request-Id', requestId);
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  if (c.req.path !== '/__/auth/iframe') {
    c.res.headers.set(
      'X-Frame-Options',
      c.req.path.startsWith('/__/auth/') ? 'SAMEORIGIN' : 'DENY'
    );
  }
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Never allow caching of private /api/* endpoints on public proxies
  if (c.req.path.startsWith('/api/')) {
    c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
};

export function rateLimitMiddleware(maxRequests = 120, windowMs = 60_000): MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const key = `${ip}:${c.req.path.split('/').slice(0, 4).join('/')}`;
    const now = Date.now();
    const bucket = RATE_BUCKETS.get(key);

    if (!bucket || now > bucket.resetAt) {
      RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > maxRequests) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'REJECTED',
            message: 'Too many requests. Please wait a moment before retrying.',
            requestId: c.get('requestId') || `rl_${now}`,
            data: null,
            errorCode: 'RATE_LIMIT_EXCEEDED',
          }),
          429
        );
      }
    }

    await next();
  };
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
