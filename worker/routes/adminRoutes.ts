import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse, hmacSha256Base64 } from '../middleware/security';
import { requireAuth, requirePermission } from '../middleware/auth';
import { DatabaseRegistry } from '../config/database';
import { StorageRegistry } from '../config/storage';
import { BackupService } from '../services/backupService';
import { FileService } from '../services/fileService';
import { recordAuditEvent, recordInfraEvent } from '../services/auditService';
import {
  loadEffectiveCashfreeConfig,
  normalizeCashfreeLifecycleState,
  probeCashfreeGatewayCredentials,
  resolveCashfreeConfig,
  validateWebhookTimestamp,
  verifyCashfreeWebhookWithAnySecret,
} from '../services/cashfreeService';
import { processCashfreeWebhookEvent, runCashfreeReconciliationSweep } from '../services/paymentReconciliation';
import { fromPaise } from '../../src/lib/finance';
import { isSuperAdminRole } from '../../src/lib/rbac';
import { slugifyBlogTitle, estimateReadingTime } from '../../src/lib/blogSeo';
import {
  CATALOGUE_CATEGORIES,
  COMPLETE_CATALOGUE_ITEMS,
  CORE_CATALOGUE_ITEMS,
  INITIAL_COUPONS,
} from '../../src/data/catalogue';
import { runIdempotentCatalogueImport } from '../../src/lib/catalogueImporter';
import {
  mapCatalogServiceToD1Record,
  planIdempotentServicesSync,
} from '../../src/lib/catalogueSync';

export const adminRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminRouter.use('*', requireAuth);

// ==========================================
// 1. CENTRAL CLOUDFLARE INFRASTRUCTURE MONITOR (FREE PLAN)
// ==========================================
adminRouter.get('/infrastructure', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const dbRegistry = new DatabaseRegistry(c.env);
  const storageRegistry = new StorageRegistry(c.env);
  const backupService = new BackupService(c.env);

  const [dbReport, storageReport, backups, auditResolved] = await Promise.all([
    dbRegistry.inspectAll(),
    storageRegistry.inspectAll(),
    backupService.listBackups(10),
    dbRegistry.resolveAndEnsure('dip_audit'),
  ]);

  let recentEvents: any[] = [];
  if (auditResolved.db) {
    try {
      const evtRes = await auditResolved.db.prepare(
        `SELECT * FROM infra_resource_events ORDER BY created_at DESC LIMIT 20`
      ).all();
      recentEvents = evtRes.results || [];
    } catch {
      recentEvents = [];
    }
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Cloudflare Free-Plan infrastructure telemetry retrieved',
      requestId: reqId,
      data: {
        plan: 'Cloudflare Free Plan ONLY',
        environment: c.env.ENVIRONMENT || 'production',
        domain: c.env.APP_DOMAIN || 'https://digitalindiaproject.com',
        databases: dbReport,
        storage: storageReport,
        backups,
        secretsReadiness: {
          authSigning: Boolean(c.env.AUTH_SIGNING_SECRET),
          cashfreeGateway: resolveCashfreeConfig(c.env).configured,
          cashfreeWebhook: Boolean(resolveCashfreeConfig(c.env).webhookSecret),
          cashfreeMode: resolveCashfreeConfig(c.env).mode,
          digilocker: Boolean(c.env.DIGILOCKER_CLIENT_ID && c.env.DIGILOCKER_CLIENT_SECRET),
          apiSetu: Boolean(c.env.API_SETU_API_KEY),
          resendEmail: Boolean(c.env.RESEND_API_KEY),
          aiProvidersConfiguredCount: [
            c.env.GEMINI_API_KEY,
            c.env.OPENROUTER_API_KEY,
            c.env.GROQ_API_KEY,
            c.env.OPENAI_API_KEY,
            c.env.ANTHROPIC_API_KEY,
          ].filter(Boolean).length,
        },
        recentEvents,
      },
    })
  );
});

adminRouter.post('/infrastructure/health-check', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const dbRegistry = new DatabaseRegistry(c.env);
  const storageRegistry = new StorageRegistry(c.env);

  const [dbReport, storageReport] = await Promise.all([
    dbRegistry.inspectAll(),
    storageRegistry.inspectAll(),
  ]);

  const healthyDbs = dbReport.databases.filter((d) => d.status === 'CONNECTED').length;
  const healthyBuckets = storageReport.buckets.filter((b) => b.status === 'CONNECTED').length;

  await recordInfraEvent(c.env, {
    resourceType: 'worker',
    resourceName: 'digitalindiaproject',
    severity: healthyDbs > 0 && healthyBuckets > 0 ? 'info' : 'warning',
    code: 'MANUAL_HEALTH_PROBE',
    message: `Admin probe: ${healthyDbs}/10 logical D1 routes OK (${dbReport.physicalDatabasesBound} physical DBs); ${healthyBuckets}/10 logical R2 routes OK (${storageReport.physicalBucketsBound} physical buckets)`,
  });

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'INFRASTRUCTURE_HEALTH_CHECK',
    resourceType: 'cloudflare_infra',
    resourceId: 'digitalindiaproject',
    summary: `Checked ${dbReport.physicalDatabasesBound} D1 & ${storageReport.physicalBucketsBound} R2 physical bindings`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Live D1 and R2 health checks completed',
      requestId: reqId,
      data: { databases: dbReport, storage: storageReport },
    })
  );
});

// ==========================================
// 2. FREE-PLAN D1 -> R2 VERIFIED BACKUPS
// ==========================================
adminRouter.get('/backups', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const svc = new BackupService(c.env);
  const backups = await svc.listBackups(25);
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Backup inventory retrieved',
      requestId: reqId,
      data: backups,
    })
  );
});

adminRouter.post('/backups/export', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!isSuperAdminRole(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Super Admin can trigger D1 database backups.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const svc = new BackupService(c.env);
  try {
    const rec = await svc.createVerifiedBackup(user, c.req.header('cf-connecting-ip'));
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Verified D1 backup stored in R2 (${rec.tablesCount} tables, ${rec.rowsCount} rows)`,
        requestId: reqId,
        data: rec,
      }),
      201
    );
  } catch (err: any) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: err?.message || 'Backup export failed',
        requestId: reqId,
        data: null,
        errorCode: 'BACKUP_FAILED',
      }),
      500
    );
  }
});

adminRouter.post('/backups/:id/verify', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const svc = new BackupService(c.env);
  try {
    const res = await svc.verifyExistingBackup(c.req.param('id'));
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Backup integrity status: ${res.verificationStatus}`,
        requestId: reqId,
        data: res,
      })
    );
  } catch (err: any) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: err?.message || 'Verification failed',
        requestId: reqId,
        data: null,
        errorCode: 'VERIFY_FAILED',
      }),
      404
    );
  }
});

adminRouter.get('/backups/:id/download', requirePermission('settings.manage'), async (c) => {
  const user = c.get('user')!;
  if (!isSuperAdminRole(user.role)) {
    return c.json({ error: 'Only Super Admin can download raw database backups.' }, 403);
  }
  const svc = new BackupService(c.env);
  const found = await svc.getBackupPayload(c.req.param('id'));
  if (!found) return c.notFound();
  return new Response(found.content, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Content-Disposition': `attachment; filename="${found.record.id}.json"`,
      'Cache-Control': 'no-store, private',
    },
  });
});

// ==========================================
// 3. BILINGUAL BLOG CMS (D1 + REVISIONS)
// ==========================================
adminRouter.get('/blog', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!contentDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'D1 not bound; using empty D1 blog list',
        requestId: reqId,
        data: [],
      })
    );
  }
  try {
    const res = await contentDb.prepare(
      `SELECT * FROM blog_posts ORDER BY published_at DESC`
    ).all();
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Blog posts retrieved from D1 (dip_content)',
        requestId: reqId,
        data: res.results || [],
      })
    );
  } catch {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Blog table awaiting migration 0004 apply',
        requestId: reqId,
        data: [],
      })
    );
  }
});

