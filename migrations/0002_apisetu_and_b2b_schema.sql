-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0002_apisetu_and_b2b_schema.sql
-- Modules: API Setu Integration, DigiLocker, B2B Enterprise, and Verification Pipeline
-- ==============================================================================

-- 1. businesses (B2B Enterprise accounts)
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    gstin TEXT UNIQUE,
    pan TEXT,
    business_type TEXT DEFAULT 'Private Limited',
    industry TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    registered_address TEXT NOT NULL,
    plan TEXT DEFAULT 'Starter', -- Starter, Growth, Enterprise
    api_credits_remaining INTEGER DEFAULT 1000,
    monthly_quota INTEGER DEFAULT 5000,
    api_key TEXT UNIQUE NOT NULL,
    webhook_secret TEXT,
    webhook_url TEXT,
    is_kyc_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_businesses_gstin ON businesses(gstin);
CREATE INDEX IF NOT EXISTS idx_businesses_api_key ON businesses(api_key);

-- 2. business_members (Team members within a B2B business)
CREATE TABLE IF NOT EXISTS business_members (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'MEMBER', -- OWNER, ADMIN, MEMBER, VIEWER
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_business_members_biz ON business_members(business_id);

-- 3. api_providers (API Setu and external integration publishers)
CREATE TABLE IF NOT EXISTS api_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    publisher TEXT NOT NULL,
    base_url TEXT NOT NULL,
    sandbox_url TEXT NOT NULL,
    auth_type TEXT NOT NULL, -- oauth2, apikey, signed_request, token
    client_id TEXT,
    client_secret_encrypted TEXT,
    is_enabled INTEGER DEFAULT 1,
    is_approved INTEGER DEFAULT 1,
    environment TEXT DEFAULT 'sandbox', -- sandbox, production
    headers_json TEXT,
    rate_limit_per_minute INTEGER DEFAULT 120,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. api_catalogue (Directory of approved API Setu APIs)
CREATE TABLE IF NOT EXISTS api_catalogue (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_id TEXT,
    api_setu_ref TEXT UNIQUE NOT NULL, -- e.g. in.gov.morth.dl, in.gov.incometax.pan
    category TEXT NOT NULL,
    description TEXT,
    doc_link TEXT,
    auth_type TEXT NOT NULL,
    sandbox_available INTEGER DEFAULT 1,
    prod_approved INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Active', -- Draft, Testing, Approved, Active, Suspended, Retired
    pricing_per_call REAL DEFAULT 0.00,
    consent_requirement TEXT NOT NULL,
    required_fields_json TEXT, -- JSON array of required param names
    response_fields_json TEXT, -- JSON array of returned schema fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_api_catalogue_ref ON api_catalogue(api_setu_ref);
CREATE INDEX IF NOT EXISTS idx_api_catalogue_status ON api_catalogue(status);

-- 5. user_consents (Explicit statutory purpose consent audit trail per DPDP Act)
CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    business_id TEXT,
    application_id TEXT,
    api_id TEXT,
    consent_text TEXT NOT NULL,
    purpose TEXT NOT NULL,
    consent_version TEXT NOT NULL DEFAULT 'v1.0',
    ip_address TEXT,
    user_agent TEXT,
    is_withdrawn INTEGER DEFAULT 0,
    withdrawn_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_consents_user ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_app ON user_consents(application_id);

-- 6. verification_requests (Single identity or document verifications)
CREATE TABLE IF NOT EXISTS verification_requests (
    id TEXT PRIMARY KEY,
    business_id TEXT,
    user_id TEXT,
    verification_type TEXT NOT NULL, -- GSTIN, PAN, Driving_Licence, Vehicle_RC, Udyam, CBSE_Marksheet
    identifier_value TEXT NOT NULL,
    status TEXT NOT NULL, -- Verified, Failed, Pending
    provider_ref TEXT,
    verified_data_json TEXT,
    cost_deducted REAL DEFAULT 0.00,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_verifications_biz ON verification_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON verification_requests(verification_type);

-- 7. bulk_jobs (Batch CSV verification jobs for B2B)
CREATE TABLE IF NOT EXISTS bulk_jobs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    job_name TEXT NOT NULL,
    verification_type TEXT NOT NULL,
    total_records INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Queued', -- Queued, Processing, Completed, Failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    download_url TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_biz ON bulk_jobs(business_id);

-- 8. api_request_logs (Diagnostic logs with correlation IDs and masked payloads)
CREATE TABLE IF NOT EXISTS api_request_logs (
    id TEXT PRIMARY KEY,
    correlation_id TEXT UNIQUE NOT NULL,
    api_id TEXT,
    api_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_method TEXT NOT NULL, -- GET, POST
    environment TEXT NOT NULL, -- SANDBOX, PRODUCTION
    status TEXT NOT NULL, -- SUCCESS, FAILED
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    masked_payload TEXT,
    response_summary TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_logs_corr ON api_request_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_time ON api_request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_request_logs(status);
