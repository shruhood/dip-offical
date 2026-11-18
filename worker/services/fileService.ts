import type { Env, RequestUser } from '../types';
import { DatabaseRegistry } from '../config/database';
import {
  LOGICAL_BUCKET_CATALOG,
  type BucketAccessClassification,
  type LogicalBucketKey,
  StorageRegistry,
} from '../config/storage';
import { constantTimeEqual, hmacSha256Hex } from '../middleware/security';
import { recordAuditEvent, recordInfraEvent } from './auditService';

import { canAccessApplication } from '../../src/lib/rbac';

export interface FileRegistryRecord {
  id: string;
  bucketBinding: string;
  bucketName: string;
  logicalBucket: LogicalBucketKey;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderRole: string;
  customerId?: string | null;
  applicationId?: string | null;
  documentCategory: string;
  verificationStatus: string;
  accessClassification: BucketAccessClassification;
  sha256Hash?: string | null;
  retentionUntil?: string | null;
  versionNumber?: number;
  createdAt: string;
  updatedAt: string;
}

const MIME_ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg', 'jpe'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'text/csv': ['csv'],
  'application/json': ['json'],
  'text/plain': ['txt', 'log'],
  'application/gzip': ['gz', 'tgz'],
};

export function validateFileSignatureAndExtension(params: {
  mimeType: string;
  filename?: string;
  bytes: ArrayBuffer;
}): { valid: boolean; reason?: string } {
  const mime = String(params.mimeType || '').toLowerCase().trim();
  const u8 = new Uint8Array(params.bytes);

  if (u8.byteLength < 4) {
    return { valid: false, reason: 'File is empty or truncated.' };
  }

  // Block Windows PE / Linux ELF / shell script / PHP / active HTML executables unconditionally
  if (
    (u8[0] === 0x4d && u8[1] === 0x5a) || // MZ (EXE/DLL)
    (u8[0] === 0x7f && u8[1] === 0x45 && u8[2] === 0x4c && u8[3] === 0x46) || // ELF
    (u8[0] === 0x23 && u8[1] === 0x21) // #!
  ) {
    return { valid: false, reason: 'Executable binaries and scripts are strictly prohibited.' };
  }

  // Check file extension matches declared MIME if an extension is supplied
  if (params.filename && params.filename.includes('.')) {
    const ext = params.filename.split('.').pop()?.toLowerCase().trim() || '';
    const allowedExts = MIME_ALLOWED_EXTENSIONS[mime];
    if (allowedExts && !allowedExts.includes(ext)) {
      return {
        valid: false,
        reason: `File extension ".${ext}" does not match declared MIME type "${mime}".`,
      };
    }
  }

  // Inspect leading header bytes for polyglot / XSS payloads inside non-HTML types
  const headText = new TextDecoder('utf-8', { fatal: false })
    .decode(u8.subarray(0, Math.min(512, u8.byteLength)))
    .trimStart()
    .toLowerCase();
  if (
    headText.startsWith('<!doctype html') ||
    headText.startsWith('<html') ||
    headText.includes('<script') ||
    headText.startsWith('<?php')
  ) {
    return { valid: false, reason: 'Active HTML/PHP/script content rejected by security scanner.' };
  }

  // Binary magic-byte verification
  if (mime === 'application/pdf') {
    // Allow optional UTF-8 BOM or up to 8 whitespace bytes before %PDF-
    const sliceStr = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(16, u8.byteLength)));
    if (!sliceStr.includes('%PDF-')) {
      return { valid: false, reason: 'Invalid PDF header signature (%PDF- missing).' };
    }
    return { valid: true };
  }

  if (mime === 'image/jpeg') {
    if (u8[0] !== 0xff || u8[1] !== 0xd8 || u8[2] !== 0xff) {
      return { valid: false, reason: 'Invalid JPEG file signature.' };
    }
    return { valid: true };
  }

  if (mime === 'image/png') {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (u8.byteLength < 8 || !pngSig.every((b, idx) => u8[idx] === b)) {
      return { valid: false, reason: 'Invalid PNG file signature.' };
    }
    return { valid: true };
  }

  if (mime === 'image/webp') {
    if (
      u8.byteLength < 12 ||
      u8[0] !== 0x52 || u8[1] !== 0x49 || u8[2] !== 0x46 || u8[3] !== 0x46 || // RIFF
      u8[8] !== 0x57 || u8[9] !== 0x45 || u8[10] !== 0x42 || u8[11] !== 0x50 // WEBP
    ) {
      return { valid: false, reason: 'Invalid WebP file signature.' };
    }
    return { valid: true };
  }

  if (mime === 'application/gzip') {
    if (u8[0] !== 0x1f || u8[1] !== 0x8b) {
      return { valid: false, reason: 'Invalid GZIP archive signature.' };
    }
    return { valid: true };
  }

  if (mime === 'image/svg+xml') {
    if (!headText.includes('<svg') || headText.includes('onload=') || headText.includes('onerror=')) {
      return { valid: false, reason: 'Invalid or unsafe SVG content.' };
    }
    return { valid: true };
  }

  if (mime === 'application/json') {
    try {
      const fullText = new TextDecoder('utf-8', { fatal: true }).decode(u8);
      JSON.parse(fullText);
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid JSON payload.' };
    }
  }

  if (mime === 'text/csv' || mime === 'text/plain') {
    // Reject NUL bytes (binary disguised as CSV/TXT)
    for (let i = 0; i < Math.min(1024, u8.byteLength); i++) {
      if (u8[i] === 0x00) {
        return { valid: false, reason: 'Binary NUL byte detected in text upload.' };
      }
    }
    return { valid: true };
  }

  return { valid: false, reason: `Unsupported or unverified file type "${mime}".` };
}

function extensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    case 'text/csv':
      return 'csv';
    case 'application/json':
      return 'json';
    case 'text/plain':
      return 'txt';
    case 'application/gzip':
      return 'gz';
    default:
      return 'bin';
  }
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class FileService {
  private env: Env;
  private registry: StorageRegistry;
  private dbRegistry: DatabaseRegistry;

  constructor(env: Env) {
    this.env = env;
    this.registry = new StorageRegistry(env);
    this.dbRegistry = new DatabaseRegistry(env);
  }

  /**
   * Builds a strictly non-PII R2 object key.
   * Never uses Aadhaar numbers, PAN numbers, mobile numbers, emails, or client file paths.
   */
  buildSafeObjectKey(params: {
    logicalBucket: LogicalBucketKey;
    fileId: string;
    mimeType: string;
    scopeRef?: string;
  }): string {
    const def = this.registry.getDefinition(params.logicalBucket);
    const ext = extensionFromMime(params.mimeType);
    const cleanScope = (params.scopeRef || 'general')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 48) || 'general';
    const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `${def.fallbackPrefix}/${cleanScope}/${datePrefix}/${params.fileId}.${ext}`;
  }

  async checkQuotaForUpload(incomingBytes: number): Promise<{ allowed: boolean; reason?: string; currentBytes: number; limitBytes: number }> {
    const limitBytes = this.registry.getConfiguredSafetyLimitBytes();
    let currentBytes = 0;

    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (workflowDb) {
      try {
        const row = await workflowDb.prepare(
          `SELECT COALESCE(SUM(file_size), 0) AS total_bytes FROM file_registry WHERE is_deleted = 0`
        ).first<{ total_bytes: number }>();
        currentBytes = Number(row?.total_bytes || 0);
      } catch {
        currentBytes = 0;
      }
    }

    if (currentBytes + incomingBytes > limitBytes) {
      await recordInfraEvent(this.env, {
        resourceType: 'r2',
        resourceName: 'DOCUMENTS_BUCKET',
        severity: 'error',
        code: 'FREE_PLAN_STORAGE_QUOTA_GUARD',
        message: `Blocked upload (${incomingBytes} bytes): would exceed Free-Plan safety cap (${limitBytes} bytes).`,
      });
      return {
        allowed: false,
        reason: 'Free-Plan R2 storage safety threshold reached. Clear unused exports or contact administrator.',
        currentBytes,
        limitBytes,
      };
    }

    return { allowed: true, currentBytes, limitBytes };
  }

  async uploadFile(params: {
    file: File;
    logicalBucket: LogicalBucketKey;
    user: RequestUser;
    customerId?: string;
    applicationId?: string;
    documentCategory?: string;
    ip?: string;
  }): Promise<FileRegistryRecord> {
    const resolved = this.registry.resolve(params.logicalBucket);
    if (!resolved.bucket) {
      throw new Error('R2 storage bucket is not bound in Worker environment.');
    }

    const def = resolved.definition;
    const mimeType = (params.file.type || 'application/octet-stream').toLowerCase().trim();
    if (!def.allowedMimes.includes(mimeType)) {
      throw new Error(`Unsupported MIME type "${mimeType}" for bucket "${def.key}". Allowed: ${def.allowedMimes.join(', ')}`);
    }

    const maxEnvLimit = Number(this.env.FREE_PLAN_MAX_UPLOAD_BYTES) || def.maxFileSizeBytes;
    const maxBytes = Math.min(def.maxFileSizeBytes, maxEnvLimit);
    if (params.file.size <= 0 || params.file.size > maxBytes) {
      throw new Error(`File size (${params.file.size} bytes) must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.`);
    }

    const bytes = await params.file.arrayBuffer();
    const signatureCheck = validateFileSignatureAndExtension({
      mimeType,
      filename: params.file.name,
      bytes,
    });
    if (!signatureCheck.valid) {
      throw new Error(signatureCheck.reason || 'File failed magic-byte security inspection.');
    }

    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    const { db: auditDb } = await this.dbRegistry.resolveAndEnsure('dip_audit');

    let resolvedCustomerId = params.customerId || params.user.id;
    let nextVersionNumber = 1;

    if (params.applicationId && workflowDb) {
      try {
        const appRow = await workflowDb.prepare(
          `SELECT id, user_id, assigned_operator_id FROM applications WHERE id = ? AND deleted_at IS NULL LIMIT 1`
        )
          .bind(params.applicationId)
          .first<{ id: string; user_id: string; assigned_operator_id: string | null }>();

        if (appRow) {
          const allowed = canAccessApplication(params.user, {
            userId: appRow.user_id,
            userEmail: '',
            assignedOperatorId: appRow.assigned_operator_id || undefined,
          });
          if (!allowed) {
            throw new Error('Forbidden: You are not authorized to attach documents to this application.');
          }
          resolvedCustomerId = appRow.user_id;
        }

        const cat = (params.documentCategory || 'general').slice(0, 80);
        const existingCount = await workflowDb.prepare(
          `SELECT COUNT(*) AS cnt FROM file_registry WHERE application_id = ? AND document_category = ? AND is_deleted = 0`
        )
          .bind(params.applicationId, cat)
          .first<{ cnt: number }>();
        nextVersionNumber = Number(existingCount?.cnt || 0) + 1;
      } catch (err: any) {
        if (String(err?.message || '').startsWith('Forbidden:')) throw err;
      }
    }

    const quota = await this.checkQuotaForUpload(params.file.size);
    if (!quota.allowed) {
      throw new Error(quota.reason || 'Storage quota threshold reached.');
    }

    const fileId = `fil_${crypto.randomUUID()}`;
    const objectKey = this.buildSafeObjectKey({
      logicalBucket: def.key,
      fileId,
      mimeType,
      scopeRef: params.applicationId || params.documentCategory || def.key,
    });

    const sha256Hash = await computeSha256Hex(bytes);
    const retentionUntil = def.retentionDays
      ? new Date(Date.now() + def.retentionDays * 86_400_000).toISOString()
      : null;

    await resolved.bucket.put(objectKey, bytes, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        fileId,
        logicalBucket: def.key,
        accessClassification: def.accessClassification,
        uploadedBy: params.user.id,
        version: String(nextVersionNumber),
        category: (params.documentCategory || 'general').slice(0, 64),
      },
    });

    const safeOriginalName = (params.file.name || `${fileId}.${extensionFromMime(mimeType)}`)
      .replace(/[/\\]/g, '_')
      .slice(0, 160);
    const nowIso = new Date().toISOString();

    if (workflowDb) {
      await workflowDb.prepare(
        `INSERT INTO file_registry (
          id, bucket_binding, bucket_name, logical_bucket, object_key, original_filename,
          mime_type, file_size, uploaded_by, uploader_role, customer_id, application_id,
          document_category, verification_status, access_classification, sha256_hash, retention_until,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          fileId,
          resolved.bindingName,
          def.key,
          def.key,
          objectKey,
          safeOriginalName,
          mimeType,
          params.file.size,
          params.user.id,
          params.user.role,
          resolvedCustomerId,
          params.applicationId || null,
          (params.documentCategory || 'general').slice(0, 80),
          def.accessClassification === 'private' ? 'Pending' : 'Not Required',
          def.accessClassification,
          sha256Hash,
          retentionUntil,
          nowIso,
          nowIso
        )
        .run();

      // Track document version history (migration 0006) non-fatally
      await workflowDb.prepare(
        `INSERT INTO document_versions (
          id, document_id, application_id, document_category, version_number, object_key,
          original_filename, mime_type, file_size, sha256_hash, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          `dver_${crypto.randomUUID()}`,
          fileId,
          params.applicationId || null,
          (params.documentCategory || 'general').slice(0, 80),
          nextVersionNumber,
          objectKey,
          safeOriginalName,
          mimeType,
          params.file.size,
          sha256Hash,
          params.user.id,
          nowIso
        )
        .run()
        .catch(() => null);

      // Keep backward compatibility with application_documents if tied to an application
      if (params.applicationId) {
        try {
          await workflowDb.prepare(
            `INSERT INTO application_documents (id, application_id, document_type, file_name, file_size, mime_type, r2_storage_key, verification_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`
          )
            .bind(
              fileId,
              params.applicationId,
              (params.documentCategory || 'Supporting Document').slice(0, 100),
              safeOriginalName,
              params.file.size,
              mimeType,
              objectKey
            )
            .run();

          if (auditDb) {
            await auditDb.prepare(
              `INSERT INTO document_access_logs (id, document_id, application_id, accessor_user_id, accessor_role, access_type, ip_address)
               VALUES (?, ?, ?, ?, ?, 'UPLOADED', ?)`
            )
              .bind(
                `dal_${crypto.randomUUID()}`,
                fileId,
                params.applicationId,
                params.user.id,
                params.user.role,
                params.ip || 'edge'
              )
              .run();
          }
        } catch {
          // application_documents FK may fail if application row hasn't synced from Firestore yet
        }
      }
    }

    await recordAuditEvent(this.env, {
      actorId: params.user.id,
      actorRole: params.user.role,
      action: 'R2_FILE_UPLOADED',
      resourceType: 'file_registry',
      resourceId: fileId,
      summary: `Uploaded ${params.file.size} bytes (${mimeType}, v${nextVersionNumber}) into ${def.key}`,
      ip: params.ip,
    });

    return {
      id: fileId,
      bucketBinding: resolved.bindingName,
      bucketName: def.key,
      logicalBucket: def.key,
      objectKey,
      originalFilename: safeOriginalName,
      mimeType,
      fileSize: params.file.size,
      uploadedBy: params.user.id,
      uploaderRole: params.user.role,
      customerId: resolvedCustomerId,
      applicationId: params.applicationId || null,
      documentCategory: (params.documentCategory || 'general').slice(0, 80),
      verificationStatus: def.accessClassification === 'private' ? 'Pending' : 'Not Required',
      accessClassification: def.accessClassification,
      sha256Hash,
      retentionUntil,
      versionNumber: nextVersionNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  async enforceRetention(params?: {
    dryRun?: boolean;
    actor?: RequestUser;
    limit?: number;
  }): Promise<{ inspected: number; deleted: number; reclaimedBytes: number; dryRun: boolean }> {
    const dryRun = Boolean(params?.dryRun);
    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (!workflowDb) return { inspected: 0, deleted: 0, reclaimedBytes: 0, dryRun };

    const batchLimit = Math.min(50, Math.max(1, params?.limit || 25));
    const expired = await workflowDb.prepare(
      `SELECT * FROM file_registry
       WHERE is_deleted = 0 AND retention_until IS NOT NULL AND retention_until < ?
       ORDER BY retention_until ASC LIMIT ?`
    )
      .bind(new Date().toISOString(), batchLimit)
      .all<any>()
      .catch(() => ({ results: [] }));

    const rows = expired.results || [];
    let deleted = 0;
    let reclaimedBytes = 0;

    for (const r of rows) {
      const meta = this.mapRow(r);
      reclaimedBytes += meta.fileSize;
      if (!dryRun) {
        const resolved = this.registry.resolve(meta.logicalBucket);
        if (resolved.bucket) {
          await resolved.bucket.delete(meta.objectKey).catch(() => null);
        }
        await workflowDb.prepare(
          `UPDATE file_registry SET is_deleted = 1, updated_at = ? WHERE id = ?`
        )
          .bind(new Date().toISOString(), meta.id)
          .run()
          .catch(() => null);
        deleted += 1;
      }
    }

    if (!dryRun && deleted > 0 && params?.actor) {
      await recordAuditEvent(this.env, {
        actorId: params.actor.id,
        actorRole: params.actor.role,
        action: 'R2_RETENTION_ENFORCED',
        resourceType: 'file_registry',
        resourceId: 'retention-sweep',
        summary: `Purged ${deleted} expired R2 object(s), reclaimed ${reclaimedBytes} bytes`,
      });
    }

    return { inspected: rows.length, deleted, reclaimedBytes, dryRun };
  }

  async getMetadataById(fileId: string): Promise<FileRegistryRecord | null> {
    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (!workflowDb) return null;
    const row = await workflowDb.prepare(
      `SELECT * FROM file_registry WHERE id = ? AND is_deleted = 0 LIMIT 1`
    )
      .bind(fileId)
      .first<any>();

    if (!row) return null;
    return this.mapRow(row);
  }

  async exists(fileId: string): Promise<{ exists: boolean; metadata: FileRegistryRecord | null }> {
    const meta = await this.getMetadataById(fileId);
    if (!meta) return { exists: false, metadata: null };
    const resolved = this.registry.resolve(meta.logicalBucket);
    if (!resolved.bucket) return { exists: false, metadata: meta };
    const head = await resolved.bucket.head(meta.objectKey);
    return { exists: Boolean(head), metadata: meta };
  }

  async renameFile(params: {
    fileId: string;
    newFilename: string;
    actor: RequestUser;
    ip?: string;
  }): Promise<FileRegistryRecord> {
    const meta = await this.getMetadataById(params.fileId);
    if (!meta) throw new Error('File record not found.');
    const resolved = this.registry.resolve(meta.logicalBucket);
    if (!resolved.bucket) throw new Error('Bucket binding unavailable.');

    const existingObj = await resolved.bucket.get(meta.objectKey);
    if (!existingObj) throw new Error('Underlying R2 object not found.');

    const newKey = this.buildSafeObjectKey({
      logicalBucket: meta.logicalBucket,
      fileId: `${meta.id}_r${Date.now().toString(36)}`,
      mimeType: meta.mimeType,
      scopeRef: meta.applicationId || meta.documentCategory || meta.logicalBucket,
    });

    const bytes = await existingObj.arrayBuffer();
    await resolved.bucket.put(newKey, bytes, {
      httpMetadata: { contentType: meta.mimeType },
      customMetadata: {
        fileId: meta.id,
        logicalBucket: meta.logicalBucket,
        renamedBy: params.actor.id,
      },
    });
    await resolved.bucket.delete(meta.objectKey);

    const safeName = params.newFilename.replace(/[/\\]/g, '_').slice(0, 160);
    const nowIso = new Date().toISOString();

    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (workflowDb) {
      await workflowDb.prepare(
        `UPDATE file_registry SET object_key = ?, original_filename = ?, updated_at = ? WHERE id = ?`
      )
        .bind(newKey, safeName, nowIso, meta.id)
        .run();
    }

    await recordAuditEvent(this.env, {
      actorId: params.actor.id,
      actorRole: params.actor.role,
      action: 'R2_FILE_RENAMED',
      resourceType: 'file_registry',
      resourceId: meta.id,
      summary: `Copy-and-delete rename performed on ${meta.logicalBucket}`,
      ip: params.ip,
    });

    return { ...meta, objectKey: newKey, originalFilename: safeName, updatedAt: nowIso };
  }

  async deleteFile(params: { fileId: string; actor: RequestUser; ip?: string }): Promise<void> {
    const meta = await this.getMetadataById(params.fileId);
    if (!meta) throw new Error('File not found.');

    const resolved = this.registry.resolve(meta.logicalBucket);
    if (resolved.bucket) {
      await resolved.bucket.delete(meta.objectKey);
    }

    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (workflowDb) {
      await workflowDb.prepare(
        `UPDATE file_registry SET is_deleted = 1, updated_at = ? WHERE id = ?`
      )
        .bind(new Date().toISOString(), meta.id)
        .run();
    }

    await recordAuditEvent(this.env, {
      actorId: params.actor.id,
      actorRole: params.actor.role,
      action: 'R2_FILE_DELETED',
      resourceType: 'file_registry',
      resourceId: meta.id,
      summary: `Deleted object from ${meta.logicalBucket}`,
      ip: params.ip,
    });
  }

  async listFiles(params: {
    logicalBucket?: string;
    applicationId?: string;
    customerId?: string;
    limit?: number;
  }): Promise<FileRegistryRecord[]> {
    const { db: workflowDb } = await this.dbRegistry.resolveAndEnsure('dip_workflow');
    if (!workflowDb) return [];
    let sql = `SELECT * FROM file_registry WHERE is_deleted = 0`;
    const binds: any[] = [];
    if (params.logicalBucket && LOGICAL_BUCKET_CATALOG.some((b) => b.key === params.logicalBucket)) {
      sql += ` AND logical_bucket = ?`;
      binds.push(params.logicalBucket);
    }
    if (params.applicationId) {
      sql += ` AND application_id = ?`;
      binds.push(params.applicationId);
    }
    if (params.customerId) {
      sql += ` AND customer_id = ?`;
      binds.push(params.customerId);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    binds.push(Math.min(100, Math.max(1, params.limit || 50)));

    const res = await workflowDb.prepare(sql).bind(...binds).all();
    return (res.results || []).map((r) => this.mapRow(r));
  }

  async issueSignedDownloadUrl(params: {
    fileId: string;
    actor: RequestUser;
    ttlSeconds?: number;
  }): Promise<{ downloadUrl: string; expiresAt: string }> {
    const secret = this.env.AUTH_SIGNING_SECRET;
    if (!secret) {
      throw new Error('AUTH_SIGNING_SECRET is not configured in Cloudflare Worker secrets.');
    }
    const ttl = Math.min(900, Math.max(30, params.ttlSeconds || 120));
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = await hmacSha256Hex(secret, `${params.fileId}:${exp}:${params.actor.id}`);
    return {
      downloadUrl: `/api/storage/files/${encodeURIComponent(params.fileId)}/download?exp=${exp}&uid=${encodeURIComponent(
        params.actor.id
      )}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async verifySignedDownloadToken(params: {
    fileId: string;
    exp: number;
    uid: string;
    sig: string;
  }): Promise<boolean> {
    const secret = this.env.AUTH_SIGNING_SECRET;
    if (!secret || !params.exp || !params.uid || !params.sig) return false;
    if (params.exp < Math.floor(Date.now() / 1000)) return false;
    const expected = await hmacSha256Hex(secret, `${params.fileId}:${params.exp}:${params.uid}`);
    return constantTimeEqual(expected, params.sig);
  }

  async getObjectStream(meta: FileRegistryRecord) {
    const resolved = this.registry.resolve(meta.logicalBucket);
    if (!resolved.bucket) return null;
    return await resolved.bucket.get(meta.objectKey);
  }

  private mapRow(row: any): FileRegistryRecord {
    return {
      id: row.id,
      bucketBinding: row.bucket_binding,
      bucketName: row.bucket_name,
      logicalBucket: row.logical_bucket as LogicalBucketKey,
      objectKey: row.object_key,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size || 0),
      uploadedBy: row.uploaded_by,
      uploaderRole: row.uploader_role,
      customerId: row.customer_id,
      applicationId: row.application_id,
      documentCategory: row.document_category,
      verificationStatus: row.verification_status,
      accessClassification: row.access_classification as BucketAccessClassification,
      sha256Hash: row.sha256_hash,
      retentionUntil: row.retention_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