adminRouter.post('/blog', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!contentDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'D1 database binding unavailable.',
        requestId: reqId,
        data: null,
        errorCode: 'D1_UNBOUND',
      }),
      503
    );
  }

  const title = String(body?.title || '').trim();
  const content = String(body?.content || '').trim();
  if (!title || !content) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'title and content are required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_FIELDS',
      }),
      400
    );
  }

  const id = String(body?.id || `post_${crypto.randomUUID().slice(0, 12)}`);
  const slug = slugifyBlogTitle(String(body?.slug || title));
  const nowIso = new Date().toISOString();

  await contentDb.prepare(
    `INSERT INTO blog_posts (
      id, slug, title, title_hi, excerpt, excerpt_hi, content, content_hi, category,
      tags_json, status, featured, author_name, author_role, featured_image_url, featured_image_key,
      gallery_json, official_links_json, related_slugs_json, related_service_slug,
      seo_title, seo_description, focus_keyword, canonical_url, faq_items_json,
      reading_time_minutes, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      title_hi = excluded.title_hi,
      excerpt = excluded.excerpt,
      excerpt_hi = excluded.excerpt_hi,
      content = excluded.content,
      content_hi = excluded.content_hi,
      category = excluded.category,
      tags_json = excluded.tags_json,
      status = excluded.status,
      featured = excluded.featured,
      featured_image_url = excluded.featured_image_url,
      featured_image_key = excluded.featured_image_key,
      gallery_json = excluded.gallery_json,
      official_links_json = excluded.official_links_json,
      related_slugs_json = excluded.related_slugs_json,
      related_service_slug = excluded.related_service_slug,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      focus_keyword = excluded.focus_keyword,
      canonical_url = excluded.canonical_url,
      faq_items_json = excluded.faq_items_json,
      reading_time_minutes = excluded.reading_time_minutes,
      updated_at = excluded.updated_at`
  )
    .bind(
      id,
      slug,
      title,
      body.titleHi || null,
      String(body.excerpt || content.slice(0, 160)),
      body.excerptHi || null,
      content,
      body.contentHi || null,
      String(body.category || 'Citizen Guides'),
      JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
      String(body.status || 'published'),
      body.featured ? 1 : 0,
      String(body.authorName || user.name || 'Digital India Editorial Desk'),
      String(body.authorRole || 'Editorial & Compliance Team'),
      body.featuredImageUrl || null,
      body.featuredImageKey || null,
      JSON.stringify(Array.isArray(body.gallery) ? body.gallery : []),
      JSON.stringify(Array.isArray(body.officialLinks) ? body.officialLinks : []),
      JSON.stringify(Array.isArray(body.relatedSlugs) ? body.relatedSlugs : []),
      body.relatedServiceSlug || null,
      body.seoTitle || title.slice(0, 65),
      body.seoDescription || String(body.excerpt || '').slice(0, 160),
      body.focusKeyword || null,
      body.canonicalUrl || `https://digitalindiaproject.com/blog/${slug}`,
      JSON.stringify(Array.isArray(body.faqItems) ? body.faqItems : []),
      estimateReadingTime(content),
      body.publishedAt || nowIso,
      nowIso
    )
    .run();

  // Save immutable revision snapshot
  const verRow = await contentDb.prepare(
    `SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM blog_post_revisions WHERE post_id = ?`
  )
    .bind(id)
    .first<{ max_ver: number }>();
  const nextVer = Number(verRow?.max_ver || 0) + 1;

  await contentDb.prepare(
    `INSERT INTO blog_post_revisions (id, post_id, version_number, title, title_hi, content, content_hi, edited_by, change_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      `rev_${crypto.randomUUID()}`,
      id,
      nextVer,
      title,
      body.titleHi || null,
      content,
      body.contentHi || null,
      user.id,
      String(body.changeSummary || `Saved revision v${nextVer}`)
    )
    .run();

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'BLOG_POST_SAVED',
    resourceType: 'blog_post',
    resourceId: id,
    summary: `Saved bilingual article "${title}" (slug: ${slug}, v${nextVer})`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Article persisted to D1 with revision snapshot',
      requestId: reqId,
      data: { id, slug, versionNumber: nextVer },
    })
  );
});

adminRouter.get('/blog/:id/revisions', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const postId = c.req.param('id');
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!contentDb) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No D1', requestId: reqId, data: [] }));
  const res = await contentDb.prepare(
    `SELECT * FROM blog_post_revisions WHERE post_id = ? ORDER BY version_number DESC LIMIT 20`
  )
    .bind(postId)
    .all();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Blog revisions fetched',
      requestId: reqId,
      data: res.results || [],
    })
  );
});

adminRouter.delete('/blog/:id', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const id = c.req.param('id');
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (contentDb) {
    await contentDb.prepare(`UPDATE blog_posts SET status = 'archived', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
  }
  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'BLOG_POST_ARCHIVED',
    resourceType: 'blog_post',
    resourceId: id,
    summary: `Archived blog post ${id}`,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Blog post archived safely',
      requestId: reqId,
      data: { id, status: 'archived' },
    })
  );
});

// ==========================================
// 4. AUDIT LOGS, SETTINGS & ANALYTICS
// ==========================================
adminRouter.get('/audit-logs', requirePermission('audit_logs.view'), async (c) => {
  const reqId = c.get('requestId');
  const { db: auditDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_audit');
  if (!auditDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No D1', requestId: reqId, data: [] }));
  }
  const rows = await auditDb.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
  ).all();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Audit logs retrieved',
      requestId: reqId,
      data: rows.results || [],
    })
  );
});

