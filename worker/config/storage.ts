import type { R2Bucket } from '@cloudflare/workers-types';
import type { Env } from '../types';
import { DatabaseRegistry } from './database';

export type LogicalBucketKey =
  | 'documents'
  | 'dip-public-assets'
  | 'dip-generated-files'
  | 'dip-backups'
  | 'dip-api-storage'
  | 'dip-customer-uploads'
  | 'dip-partner-files'
  | 'dip-api-archives'
  | 'dip-media-library'
  | 'dip-export-reports';

export type BucketAccessClassification = 'private' | 'internal' | 'public-read';

export interface LogicalBucketDefinition {
  key: LogicalBucketKey;
  slotNumber: number;
  preferredBinding: keyof Env;
  fallbackPrefix: string;
  purpose: string;
  accessClassification: BucketAccessClassification;
  allowedMimes: string[];
  maxFileSizeBytes: number;
  retentionDays: number | null; // null = retain per statutory compliance
  associatedModules: string[];
}

export const LOGICAL_BUCKET_CATALOG: LogicalBucketDefinition[] = [
  {
    key: 'documents',
    slotNumber: 1,
    preferredBinding: 'DOCUMENTS_BUCKET',
    fallbackPrefix: 'private/apps',
    purpose: 'Existing private customer & application verification documents',
    accessClassification: 'private',
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: null,
    associatedModules: ['applications', 'documents'],
  },
  {
    key: 'dip-public-assets',
    slotNumber: 2,
    preferredBinding: 'PUBLIC_ASSETS_BUCKET',
    fallbackPrefix: 'public/assets',
    purpose: 'Public website logos, UI illustrations, and promotional banners',
    accessClassification: 'public-read',
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    maxFileSizeBytes: 5 * 1024 * 1024,
    retentionDays: null,
    associatedModules: ['content'],
  },
  {
    key: 'dip-generated-files',
    slotNumber: 3,
    preferredBinding: 'GENERATED_FILES_BUCKET',
    fallbackPrefix: 'private/generated',
    purpose: 'Generated application summaries, tax invoices, payment receipts, and deliverables',
    accessClassification: 'private',
    allowedMimes: ['application/pdf', 'application/json', 'text/plain'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: 2555, // 7 years financial retention
    associatedModules: ['applications', 'billing'],
  },
  {
    key: 'dip-backups',
    slotNumber: 4,
    preferredBinding: 'BACKUPS_BUCKET',
    fallbackPrefix: 'internal/backups',
    purpose: 'D1 SQL/JSON database snapshots and verified recovery archives',
    accessClassification: 'internal',
    allowedMimes: ['application/json', 'application/gzip', 'text/plain'],
    maxFileSizeBytes: 25 * 1024 * 1024,
    retentionDays: 30,
    associatedModules: ['audit', 'infrastructure'],
  },
  {
    key: 'dip-api-storage',
    slotNumber: 5,
    preferredBinding: 'API_STORAGE_BUCKET',
    fallbackPrefix: 'internal/api-storage',
    purpose: 'API Junction OpenAPI specs, integration payloads, and sample schemas',
    accessClassification: 'internal',
    allowedMimes: ['application/json', 'text/csv', 'application/pdf', 'text/plain'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: 365,
    associatedModules: ['api-junction', 'integrations'],
  },
  {
    key: 'dip-customer-uploads',
    slotNumber: 6,
    preferredBinding: 'CUSTOMER_UPLOADS_BUCKET',
    fallbackPrefix: 'private/customer-uploads',
    purpose: 'Customer vault attachments and supporting compliance files',
    accessClassification: 'private',
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: null,
    associatedModules: ['customers', 'documents'],
  },
  {
    key: 'dip-partner-files',
    slotNumber: 7,
    preferredBinding: 'PARTNER_FILES_BUCKET',
    fallbackPrefix: 'private/partner-files',
    purpose: 'Partner onboarding agreements, operator KYC scans, and centre proofs',
    accessClassification: 'private',
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: null,
    associatedModules: ['partners', 'operators'],
  },
  {
    key: 'dip-api-archives',
    slotNumber: 8,
    preferredBinding: 'API_ARCHIVES_BUCKET',
    fallbackPrefix: 'internal/api-archives',
    purpose: 'Non-sensitive B2B bulk verification CSV batches and processing results',
    accessClassification: 'internal',
    allowedMimes: ['text/csv', 'application/json', 'text/plain'],
    maxFileSizeBytes: 10 * 1024 * 1024,
    retentionDays: 90,
    associatedModules: ['api-junction'],
  },
  {
    key: 'dip-media-library',
    slotNumber: 9,
    preferredBinding: 'MEDIA_LIBRARY_BUCKET',
    fallbackPrefix: 'public/blog-media',
    purpose: 'Bilingual blog featured images, compliance diagrams, and article galleries',
    accessClassification: 'public-read',
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    maxFileSizeBytes: 5 * 1024 * 1024,
    retentionDays: null,
    associatedModules: ['content'],
  },
  {
    key: 'dip-export-reports',
    slotNumber: 10,
    preferredBinding: 'EXPORT_REPORTS_BUCKET',
    fallbackPrefix: 'internal/exports',
    purpose: 'CSV, JSON, and compliance summary exports generated by Admins/Managers',
    accessClassification: 'internal',
    allowedMimes: ['text/csv', 'application/json', 'application/pdf', 'text/plain'],
    maxFileSizeBytes: 15 * 1024 * 1024,
    retentionDays: 60,
    associatedModules: ['analytics', 'billing'],
  },
];

export const CLOUDFLARE_FREE_PLAN_R2_LIMITS = {
  maxRecommendedLogicalBuckets: 10,
  freeStorageLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB / month Free Tier
  safetyThresholdBytes: Math.floor(8.5 * 1024 * 1024 * 1024), // 8.5 GB hard stop to prevent overage charges
  warningThresholdBytes: Math.floor(7.5 * 1024 * 1024 * 1024), // 7.5 GB warning
  freeClassAOpsPerMonth: 1_000_000,
  freeClassBOpsPerMonth: 10_000_000,
  maxSingleUploadBytes: 10 * 1024 * 1024, // 10 MB Worker body safeguard
};

export interface StorageBucketHealthEntry {
  logicalName: LogicalBucketKey;
  slotNumber: number;
  activeBinding: string;
  dedicatedBindingConfigured: boolean;
  consolidatedOntoPrimary: boolean;
  prefix: string;
  purpose: string;
  accessClassification: BucketAccessClassification;
  status: 'CONNECTED' | 'UNCONFIGURED' | 'ERROR';
  fileCount: number;
  bytesUsed: number;
  maxFileSizeBytes: number;
  retentionDays: number | null;
  associatedModules: string[];
  errorMessage?: string;
}

export class StorageRegistry {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  getDefinition(bucketKey: LogicalBucketKey): LogicalBucketDefinition {
    return (
      LOGICAL_BUCKET_CATALOG.find((b) => b.key === bucketKey) ||
      LOGICAL_BUCKET_CATALOG[0]
    );
  }

  resolve(bucketKey: LogicalBucketKey): {
    bucket: R2Bucket | null;
    bindingName: string;
    consolidated: boolean;
    definition: LogicalBucketDefinition;
  } {
    const def = this.getDefinition(bucketKey);
    const preferred = this.env[def.preferredBinding] as R2Bucket | undefined;
    if (preferred) {
      return {
        bucket: preferred,
        bindingName: String(def.preferredBinding),
        consolidated: def.preferredBinding === 'DOCUMENTS_BUCKET' ? false : false,
        definition: def,
      };
    }

    if (this.env.DOCUMENTS_BUCKET) {
      return {
        bucket: this.env.DOCUMENTS_BUCKET,
        bindingName: 'DOCUMENTS_BUCKET (dip-official)',
        consolidated: def.key !== 'documents',
        definition: def,
      };
    }

    return {
      bucket: null,
      bindingName: 'UNBOUND',
      consolidated: false,
      definition: def,
    };
  }

  getConfiguredSafetyLimitBytes(): number {
    const parsed = Number(this.env.FREE_PLAN_MAX_R2_BYTES);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, CLOUDFLARE_FREE_PLAN_R2_LIMITS.freeStorageLimitBytes);
    }
    return CLOUDFLARE_FREE_PLAN_R2_LIMITS.safetyThresholdBytes;
  }

  getPhysicalBucketsCount(): number {
    const set = new Set<object>();
    if (this.env.DOCUMENTS_BUCKET) set.add(this.env.DOCUMENTS_BUCKET);
    for (const def of LOGICAL_BUCKET_CATALOG) {
      const b = this.env[def.preferredBinding] as R2Bucket | undefined;
      if (b) set.add(b);
    }
    return set.size;
  }

  async inspectAll(): Promise<{
    freePlanLimits: typeof CLOUDFLARE_FREE_PLAN_R2_LIMITS;
    configuredSafetyThresholdBytes: number;
    physicalBucketsBound: number;
    totalBytesTrackedInRegistry: number;
    totalFilesTrackedInRegistry: number;
    quotaState: 'OK' | 'WARNING' | 'CRITICAL_STOP';
    buckets: StorageBucketHealthEntry[];
  }> {
    // Load per-bucket usage stats from D1 file_registry (dip_workflow -> fallback DB)
    const statsByBucket = new Map<string, { files: number; bytes: number }>();
    let totalFilesTrackedInRegistry = 0;
    let totalBytesTrackedInRegistry = 0;

    const workflowDb = (await new DatabaseRegistry(this.env).resolveAndEnsure('dip_workflow')).db;
    if (workflowDb) {
      try {
        const res = await workflowDb.prepare(
          `SELECT logical_bucket, COUNT(*) AS cnt, COALESCE(SUM(file_size), 0) AS bytes
           FROM file_registry
           WHERE is_deleted = 0
           GROUP BY logical_bucket`
        ).all<{ logical_bucket: string; cnt: number; bytes: number }>();

        for (const row of res.results || []) {
          const files = Number(row.cnt || 0);
          const bytes = Number(row.bytes || 0);
          statsByBucket.set(row.logical_bucket, { files, bytes });
          totalFilesTrackedInRegistry += files;
          totalBytesTrackedInRegistry += bytes;
        }
      } catch {
        // file_registry may not yet be migrated in D1; keep zero metrics cleanly
      }
    }

    const bucketConnCache = new Map<R2Bucket, { ok: boolean; err?: string }>();
    const testBucket = async (b: R2Bucket): Promise<{ ok: boolean; err?: string }> => {
      if (bucketConnCache.has(b)) return bucketConnCache.get(b)!;
      try {
        await b.list({ limit: 1 });
        const val = { ok: true };
        bucketConnCache.set(b, val);
        return val;
      } catch (err: any) {
        const val = { ok: false, err: err?.message || 'R2 connectivity check failed' };
        bucketConnCache.set(b, val);
        return val;
      }
    };

    const entries: StorageBucketHealthEntry[] = [];
    for (const def of LOGICAL_BUCKET_CATALOG) {
      const resolved = this.resolve(def.key);
      const usage = statsByBucket.get(def.key) || { files: 0, bytes: 0 };

      if (!resolved.bucket) {
        entries.push({
          logicalName: def.key,
          slotNumber: def.slotNumber,
          activeBinding: resolved.bindingName,
          dedicatedBindingConfigured: false,
          consolidatedOntoPrimary: false,
          prefix: def.fallbackPrefix,
          purpose: def.purpose,
          accessClassification: def.accessClassification,
          status: 'UNCONFIGURED',
          fileCount: usage.files,
          bytesUsed: usage.bytes,
          maxFileSizeBytes: def.maxFileSizeBytes,
          retentionDays: def.retentionDays,
          associatedModules: def.associatedModules,
          errorMessage: 'DOCUMENTS_BUCKET not bound in Worker runtime.',
        });
        continue;
      }

      const probe = await testBucket(resolved.bucket);
      entries.push({
        logicalName: def.key,
        slotNumber: def.slotNumber,
        activeBinding: resolved.bindingName,
        dedicatedBindingConfigured: !resolved.consolidated,
        consolidatedOntoPrimary: resolved.consolidated,
        prefix: def.fallbackPrefix,
        purpose: def.purpose,
        accessClassification: def.accessClassification,
        status: probe.ok ? 'CONNECTED' : 'ERROR',
        fileCount: usage.files,
        bytesUsed: usage.bytes,
        maxFileSizeBytes: def.maxFileSizeBytes,
        retentionDays: def.retentionDays,
        associatedModules: def.associatedModules,
        errorMessage: probe.err,
      });
    }

    const configuredSafetyThresholdBytes = this.getConfiguredSafetyLimitBytes();
    const quotaState =
      totalBytesTrackedInRegistry >= configuredSafetyThresholdBytes
        ? 'CRITICAL_STOP'
        : totalBytesTrackedInRegistry >= CLOUDFLARE_FREE_PLAN_R2_LIMITS.warningThresholdBytes
        ? 'WARNING'
        : 'OK';

    return {
      freePlanLimits: CLOUDFLARE_FREE_PLAN_R2_LIMITS,
      configuredSafetyThresholdBytes,
      physicalBucketsBound: this.getPhysicalBucketsCount(),
      totalBytesTrackedInRegistry,
      totalFilesTrackedInRegistry,
      quotaState,
      buckets: entries,
    };
  }
}
