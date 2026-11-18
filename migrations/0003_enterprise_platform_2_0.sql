-- ==============================================================================
-- DIGITAL INDIA PROJECT 2.0 — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0003_enterprise_platform_2_0.sql
-- Non-destructive additive migration on top of 0001 & 0002
-- Covers RBAC, Service/Form Versioning, Workflow Transitions, Document Audits,
-- Partner Commissions/Settlements, Cashfree Orders & Webhooks, and Settings
-- ==============================================================================

-- 1. Role Permissions & Manager Scopes
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS manager_scopes (
    id TEXT PRIMARY KEY,
    manager_user_id TEXT NOT NULL,
    scope_type TEXT NOT NULL, -- 'all', 'category', 'region', 'partner_group'
    scope_value TEXT NOT NULL,
    can_assign_operators INTEGER NOT NULL DEFAULT 1,
    can_view_commissions INTEGER NOT NULL DEFAULT 0,
    can_manage_services INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_manager_scopes_user ON manager_scopes(manager_user_id);

-- 2. Service Versioning, Pricing, & JSON Form Schemas
CREATE TABLE IF NOT EXISTS service_versions (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    form_schema_id TEXT,
    workflow_config_json TEXT,
    assignment_rules_json TEXT,
    disclaimer_text TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, version_number),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_service_versions_service ON service_versions(service_id);

CREATE TABLE IF NOT EXISTS service_pricing (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    tier_code TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'partner', 'b2b'
    service_fee_paise INTEGER NOT NULL DEFAULT 0,
    govt_fee_paise INTEGER NOT NULL DEFAULT 0,
    additional_charge_paise INTEGER NOT NULL DEFAULT 0,
    tax_mode TEXT NOT NULL DEFAULT 'gst_exclusive', -- 'none', 'gst_exclusive', 'gst_inclusive'
    tax_rate_bps INTEGER NOT NULL DEFAULT 1800, -- 18.00% = 1800 basis points
    currency TEXT NOT NULL DEFAULT 'INR',
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_service_pricing_service ON service_pricing(service_id, tier_code);

CREATE TABLE IF NOT EXISTS form_schemas (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    active_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS form_versions (
    id TEXT PRIMARY KEY,
    schema_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    schema_json TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (schema_id, version_number),
    FOREIGN KEY (schema_id) REFERENCES form_schemas(id) ON DELETE CASCADE
);

-- 3. Normalized Application Answers, Events, Assignments, Notes & Workflow Rules
CREATE TABLE IF NOT EXISTS application_answers (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    form_schema_id TEXT,
    form_version INTEGER NOT NULL DEFAULT 1,
    field_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (application_id, field_key),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_answers_app ON application_answers(application_id);

CREATE TABLE IF NOT EXISTS application_events (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'DOCUMENT_REVIEWED', 'PAYMENT_CONFIRMED'
    previous_status TEXT,
    new_status TEXT,
    actor_user_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    reason TEXT,
    customer_message TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_events_app ON application_events(application_id, created_at);

CREATE TABLE IF NOT EXISTS application_assignments (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    operator_user_id TEXT NOT NULL,
    assigned_by_user_id TEXT NOT NULL,
    manager_user_id TEXT,
    sla_due_at DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unassigned_at DATETIME,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_app_assignments_op ON application_assignments(operator_user_id, is_active);

CREATE TABLE IF NOT EXISTS application_notes (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    author_user_id TEXT NOT NULL,
    author_role TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'customer'
    note_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_notes_app ON application_notes(application_id, visibility);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id TEXT PRIMARY KEY,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    allowed_roles_json TEXT NOT NULL,
    requires_reason INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE (from_status, to_status)
);

-- 4. Private Document Governance & Access Audit
CREATE TABLE IF NOT EXISTS document_requirements (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    title_hi TEXT,
    allowed_mimes_json TEXT NOT NULL,
    max_bytes INTEGER NOT NULL DEFAULT 5242880,
    is_mandatory INTEGER NOT NULL DEFAULT 1,
    condition_json TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_reviews (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    reviewer_user_id TEXT NOT NULL,
    decision TEXT NOT NULL, -- 'Verified', 'Rejected', 'Re-upload Requested'
    rejection_reason TEXT,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES application_documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_access_logs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    accessor_user_id TEXT NOT NULL,
    accessor_role TEXT NOT NULL,
    access_type TEXT NOT NULL, -- 'SIGNED_URL_ISSUED', 'DOWNLOADED', 'UPLOADED'
    ip_address TEXT,
    user_agent TEXT,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doc_access_doc ON document_access_logs(document_id, accessed_at);

-- 5. Partner / Agent Portal, Referrals, Commissions & Settlements
CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    partner_code TEXT UNIQUE NOT NULL,
    partner_type TEXT NOT NULL DEFAULT 'individual_agent', -- 'individual_agent', 'csc_center', 'franchise', 'corporate_connector'
    business_name TEXT NOT NULL,
    pan_masked TEXT,
    state TEXT,
    district TEXT,
    pincode TEXT,
    payout_bank_ifsc TEXT,
    payout_account_masked TEXT,
    approval_status TEXT NOT NULL DEFAULT 'Pending Approval', -- 'Pending Approval', 'Approved', 'Suspended', 'Rejected'
    approved_by TEXT,
    approved_at DATETIME,
    min_settlement_paise INTEGER NOT NULL DEFAULT 50000, -- INR 500 default
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    registrations_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_customers (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    customer_user_id TEXT NOT NULL,
    consent_captured INTEGER NOT NULL DEFAULT 0,
    consent_reference TEXT,
    onboarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (partner_id, customer_user_id),
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commission_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    partner_id TEXT, -- NULL means global/default or partner_type rule
    partner_type TEXT,
    service_id TEXT, -- NULL means all services
    commission_type TEXT NOT NULL, -- 'fixed' | 'percentage'
    fixed_amount_paise INTEGER NOT NULL DEFAULT 0,
    percentage_bps INTEGER NOT NULL DEFAULT 0, -- 1000 bps = 10%
    min_order_paise INTEGER NOT NULL DEFAULT 0,
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    effective_until DATETIME,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS commission_ledger (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    rule_id TEXT,
    entry_type TEXT NOT NULL, -- 'EARNED', 'REVERSAL', 'ADJUSTMENT', 'SETTLED'
    gross_amount_paise INTEGER NOT NULL,
    commission_paise INTEGER NOT NULL,
    tds_paise INTEGER NOT NULL DEFAULT 0,
    net_paise INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Settled', 'Reversed'
    settlement_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (application_id, entry_type),
    FOREIGN KEY (partner_id) REFERENCES partners(id)
);
CREATE INDEX IF NOT EXISTS idx_commission_partner ON commission_ledger(partner_id, status);

CREATE TABLE IF NOT EXISTS settlement_requests (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    requested_paise INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Requested', -- 'Requested', 'Under Review', 'Approved', 'Paid', 'Rejected'
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    rejection_reason TEXT,
    FOREIGN KEY (partner_id) REFERENCES partners(id)
);

CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    settlement_request_id TEXT UNIQUE NOT NULL,
    partner_id TEXT NOT NULL,
    paid_paise INTEGER NOT NULL,
    payout_reference TEXT NOT NULL,
    payout_mode TEXT NOT NULL DEFAULT 'NEFT/IMPS',
    processed_by TEXT NOT NULL,
    settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (settlement_request_id) REFERENCES settlement_requests(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id)
);

-- 6. Financial Payment Orders & Webhook Idempotency
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    gateway TEXT NOT NULL DEFAULT 'cashfree',
    service_fee_paise INTEGER NOT NULL,
    govt_fee_paise INTEGER NOT NULL DEFAULT 0,
    additional_charge_paise INTEGER NOT NULL DEFAULT 0,
    tax_paise INTEGER NOT NULL DEFAULT 0,
    total_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    gateway_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    signature_verified INTEGER NOT NULL DEFAULT 0,
    payload_hash TEXT NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Business Settings, System Settings, Integrations, Audit Logs & Jobs
CREATE TABLE IF NOT EXISTS business_settings (
    id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    gstin TEXT DEFAULT '', -- Configured via Admin panel; never hardcoded in source
    pan TEXT DEFAULT '',
    invoice_prefix TEXT NOT NULL DEFAULT 'DIP-INV-2026',
    registered_address TEXT NOT NULL,
    support_email TEXT NOT NULL,
    support_phone TEXT NOT NULL,
    default_tax_rate_bps INTEGER NOT NULL DEFAULT 1800,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value_json TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_integrations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- 'cashfree', 'digilocker', 'apisetu', 'email_tx', 'whatsapp', 'sms'
    display_name TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'sandbox',
    is_enabled INTEGER NOT NULL DEFAULT 0,
    is_configured INTEGER NOT NULL DEFAULT 0,
    public_config_json TEXT,
    last_verified_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS background_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id TEXT PRIMARY KEY,
    job_name TEXT UNIQUE NOT NULL,
    cron_expression TEXT NOT NULL,
    last_run_at DATETIME,
    status TEXT NOT NULL DEFAULT 'IDLE'
);

-- 8. Default Non-Destructive Seed Data (Roles, Permissions, Business Settings Shell)
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('role-super-admin', 'super_admin', 'Owner-level global platform authority'),
  ('role-manager', 'manager', 'Operations management with delegated scope permissions'),
  ('role-operator', 'operator', 'Verified processing officer for assigned applications'),
  ('role-partner', 'partner', 'Authorized partner/agent for referrals and assisted filings'),
  ('role-customer', 'customer', 'Self-service citizen or enterprise applicant');

INSERT OR IGNORE INTO permissions (id, code, description) VALUES
  ('perm-app-view', 'applications.view', 'View permitted applications'),
  ('perm-app-create', 'applications.create', 'Create self or assisted applications'),
  ('perm-app-assign', 'applications.assign', 'Assign applications to operators'),
  ('perm-app-process', 'applications.process', 'Advance application processing stages'),
  ('perm-app-verify', 'applications.verify_documents', 'Verify or reject submitted documents'),
  ('perm-app-correct', 'applications.request_correction', 'Request missing documents or corrections'),
  ('perm-app-complete', 'applications.complete', 'Mark applications completed and issue deliverables'),
  ('perm-app-cancel', 'applications.cancel', 'Cancel eligible applications'),
  ('perm-srv-create', 'services.create', 'Create new dynamic services and schemas'),
  ('perm-srv-edit', 'services.edit', 'Modify service configuration and form versions'),
  ('perm-srv-publish', 'services.publish', 'Publish or unpublish services'),
  ('perm-usr-manage', 'users.manage', 'Manage customer and staff accounts'),
  ('perm-op-assign', 'operators.assign', 'Manage operator assignments and KYC approvals'),
  ('perm-prt-manage', 'partners.manage', 'Approve partners and monitor partner portfolios'),
  ('perm-pay-view', 'payments.view', 'View payment orders and receipts'),
  ('perm-pay-refund', 'payments.refund', 'Initiate and approve payment refunds'),
  ('perm-com-manage', 'commissions.manage', 'Configure commissions and approve partner settlements'),
  ('perm-rep-view', 'reports.view', 'Access analytics and financial/operational reports'),
  ('perm-set-manage', 'settings.manage', 'Edit business GST settings, RBAC, and integrations'),
  ('perm-aud-view', 'audit_logs.view', 'Inspect security and compliance audit logs');

INSERT OR IGNORE INTO business_settings (
  id, legal_name, trade_name, gstin, pan, invoice_prefix, registered_address, support_email, support_phone, default_tax_rate_bps
) VALUES (
  'default',
  'Digital India Project',
  'Digital India Project',
  '',
  '',
  'DIP-INV-2026',
  'Sunflower Building, Nano City, Samarvani, Silvassa, Dadra and Nagar Haveli and Daman and Diu – 396230',
  'support@digitalindiaproject.com',
  '+91 77779 41227',
  1800
);

INSERT OR IGNORE INTO api_integrations (id, code, display_name, environment, is_enabled, is_configured) VALUES
  ('int-cashfree', 'cashfree', 'Cashfree Payment Gateway', 'sandbox', 1, 0),
  ('int-digilocker', 'digilocker', 'DigiLocker Official Requestor OAuth', 'sandbox', 0, 0),
  ('int-apisetu', 'apisetu', 'API Setu Registry Verification', 'sandbox', 1, 0),
  ('int-email', 'email_tx', 'Transactional Email Provider', 'production', 0, 0),
  ('int-whatsapp', 'whatsapp', 'WhatsApp Business Notifications', 'production', 0, 0),
  ('int-sms', 'sms', 'DLT SMS Notification Gateway', 'production', 0, 0);
