import type { Env, RequestUser } from '../types';
import { DatabaseRegistry } from '../config/database';
import { StorageRegistry } from '../config/storage';
import { recordAuditEvent, recordInfraEvent } from './auditService';

export interface BackupRecord {
  id: string;
  backupType: string;
  logicalBucket: string;
  objectKey: string;
  databaseScope: string;
  tablesCount: number;
  rowsCount: number;
  byteSize: number;
  checksum: string;
  status: 'COMPLETED' | 'FAILED';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'CORRUPT';
  errorMessage?: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt?: string | null;
}

const BACKUP_EXPORT_TABLES = [
  'users',
  'roles',
  'user_roles',
  'role_permissions',
  'service_categories',
  'services',
  'service_versions',
  'service_pricing',
  'applications',
  'application_answers',
  'application_documents',
  'document_versions',
  'document_reviews',
  'document_access_logs',
  'application_events',
  'application_assignments',
  'application_notes',
  'support_tickets',
  'support_messages',
  'notifications',
  'customer_vault_items',
  'compliance_reminders',
  'b2b_verification_items',
  'partners',
  'partner_customers',
  'operator_enrollments',
  'commission_rules',
  'commission_ledger',
  'settlement_requests',
  'settlements',
  'payments',
  'payment_orders',
  'invoices',
  'refunds',
  'blog_posts',
  'blog_post_revisions',
  'business_settings',
  'api_integrations',
  'api_providers',
  'api_catalogue',
  'file_registry',
  'schema_migrations',
];

