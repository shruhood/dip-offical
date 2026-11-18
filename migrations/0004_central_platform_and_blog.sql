-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0004_central_platform_and_blog.sql
-- Non-destructive additive migration preserving all 0001-0003 production tables
-- Adds:
--   1. schema_migrations (version-controlled migration tracking)
--   2. file_registry (centralized R2 metadata index; zero binary blobs or PII keys)
--   3. blog_posts & blog_post_revisions (bilingual EN/HI SEO CMS)
--   4. operator_enrollments (persisted Operator KYC workflow)
--   5. backup_records (Free-plan D1->R2 verified backup inventory)
--   6. infra_resource_events (database/storage health & quota audit log)
-- ==============================================================================

-- 1. Migration Version Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    checksum TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_migrations (version, description) VALUES
  ('0001_initial_schema', 'Core 25 relational platform tables'),
  ('0002_apisetu_and_b2b_schema', 'API Setu, B2B enterprises, bulk jobs, and masked request logs'),
  ('0003_enterprise_platform_2_0', 'RBAC permissions, form versioning, commissions, settlements, Cashfree webhooks'),
  ('0004_central_platform_and_blog', 'File registry, bilingual blog CMS + revisions, operator KYC, backups & infra monitoring');

-- 2. Centralized R2 File Registry (Private + Public Buckets, Zero PII in Keys)
CREATE TABLE IF NOT EXISTS file_registry (
    id TEXT PRIMARY KEY,
    bucket_binding TEXT NOT NULL DEFAULT 'DOCUMENTS_BUCKET',
    bucket_name TEXT NOT NULL DEFAULT 'dip-official',
    logical_bucket TEXT NOT NULL DEFAULT 'documents', -- documents | dip-public-assets | dip-generated-files | dip-backups | dip-api-storage | dip-customer-uploads | dip-partner-files | dip-api-archives | dip-media-library | dip-export-reports
    object_key TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploader_role TEXT NOT NULL DEFAULT 'customer',
    customer_id TEXT,
    application_id TEXT,
    document_category TEXT NOT NULL DEFAULT 'general',
    verification_status TEXT NOT NULL DEFAULT 'Pending', -- Pending | Verified | Rejected | Not Required
    access_classification TEXT NOT NULL DEFAULT 'private', -- private | internal | public-read
    sha256_hash TEXT,
    retention_until DATETIME,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_file_registry_bucket ON file_registry(logical_bucket, is_deleted);
CREATE INDEX IF NOT EXISTS idx_file_registry_app ON file_registry(application_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_file_registry_customer ON file_registry(customer_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_file_registry_uploader ON file_registry(uploaded_by);

-- 3. Bilingual Blog CMS (English + Hindi) & Revisions
CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_hi TEXT,
    excerpt TEXT NOT NULL,
    excerpt_hi TEXT,
    content TEXT NOT NULL,
    content_hi TEXT,
    category TEXT NOT NULL DEFAULT 'Citizen Guides',
    tags_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'published', -- draft | published | archived
    featured INTEGER NOT NULL DEFAULT 0,
    author_name TEXT NOT NULL DEFAULT 'Digital India Editorial Desk',
    author_role TEXT DEFAULT 'Editorial & Compliance Team',
    featured_image_url TEXT,
    featured_image_key TEXT,
    gallery_json TEXT DEFAULT '[]',
    official_links_json TEXT DEFAULT '[]',
    related_slugs_json TEXT DEFAULT '[]',
    related_service_slug TEXT,
    seo_title TEXT,
    seo_description TEXT,
    focus_keyword TEXT,
    canonical_url TEXT,
    faq_items_json TEXT DEFAULT '[]',
    reading_time_minutes INTEGER NOT NULL DEFAULT 3,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_pub ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category, status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

CREATE TABLE IF NOT EXISTS blog_post_revisions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_hi TEXT,
    content TEXT NOT NULL,
    content_hi TEXT,
    edited_by TEXT NOT NULL,
    change_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (post_id, version_number),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_blog_revisions_post ON blog_post_revisions(post_id, version_number DESC);

-- 4. Operator KYC Enrollments (Persistent D1 Backing)
CREATE TABLE IF NOT EXISTS operator_enrollments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    pincode TEXT NOT NULL,
    qualification TEXT,
    experience_years TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'Pending KYC', -- Not Submitted | Pending KYC | Under Verification | Resubmission Required | Approved | Rejected
    remarks TEXT,
    documents_json TEXT NOT NULL DEFAULT '[]',
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operator_enrollments_user ON operator_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_enrollments_status ON operator_enrollments(kyc_status);

-- 5. Free-Plan Backup Inventory & Verification Logs
CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    backup_type TEXT NOT NULL DEFAULT 'd1_json_snapshot',
    logical_bucket TEXT NOT NULL DEFAULT 'dip-backups',
    object_key TEXT NOT NULL,
    database_scope TEXT NOT NULL DEFAULT 'dip-official',
    tables_count INTEGER NOT NULL DEFAULT 0,
    rows_count INTEGER NOT NULL DEFAULT 0,
    byte_size INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED | FAILED
    verification_status TEXT NOT NULL DEFAULT 'VERIFIED', -- UNVERIFIED | VERIFIED | CORRUPT
    error_message TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_backup_records_time ON backup_records(created_at DESC);

-- 6. Infrastructure Health & Free-Plan Resource Monitoring Events
CREATE TABLE IF NOT EXISTS infra_resource_events (
    id TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL, -- d1 | r2 | worker | api_junction | security
    resource_name TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- info | warning | error
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_infra_events_time ON infra_resource_events(created_at DESC);

-- Seed verified corporate statutory fields cleanly if business_settings is empty for GSTIN/UDYAM/DUNS
UPDATE business_settings
SET
  legal_name = COALESCE(NULLIF(legal_name, ''), 'Digital India Project'),
  trade_name = COALESCE(NULLIF(trade_name, ''), 'Digital India Project'),
  gstin = COALESCE(NULLIF(gstin, ''), '26EXIPK0151F1ZQ'),
  support_email = COALESCE(NULLIF(support_email, ''), 'support@digitalindiaproject.com'),
  support_phone = COALESCE(NULLIF(support_phone, ''), '+91 77779 41227')
WHERE id = 'default';
