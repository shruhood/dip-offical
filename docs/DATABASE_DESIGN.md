# Digital India Project 2.0 — Database Design

## 1. Migration Strategy (Cloudflare D1)

All schema changes are additive and backward-compatible across three explicit migrations:
- `migrations/0001_initial_schema.sql`: Core users, roles, permissions, services, applications, documents, payments, invoices, notifications, support, logs.
- `migrations/0002_apisetu_and_b2b_schema.sql`: Businesses, business_members, api_providers, api_catalogue, user_consents, verification_requests, bulk_jobs, api_request_logs.
- `migrations/0003_enterprise_platform_2_0.sql`: Normalized RBAC, service/form versioning, workflow transition rules, private R2 document governance, partners/referrals/commission ledger/settlements, payment orders & webhook idempotency, configurable business settings, and background/scheduled jobs.

Never reset production D1; always run `wrangler d1 migrations apply dip-official --remote` after staging verification.

## 2. Domain Table Groups (D1)

### Identity & RBAC
- `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `manager_scopes`

### Dynamic Service & Form Engine
- `service_categories`, `services`, `service_versions`, `service_pricing`, `form_schemas`, `form_versions`, `form_fields`

### Application & Workflow Engine
- `applications`, `application_answers`, `application_events`, `application_assignments`, `application_notes`, `workflow_transitions`

### Private Document Governance (R2)
- `application_documents`, `document_requirements`, `document_reviews`, `document_access_logs`

### Partner & Commission Engine
- `partners`, `partner_customers`, `referral_codes`, `commission_rules`, `commission_ledger`, `settlement_requests`, `settlements`

### Financial & Cashfree System (Integer Minor Units - Paise)
- `payment_orders`, `payments`, `payment_webhook_events`, `refunds`, `invoices`

### Communication, Admin & Infrastructure
- `notifications`, `notification_templates`, `support_tickets`, `support_messages`, `business_settings`, `system_settings`, `api_integrations`, `audit_logs`, `idempotency_keys`, `background_jobs`, `scheduled_jobs`

## 3. Firestore Mirror Collections (`firebase-blueprint.json`)
Synchronizes live client-side portals with zero-trust `firestore.rules`:
- `/users/{userId}`
- `/services/{serviceId}`
- `/applications/{applicationId}`
- `/tracking_records/{applicationId}` (PII-isolated exact-ID lookup)
- `/operator_enrollments/{enrollmentId}`
- `/partners/{partnerId}`
- `/commission_ledger/{entryId}`
- `/settlement_requests/{requestId}`
- `/support_tickets/{ticketId}`
- `/notifications/{notificationId}`
- `/business_settings/{settingId}`
- `/role_permissions/{roleId}`
- `/audit_logs/{logId}`
- `/workspace_audits/{auditId}`