adminRouter.get('/analytics', requirePermission('reports.view'), async (c) => {
  const reqId = c.get('requestId');
  const dbReg = new DatabaseRegistry(c.env);
  const [wf, bill, part, cont] = await Promise.all([
    dbReg.resolveAndEnsure('dip_workflow'),
    dbReg.resolveAndEnsure('dip_billing'),
    dbReg.resolveAndEnsure('dip_partners'),
    dbReg.resolveAndEnsure('dip_content'),
  ]);

  if (!wf.db && !bill.db && !part.db && !cont.db) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Analytics baseline',
        requestId: reqId,
        data: { applications: 0, revenuePaise: 0, partners: 0, files: 0, publishedBlogs: 0 },
      })
    );
  }
  const [apps, paid, partners, files, blogs] = await Promise.all([
    wf.db ? wf.db.prepare(`SELECT COUNT(*) AS c FROM applications WHERE deleted_at IS NULL`).first<{ c: number }>().catch(() => ({ c: 0 })) : Promise.resolve({ c: 0 }),
    bill.db ? bill.db.prepare(`SELECT COALESCE(SUM(total_paise), 0) AS s FROM payment_orders WHERE status = 'PAID'`).first<{ s: number }>().catch(() => ({ s: 0 })) : Promise.resolve({ s: 0 }),
    part.db ? part.db.prepare(`SELECT COUNT(*) AS c FROM partners`).first<{ c: number }>().catch(() => ({ c: 0 })) : Promise.resolve({ c: 0 }),
    wf.db ? wf.db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS b FROM file_registry WHERE is_deleted = 0`).first<{ c: number; b: number }>().catch(() => ({ c: 0, b: 0 })) : Promise.resolve({ c: 0, b: 0 }),
    cont.db ? cont.db.prepare(`SELECT COUNT(*) AS c FROM blog_posts WHERE status = 'published'`).first<{ c: number }>().catch(() => ({ c: 0 })) : Promise.resolve({ c: 0 }),
  ]);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Platform operational metrics retrieved',
      requestId: reqId,
      data: {
        applications: Number(apps?.c || 0),
        revenuePaise: Number(paid?.s || 0),
        partners: Number(partners?.c || 0),
        filesCount: Number(files?.c || 0),
        storageBytes: Number(files?.b || 0),
        publishedBlogs: Number(blogs?.c || 0),
      },
    })
  );
});

adminRouter.get('/settings', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Default settings', requestId: reqId, data: null }));
  }
  const row = await coreDb.prepare(`SELECT * FROM business_settings WHERE id = 'default' LIMIT 1`).first();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Business settings fetched',
      requestId: reqId,
      data: row || null,
    })
  );
});

adminRouter.put('/settings', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb.prepare(
      `INSERT INTO business_settings (
        id, legal_name, trade_name, gstin, pan, invoice_prefix, registered_address,
        support_email, support_phone, default_tax_rate_bps, updated_by, updated_at
      ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        legal_name = COALESCE(NULLIF(excluded.legal_name, ''), business_settings.legal_name),
        trade_name = COALESCE(NULLIF(excluded.trade_name, ''), business_settings.trade_name),
        gstin = COALESCE(NULLIF(excluded.gstin, ''), business_settings.gstin),
        pan = COALESCE(NULLIF(excluded.pan, ''), business_settings.pan),
        invoice_prefix = COALESCE(NULLIF(excluded.invoice_prefix, ''), business_settings.invoice_prefix),
        registered_address = COALESCE(NULLIF(excluded.registered_address, ''), business_settings.registered_address),
        support_email = COALESCE(NULLIF(excluded.support_email, ''), business_settings.support_email),
        support_phone = COALESCE(NULLIF(excluded.support_phone, ''), business_settings.support_phone),
        default_tax_rate_bps = COALESCE(excluded.default_tax_rate_bps, business_settings.default_tax_rate_bps),
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP`
    )
      .bind(
        String(body.legalName || 'Digital India Project'),
        String(body.tradeName || 'Digital India Project'),
        String(body.gstin || ''),
        String(body.pan || ''),
        String(body.invoicePrefix || 'DIP-INV-2026'),
        String(body.registeredAddress || ''),
        String(body.supportEmail || 'support@digitalindiaproject.com'),
        String(body.supportPhone || '+91 77779 41227'),
        body.defaultTaxRateBps ?? 1800,
        user.id
      )
      .run();
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'BUSINESS_SETTINGS_UPDATED',
    resourceType: 'business_settings',
    resourceId: 'default',
    summary: 'Updated company statutory and GST billing configuration',
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Business settings saved',
      requestId: reqId,
      data: body,
    })
  );
});

// ==========================================
// 5. CATALOGUE IMPORT, COUPONS, QUOTES & DIGITAL ORDERS
// ==========================================
adminRouter.get('/catalogue/import-logs', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const { db: servicesDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_services');
  if (!servicesDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No D1 bound', requestId: reqId, data: [] }));
  }
  try {
    const rows = await servicesDb.prepare(
      `SELECT * FROM catalogue_import_logs ORDER BY created_at DESC LIMIT 30`
    ).all();
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Catalogue import logs fetched',
        requestId: reqId,
        data: rows.results || [],
      })
    );
  } catch {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Import log table pending migration', requestId: reqId, data: [] }));
  }
});

adminRouter.post('/catalogue/import', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawInput = body?.rawInput ?? body?.items ?? COMPLETE_CATALOGUE_ITEMS;

  const { mergedItems, report } = runIdempotentCatalogueImport({
    existingItems: COMPLETE_CATALOGUE_ITEMS,
    rawInput,
    actorName: user.name || 'Super Admin',
    formatHint: body?.formatHint,
  });

  const { db: servicesDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_services');
  if (servicesDb) {
    try {
      await servicesDb.prepare(
        `INSERT INTO catalogue_import_logs (
          id, actor_user_id, actor_name, source_format, total_processed,
          created_count, updated_count, skipped_count, errors_count, report_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          report.id,
          user.id,
          report.actorName,
          report.sourceFormat,
          report.totalProcessed,
          report.createdCount,
          report.updatedCount,
          report.skippedCount,
          report.errorsCount,
          JSON.stringify(report)
        )
        .run();
    } catch {
      // Ignore if migration 0005 pending
    }
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'CATALOGUE_IMPORT_EXECUTED',
    resourceType: 'catalogue',
    resourceId: report.id,
    summary: `Imported ${report.totalProcessed} item(s): ${report.createdCount} created, ${report.updatedCount} updated, ${report.skippedCount} skipped`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: report.errorsCount === 0,
      status: report.errorsCount === 0 ? 'SUCCESS' : 'REJECTED',
      message: `Processed ${report.totalProcessed} item(s): ${report.createdCount} created, ${report.updatedCount} updated, ${report.skippedCount} skipped`,
      requestId: reqId,
      data: { report, totalCatalogueCount: mergedItems.length },
      errorCode: report.errorsCount === 0 ? null : 'IMPORT_PARTIAL_ERRORS',
    })
  );
});