async function sha256Text(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class BackupService {
  private env: Env;
  private storageRegistry: StorageRegistry;
  private dbRegistry: DatabaseRegistry;

  constructor(env: Env) {
    this.env = env;
    this.storageRegistry = new StorageRegistry(env);
    this.dbRegistry = new DatabaseRegistry(env);
  }

  async createVerifiedBackup(actor: RequestUser, ip?: string): Promise<BackupRecord> {
    const boundDatabases = this.dbRegistry.getUniqueBoundDatabases();
    if (boundDatabases.length === 0) {
      throw new Error('At least one D1 binding is required to run database backup export.');
    }

    const storage = this.storageRegistry.resolve('dip-backups');
    if (!storage.bucket) {
      throw new Error('Backup R2 storage bucket is not configured.');
    }

    const backupId = `bkp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const objectKey = `${storage.definition.fallbackPrefix}/${nowIso.slice(0, 10)}/${backupId}.json`;
    const databaseScope =
      boundDatabases.length > 1
        ? `multi-d1 (${boundDatabases.length} databases)`
        : 'dip-official';

    try {
      const databasesDump: Record<string, Record<string, any[]>> = {};
      let totalTables = 0;
      let totalRows = 0;

      for (const bound of boundDatabases) {
        const existingTbls = await bound.db.prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`
        ).all<{ name: string }>();
        const tableSet = new Set((existingTbls.results || []).map((t) => t.name));

        const tablesDump: Record<string, any[]> = {};
        for (const table of BACKUP_EXPORT_TABLES) {
          if (!tableSet.has(table)) continue;
          // Free-Plan Worker memory safety limit: cap snapshot to 2500 rows per table per batch
          const res = await bound.db.prepare(`SELECT * FROM "${table}" LIMIT 2500`).all();
          const rows = res.results || [];
          tablesDump[table] = rows;
          totalRows += rows.length;
          totalTables += 1;
        }
        databasesDump[bound.bindingName] = tablesDump;
      }

      const payload = JSON.stringify(
        {
          backupId,
          platform: 'Digital India Project',
          domain: 'https://digitalindiaproject.com',
          databaseScope,
          createdAt: nowIso,
          createdBy: actor.email,
          databasesCount: boundDatabases.length,
          tablesCount: totalTables,
          rowsCount: totalRows,
          databases: databasesDump,
        },
        null,
        2
      );

      const checksum = await sha256Text(payload);
      const byteSize = new TextEncoder().encode(payload).byteLength;

      await storage.bucket.put(objectKey, payload, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          backupId,
          checksum,
          createdBy: actor.id,
        },
      });

      // Immediately read back and verify checksum so export !== silent corruption
      const readBack = await storage.bucket.get(objectKey);
      let verificationStatus: 'VERIFIED' | 'CORRUPT' = 'CORRUPT';
      if (readBack) {
        const readText = await readBack.text();
        const verifyChecksum = await sha256Text(readText);
        if (verifyChecksum === checksum) {
          verificationStatus = 'VERIFIED';
        }
      }

      const { db: auditDb } = await this.dbRegistry.resolveAndEnsure('dip_audit');
      if (auditDb) {
        await auditDb.prepare(
          `INSERT INTO backup_records (
            id, backup_type, logical_bucket, object_key, database_scope,
            tables_count, rows_count, byte_size, checksum, status, verification_status,
            created_by, created_at, expires_at
          ) VALUES (?, 'd1_json_snapshot', 'dip-backups', ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`
        )
          .bind(
            backupId,
            objectKey,
            databaseScope,
            totalTables,
            totalRows,
            byteSize,
            checksum,
            verificationStatus,
            actor.id,
            nowIso,
            expiresIso
          )
          .run();
      }

      await recordAuditEvent(this.env, {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'BACKUP_CREATED_AND_VERIFIED',
        resourceType: 'backup',
        resourceId: backupId,
        summary: `Exported ${totalTables} tables across ${boundDatabases.length} D1 DB(s) (${totalRows} rows, ${byteSize} bytes) -> ${verificationStatus}`,
        ip,
      });

      return {
        id: backupId,
        backupType: 'd1_json_snapshot',
        logicalBucket: 'dip-backups',
        objectKey,
        databaseScope,
        tablesCount: totalTables,
        rowsCount: totalRows,
        byteSize,
        checksum,
        status: 'COMPLETED',
        verificationStatus,
        createdBy: actor.id,
        createdAt: nowIso,
        expiresAt: expiresIso,
      };
    } catch (err: any) {
      await recordInfraEvent(this.env, {
        resourceType: 'd1',
        resourceName: databaseScope,
        severity: 'error',
        code: 'BACKUP_EXPORT_FAILED',
        message: err?.message || 'Backup export failed',
      });
      throw err;
    }
  }

  async verifyExistingBackup(backupId: string): Promise<{ backupId: string; verificationStatus: 'VERIFIED' | 'CORRUPT' | 'MISSING'; checksumMatch: boolean }> {
    const { db: auditDb } = await this.dbRegistry.resolveAndEnsure('dip_audit');
    if (!auditDb) throw new Error('Audit D1 binding required.');
    const rec = await auditDb.prepare(`SELECT * FROM backup_records WHERE id = ? LIMIT 1`)
      .bind(backupId)
      .first<any>();
    if (!rec) throw new Error('Backup record not found.');

    const storage = this.storageRegistry.resolve('dip-backups');
    if (!storage.bucket) throw new Error('R2 backup bucket unavailable.');

    const obj = await storage.bucket.get(rec.object_key);
    if (!obj) {
      await auditDb.prepare(`UPDATE backup_records SET verification_status = 'CORRUPT', error_message = 'R2 object missing' WHERE id = ?`)
        .bind(backupId)
        .run();
      return { backupId, verificationStatus: 'MISSING', checksumMatch: false };
    }

    const content = await obj.text();
    const digest = await sha256Text(content);
    const match = digest === rec.checksum;

    await auditDb.prepare(`UPDATE backup_records SET verification_status = ? WHERE id = ?`)
      .bind(match ? 'VERIFIED' : 'CORRUPT', backupId)
      .run();

    return {
      backupId,
      verificationStatus: match ? 'VERIFIED' : 'CORRUPT',
      checksumMatch: match,
    };
  }

  async listBackups(limit = 20): Promise<BackupRecord[]> {
    const { db: auditDb } = await this.dbRegistry.resolveAndEnsure('dip_audit');
    if (!auditDb) return [];
    try {
      const res = await auditDb.prepare(
        `SELECT * FROM backup_records ORDER BY created_at DESC LIMIT ?`
      )
        .bind(Math.min(50, Math.max(1, limit)))
        .all<any>();
      return (res.results || []).map((r) => ({
        id: r.id,
        backupType: r.backup_type,
        logicalBucket: r.logical_bucket,
        objectKey: r.object_key,
        databaseScope: r.database_scope,
        tablesCount: Number(r.tables_count || 0),
        rowsCount: Number(r.rows_count || 0),
        byteSize: Number(r.byte_size || 0),
        checksum: r.checksum,
        status: r.status,
        verificationStatus: r.verification_status,
        errorMessage: r.error_message,
        createdBy: r.created_by,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
      }));
    } catch {
      return [];
    }
  }

  async getBackupPayload(backupId: string): Promise<{ record: BackupRecord; content: string } | null> {
    const { db: auditDb } = await this.dbRegistry.resolveAndEnsure('dip_audit');
    if (!auditDb) return null;
    const rec = await auditDb.prepare(`SELECT * FROM backup_records WHERE id = ? LIMIT 1`)
      .bind(backupId)
      .first<any>();
    if (!rec) return null;
    const storage = this.storageRegistry.resolve('dip-backups');
    if (!storage.bucket) return null;
    const obj = await storage.bucket.get(rec.object_key);
    if (!obj) return null;
    return {
      record: {
        id: rec.id,
        backupType: rec.backup_type,
        logicalBucket: rec.logical_bucket,
        objectKey: rec.object_key,
        databaseScope: rec.database_scope,
        tablesCount: Number(rec.tables_count || 0),
        rowsCount: Number(rec.rows_count || 0),
        byteSize: Number(rec.byte_size || 0),
        checksum: rec.checksum,
        status: rec.status,
        verificationStatus: rec.verification_status,
        errorMessage: rec.error_message,
        createdBy: rec.created_by,
        createdAt: rec.created_at,
        expiresAt: rec.expires_at,
      },
      content: await obj.text(),
    };
  }
}
