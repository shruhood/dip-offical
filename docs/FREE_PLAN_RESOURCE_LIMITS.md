# Cloudflare Free-Plan Resource Limits & Cost Protection Policy

Digital India Project is architected to operate **100% within Cloudflare Free Plan allowances**, with explicit software guardrails preventing silent overages or paid upgrades.

---

## 1. Cloudflare Free Plan Quotas (Monitored Reference)

| Service | Free Plan Allowance | Application Safety Threshold | Enforcement Location |
|---|---|---|---|
| **Cloudflare Workers** | 100,000 requests/day · 10 ms CPU time/request | Lightweight Hono routing · Zero heavy SSR | `worker/index.ts` |
| **Cloudflare D1** | Max **10** physical databases · 500 MB/DB · 5 GB total · 5M reads/day · 100k writes/day | 10 / 10 domain DBs (`DB` + `DB_WORKFLOW`..`DB_ANALYTICS`, `physicalDatabasesBound <= 10`) | `worker/config/database.ts` |
| **Cloudflare R2** | **10 GB** total free storage · **1M Class A ops/mo** · **10M Class B ops/mo** | **7.5 GB** Warning · **8.5 GB** Hard Stop (`FREE_PLAN_MAX_R2_BYTES = 9126805504`) | `worker/config/storage.ts`, `worker/services/fileService.ts` |
| **Per-File Upload Limit** | Worker request memory safe zone | **10 MB** default (`FREE_PLAN_MAX_UPLOAD_BYTES = 10485760`) | `worker/routes/storageRoutes.ts`, `ApplicationWizard.tsx` |
| **Prohibited Paid Features** | Workers Paid, Queues, Durable Objects, Analytics Engine, Logpush | **Not used anywhere** in `wrangler.toml` or application code | `wrangler.toml` |

---

## 2. How Cost Protection Rejects Excess Usage Before Charges Occur

1. **Pre-Upload Quota Check (`FileService.checkQuotaForUpload`):**  
   Before writing to R2, the Worker queries `SELECT COALESCE(SUM(file_size), 0) FROM file_registry WHERE is_deleted = 0`. If `(currentBytes + newFile.size) > safetyThresholdBytes` (8.5 GB), the Worker immediately returns `429 / 507 R2_FREE_TIER_QUOTA_GUARD` and logs a `CRITICAL` event into `infra_resource_events` without consuming Class A writes.
2. **File Size & MIME Validation:**  
   Every logical bucket enforces strict MIME whitelists (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/json`, `text/csv`, `text/plain`) and per-bucket max sizes (5 MB–25 MB).
3. **Log & Backup Retention Control:**  
   Redacted API logs, temporary exports, and D1 backup snapshots carry expiration windows (`retentionDays`: 30–365 days) so R2 storage stays compact inside the 10 GB Free Tier.

---

## 3. Known Free-Plan Constraints (Honest Disclosure)

- Free-tier R2 storage is shared across **all logical buckets combined** (10 GB account total, not 10 GB per bucket).
- Free-tier Workers execute within a 10 ms CPU limit per invocation — large JSON exports (`POST /api/admin/backups/export`) cap exported rows per table cleanly (`LIMIT 2000`) to avoid CPU timeouts.
- Scheduled Cron Triggers remain disabled on the Worker by default unless explicitly bound under Free Plan cron limits.
