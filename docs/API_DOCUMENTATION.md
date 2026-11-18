# Backend API Specification — `https://digitalindiaproject.com/api/*`

All endpoints are served exclusively from the existing website (`https://digitalindiaproject.com/api/*`) via the Hono Cloudflare Worker (`worker/index.ts`).

Every response follows the standard envelope:
```json
{
  "success": true,
  "status": "SUCCESS",
  "message": "...",
  "request_id": "uuid",
  "reference_id": "uuid",
  "data": {},
  "error_code": null,
  "timestamp": "2026-11-14T..."
}
```

---

## 1. Admin & Infrastructure (`/api/admin/*`) — Requires `admin` / `super_admin`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/infrastructure` | `audit_logs.view` | Inspect all 10 D1 slots, 10 R2 buckets, Free-Plan quota usage, backups, and secret readiness |
| `POST` | `/api/admin/infrastructure/health-check` | `audit_logs.view` | Trigger live D1 `SELECT 1` + R2 `list()` connectivity probes and persist event to `infra_resource_events` |
| `GET` | `/api/admin/backups` | `audit_logs.view` | List D1→R2 verified snapshots |
| `POST` | `/api/admin/backups/export` | `settings.manage` | Export D1 tables to `dip-backups` in R2 and immediately verify SHA-256 read-back integrity |
| `POST` | `/api/admin/backups/:id/verify` | `audit_logs.view` | Re-fetch backup object from R2 and verify SHA-256 against `backup_records` |
| `GET` | `/api/admin/backups/:id/download` | `settings.manage` | Download verified JSON backup snapshot |
| `GET` | `/api/admin/blog` | `content.manage` | List all D1 blog posts (drafts, published, archived) |
| `POST` | `/api/admin/blog` | `content.manage` | Upsert bilingual SEO blog article into D1 `blog_posts` and append `blog_post_revisions` |
| `GET` | `/api/admin/blog/:id/revisions` | `content.manage` | View historical article revisions stored in D1 |
| `DELETE` | `/api/admin/blog/:id` | `content.manage` | Delete blog post from D1 |
| `GET` | `/api/admin/audit-logs` | `audit_logs.view` | Inspect redacted administrative & security audit trail |
| `GET` | `/api/admin/analytics` | `audit_logs.view` | Live aggregate counts across applications, revenue, KYC queues, and R2 storage |
| `GET/PUT` | `/api/admin/settings` | `settings.manage` | Read or update persistent `system_settings` |

---

## 2. Centralized R2 Storage (`/api/storage/*`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/storage/buckets` | Authenticated | List logical bucket policies, size limits, and quota metrics |
| `POST` | `/api/storage/upload` | Authenticated | Upload multipart file to R2 with MIME/size/quota guards + `file_registry` insert |
| `GET` | `/api/storage/files` | Authenticated (scoped) | List files accessible to current user (`customer_id`/`uploaded_by` or Admin/Operator/Manager) |
| `GET` | `/api/storage/files/:id/metadata` | Authenticated (ACL) | Inspect file metadata and confirm live R2 `head()` existence |
| `POST` | `/api/storage/files/:id/signed-url` | Authenticated (ACL) | Generate short-lived HMAC signed download URL (default 5 min TTL) |
| `GET` | `/api/storage/files/:id/download` | HMAC Token | Stream private/internal R2 object when `token` & `exp` are valid |
| `GET` | `/api/storage/public/:id` | Public | Serve strictly `public-read` assets (`dip-public-assets`, `dip-media-library`) |
| `PATCH` | `/api/storage/files/:id/rename` | Authenticated (ACL) | Copy-and-delete safe rename of original filename / object key |
| `DELETE` | `/api/storage/files/:id` | Authenticated (Owner/Admin) | Remove object from R2 and soft-delete registry row |

---

## 3. Customer, Partner & API Junction (`/api/customer/*`, `/api/partners/*`, `/api/integrations/*`, `/api/blog/*`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/customer/overview` | Customer+ | Customer applications, R2 vault document count, and notifications |
| `GET` | `/api/customer/applications/:id` | Customer (Owner ACL) | Fetch single customer application enforcing customer isolation |
| `GET` | `/api/partners/overview` | Partner+ | Partner profile, commissions ledger, and settlement history |
| `GET` | `/api/integrations/status` | Public | Safe connectivity mode report for API Setu, DigiLocker, Cashfree |
| `GET` | `/api/integrations/providers` | `integrations.manage` | View configured API providers (all secrets excluded) |
| `POST` | `/api/integrations/execute` | Authenticated | Consent-verified centralized API Junction execution with PII-redacted logging |
| `GET` | `/api/integrations/logs` | `audit_logs.view` | View PII-masked API Junction audit logs |
| `GET` | `/api/blog/posts` | Public | Fetch published bilingual articles (`?category=...`) |
| `GET` | `/api/blog/posts/:slug` | Public | Fetch published bilingual article detail by slug |
| `GET` | `/sitemap.xml` | Public | Dynamic XML sitemap merging static routes, catalog services, and D1 + CMS blog posts |
| `GET` | `/robots.txt` | Public | Search crawler rules disallowing `/api/` and `/admin/` |
