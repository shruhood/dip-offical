# Digital India Project 2.0 — Project Audit Report

**Date:** 2026-11-13  
**Domain:** `https://digitalindiaproject.com`  
**Stack Inspected:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Firebase Auth/Firestore + Express (`server.ts`) + Hono Cloudflare Worker (`worker/index.ts`) + Cloudflare D1 + R2

---

## 1. Repository & Infrastructure Verification

### Verified Active Configuration (`wrangler.toml`)
- **Worker Name:** `digitalindiaproject` (`main = "worker/index.ts"`, `compatibility_date = "2025-05-01"`, `nodejs_compat`)
- **D1 Bindings (10 / 10 Free Plan Limit):** `DB` (`dip-official`), `DB_WORKFLOW` (`dip-workflow`), `DB_PARTNERS` (`dip-partners`), `DB_CONTENT` (`dip-content`), `DB_API` (`dip-api`), `DB_BILLING` (`dip-billing`), `DB_AUDIT` (`dip-audit`), `DB_SERVICES` (`dip-services`), `DB_INTEGRATIONS` (`dip-integrations`), `DB_ANALYTICS` (`dip-analytics`) — `migrations_dir = "migrations"` (auto-provisioned/bound by name via Wrangler 4)
- **R2 Bindings (10 Buckets):** `DOCUMENTS_BUCKET` (`dip-official`), `PUBLIC_ASSETS_BUCKET` (`dip-public-assets`), `GENERATED_FILES_BUCKET` (`dip-generated-files`), `BACKUPS_BUCKET` (`dip-backups`), `API_STORAGE_BUCKET` (`dip-api-storage`), `CUSTOMER_UPLOADS_BUCKET` (`dip-customer-uploads`), `PARTNER_FILES_BUCKET` (`dip-partner-files`), `API_ARCHIVES_BUCKET` (`dip-api-archives`), `MEDIA_LIBRARY_BUCKET` (`dip-media-library`), `EXPORT_REPORTS_BUCKET` (`dip-export-reports`)
- **Assets Binding:** `ASSETS` (`directory = "./dist"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*", "/__/auth/*", "/__/firebase/*", "/robots.txt", "/sitemap.xml"]`)
- **Note on Historical Bindings:** `DB` (`dip-official`) and `DOCUMENTS_BUCKET` (`dip-official`) are preserved as primary bindings while adding the 9 remaining domain D1 databases and 9 R2 buckets within Cloudflare Free Plan limits.

### Verified Firebase Configuration (`firebase-applet-config.json`)
- **Project ID:** `gen-lang-client-0294214396`
- **Firestore Database ID:** `ai-studio-digitalindiaproj-180a918f-2fe4-4760-acaa-188e54a6b013`
- **Bootstrapped Super Admin Email:** `allindiadigitalseva@gmail.com`

---

## 2. Audit Findings

### What Currently Works
1. **Build & Deployment Pipeline:** `npm run lint`, `npm run build`, `npm run build:pages`, and `.github/workflows/deploy.yml` compile cleanly with multi-platform `package-lock.json`.
2. **Public Website & Navigation:** Responsive header (`Header.tsx`), bilingual EN/HI context (`LanguageContext.tsx`), hero search, service catalog browsing, service detail pages, exact-ID application tracking (`TrackPage.tsx`), legal pages, and statutory private-business disclosures (`Footer.tsx`).
3. **Authentication & Security Hardening (Firebase):** Google OAuth + Email/Password Firebase auth, strict per-user scoping in `CustomerDashboard`, `firestore.rules` with validation blueprints and PII-isolated `/tracking_records`.
4. **Core Catalog & Operator KYC:** Dynamic service creation in Admin (`createOrUpdateService`), Operator KYC enrollment (`OperatorEnrollmentPage`), and multi-channel application collection (`web_b2c`, `b2b_portal`, `operator_assisted`, `google_forms`, `admin_manual`).

### What Was Incomplete or Missing
1. **Missing 2 of 5 Primary Roles:** `manager` (`/manager`) and `partner` (`/partner`) workspaces, partner referral attribution, commission engine, commission ledger, and settlement approval workflow do not exist yet.
2. **No Granular Centralized RBAC Matrix:** Roles are checked ad-hoc in frontend JSX rather than through a central 22+ permission matrix configurable by Super Admin and enforced by Hono backend middleware.
3. **Limited Dynamic Form Builder:** Current `ServiceFormField` only supports 10 flat types (`text..file`) without conditional visibility (`showIf`), repeating field groups (`repeater`), `multiselect`, `address`, `heading`, `info`, `consent`, schema versioning, or draft/resume state synced cleanly.
4. **Non-Validated Workflow Status Jumps:** Any operator/admin status update accepts arbitrary strings without server-side transition rules, SLA targets, or standardized 14-stage workflow enforcement.
5. **Thin Backend Worker (`worker/index.ts`):** Only implements `/api/health`, `/api/gemini/assistant`, mock `/api/payments/*`, and stubbed API Setu / DigiLocker endpoints. It does not yet persist/query D1 (`c.env.DB`), manage R2 signed document access (`c.env.DOCUMENTS_BUCKET`), verify Cashfree webhooks idempotently, or enforce RBAC.
6. **Missing Enterprise Modules:** Refunds, GST-configurable Invoices, Notification Templates (EN/HI) + Delivery Logs, Configurable Business Settings (without hardcoded tax/GSTIN values), Audit Logs UI, and Light/Dark theme switch.

### Security Issues Identified & Mitigation Plan
- **Issue 1:** Client-side simulated Cashfree modal immediately triggers `onPaymentSuccess` without verifying server webhook or server order state. **Mitigation:** Implement server-side payment order verification, Cashfree HMAC-SHA256 webhook verification with `payment_webhook_events` deduplication, and explicit `Payment Pending` -> `Payment Confirmed` transitions.
- **Issue 2:** R2 document management lacks private upload validation, unpredictable object keys, MIME/magic-byte verification, and short-lived HMAC signed URLs. **Mitigation:** Add `/api/v1/documents/*` endpoints enforcing ownership/operator-assignment RBAC, extension/MIME checks, size limits, and `document_access_logs`.
- **Issue 3:** Missing server-side RBAC middleware on Worker `/api/v1/*` routes. **Mitigation:** Implement Hono auth + permission middleware verifying authenticated user tokens and roles from D1 (`users`/`user_roles`/`role_permissions`).

---

## 3. Reusability & Migration Strategy

- **Preserve:** All existing 16+ services, bilingual translations, Firebase Google/Email Auth, Firestore rules, D1 migrations `0001` & `0002`, and `wrangler.toml` bindings.
- **Upgrade Incrementally:** Add `migrations/0003_enterprise_platform_2_0.sql` using purely additive `CREATE TABLE IF NOT EXISTS` statements and `INSERT OR IGNORE` seeds—zero destructive drops or resets.
- **Shared Logic Layer:** Extract RBAC, Workflow State Machine, Dynamic Form Validator, and Commission/Finance math into `src/lib/*` so browser UI, Express local server, Vite preview, and Cloudflare Worker share identical business rules and validation.
