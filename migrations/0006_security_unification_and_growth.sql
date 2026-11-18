-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0006_security_unification_and_growth.sql
-- Non-destructive additive migration adding document version tracking,
-- compliance vault, deadline reminders, and B2B verification line-items.
-- ==============================================================================

-- 1. Document Version History (Preserves previous uploads during re-upload / correction)
CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    application_id TEXT,
    document_category TEXT NOT NULL DEFAULT 'general',
    version_number INTEGER NOT NULL DEFAULT 1,
    object_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    sha256_hash TEXT,
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_app ON document_versions(application_id, document_category, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);

-- 2. Customer Compliance Document Vault (Digital locker / expiry tracker metadata)
CREATE TABLE IF NOT EXISTS customer_vault_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    doc_title TEXT NOT NULL,
    doc_number_masked TEXT,
    file_id TEXT,
    r2_object_key TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER DEFAULT 0,
    expires_on TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vault_user ON customer_vault_items(user_id, created_at DESC);

-- 3. Compliance Deadline & Renewal Reminders (GST, ITR, FSSAI, MSME, ISO, Trademark)
CREATE TABLE IF NOT EXISTS compliance_reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Tax & GST',
    due_date TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'One-Time',
    status TEXT NOT NULL DEFAULT 'Upcoming',
    notes TEXT,
    related_service_slug TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON compliance_reminders(user_id, due_date ASC);

-- 4. B2B Bulk Verification Row Items
CREATE TABLE IF NOT EXISTS b2b_verification_items (
    id TEXT PRIMARY KEY,
    bulk_job_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    row_index INTEGER NOT NULL DEFAULT 0,
    verification_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Queued',
    provider_ref TEXT,
    result_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bulk_job_id) REFERENCES bulk_jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_b2b_items_job ON b2b_verification_items(bulk_job_id, row_index);

-- 5. Additive Query Indexes on Existing Tables
CREATE INDEX IF NOT EXISTS idx_apps_assigned_op ON applications(assigned_operator_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, dispatched_at DESC);
