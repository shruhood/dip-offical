# Deployment Guide — GitHub to Cloudflare Workers (`digitalindiaproject.com`)

**Important:** Never enable Workers Paid, Queues, Durable Objects, or chargeable products when deploying this project. Keep everything strictly inside **Cloudflare Free Plan** limits.

---

## 1. Prerequisites in GitHub / Local Machine

Set the following repository secrets in GitHub Settings → Secrets and variables → Actions (used by `.github/workflows/deploy.yml`):
- `CLOUDFLARE_API_TOKEN` (Worker Scripts Edit + D1 Edit + R2 Edit permissions)
- `CLOUDFLARE_ACCOUNT_ID`

Install dependencies and build locally:
```bash
npm install
npm run build
```

---

## 2. Inspect Existing Cloudflare Free-Plan Resources First

Before modifying or adding any binding, verify current account usage:
```bash
npx wrangler whoami
npx wrangler d1 list
npx wrangler r2 bucket list
```
Confirm the 10 D1 databases and 10 R2 buckets defined in `wrangler.toml`:
- D1 (`10/10` Free-Plan limit): `dip-official`, `dip-workflow`, `dip-partners`, `dip-content`, `dip-api`, `dip-billing`, `dip-audit`, `dip-services`, `dip-integrations`, `dip-analytics`
- R2 (`10` buckets): `dip-official`, `dip-public-assets`, `dip-generated-files`, `dip-backups`, `dip-api-storage`, `dip-customer-uploads`, `dip-partner-files`, `dip-api-archives`, `dip-media-library`, `dip-export-reports`

When `npx wrangler deploy --env=""` runs, Wrangler 4 resolves existing resources or auto-provisions any missing D1 database and R2 bucket by name (`database_name` / `bucket_name`).

---

## 3. Apply Additive D1 Migrations Safely (No Resets)

After deploying/provisioning the 10 databases, apply migrations forward across all bound D1 databases without dropping or recreating tables (also executed automatically in `.github/workflows/deploy.yml`):
```bash
npm run d1:migrate:remote
```
Check applied versions on any database:
```bash
npx wrangler d1 execute dip-billing --remote --command "SELECT version, description, applied_at FROM d1_migrations ORDER BY id;"
```

---

## 4. Configure Required Worker Secrets (Free Plan Safe)

```bash
npx wrangler secret put AUTH_SIGNING_SECRET
npx wrangler secret put CASHFREE_CLIENT_SECRET
npx wrangler secret put CASHFREE_WEBHOOK_SECRET
npx wrangler secret put DIGILOCKER_CLIENT_ID
npx wrangler secret put DIGILOCKER_CLIENT_SECRET
npx wrangler secret put API_SETU_API_KEY
npx wrangler secret put RESEND_API_KEY
```

Non-secret vars (`APP_DOMAIN`, `BUSINESS_EMAIL`, `PAYMENTS_EMAIL`, `CASHFREE_CLIENT_ID`, `CASHFREE_API_VERSION`, `CASHFREE_ENV`, `ENVIRONMENT`, `FREE_PLAN_MAX_R2_BYTES`, `FREE_PLAN_MAX_UPLOAD_BYTES`) are tracked cleanly in `wrangler.toml` under `[vars]`.

---

## 5. Deploy to `https://digitalindiaproject.com`

```bash
npx wrangler deploy --env="" --keep-vars
```

### Non-Production Staging Preview
For safe pre-production checks on staging:
```bash
npx wrangler deploy --env staging
```

---

## 6. Post-Deployment & Cashfree Cutover Verification Checklist

1. `GET https://digitalindiaproject.com/api/health` → returns `200 OK` with `physicalDatabasesBound: 10`, `physicalBucketsBound: 10`, `cashfreeConfigured: true`, and `cashfreeClientSecretConfigured: true`
2. `GET https://digitalindiaproject.com/api/webhooks/cashfree` → returns `200 OK` confirming the Cashfree webhook endpoint is active and signature-protected
3. Configure Cashfree Merchant Dashboard → **Developers → Webhooks** URL to `https://digitalindiaproject.com/api/webhooks/cashfree` and enable `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`, and `REFUND_STATUS_WEBHOOK`
4. Sign in as Super Admin (`allindiadigitalseva@gmail.com`) → open **Admin Dashboard → Cloudflare Infra & R2** → click **Run Health Check** to confirm all 10 D1 databases & 10 R2 buckets are **Connected**
5. Open **Admin Dashboard → Payments & Refunds → Gateway Config** → click **Run Live Cutover Check** to verify live Cashfree credential auth, D1 `0008` billing columns, and HMAC-SHA256 webhook verification
6. Visit `https://digitalindiaproject.com/sitemap.xml` and `https://digitalindiaproject.com/robots.txt` to confirm SEO indexing routes respond properly
