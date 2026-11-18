# Digital India Project 2.0 — API Specification (`/api/v1`)

All endpoints return a consistent JSON envelope (`{ success, status, message, reference_id, request_id, data, meta?, error_code?, timestamp }`).

## Route Groups

- **Auth (`/api/v1/auth`):**
  - `GET /me` — Resolve authenticated user profile, assigned role, and active permission codes.
  - `POST /session` — Exchange verified identity into a signed HttpOnly Worker session token (when `AUTH_SIGNING_SECRET` is configured).
  - `POST /logout` — Revoke active session in D1 `sessions`.
- **Services & Dynamic Forms (`/api/v1/services`, `/api/v1/forms`):**
  - `GET /api/v1/services` — Paginated published service catalog (`category`, `q`, `page`, `limit`).
  - `GET /api/v1/services/:slug` — Service metadata + active published `form_schema` version.
  - `POST /api/v1/services` (`services.create`) — Create service + initial versioned schema.
  - `PUT /api/v1/services/:id` (`services.edit`) — Update service or publish new form schema version.
  - `POST /api/v1/forms/:schemaId/validate` — Server-side schema validator using exact versioned schema rules.
- **Applications & Workflow (`/api/v1/applications`):**
  - `GET /api/v1/applications` — Role-scoped paginated list (Customer: own; Partner: partner's; Operator: assigned/authorized; Manager/Admin: all).
  - `POST /api/v1/applications` — Create Draft or Submitted dossier (`web_b2c` or `assisted`), capturing consent & idempotency key.
  - `PATCH /api/v1/applications/:id/transition` — Validated state transition enforcing `workflow_transitions`, actor check, and dual remarks.
  - `POST /api/v1/applications/:id/assign` (`applications.assign`) — Assign/reassign operator & SLA target.
  - `GET /api/v1/applications/track/:id` — Exact-ID public masked status & timeline lookup.
- **Documents (`/api/v1/documents`):**
  - `POST /api/v1/documents/upload` — Validated upload to private R2 (`DOCUMENTS_BUCKET`) with unpredictable key.
  - `POST /api/v1/documents/:id/signed-url` — Authorize and issue short-lived signed download URL.
  - `GET /api/v1/documents/:id/download` — Verify HMAC expiry signature, log `document_access_logs`, stream R2 object.
  - `PATCH /api/v1/documents/:id/review` (`applications.verify_documents`) — Approve or reject with reason.
- **Payments & Refunds (`/api/v1/payments`, `/api/v1/refunds`):**
  - `POST /api/v1/payments/orders` — Create idempotent payment order (minor currency units + dynamic tax settings).
  - `POST /api/v1/payments/verify` — Server-side Cashfree verification & ledger confirmation.
  - `POST /api/v1/payments/webhook` — Verify Cashfree HMAC-SHA256 signature & deduplicate via `payment_webhook_events`.
  - `POST /api/v1/refunds` (`payments.refund`) — Initiate & record refund against confirmed payment.
- **Partners, Commissions & Settlements (`/api/v1/partner`, `/api/v1/commissions`, `/api/v1/settlements`):**
  - `POST /api/v1/partner/register` — Partner onboarding dossier submission.
  - `GET /api/v1/partner/dashboard` — Partner-isolated customers, filings, referral stats, and commission totals.
  - `POST /api/v1/commissions/calculate` (`commissions.manage`) — Deterministic idempotent ledger credit.
  - `POST /api/v1/settlements/request` — Partner payout request against approved balance.
  - `PATCH /api/v1/settlements/:id/approve` (`commissions.manage`) — Super Admin approval & payout reference (never allowed by requesting partner).
- **Admin, Manager, Notifications, Support, Reports & Integrations:**
  - `/api/v1/admin/roles`, `/api/v1/admin/business-settings`, `/api/v1/admin/audit-logs`, `/api/v1/admin/backup-export`
  - `/api/v1/manager/overview`, `/api/v1/manager/sla-overdue`
  - `/api/v1/notifications`, `/api/v1/notifications/templates`
  - `/api/v1/support/tickets`
  - `/api/v1/reports/summary`
  - `/api/v1/integrations/status` (Cashfree, DigiLocker, API Setu, Email, WhatsApp, SMS configuration state)
