import type { Env } from '../types';
import { DatabaseRegistry } from '../config/database';

const SENSITIVE_KEYS = new Set([
  'aadhaar',
  'aadhaarnumber',
  'aadhar',
  'pan',
  'pannumber',
  'password',
  'token',
  'secret',
  'clientsecret',
  'apikey',
  'api_key',
  'authorization',
  'webhook_secret',
  'bankaccount',
  'accountnumber',
]);

export function redactSensitiveString(input: string): string {
  return String(input || '')
    // Mask 12-digit Aadhaar-like numbers
    .replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, 'XXXX-XXXX-$3')
    // Mask 10-char PAN patterns
    .replace(/\b([A-Z]{5})(\d{4})([A-Z])\b/g, '$1****$3')
    // Mask 10-digit Indian mobile numbers in logs (keep last 4)
    .replace(/\b([6-9]\d{5})(\d{4})\b/g, 'XXXXXX$2')
    .slice(0, 1000);
}

export function redactSensitiveObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSensitiveString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactSensitiveObject(v));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const normalized = k.toLowerCase().replace(/[\s_-]/g, '');
      if (SENSITIVE_KEYS.has(normalized) || normalized.includes('secret') || normalized.includes('password')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveObject(v);
      }
    }
    return out;
  }
  return value;
}

export async function recordAuditEvent(
  env: Env,
  params: {
    actorId: string;
    actorName?: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    summary: string;
    ip?: string;
  }
): Promise<void> {
  const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_audit');
  if (!db) return;
  const safeSummary = redactSensitiveString(params.summary).slice(0, 400);
  const ip = params.ip || 'edge';
  try {
    await db.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, summary, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `aud_${crypto.randomUUID()}`,
        params.actorId,
        params.actorRole,
        params.action,
        params.resourceType,
        params.resourceId,
        safeSummary,
        ip
      )
      .run();
  } catch {
    // Non-blocking audit persistence
  }
}

export async function recordInfraEvent(
  env: Env,
  params: {
    resourceType: 'd1' | 'r2' | 'worker' | 'api_junction' | 'security';
    resourceName: string;
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    details?: unknown;
  }
): Promise<void> {
  const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_audit');
  if (!db) return;
  try {
    const detailsJson = params.details
      ? JSON.stringify(redactSensitiveObject(params.details)).slice(0, 2000)
      : null;
    await db.prepare(
      `INSERT INTO infra_resource_events (id, resource_type, resource_name, severity, code, message, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `inf_${crypto.randomUUID()}`,
        params.resourceType,
        params.resourceName.slice(0, 120),
        params.severity,
        params.code.slice(0, 80),
        redactSensitiveString(params.message).slice(0, 500),
        detailsJson
      )
      .run();
  } catch {
    // Non-blocking monitoring log
  }
}