adminRouter.post('/catalogue/sync', requirePermission('services.create'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!isSuperAdminRole(user.role) && user.role !== 'admin') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Admin or Super Admin can run idempotent Services database sync.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const includePackages = Boolean(body?.includePackages);
  const dryRun = Boolean(body?.dryRun);
  const forceRefreshSeo = body?.forceRefreshSeo !== false;
  const targetCatalog = includePackages ? COMPLETE_CATALOGUE_ITEMS : CORE_CATALOGUE_ITEMS;
  const nowIso = new Date().toISOString();

  const { db: servicesDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_services');
  let existingRecords: Record<string, any>[] = [];

  if (servicesDb) {
    try {
      const existingRows = await servicesDb.prepare(`SELECT * FROM services`).all<any>();
      existingRecords = (existingRows.results || []).map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        nameHi: r.name_hi || r.name,
        category: String(r.category_id || '').replace(/^cat-/, '') || 'personal',
        subcategory: r.subcategory || undefined,
        productType: r.product_type || 'service',
        shortDesc: r.short_desc || '',
        shortDescHi: r.short_desc_hi || '',
        fullDesc: r.full_desc || '',
        iconName: r.icon_name || 'FileText',
        serviceCharge: Number(r.service_charge || 0),
        govtFees: Number(r.govt_fees || 0),
        thirdPartyFees: r.third_party_fee_paise ? Number(r.third_party_fee_paise) / 100 : 0,
        urgentFee: r.urgent_fee_paise ? Number(r.urgent_fee_paise) / 100 : 0,
        discountInr: r.discount_paise ? Number(r.discount_paise) / 100 : 0,
        billingUnit: r.billing_unit || 'one_time',
        pricingType: r.pricing_type || 'fixed',
        deliveryType: r.delivery_type || 'online',
        estimatedTime: r.estimated_time || '3 - 5 Working Days',
        popular: Boolean(r.is_popular),
        featured: Boolean(r.is_featured),
        published: r.is_active !== 0,
        isCustomQuote: Boolean(r.is_custom_quote),
        seoTitle: r.seo_title || undefined,
        seoDescription: r.seo_description || undefined,
        focusKeyword: r.focus_keyword || undefined,
        createdAt: r.created_at || nowIso,
      }));
    } catch {
      existingRecords = [];
    }
  }

  const plan = planIdempotentServicesSync({
    catalog: targetCatalog,
    existingRecords,
    actorName: user.name || 'Super Admin',
    nowIso,
    preserveExistingCustomizations: true,
    forceRefreshSeo,
  });

  const pendingCatalogItems = new Set([
    ...plan.toCreate.map((r) => r.slug),
    ...plan.toUpdate.map((r) => r.slug),
  ]);

  if (servicesDb && !dryRun) {
    for (const cat of CATALOGUE_CATEGORIES) {
      await servicesDb
        .prepare(
          `INSERT INTO service_categories (id, slug, name, name_hi, description, icon_name, badge_color, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             name_hi = excluded.name_hi,
             description = excluded.description,
             icon_name = excluded.icon_name,
             display_order = excluded.display_order`
        )
        .bind(
          cat.id,
          cat.slug,
          cat.name,
          cat.nameHi || cat.name,
          cat.description,
          cat.iconName,
          cat.badgeColor || '#138808',
          Number(cat.displayOrder || 0)
        )
        .run()
        .catch(() => null);
    }

    for (const srv of targetCatalog) {
      if (!pendingCatalogItems.has(srv.slug.toLowerCase())) continue;
      const d1Row = mapCatalogServiceToD1Record(srv, nowIso);
      const matchedMapped = [...plan.toCreate, ...plan.toUpdate].find(
        (m) => m.slug === srv.slug.toLowerCase()
      );
      const targetId = matchedMapped?.id || d1Row.id;

      try {
        await servicesDb
          .prepare(
            `INSERT INTO services (
              id, category_id, slug, name, name_hi, short_desc, short_desc_hi, full_desc,
              icon_name, service_charge, govt_fees, estimated_time, is_popular, is_featured, is_active,
              product_type, subcategory, billing_unit, pricing_type, third_party_fee_paise,
              urgent_fee_paise, discount_paise, govt_fee_note, commission_note, delivery_type,
              seo_title, seo_description, focus_keyword, is_custom_quote, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              name = excluded.name,
              name_hi = excluded.name_hi,
              short_desc = excluded.short_desc,
              short_desc_hi = excluded.short_desc_hi,
              full_desc = excluded.full_desc,
              icon_name = excluded.icon_name,
              service_charge = excluded.service_charge,
              govt_fees = excluded.govt_fees,
              estimated_time = excluded.estimated_time,
              is_popular = excluded.is_popular,
              is_featured = excluded.is_featured,
              product_type = excluded.product_type,
              subcategory = excluded.subcategory,
              billing_unit = excluded.billing_unit,
              pricing_type = excluded.pricing_type,
              third_party_fee_paise = excluded.third_party_fee_paise,
              urgent_fee_paise = excluded.urgent_fee_paise,
              discount_paise = excluded.discount_paise,
              govt_fee_note = excluded.govt_fee_note,
              commission_note = excluded.commission_note,
              delivery_type = excluded.delivery_type,
              seo_title = excluded.seo_title,
              seo_description = excluded.seo_description,
              focus_keyword = excluded.focus_keyword,
              is_custom_quote = excluded.is_custom_quote,
              updated_at = excluded.updated_at`
          )
          .bind(
            targetId,
            d1Row.category_id,
            d1Row.slug,
            d1Row.name,
            d1Row.name_hi,
            d1Row.short_desc,
            d1Row.short_desc_hi,
            d1Row.full_desc,
            d1Row.icon_name,
            d1Row.service_charge,
            d1Row.govt_fees,
            d1Row.estimated_time,
            d1Row.is_popular,
            d1Row.is_featured,
            d1Row.is_active,
            d1Row.product_type,
            d1Row.subcategory,
            d1Row.billing_unit,
            d1Row.pricing_type,
            d1Row.third_party_fee_paise,
            d1Row.urgent_fee_paise,
            d1Row.discount_paise,
            d1Row.govt_fee_note,
            d1Row.commission_note,
            d1Row.delivery_type,
            d1Row.seo_title,
            d1Row.seo_description,
            d1Row.focus_keyword,
            d1Row.is_custom_quote,
            d1Row.updated_at
          )
          .run();
      } catch {
        // Fallback to baseline 0001 columns if migration 0005 columns have not yet been altered
        await servicesDb
          .prepare(
            `INSERT INTO services (
              id, category_id, slug, name, name_hi, short_desc, short_desc_hi, full_desc,
              icon_name, service_charge, govt_fees, estimated_time, is_popular, is_featured, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              name = excluded.name,
              name_hi = excluded.name_hi,
              short_desc = excluded.short_desc,
              short_desc_hi = excluded.short_desc_hi,
              full_desc = excluded.full_desc,
              service_charge = excluded.service_charge,
              govt_fees = excluded.govt_fees,
              estimated_time = excluded.estimated_time,
              updated_at = excluded.updated_at`
          )
          .bind(
            targetId,
            d1Row.category_id,
            d1Row.slug,
            d1Row.name,
            d1Row.name_hi,
            d1Row.short_desc,
            d1Row.short_desc_hi,
            d1Row.full_desc,
            d1Row.icon_name,
            d1Row.service_charge,
            d1Row.govt_fees,
            d1Row.estimated_time,
            d1Row.is_popular,
            d1Row.is_featured,
            d1Row.is_active,
            d1Row.updated_at
          )
          .run()
          .catch(() => null);
      }
    }

    await servicesDb
      .prepare(
        `INSERT INTO catalogue_import_logs (
          id, actor_user_id, actor_name, source_format, total_processed,
          created_count, updated_count, skipped_count, errors_count, report_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        plan.report.id,
        user.id,
        plan.report.actorName,
        'system_sync',
        plan.report.totalProcessed,
        plan.report.createdCount,
        plan.report.updatedCount,
        plan.report.skippedCount,
        plan.report.errorsCount,
        JSON.stringify(plan.report)
      )
      .run()
      .catch(() => null);
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: dryRun ? 'CATALOGUE_SYNC_DRY_RUN' : 'CATALOGUE_SYNC_EXECUTED',
    resourceType: 'services',
    resourceId: plan.report.id,
    summary: `Idempotent catalog sync (dryRun=${dryRun}): ${plan.report.totalProcessed} total, +${plan.report.createdCount} created, ~${plan.report.updatedCount} updated, ${plan.report.skippedCount} skipped`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `${dryRun ? 'Dry-run preview' : 'Idempotent D1 Services sync'} complete: +${plan.report.createdCount} created, ~${plan.report.updatedCount} updated, ${plan.report.skippedCount} skipped`,
      requestId: reqId,
      data: {
        report: plan.report,
        dryRun,
        totalCatalogueCount: targetCatalog.length,
        createdIds: plan.toCreate.map((r) => r.id),
        updatedIds: plan.toUpdate.map((r) => r.id),
        skippedIds: plan.unchanged.map((r) => r.id),
      },
    })
  );
});

adminRouter.get('/coupons', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  let dbCoupons: any[] = [];
  if (billingDb) {
    try {
      const res = await billingDb.prepare(`SELECT * FROM coupons ORDER BY created_at DESC`).all();
      dbCoupons = res.results || [];
    } catch {
      dbCoupons = [];
    }
  }
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Coupons retrieved',
      requestId: reqId,
      data: dbCoupons.length > 0 ? dbCoupons : INITIAL_COUPONS,
    })
  );
});

adminRouter.post('/coupons', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Coupon code is required.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_COUPON_CODE',
      }),
      400
    );
  }
  const id = String(body?.id || `cpn_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (billingDb) {
    await billingDb.prepare(
      `INSERT INTO coupons (
        id, code, description, discount_type, discount_value, discount_percent_bps,
        max_discount_paise, min_order_paise, applicable_categories_json, usage_limit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        description = excluded.description,
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        discount_percent_bps = excluded.discount_percent_bps,
        max_discount_paise = excluded.max_discount_paise,
        min_order_paise = excluded.min_order_paise,
        applicable_categories_json = excluded.applicable_categories_json,
        usage_limit = excluded.usage_limit,
        is_active = excluded.is_active`
    )
      .bind(
        id,
        code,
        String(body?.description || code),
        body?.discountType === 'percentage' ? 'percentage' : 'fixed',
        Number(body?.discountAmountInr || 0),
        Number(body?.discountPercentBps || 0),
        body?.maxDiscountInr ? Math.round(Number(body.maxDiscountInr) * 100) : null,
        Math.round(Number(body?.minOrderAmountInr || 0) * 100),
        JSON.stringify(Array.isArray(body?.applicableCategories) ? body.applicableCategories : []),
        body?.usageLimit ? Number(body.usageLimit) : null,
        body?.isActive === false ? 0 : 1
      )
      .run()
      .catch(() => null);
  }
  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'COUPON_SAVED',
    resourceType: 'coupon',
    resourceId: code,
    summary: `Saved promo coupon ${code}`,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Promo coupon ${code} saved`,
      requestId: reqId,
      data: { id, code, ...body },
    })
  );
});

adminRouter.get('/quotes', requirePermission('applications.view'), async (c) => {
  const reqId = c.get('requestId');
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Quotes endpoint active', requestId: reqId, data: [] }));
  }
  try {
    const res = await coreDb.prepare(`SELECT * FROM custom_quote_requests ORDER BY created_at DESC LIMIT 100`).all();
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Quote requests fetched', requestId: reqId, data: res.results || [] }));
  } catch {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Quotes table pending migration', requestId: reqId, data: [] }));
  }
});

adminRouter.patch('/quotes/:id', requirePermission('services.edit'), async (c) => {
  const reqId = c.get('requestId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb.prepare(
      `UPDATE custom_quote_requests
       SET status = COALESCE(?, status),
           quoted_amount_paise = COALESCE(?, quoted_amount_paise),
           admin_notes = COALESCE(?, admin_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(
        body?.status || null,
        body?.quotedAmountInr !== undefined ? Math.round(Number(body.quotedAmountInr) * 100) : null,
        body?.adminNotes || null,
        id
      )
      .run()
      .catch(() => null);
  }
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Custom quote updated',
      requestId: reqId,
      data: { id, ...body },
    })
  );
});

