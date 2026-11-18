import type { MiddlewareHandler } from 'hono';
import type { AppVariables, Env, RequestUser } from '../types';
import {
  getPermissionsForRole,
  hasPermission,
  isSuperAdminRole,
  normalizeRole,
  PermissionCode,
} from '../../src/lib/rbac';
import { buildApiResponse } from './security';
import { DatabaseRegistry } from '../config/database';

const FIREBASE_PROJECT_ID = 'gen-lang-client-0294214396';
const BOOTSTRAP_ADMIN_EMAIL = 'allindiadigitalseva@gmail.com';

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks: { keys: Array<JsonWebKey & { kid?: string }>; expiresAtMs: number } | null = null;

interface JwtPayload {
  sub?: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    if (!segment || typeof segment !== 'string') return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const decoded = atob(padded);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

async function fetchFirebaseJwks(forceRefresh = false): Promise<Array<JsonWebKey & { kid?: string }> | null> {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && cachedJwks.expiresAtMs > now && cachedJwks.keys.length > 0) {
    return cachedJwks.keys;
  }
  try {
    const certsRes = await fetch(FIREBASE_JWKS_URL);
    if (!certsRes.ok) return null;
    const jwks = (await certsRes.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) return null;

    const cc = certsRes.headers.get('cache-control') || '';
    const maxAgeMatch = cc.match(/max-age=(\d+)/i);
    const ttlSec = maxAgeMatch ? Math.min(3600, Math.max(60, Number(maxAgeMatch[1]))) : 300;
    cachedJwks = { keys: jwks.keys, expiresAtMs: now + ttlSec * 1000 };
    return jwks.keys;
  } catch {
    return null;
  }
}

export async function verifyJwtWithJwk(
  token: string,
  jwk: JsonWebKey & { kid?: string },
  expectedProjectId: string = FIREBASE_PROJECT_ID
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  const header = decodeBase64UrlJson<{ alg?: string; kid?: string; typ?: string }>(parts[0]);
  const payload = decodeBase64UrlJson<JwtPayload>(parts[1]);
  if (!header || !payload) return null;

  // Strictly enforce RS256 and non-empty kid (rejects alg=none, HS256, or unsigned tokens)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    return null;
  }
  if (jwk.kid && jwk.kid !== header.kid) {
    return null;
  }

  // Strictly enforce mandatory Firebase ID Token claims
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    return null;
  }
  if (payload.aud !== expectedProjectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSec) {
    return null;
  }
  if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > nowSec + 300) {
    return null;
  }
  if (payload.auth_time !== undefined && (typeof payload.auth_time !== 'number' || payload.auth_time > nowSec + 300)) {
    return null;
  }

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigB64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigPad = sigB64 + '='.repeat((4 - (sigB64.length % 4)) % 4);
    const sigBin = atob(sigPad);
    const sigBytes = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) sigBytes[i] = sigBin.charCodeAt(i);

    const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, dataBytes);
    if (!valid) return null;
  } catch {
    return null;
  }

  return payload;
}

export async function verifyFirebaseIdToken(token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    return null;
  }

  let keys = await fetchFirebaseJwks(false);
  if (!keys) return null;
  let matched = keys.find((k) => k.kid === header.kid);
  if (!matched) {
    keys = await fetchFirebaseJwks(true);
    matched = keys?.find((k) => k.kid === header.kid);
  }
  if (!matched) return null;

  return verifyJwtWithJwk(token, matched, FIREBASE_PROJECT_ID);
}

export async function resolveUserFromRequest(
  authHeader: string | undefined,
  env: Env
): Promise<RequestUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const dbReg = new DatabaseRegistry(env);
  const { db: coreDb } = await dbReg.resolveAndEnsure('dip_core');

  // 1. Check Worker D1 sessions table if opaque session token exists (strictly non-JWT opaque token check)
  if (coreDb && !token.includes('.')) {
    try {
      const sess = await coreDb.prepare(
        `SELECT s.user_id, s.expires_at, u.email, u.name, u.is_active
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP
         LIMIT 1`
      )
        .bind(token)
        .first<{
          user_id: string;
          expires_at: string;
          email: string;
          name: string;
          is_active: number;
        }>();

      if (sess && sess.is_active === 1) {
        return await hydrateRequestUserFromDb(
          sess.user_id,
          sess.email,
          sess.name,
          false,
          env
        );
      }
    } catch {
      // Fall through to Firebase verification
    }
  }

  // 2. Verify Firebase ID token with strict RS256 JWKS verification
  const verified = await verifyFirebaseIdToken(token);
  if (!verified || !verified.sub) return null;

  return await hydrateRequestUserFromDb(
    verified.sub,
    verified.email || '',
    verified.name || verified.email?.split('@')[0] || 'User',
    Boolean(verified.email_verified),
    env
  );
}

