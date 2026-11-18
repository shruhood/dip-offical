# Digital India Project 2.0 — Role & Permission Matrix

## 1. Primary Roles (5 Core Roles + Enterprise B2B Compatibility)

| Role Code | Route Prefix | Description |
| :--- | :--- | :--- |
| `super_admin` (alias `admin`) | `/admin` | Owner-level authority with global platform, financial, RBAC, and integration control. |
| `manager` | `/manager` | Operational lead with permissions delegated per scope by Super Admin (no global security/secret settings by default). |
| `operator` | `/operator` | Verified KYC operations staff processing assigned and authorized queue applications. |
| `partner` | `/partner` | Approved agent/partner managing referred customers, assisted filings, commissions, and payout requests. |
| `customer` (+ `business` B2B) | `/dashboard` (`/b2b`) | Self-service citizen or business applicant with isolated access to their own dossiers, drafts, documents, and invoices. |

## 2. Granular Permission Matrix

| Permission Key | `super_admin` | `manager` (Default) | `operator` | `partner` | `customer` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `applications.view` | All | All in scope | Assigned / Queue | Partner-owned | Own only |
| `applications.create` | Yes | Yes | Assisted Desk | Partner Assisted | Own Self-Filing |
| `applications.assign` | Yes | Yes | No | No | No |
| `applications.process` | Yes | Yes | Assigned only | No | No |
| `applications.verify_documents` | Yes | Oversight | Assigned only | No | No |
| `applications.request_correction` | Yes | Yes | Assigned only | Resubmit for client | Respond / Resubmit |
| `applications.complete` | Yes | Yes | Assigned only | No | No |
| `applications.cancel` | Yes | Delegated | No | No | Draft/Submitted only |
| `services.create` | Yes | Delegated (off) | No | No | No |
| `services.edit` | Yes | Delegated (off) | No | No | No |
| `services.publish` | Yes | No | No | No | No |
| `users.manage` | Yes | Read/Support | No | Own Customers | Own Profile |
| `operators.assign` | Yes | Yes | No | No | No |
| `partners.manage` | Yes | Monitoring only | No | Own Profile | No |
| `payments.view` | All | Reports in scope | Receipt status | Own commissions | Own payments |
| `payments.refund` | Yes | No | No | No | Request only |
| `commissions.manage` | Yes | Reports only | No | Read own ledger | No |
| `reports.view` | Full Financial | Operational | Personal stats | Partner performance | No |
| `settings.manage` | Yes | No | No | No | No |
| `audit_logs.view` | Yes | No | No | No | No |
| `rbac.manage` | Yes | No | No | No | No |
| `integrations.manage` | Yes | No | No | No | No |

All permissions are configurable at runtime by Super Admin in Role & Permission Management and verified server-side on Hono middleware and Firestore Security Rules.
