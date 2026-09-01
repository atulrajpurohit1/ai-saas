# Project Overview

> **Purpose of this file:** a single, easy starting point for anyone new to this project.
> It is a plain-language summary. For deep detail, follow the links to [`docs/`](docs/).
> Everything below was checked against the actual code in `backend/src`, `frontend/src`,
> and `backend/prisma/schema.prisma`. Where something is only partly built, it says so.

---

## 1. What is this project?

This is a **multi-tenant SaaS platform for companies that provide physical security
guard services**. "Multi-tenant" means many separate companies ("tenants") use the same
app, and each one only ever sees its own data.

It combines four things that are normally separate products into one app:

1. **Field operations** – set up client sites, schedule guards onto shifts, run patrols,
   log incidents, track attendance.
2. **Sales CRM** – capture leads, move deals through a pipeline, generate proposals, and
   do AI-assisted research on a target company.
3. **Vendor / subcontractor procurement (RFP)** – write a formal Request for Proposal,
   invite subcontracted security vendors to bid, evaluate the bids with AI, award the
   contract, and track vendor performance.
4. **AI assistance** – a shared AI layer (Google Gemini, plus OpenAI for call
   transcription and BlackPearl for company research) that drafts proposals and RFPs,
   scores leads, coaches sales reps on calls, evaluates vendor bids, and recommends
   guards for open shifts.

**Problem it solves:** a security agency normally juggles a scheduling tool, a CRM, a
billing system, and a pile of spreadsheets. This platform puts all of it in one place,
adds a client-facing portal and a guard mobile portal, and layers AI on top to speed up
the slow manual work (writing proposals, qualifying leads, comparing vendor bids).

---

## 2. Main Users

There are **four** separate experiences. Three are logged-in portals; one is a public link.

| User | Where they log in | What they can do |
|---|---|---|
| **Admin / office staff** | Main app (`/`) | Everything: CRM, scheduling, finance, RFP/vendor procurement, AI tools, settings, branding. What each staff member can actually do is controlled by their role (see Security). |
| **Field guards** | Guard Portal (`/guard/*`) | See their assigned shifts, check in/out, run patrol routes, file incident reports, raise a panic/emergency alert. Works offline and syncs later. |
| **The tenant's own clients** | Client Portal (`/client/*`) | View and approve/reject proposals, view and dispute invoices, view approved incident reports, view published daily reports, download shared documents, view their insurance/compliance status. |
| **The tenant's subcontracted vendors** | Public invitation link (`/vendor/invitation/[token]`) | View the one RFP they were invited to and submit a bid with documents. **No login** – access is via a one-time secure link only. |

Within the Admin app, the platform ships **7 built-in roles** per tenant
(Super Admin, Branch Admin, Scheduler, Supervisor, Finance, Guard, Client) plus fully
custom roles built from a catalog of fine-grained permission keys.

---

## 3. Main Features

### Sales & CRM
- **Leads** – capture, list, search, AI lead scoring, import a prospect as a lead.
- **Deals / pipeline** – deal records with pipeline stages and a **Kanban board** view.
- **Proposals** – AI-drafted security-services proposals, versioning, client comments,
  approve/reject, bulk generation, email delivery, PDF export, Markdown rendering.
- **Notes & Activities** – notes on leads/deals; activities are created via the Sales
  Accelerator.
- **Clients** – manage the tenant's paying customers and their portal users.
- **Sales Accelerator** – AI sales-coaching workspace: discovery capture, lead/deal
  scoring, deal-risk triage, a "focus queue" of prioritised deals with AI next-actions.
- **AI Prospect Search** – type one company name → BlackPearl generates a sales
  "playbook" (business summary, value props, sales angles, personas, objections) →
  import it as a lead. Single-company research, not a filter search.
- **Sales Calls / Call Transcription** – paste or upload a call recording, get an AI
  transcript, live coaching, and structured discovery analysis.

### Field Operations
- **Branches** – regional offices; used to scope who sees what.
- **Sites** – client locations that need guarding.
- **Guards** – the workforce roster.
- **Guard Compliance** – track guard licences / certifications / training and their
  expiry, with document uploads.
- **Shifts** – schedule and assign guards to shifts; AI guard recommendations for open
  shifts.
- **Attendance & Availability** – check-in/out events and guard availability.
- **Patrols** – checkpoints, patrol routes, patrol runs; guards tap through each
  checkpoint (manual confirmation, plus optional geofence check); live location on a run.
- **Incidents** – guards file incident reports (with photo/video evidence attachments);
  admins review and approve; approved ones are visible to the client.
