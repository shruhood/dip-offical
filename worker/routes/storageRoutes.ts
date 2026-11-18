import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse } from '../middleware/security';
import { requireAuth } from '../middleware/auth';
import { FileService } from '../services/fileService';
import { DatabaseRegistry } from '../config/database';
import { LOGICAL_BUCKET_CATALOG, type LogicalBucketKey, StorageRegistry } from '../config/storage';
import { canAccessApplication, isSuperAdminRole } from '../../src/lib/rbac';

export const storageRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const ADMIN_ONLY_BUCKETS = new Set<LogicalBucketKey>([
  'dip-backups',
  'dip-public-assets',
  'dip-media-library',
  'dip-api-storage',
  'dip-export-reports',
]);

storageRouter.get('/buckets', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!isSuperAdminRole(user.role) && user.role !== 'manager') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Admin or Manager roles can inspect bucket registry.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const registry = new StorageRegistry(c.env);
  const report = await registry.inspectAll();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'R2 storage registry retrieved',
      requestId: reqId,
      data: report,
    })
  );
});

storageRouter.post('/upload', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const form = await c.req.formData().catch(() => null);
  if (!form) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Multipart formData containing a "file" field is required.',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_MULTIPART',
      }),
      400
    );
  }

  const file = form.get('file') as File | null;
  if (!file) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'No file attached in formData field "file".',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_FILE',
      }),
      400
    );
  }

  const requestedBucket = String(form.get('bucket') || 'documents') as LogicalBucketKey;
  const validBucket = LOGICAL_BUCKET_CATALOG.some((b) => b.key === requestedBucket)
    ? requestedBucket
    : 'documents';

  if (ADMIN_ONLY_BUCKETS.has(validBucket) && !isSuperAdminRole(user.role) && user.role !== 'manager') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: `Role "${user.role}" cannot upload directly into "${validBucket}".`,
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_BUCKET',
      }),
      403
    );
  }

  const applicationId = String(form.get('applicationId') || '').replace(/[^a-zA-Z0-9_-]/g, '') || undefined;
  const documentCategory = String(form.get('documentCategory') || 'Supporting Document').slice(0, 80);
  const customerId =
    isSuperAdminRole(user.role) || user.role === 'operator' || user.role === 'manager' || user.role === 'partner'
      ? String(form.get('customerId') || user.id).slice(0, 80)
      : user.id;

  const fileService = new FileService(c.env);
  try {
    const record = await fileService.uploadFile({
      file,
      logicalBucket: validBucket,
      user,
      customerId,
      applicationId,
      documentCategory,
      ip: c.req.header('cf-connecting-ip'),
    });

    const publicUrl =
      record.accessClassification === 'public-read'
        ? `/api/storage/public/${encodeURIComponent(record.id)}`
        : null;

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `File stored safely in "${validBucket}" R2 bucket`,
        requestId: reqId,
        data: { ...record, publicUrl },
      }),
      201
    );
  } catch (err: any) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: err?.message || 'File upload failed validation.',
        requestId: reqId,
        data: null,
        errorCode: 'UPLOAD_REJECTED',
      }),
      400
    );
  }
});

async function canUserAccessRegistryFile(
  env: Env,
  user: NonNullable<AppVariables['user']>,
  meta: {
    accessClassification: string;
    uploadedBy: string;
    customerId?: string | null;
    applicationId?: string | null;
  }
): Promise<boolean> {
  if (meta.accessClassification === 'public-read') return true;
  if (isSuperAdminRole(user.role) || user.role === 'manager') return true;
  if (meta.uploadedBy === user.id || meta.customerId === user.id) return true;

  if (meta.applicationId) {
    const { db: workflowDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_workflow');
    if (workflowDb) {
      const appRow = await workflowDb.prepare(
        `SELECT user_id, assigned_operator_id FROM applications WHERE id = ? AND deleted_at IS NULL LIMIT 1`
      )
        .bind(meta.applicationId)
        .first<{ user_id: string; assigned_operator_id: string | null }>()
        .catch(() => null);

      if (appRow) {
        return canAccessApplication(user, {
          userId: appRow.user_id,
          userEmail: '',
          assignedOperatorId: appRow.assigned_operator_id || undefined,
        });
      }
    }
  }
  return false;
}

storageRouter.get('/files', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const bucket = c.req.query('bucket');
  const applicationId = c.req.query('applicationId');
  const limit = Number(c.req.query('limit') || 50);

  const fileService = new FileService(c.env);
  const isAdminOrMgr = isSuperAdminRole(user.role) || user.role === 'manager';

  // Non-manager/non-admin users querying by applicationId must have verified access to that application
  let scopedCustomerId: string | undefined = isAdminOrMgr ? c.req.query('customerId') : user.id;
  if (!isAdminOrMgr && applicationId) {
    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    const appRow = workflowDb
      ? await workflowDb.prepare(
          `SELECT user_id, assigned_operator_id FROM applications WHERE id = ? AND deleted_at IS NULL LIMIT 1`
        )
          .bind(applicationId)
          .first<{ user_id: string; assigned_operator_id: string | null }>()
          .catch(() => null)
      : null;

    if (
      !appRow ||
      !canAccessApplication(user, {
        userId: appRow.user_id,
        userEmail: '',
        assignedOperatorId: appRow.assigned_operator_id || undefined,
      })
    ) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Not authorized to inspect files for this application.',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN',
        }),
        403
      );
    }
    scopedCustomerId = undefined; // Authorized for this specific applicationId
  }

  const items = await fileService.listFiles({
    logicalBucket: bucket,
    applicationId,
    customerId: scopedCustomerId,
    limit,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'File registry records retrieved',
      requestId: reqId,
      data: items,
    })
  );
});

