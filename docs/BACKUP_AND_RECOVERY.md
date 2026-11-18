# Backup & Disaster Recovery Runbook — Digital India Project

**Implemented in:** `worker/services/backupService.ts`  
**Backup R2 Bucket Binding:** `BACKUPS_BUCKET` → `dip-backups` (prefix `internal/backups/`, fallback `DOCUMENTS_BUCKET`)  
**D1 Audit Table:** `backup_records` (in `DB_AUDIT` / `dip-audit`)

---

## 1. Automated / On-Demand D1 → R2 Snapshot Flow

1. Admin clicks **Create D1 Backup → R2** in **Admin Dashboard → Cloudflare Infra & R2** (calls `POST /api/admin/backups/export`).
2. `BackupService.createVerifiedBackup()` enumerates all bound D1 databases (`DatabaseRegistry.getUniqueBoundDatabases()`) and exports live rows (up to 2,000 rows/table to respect Free-Plan Worker CPU & memory limits) across core business tables (`users`, `services`, `service_categories`, `applications`, `application_documents`, `payments`, `partners`, `commission_rules`, `commission_ledger`, `settlement_requests`, `blog_posts`, `file_registry`, `system_settings`, `operator_enrollments`).
3. Serialized JSON snapshot is uploaded to `BACKUPS_BUCKET` (`dip-backups`) under key `internal/backups/YYYY/MM/<uuid>.json`.
4. **Immediate Read-Back Checksum Verification:**  
   The Worker immediately executes `R2.get(objectKey)`, recomputes `SHA-256`, and compares digests before marking `verification_status = 'VERIFIED'` in `backup_records`. If the digest mismatches, the record is flagged `CHECKSUM_MISMATCH`.

---

## 2. Periodic Integrity Re-Verification

Admins can trigger `POST /api/admin/backups/:id/verify` (**Re-Verify Checksum**) anytime to confirm that:
1. The R2 backup object still exists (`R2.get()` returns non-null body).
2. Recomputed `SHA-256` exactly matches the original digest stored in `backup_records`.

---

## 3. Downloading & Restoring From a Backup

1. **Authenticated Download:** Use `GET /api/admin/backups/:id/download` (or click **Download JSON** in the Infrastructure tab) to download the verified JSON bundle.
2. **CLI D1 Export Alternative (Official Cloudflare Snapshot):**
   ```bash
   npx wrangler d1 export dip-official --remote --output=./dip-official-snapshot.sql
   ```
3. **Recovery / Restore Procedure:**
   - First test restoration against a non-production staging D1 database:
     ```bash
     npx wrangler d1 execute dip-official-staging --remote --file=./dip-official-snapshot.sql
     ```
   - Never run destructive `DROP TABLE` statements against production `dip-official` or domain D1 databases without taking a fresh pre-restore snapshot first.