- **Emergency Alerts** – a guard panic/duress button that surfaces to admin dispatch for
  acknowledge / resolve.
- **Daily Service Reports** – custom daily reports that can be published to the client.
- **Guard Portal** – the guard-facing mobile experience with offline queue + sync.

### Finance
- **Rate Cards** – contracted hourly / overtime / holiday billing rates per client/site.
- **Timesheets** – auto-generated from guard check-in/out; require admin approval.
- **Invoices** – generated from approved timesheets; issue, mark paid, cancel, PDF, CSV.
- **Invoice Disputes** – clients raise disputes; staff respond and resolve.
- **Finance Reporting** – totals, status breakdown, CSV export, quick reports, with charts.
- **Client Insurance / Compliance** – track each client's Certificate of Insurance and
  policy expiry; advisory banner; visible in the client portal.
- **Billing / Subscription** – plan tiers and usage meters (no payment processor – see
  Current Project Status).

### Platform & Integrations
- **Public API + API Keys** – external access with hashed keys, scoped permissions, rate
  limiting, request logging.
- **Webhooks** – outbound HMAC-signed event notifications with delivery logs.
- **CRM Connector (HubSpot)** – OAuth import of HubSpot contacts.
- **Integrations dashboard** – overview of keys, webhooks, connectors.
- **White-label Branding & Custom Domains** – per-tenant logo, colours, support details,
  live preview; domain-ownership verification.
