# R2 Storage Mapping & Object Isolation Policy — Digital India Project

**Managed by:** `worker/config/storage.ts` (`StorageRegistry`) & `worker/services/fileService.ts` (`FileService`)  
**Bound Physical R2 Buckets:** 10 purpose-specific buckets declared in `wrangler.toml` (`DOCUMENTS_BUCKET` .. `EXPORT_REPORTS_BUCKET`)

---

## 1. 10-Bucket Purpose-Specific Allocation

All 10 physical buckets share the account-wide Cloudflare R2 Free Tier (**10 GB total storage**, **1,000,000 Class A/month**, **10,000,000 Class B/month**). Every bucket isolates objects under dedicated non-PII key prefixes, with `DOCUMENTS_BUCKET` (`dip-official`) acting as fallback if any optional binding is omitted in tests or staging:

| Slot | Logical Bucket | Active Binding (`bucket_name`) | Non-PII Key Prefix | Access Policy | Max Size | Retention |
|---|---|---|---|---|---|---|
| 1 | `documents` | `DOCUMENTS_BUCKET` (`dip-official`) | `private/apps/` | `private` | 10 MB | Statutory |
| 2 | `dip-public-assets` | `PUBLIC_ASSETS_BUCKET` (`dip-public-assets`) | `public/assets/` | `public-read` | 5 MB | Indefinite |
| 3 | `dip-generated-files` | `GENERATED_FILES_BUCKET` (`dip-generated-files`) | `private/generated/` | `private` | 10 MB | 2,555 days (7 yrs) |
| 4 | `dip-backups` | `BACKUPS_BUCKET` (`dip-backups`) | `internal/backups/` | `internal` | 25 MB | 30 days |
| 5 | `dip-api-storage` | `API_STORAGE_BUCKET` (`dip-api-storage`) | `internal/api-storage/` | `internal` | 10 MB | 365 days |
| 6 | `dip-customer-uploads` | `CUSTOMER_UPLOADS_BUCKET` (`dip-customer-uploads`) | `private/customer-uploads/` | `private` | 10 MB | Statutory |
| 7 | `dip-partner-files` | `PARTNER_FILES_BUCKET` (`dip-partner-files`) | `private/partner-files/` | `private` | 10 MB | Statutory |
| 8 | `dip-api-archives` | `API_ARCHIVES_BUCKET` (`dip-api-archives`) | `internal/api-archives/` | `internal` | 10 MB | 90 days |
| 9 | `dip-media-library` | `MEDIA_LIBRARY_BUCKET` (`dip-media-library`) | `public/blog-media/` | `public-read` | 5 MB | Indefinite |
| 10 | `dip-export-reports` | `EXPORT_REPORTS_BUCKET` (`dip-export-reports`) | `internal/exports/` | `internal` | 15 MB | 60 days |

---

## 2. Security & Zero-PII Object Keys

1. **No PII in R2 Keys:** `FileService.buildSafeObjectKey()` constructs paths strictly using prefix + `YYYY/MM` + `crypto.randomUUID()` + sanitized file extension (e.g., `private/apps/2026/11/550e8400-e29b-41d4-a716-446655440000.pdf`). Usernames, Aadhaar numbers, PANs, and phone numbers are **never** written to R2 object keys.
2. **Short-Lived Signed Downloads:** `POST /api/storage/files/:id/signed-url` validates role/ownership ACL (`customer_id` / `uploaded_by` / `admin` / `manager` / `operator`), then issues an HMAC-SHA256 expiring download token (default 5 minutes TTL) consumed by `GET /api/storage/files/:id/download?token=...&exp=...`.
3. **Public Assets Isolation:** `GET /api/storage/public/:id` explicitly rejects (`403`) any file whose `access_classification` is not `public-read`.
4. **Safe Rename:** Implemented as server-side `put` copy + registry key update + old key `delete` via `FileService.renameFile()`.
5. **Quota Protection:** `FileService.checkQuotaForUpload()` queries `SUM(file_size)` from `file_registry` and rejects non-essential uploads if total consumption would cross `FREE_PLAN_MAX_R2_BYTES` (default 8.5 GB).
