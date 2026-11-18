# Security, RBAC & Data Privacy Controls — Digital India Project

## 1. Authentication & Authorization (`worker/middleware/auth.ts`)

1. **Firebase RS256 ID Token Verification:** Incoming `Authorization: Bearer <token>` JWTs are verified against Google Secure Token JWKs (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) with strict checks on `aud === "gen-lang-client-0294214396"`, `iss`, and `exp`.
2. **Signed Cookie Sessions:** `dip_session` HTTP-only cookies are HMAC-SHA256 verified using Worker secret `AUTH_SECRET`.
3. **Fail-Closed RBAC (`requirePermission`, `requireRoles`):** Protected endpoints (`/api/admin/*`, `/api/storage/*`, `/api/customer/*`, `/api/partners/*`, `/api/integrations/providers`, `/api/integrations/logs`) enforce role + permission checks defined in `src/lib/rbac.ts`.

---

## 2. Customer Isolation & Dual-Control Policies

- **Customer Data Isolation:** `GET /api/customer/applications/:id` and `GET /api/storage/files` restrict standard customer/business accounts strictly to records matching their authenticated `uid`. Only authorized `admin`, `super_admin`, `manager`, or assigned `operator` staff can inspect cross-customer queues.
- **No Self-Approval on Partner Settlements:** Both `DataContext.tsx` (`processPartnerSettlement`) and Worker rules enforce that only `super_admin` can settle partner payouts, and a user cannot approve their own settlement request.

---

## 3. R2 Storage Security & Zero-PII Object Keys

- Private (`documents`, `dip-generated-files`, `dip-customer-uploads`, `dip-partner-files`) and internal (`dip-backups`, `dip-api-storage`, `dip-api-archives`, `dip-export-reports`) buckets **cannot** be downloaded directly over HTTP without a valid short-lived HMAC signed URL (`POST /api/storage/files/:id/signed-url` -> `GET /api/storage/files/:id/download`).
- `GET /api/storage/public/:id` explicitly rejects (`403 Forbidden`) any object whose classification is not `public-read`.
- **Non-PII R2 Keys:** Every R2 object path is generated from UUID + `YYYY/MM` + extension. Aadhaar numbers, PANs, emails, and mobile numbers are never placed in R2 object keys.

---

## 4. PII Redaction in Audit & API Logs (`worker/services/auditService.ts`)

Before writing `audit_logs` or `api_request_logs` entries to D1:
- 12-digit Aadhaar numbers are masked to `XXXX-XXXX-####`
- 10-character PAN identifiers are masked to `XX*****##X`
- 10-digit Indian mobile numbers are masked to `+91-XXXXXX####`
- Object keys named `secret`, `token`, `password`, `authorization`, `apiKey`, `aadhaar`, `pan` are redacted prior to D1 persistence.

---

## 5. CORS, Security Headers & Webhook Verification (`worker/middleware/security.ts`)

- Allowed origins are restricted exclusively to `https://digitalindiaproject.com` and `http://localhost:3000` (local Vite development).
- Standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) are attached to all API responses.
- Payment webhooks verify HMAC-SHA256 signatures using `CASHFREE_WEBHOOK_SECRET` and log event IDs in `payment_webhook_events` to guarantee idempotency.