- **Shared Documents** – share document links with clients.
- **Email Notifications** – proposal and RFP vendor emails (SMTP / Ethereal for local).
- **API Documentation** – a public `/api-docs` page.
- **GoHighLevel chat widget** – a third-party support-chat widget embedded site-wide
  (unrelated to the platform's own AI features).

### RFP & Vendor Management
- **RFP Management** – draft an RFP, AI-generate its content, AI-analyse security
  requirements, invite vendors by secure link, collect submissions, AI-evaluate and
  compare bids, award / reject (auto-emails the vendor), generate a proposal from the RFP.
- **Vendor Management** – vendor directory + performance reviews.
- **Vendor Portal** – the public, login-free bid-submission page for invited vendors.

### AI Features (shared layer)
- AI proposal drafting, AI sales assessment / lead scoring, AI discovery guide & call
  intelligence, AI guard-shift recommendations, AI RFP drafting & evaluation, AI feedback
  collection (backend only), call transcription (OpenAI).
- Most Gemini-backed features have a deterministic **fallback** when Gemini is
  unavailable. BlackPearl and OpenAI features fail with a clear error instead of faking
  data.

---

## 4. Project Architecture

### Frontend
- **Next.js (App Router), React 19, TypeScript, Tailwind CSS v4.**
- One Next.js app serves all four experiences, split by route prefix:
  `/` (admin), `/client/*`, `/guard/*`, `/vendor/invitation/*`.
- UI primitives live in `frontend/src/components/ui/*` (shadcn-style). Charts in
  `frontend/src/components/charts/*`. Each backend feature has a matching API-client file
  in `frontend/src/lib/*`.
- Auth token is stored in `localStorage` and sent as a bearer token.

### Backend
- **NestJS 11, TypeScript.** ~60 feature modules under `backend/src/`, each with the same
  shape: `*.controller.ts` (routes + guards + permission checks), `*.service.ts`
  (business logic + database), and DTOs (`class-validator` request validation).
- All routes are under the `/api` prefix.
- `backend/src/main.ts` sets up CORS, a 10 MB body limit (for base64 logo uploads), and
  global validation.

### Database
- **PostgreSQL**, accessed through **Prisma 6** ORM.
- Schema: `backend/prisma/schema.prisma` – currently **66 models**.
- Migrations: `backend/prisma/migrations/`.
- **Tenant isolation is enforced in application code** – every tenant-scoped query
  filters by `tenantId`. There is no database-level row security.

### Authentication
- **JWT** (access + refresh tokens) via Passport.js.
- Three token "roles" from the same JWT infrastructure: admin, client, guard
  (distinguished by a `role` claim).
- Vendors get **no token** – they use a one-time invitation token in the URL.

### Important integrations
| Service | Used for |
|---|---|
| **Google Gemini** (`@google/generative-ai`) | Proposals, sales scoring/coaching, RFP drafting/evaluation, guard-recommendation explanations |
| **BlackPearl** (a.k.a. Bebop) | AI Prospect Search company playbooks (live, paid, async API) |
| **OpenAI** | Call audio transcription only |
| **HubSpot** (OAuth) | Import CRM contacts |
| **SMTP / Nodemailer** (Ethereal for local dev) | Proposal + RFP vendor emails |
| **GoHighLevel** | Embedded support-chat widget (not a data integration) |

### How the parts communicate
```
Next.js frontend  ──REST /api (JWT bearer, or vendor invitation token)──►  NestJS backend
NestJS backend    ──Prisma──►  PostgreSQL
NestJS backend    ──HTTPS──►  Gemini / OpenAI / BlackPearl / HubSpot / SMTP
NestJS backend    ──outbound HMAC-signed HTTP──►  tenant webhook URLs
```

---

## 5. Folder Structure

```
d:\Ai Saas\
├── backend/                     NestJS API
│   ├── src/                     ~60 feature modules (one folder each)
│   │   ├── auth/                JWT login, strategies, permission/roles guards
│   │   ├── prisma/              Prisma client module + exception filter
│   │   ├── common/              shared utils (file storage, geo, etc.)
│   │   ├── roles/               RBAC – permission catalog (rbac.constants.ts) + role logic
│   │   ├── leads/ deals/ proposals/ notes/ activities/ clients/   Core CRM
│   │   ├── sales-accelerator/ prospect-search/ call-transcription/  Sales tools
│   │   ├── ai/ ai-governance/ ai-monitoring/ ai-insights/          AI layer
│   │   ├── sites/ guards/ guard-compliance/ shifts/ assignments/   Field ops
│   │   │   patrols/ incidents/ emergency-alerts/ reports/ guard-portal/
│   │   ├── invoices/ invoice-disputes/ rate-cards/ timesheets/     Finance
│   │   │   finance/ billing/ client-compliance/
│   │   ├── rfp/ vendors/ vendor-portal/                            Procurement
│   │   ├── api-keys/ public-api/ webhooks/ integrations/           Platform
│   │   │   crm-connectors/ branding/ branches/ documents/ dashboard/
│   │   ├── client-auth/ client-portal/ guard-auth/                 Portal auth
│   │   └── main.ts app.module.ts
│   ├── prisma/schema.prisma     the whole data model (66 models)
│   ├── prisma/migrations/       ordered SQL migrations
│   ├── scripts/                 one-off admin scripts (seed, data cleanup, table patches)
│   └── dist/                    compiled output (committed – normally you can ignore it)
│
├── frontend/                    Next.js app
│   └── src/
│       ├── app/                 routes: admin (/*), client/*, guard/*, vendor/*
│       ├── components/          shared React components
│       │   ├── ui/              design-system primitives
│       │   └── charts/          TrendAreaChart, CategoryBarChart, StatDelta
│       └── lib/                 one API-client file per backend feature + helpers
│                                (api.ts, nav-links.ts, format.ts, offline-sync.ts, ...)
│
├── docs/                        product & feature documentation (see section 14)
├── scratch/ , "Ai Saas"/scratch/   throwaway exploration scripts (not part of the app)
├── node-portable/              a bundled Node.js for Windows (not application code)
├── render.yaml                 Render.com deploy config for the frontend
└── start-*.bat                 Windows helper scripts to run backend/frontend locally
```

---

## 6. Main Modules

| Module (backend folder) | Purpose |
|---|---|
| `auth`, `client-auth`, `guard-auth` | Login and JWT issuing for the three portal types. |
| `roles` | The RBAC engine – the permission-key catalog and role/permission checks. |
| `field-permissions` | Extra layer that can hide/lock specific sensitive fields per role. |
| `leads`, `deals`, `proposals`, `notes`, `activities`, `clients` | Core CRM data and workflow. |
| `sales-accelerator` | AI discovery capture, lead/deal scoring, coaching, focus queue. |
| `prospect-search` | BlackPearl company-playbook research + caching + history + saved searches. |
| `call-transcription` | OpenAI transcription + AI call coaching/analysis. |
| `ai` | Shared Gemini wrapper used by proposals, RFP, sales, guard recommendations. |
| `ai-governance`, `ai-monitoring` | Prompt-version resolution + AI output safety screening + generation logging (runs in the background; admin UI was removed). |
| `sites`, `guards`, `guard-compliance`, `shifts`, `assignments` | Set up sites, workforce, compliance tracking, and scheduling. |
| `patrols` | Checkpoints, routes, runs, geofence + live location. |
| `incidents` | Incident reporting, evidence attachments, admin review, client visibility. |
| `emergency-alerts` | Guard panic button → admin dispatch acknowledge/resolve. |
| `reports` | Daily service reports, publishable to clients. |
| `guard-portal` | Guard-facing endpoints incl. offline sync queue. |
| `invoices`, `invoice-disputes`, `rate-cards`, `timesheets`, `finance` | Turn approved hours into billing and reporting. |
| `client-compliance` | Client Certificate-of-Insurance / policy expiry tracking. |
| `billing` | Subscription plan tiers + usage limits (no payment processor). |
| `rfp`, `vendors`, `vendor-portal` | Full procurement flow: draft → invite → collect → AI-evaluate → award → track. |
| `api-keys`, `public-api`, `webhooks` | External API access and outbound event notifications. |
| `crm-connectors`, `integrations` | HubSpot OAuth import + integrations overview. |
| `branding`, `branches`, `documents` | White-label config, regional offices, shared document links. |
| `dashboard` | The admin home-screen summary numbers. |
| `client-portal` | Client-facing endpoints for proposals, invoices, incidents, reports, documents. |

---

## 7. Completed Phases / Major Work

The team tracks work in two documents: an original build history (RFP/AI/SSO eras, in
git history and [`docs/FEATURE_DOCUMENTATION.md`](docs/FEATURE_DOCUMENTATION.md)) and a
**Product Improvement Audit** ([`docs/PRODUCT_IMPROVEMENT_AUDIT.md`](docs/PRODUCT_IMPROVEMENT_AUDIT.md))
whose Phase 1 / 2 / 3 roadmap is being worked through now.

| Phase / Feature | Status | What was implemented (verified in code) |
|---|---|---|
| Core CRM (Leads, Deals, Proposals, Notes, Clients) | ✅ Done | Full CRUD, AI lead scoring, proposal versioning/comments/approval, PDF + email. |
| Field Operations (Sites, Guards, Shifts, Attendance, Patrols, Incidents, Guard Portal) | ✅ Done | Scheduling, assignment, attendance events, patrol checkpoints/routes/runs, incident review, offline sync. |
| Finance (Rate Cards, Timesheets, Invoices, Disputes, Reporting) | ✅ Done | Timesheet approval → invoice generation → issue/pay/dispute; CSV export. |
| RBAC / Field-Level Permissions / Audit / Sessions | ✅ Done (some admin UIs removed) | Permission-key catalog, 7 system roles + custom roles, self-escalation guard, audit trail. Field-permission and session admin screens were removed; enforcement still runs. |
| Public API, Webhooks, HubSpot connector, Branding, Branches, Documents | ✅ Done | API keys (hashed, rate-limited), HMAC-signed webhooks, HubSpot OAuth import, white-label branding + domain verification. |
| RFP Management – Phase 1 & 2 | ✅ Done | RFP drafting, AI content generation, vendor invite links, submissions, AI evaluation report, contract award/reject, vendor performance tracking. |
| RFP – security requirement analysis + generate-proposal-from-RFP + dual logos | ✅ Done | `RfpRequirementAnalysis` model, AI security-RFP analysis, proposal generation, RFP logo uploads. |
| AI Prospect Search rebuild (BlackPearl) | ✅ Done | Replaced the old mock/Apollo multi-provider system with the live async BlackPearl playbook API + caching + rate limiting + history + saved searches. |
| Removed features cleanup | ✅ Done | SSO, Knowledge Base, AI Copilot, AI Business Insights, AI Revenue Intelligence, AI Predictions, AI Actions, Sales Automation/Delivery/Import were all deleted (2026-07 / 2026-08). |
| Improvement Audit – **Phase 1** ("quick wins") | ✅ Done (commit `08036eb`) | Proposal Markdown rendering + placeholder-block validation, demo garbage-data cleanup scripts, rate/phone input validation, label-humanising helpers, proposal-content util, misc UI bug fixes. |
| Improvement Audit – Phase 2 (charts, Deals Kanban, richer Prospect Search, sidebar grouping) | 🟡 Partially done | Charts components exist and are used on Dashboard/Finance; **Deals Kanban board** built (`DealsKanbanBoard.tsx` + deal stage endpoint); nav is now grouped into sections (`nav-links.ts`). Command palette added. Prospect Search filter/bulk/pagination polish still limited. |
| Improvement Audit – **Phase 3c** | ✅ Done (commit `d0c0d21`) | New `dashboard` summary module, `guard-compliance` module + table, patrol checkpoint **geofence verification**, patrol run **live location**, `geo.util`. |
| Guard **Emergency Alerts** (panic button) | ✅ Done | `emergency-alerts` module, guard + admin controllers, `EmergencyAlert` model, `GuardPanicButton.tsx`. |
| **Incident Evidence** attachments | ✅ Done | `IncidentEvidence` model, file-storage util, upload/download endpoints, `IncidentEvidencePanel.tsx`. |
| **Client Insurance / Compliance** tracking | ✅ Done | `client-compliance` module, `ClientInsurancePolicy` model, client-portal insurance view, advisory banner. |
| GoHighLevel chat widget + "GHL with Prospect Search" | 🟡 In progress | Chat widget embedded site-wide in `layout.tsx`; deeper GHL/prospect work started (commit `deda430`). |
| Unified cross-portal design system (Phase 3 strategic) | 🔴 Not done | Admin / Client / Guard portals still use different visual languages. |
| Shifts calendar view, full admin patrol dashboard, payment processor | 🔴 Not done | Roadmap items only. |

---

## 8. Important APIs

All under the `/api` prefix. Auth column: **JWT** = admin bearer token,
**Client/Guard JWT** = portal token, **API Key** = `X-API-Key` header,
**Public token** = one-time vendor invitation token.

| Area | Base route | Auth | Purpose |
|---|---|---|---|
| Admin auth | `/auth/*` | Public + JWT | Login, register, refresh, current user. |
| Client / Guard auth | `/client-auth/*`, `/guard-auth/*` | Public | Portal login/registration. |
| Roles / RBAC | `/roles/*` | JWT | Manage roles and permission assignments. |
| Dashboard | `/dashboard/summary` | JWT | Admin home-screen numbers. |
| Leads / Deals / Proposals / Notes / Clients | `/leads/*` `/deals/*` `/proposals/*` `/notes/*` `/clients/*` | JWT | Core CRM. Deals include `PUT /deals/:id/stage`. |
| Sales Accelerator | `/sales-accelerator/*` | JWT | Discovery, scoring, coaching, focus queue. |
| Prospect Search | `/prospect-search/*` | JWT + rate limit | Submit a company name, poll the job, import as lead, saved searches. |
| AI | `/ai/*` | JWT | Proposal drafting and other Gemini helpers. |
| Call Transcription | `/call-transcription/*` | JWT | Upload/transcribe calls, AI analysis. |
| Sites / Guards / Shifts | `/sites/*` `/guards/*` `/v2/guards/*` `/shifts/*` `/v2/shifts/*` | JWT | Field setup and scheduling (+ AI shift recommendations). |
| Guard Compliance | `/guard-compliance/*` | JWT (`guards.view`/`guards.manage`) | Licences, certs, expiry, documents. |
| Patrols | `/checkpoints/*` `/patrol-routes/*` `/patrol-runs/*` | JWT | Admin patrol setup. |
| Incidents | `/incidents/*` (+ evidence upload/download) | JWT | Report, review, attach evidence. |
| Emergency Alerts | `/emergency-alerts/*` (admin), `/guard/emergency-alerts/*` (guard) | JWT / Guard JWT | Panic button raise / acknowledge / resolve. |
| Guard Portal | `/guard/*` | Guard JWT | Shifts, check-in/out, incidents, patrols, offline sync. |
| Invoices / Disputes / Rate Cards / Timesheets / Finance | `/invoices/*` `/invoice-disputes/*` `/rate-cards/*` `/timesheets/*` `/finance/*` | JWT | Billing lifecycle and reporting. |
| Client Compliance | `/client-compliance/*` (admin), `/client/insurance/*` (client) | JWT / Client JWT | Client insurance/COI tracking. |
| Billing | `/billing` | JWT | Plan + usage limits. |
| RFP | `/rfp/*` | JWT | Draft, generate, invite, submissions, evaluate, analyze-requirements, generate-proposal, award/reject, performance. |
| Vendors | `/vendors/*` | JWT | Vendor directory + performance. |
| Vendor Portal | `/vendor/invitation/:token*` | Public token | View one RFP and submit a bid – no login. |
| Public API | `/public/*` | API Key | External programmatic access. |
| Webhooks / API Keys / Integrations / CRM | `/webhooks/*` `/api-keys/*` `/integrations` `/crm-connectors/*` | JWT (+ public OAuth callback) | Outbound events, keys, HubSpot. |
| Branding / Branches / Documents | `/branding/*` `/branches/*` `/documents/*` | JWT (+ public branding lookup) | White-label, regional offices, shared docs. |
| Client Portal | `/client-portal/*` `/client/invoices/*` `/client/incidents/*` `/client/reports/*` | Client JWT | Client self-service. |
| API Docs | `/api-docs*` | Public | Developer documentation page. |

---

## 9. Database Overview

PostgreSQL via Prisma. **66 models** in `backend/prisma/schema.prisma`. The important ones:

| Area | Key models | Represents |
|---|---|---|
| Tenancy & auth | `Tenant`, `Branch`, `User`, `UserSession` | The customer org, its regional offices, staff logins, active sessions. |
| RBAC | `Permission`, `Role`, `RolePermission`, `UserRoleAssignment`, `FieldPermission` | Permission catalog, roles, who has which role, per-field locks. |
| CRM | `Lead`, `Deal`, `Note`, `Activity`, `Proposal`, `ProposalVersion`, `ProposalComment`, `Client`, `ClientUser` | The sales pipeline and the tenant's customers + their portal users. |
| Sales tools | `DiscoverySession`, `SalesAssessment`, `ProspectSearchHistory`, `SavedProspectSearch` | Discovery notes, AI scores, prospect research log. |
| AI | `PromptVersion`, `AiGeneration`, `AiFeedback`, `RecommendationAction`, `AiConversation` | Prompt overrides, AI call logs, feedback. (`AiConversation` is an orphan leftover.) |
| Field ops | `Site`, `Guard`, `GuardCompliance`, `Shift`, `Assignment`, `Availability`, `AttendanceEvent`, `Incident`, `IncidentEvidence`, `DailyServiceReport`, `GuardSyncQueue` | Sites, workforce, compliance docs, scheduling, attendance, incidents + attachments, offline sync. |
| Patrols | `Checkpoint`, `PatrolRoute`, `PatrolRouteCheckpoint`, `PatrolRun`, `PatrolEvent` | Patrol setup and execution (with geofence + live location). |
| Emergencies | `EmergencyAlert` | Guard panic/duress alerts. |
| Finance | `Invoice`, `InvoiceItem`, `InvoiceDispute`, `RateCard`, `Timesheet` | Billing. |
| Client compliance | `ClientInsurancePolicy` | Client Certificate-of-Insurance / policy expiry. |
| RFP & vendors | `Rfp`, `Vendor`, `RfpVendor`, `ProposalSubmission`, `EvaluationReport`, `RfpRequirementAnalysis`, `VendorPerformance` | The procurement domain. |
| Platform | `ApiKey`, `ApiRequestLog`, `Webhook`, `WebhookDelivery`, `CrmConnection`, `TenantBranding`, `CustomDomain`, `SharedDocument` | API access, integrations, branding, documents. |
| Audit | `AuditLog` | Security-sensitive action trail. |

---

## 10. Security

Only mechanisms that actually exist in the code are listed.

- **JWT authentication** – access + refresh token pairs for admin; refresh rotation is
  tied to a tracked `UserSession`. (Frontend currently does not call refresh – sessions
  just expire and require re-login. Tokens live in `localStorage`, not httpOnly cookies.)
- **RBAC** – `PermissionGuard` + `@RequirePermission('key')` on admin routes. Permission
  keys are defined in `backend/src/roles/rbac.constants.ts`. 7 system roles + custom
  roles; a non-super-admin cannot grant a permission they don't hold themselves.
- **Field-Level Permissions** – can hide/lock sensitive fields (e.g. guard salary,
  client billing notes) per role. Enforcement runs; the admin config screen was removed.
- **Tenant isolation** – every tenant-scoped query filters by `tenantId` in application
  code (no DB row-level security).
- **Branch scoping** – a second layer restricting non-super-admin staff to their branch.
- **Audit logging** – `AuditService` writes a tenant-scoped trail (logins, role changes,
  forced logouts, field-access denials, RFP awards/rejections). Read UI shows the latest
  ~100 entries, no filtering.
- **Public API auth** – SHA-256-hashed API keys (plaintext shown once), scoped
  permissions, per-key rate limiting, full request logging.
- **Webhook signing** – every outbound payload is HMAC-SHA256 signed.
- **AI safety screening** – `AiGovernanceService` screens AI output for PII / unsafe
  language before it is marked client-visible (runs in the background).
- **Encrypted OAuth tokens** – HubSpot access/refresh tokens are stored AES-256-GCM
  encrypted.
- **Vendor Portal access** – no login; access to exactly one RFP is gated by a
  cryptographically random single-purpose invitation token plus the RFP due date.

**Known security gaps (documented, not fixed):** tokens in `localStorage`; guard/client
portal sessions aren't tracked; rate limiting and Prospect Search cache are in-memory
per-process (need Redis for multi-instance); some patrol admin permission keys referenced
by the UI may not exist in the RBAC catalog. SSO has been fully removed.

---

## 11. Integrations

| Integration | Status | What it's for |
|---|---|---|
| **Google Gemini** | Active (needs `GEMINI_API_KEY`) | The general AI layer: proposal drafting, sales scoring/coaching, RFP drafting/evaluation, guard-recommendation explanations. Has deterministic fallbacks. |
| **BlackPearl / Bebop** | Optional (needs `BLACKPEARL_API_KEY`) | AI Prospect Search company playbooks. Async job API (jobs can take minutes). No fallback – fails with a `503` if not configured. |
| **OpenAI** | Optional (needs `OPENAI_API_KEY`, currently commented out in `.env`) | Call audio transcription only. No fallback. |
| **HubSpot** | Optional (needs `HUBSPOT_CLIENT_ID` / `SECRET` / `REDIRECT_URI`) | OAuth import of HubSpot contacts into the CRM. |
| **SMTP (Nodemailer)** | Falls back to Ethereal test mailbox | Sends proposal-delivery and RFP vendor-notification emails. |
| **GoHighLevel** | Active (widget script in `frontend/src/app/layout.tsx`) | Embedded live support-chat widget only – not a data sync. |
| **Outbound Webhooks** | Active | Tenant-configured URLs receive signed event notifications. |

---

## 12. Current Project Status

### Completed and working
- Core CRM, Field Operations, Finance, RBAC, Public API/Webhooks, Branding.
- RFP & Vendor Management (drafting → invite → evaluate → award → performance).
- AI Prospect Search on the live BlackPearl provider.
- Improvement Audit **Phase 1** (quick wins) and **Phase 3c** (dashboard module, guard
  compliance, patrol geofence + live location).
- Newer additions: guard Emergency Alerts / panic button, Incident Evidence attachments,
  Client Insurance/Compliance tracking, chart components, Deals Kanban board, grouped
  navigation, command palette.

### Partially completed
- **Improvement Audit Phase 2** – charts and Deals Kanban are in; Prospect Search still
  lacks pagination / bulk actions / a persistent filter sidebar.
- **GoHighLevel + Prospect Search** – widget embedded, deeper integration started.
- **Billing** – plan tiers and usage meters exist, but there is **no payment processor**
  and no self-service upgrade/downgrade (plan is set via environment variables).
- **Client / Guard portals** – functional but visually inconsistent with the admin app.
- Several backend-only capabilities have **no UI**: AI Feedback collection, Sessions
  admin, Field-Permissions admin, Sales Accelerator secondary reports, Leads CSV
  import/export, AI Governance prompt authoring.

### Still needs testing / verification
- Client portal data flows with real populated data (many screens only tested empty).
- Session-expiry stability (the audit reproduced intermittent logouts – needs
  engineering root-cause).
- Whether external keys (HubSpot, OpenAI, BlackPearl) are configured in real production.
- Patrol admin permission keys vs. the RBAC catalog.

### Known limitations
- Patrol checkpoint "scanning" is a manual tap-to-confirm checklist (geofence optional;
  no QR/NFC).
- Custom domains: ownership verification only, no SSL/routing automation.
- Email is limited to proposal + RFP vendor messages.
- Audit log read view has no search/filter/pagination.
- `FINALIZED` RFP status exists but is never set; `AiConversation` table is orphaned.
- Full details: [`docs/FEATURE_DOCUMENTATION.md` §12](docs/FEATURE_DOCUMENTATION.md) and
  [`docs/PRODUCT_IMPROVEMENT_AUDIT.md`](docs/PRODUCT_IMPROVEMENT_AUDIT.md).

---

## 13. How to Run the Project

**Prerequisites:** Node.js 20+, a PostgreSQL database, and a `backend/.env` file.

### Backend
```bash
cd backend
npm install
# create .env with at least:
#   DATABASE_URL=postgresql://...
#   JWT_ACCESS_SECRET=...  JWT_REFRESH_SECRET=...
#   JWT_ACCESS_EXPIRES_IN=...  JWT_REFRESH_EXPIRES_IN=...
#   PORT=5000
#   GEMINI_API_KEY=...            (optional – AI falls back without it)
#   BLACKPEARL_API_KEY=...        (optional – Prospect Search needs it)
#   SMTP_HOST/PORT/USER/PASS      (optional – uses Ethereal test mail otherwise)
npx prisma migrate deploy        # apply database migrations
npx prisma generate              # generate the Prisma client
npm run start:dev                # starts the API on http://localhost:5000/api
```
Optional: `npx ts-node scripts/seed-admin.ts` (and `scripts/seed-demo.ts`) to create a
first admin user / demo data. Check each script before running it.

### Frontend
```bash
cd frontend
npm install
# frontend/.env:
#   NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev                       # starts Next.js on http://localhost:3000
```

### Windows shortcut
From the repo root, `start-all.bat` opens both servers in separate windows
(`start-backend.bat` = `npm run start:dev`, `start-frontend.bat` = `npm run dev`).

### Deployment
`render.yaml` deploys the frontend on Render.com; the backend is a separate Render web
service. `NEXT_PUBLIC_API_URL` points the frontend at the deployed backend `/api`.

---

## 14. Important Documentation

| File | What it's for |
|---|---|
| [`docs/FEATURE_DOCUMENTATION.md`](docs/FEATURE_DOCUMENTATION.md) | **The main reference.** Every feature with status (✅ / 🟡 / 🔴), architecture, DB mapping, API summary, user workflows, role permissions, security, known limitations, and removed features. Verified against source on 2026-08-10. |
| [`docs/features/01-authentication-security.md`](docs/features/01-authentication-security.md) | Deep dive: the three portals' auth, RBAC, field-level permissions, sessions, audit. |
| [`docs/features/02-crm-core.md`](docs/features/02-crm-core.md) | Deep dive: Leads, Deals, Proposals, Notes, Clients. |
| [`docs/features/03-sales-tools.md`](docs/features/03-sales-tools.md) | Deep dive: Sales Accelerator, AI Prospect Search. |
| [`docs/features/04-ai-features.md`](docs/features/04-ai-features.md) | Deep dive: every AI feature and exactly which provider/fallback it uses. |
| [`docs/features/05-field-operations.md`](docs/features/05-field-operations.md) | Deep dive: Sites, Guards, Shifts, Attendance, Patrols, Incidents, Guard Portal + offline. |
| [`docs/features/06-finance.md`](docs/features/06-finance.md) | Deep dive: Invoices, Disputes, Rate Cards, Timesheets, Finance reporting, Billing. |
| [`docs/features/07-platform-integrations.md`](docs/features/07-platform-integrations.md) | Deep dive: Public API, Webhooks, HubSpot, Branches, Branding, Client Portal, Email. |
| [`docs/features/08-rfp-vendor-management.md`](docs/features/08-rfp-vendor-management.md) | Deep dive: the RFP → vendor bid → evaluate → award → performance flow. |
| [`docs/PRODUCT_IMPROVEMENT_AUDIT.md`](docs/PRODUCT_IMPROVEMENT_AUDIT.md) | A hands-on UX/product audit of the live app (2026-08-14) with a prioritised Phase 1/2/3 roadmap. This is the current work backlog. |
| [`backend/src/prospect-search/README.md`](backend/src/prospect-search/README.md) | How the BlackPearl integration, caching, history, and saved searches work. |
| [`frontend/AGENTS.md`](frontend/AGENTS.md) | Warning: this Next.js version has breaking changes – read `node_modules/next/dist/docs/` before writing frontend code. |

---

## 15. Quick Developer Guide

**If you are new to this project, start here:**

1. **Read [`docs/FEATURE_DOCUMENTATION.md`](docs/FEATURE_DOCUMENTATION.md) sections 1–4.**
   That gives you the product, the four user types, the architecture diagram, and the
   full feature list with status markers.
2. **Open [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).** The data
   model is the fastest way to understand what the app actually does. Skim the 66 models
   grouped as in section 9 above.
3. **Look at one backend module end to end** – e.g. `backend/src/leads/`. Every module
   follows the same `controller → service → dto` pattern, so once you understand one you
   understand all of them.
4. **Look at [`backend/src/app.module.ts`](backend/src/app.module.ts)** for the full list
   of modules, and **[`backend/src/roles/rbac.constants.ts`](backend/src/roles/rbac.constants.ts)**
   for every permission key.
5. **On the frontend**, start at [`frontend/src/lib/nav-links.ts`](frontend/src/lib/nav-links.ts)
   (the whole admin navigation), then [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts)
   and one feature page under `frontend/src/app/` plus its matching `frontend/src/lib/*.ts`
   API client. **Read [`frontend/AGENTS.md`](frontend/AGENTS.md) first** – this Next.js
   version differs from older ones.
6. **Read the relevant `docs/features/0X-*.md`** deep-dive for whatever area you're
   assigned to.
7. **Check [`docs/PRODUCT_IMPROVEMENT_AUDIT.md`](docs/PRODUCT_IMPROVEMENT_AUDIT.md)** for
   the current backlog and where the team is in the Phase 1/2/3 roadmap.
8. **Run it locally** using section 13, log in as an admin (seed script), and click
   through the app with the schema and feature doc open beside you.

Suggested reading order in one line:
**Feature doc → Prisma schema → one backend module → app.module.ts + rbac.constants.ts →
frontend nav-links + one page → area-specific feature doc → improvement audit.**