adminRouter.get('/digital-orders', requirePermission('reports.view'), async (c) => {
  const reqId = c.get('requestId');
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Digital orders endpoint active', requestId: reqId, data: [] }));
  }
  try {
    const res = await billingDb.prepare(`SELECT * FROM digital_product_orders ORDER BY created_at DESC LIMIT 100`).all();
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Digital orders fetched', requestId: reqId, data: res.results || [] }));
  } catch {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Digital orders table pending migration', requestId: reqId, data: [] }));
  }
});

adminRouter.post('/storage/enforce-retention', requirePermission('settings.manage'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!isSuperAdminRole(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Super Admin can trigger R2 document retention sweeps.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const svc = new FileService(c.env);
  const result = await svc.enforceRetention({
    dryRun: Boolean(body?.dryRun),
    limit: typeof body?.limit === 'number' ? body.limit : 25,
    actor: user,
  });

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'STORAGE_RETENTION_SWEEP',
    resourceType: 'r2_storage',
    resourceId: 'dip-official',
    summary: `Retention sweep (dryRun=${result.dryRun}): inspected ${result.inspected}, purged ${result.deleted} (${result.reclaimedBytes} bytes)`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: result.dryRun
        ? `Retention dry-run complete: ${result.inspected} expired file(s) identified`
        : `Retention sweep complete: purged ${result.deleted} expired object(s)`,
      requestId: reqId,
      data: result,
    })
  );
});

// ==========================================
// 8. PAYMENT OPERATIONS, WEBHOOKS, RECONCILIATION & GATEWAY CONFIG
// ==========================================
const requireAdminPaymentAccess = async (c: any, next: () => Promise<void>) => {
  const actor = c.get('user');
  if (!actor || (!isSuperAdminRole(actor.role) && actor.role !== 'manager')) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Restricted to authorized Admin or Operations Manager roles.',
        requestId: c.get('requestId'),
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }
  await next();
};

adminRouter.get('/payments/analytics', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Billing DB unbound',
        requestId: reqId,
        data: {
          totalCollectedInr: 0,
          todayCollectedInr: 0,
          monthCollectedInr: 0,
          totalRefundedInr: 0,
          refundedInr: 0,
          netRevenueInr: 0,
          paidCount: 0,
          successCount: 0,
          failedOrExpiredCount: 0,
          failedCount: 0,
          pendingCount: 0,
          averageTicketInr: 0,
          avgOrderValueInr: 0,
          refundedCount: 0,
          failedWebhooksCount: 0,
          unresolvedRefundsCount: 0,
        },
      })
    );
  }

  const [orderStats, todayStats, monthStats, refundStats, webhookStats] = await Promise.all([
    billingDb
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN total_paise ELSE 0 END), 0) AS total_paid_paise,
           COALESCE(SUM(CASE WHEN status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN 1 ELSE 0 END), 0) AS success_count,
           COALESCE(SUM(CASE WHEN status IN ('FAILED', 'EXPIRED', 'DROPPED', 'CANCELLED') THEN 1 ELSE 0 END), 0) AS failed_count,
           COALESCE(SUM(CASE WHEN status IN ('CREATED', 'PENDING', 'ACTIVE', 'PROCESSING') THEN 1 ELSE 0 END), 0) AS pending_count
         FROM payment_orders
         WHERE id NOT LIKE 'TEST_CF_%'`
      )
      .bind()
      .first<any>()
      .catch(() => ({})),
    billingDb
      .prepare(
        `SELECT COALESCE(SUM(total_paise), 0) AS today_paise
         FROM payment_orders
         WHERE status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
           AND id NOT LIKE 'TEST_CF_%'
           AND date(updated_at) = date('now')`
      )
      .bind()
      .first<any>()
      .catch(() => ({ today_paise: 0 })),
    billingDb
      .prepare(
        `SELECT COALESCE(SUM(total_paise), 0) AS month_paise
         FROM payment_orders
         WHERE status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
           AND id NOT LIKE 'TEST_CF_%'
           AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')`
      )
      .bind()
      .first<any>()
      .catch(() => ({ month_paise: 0 })),
    billingDb
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status IN ('Approved', 'Processed') OR gateway_status = 'SUCCESS' THEN COALESCE(refund_amount_paise, CAST(ROUND(amount * 100) AS INTEGER)) ELSE 0 END), 0) AS refunded_paise,
           COALESCE(SUM(CASE WHEN status IN ('Approved', 'Processed') OR gateway_status = 'SUCCESS' THEN 1 ELSE 0 END), 0) AS refunded_count,
           COALESCE(SUM(CASE WHEN status = 'Pending' OR gateway_status = 'PENDING' OR gateway_status = 'FAILED' THEN 1 ELSE 0 END), 0) AS unresolved_count
         FROM refunds`
      )
      .bind()
      .first<any>()
      .catch(() => ({ refunded_paise: 0, refunded_count: 0, unresolved_count: 0 })),
    billingDb
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN processing_status = 'FAILED' OR signature_verified = 0 THEN 1 ELSE 0 END), 0) AS failed_webhooks
         FROM payment_webhook_events`
      )
      .bind()
      .first<any>()
      .catch(() => ({ failed_webhooks: 0 })),
  ]);

  const totalCollectedInr = fromPaise(Number(orderStats?.total_paid_paise || 0));
  const refundedInr = fromPaise(Number(refundStats?.refunded_paise || 0));
  const successCount = Number(orderStats?.success_count || 0);
  const failedCount = Number(orderStats?.failed_count || 0);
  const avgOrderValueInr = successCount > 0 ? Number((totalCollectedInr / successCount).toFixed(2)) : 0;

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Payment gateway analytics computed',
      requestId: reqId,
      data: {
        totalCollectedInr,
        todayCollectedInr: fromPaise(Number(todayStats?.today_paise || 0)),
        monthCollectedInr: fromPaise(Number(monthStats?.month_paise || 0)),
        totalRefundedInr: refundedInr,
        refundedInr,
        netRevenueInr: Math.max(0, Number((totalCollectedInr - refundedInr).toFixed(2))),
        paidCount: successCount,
        successCount,
        failedOrExpiredCount: failedCount,
        failedCount,
        pendingCount: Number(orderStats?.pending_count || 0),
        averageTicketInr: avgOrderValueInr,
        avgOrderValueInr,
        refundedCount: Number(refundStats?.refunded_count || 0),
        failedWebhooksCount: Number(webhookStats?.failed_webhooks || 0),
        unresolvedRefundsCount: Number(refundStats?.unresolved_count || 0),
      },
    })
  );
});

