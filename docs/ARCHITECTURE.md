# Digital India Project 2.0 — System Architecture

## 1. High-Level Multi-Runtime Architecture

```
+-----------------------------------------------------------------------+
|                        CLIENT SPA (React 19 + Vite)                   |
|  Public Site · Customer · Operator · Manager · Partner · Super Admin  |
|  Shared Engines (src/lib/): RBAC · Workflow · FormEngine · Finance    |
+-------------------+-----------------------------------+---------------+
                    |                                   |
        Firebase Auth + Firestore             HTTPS /api/v1/* (REST)
        (Real-time Sync & Auth)              (Cloudflare Worker / Express)
                    |                                   |
                    v                                   v
+----------------------------------+   +--------------------------------+
|  Google Firebase Platform        |   | Hono Worker (worker/index.ts)  |
|  - Firebase Auth (Google/Email)  |   | - Auth & RBAC Middleware       |
|  - Cloud Firestore (RBAC Rules)  |   | - Zod/Schema Request Validator |
|  - Real-time Snapshot Streams    |   | - Signed Document Token URLs   |
+----------------------------------+   | - Cashfree Webhook Idempotency |
                                       +--------+--------------+--------+
                                                |              |
                                                v              v
                                       +----------------+ +-------------+
                                       | Cloudflare D1  | | Cloudflare  |
                                       | (DB binding)   | | R2 Storage  |
                                       | Normalized SQL | | (Private)   |
                                       +----------------+ +-------------+
```

## 2. Core Architectural Principles

1. **Single Application & Form Engine:** Customer self-filing (`web_b2c`), Operator walk-in (`operator_assisted`), Partner referral/assisted filing (`partner_assisted`), and B2B filings (`b2b_portal`) all execute through the exact same versioned service schema, validation rules, workflow state machine, payment verification, and audit logging.
2. **Centralized Isomorphic Business Logic (`src/lib/`):**
   - `src/lib/rbac.ts`: 5 roles (`super_admin`, `manager`, `operator`, `customer`, `partner`), 22 granular permissions, ownership & scope helpers.
   - `src/lib/workflow.ts`: 14 canonical statuses, transition rules, SLA calculations, dual-remark isolation (customer-visible vs internal staff notes).
   - `src/lib/formEngine.ts`: 16-field-type JSON schema evaluator supporting conditional logic (`showIf`), repeatable groups, document dependency rules, bilingual EN/HI labels, and safe zero-eval validation.
   - `src/lib/finance.ts`: Integer paise currency arithmetic, GST/tax breakdown, deterministic idempotent partner commission calculation, and threshold checks.
3. **Dual Persistence Support:**
   - Immediate real-time persistence & RBAC enforcement via Firebase Auth + Firestore (`firestore.rules`) across AI Studio & Cloudflare edge clients.
   - Full normalized relational schema & modular Hono REST `/api/v1/*` repository layer (`worker/services/store.ts` + `worker/routes/v1.ts`) ready for Cloudflare D1 (`DB`) & private R2 (`DOCUMENTS_BUCKET`).
4. **No Hardcoded Credentials or Tax Identifiers:** GSTIN, invoice prefix, business address, Cashfree keys, DigiLocker credentials, and messaging providers are stored in configurable admin settings / Cloudflare Secrets.
