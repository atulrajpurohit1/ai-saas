# AI SaaS Platform — Complete Feature Documentation

> **Document type:** Enterprise product & technical documentation
> **Audience:** Client stakeholders (non-technical) and development team (technical)
> **Source of truth:** This document was produced by direct inspection of the actual source code (`backend/src`, `frontend/src`, `backend/prisma/schema.prisma`) as it exists today. No planned, assumed, or TODO functionality is described as implemented. Every feature below has been verified to have a working UI, API, service, and database layer unless explicitly marked otherwise in its **Current Status**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Implemented Features Summary](#4-implemented-features-summary)
5. [Detailed Feature Documentation](#5-detailed-feature-documentation)
6. [Database Mapping](#6-database-mapping)
7. [API Summary](#7-api-summary)
8. [User Workflows](#8-user-workflows)
9. [Role Permissions](#9-role-permissions)
10. [Security Features](#10-security-features)
11. [Performance Features](#11-performance-features)
12. [Known Limitations](#12-known-limitations)
13. [Future Enhancements (Not Yet Implemented)](#13-future-enhancements-not-yet-implemented)
14. [Glossary](#14-glossary)
15. [Appendix](#15-appendix)

---

## 1. Project Overview

This platform is a **multi-tenant Software-as-a-Service system for security guard services companies**, combining three things in one product:

1. **Field operations management** — scheduling guards, running patrols, logging incidents, and tracking attendance at client sites.
2. **A sales CRM** — capturing leads, running a deal pipeline, generating proposals, and (as of the most recent development phase) AI-assisted prospecting.
3. **AI-assisted decision support** — a shared AI layer (built on Google Gemini) that drafts proposals, scores leads, summarizes risk, answers natural-language questions about the business, and predicts operational problems before they happen.

It is **multi-tenant**: every organization ("tenant") that signs up gets its own isolated data space, its own admin users, its own guards, its own clients, and its own configurable role/permission structure. A single tenant can also be split into multiple **branches** (regional offices), with branch-scoped visibility for non-super-admin staff.

Three distinct user populations are served by three separate authenticated experiences:

| User | Portal | Purpose |
|---|---|---|
| **Admin / office staff** | Main application | Everything: CRM, scheduling, finance, AI tools, settings |
| **Field guards** | Guard Portal (`/guard/*`) | View assigned shifts, check in/out, run patrols, file incidents — works offline |
| **The tenant's own clients** | Client Portal (`/client/*`) | View/approve proposals, view invoices (and dispute them), view approved incident reports, view published daily reports, download shared documents |

**[Insert Screenshot Here]**

---

## 2. System Architecture Overview

```
                              ┌─────────────────────────────┐
                              │        Next.js Frontend      │
                              │   (App Router, React 19)     │
                              │                               │
                              │  Admin App │ Client Portal │  │
                              │            │ Guard Portal  │  │
                              └───────────────┬───────────────┘
                                              │  REST (JWT bearer)
                                              ▼
                              ┌─────────────────────────────┐
                              │        NestJS Backend        │
                              │                               │
                              │  Controllers → Services       │
                              │  Guards (JWT / Permission /   │
                              │  Roles) → DTO Validation      │
                              └───────────────┬───────────────┘
                                              │  Prisma ORM
                                              ▼
                              ┌─────────────────────────────┐
                              │   PostgreSQL (multi-tenant)  │
                              │   59 Prisma models, every    │
                              │   tenant-scoped table carries │
                              │   a tenantId column           │
                              └─────────────────────────────┘
                                              ▲
                                              │
                              ┌───────────────┴───────────────┐
                              │     External Integrations      │
                              │  Google Gemini (AI)             │
                              │  OpenAI Whisper (transcription) │
                              │  HubSpot (CRM contact import)   │
                              │  SMTP (email)                   │
                              │  Outbound Webhooks              │
                              └─────────────────────────────────┘
```

**Backend** is organized as ~55 independent NestJS modules under `backend/src/`, each following the same pattern: a `*.controller.ts` (HTTP routes + guards + permission checks), a `*.service.ts` (business logic + Prisma queries), and DTOs (`class-validator`-based request validation). Every tenant-scoped query filters explicitly by `tenantId` — there is no database-level row-security; isolation is enforced in application code consistently across the codebase.

**Frontend** is a single Next.js application that serves three different experiences from one codebase, distinguished by route prefix (`/`, `/client/*`, `/guard/*`) and by which JWT/localStorage token is active for that route.

**AI layer**: one shared service (`AiService`, wrapping Google Gemini) is injected into every AI-flavored feature rather than each feature having its own model client. Every Gemini-backed capability has an explicit, hand-written fallback behavior for when the AI is unavailable — described in detail in [Section 5.4](#54-ai-features).

**[Insert Screenshot Here]**

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend framework | NestJS 11 (Node.js), TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Authentication | JWT (access + refresh tokens), Passport.js |
| AI provider | Google Gemini (`@google/generative-ai`) — primary/shared LLM |
| Audio transcription | OpenAI Whisper API (`openai` SDK) — transcription only, not chat |
| Email | Nodemailer (SMTP, or Ethereal for local development) |
| PDF generation | PDFKit |
| CSV parsing/generation | `csv-parser`, `fast-csv` |
| File/document links | URL-reference model (no built-in object storage) |
| CRM integration | HubSpot OAuth (contacts import only) |

---

## 4. Implemented Features Summary

Every row below links to its full write-up in [Section 5](#5-detailed-feature-documentation). **Status** reflects real verification of UI + API + service + database wiring, not assumption.

### 4.1 Authentication, Authorization & Security
*(full detail: [`docs/features/01-authentication-security.md`](features/01-authentication-security.md))*

| # | Feature | Status |
|---|---|---|
| 1 | Admin Authentication (JWT) | ✅ Fully Implemented |
| 2 | Client Portal Authentication | 🟡 Partially Implemented |
| 3 | Guard Portal Authentication | 🟡 Partially Implemented |
| 4 | Single Sign-On (SSO) | 🟡 Partially Implemented |
| 5 | Role-Based Access Control (RBAC) | ✅ Fully Implemented |
| 6 | Field-Level Permissions | ✅ Fully Implemented |
| 7 | Session Management | 🟡 Partially Implemented |
| 8 | Audit Logging | ✅ Fully Implemented (basic) |

### 4.2 Core CRM
*(full detail: [`docs/features/02-crm-core.md`](features/02-crm-core.md))*

| # | Feature | Status |
|---|---|---|
| 9 | Lead Management | ✅ Fully Implemented |
| 10 | Deal / Pipeline Management | 🟡 Partially Implemented |
| 11 | Proposal Management | ✅ Fully Implemented |
| 12 | Notes | ✅ Fully Implemented |
| 13 | Activities | 🔴 Limited Implementation (backend only) |
| 14 | Client Management | ✅ Fully Implemented |

### 4.3 Sales Tools
*(full detail: [`docs/features/03-sales-tools.md`](features/03-sales-tools.md))*

| # | Feature | Status |
|---|---|---|
| 15 | Sales Accelerator (Discovery & AI Coaching) | ✅ Fully Implemented |
| 16 | Sales Automation | ✅ Fully Implemented |
| 17 | Sales Delivery (Email & Calendar) | ✅ Fully Implemented |
| 18 | Sales Data Import (CSV) | ✅ Fully Implemented |
| 19 | AI Prospect Search | 🟡 Partially Implemented (mock data source) |

### 4.4 AI Features
*(full detail: [`docs/features/04-ai-features.md`](features/04-ai-features.md))*

| # | Feature | Status |
|---|---|---|
| 20 | AI Proposal Drafting | ✅ Fully Implemented |
| 21 | AI Sales Assessment & Lead Scoring | ✅ Fully Implemented |
| 22 | AI Discovery Guide, Outreach & Call Intelligence | ✅ Fully Implemented |
| 23 | AI Copilot (Natural Language Q&A) | ✅ Fully Implemented |
| 24 | AI Business Insights & Recommendations | ✅ Fully Implemented |
| 25 | AI Revenue Intelligence | ✅ Fully Implemented |
| 26 | AI Governance (Prompt Versioning & Safety) | ✅ Fully Implemented |
| 27 | AI Monitoring & Feedback | 🟡 Partially Implemented |
| 28 | AI Predictions | ✅ Fully Implemented (rule-based, not LLM) |
| 29 | AI Actions (Recommendation Workflow) | 🟡 Partially Implemented (no UI) |
| 30 | Knowledge Base & Retrieval | ✅ Fully Implemented (keyword search) |
| 31 | Call Transcription | ✅ Fully Implemented |
| — | AI Command Center / AI Executive Center | 🔴 Not Implemented |

### 4.5 Field Operations
*(full detail: [`docs/features/05-field-operations.md`](features/05-field-operations.md))*

| # | Feature | Status |
|---|---|---|
| 32 | Site Management | ✅ Fully Implemented |
| 33 | Guard Management | ✅ Fully Implemented |
| 34 | Shift Scheduling & Assignment | ✅ Fully Implemented |
| 35 | Assignments Overview | 🟡 Partially Implemented (no dedicated UI) |
| 36 | Attendance & Availability | ✅ Fully Implemented |
| 37 | Patrol Management | ✅ Fully Implemented (manual check-off, not QR/GPS verified) |
| 38 | Incident Reporting & Review | ✅ Fully Implemented |
| 39 | Guard Portal & Offline Sync | ✅ Fully Implemented |

### 4.6 Finance
*(full detail: [`docs/features/06-finance.md`](features/06-finance.md))*

| # | Feature | Status |
|---|---|---|
| 40 | Invoice Generation & Management | ✅ Fully Implemented |
| 41 | Invoice Dispute Resolution | ✅ Fully Implemented |
| 42 | Rate Card Management | ✅ Fully Implemented |
| 43 | Timesheet Management & Approval | ✅ Fully Implemented |
| 44 | Finance Reporting | ✅ Fully Implemented |
| 45 | Subscription Billing & Plans | 🟡 Partially Implemented (no payment processor) |

### 4.7 Platform & Integrations
*(full detail: [`docs/features/07-platform-integrations.md`](features/07-platform-integrations.md))*

| # | Feature | Status |
|---|---|---|
| 46 | Public API & API Keys | ✅ Fully Implemented |
| 47 | Webhooks | ✅ Fully Implemented |
| 48 | Integrations Overview Dashboard | ✅ Fully Implemented |
| 49 | CRM Connector (HubSpot) | ✅ Fully Implemented (HubSpot only) |
| 50 | Multi-Branch Management | ✅ Fully Implemented |
| 51 | White-Label Branding & Custom Domains | 🟡 Partially Implemented (no SSL automation) |
| 52 | Shared Documents | ✅ Fully Implemented |
| 53 | Client Portal (self-service) | ✅ Fully Implemented |
| 54 | Email Notifications | 🟡 Partially Implemented (proposal emails only) |
| 55 | API Documentation | ✅ Fully Implemented |
| 56 | Custom Reports (Daily Service Reports) | ✅ Fully Implemented |

**Legend:** ✅ Fully Implemented — UI, API, service, and database all verified working. 🟡 Partially Implemented — core logic works but a layer is missing, incomplete, or has no frontend. 🔴 Not Implemented / Limited — placeholder or backend-only stub with no usable feature.

---

## 5. Detailed Feature Documentation

To keep this document navigable, full feature write-ups (Purpose, Overview, What User Can Do, Workflow, Business Value, Technical Summary, Key Capabilities, Current Status) are organized into seven companion documents:

| Domain | File |
|---|---|
| 5.1 Authentication, Authorization & Security | [`docs/features/01-authentication-security.md`](features/01-authentication-security.md) |
| 5.2 Core CRM | [`docs/features/02-crm-core.md`](features/02-crm-core.md) |
| 5.3 Sales Tools | [`docs/features/03-sales-tools.md`](features/03-sales-tools.md) |
| 5.4 AI Features | [`docs/features/04-ai-features.md`](features/04-ai-features.md) |
| 5.5 Field Operations | [`docs/features/05-field-operations.md`](features/05-field-operations.md) |
| 5.6 Finance | [`docs/features/06-finance.md`](features/06-finance.md) |
| 5.7 Platform & Integrations | [`docs/features/07-platform-integrations.md`](features/07-platform-integrations.md) |

---

## 6. Database Mapping

High-level map from feature area to the Prisma models that back it (59 models total in `backend/prisma/schema.prisma`).

```
Authentication & Security
└── User, Tenant, Permission, Role, RolePermission, UserRoleAssignment,
    FieldPermission, SSOProvider, SSORoleMapping, SSOLoginState,
    UserSession, ClientUser, AuditLog

Core CRM
└── Lead, Deal, Note, Activity, Proposal, ProposalVersion,
    ProposalComment, Client

Sales Tools
└── DiscoverySession, SalesAssessment, ProspectSearchHistory,
    SavedProspectSearch   (+ reuses Lead/Note for prospect import)

AI Features
└── PromptVersion, AiGeneration, AiFeedback, KnowledgeEntry,
    AiConversation, RecommendationAction
    (+ reads Client/Guard/Site/Invoice/Incident/Shift for insight computation)

Field Operations
└── Site, Guard, Shift, Assignment, Availability, AttendanceEvent,
    Incident, Checkpoint, PatrolRoute, PatrolRouteCheckpoint,
    PatrolRun, PatrolEvent, GuardSyncQueue, DailyServiceReport

Finance
└── Invoice, InvoiceItem, InvoiceDispute, RateCard, Timesheet

Platform & Integrations
└── ApiKey, ApiRequestLog, Webhook, WebhookDelivery, CrmConnection,
    Branch, TenantBranding, CustomDomain, SharedDocument
```

### Feature → Table Cross-Reference

| Feature | Primary Tables |
|---|---|
| Lead Management | `Lead` |
| Deal / Pipeline | `Deal` |
| Proposal Management | `Proposal`, `ProposalVersion`, `ProposalComment` |
| Notes / Activities | `Note`, `Activity` |
| Client Management | `Client`, `ClientUser` |
| Sales Accelerator | `DiscoverySession`, `SalesAssessment` |
| AI Prospect Search | `ProspectSearchHistory`, `SavedProspectSearch` (imports write `Lead`/`Note`) |
| AI Governance / Monitoring | `PromptVersion`, `AiGeneration`, `AiFeedback` |
| AI Copilot | `AiConversation` |
| AI Predictions / Actions | `RecommendationAction` |
| Knowledge Base | `KnowledgeEntry` |
| Sites / Guards / Shifts | `Site`, `Guard`, `Shift`, `Assignment`, `Availability` |
| Attendance | `AttendanceEvent` |
| Patrols | `Checkpoint`, `PatrolRoute`, `PatrolRouteCheckpoint`, `PatrolRun`, `PatrolEvent` |
| Incidents | `Incident` |
| Guard Offline Sync | `GuardSyncQueue` |
| Invoicing | `Invoice`, `InvoiceItem`, `InvoiceDispute` |
| Rate Cards | `RateCard` |
| Timesheets | `Timesheet` |
| Custom Reports | `DailyServiceReport` |
| RBAC | `Permission`, `Role`, `RolePermission`, `UserRoleAssignment`, `FieldPermission` |
| SSO | `SSOProvider`, `SSORoleMapping`, `SSOLoginState` |
| Sessions | `UserSession` |
| Audit | `AuditLog` |
| API Keys / Public API | `ApiKey`, `ApiRequestLog` |
| Webhooks | `Webhook`, `WebhookDelivery` |
| CRM Connector | `CrmConnection` |
| Branches | `Branch` |
| Branding | `TenantBranding`, `CustomDomain` |
| Shared Documents | `SharedDocument` |

---

## 7. API Summary

The backend is mounted under the `/api` prefix. Authentication is via JWT bearer token (three separate token "roles": admin, client, guard — all issued by the same JWT infrastructure but distinguished by a `role` claim) or, for the Public API, an `X-API-Key` header. Full endpoint-by-endpoint detail is in each domain's feature document; the table below summarizes the entry points per feature area.

| Feature Area | Base Route | Auth |
|---|---|---|
| Admin Auth | `/auth/*` | Public (login/register), JWT for others |
| Client Auth | `/client-auth/*` | Public |
| Guard Auth | `/guard-auth/*` | Public |
| SSO | `/auth/sso/*` (login), `/sso/*` (admin config) | Public login, JWT+RBAC for config |
| RBAC | `/roles/*` | JWT + RBAC |
| Field Permissions | `/field-permissions/*` | JWT + RBAC |
| Sessions | `/sessions/*` | JWT + RBAC |
| Audit | `/audit` | JWT + RBAC |
| Leads | `/leads/*` | JWT + RBAC |
| Deals | `/deals/*` | JWT + RBAC |
| Proposals | `/proposals/*` | JWT + RBAC |
| Notes | `/notes/*` | JWT + RBAC |
| Activities | `/activities/*` | JWT + RBAC |
| Clients | `/clients/*` | JWT + RBAC |
| Sales Accelerator | `/sales-accelerator/*` | JWT + RBAC |
| Sales Automation | `/sales-automation/*` | JWT + RBAC |
| Sales Delivery | `/sales-delivery/*` | JWT + RBAC |
| Sales Imports | `/sales-imports/*` | JWT + RBAC |
| Prospect Search | `/prospect-search/*` | JWT + RBAC (+ rate limit) |
| AI (core) | `/ai/*` | JWT + RBAC |
| AI Copilot | `/ai-copilot/*` | JWT + RBAC |
| AI Insights | `/ai-insights/*` | JWT + RBAC |
| AI Predictions | `/ai-predictions/*` | JWT + RBAC |
| AI Governance | `/ai-prompts/*`, `/ai-audit/*` | JWT + RBAC |
| AI Feedback | `/ai-feedback/*` | JWT + RBAC |
| Knowledge Base | `/knowledge-base/*` | JWT + RBAC |
| Call Transcription | `/call-transcription/*` | JWT + RBAC |
| Sites | `/sites/*` | JWT + RBAC |
| Guards | `/v2/guards/*`, `/guards/*` | JWT + RBAC |
| Shifts | `/v2/shifts/*` | JWT + RBAC |
| Assignments | `/assignments` | JWT + RBAC |
| Patrols (admin) | `/checkpoints/*`, `/patrol-routes/*`, `/patrol-runs/*` | JWT + RBAC |
| Incidents (admin) | `/incidents/*` | JWT + RBAC |
| Guard Portal | `/guard/*` | Guard JWT |
| Invoices | `/invoices/*` | JWT + RBAC |
| Invoice Disputes | `/invoice-disputes/*` | JWT + RBAC |
| Rate Cards | `/rate-cards/*` | JWT + RBAC |
| Timesheets | `/timesheets/*` | JWT + RBAC |
| Finance | `/finance/*` | JWT + RBAC |
| Billing | `/billing` | JWT + RBAC |
| API Keys | `/api-keys/*` | JWT + RBAC |
| Public API | `/public/*` | API Key |
| Webhooks | `/webhooks/*` | JWT + RBAC |
| Integrations Overview | `/integrations` | JWT + RBAC |
| CRM Connector | `/crm-connectors/*` | JWT + RBAC (+ public OAuth callback) |
| Branches | `/branches/*` | JWT + RBAC |
| Branding | `/branding/*` | JWT + RBAC (+ public branding lookup) |
| Shared Documents | `/documents/*` | JWT + RBAC |
| Client Portal | `/client-portal/*`, `/client/invoices/*`, `/client/incidents/*`, `/client/reports/*` | Client JWT |
| Email | `/email/*` | JWT + RBAC |
| API Docs | `/api-docs*` | Public |
| Reports | `/reports/*` | JWT + RBAC |

---

## 8. User Workflows

### 8.1 Admin — Prospect to Paid Invoice

```
 1. Admin logs in (JWT)
       ↓
 2. Dashboard
       ↓
 3. Find prospects — AI Prospect Search OR manual Lead entry OR CSV import
       ↓
 4. Qualify — Sales Accelerator discovery capture + AI lead scoring
       ↓
 5. Convert Lead → Deal
       ↓
 6. Generate AI Proposal (from lead context or discovery notes)
       ↓
 7. Share proposal with Client (client portal notified)
       ↓
 8. Client reviews, comments, approves/rejects in Client Portal
       ↓
 9. Deal won → Site set up, Shifts scheduled, Guards assigned
       ↓
10. Guards check in/out via Guard Portal → Timesheets auto-generated
       ↓
11. Admin approves Timesheets
       ↓
12. Admin generates Invoice from approved timesheets
       ↓
13. Invoice issued → Client views/accepts/disputes in Client Portal
       ↓
14. Payment recorded → Invoice marked Paid
       ↓
15. Finance dashboard reflects revenue in real time
```

### 8.2 Guard — Daily Field Workflow

```
1. Guard logs in (Guard Portal, phone/email + password)
      ↓
2. Views assigned shifts for today
      ↓
3. Checks in at shift start (works offline — queued and synced when back online)
      ↓
4. Starts a patrol route (if assigned) → taps through each checkpoint
      ↓
5. Completes patrol run (unscanned checkpoints auto-marked "missed")
      ↓
6. Files an incident report if something happens (photo/attachment URL, severity)
      ↓
7. Checks out at shift end → Timesheet auto-created (status: pending)
```

### 8.3 Client — Self-Service Workflow

```
1. Client logs in to Client Portal
      ↓
2. Reviews a shared proposal → approves / rejects / comments
      ↓
3. Views invoices → downloads PDF → accepts or disputes
      ↓
4. Views approved incident reports for their sites
      ↓
5. Views published daily service reports
      ↓
6. Downloads shared documents (contracts, certificates)
```

### 8.4 Admin — AI-Assisted Decision Support

```
1. Admin opens AI Insights dashboard → sees client/guard/site/billing/incident risk signals
      ↓
2. Admin asks a free-text question in AI Copilot ("what's our overdue invoice total?")
      ↓
3. Copilot answers using real tenant data, grounded by rule-based computation + Gemini polish
      ↓
4. Admin reviews AI Predictions (staffing shortage risk, churn risk, payment-delay risk)
      ↓
5. Admin rates AI recommendations (thumbs up/down) → feeds the feedback loop
      ↓
6. Repeatedly-rejected recommendation types are automatically down-weighted in future output
```

---

## 9. Role Permissions

The platform ships with **7 system roles** per tenant, auto-provisioned on first use, plus support for fully custom tenant-defined roles built from ~85 granular permission keys (`backend/src/roles/rbac.constants.ts`).

| System Role | Scope | Portal |
|---|---|---|
| **Super Admin** | All permissions, all branches | Admin app |
| **Branch Admin** | Broad operational + CRM permissions, scoped to their branch | Admin app |
| **Scheduler** | Sites, guards, shifts | Admin app |
| **Supervisor** | Sites, guards, shifts, incidents, reports, timesheets | Admin app |
| **Finance** | Invoicing, billing, rate cards, finance reports | Admin app |
| **Guard** | Portal-only — cannot be granted admin permissions | Guard Portal |
| **Client** | Portal-only — cannot be granted admin permissions | Client Portal |

Custom roles can combine any subset of permission keys (e.g. `leads.view`, `invoices.mark_paid`, `sso.manage`), can be branch-scoped, and are subject to a self-escalation guard (a non-super-admin cannot grant a role permissions they don't personally hold). See [`docs/features/01-authentication-security.md`](features/01-authentication-security.md) for the full RBAC and Field-Level Permissions write-up.

---

## 10. Security Features

- **JWT authentication** with access + refresh token pairs (admin/SSO flows); refresh rotation is bound to a tracked `UserSession`.
- **Role-Based Access Control** enforced at the API route level (`PermissionGuard` + `@RequirePermission`) on every admin endpoint.
- **Field-Level Permissions** — a second, finer-grained layer that can hide/lock specific sensitive fields (guard salary, bank details, client billing notes, invoice internal adjustments) per role, independent of route-level access.
- **Multi-tenancy isolation** — every tenant-scoped query filters by `tenantId` in application code, consistently applied across all ~55 modules.
- **Branch-scoping** — a second isolation layer for multi-branch tenants, restricting non-super-admin visibility to their own branch.
- **Single Sign-On (OIDC)** — full Authorization Code + PKCE flow with manual JWKS signature verification, JIT provisioning, and IdP-group-to-role mapping.
- **Session management** — admins can view all active admin/SSO sessions and force-revoke any one; idle timeout (default 8h) and absolute expiry (default 30 days) are enforced server-side.
- **Audit logging** — a tenant-scoped trail of security-sensitive actions (logins, role changes, SSO events, forced logouts, field-access denials) via a single `AuditService`.
- **Public API authentication** — SHA-256-hashed API keys (plaintext shown only once), scoped permissions, per-key rate limiting, and full request logging.
- **Webhook signing** — every outbound webhook payload is HMAC-SHA256 signed so receivers can verify authenticity.
- **AI safety screening** — every AI-generated output is automatically scanned for PII (emails, SSNs, card numbers, phone numbers), unsafe automation language, and cross-client data leakage before it can be approved for client-visible use.
- **Encrypted OAuth tokens** — the HubSpot CRM connector encrypts stored access/refresh tokens with AES-256-GCM.

See [`docs/features/01-authentication-security.md`](features/01-authentication-security.md) for full detail, including the honestly-documented gaps (SAML SSO has no completion endpoint; tokens are stored in `localStorage`, not httpOnly cookies; guard/client portal sessions aren't tracked in the admin Sessions view).

---

## 11. Performance Features

- **AI response caching** — Prospect Search caches full search results (AI-parsed filters + ranked results) keyed by tenant + provider + prompt, with a configurable TTL, so a repeated search skips both the AI call and the data-provider call entirely.
- **Rate limiting** — both the Public API and Prospect Search implement per-key/per-user rate limiting to protect against abuse and runaway AI/API costs.
- **Graceful AI degradation** — nearly every AI-backed feature has a deterministic, non-LLM fallback path, so the platform keeps functioning (with reduced narrative quality) if the AI provider is slow, unavailable, or misconfigured.
- **Bulk/batch operations** — bulk proposal generation, bulk proposal email sending, and CSV bulk import (leads/deals) all process many records in a single guarded request rather than requiring one-by-one admin action.
- **Offline-first field operations** — the Guard Portal queues check-in/out, incident, and patrol actions locally when offline and automatically replays them in order once connectivity returns, with server-side idempotent de-duplication.
- **Background automation** — Sales Automation runs on a configurable interval (default 24h) to scan for stalling deals and auto-create follow-up tasks without any admin action.

---

## 12. Known Limitations

These are real, verified gaps — not guesses — documented here so expectations are set accurately.

| Area | Limitation |
|---|---|
| **AI Prospect Search** | The company data source is a fixed, hardcoded set of 22 sample companies, not a live external data provider. Apollo/Crunchbase/Clearbit connectors exist as scaffolding only and return a clear "not implemented" error if selected. |
| **SSO** | OIDC login is fully functional; SAML login can be started but has **no completion endpoint** — a user choosing SAML SSO cannot currently finish logging in. |
| **Session tracking** | Guard Portal and Client Portal logins are not recorded in the admin-facing Session Management screen (only admin/SSO logins are). |
| **Token refresh** | The frontend never calls the refresh-token endpoint; sessions simply expire and require re-login, even though the backend fully supports rotation. |
| **Activities** | The Activities feature (tasks/calls/meetings tied to a deal) is fully built on the backend but has **no frontend UI** — it cannot be used by an end user today. |
| **CSV import/export for Leads** | Backend-complete, but has no frontend UI to trigger it. |
| **Deal pipeline stage changes** | The backend supports changing a deal's stage and deleting a deal, but there is no UI control for either — deals can only be created and viewed, not moved through the pipeline or deleted, from the current interface. |
| **AI Actions** | The recommendation approve/reject/execute workflow is fully built and tested on the backend but has no API controller and no frontend — recommendation records can be created but never actioned by a user. |
| **AI Monitoring dashboard** | The aggregate AI-quality metrics computation exists but has no API route or frontend page. |
| **AI Command Center / AI Executive Center** | Not implemented in any layer — empty placeholder route folders only. |
| **AI Predictions labeling** | This feature is entirely rule-based (deterministic formulas), not LLM-generated, despite living under an "AI" module name — it always self-reports as a fallback-status generation. |
| **Subscription Billing** | No payment processor integration exists. Plan assignment is controlled by environment variables, not stored per-tenant in the database, and there is no self-service upgrade/downgrade flow. |
| **Patrol "QR scanning"** | There is no actual QR code decoding, NFC, or GPS verification — checkpoint "scans" are a manual tap-to-confirm checklist action by the guard. |
| **Custom Domains** | Domain *ownership* verification (DNS TXT record) is real; actual SSL certificate provisioning and traffic routing to the custom domain are not implemented. |
| **Email Notifications** | Limited to proposal-delivery emails only (single-purpose), and defaults to a non-production test mailbox (Ethereal) unless SMTP credentials are configured. |
| **Public API rate limiting & Prospect Search cache/rate-limit** | Implemented in-memory, per server process — correct for a single-instance deployment, but would need a shared store (e.g. Redis) to behave correctly across multiple horizontally-scaled backend instances. |
| **Guard authentication** | Guards share the same JWT signing infrastructure as admin users (differentiated only by a role claim), not a structurally separate identity system; guard email/phone lookup at login is not tenant-scoped at the database query level (though a correct password is still required). |
| **Audit log read UI** | No filtering, search, date-range, or pagination controls — shows only the latest 100 entries. |

---

## 13. Future Enhancements (Not Yet Implemented)

The following are explicitly **not implemented in any layer today** and are listed here only because their names/placeholders exist somewhere in the codebase or product surface — they should not be represented to stakeholders as available functionality.

- **AI Command Center** — no backend module, no frontend page, no sidebar entry.
- **AI Executive Center** — no backend module, no frontend page, no sidebar entry.
- **Live external company data providers for Prospect Search** (Apollo, Crunchbase, Clearbit) — interfaces and error-handling scaffolding exist; no real API integration.
- **SAML SSO completion (Assertion Consumer Service)** — the login can be started but not finished.
- **Payment processor integration for Billing** — no Stripe/payment gateway of any kind is wired in.
- **Self-service plan upgrade/downgrade** — plan changes currently require an environment variable change and a deploy.
- **Real QR/NFC/GPS-verified patrol checkpoint scanning** — current implementation is a manual confirmation checklist.
- **SSL/routing automation for custom domains** — only domain-ownership verification exists today.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **Tenant** | One customer organization using the platform; all its data is isolated from other tenants. |
| **Branch** | A regional/office subdivision within a tenant, used to scope visibility for non-super-admin staff. |
| **Lead** | A prospective customer captured into the CRM, not yet a paying client. |
| **Deal** | A sales opportunity tracked through a pipeline, created from (or linked to) a Lead. |
| **Client** | A tenant's own paying customer — the entity that receives guard services, invoices, and proposals. |
| **Guard** | Field security personnel who work shifts, run patrols, and file incidents via the Guard Portal. |
| **Discovery Session** | Structured notes captured about a lead/deal's needs (property type, guard count, pain points, etc.), used to power AI scoring and proposal generation. |
| **Sales Assessment** | An AI- or rule-generated score/summary of a lead or deal's sales readiness. |
| **Fallback (AI)** | A deterministic, non-LLM response the system returns when the AI provider is unavailable or fails, so the feature keeps working in a degraded mode. |
| **RBAC** | Role-Based Access Control — the permission-key system controlling what each role can do. |
| **Field-Level Permission** | A finer-grained permission layer that can hide/lock specific sensitive fields on a record independent of general RBAC. |
| **Webhook** | An outbound HTTP notification the platform sends to a tenant-configured external URL when a business event occurs. |
| **Knowledge Entry** | A piece of organizational memory (from resolved incidents, disputes, published reports, or approved AI actions) retrievable as grounding context for AI Copilot and other AI features. |
| **Prompt Version** | An admin-authored, versioned override of the default AI prompt template for a given AI capability, managed under AI Governance. |
| **Rate Card** | A contract-defined hourly/overtime/holiday billing rate for a client (optionally per-site), used to price invoices. |
| **Timesheet** | Worked-hours record auto-generated from a guard's shift check-in/check-out, requiring admin approval before it can be invoiced. |

---

## 15. Appendix

### 15.1 Document Scope & Method

This documentation was produced by direct, systematic inspection of the source code — backend controllers, services, DTOs, and the Prisma schema; frontend pages, components, and API client libraries — grouped into seven investigation passes (Authentication/Security, Core CRM, Sales Tools, AI Features, Field Operations, Finance, Platform/Integrations). Every feature's status was independently verified by confirming that its UI, API route, service logic, and database model are all present and connected; features missing any one of those layers are explicitly marked **Partially Implemented** or **Limited Implementation** rather than described as complete.

### 15.2 How to Use This Document

- **Non-technical readers**: read the *Purpose*, *Overview*, *What User Can Do*, *Workflow*, and *Business Value* sections of each feature in the domain files under `docs/features/`. Skip *Technical Summary*.
- **Developers**: the *Technical Summary* and *Key Capabilities* sections of each feature name the actual controllers, services, DTOs, and Prisma models involved, without reproducing source code.
- **Screenshots**: every feature section includes a `[Insert Screenshot Here]` placeholder for a follow-up documentation pass once UI walkthroughs are captured.

### 15.3 Revision Note

This document reflects the codebase at the time of writing. As features are added, changed, or removed, this documentation should be regenerated from the source code rather than hand-edited out of sync with it — per the same "codebase as single source of truth" principle used to produce it.