adminRouter.get('/payments', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const statusFilter = String(c.req.query('status') || '').trim().toUpperCase();
  const search = String(c.req.query('search') || '').trim().toLowerCase();
  const methodFilter = String(c.req.query('method') || '').trim().toLowerCase();
  const dateFrom = String(c.req.query('fromDate') || c.req.query('dateFrom') || '').trim();
  const dateTo = String(c.req.query('toDate') || c.req.query('dateTo') || '').trim();
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') || 25) || 25));

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Billing DB unbound', requestId: reqId, data: { items: [], pagination: { page, pageSize, totalItems: 0, totalPages: 1 } } }));
  }

  const rowsRes = await billingDb
    .prepare(
      `SELECT
         po.id AS order_id, po.cf_order_id, po.application_id, po.user_id, po.service_slug,
         po.customer_name, po.total_paise, po.service_fee_paise, po.govt_fee_paise, po.tax_paise, po.currency,
         po.status AS order_status, po.payment_status_normalized, po.environment, po.last_error,
         po.created_at, po.updated_at,
         p.id AS payment_id, p.cf_payment_id, p.status AS payment_status, p.payment_method,
         p.bank_reference, p.refunded_paise, p.paid_at,
         i.invoice_number
       FROM payment_orders po
       LEFT JOIN payments p ON p.order_id = po.id
       LEFT JOIN invoices i ON i.order_id = po.id
       WHERE po.id NOT LIKE 'TEST_CF_%'
       ORDER BY po.created_at DESC
       LIMIT 250`
    )
    .bind()
    .all<any>()
    .catch(async () =>
      billingDb
        .prepare(
          `SELECT id AS order_id, application_id, user_id, total_paise, currency, status AS order_status, created_at, updated_at
           FROM payment_orders ORDER BY created_at DESC LIMIT 250`
        )
        .bind()
        .all<any>()
    );

  const filtered = (rowsRes.results || []).filter((r: any) => {
    if (statusFilter && statusFilter !== 'ALL') {
      const norm = String(r.payment_status_normalized || normalizeCashfreeLifecycleState(r.order_status)).toUpperCase();
      if (String(r.order_status || '').toUpperCase() !== statusFilter && norm !== statusFilter) {
        return false;
      }
    }
    if (methodFilter && methodFilter !== 'all') {
      if (!String(r.payment_method || 'cashfree').toLowerCase().includes(methodFilter)) {
        return false;
      }
    }
    if (dateFrom && String(r.created_at || '') < dateFrom) return false;
    if (dateTo && String(r.created_at || '') > `${dateTo}T23:59:59`) return false;
    if (search) {
      const hay = `${r.order_id} ${r.cf_payment_id || ''} ${r.application_id} ${r.user_id} ${r.customer_name || ''} ${r.invoice_number || ''} ${r.bank_reference || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize).map((r: any) => {
    const normalized = r.payment_status_normalized || normalizeCashfreeLifecycleState(r.order_status);
    return {
      order_id: r.order_id,
      cf_order_id: r.cf_order_id || undefined,
      application_id: r.application_id,
      user_id: r.user_id,
      customer_name: r.customer_name || 'Applicant',
      service_name: r.service_slug || 'Service Order',
      total_amount_paise: Number(r.total_paise || 0),
      refunded_amount_paise: Number(r.refunded_paise || 0),
      status: r.order_status,
      payment_status_normalized: normalized,
      cf_payment_id: r.cf_payment_id || undefined,
      payment_method: r.payment_method || 'Cashfree PG',
      bank_reference: r.bank_reference || undefined,
      invoice_number: r.invoice_number || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
      orderId: r.order_id,
      cfOrderId: r.cf_order_id || undefined,
      applicationId: r.application_id,
      userId: r.user_id,
      serviceSlug: r.service_slug || undefined,
      amountInr: fromPaise(Number(r.total_paise || 0)),
      refundedInr: fromPaise(Number(r.refunded_paise || 0)),
      currency: r.currency || 'INR',
      orderStatus: r.order_status,
      normalizedState: normalized,
      paymentId: r.payment_id || undefined,
      cfPaymentId: r.cf_payment_id || undefined,
      paymentMethod: r.payment_method || 'Cashfree PG',
      bankReference: r.bank_reference || undefined,
      invoiceNumber: r.invoice_number || undefined,
      environment: r.environment || 'sandbox',
      lastError: r.last_error || undefined,
      paidAt: r.paid_at || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${items.length} payment transaction(s)`,
      requestId: reqId,
      data: {
        items,
        pagination: { page: safePage, pageSize, totalItems, totalPages },
      },
    })
  );
});

adminRouter.get('/payments/refunds', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Billing DB unbound', requestId: reqId, data: [] }));
  }

  const rows = await billingDb
    .prepare(
      `SELECT r.*, p.order_id AS pay_order_id, p.application_id AS pay_application_id, p.cf_payment_id, p.total_amount
       FROM refunds r
       LEFT JOIN payments p ON p.id = r.payment_id
       ORDER BY r.created_at DESC
       LIMIT 150`
    )
    .bind()
    .all<any>()
    .catch(() => ({ results: [] }));

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${(rows.results || []).length} refund record(s)`,
      requestId: reqId,
      data: (rows.results || []).map((r: any) => ({
        id: r.id,
        refund_id: r.id,
        payment_id: r.payment_id,
        order_id: r.order_id || r.pay_order_id || undefined,
        application_id: r.application_id || r.pay_application_id || undefined,
        cf_payment_id: r.cf_payment_id || undefined,
        cf_refund_id: r.cf_refund_id || undefined,
        refund_amount_paise: r.refund_amount_paise || Math.round(Number(r.amount || 0) * 100),
        gateway_status: r.gateway_status || 'PENDING',
        refund_arn: r.refund_arn || undefined,
        refund_mode: r.refund_mode || undefined,
        paymentId: r.payment_id,
        orderId: r.order_id || r.pay_order_id || undefined,
        applicationId: r.application_id || r.pay_application_id || undefined,
        cfPaymentId: r.cf_payment_id || undefined,
        cfRefundId: r.cf_refund_id || undefined,
        amountInr: r.refund_amount_paise ? fromPaise(r.refund_amount_paise) : Number(r.amount || 0),
        originalPaidInr: Number(r.total_amount || 0),
        reason: r.reason,
        status: r.status,
        gatewayStatus: r.gateway_status || 'PENDING',
        refundArn: r.refund_arn || undefined,
        refundMode: r.refund_mode || undefined,
        processedBy: r.processed_by || undefined,
        processedAt: r.processed_at || undefined,
        createdAt: r.created_at,
      })),
    })
  );
});

adminRouter.get('/payments/webhooks', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const statusFilter = String(c.req.query('processingStatus') || c.req.query('status') || '').trim().toUpperCase();
  const orderIdFilter = String(c.req.query('orderId') || '').trim().toLowerCase();
  const search = String(c.req.query('search') || '').trim().toLowerCase();
  const limit = Math.min(200, Math.max(10, Number(c.req.query('limit') || 150) || 150));
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Billing DB unbound', requestId: reqId, data: [] }));
  }

  const rows = await billingDb
    .prepare(
      `SELECT id, event_id, order_id, event_type, signature_verified, payload_hash,
              payment_id, refund_id, processing_status, event_timestamp, received_at,
              error_message, replay_count, processed_at
       FROM payment_webhook_events
       ORDER BY processed_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<any>()
    .catch(async () =>
      billingDb
        .prepare(`SELECT id, event_id, order_id, event_type, signature_verified, payload_hash, processed_at FROM payment_webhook_events ORDER BY processed_at DESC LIMIT ?`)
        .bind(limit)
        .all<any>()
    );

  const filtered = (rows.results || []).filter((r: any) => {
    const procStatus = String(r.processing_status || (r.signature_verified ? 'PROCESSED' : 'FAILED')).toUpperCase();
    if (statusFilter && statusFilter !== 'ALL' && procStatus !== statusFilter) return false;
    if (orderIdFilter && !String(r.order_id || '').toLowerCase().includes(orderIdFilter)) return false;
    if (search) {
      const hay = `${r.event_id} ${r.order_id} ${r.event_type} ${r.payment_id || ''} ${r.refund_id || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${filtered.length} webhook event(s)`,
      requestId: reqId,
      data: filtered.map((r: any) => {
        const procStatus = r.processing_status || (r.signature_verified ? 'PROCESSED' : 'FAILED');
        return {
          id: r.id,
          event_id: r.event_id,
          order_id: r.order_id,
          event_type: r.event_type,
          signature_verified: Boolean(r.signature_verified),
          processing_status: procStatus,
          processing_error: r.error_message || undefined,
          eventId: r.event_id,
          orderId: r.order_id,
          eventType: r.event_type,
          signatureVerified: Boolean(r.signature_verified),
          processingStatus: procStatus,
          paymentId: r.payment_id || undefined,
          refundId: r.refund_id || undefined,
          eventTimestamp: r.event_timestamp || undefined,
          receivedAt: r.received_at || r.processed_at,
          errorMessage: r.error_message || undefined,
          replayCount: Number(r.replay_count || 0),
        };
      }),
    })
  );
});

