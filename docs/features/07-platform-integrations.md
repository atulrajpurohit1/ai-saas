[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Platform & Integrations

This domain covers the features that connect the platform to the outside world (public API, webhooks, CRM), that let a company organize itself internally (branches), that let a company make the product look like their own (branding, domains), and that let a company's own clients self-serve (client portal, shared documents, daily reports, email).

---

# 46. Public API & API Keys

## Purpose
Lets a company connect its own external systems (custom apps, internal tools, scripts) to its data in the platform using a secure, tenant-scoped API key instead of a personal login.

## Overview
An admin generates one or more named API keys, each with its own specific set of permissions (e.g. "read clients," "write shifts") and its own rate limit. Any external system holding that key can then call a dedicated set of public endpoints to read or create records — clients, sites, guards, shifts, incidents, invoices, and reports — completely separately from the admin app's own login system.

## What User Can Do
- Create a named API key and choose exactly which permissions it has
- Set a custom rate limit and an optional expiry date per key
- View all keys, their usage in the last 24 hours, and when they were last used
- Revoke a key immediately
- Regenerate a key's secret (invalidating the old one) without recreating the whole key record
- View the catalog of available public API permissions

## Workflow
```
Admin opens Integrations → creates a named API key
        ↓
Admin selects specific permissions (e.g. clients.read, shifts.write)
        ↓
System generates the key once and shows it in full — it is never shown again
        ↓
External system calls /api/public/* endpoints with the key in the X-API-Key header
        ↓
Every request is checked for a valid, active, non-expired key and the right permission
        ↓
Every request is logged (endpoint, method, status, IP, user agent)
        ↓
Admin can revoke or regenerate the key at any time
```

## Business Value
- Lets enterprise clients and internal tooling integrate with the platform's data safely, without sharing real user logins.
- Fine-grained permissions mean a key can be scoped to exactly what an integration needs (e.g. read-only reporting) rather than all-or-nothing access.
- Per-key rate limiting and full request logging protect the platform from runaway or abusive integrations and give admins an audit trail of external access.

## Technical Summary
- **Modules:** `public-api` (the actual public-facing endpoints), `api-keys` (key management)
- **Key logic:** Keys are generated as a random secret, SHA-256 hashed before storage (the plaintext key is shown only once, at creation/regeneration), and prefixed for display (`masked_key`). A `PublicApiKeyGuard` authenticates every request via the `X-API-Key` header (or a `Bearer` token), checks the key's status/expiry, enforces a per-key, per-minute in-memory rate limit, and logs every request (including denied ones) to `ApiRequestLog`. The public API exposes read/write endpoints for clients, sites, guards, shifts (including guard assignment), incidents, invoices (read-only), and daily reports (read-only); several write actions also fire outbound webhook events and audit log entries.
- **Database tables:** `ApiKey`, `ApiRequestLog`
- **Frontend:** API key management is part of the unified Settings → Integrations page (`/integrations`) — create/list/revoke/regenerate keys, view permission catalog and last-24h usage.

## Key Capabilities
- Scoped, named API keys with a defined permission catalog (12 permission keys across 6 resource groups)
- SHA-256 hashed key storage; plaintext shown only once
- Per-key rate limiting (default 120 requests/minute, configurable)
- Optional key expiry
- Full request logging, including denied (403/429) requests
- Public endpoints for Clients, Sites, Guards, Shifts (+assign), Incidents, Invoices (read), Reports (read)
- Automatic audit logging and webhook triggering from public API writes

## Current Status
**Fully Implemented.** One technical caveat worth noting for scaling: the rate limiter is in-memory per server process, which is correct for a single backend instance but would need a shared store (e.g. Redis) to behave correctly if the backend is horizontally scaled to multiple instances.

**[Insert Screenshot Here]**

---

# 47. Webhooks

## Purpose
Lets a company automatically notify its own external systems the moment something happens in the platform (a new incident, a guard assignment, an invoice being paid), instead of that system having to repeatedly poll the API for changes.

## Overview
An admin registers a webhook by choosing an event type and providing a destination URL. From then on, whenever that event happens anywhere in the platform, the system sends a signed HTTP POST to that URL with the event's data, automatically retrying a few times if the destination doesn't respond successfully.

## What User Can Do
- View the catalog of supported webhook event types
- Register a webhook for a specific event type and destination URL
- View all registered webhooks and their most recent delivery status
- Rotate a webhook's signing secret
- Revoke (disable) a webhook
- View a delivery log (success/failure, response status, retry count, last error) across all webhooks
- Manually retry a single failed delivery, or retry all recent failures in bulk

## Workflow
```
Admin registers a webhook (event type + destination URL)
        ↓
System generates a signing secret for that webhook
        ↓
A supported business event occurs (e.g. incident.created, invoice.paid)
        ↓
System builds a signed payload and POSTs it to the destination URL
        ↓
Destination responds success → delivery marked successful
Destination fails/times out → automatic retry (up to 3 attempts, with backoff)
        ↓
Admin can review delivery history and manually retry any failed delivery
```

## Business Value
- Enables real-time integration with external systems (ticketing, notification, or reporting tools) without custom polling code.
- Cryptographic signing lets the receiving system verify a webhook genuinely came from this platform, protecting against spoofed requests.
- Delivery logging and manual retry give admins visibility and control when an external endpoint is temporarily down.

## Technical Summary
- **Modules:** `webhooks`
- **Key logic:** Each webhook gets a random `whsec_`-prefixed secret. Outgoing payloads are signed with HMAC-SHA256 over `timestamp.body` and sent as the `X-Ai-Saas-Signature` header (verifiable with `timingSafeEqual`), alongside `X-Ai-Saas-Event`, `X-Ai-Saas-Delivery-Id`, and `X-Ai-Saas-Timestamp` headers. Delivery uses a 5-second timeout and up to 3 automatic retries with linear backoff; every attempt (success or failure) is recorded. A shared `triggerEvent()` method is called from other modules (notably the Public API) to fan a business event out to every active webhook subscribed to it.
- **Database tables:** `Webhook`, `WebhookDelivery`
- **Frontend:** Webhook management is part of the unified Settings → Integrations page (`/integrations`) — register/revoke webhooks, rotate secrets, view delivery logs, retry failed deliveries.

## Key Capabilities
- 8 supported event types (`client.created`, `guard.created`, `shift.created`, `shift.assigned`, `incident.created`, `incident.approved`, `invoice.generated`, `invoice.paid`)
- HMAC-SHA256 signed payloads with replay-resistant timestamping
- Automatic retry (3 attempts) with exponential-ish backoff, plus manual single or bulk retry
- Secret rotation without disabling the webhook
- Full delivery history with response status and error detail
- Full audit trail (created/updated/revoked/triggered/failed)

## Current Status
**Fully Implemented.** Delivery, signing, retry, and logging all work end-to-end and are wired into real business events triggered from the Public API layer.

**[Insert Screenshot Here]**

---

# 48. Integrations Overview Dashboard

## Purpose
Gives an admin a single screen that summarizes the health and activity of every external-facing integration (API keys, webhooks, CRM connection) without having to check each one separately.

## Overview
The Integrations page pulls together active-key counts, active-webhook counts, CRM connection status, recent API request logs, and recent webhook delivery logs into one dashboard, so an admin can quickly spot problems (like a spike in failed webhook deliveries) and manage every integration type from one place.

## What User Can Do
- See counts of active API keys, active webhooks, and connected CRM integrations
- See total API requests in the last 24 hours and failed webhook deliveries in the last 24 hours
- Browse recent API request logs (which key, endpoint, method, status code, IP, user agent)
- Browse recent webhook delivery logs (event type, destination, success/failure, retry count, error)
- Jump directly into managing API keys, webhooks, or the CRM connector from the same page

## Workflow
```
Admin opens Settings → Integrations
        ↓
Dashboard loads: active integration counts, 24h usage stats,
recent request logs, recent webhook deliveries
        ↓
Admin reviews activity and failures at a glance
        ↓
Admin drills into API Keys, Webhooks, or CRM Connector sections
on the same page to take action
```

## Business Value
- Reduces the operational effort of monitoring integrations — one page instead of several.
- Surfaces integration failures (like a webhook silently failing) before they become a client-facing problem.

## Technical Summary
- **Modules:** `integrations` (aggregation), reusing data from `api-keys`, `webhooks`, and `crm-connectors`
- **Key logic:** A single `getOverview()` call runs parallel counts and recent-record queries against `ApiKey`, `Webhook`, `ApiRequestLog`, `WebhookDelivery`, and `CrmConnection`, scoped to the tenant, and returns a combined summary (active integrations, 24h API usage, per-webhook success/failure tallies, and the 25 most recent request/delivery log entries).
- **Database tables:** `ApiKey`, `ApiRequestLog`, `Webhook`, `WebhookDelivery`, `CrmConnection`
- **Frontend:** `/integrations` — a single page (~800 lines) combining this overview with the API Keys, Webhooks, and CRM Connector management UIs.

## Key Capabilities
- Real-time counts of active API keys, webhooks, and CRM connections
- 24-hour API usage and webhook-failure summary statistics
- Recent request and delivery logs (last 25 of each)
- Per-webhook success/failure counters

## Current Status
**Fully Implemented.** A genuine aggregation dashboard, not a static placeholder — every number and log entry is a live query against real platform activity.

**[Insert Screenshot Here]**

---

# 49. CRM Connector (HubSpot)

## Purpose
Lets a company that already tracks contacts in HubSpot pull those contacts into this platform's lead pipeline, instead of re-entering them by hand.

## Overview
An admin connects their HubSpot account through a standard OAuth authorization flow. Once connected, they can trigger a one-click import that pulls HubSpot contacts into the CRM as Leads (creating new ones or updating existing matches), and can disconnect the integration at any time.

## What User Can Do
- Connect a HubSpot account (OAuth authorization)
- View connection status (connected/not connected, HubSpot portal name, granted scopes, last sync time, last error)
- Import HubSpot contacts into the Leads pipeline on demand
- Disconnect HubSpot at any time

## Workflow
```
Admin clicks "Connect HubSpot" in Integrations
        ↓
Admin is redirected to HubSpot's own login/authorization screen
        ↓
HubSpot redirects back with an authorization code
        ↓
System exchanges the code for access/refresh tokens (encrypted at rest)
        ↓
Admin clicks "Import Contacts"
        ↓
System pulls HubSpot contacts and creates/updates matching Leads
        ↓
Admin can disconnect at any time, revoking the stored tokens
```

## Business Value
- Removes duplicate data entry for companies already using HubSpot for marketing/contact management.
- Encrypted token storage and a standard OAuth flow mean the integration follows expected security practice for third-party connections.

## Technical Summary
- **Modules:** `crm-connectors`
- **Key logic:** Implements HubSpot's OAuth 2.0 authorization-code flow with an HMAC-signed, time-limited `state` parameter (anti-CSRF). Access and refresh tokens are encrypted with AES-256-GCM before being stored, and access tokens are automatically refreshed when near expiry. Contact import matches on email (or name+company) to decide whether to update an existing `Lead` or create a new one, and records created/updated/skipped counts.
- **Database tables:** `CrmConnection` (generic `provider` column — currently only ever populated with `hubspot`), writes to `Lead`
- **Frontend:** CRM connector management is part of the unified Settings → Integrations page (`/integrations`).

## Key Capabilities
- OAuth 2.0 connect/disconnect flow with CSRF-protected state
- AES-256-GCM encrypted token storage
- Automatic token refresh
- One-click contact import with create/update/skip reporting
- Connection status and last-sync/last-error visibility

## Current Status
**Fully Implemented, HubSpot only.** Despite the generic module name (`crm-connectors`) and a `provider` column designed to support multiple CRMs, **HubSpot is the only CRM provider actually implemented** — there is no Salesforce, Pipedrive, Zoho, or other connector wired into any layer of the codebase. This should be described to stakeholders as a single-CRM integration, not a multi-CRM connector framework.

**[Insert Screenshot Here]**

---

# 50. Multi-Branch Management

## Purpose
Lets a company that operates from multiple regional offices split its guards, clients, sites, and staff visibility by branch, instead of everyone seeing one undifferentiated pool of company-wide data.

## Overview
A super admin can create branches (e.g. "North Region," "South Region"), assign a branch manager to each, and then assign staff, clients, sites, guards, and shifts to a specific branch. Non-super-admin staff are automatically restricted to seeing only their own branch's data (plus unassigned/company-wide records), while super admins continue to see everything across all branches.

## What User Can Do
- Super admin: create a branch (name, location, manager, status)
- Super admin: update a branch's details or reassign its manager
- View branch details, including record counts (clients, sites, guards, shifts, incidents, invoices, reports, users) per branch
- Any user with branch visibility permissions: list branches they have access to

## Workflow
```
Super admin creates a branch and assigns a manager
        ↓
That manager's account is automatically linked to the branch
(and can no longer act as a super admin)
        ↓
Staff, clients, sites, guards, and shifts get tagged with a branch
        ↓
A non-super-admin user's queries are automatically filtered to their
own branch (plus company-wide/unassigned records)
        ↓
Super admins continue to see and manage every branch
```

## Business Value
- Supports real multi-office organizational structures without needing separate tenant accounts per region.
- Branch managers get exactly the visibility they need — their own operation — without seeing other regions' sensitive data.
- Reduces administrative overhead: one company account, cleanly partitioned internally.

## Technical Summary
- **Modules:** `branches`, with a shared `branch-scope.ts` helper (`branchWhere`, `resolveWriteBranchId`, `branchScopedWhere`) consumed across many other modules (sites, guards, shifts, invoices, reports, and more) to enforce branch-level visibility consistently.
- **Key logic:** Only super admins can create or update branches. Assigning a manager to a branch automatically demotes that user from super admin and links them to the branch. Non-super-admin read/write operations are transparently scoped to the caller's own branch (or company-wide/unassigned records) by the shared branch-scope helper; a mismatched requested branch is rejected with a 403.
- **Database tables:** `Branch` (referenced by `User`, `Client`, `Site`, `Guard`, `Shift`, `Incident`, `Invoice`, `DailyServiceReport`, `UserRoleAssignment`)
- **Frontend:** `/branches` (list + create) and `/branches/[id]` (branch detail with record counts).

## Key Capabilities
- Branch creation/update restricted to super admins
- Automatic manager-to-branch linking
- Branch-scoped visibility enforced consistently across many modules (not just a UI filter)
- Per-branch record counts on the branch detail view
- Full audit trail of branch creation/updates

## Current Status
**Fully Implemented.** Branch scoping is enforced at the query level (not just hidden in the UI) and is reused consistently by many other feature modules, which is a stronger guarantee than a typical "add a branch filter" implementation.

**[Insert Screenshot Here]**

---

# 51. White-Label Branding & Custom Domains

## Purpose
Lets a company make the platform look and feel like their own product — their logo, their colors, their support contact — and, in principle, host it under their own domain name.

## Overview
An admin can set a company name, logo, favicon, color palette, login background, welcome message, and support contact details, which are then reflected across the admin login screen, generated PDFs (proposals, invoices, reports), and outbound emails. Separately, an admin can register a custom domain and prove they own it by adding a DNS TXT record.

## What User Can Do
- Set company name, logo, favicon, primary/secondary/accent colors, login background, welcome message, and support email/phone
- See branding reflected in PDF headers (proposals, invoices, daily reports) and in outbound emails
- Add a custom domain to the tenant
- Retrieve the DNS TXT record value needed to prove domain ownership
- Trigger domain ownership verification

## Workflow
```
Admin sets company branding (logo, colors, support contact) in Settings → Branding
        ↓
Branding is immediately reflected in generated PDFs and emails
        ↓
Admin adds a custom domain (e.g. portal.theircompany.com)
        ↓
System issues a unique verification token and the required DNS TXT record
        ↓
Admin adds that TXT record at their DNS provider
        ↓
Admin clicks "Verify" — system checks DNS for the record
        ↓
Domain is marked "verified" if found
```

## Business Value
- Reinforces the client's own brand identity rather than exposing the underlying software vendor, which matters for enterprise/white-label deals.
- Consistent branding across login, documents, and email builds a more professional, trustworthy client experience.

## Technical Summary
- **Modules:** `branding`
- **Key logic:** Branding is stored per tenant and applied through two shared helper methods — `addPdfHeader()` (used by proposal, invoice, and daily report PDF generation) and `emailShell()` (used by the email module) — so a single branding record consistently styles multiple output surfaces. Custom domain ownership is checked by an actual DNS TXT record lookup (`_ai-saas.<domain>` must contain the issued token) using Node's `dns.resolveTxt`. A public, unauthenticated endpoint resolves branding by verified custom domain or tenant slug, for use on public-facing pages (e.g. a branded login screen).
- **Database tables:** `TenantBranding`, `CustomDomain`
- **Frontend:** Settings → Branding page (`/settings/branding`), which combines branding controls and custom domain management (add domain, copy TXT record, verify) in one screen.

## Key Capabilities
- Full branding customization (name, logo, favicon, 3 theme colors, login background, welcome message, support contact)
- Branding automatically applied to PDFs and emails via shared helpers
- Public branding lookup by domain or tenant slug (for pre-login branded pages)
- Real DNS TXT record domain-ownership verification
- Full audit trail of branding and domain changes

## Current Status
**Partially Implemented.** Branding customization itself, and its application to PDFs/emails, is fully working. **Domain *ownership* verification is real** (an actual DNS TXT lookup, not a stub). However, **there is no SSL certificate provisioning and no traffic routing for a verified custom domain** — the `sslStatus` field only ever transitions to `"provisioning"` on verification and is never advanced to `"active"` anywhere in the codebase, and nothing in the platform serves the app under the customer's own domain or manages a certificate for it. In practice, verifying a domain today proves ownership but does not make the app reachable at that domain. This should be described to stakeholders as domain-ownership verification only, not a working custom-domain hosting feature.

**[Insert Screenshot Here]**

---

# 52. Shared Documents

## Purpose
Gives admins a simple way to share files (contracts, certificates, compliance documents) with a specific client, viewable in that client's own portal.

## Overview
An admin uploads/links a document (name, URL, optional description) to a specific client. The client can then see and download it from their Client Portal, and the sharing action is recorded in that client's activity timeline.

## What User Can Do
- Admin: share a document with a specific client (name, URL, description)
- Admin: list all shared documents, optionally filtered by client
- Admin: delete a shared document
- Client: view and download documents shared with them

## Workflow
```
Admin uploads/links a document and selects the target client
        ↓
Document record is created and tied to that client
        ↓
Action is recorded in the client's timeline (audit trail)
        ↓
Client logs into the Client Portal and sees the document
in their Documents section
        ↓
Client downloads the document via its stored URL
```

## Business Value
- Centralizes contract/compliance document sharing instead of email attachments getting lost.
- Gives clients self-service access to their own paperwork at any time.

## Technical Summary
- **Modules:** `documents` (admin-facing), consumed by `client-portal` (client-facing read)
- **Key logic:** A document is a simple metadata + URL reference (name, description, URL, associated client) — the platform does not implement its own file storage/upload pipeline; the URL is expected to point to an already-hosted file. Every share and deletion is audit-logged.
- **Database tables:** `SharedDocument`
- **Frontend:** Admin document management (create/list/delete, scoped by client) and the client-facing `/client/documents` page for viewing/downloading.

## Key Capabilities
- Tenant- and client-scoped document sharing
- Full audit trail (`DOCUMENT_SHARED`, `DOCUMENT_DELETED`)
- Client-side read-only access restricted to their own documents

## Current Status
**Fully Implemented** as a metadata/URL-reference system. One clarification for stakeholders: this is not a file upload/storage service — it stores a link to a file (e.g. hosted elsewhere), not the file's binary content itself.

**[Insert Screenshot Here]**

---

# 53. Client Portal (self-service)

## Purpose
Gives a company's own clients a self-service window into their proposals, invoices, incidents, daily service reports, and documents — without needing to email the office for updates.

## Overview
Once a client has portal access (see Client Portal Authentication in the Authentication & Security document), they land on a dedicated client dashboard where they can review and act on proposals, view and dispute invoices, review approved incident reports for their sites, view published daily service reports, and download shared documents — all automatically scoped to their own company's data only.

## What User Can Do
- View and export (PDF) their proposals; approve, reject, or comment on them
- View a proposal's activity timeline (approvals, rejections, comments, document shares)
- View invoices, download as PDF, accept an invoice, or raise a dispute
- View approved incident reports for their own sites
- View published daily service reports and download them as PDF
- View and download documents shared with them by the admin
- View/manage their own client profile

## Workflow
```
Client logs into the Client Portal
        ↓
Client dashboard shows proposals, invoices, incidents, reports, documents
— all scoped to their own company only
        ↓
Client reviews a proposal → approves / rejects / comments
        ↓
Client reviews an invoice → downloads PDF → accepts or disputes
        ↓
Client reviews approved incident reports and published daily reports
        ↓
Client downloads shared documents as needed
```

## Business Value
- Reduces admin workload by letting clients self-serve routine information requests.
- Builds transparency and trust — clients see real-time status rather than waiting on the phone or email.
- Faster proposal turnaround and invoice resolution (accept/dispute) directly in the portal.

## Technical Summary
- **Modules:** `client-portal` (proposals, comments, timeline, documents, profile), plus dedicated client-scoped controllers in `invoices` (`client-invoices.controller.ts`), `incidents` (`client-incidents.controller.ts`), and `reports` (`client-reports.controller.ts`)
- **Key logic:** Every client-portal endpoint checks that the caller's JWT carries `role: 'client'` and a `clientId`, and every query is filtered by both `tenantId` and `clientId` so a client can never see another client's records. Incident visibility is restricted to `approved` status only; daily reports are restricted to `published` status only — draft/internal records are never exposed to clients.
- **Database tables:** `Proposal`, `ProposalVersion`, `ProposalComment`, `Invoice`, `InvoiceDispute`, `Incident`, `DailyServiceReport`, `SharedDocument`, `Client`, `ClientUser`, `AuditLog`
- **Frontend:** `/client/dashboard`, `/client/proposals/[id]`, `/client/invoices` (+`[id]`), `/client/incidents` (+`[id]`), `/client/reports` (+`[id]`), `/client/documents`, `/client/profile` — a full separate portal experience sharing the same Next.js codebase as the admin app.

## Key Capabilities
- Proposal review, approval/rejection, commenting, PDF export, and activity timeline
- Invoice viewing, PDF download, acceptance, and dispute submission
- Approved-only incident visibility
- Published-only daily service report visibility, with PDF download
- Shared document viewing/download
- Strict tenant + client data isolation on every endpoint
- Full audit trail of client actions (approvals, rejections, comments, disputes, downloads)

## Current Status
**Fully Implemented.** All the client-facing read/write flows above are real, connected end-to-end (UI → API → service → database), and consistently scoped to prevent cross-client data leakage. (Authentication mechanics and known session-related gaps for this portal are covered separately in `docs/features/01-authentication-security.md`.)

**[Insert Screenshot Here]**

---

# 54. Email Notifications

## Purpose
Sends a client an email when a proposal is ready for them to review, so they don't have to log in speculatively to check.

## Overview
An admin can trigger a single proposal email (for one lead) or a bulk send across all leads that have both an email address and a generated proposal. The email is branded with the tenant's own company name, colors, and support contact, and includes the proposal content inline.

## What User Can Do
- Send a single proposal email to a specific lead
- Send proposal emails in bulk to every eligible lead in the tenant, with a summary of how many were sent/skipped and why

## Workflow
```
Admin generates a proposal for a lead
        ↓
Admin clicks "Send Email" (single) or "Send All" (bulk)
        ↓
System checks the lead has an email and a proposal
        ↓
System sends a branded HTML email with the proposal content
        ↓
Proposal status is updated to "sent"
        ↓
(Development/no-SMTP-configured) A preview link to the test inbox is returned
```

## Business Value
- Speeds up the sales cycle by proactively notifying prospects rather than relying on them to check the portal.
- Branded email presentation reinforces the client's own company identity in every proposal communication.

## Technical Summary
- **Modules:** `email`
- **Key logic:** Uses Nodemailer with SMTP credentials read from environment variables; if no `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are configured, it falls back to Ethereal's test SMTP service (a non-production sandbox inbox), and returns a preview URL for the sent message rather than delivering to a real mailbox. Email content is rendered through the same `BrandingService.emailShell()` helper used elsewhere, so styling matches the tenant's branding.
- **Database tables:** Reads/updates `Lead`, `Proposal`
- **Frontend:** Triggered from the Leads/Proposals UI (send / send-all actions); no dedicated "Email" settings page.

## Key Capabilities
- Single and bulk proposal email sending
- Tenant-branded HTML email template
- Skip reporting for bulk sends (missing email vs. missing proposal)
- Proposal status auto-updated to "sent"

## Current Status
**Partially Implemented.** The `email` module's scope is genuinely limited to proposal-delivery emails only — there is no welcome email, password-reset email, invoice-reminder email, or any other transactional email type built on this module. It also defaults to a non-production Ethereal test mailbox unless real SMTP credentials are set in the environment, so out of the box, "sent" emails are not actually delivered to a real inbox. (Note: a second, independent email-sending capability exists for AI-drafted deal follow-up emails in the Sales Delivery feature — see `docs/features/03-sales-tools.md` — which uses its own Nodemailer transporter and defaults to a local JSON mock transport rather than Ethereal. The two are separate code paths, not a shared notification system.)

**[Insert Screenshot Here]**

---

# 55. API Documentation

## Purpose
Gives developers integrating with the Public API a single, browsable reference for every available endpoint, its inputs, and how to verify webhook signatures.

## Overview
The platform serves a machine-readable OpenAPI 3.0 document describing the Public API, plus a simple human-readable HTML page (both backend-hosted and mirrored in the admin frontend) that renders those endpoints, along with an explanation of how to validate webhook signatures.

## What User Can Do
- View a list of all Public API endpoints (method, path, summary, description)
- View/download the raw OpenAPI 3.0 JSON document
- Read instructions for validating webhook HMAC signatures

## Workflow
```
Developer opens the API Docs page (backend-hosted or in-app)
        ↓
Page fetches the OpenAPI JSON document
        ↓
Endpoints are rendered as a browsable list
        ↓
Developer copies request/response shapes and authentication
requirements (X-API-Key header) to build their integration
```

## Business Value
- Reduces integration friction and support requests for companies building on the Public API.
- A public, standards-based (OpenAPI) reference signals platform maturity to technical evaluators during enterprise sales.

## Technical Summary
- **Modules:** `api-docs`
- **Key logic:** `buildOpenApiDocument()` hand-assembles an OpenAPI 3.0 document (info, servers, security scheme, schemas, and paths) describing the `public-api` module's endpoints; it is served as both raw JSON (`/api-docs/openapi.json`) and a self-contained HTML page that fetches and renders that JSON client-side.
- **Database tables:** None (static/generated document, not database-backed)
- **Frontend:** Backend-served HTML page at `/api-docs`, and a mirrored in-app page at `/api-docs` in the Next.js app that fetches the same OpenAPI JSON from the backend.

## Key Capabilities
- OpenAPI 3.0 JSON document, publicly accessible without authentication
- Human-readable HTML rendering of all documented endpoints
- Webhook signature verification instructions
- Mirrored inside the admin frontend as well as backend-hosted

## Current Status
**Fully Implemented.** The document is hand-maintained (not auto-generated from decorators), so it should be kept in sync manually as Public API endpoints change; today it accurately reflects the endpoints described in the Public API feature above.

**[Insert Screenshot Here]**

---

# 56. Custom Reports (Daily Service Reports)

## Purpose
Produces a per-site, per-day operational summary — who worked, when, and what incidents occurred — that can be reviewed internally and then published for the client to see.

## Overview
An admin generates a daily service report for a specific site and date; the system automatically pulls together every shift scheduled that day, each assigned guard's attendance (check-in/out and hours worked), and any approved incidents, into a single structured summary. The report starts as an internal draft and can be published, at which point it becomes visible to the client and feeds the AI Knowledge Base.

## What User Can Do
- Generate a daily report for a site and date (auto-compiled from real shift/attendance/incident data)
- View a report's full detail (totals, per-shift guard attendance, approved incidents)
- Export a report as a branded PDF
- Publish a draft report, making it visible to the client
- (Client) view and download published reports for their own sites

## Workflow
```
Admin selects a site and date, clicks "Generate Report"
        ↓
System pulls all shifts for that site/date, each guard's
check-in/check-out attendance, and any approved incidents
        ↓
A structured draft report is created (totals, shift-by-shift detail)
        ↓
Admin reviews the draft, exports it as PDF if needed
        ↓
Admin publishes the report
        ↓
Report becomes visible/downloadable to the client in their portal,
and is added as searchable context for the AI Knowledge Base
```

## Business Value
- Gives clients concrete, data-backed proof of service delivery (who was on site, for how long, and what happened) without manual report-writing.
- Publishing (rather than auto-sharing every draft) lets admins review for accuracy before a client ever sees it.
- Feeds real operational history into the AI layer, improving future AI-generated answers and insights.

## Technical Summary
- **Modules:** `reports` (`ReportsService`, `ReportsController` for admin, `ClientReportsController` for the client-facing read/download endpoints)
- **Key logic:** Report generation queries `Shift` (with assignments + attendance events) and approved `Incident` records for the given site/date window, computes attendance status and worked hours per guard, and stores the resulting structured summary as JSON in a single `summary` text column. Reports move through a `draft → published` status lifecycle; only `published` reports are ever visible to the `client-reports` endpoints. PDF export reuses the shared branding PDF header helper. Publishing a report also creates a `KnowledgeEntry` via the Knowledge Base service so it can ground future AI answers.
- **Database tables:** `DailyServiceReport` (report metadata + JSON summary), reads `Shift`, `Assignment`, `AttendanceEvent`, `Incident`, `Site`, `Client`
- **Frontend:** `/reports` (+`[id]`) for admin generate/view/publish/export, and `/client/reports` (+`[id]`) for the client-facing published-only view and PDF download.

## Key Capabilities
- Automatic compilation from real shift, attendance, and incident data (not manually typed)
- Draft/published status gating for client visibility
- Branded PDF export (admin and client)
- Branch-scoped visibility for admin users
- Feeds the AI Knowledge Base on publish
- Full audit trail (generated/viewed/published/exported/downloaded)

## Current Status
**Fully Implemented.** Report generation genuinely aggregates live operational data rather than being a manual free-text form, and the draft/publish gate is enforced on the backend (not just hidden in the UI) — a client cannot fetch an unpublished report by ID.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
