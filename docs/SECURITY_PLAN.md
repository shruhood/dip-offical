# Digital India Project 2.0 — Security & Privacy Plan

1. **Zero-Trust Authorization:**
   - Never trust `role`, `userId`, or `partnerId` headers/body values sent from the frontend without server verification.
   - Hono middleware validates Bearer tokens / signed HMAC session cookies and checks D1 `role_permissions`.
   - Firestore Security Rules enforce ownership, email verification (`email_verified == true` for bootstrapped Super Admin), and field-level validation blueprints.
2. **Private Document Storage (Cloudflare R2):**
   - Identity documents are stored under unpredictable non-guessable keys (`apps/{appId}/{uuid}-{sanitizedExt}`) with path traversal guards.
   - MIME + file signature + size validation on upload.
   - Downloads require authentication + ownership/assignment check, generating short-lived HMAC-SHA256 signed tokens (`/api/v1/documents/:id/download?token=...&exp=...`) and recording every download in `document_access_logs`.
3. **Payment & Webhook Integrity (Cashfree):**
   - All monetary calculations run in integer minor units (paise).
   - Cashfree webhooks verify `x-webhook-signature` + `x-webhook-timestamp` via HMAC-SHA256 and store `event_id` in `payment_webhook_events` to guarantee idempotency.
   - Applications never transition to `Payment Confirmed` solely from client redirects without server verification.
4. **Partner & Commission Isolation:**
   - Partners can only query customers, applications, commissions, and settlements linked to their own `partner_id`.
   - Commission calculation is server-authoritative and idempotent (`UNIQUE(application_id, rule_id, entry_type)`). Partners cannot modify commission rules or approve their own settlements.
5. **PII Protection & Logging Hygiene:**
   - Passwords, OTPs, full Aadhaar numbers, auth tokens, and document contents are never written to `audit_logs` or console output.
   - Public exact-ID tracking reads strictly from PII-masked `/tracking_records/{id}` (`allow list: if false` prevents bulk scraping).
   - Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`) applied on all Worker responses.