adminRouter.post('/payments/webhooks/:eventId/replay', requirePermission('payments.refund'), async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  const eventKey = String(c.req.param('eventId') || '').trim();
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Billing DB unbound', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const row = await billingDb
    .prepare(`SELECT * FROM payment_webhook_events WHERE id = ? OR event_id = ? LIMIT 1`)
    .bind(eventKey, eventKey)
    .first<any>();

  if (!row) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Webhook event not found', requestId: reqId, data: null, errorCode: 'NOT_FOUND' }), 404);
  }

  if (!row.raw_payload_json) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Original webhook payload JSON was not stored for this legacy event',
        requestId: reqId,
        data: null,
        errorCode: 'PAYLOAD_UNAVAILABLE',
      }),
      422
    );
  }

  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(row.raw_payload_json);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Stored payload is invalid JSON', requestId: reqId, data: null, errorCode: 'INVALID_JSON' }), 422);
  }

  const replayRes = await processCashfreeWebhookEvent(c.env, {
    parsed,
    rawBody: row.raw_payload_json,
    timestamp: String(row.event_timestamp || Math.floor(Date.now() / 1000)),
    signatureHashPrefix: `replay_by_${actor.id.slice(0, 12)}`,
    actorId: actor.id,
    ip: c.req.header('cf-connecting-ip'),
    isReplay: true,
    existingEventRowId: row.id,
  });

  await billingDb
    .prepare(
      `UPDATE payment_webhook_events
       SET replay_count = COALESCE(replay_count, 0) + 1,
           processing_status = ?,
           error_message = ?
       WHERE id = ?`
    )
    .bind(replayRes.ok ? 'PROCESSED' : 'FAILED', replayRes.ok ? null : replayRes.message, row.id)
    .run()
    .catch(() => null);

  await recordAuditEvent(c.env, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'CASHFREE_WEBHOOK_REPLAYED',
    resourceType: 'payment_webhook_events',
    resourceId: row.event_id,
    summary: `Replayed webhook ${row.event_id} (order ${row.order_id}): ${replayRes.resolvedOrderStatus}`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: replayRes.ok,
      status: replayRes.ok ? 'SUCCESS' : 'FAILED',
      message: `Webhook replayed: ${replayRes.message}`,
      requestId: reqId,
      data: replayRes,
    }),
    replayRes.ok ? 200 : (replayRes.httpStatus as any)
  );
});

adminRouter.post('/payments/reconcile', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const limit = typeof body?.limit === 'number' ? body.limit : 25;

  const summary = await runCashfreeReconciliationSweep(c.env, {
    limit,
    actorId: actor.id,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: summary.gatewayConfigured
        ? `Reconciled ${summary.checkedOrders} order(s): +${summary.reconciledPaid} paid, ~${summary.updatedNonPaid} updated, ${summary.refundsSynced} refund(s) synced`
        : 'Cashfree gateway secret is not configured — reconciliation skipped',
      requestId: reqId,
      data: summary,
    })
  );
});

adminRouter.get('/payments/config', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const cfConfig = await loadEffectiveCashfreeConfig(c.env);
  const maskedClientId = cfConfig.clientId
    ? `${cfConfig.clientId.slice(0, 6)}...${cfConfig.clientId.slice(-4)}`
    : null;

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Cashfree payment gateway configuration readiness loaded',
      requestId: reqId,
      data: {
        mode: cfConfig.mode,
        environment: cfConfig.mode,
        apiVersion: cfConfig.apiVersion,
        isEnabled: cfConfig.isEnabled,
        autoVerify: cfConfig.autoVerify,
        orderExpiryMinutes: cfConfig.expiryMinutes,
        expiryMinutes: cfConfig.expiryMinutes,
        retryAttempts: cfConfig.retryMaxAttempts,
        retryMaxAttempts: cfConfig.retryMaxAttempts,
        timeoutMs: cfConfig.timeoutMs,
        configured: cfConfig.configured,
        clientIdConfigured: cfConfig.clientIdConfigured,
        clientIdMasked: maskedClientId,
        clientIdPreview: maskedClientId || 'Not Set',
        clientSecretConfigured: cfConfig.clientSecretConfigured,
        webhookSecretConfigured: cfConfig.webhookSecretConfigured,
        missingBindings: cfConfig.missingBindings,
        webhookUrl: `${cfConfig.appDomain}/api/webhooks/cashfree`,
        legacyWebhookUrl: `${cfConfig.appDomain}/api/v1/payments/webhook`,
        returnUrlTemplate: `${cfConfig.appDomain}/?cf_order_id={order_id}`,
        defaultReturnUrl: `${cfConfig.appDomain}/?cf_order_id={order_id}`,
        emailAlertsConfigured: Boolean(c.env.RESEND_API_KEY),
        paymentsEmail: c.env.PAYMENTS_EMAIL || c.env.BUSINESS_EMAIL || 'payments@digitalindiaproject.com',
      },
    })
  );
});

