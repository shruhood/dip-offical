import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';

export type LogicalDatabaseKey =
  | 'dip_core'
  | 'dip_workflow'
  | 'dip_partners'
  | 'dip_content'
  | 'dip_api'
  | 'dip_billing'
  | 'dip_audit'
  | 'dip_services'
  | 'dip_integrations'
  | 'dip_analytics';

export interface LogicalDatabaseDefinition {
  key: LogicalDatabaseKey;
  slotNumber: number;
  preferredBinding: keyof Env;
  fallbackBinding: 'DB';
  purpose: string;
  modules: string[];
  ownedTables: string[];
  permittedOperations: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  requiredRoles: string[];
}

// Strict 10-Database Cloudflare Free-Plan Topology
export const LOGICAL_DATABASE_CATALOG: LogicalDatabaseDefinition[] = [
  {
    key: 'dip_core',
    slotNumber: 1,
    preferredBinding: 'DB_CORE',
    fallbackBinding: 'DB',
    purpose: 'Users, authentication references, roles, permissions, settings, and customer profiles',
    modules: ['auth', 'users', 'customers', 'permissions'],
    ownedTables: ['users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'manager_scopes', 'user_sessions', 'business_settings', 'system_settings', 'website_settings'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'manager', 'customer'],
  },
  {
    key: 'dip_workflow',
    slotNumber: 2,
    preferredBinding: 'DB_WORKFLOW',
    fallbackBinding: 'DB',
    purpose: 'Applications, workflow stages, operator assignments, notifications, support, and tracking',
    modules: ['applications', 'workflows', 'notifications', 'documents'],
    ownedTables: ['applications', 'application_answers', 'application_events', 'application_assignments', 'application_notes', 'application_documents', 'application_status_history', 'workflow_transitions', 'document_reviews', 'notifications', 'notification_templates', 'support_tickets', 'support_messages', 'file_registry'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'manager', 'operator', 'partner', 'customer'],
  },
  {
    key: 'dip_partners',
    slotNumber: 3,
    preferredBinding: 'DB_PARTNERS',
    fallbackBinding: 'DB',
    purpose: 'Partner profiles, operator/partner KYC metadata, referrals, and commission rules',
    modules: ['partners', 'operators'],
    ownedTables: ['partners', 'referral_codes', 'partner_customers', 'commission_rules', 'operator_enrollments'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'manager', 'partner', 'operator'],
  },
  {
    key: 'dip_content',
    slotNumber: 4,
    preferredBinding: 'DB_CONTENT',
    fallbackBinding: 'DB',
    purpose: 'Bilingual Hindi/English blog articles, multilingual India Digital Directory locations, translations, and SEO metadata',
    modules: ['content', 'directory-seo'],
    ownedTables: ['blog_posts', 'blog_post_revisions', 'faqs', 'knowledge_base', 'india_locations', 'directory_translations', 'seo_import_batches'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'public_read'],
  },
  {
    key: 'dip_api',
    slotNumber: 5,
    preferredBinding: 'DB_API',
    fallbackBinding: 'DB',
    purpose: 'API Junction gateway, API catalogue, providers, B2B clients, and request routing logs',
    modules: ['api-junction'],
    ownedTables: ['businesses', 'business_members', 'api_providers', 'api_catalogue', 'user_consents', 'verification_requests', 'bulk_jobs', 'api_request_logs', 'api_sathi_calls', 'api_sathi_digilocker_sessions', 'api_sathi_retry_queue'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'business', 'partner'],
  },
  {
    key: 'dip_billing',
    slotNumber: 6,
    preferredBinding: 'DB_BILLING',
    fallbackBinding: 'DB',
    purpose: 'Cashfree orders, webhook idempotency, invoices, refunds, and partner settlement payouts',
    modules: ['billing'],
    ownedTables: ['payments', 'payment_orders', 'payment_webhook_events', 'invoices', 'coupons', 'refunds', 'commission_ledger', 'settlement_requests', 'settlements'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE'],
    requiredRoles: ['super_admin', 'admin', 'partner', 'customer', 'business'],
  },
  {
    key: 'dip_audit',
    slotNumber: 7,
    preferredBinding: 'DB_AUDIT',
    fallbackBinding: 'DB',
    purpose: 'Administrative activities, document access trails, backup records, and security history',
    modules: ['audit'],
    ownedTables: ['audit_logs', 'admin_activity_logs', 'audit_events', 'document_access_logs', 'backup_records', 'infra_resource_events', 'schema_migrations'],
    permittedOperations: ['SELECT', 'INSERT'],
    requiredRoles: ['super_admin', 'admin'],
  },
  {
    key: 'dip_services',
    slotNumber: 8,
    preferredBinding: 'DB_SERVICES',
    fallbackBinding: 'DB',
    purpose: 'Service catalogue, tiered pricing, conditional form schemas, and document requirements',
    modules: ['services'],
    ownedTables: ['service_categories', 'services', 'service_versions', 'service_pricing', 'service_forms', 'form_fields', 'form_schemas', 'form_versions', 'document_requirements'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin', 'public_read'],
  },
  {
    key: 'dip_integrations',
    slotNumber: 9,
    preferredBinding: 'DB_INTEGRATIONS',
    fallbackBinding: 'DB',
    purpose: 'External integration configurations, idempotency keys, background jobs, and schedules',
    modules: ['integrations'],
    ownedTables: ['api_integrations', 'idempotency_keys', 'background_jobs', 'scheduled_jobs'],
    permittedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredRoles: ['super_admin', 'admin'],
  },
  {
    key: 'dip_analytics',
    slotNumber: 10,
    preferredBinding: 'DB_ANALYTICS',
    fallbackBinding: 'DB',
    purpose: 'Usage summaries, SLA operational reports, and platform resource monitoring views',
    modules: ['analytics'],
    ownedTables: ['applications', 'payments', 'verification_requests', 'api_request_logs', 'file_registry'],
    permittedOperations: ['SELECT'],
    requiredRoles: ['super_admin', 'admin', 'manager', 'partner', 'business'],
  },
];

export const CLOUDFLARE_FREE_PLAN_D1_LIMITS = {
  maxPhysicalDatabases: 10,
  maxDatabaseSizeBytes: 500 * 1024 * 1024, // 500 MB per DB under Free Plan
  maxTotalStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB account total
  dailyReadRowsLimit: 5_000_000,
  dailyWriteRowsLimit: 100_000,
};

export interface DatabaseHealthEntry {
  logicalName: LogicalDatabaseKey;
  slotNumber: number;
  activeBinding: string;
  dedicatedBindingConfigured: boolean;
  consolidatedOntoPrimary: boolean;
  purpose: string;
  modules: string[];
  ownedTablesCount: number;
  status: 'CONNECTED' | 'UNCONFIGURED' | 'ERROR';
  latencyMs: number;
  detectedTablesCount: number;
  appliedMigrations: string[];
  errorMessage?: string;
}

const DOMAIN_DDL_STATEMENTS: Record<LogicalDatabaseKey, string[]> = {
  dip_core: [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, mobile TEXT NOT NULL, password_hash TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME)`,
    `CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL, assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, role_id))`,
    `CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL, permission_code TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (role_id, permission_code))`,
    `CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_token TEXT UNIQUE NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS business_settings (id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, trade_name TEXT NOT NULL, gstin TEXT DEFAULT '', pan TEXT DEFAULT '', invoice_prefix TEXT NOT NULL DEFAULT 'DIP-INV-2026', registered_address TEXT NOT NULL DEFAULT '', support_email TEXT NOT NULL DEFAULT 'support@digitalindiaproject.com', support_phone TEXT NOT NULL DEFAULT '+91 77779 41227', default_tax_rate_bps INTEGER NOT NULL DEFAULT 1800, updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_workflow: [
    `CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, service_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted', assigned_operator_id TEXT, customer_remarks TEXT, internal_notes TEXT, form_data_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME)`,
    `CREATE TABLE IF NOT EXISTS application_events (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, event_type TEXT NOT NULL, previous_status TEXT, new_status TEXT, actor_user_id TEXT NOT NULL, actor_role TEXT NOT NULL, customer_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS application_documents (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER NOT NULL, mime_type TEXT NOT NULL, r2_storage_key TEXT NOT NULL, verification_status TEXT NOT NULL DEFAULT 'Pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'in_app', title TEXT NOT NULL, content TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS file_registry (id TEXT PRIMARY KEY, bucket_binding TEXT NOT NULL DEFAULT 'DOCUMENTS_BUCKET', bucket_name TEXT NOT NULL DEFAULT 'dip-official', logical_bucket TEXT NOT NULL DEFAULT 'documents', object_key TEXT UNIQUE NOT NULL, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, uploaded_by TEXT NOT NULL, uploader_role TEXT NOT NULL DEFAULT 'customer', customer_id TEXT, application_id TEXT, document_category TEXT NOT NULL DEFAULT 'general', verification_status TEXT NOT NULL DEFAULT 'Pending', access_classification TEXT NOT NULL DEFAULT 'private', sha256_hash TEXT, retention_until DATETIME, is_deleted INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_partners: [
    `CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL, partner_code TEXT UNIQUE NOT NULL, partner_type TEXT NOT NULL DEFAULT 'individual_agent', business_name TEXT NOT NULL, pan_masked TEXT, state TEXT, district TEXT, pincode TEXT, payout_bank_ifsc TEXT, payout_account_masked TEXT, approval_status TEXT NOT NULL DEFAULT 'Pending Approval', approved_by TEXT, approved_at DATETIME, min_settlement_paise INTEGER NOT NULL DEFAULT 50000, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS partner_customers (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, customer_user_id TEXT NOT NULL, consent_captured INTEGER NOT NULL DEFAULT 0, consent_reference TEXT, onboarded_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (partner_id, customer_user_id))`,
    `CREATE TABLE IF NOT EXISTS operator_enrollments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, full_name TEXT NOT NULL, email TEXT NOT NULL, mobile TEXT NOT NULL, state TEXT NOT NULL, district TEXT NOT NULL, pincode TEXT NOT NULL, qualification TEXT, experience_years TEXT, kyc_status TEXT NOT NULL DEFAULT 'Pending KYC', remarks TEXT, documents_json TEXT NOT NULL DEFAULT '[]', reviewed_by TEXT, reviewed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_content: [
    `CREATE TABLE IF NOT EXISTS blog_posts (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, title_hi TEXT, excerpt TEXT NOT NULL, excerpt_hi TEXT, content TEXT NOT NULL, content_hi TEXT, category TEXT NOT NULL DEFAULT 'Citizen Guides', tags_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'published', featured INTEGER NOT NULL DEFAULT 0, author_name TEXT NOT NULL DEFAULT 'Digital India Editorial Desk', author_role TEXT DEFAULT 'Editorial & Compliance Team', featured_image_url TEXT, featured_image_key TEXT, gallery_json TEXT DEFAULT '[]', official_links_json TEXT DEFAULT '[]', related_slugs_json TEXT DEFAULT '[]', related_service_slug TEXT, seo_title TEXT, seo_description TEXT, focus_keyword TEXT, canonical_url TEXT, faq_items_json TEXT DEFAULT '[]', reading_time_minutes INTEGER NOT NULL DEFAULT 3, published_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS blog_post_revisions (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, version_number INTEGER NOT NULL, title TEXT NOT NULL, title_hi TEXT, content TEXT NOT NULL, content_hi TEXT, edited_by TEXT NOT NULL, change_summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (post_id, version_number))`,
    `CREATE TABLE IF NOT EXISTS india_locations (id TEXT PRIMARY KEY, slug TEXT NOT NULL, parent_id TEXT, level TEXT NOT NULL, state_slug TEXT NOT NULL, district_slug TEXT, city_slug TEXT, canonical_path TEXT UNIQUE NOT NULL, name TEXT NOT NULL, native_names_json TEXT NOT NULL DEFAULT '{}', lgd_code TEXT UNIQUE NOT NULL, census_code TEXT, iso_code TEXT, capital TEXT, pin_codes TEXT NOT NULL DEFAULT '000000', latitude REAL NOT NULL DEFAULT 20.5937, longitude REAL NOT NULL DEFAULT 78.9629, official_languages_json TEXT NOT NULL DEFAULT '["en","hi"]', region_zone TEXT NOT NULL DEFAULT 'West India', source_authority TEXT NOT NULL DEFAULT 'Local Government Directory (LGD), Govt. of India', source_url TEXT NOT NULL DEFAULT 'https://lgdirectory.gov.in/', verified INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 1, index_policy TEXT NOT NULL DEFAULT 'auto', highlighted_services_json TEXT NOT NULL DEFAULT '[]', custom_summary TEXT NOT NULL DEFAULT '', seo_title TEXT, seo_description TEXT, quality_score INTEGER NOT NULL DEFAULT 100, content_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS directory_translations (id TEXT PRIMARY KEY, location_id TEXT NOT NULL, lang_code TEXT NOT NULL, localized_name TEXT, headline TEXT, summary TEXT, seo_title TEXT, seo_description TEXT, faqs_json TEXT NOT NULL DEFAULT '[]', translation_status TEXT NOT NULL DEFAULT 'machine_reviewed', updated_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (location_id, lang_code))`,
    `CREATE TABLE IF NOT EXISTS seo_import_batches (id TEXT PRIMARY KEY, source_name TEXT NOT NULL, format TEXT NOT NULL, imported_count INTEGER NOT NULL DEFAULT 0, skipped_duplicates INTEGER NOT NULL DEFAULT 0, errors_count INTEGER NOT NULL DEFAULT 0, actor_user_id TEXT NOT NULL, summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_api: [
    `CREATE TABLE IF NOT EXISTS businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL, gstin TEXT, status TEXT DEFAULT 'Active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS business_members (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS api_providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, publisher TEXT NOT NULL, base_url TEXT NOT NULL, sandbox_url TEXT NOT NULL, auth_type TEXT NOT NULL, client_id TEXT, client_secret_encrypted TEXT, is_enabled INTEGER DEFAULT 1, is_approved INTEGER DEFAULT 1, environment TEXT DEFAULT 'sandbox', headers_json TEXT, rate_limit_per_minute INTEGER DEFAULT 120, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS api_request_logs (id TEXT PRIMARY KEY, correlation_id TEXT UNIQUE NOT NULL, api_id TEXT, api_name TEXT NOT NULL, endpoint TEXT NOT NULL, request_method TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, status_code INTEGER NOT NULL, latency_ms INTEGER NOT NULL, masked_payload TEXT, response_summary TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS api_sathi_calls (id TEXT PRIMARY KEY, call_id TEXT, idempotency_key TEXT UNIQUE NOT NULL, product_slug TEXT NOT NULL, environment TEXT NOT NULL DEFAULT 'SANDBOX', is_sandbox_test INTEGER NOT NULL DEFAULT 1, http_status INTEGER NOT NULL, verified INTEGER NOT NULL DEFAULT 0, outcome TEXT NOT NULL, error_code TEXT, error_message TEXT, masked_request_json TEXT, response_summary TEXT, user_id TEXT, business_id TEXT, step1_ref_id TEXT, latency_ms INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS api_sathi_digilocker_sessions (id TEXT PRIMARY KEY, uid TEXT UNIQUE NOT NULL, transaction_id TEXT UNIQUE NOT NULL, call_id TEXT, user_id TEXT NOT NULL, purpose TEXT, kyc_url TEXT NOT NULL, short_url TEXT, status TEXT NOT NULL DEFAULT 'INITIATED', verified INTEGER NOT NULL DEFAULT 0, masked_aadhaar TEXT, fetched_call_id TEXT, verified_payload_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS api_sathi_retry_queue (id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, product_slug TEXT NOT NULL, intent TEXT, user_id TEXT NOT NULL, business_id TEXT, sanitized_input_json TEXT NOT NULL, masked_input_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', attempt_count INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5, last_http_status INTEGER NOT NULL DEFAULT 500, last_error_code TEXT, last_error_message TEXT, last_call_id TEXT, next_retry_at DATETIME, last_attempt_at DATETIME, completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_billing: [
    `CREATE TABLE IF NOT EXISTS payment_orders (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, user_id TEXT NOT NULL, idempotency_key TEXT UNIQUE NOT NULL, service_slug TEXT, gateway TEXT NOT NULL DEFAULT 'cashfree', service_fee_paise INTEGER NOT NULL, govt_fee_paise INTEGER NOT NULL DEFAULT 0, additional_charge_paise INTEGER NOT NULL DEFAULT 0, third_party_fee_paise INTEGER DEFAULT 0, urgent_fee_paise INTEGER DEFAULT 0, discount_paise INTEGER DEFAULT 0, coupon_code TEXT, tax_paise INTEGER NOT NULL DEFAULT 0, total_paise INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', gateway_session_id TEXT, cf_order_id TEXT, product_order_id TEXT, environment TEXT DEFAULT 'sandbox', order_expiry_time DATETIME, payment_status_normalized TEXT DEFAULT 'CREATED', last_error TEXT, retry_of_order_id TEXT, return_url TEXT, status TEXT NOT NULL DEFAULT 'CREATED', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, application_id TEXT NOT NULL, user_id TEXT NOT NULL, cf_payment_id TEXT, amount INTEGER NOT NULL, govt_fee INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Initiated', payment_method TEXT, webhook_signature TEXT, bank_reference TEXT, currency TEXT DEFAULT 'INR', order_amount_paise INTEGER DEFAULT 0, refunded_paise INTEGER DEFAULT 0, payment_message TEXT, gateway_response_json TEXT, paid_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, invoice_number TEXT UNIQUE NOT NULL, payment_id TEXT NOT NULL, application_id TEXT NOT NULL, user_id TEXT NOT NULL, subtotal INTEGER NOT NULL, gst_amount INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL, issued_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS refunds (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, order_id TEXT, application_id TEXT, cf_refund_id TEXT, amount INTEGER NOT NULL, refund_amount_paise INTEGER DEFAULT 0, refund_arn TEXT, refund_mode TEXT DEFAULT 'STANDARD', gateway_status TEXT DEFAULT 'PENDING', reason TEXT NOT NULL, status TEXT DEFAULT 'Pending', initiated_by TEXT NOT NULL, processed_by TEXT, processed_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, gateway_response_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS payment_webhook_events (id TEXT PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, order_id TEXT NOT NULL, event_type TEXT NOT NULL, signature_verified INTEGER NOT NULL DEFAULT 0, payload_hash TEXT NOT NULL, payment_id TEXT, refund_id TEXT, processing_status TEXT DEFAULT 'PROCESSED', event_timestamp TEXT, received_at DATETIME DEFAULT CURRENT_TIMESTAMP, error_message TEXT, raw_payload_json TEXT, replay_count INTEGER DEFAULT 0, processed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS commission_ledger (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, application_id TEXT NOT NULL, rule_id TEXT, entry_type TEXT NOT NULL, gross_amount_paise INTEGER NOT NULL, commission_paise INTEGER NOT NULL, tds_paise INTEGER NOT NULL DEFAULT 0, net_paise INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', settlement_id TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (application_id, entry_type))`,
    `CREATE TABLE IF NOT EXISTS settlement_requests (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL, requested_paise INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Requested', requested_at DATETIME DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT, reviewed_at DATETIME, rejection_reason TEXT)`,
    `CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, settlement_request_id TEXT UNIQUE NOT NULL, partner_id TEXT NOT NULL, paid_paise INTEGER NOT NULL, payout_reference TEXT NOT NULL, payout_mode TEXT NOT NULL DEFAULT 'NEFT/IMPS', processed_by TEXT NOT NULL, settled_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_audit: [
    `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, summary TEXT NOT NULL, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS document_access_logs (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, application_id TEXT NOT NULL, accessor_user_id TEXT NOT NULL, accessor_role TEXT NOT NULL, access_type TEXT NOT NULL, ip_address TEXT, accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS backup_records (id TEXT PRIMARY KEY, backup_type TEXT NOT NULL DEFAULT 'd1_json_snapshot', logical_bucket TEXT NOT NULL DEFAULT 'dip-backups', object_key TEXT NOT NULL, database_scope TEXT NOT NULL DEFAULT 'dip-official', tables_count INTEGER NOT NULL DEFAULT 0, rows_count INTEGER NOT NULL DEFAULT 0, byte_size INTEGER NOT NULL DEFAULT 0, checksum TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'COMPLETED', verification_status TEXT NOT NULL DEFAULT 'VERIFIED', error_message TEXT, created_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME)`,
    `CREATE TABLE IF NOT EXISTS infra_resource_events (id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_name TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', code TEXT NOT NULL, message TEXT NOT NULL, details_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_services: [
    `CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, category_id TEXT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, name_hi TEXT, short_desc TEXT, is_popular INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_integrations: [
    `CREATE TABLE IF NOT EXISTS api_integrations (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, environment TEXT NOT NULL DEFAULT 'sandbox', is_enabled INTEGER NOT NULL DEFAULT 0, is_configured INTEGER NOT NULL DEFAULT 0, public_config_json TEXT, last_verified_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
  dip_analytics: [
    `CREATE TABLE IF NOT EXISTS infra_resource_events (id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_name TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', code TEXT NOT NULL, message TEXT NOT NULL, details_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  ],
};

const DOMAIN_ADDITIVE_DDL_STATEMENTS: Partial<Record<LogicalDatabaseKey, string[]>> = {
  dip_billing: [
    `ALTER TABLE payment_orders ADD COLUMN cf_order_id TEXT`,
    `ALTER TABLE payment_orders ADD COLUMN product_order_id TEXT`,
    `ALTER TABLE payment_orders ADD COLUMN environment TEXT DEFAULT 'sandbox'`,
    `ALTER TABLE payment_orders ADD COLUMN order_expiry_time DATETIME`,
    `ALTER TABLE payment_orders ADD COLUMN payment_status_normalized TEXT DEFAULT 'CREATED'`,
    `ALTER TABLE payment_orders ADD COLUMN last_error TEXT`,
    `ALTER TABLE payment_orders ADD COLUMN retry_of_order_id TEXT`,
    `ALTER TABLE payment_orders ADD COLUMN return_url TEXT`,
    `ALTER TABLE payments ADD COLUMN bank_reference TEXT`,
    `ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'INR'`,
    `ALTER TABLE payments ADD COLUMN order_amount_paise INTEGER DEFAULT 0`,
    `ALTER TABLE payments ADD COLUMN refunded_paise INTEGER DEFAULT 0`,
    `ALTER TABLE payments ADD COLUMN payment_message TEXT`,
    `ALTER TABLE payments ADD COLUMN gateway_response_json TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN payment_id TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN refund_id TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN processing_status TEXT DEFAULT 'PROCESSED'`,
    `ALTER TABLE payment_webhook_events ADD COLUMN event_timestamp TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN received_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE payment_webhook_events ADD COLUMN error_message TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN raw_payload_json TEXT`,
    `ALTER TABLE payment_webhook_events ADD COLUMN replay_count INTEGER DEFAULT 0`,
    `ALTER TABLE refunds ADD COLUMN order_id TEXT`,
    `ALTER TABLE refunds ADD COLUMN application_id TEXT`,
    `ALTER TABLE refunds ADD COLUMN cf_refund_id TEXT`,
    `ALTER TABLE refunds ADD COLUMN refund_amount_paise INTEGER DEFAULT 0`,
    `ALTER TABLE refunds ADD COLUMN refund_arn TEXT`,
    `ALTER TABLE refunds ADD COLUMN refund_mode TEXT DEFAULT 'STANDARD'`,
    `ALTER TABLE refunds ADD COLUMN gateway_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE refunds ADD COLUMN processed_by TEXT`,
    `ALTER TABLE refunds ADD COLUMN processed_at DATETIME`,
    `ALTER TABLE refunds ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE refunds ADD COLUMN gateway_response_json TEXT`,
  ],
};

// Track per-isolate initialized (D1 instance, domain) pairs to avoid repeated DDL checks
const ensuredSchemasByDb = new WeakMap<object, Set<LogicalDatabaseKey>>();

export class DatabaseRegistry {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  resolve(logicalKey: LogicalDatabaseKey): {
    db: D1Database | null;
    bindingName: string;
    consolidated: boolean;
  } {
    const def = LOGICAL_DATABASE_CATALOG.find((d) => d.key === logicalKey);
    if (def) {
      const dedicated = this.env[def.preferredBinding] as D1Database | undefined;
      if (dedicated) {
        return {
          db: dedicated,
          bindingName: String(def.preferredBinding),
          consolidated: false,
        };
      }
    }

    if (this.env.DB) {
      return {
        db: this.env.DB,
        bindingName: 'DB (dip-official)',
        consolidated: true,
      };
    }

    return {
      db: null,
      bindingName: 'UNBOUND',
      consolidated: false,
    };
  }

  async resolveAndEnsure(logicalKey: LogicalDatabaseKey): Promise<{
    db: D1Database | null;
    bindingName: string;
    consolidated: boolean;
  }> {
    const resolved = this.resolve(logicalKey);
    if (!resolved.db) return resolved;

    let seen = ensuredSchemasByDb.get(resolved.db);
    if (!seen) {
      seen = new Set<LogicalDatabaseKey>();
      ensuredSchemasByDb.set(resolved.db, seen);
    }

    if (!seen.has(logicalKey)) {
      seen.add(logicalKey);
      const statements = [
        ...(DOMAIN_DDL_STATEMENTS[logicalKey] || []),
        ...(DOMAIN_ADDITIVE_DDL_STATEMENTS[logicalKey] || []),
      ];
      for (const ddl of statements) {
        try {
          const stmt = resolved.db.prepare(ddl);
          if (stmt && typeof stmt.run === 'function') {
            await stmt.run();
          }
        } catch {
          // Ignore non-fatal bootstrap / duplicate-column errors on existing or mocked D1
        }
      }
    }

    return resolved;
  }

  getUniqueBoundDatabases(): Array<{ bindingName: string; db: D1Database }> {
    const seen = new Set<object>();
    const list: Array<{ bindingName: string; db: D1Database }> = [];

    if (this.env.DB && !seen.has(this.env.DB)) {
      seen.add(this.env.DB);
      list.push({ bindingName: 'DB (dip-official)', db: this.env.DB });
    }

    for (const def of LOGICAL_DATABASE_CATALOG) {
      const b = this.env[def.preferredBinding] as D1Database | undefined;
      if (b && !seen.has(b)) {
        seen.add(b);
        list.push({ bindingName: String(def.preferredBinding), db: b });
      }
    }

    return list;
  }

  getPhysicalBindingsCount(): number {
    return this.getUniqueBoundDatabases().length;
  }

  async inspectAll(): Promise<{
    freePlanLimits: typeof CLOUDFLARE_FREE_PLAN_D1_LIMITS;
    physicalDatabasesBound: number;
    withinFreePlanLimit: boolean;
    databases: DatabaseHealthEntry[];
  }> {
    const cache = new Map<
      D1Database,
      { status: 'CONNECTED' | 'ERROR'; latencyMs: number; tables: number; migrations: string[]; err?: string }
    >();

    const checkInstance = async (
      db: D1Database
    ): Promise<{ status: 'CONNECTED' | 'ERROR'; latencyMs: number; tables: number; migrations: string[]; err?: string }> => {
      if (cache.has(db)) return cache.get(db)!;
      const start = Date.now();
      try {
        await db.prepare('SELECT 1 AS ok').first();
        const tblRes = await db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`)
          .all<{ name: string }>();

        let migrations: string[] = [];
        const hasMigrationsTable = (tblRes.results || []).some((r) => r.name === 'schema_migrations');
        if (hasMigrationsTable) {
          const migRes = await db
            .prepare(`SELECT version FROM schema_migrations ORDER BY version ASC`)
            .all<{ version: string }>();
          migrations = (migRes.results || []).map((m) => m.version);
        } else {
          const names = new Set((tblRes.results || []).map((t) => t.name));
          if (names.has('users')) migrations.push('0001_initial_schema');
          if (names.has('api_providers')) migrations.push('0002_apisetu_and_b2b_schema');
          if (names.has('role_permissions')) migrations.push('0003_enterprise_platform_2_0');
          if (names.has('file_registry') || names.has('blog_posts')) migrations.push('0004_central_platform_and_blog');
          if (names.has('india_locations')) migrations.push('0007_india_directory_programmatic_seo');
          if (names.has('payment_webhook_events') && names.has('refunds')) {
            migrations.push('0008_cashfree_payment_ecosystem');
          }
        }

        const result = {
          status: 'CONNECTED' as const,
          latencyMs: Date.now() - start,
          tables: tblRes.results?.length || 0,
          migrations,
        };
        cache.set(db, result);
        return result;
      } catch (err: any) {
        const result = {
          status: 'ERROR' as const,
          latencyMs: Date.now() - start,
          tables: 0,
          migrations: [],
          err: err?.message || 'D1 connectivity check failed',
        };
        cache.set(db, result);
        return result;
      }
    };

    const entries: DatabaseHealthEntry[] = [];
    for (const def of LOGICAL_DATABASE_CATALOG) {
      const resolved = this.resolve(def.key);
      if (!resolved.db) {
        entries.push({
          logicalName: def.key,
          slotNumber: def.slotNumber,
          activeBinding: resolved.bindingName,
          dedicatedBindingConfigured: false,
          consolidatedOntoPrimary: false,
          purpose: def.purpose,
          modules: def.modules,
          ownedTablesCount: def.ownedTables.length,
          status: 'UNCONFIGURED',
          latencyMs: 0,
          detectedTablesCount: 0,
          appliedMigrations: [],
          errorMessage: 'Primary D1 binding (DB) not configured in Worker runtime.',
        });
        continue;
      }

      const probe = await checkInstance(resolved.db);
      const isPrimaryCore = def.key === 'dip_core' && resolved.bindingName === 'DB (dip-official)';
      entries.push({
        logicalName: def.key,
        slotNumber: def.slotNumber,
        activeBinding: resolved.bindingName,
        dedicatedBindingConfigured: !resolved.consolidated || isPrimaryCore,
        consolidatedOntoPrimary: resolved.consolidated && !isPrimaryCore,
        purpose: def.purpose,
        modules: def.modules,
        ownedTablesCount: def.ownedTables.length,
        status: probe.status,
        latencyMs: probe.latencyMs,
        detectedTablesCount: probe.tables,
        appliedMigrations: probe.migrations,
        errorMessage: probe.err,
      });
    }

    const physicalDatabasesBound = this.getPhysicalBindingsCount();
    return {
      freePlanLimits: CLOUDFLARE_FREE_PLAN_D1_LIMITS,
      physicalDatabasesBound,
      withinFreePlanLimit: physicalDatabasesBound <= CLOUDFLARE_FREE_PLAN_D1_LIMITS.maxPhysicalDatabases,
      databases: entries,
    };
  }
}