storageRouter.get('/files/:id/metadata', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const fileId = c.req.param('id');
  const fileService = new FileService(c.env);
  const check = await fileService.exists(fileId);

  if (!check.metadata) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'File record not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  const allowed = await canUserAccessRegistryFile(c.env, user, check.metadata);
  if (!allowed) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Not authorized to inspect this file metadata.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'File existence and metadata verified',
      requestId: reqId,
      data: { existsInR2: check.exists, metadata: check.metadata },
    })
  );
});

storageRouter.post('/files/:id/signed-url', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const fileId = c.req.param('id');
  const fileService = new FileService(c.env);
  const meta = await fileService.getMetadataById(fileId);

  if (!meta) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'File record not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  const canRead = await canUserAccessRegistryFile(c.env, user, meta);
  if (!canRead) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Not authorized to download this private file.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_DOCUMENT',
      }),
      403
    );
  }

  try {
    const signed = await fileService.issueSignedDownloadUrl({ fileId, actor: user });
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Short-lived signed R2 download URL issued',
        requestId: reqId,
        data: signed,
      })
    );
  } catch (err: any) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: err?.message || 'Unable to sign download URL.',
        requestId: reqId,
        data: null,
        errorCode: 'SIGNING_UNAVAILABLE',
      }),
      503
    );
  }
});

storageRouter.get('/files/:id/download', async (c) => {
  const reqId = c.get('requestId');
  const fileId = c.req.param('id');
  const exp = Number(c.req.query('exp') || 0);
  const uid = c.req.query('uid') || '';
  const sig = c.req.query('sig') || '';

  const fileService = new FileService(c.env);
  const valid = await fileService.verifySignedDownloadToken({ fileId, exp, uid, sig });
  if (!valid) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Download authorization token is invalid or expired.',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_OR_EXPIRED_TOKEN',
      }),
      403
    );
  }

  const meta = await fileService.getMetadataById(fileId);
  if (!meta) return c.notFound();
  const obj = await fileService.getObjectStream(meta);
  if (!obj) return c.notFound();

  if (meta.applicationId) {
    const { db: auditDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_audit');
    if (auditDb) {
      try {
        await auditDb.prepare(
          `INSERT INTO document_access_logs (id, document_id, application_id, accessor_user_id, accessor_role, access_type, ip_address)
           VALUES (?, ?, ?, ?, 'signed_token', 'DOWNLOADED', ?)`
        )
          .bind(
            `dal_${crypto.randomUUID()}`,
            fileId,
            meta.applicationId,
            uid,
            c.req.header('cf-connecting-ip') || 'edge'
          )
          .run();
      } catch {
        // ignore non-fatal log error
      }
    }
  }

  return new Response(obj.body as unknown as BodyInit, {
    headers: {
      'Content-Type': meta.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${meta.originalFilename}"`,
      'Cache-Control': 'no-store, private',
    },
  });
});

// Public-read asset endpoint (explicitly rejects private/internal buckets)
storageRouter.get('/public/:id', async (c) => {
  const fileId = c.req.param('id');
  const fileService = new FileService(c.env);
  const meta = await fileService.getMetadataById(fileId);
  if (!meta) return c.notFound();

  if (meta.accessClassification !== 'public-read') {
    return c.json({ error: 'Private documents require signed authentication.' }, 403);
  }

  const obj = await fileService.getObjectStream(meta);
  if (!obj) return c.notFound();

  return new Response(obj.body as unknown as BodyInit, {
    headers: {
      'Content-Type': meta.mimeType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

storageRouter.patch('/files/:id/rename', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const fileId = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const newFilename = String(body?.newFilename || '').trim();

  if (!newFilename) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'newFilename is required.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_FILENAME',
      }),
      400
    );
  }

  const fileService = new FileService(c.env);
  const existing = await fileService.getMetadataById(fileId);
  if (!existing) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'File not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  if (!isSuperAdminRole(user.role) && existing.uploadedBy !== user.id) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only file owner or Super Admin can rename files.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const updated = await fileService.renameFile({
    fileId,
    newFilename,
    actor: user,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'File renamed via R2 copy-and-delete',
      requestId: reqId,
      data: updated,
    })
  );
});

storageRouter.delete('/files/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const fileId = c.req.param('id');
  const fileService = new FileService(c.env);
  const existing = await fileService.getMetadataById(fileId);

  if (!existing) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'File not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  if (!isSuperAdminRole(user.role) && existing.uploadedBy !== user.id) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only file owner or Super Admin can delete files.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  await fileService.deleteFile({
    fileId,
    actor: user,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'File deleted from R2 and marked deleted in registry',
      requestId: reqId,
      data: { fileId, deleted: true },
    })
  );
});