adminRouter.put('/payments/config', requirePermission('integrations.manage'), async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  if (!isSuperAdminRole(actor.role) && actor.role !== 'admin') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Super Admin or Admin can update Cashfree gateway configuration.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawMode = body?.mode || body?.environment;
  const environment = rawMode === 'production' ? 'production' : 'sandbox';
  const apiVersion =
    typeof body?.apiVersion === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.apiVersion.trim())
      ? body.apiVersion.trim()
      : '2023-08-01';
  const isEnabled = body?.isEnabled === undefined ? true : Boolean(body.isEnabled);
  const autoVerify = body?.autoVerify === undefined ? true : Boolean(body.autoVerify);
  const expiryMinutes = Math.min(
    4320,
    Math.max(15, Number(body?.orderExpiryMinutes ?? body?.expiryMinutes ?? 30) || 30)
  );
  const retryMaxAttempts = Math.min(
    5,
    Math.max(1, Number(body?.retryAttempts ?? body?.retryMaxAttempts ?? 2) || 2)
  );
  const timeoutMs = Math.min(25000, Math.max(3000, Number(body?.timeoutMs || 12000) || 12000));

  const publicConfigJson = JSON.stringify({
    apiVersion,
    autoVerify,
    expiryMinutes,
    retryMaxAttempts,
    timeoutMs,
  });

  const { db: intDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_integrations');
  if (intDb) {
    await intDb
      .prepare(
        `INSERT INTO api_integrations (id, code, name, environment, is_enabled, public_config_json, updated_by, updated_at)
         VALUES ('int_cashfree', 'cashfree', 'Cashfree Payment Gateway', ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(code) DO UPDATE SET
           environment = excluded.environment,
           is_enabled = excluded.is_enabled,
           public_config_json = excluded.public_config_json,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(environment, isEnabled ? 1 : 0, publicConfigJson, actor.id)
      .run();
  }

  await recordAuditEvent(c.env, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'CASHFREE_CONFIG_UPDATED',
    resourceType: 'api_integrations',
    resourceId: 'cashfree',
    summary: `Updated Cashfree gateway config: env=${environment}, apiVersion=${apiVersion}, enabled=${isEnabled}, expiry=${expiryMinutes}m`,
    ip: c.req.header('cf-connecting-ip'),
  });

  const updated = await loadEffectiveCashfreeConfig(c.env);
  const maskedClientId = updated.clientId
    ? `${updated.clientId.slice(0, 6)}...${updated.clientId.slice(-4)}`
    : null;
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Cashfree gateway settings saved (secrets remain strictly managed via Worker Secrets)',
      requestId: reqId,
      data: {
        mode: updated.mode,
        environment: updated.mode,
        apiVersion: updated.apiVersion,
        isEnabled: updated.isEnabled,
        autoVerify: updated.autoVerify,
        orderExpiryMinutes: updated.expiryMinutes,
        expiryMinutes: updated.expiryMinutes,
        retryAttempts: updated.retryMaxAttempts,
        retryMaxAttempts: updated.retryMaxAttempts,
        timeoutMs: updated.timeoutMs,
        configured: updated.configured,
        clientIdConfigured: updated.clientIdConfigured,
        clientIdMasked: maskedClientId,
        clientSecretConfigured: updated.clientSecretConfigured,
        webhookSecretConfigured: updated.webhookSecretConfigured,
        webhookUrl: `${updated.appDomain}/api/webhooks/cashfree`,
        returnUrlTemplate: `${updated.appDomain}/?cf_order_id={order_id}`,
        paymentsEmail: c.env.PAYMENTS_EMAIL || c.env.BUSINESS_EMAIL || 'payments@digitalindiaproject.com',
      },
    })
  );
});

adminRouter.post('/payments/cutover-check', requireAdminPaymentAccess, async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  const cfConfig = await loadEffectiveCashfreeConfig(c.env);

  // 1. Live Cashfree API credential probe (non-mutating GET on nonexistent order ID)
  const probe = await probeCashfreeGatewayCredentials(cfConfig);

  // 2. D1 dip_billing schema & migration 0008 column verification
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  let d1Status: 'pass' | 'warn' | 'fail' = 'warn';
  let d1Detail = 'dip_billing D1 binding unavailable in local runtime (using local store).';
  if (billingDb) {
    try {
      const checksToVerify: Array<[string, string[]]> = [
        ['payment_orders', ['cf_order_id', 'payment_status_normalized', 'retry_of_order_id']],
        ['payments', ['bank_reference', 'refunded_paise', 'gateway_response_json']],
        ['payment_webhook_events', ['processing_status', 'raw_payload_json', 'replay_count']],
        ['refunds', ['cf_refund_id', 'refund_amount_paise', 'refund_arn']],
      ];
      const missingCols: string[] = [];
      for (const [tbl, expectedCols] of checksToVerify) {
        const info = await billingDb.prepare(`PRAGMA table_info(${tbl})`).all<{ name: string }>();
        const colSet = new Set((info.results || []).map((r) => String(r.name || '').toLowerCase()));
        for (const col of expectedCols) {
          if (!colSet.has(col)) missingCols.push(`${tbl}.${col}`);
        }
      }
      if (missingCols.length === 0) {
        d1Status = 'pass';
        d1Detail = 'dip_billing connected with all 0008_cashfree_payment_ecosystem schema columns verified.';
      } else {
        d1Status = 'fail';
        d1Detail = `Missing 0008 billing columns: ${missingCols.join(', ')}. Run npm run d1:migrate:remote.`;
      }
    } catch (err: any) {
      d1Status = 'fail';
      d1Detail = err?.message || 'Unable to inspect dip_billing D1 tables.';
    }
  }

  // 3. HMAC-SHA256 webhook signature & timestamp anti-replay self-test (in-memory only)
  let hmacStatus: 'pass' | 'warn' | 'fail' = 'warn';
  let hmacDetail = 'Webhook verification uses ephemeral self-test key until CASHFREE_CLIENT_SECRET is bound.';
  const testSecret = cfConfig.webhookSecret || cfConfig.clientSecret || 'dip_cutover_selftest_key';
  const ts = String(Math.floor(Date.now() / 1000));
  const samplePayload = JSON.stringify({ type: 'PING', event_time: new Date().toISOString() });
  const testSig = await hmacSha256Base64(testSecret, `${ts}${samplePayload}`);
  const sigVerified = await verifyCashfreeWebhookWithAnySecret([testSecret], ts, samplePayload, testSig);
  const tsCheck = validateWebhookTimestamp(ts, { enforce: true });

  if (!sigVerified.valid || !tsCheck.valid) {
    hmacStatus = 'fail';
    hmacDetail = 'HMAC-SHA256 webhook signature or anti-replay timestamp verification self-test failed.';
  } else if (cfConfig.webhookSecretConfigured || cfConfig.clientSecretConfigured) {
    hmacStatus = 'pass';
    hmacDetail = cfConfig.webhookSecret
      ? 'HMAC-SHA256 webhook signature & anti-replay check verified using bound secret.'
      : 'HMAC-SHA256 webhook signature & anti-replay verified (using CASHFREE_CLIENT_SECRET fallback).';
  }

  const emailConfigured = Boolean(c.env.RESEND_API_KEY);
  const items: Array<{
    key: string;
    label: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
  }> = [
    {
      key: 'secret_binding',
      label: 'Worker Secret Binding (CASHFREE_CLIENT_ID & CASHFREE_CLIENT_SECRET)',
      status: cfConfig.configured ? 'pass' : 'fail',
      detail: cfConfig.configured
        ? `Configured for ${cfConfig.mode.toUpperCase()} mode (${cfConfig.apiVersion}).`
        : `Missing: ${cfConfig.missingBindings.join(', ')}. Run \`npx wrangler secret put CASHFREE_CLIENT_SECRET\`.`,
    },
    {
      key: 'gateway_auth_probe',
      label: 'Cashfree REST API Credential Authentication',
      status: !cfConfig.configured ? 'fail' : probe.authenticated ? 'pass' : 'fail',
      detail: probe.message,
    },
    {
      key: 'd1_billing_schema',
      label: 'Cloudflare D1 Billing Ledger (0008 Schema)',
      status: d1Status,
      detail: d1Detail,
    },
    {
      key: 'webhook_hmac_selftest',
      label: 'Webhook Endpoint HMAC-SHA256 & Anti-Replay Self-Test',
      status: hmacStatus,
      detail: hmacDetail,
    },
    {
      key: 'email_alerts_channel',
      label: 'Transactional Payment Alerts (Resend Email)',
      status: emailConfigured ? 'pass' : 'warn',
      detail: emailConfigured
        ? `Resend active (${c.env.PAYMENTS_EMAIL || c.env.BUSINESS_EMAIL || 'payments@digitalindiaproject.com'}).`
        : 'RESEND_API_KEY not bound — in-app alerts work; bind RESEND_API_KEY for email receipts.',
    },
  ];

  const readyForProduction =
    cfConfig.mode === 'production' &&
    cfConfig.isEnabled &&
    cfConfig.configured &&
    probe.authenticated &&
    d1Status !== 'fail' &&
    hmacStatus === 'pass';

  await recordAuditEvent(c.env, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'CASHFREE_CUTOVER_DIAGNOSTICS_RUN',
    resourceType: 'api_integrations',
    resourceId: 'cashfree',
    summary: `Cutover diagnostics run (mode=${cfConfig.mode}, ready=${readyForProduction}, auth=${probe.authenticated})`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: readyForProduction
        ? 'Production Cashfree gateway and D1 billing checks passed.'
        : 'Cutover diagnostics completed — review pending action items below.',
      requestId: reqId,
      data: {
        readyForProduction,
        mode: cfConfig.mode,
        apiVersion: cfConfig.apiVersion,
        isEnabled: cfConfig.isEnabled,
        checkedAt: new Date().toISOString(),
        probe,
        checks: items,
        webhookSetup: {
          url: `${cfConfig.appDomain}/api/webhooks/cashfree`,
          legacyUrl: `${cfConfig.appDomain}/api/v1/payments/webhook`,
          events: [
            'PAYMENT_SUCCESS_WEBHOOK',
            'PAYMENT_FAILED_WEBHOOK',
            'PAYMENT_USER_DROPPED_WEBHOOK',
            'REFUND_STATUS_WEBHOOK',
          ],
        },
        cliCommands: {
          setSecret: 'npx wrangler secret put CASHFREE_CLIENT_SECRET',
          migrateD1: 'npm run d1:migrate:remote',
          deployWorker: 'npx wrangler deploy --env="" --keep-vars',
        },
      },
    })
  );
});




