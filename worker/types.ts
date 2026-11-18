import type { D1Database, R2Bucket, Fetcher, KVNamespace } from '@cloudflare/workers-types';
import type { PermissionCode } from '../src/lib/rbac';
import type { UserRole } from '../src/types';

export interface Env {
  // Preserved Existing Production Bindings (wrangler.toml)
  DB: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  ASSETS: Fetcher;

  // Optional Dedicated Logical D1 Bindings (Max 10 physical D1 databases under Free Plan)
  // When absent, DatabaseRegistry consolidates seamlessly onto primary `DB` (dip-official)
  DB_CORE?: D1Database;
  DB_WORKFLOW?: D1Database;
  DB_PARTNERS?: D1Database;
  DB_CONTENT?: D1Database;
  DB_API?: D1Database;
  DB_BILLING?: D1Database;
  DB_AUDIT?: D1Database;
  DB_SERVICES?: D1Database;
  DB_INTEGRATIONS?: D1Database;
  DB_ANALYTICS?: D1Database;

  // Optional Dedicated Logical R2 Bindings (Max 10 buckets)
  // When absent, StorageRegistry maps safely to isolated prefixes inside `DOCUMENTS_BUCKET`
  PUBLIC_ASSETS_BUCKET?: R2Bucket;
  GENERATED_FILES_BUCKET?: R2Bucket;
  BACKUPS_BUCKET?: R2Bucket;
  API_STORAGE_BUCKET?: R2Bucket;
  CUSTOMER_UPLOADS_BUCKET?: R2Bucket;
  PARTNER_FILES_BUCKET?: R2Bucket;
  API_ARCHIVES_BUCKET?: R2Bucket;
  MEDIA_LIBRARY_BUCKET?: R2Bucket;
  EXPORT_REPORTS_BUCKET?: R2Bucket;

  // Optional KV Cache (strictly within Free Plan allowances)
  KV_CACHE?: KVNamespace;

  // Environment Variables & Quota Guardrails
  ENVIRONMENT: string;
  APP_DOMAIN: string;
  BUSINESS_EMAIL: string;
  PAYMENTS_EMAIL?: string;
  CASHFREE_API_VERSION?: string;
  CASHFREE_ENV?: string;
  CASHFREE_ENVIRONMENT?: string;
  FREE_PLAN_MAX_R2_BYTES?: string;
  FREE_PLAN_MAX_UPLOAD_BYTES?: string;

  // Encrypted Cloudflare Worker Secrets (never placed in wrangler.toml or client bundles)
  CASHFREE_CLIENT_ID?: string;
  CASHFREE_CLIENT_SECRET?: string;
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;
  CASHFREE_WEBHOOK_SECRET?: string;
  DIGILOCKER_CLIENT_ID?: string;
  DIGILOCKER_CLIENT_SECRET?: string;
  API_SATHI_KEY?: string;
  API_SETU_API_KEY?: string;
  API_SETU_CLIENT_ID?: string;
  RESEND_API_KEY?: string;
  WHATSAPP_API_TOKEN?: string;
  SMS_GATEWAY_KEY?: string;
  AUTH_SIGNING_SECRET?: string;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: PermissionCode[];
  partnerId?: string;
  businessId?: string;
  isActive: boolean;
}

export type AppVariables = {
  requestId: string;
  user: RequestUser | null;
};
