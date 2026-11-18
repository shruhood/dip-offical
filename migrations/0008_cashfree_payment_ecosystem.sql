-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0008_cashfree_payment_ecosystem.sql
-- Non-destructive additive migration extending payment_orders, payments,
-- payment_webhook_events, and refunds for full Cashfree PG lifecycle,
-- partial/full refunds, webhook replay telemetry, and reconciliation.
-- ==============================================================================

-- 1. Extend payment_orders with Cashfree gateway IDs, expiry, normalized state, and retry linkage
ALTER TABLE payment_orders ADD COLUMN cf_order_id TEXT;
ALTER TABLE payment_orders ADD COLUMN product_order_id TEXT;
ALTER TABLE payment_orders ADD COLUMN environment TEXT DEFAULT 'sandbox';
ALTER TABLE payment_orders ADD COLUMN order_expiry_time DATETIME;
ALTER TABLE payment_orders ADD COLUMN payment_status_normalized TEXT DEFAULT 'CREATED';
ALTER TABLE payment_orders ADD COLUMN last_error TEXT;
ALTER TABLE payment_orders ADD COLUMN retry_of_order_id TEXT;
ALTER TABLE payment_orders ADD COLUMN return_url TEXT;

-- 2. Extend payments ledger with bank UTR, currency, refunded paise tracking, and gateway snapshot
ALTER TABLE payments ADD COLUMN bank_reference TEXT;
ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE payments ADD COLUMN order_amount_paise INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refunded_paise INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN payment_message TEXT;
ALTER TABLE payments ADD COLUMN gateway_response_json TEXT;

-- 3. Extend payment_webhook_events for failed event tracking, raw payload audit, and admin replay
ALTER TABLE payment_webhook_events ADD COLUMN payment_id TEXT;
ALTER TABLE payment_webhook_events ADD COLUMN refund_id TEXT;
ALTER TABLE payment_webhook_events ADD COLUMN processing_status TEXT DEFAULT 'PROCESSED';
ALTER TABLE payment_webhook_events ADD COLUMN event_timestamp TEXT;
ALTER TABLE payment_webhook_events ADD COLUMN received_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payment_webhook_events ADD COLUMN error_message TEXT;
ALTER TABLE payment_webhook_events ADD COLUMN raw_payload_json TEXT;
ALTER TABLE payment_webhook_events ADD COLUMN replay_count INTEGER DEFAULT 0;

-- 4. Extend refunds for Cashfree live Refunds API tracking, ARN/UTR, speed, and partial/full reconciliation
ALTER TABLE refunds ADD COLUMN order_id TEXT;
ALTER TABLE refunds ADD COLUMN application_id TEXT;
ALTER TABLE refunds ADD COLUMN cf_refund_id TEXT;
ALTER TABLE refunds ADD COLUMN refund_amount_paise INTEGER DEFAULT 0;
ALTER TABLE refunds ADD COLUMN refund_arn TEXT;
ALTER TABLE refunds ADD COLUMN refund_mode TEXT DEFAULT 'STANDARD';
ALTER TABLE refunds ADD COLUMN gateway_status TEXT DEFAULT 'PENDING';
ALTER TABLE refunds ADD COLUMN processed_by TEXT;
ALTER TABLE refunds ADD COLUMN processed_at DATETIME;
ALTER TABLE refunds ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE refunds ADD COLUMN gateway_response_json TEXT;

-- 5. Indexes for high-frequency admin dashboard queries, webhook deduplication, and reconciliation sweeps
CREATE INDEX IF NOT EXISTS idx_payment_orders_app_status ON payment_orders(application_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_time ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_time ON payment_orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON payment_webhook_events(order_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_time ON payment_webhook_events(processing_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_cf_id ON refunds(cf_refund_id);
