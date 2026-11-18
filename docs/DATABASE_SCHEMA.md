# Database Schema & 10-Domain Registry — Digital India Project

**Managed by:** `worker/config/database.ts` (`DatabaseRegistry`)  
**Bound Physical D1 Databases (10 / 10 Free-Plan Maximum):** `DB` (`dip-official`), `DB_WORKFLOW` (`dip-workflow`), `DB_PARTNERS` (`dip-partners`), `DB_CONTENT` (`dip-content`), `DB_API` (`dip-api`), `DB_BILLING` (`dip-billing`), `DB_AUDIT` (`dip-audit`), `DB_SERVICES` (`dip-services`), `DB_INTEGRATIONS` (`dip-integrations`), `DB_ANALYTICS` (`dip-analytics`)

---

## 1. Version-Controlled SQL Migrations

| Migration File | Scope |
|---|---|
| `migrations/0001_initial_schema.sql` | Core users, categories, services, applications, documents, status history, payments, tickets, audit logs, system settings |
| `migrations/0002_apisetu_and_b2b_schema.sql` | B2B businesses, members, API Setu providers, API catalogue, consents, verification requests, bulk jobs, redacted API logs |
| `migrations/0003_enterprise_platform_2_0.sql` | Role permissions, manager scopes, partners, commission rules & ledger, settlements, refunds, notifications, bilingual templates |
| `migrations/0004_central_platform_and_blog.sql` | `schema_migrations`, `file_registry`, `blog_posts`, `blog_post_revisions`, `operator_enrollments`, `backup_records`, `infra_resource_events` |

---

## 2. 10-Database Ownership Matrix (Free-Plan Max 10 DBs)

| Slot | Logical Name | Physical Binding (`database_name`) | Owned Tables | Primary Owner Role(s) |
|---|---|---|---|---|
| 1 | `dip_core` | `DB` (`dip-official`) | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `manager_scopes`, `user_sessions`, `business_settings`, `system_settings`, `website_settings` | `super_admin`, `admin`, `manager` |
| 2 | `dip_workflow` | `DB_WORKFLOW` (`dip-workflow`) | `applications`, `application_answers`, `application_events`, `application_assignments`, `application_notes`, `application_documents`, `application_status_history`, `workflow_transitions`, `document_reviews`, `notifications`, `notification_templates`, `support_tickets`, `support_messages`, `file_registry` | `admin`, `manager`, `operator`, `customer` |
| 3 | `dip_partners` | `DB_PARTNERS` (`dip-partners`) | `partners`, `referral_codes`, `partner_customers`, `commission_rules`, `operator_enrollments` | `admin`, `manager`, `partner`, `operator` |
| 4 | `dip_content` | `DB_CONTENT` (`dip-content`) | `blog_posts`, `blog_post_revisions`, `faqs`, `knowledge_base` | `admin`, `manager`, `public_read` |
| 5 | `dip_api` | `DB_API` (`dip-api`) | `businesses`, `business_members`, `api_providers`, `api_catalogue`, `user_consents`, `verification_requests`, `bulk_jobs`, `api_request_logs` | `admin`, `business`, `partner` |
| 6 | `dip_billing` | `DB_BILLING` (`dip-billing`) | `payments`, `payment_orders`, `payment_webhook_events`, `invoices`, `coupons`, `refunds`, `commission_ledger`, `settlement_requests`, `settlements` | `admin`, `partner`, `customer`, `business` |
| 7 | `dip_audit` | `DB_AUDIT` (`dip-audit`) | `audit_logs`, `admin_activity_logs`, `audit_events`, `document_access_logs`, `backup_records`, `infra_resource_events`, `schema_migrations` | `super_admin`, `admin` |
| 8 | `dip_services` | `DB_SERVICES` (`dip-services`) | `service_categories`, `services`, `service_versions`, `service_pricing`, `service_forms`, `form_fields`, `form_schemas`, `form_versions`, `document_requirements` | `admin`, `public_read` |
| 9 | `dip_integrations` | `DB_INTEGRATIONS` (`dip-integrations`) | `api_integrations`, `idempotency_keys`, `background_jobs`, `scheduled_jobs` | `super_admin`, `admin` |
| 10 | `dip_analytics` | `DB_ANALYTICS` (`dip-analytics`) | Operational aggregate queries across `applications`, `payments`, `verification_requests`, `api_request_logs`, `file_registry` | `admin`, `manager`, `partner`, `business` |

---

## 3. Binary Data Prohibition

- **No binary blobs in D1.** Customer PDFs, KYC images, generated receipts, backups, and blog media are stored exclusively in Cloudflare R2 (`worker/services/fileService.ts`).
- `file_registry` stores metadata only (`id`, `logical_bucket`, `object_key`, `original_filename`, `mime_type`, `file_size`, `uploaded_by`, `customer_id`, `application_id`, `document_category`, `verification_status`, `access_classification`, `sha256_checksum`, `created_at`).
