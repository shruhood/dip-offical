-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0009_api_sathi_integration.sql
-- Modules: API Sathi KYC/KYB Call Ledger & 2-Step DigiLocker Sessions
-- ==============================================================================

CREATE TABLE IF NOT EXISTS api_sathi_calls (
    id TEXT PRIMARY KEY,
    call_id TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    product_slug TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'SANDBOX', -- SANDBOX, PRODUCTION
    is_sandbox_test INTEGER NOT NULL DEFAULT 1,
    http_status INTEGER NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL, -- VERIFIED, NOT_VERIFIED, REJECTED, WALLET_EMPTY, RATE_LIMITED, UPSTREAM_ERROR
    error_code TEXT,
    error_message TEXT,
    masked_request_json TEXT,
    response_summary TEXT,
    user_id TEXT,
    business_id TEXT,
    step1_ref_id TEXT,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_sathi_calls_call_id ON api_sathi_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_api_sathi_calls_user ON api_sathi_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_sathi_calls_slug ON api_sathi_calls(product_slug);
CREATE INDEX IF NOT EXISTS idx_api_sathi_calls_created ON api_sathi_calls(created_at);

CREATE TABLE IF NOT EXISTS api_sathi_digilocker_sessions (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    call_id TEXT,
    user_id TEXT NOT NULL,
    purpose TEXT,
    kyc_url TEXT NOT NULL,
    short_url TEXT,
    status TEXT NOT NULL DEFAULT 'INITIATED', -- INITIATED, NOT_COMPLETED, VERIFIED, FAILED
    verified INTEGER NOT NULL DEFAULT 0,
    masked_aadhaar TEXT,
    fetched_call_id TEXT,
    verified_payload_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_sathi_dl_user ON api_sathi_digilocker_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_sathi_dl_tx ON api_sathi_digilocker_sessions(transaction_id);