async function hydrateRequestUserFromDb(
  uid: string,
  email: string,
  name: string,
  emailVerified: boolean,
  env: Env
): Promise<RequestUser> {
  const isBootstrappedAdmin =
    email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && emailVerified;

  let dbRole = isBootstrappedAdmin ? 'super_admin' : 'customer';
  let partnerId: string | undefined;
  let businessId: string | undefined;
  let isActive = true;
  let customPerms: PermissionCode[] | undefined;

  const dbReg = new DatabaseRegistry(env);
  const [{ db: coreDb }, { db: partnersDb }, { db: apiDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_core'),
    dbReg.resolveAndEnsure('dip_partners'),
    dbReg.resolveAndEnsure('dip_api'),
  ]);

  if (coreDb) {
    try {
      // Never link another user's role by email unless email_verified === true
      const userRow = emailVerified && email
        ? await coreDb.prepare(
            `SELECT u.id, u.is_active, r.name AS role_name
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.id = ? OR LOWER(u.email) = LOWER(?)
             LIMIT 1`
          )
            .bind(uid, email)
            .first<{ id: string; is_active: number; role_name: string | null }>()
        : await coreDb.prepare(
            `SELECT u.id, u.is_active, r.name AS role_name
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.id = ?
             LIMIT 1`
          )
            .bind(uid)
            .first<{ id: string; is_active: number; role_name: string | null }>();

      if (userRow) {
        isActive = userRow.is_active !== 0;
        if (userRow.role_name && !isBootstrappedAdmin) {
          dbRole = normalizeRole(userRow.role_name);
        }
      }
    } catch {
      // Safe fallback when core tables are unavailable in tests
    }
  }

  if (partnersDb) {
    try {
      const partnerRow = await partnersDb.prepare(
        `SELECT id FROM partners WHERE user_id = ? AND approval_status = 'Approved' LIMIT 1`
      )
        .bind(uid)
        .first<{ id: string }>();
      if (partnerRow) {
        partnerId = partnerRow.id;
        if (!isBootstrappedAdmin && dbRole === 'customer') {
          dbRole = 'partner';
        }
      }
    } catch {
      // Ignore if partners table is unavailable
    }
  }

  if (apiDb) {
    try {
      const bizRow = await apiDb.prepare(
        `SELECT business_id FROM business_members WHERE user_id = ? LIMIT 1`
      )
        .bind(uid)
        .first<{ business_id: string }>();
      if (bizRow) {
        businessId = bizRow.business_id;
      }
    } catch {
      // Ignore if business_members table is unavailable
    }
  }

  if (coreDb) {
    try {
      // Load custom role_permissions if present
      const permRows = await coreDb.prepare(
        `SELECT permission_code FROM role_permissions WHERE role_id = ? AND granted = 1`
      )
        .bind(dbRole)
        .all<{ permission_code: string }>();
      if (permRows.results && permRows.results.length > 0 && !isSuperAdminRole(dbRole)) {
        customPerms = permRows.results.map((r) => r.permission_code as PermissionCode);
      }
    } catch {
      // Safe fallback to default RBAC permissions without trusting client-sent roles
    }
  }

  const normalizedRole = normalizeRole(dbRole);
  const permissions = customPerms || getPermissionsForRole(normalizedRole);

  return {
    id: uid,
    email,
    name,
    role: normalizedRole,
    permissions,
    partnerId,
    businessId,
    isActive,
  };
}

export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const reqId = c.get('requestId');
  const resolved = await resolveUserFromRequest(c.req.header('authorization'), c.env);

  if (!resolved) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Authentication required. Provide a valid Bearer token.',
        requestId: reqId,
        data: null,
        errorCode: 'UNAUTHORIZED',
      }),
      401
    );
  }

  if (!resolved.isActive) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Account is suspended or inactive.',
        requestId: reqId,
        data: null,
        errorCode: 'ACCOUNT_INACTIVE',
      }),
      403
    );
  }

  c.set('user', resolved);
  await next();
};

export function requirePermission(permission: PermissionCode): MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const reqId = c.get('requestId');
    const user = c.get('user');

    if (!user) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Authentication required.',
          requestId: reqId,
          data: null,
          errorCode: 'UNAUTHORIZED',
        }),
        401
      );
    }

    if (!hasPermission(user, permission)) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: `Insufficient permission: "${permission}" required.`,
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN_PERMISSION',
        }),
        403
      );
    }

    await next();
  };
}
