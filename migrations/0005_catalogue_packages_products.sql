-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0005_catalogue_packages_products.sql
-- Non-destructive additive migration upgrading existing tables in-place.
--
-- INFRASTRUCTURE REUSE AUDIT:
--   Reuses D1 DB bindings: DB (dip-official), DB_SERVICES, DB_BILLING, DB_CONTENT, DB_AUDIT
--   Reuses Existing Tables: service_categories, services, service_versions, service_pricing,
--     form_schemas, form_versions, document_requirements, faqs, coupons, payment_orders,
--     file_registry, audit_logs
--   Reuses R2 Buckets: DOCUMENTS_BUCKET (dip-official), GENERATED_FILES_BUCKET (dip-generated-files),
--     PUBLIC_ASSETS_BUCKET (dip-public-assets)
--   Zero duplicate D1 databases or duplicate R2 buckets created.
-- ==============================================================================

-- 1. Extend existing `services` table with catalogue, digital-product, package, SEO & pricing metadata
ALTER TABLE services ADD COLUMN product_type TEXT DEFAULT 'service';
ALTER TABLE services ADD COLUMN subcategory TEXT;
ALTER TABLE services ADD COLUMN billing_unit TEXT DEFAULT 'one_time';
ALTER TABLE services ADD COLUMN pricing_type TEXT DEFAULT 'fixed';
ALTER TABLE services ADD COLUMN third_party_fee_paise INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN urgent_fee_paise INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN discount_paise INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN govt_fee_note TEXT;
ALTER TABLE services ADD COLUMN commission_note TEXT;
ALTER TABLE services ADD COLUMN delivery_type TEXT DEFAULT 'online';
ALTER TABLE services ADD COLUMN included_service_ids_json TEXT;
ALTER TABLE services ADD COLUMN exclusions_json TEXT;
ALTER TABLE services ADD COLUMN digital_asset_json TEXT;
ALTER TABLE services ADD COLUMN seo_title TEXT;
ALTER TABLE services ADD COLUMN seo_description TEXT;
ALTER TABLE services ADD COLUMN focus_keyword TEXT;
ALTER TABLE services ADD COLUMN conditions_json TEXT;
ALTER TABLE services ADD COLUMN regulated_notice TEXT;
ALTER TABLE services ADD COLUMN is_custom_quote INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN updated_by TEXT;

-- 2. Extend existing `service_categories` with display status & subcategories list
ALTER TABLE service_categories ADD COLUMN category_code TEXT;
ALTER TABLE service_categories ADD COLUMN subcategories_json TEXT;
ALTER TABLE service_categories ADD COLUMN is_active INTEGER DEFAULT 1;

-- 3. Extend existing `coupons` table for percentage/flat discounts, category scoping & usage caps
ALTER TABLE coupons ADD COLUMN discount_type TEXT DEFAULT 'fixed';
ALTER TABLE coupons ADD COLUMN discount_percent_bps INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN max_discount_paise INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN applicable_categories_json TEXT;
ALTER TABLE coupons ADD COLUMN usage_limit INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN used_count INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN description TEXT;

-- 4. Extend existing `payment_orders` to link service slug, coupon, third-party & urgent fee
ALTER TABLE payment_orders ADD COLUMN service_slug TEXT;
ALTER TABLE payment_orders ADD COLUMN third_party_fee_paise INTEGER DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN urgent_fee_paise INTEGER DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN discount_paise INTEGER DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN coupon_code TEXT;

-- 5. Digital Product Orders (Authorized entitlement records linking users & private R2/generated deliverables)
CREATE TABLE IF NOT EXISTS digital_product_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    service_id TEXT NOT NULL,
    product_slug TEXT NOT NULL,
    product_name TEXT NOT NULL,
    file_format TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    r2_file_id TEXT,
    amount_paid_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    coupon_code TEXT,
    payment_status TEXT NOT NULL DEFAULT 'Paid',
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id)
);
CREATE INDEX IF NOT EXISTS idx_dpo_user ON digital_product_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dpo_slug ON digital_product_orders(product_slug);

-- 6. Custom Quote Requests (For Custom Software Starting ₹14,999, API Access Custom, B2B Fulfilment)
CREATE TABLE IF NOT EXISTS custom_quote_requests (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    service_slug TEXT NOT NULL,
    service_name TEXT NOT NULL,
    user_id TEXT,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_mobile TEXT NOT NULL,
    company_name TEXT,
    requirements_summary TEXT NOT NULL,
    budget_range TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    quoted_amount_paise INTEGER,
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quote_req_status ON custom_quote_requests(status, created_at);

-- 7. Catalogue Idempotent Import Audit Reports
CREATE TABLE IF NOT EXISTS catalogue_import_logs (
    id TEXT PRIMARY KEY,
    imported_by_uid TEXT NOT NULL,
    source_format TEXT NOT NULL,
    total_processed INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    report_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_cat ON services(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(product_type, is_active);
