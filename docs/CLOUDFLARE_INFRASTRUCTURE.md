# Cloudflare Infrastructure Inventory — Digital India Project

**Primary Website:** `https://digitalindiaproject.com`  
**Worker Name:** `digitalindiaproject` (staging: `digitalindiaproject-staging`)  
**Hosting & Runtime:** Cloudflare Workers (Hono Backend + Vite React Assets)  
**Target Plan:** **Cloudflare Free Plan ONLY** (Zero Workers Paid, Zero Queues, Zero Durable Objects)  
**Legal Entity:** Digital India Project · GSTIN: `26EXIPK0151F1ZQ` · UDYAM: `UDYAM-DD-03-0009994` · D-U-N-S: `308198649`

---

## 1. Bound D1 Databases (10 / 10 Free-Plan Maximum in `wrangler.toml`)

`wrangler.toml` configures 10 physical D1 database bindings without hardcoded `database_id` values so Wrangler 4 resolves or auto-provisions each database by `database_name` in your Cloudflare account:

| Slot | Binding | Database Name | Domain Key | Purpose |
|---|---|---|---|---|
| 1 | `DB` | `dip-official` | `dip_core` (+ fallback) | Users, roles, permissions, sessions, settings & fallback DB |
| 2 | `DB_WORKFLOW` | `dip-workflow` | `dip_workflow` | Applications, workflow stages, assignments, notifications & `file_registry` |
| 3 | `DB_PARTNERS` | `dip-partners` | `dip_partners` | Partner profiles, operator KYC enrollments, referrals & commission rules |
| 4 | `DB_CONTENT` | `dip-content` | `dip_content` | Bilingual Hindi/English blog CMS, revisions, categories & SEO metadata |
| 5 | `DB_API` | `dip-api` | `dip_api` | API Junction providers, catalogue, B2B clients & masked request logs |
| 6 | `DB_BILLING` | `dip-billing` | `dip_billing` | Cashfree orders, webhook deduplication, invoices, refunds & settlements |
| 7 | `DB_AUDIT` | `dip-audit` | `dip_audit` | Audit logs, document access trails, backup inventory & infra health events |
| 8 | `DB_SERVICES` | `dip-services` | `dip_services` | Service catalogue, tiered pricing, conditional forms & document rules |
| 9 | `DB_INTEGRATIONS` | `dip-integrations` | `dip_integrations` | External integration configurations, idempotency keys & job schedules |
| 10 | `DB_ANALYTICS` | `dip-analytics` | `dip_analytics` | Operational analytics, SLA summaries & platform resource reporting |

---

## 2. Bound R2 Object Storage Buckets (10 Purpose-Isolated Buckets — Shared 10 GB Free Tier)

| Slot | Binding | Bucket Name | Logical Bucket Key | Access Policy |
|---|---|---|---|---|
| 1 | `DOCUMENTS_BUCKET` | `dip-official` | `documents` | `private` |
| 2 | `PUBLIC_ASSETS_BUCKET` | `dip-public-assets` | `dip-public-assets` | `public-read` |
| 3 | `GENERATED_FILES_BUCKET` | `dip-generated-files` | `dip-generated-files` | `private` |
| 4 | `BACKUPS_BUCKET` | `dip-backups` | `dip-backups` | `internal` |
| 5 | `API_STORAGE_BUCKET` | `dip-api-storage` | `dip-api-storage` | `internal` |
| 6 | `CUSTOMER_UPLOADS_BUCKET` | `dip-customer-uploads` | `dip-customer-uploads` | `private` |
| 7 | `PARTNER_FILES_BUCKET` | `dip-partner-files` | `dip-partner-files` | `private` |
| 8 | `API_ARCHIVES_BUCKET` | `dip-api-archives` | `dip-api-archives` | `internal` |
| 9 | `MEDIA_LIBRARY_BUCKET` | `dip-media-library` | `dip-media-library` | `public-read` |
| 10 | `EXPORT_REPORTS_BUCKET` | `dip-export-reports` | `dip-export-reports` | `internal` |

**Assets Binding:** `ASSETS` (`directory = "./dist"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*", "/__/auth/*", "/__/firebase/*", "/robots.txt", "/sitemap.xml"]`).

> **Sandbox Verification Blocker Note:** `wrangler` CLI and Cloudflare API credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are not present in this sandbox container. Live provisioning/binding and running `wrangler d1 migrations apply` across the 10 databases execute during your GitHub Actions / Cloudflare Workers Builds deployment (see `docs/DEPLOYMENT_GUIDE.md`). On first request per Worker isolate, `DatabaseRegistry.resolveAndEnsure()` also executes idempotent `CREATE TABLE IF NOT EXISTS` domain bootstrap DDL automatically.

---

## 3. Worker Environment Variables & Secrets

Configured in `wrangler.toml` (`[vars]`):
- `APP_DOMAIN = "https://digitalindiaproject.com"`
- `ENVIRONMENT = "production"`
- `BUSINESS_EMAIL = "support@digitalindiaproject.com"`
- `CASHFREE_API_VERSION = "2023-08-01"`
- `FREE_PLAN_MAX_R2_BYTES = "9126805504"` (8.5 GB hard quota stop — safely below 10 GB Free Tier limit)
- `FREE_PLAN_MAX_UPLOAD_BYTES = "10485760"` (10 MB per upload safeguard)

Secret Bindings (`npx wrangler secret put <NAME>`):
- `AUTH_SIGNING_SECRET` / `AUTH_SECRET` — HMAC-SHA256 key for session cookies and short-lived R2 signed download URLs
- `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_WEBHOOK_SECRET`
- `DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`
- `API_SETU_API_KEY`, `API_SETU_CLIENT_ID`
- `RESEND_API_KEY`
- AI keys: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`
