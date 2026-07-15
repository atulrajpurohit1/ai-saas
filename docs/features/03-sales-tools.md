[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Sales Tools

This domain covers the tools that help sales staff find, qualify, and move prospects through the pipeline before a deal is won: an AI-assisted discovery/coaching workspace, a background follow-up automation engine, one-click follow-up email/calendar delivery, bulk CSV import, and an AI-driven company search tool.

---

# 15. Sales Accelerator (Discovery & AI Coaching)

## Purpose
Gives sales reps a single workspace per lead or deal that captures structured discovery notes and turns them, plus the deal's ongoing activity, into AI-assisted coaching: readiness scoring, momentum tracking, forecasting, objection-pattern analysis, and post-close feedback.

## Overview
When a rep talks to a prospect, they record structured discovery answers (property type, guard count, current provider, pain points, risk concerns, objections, decision timeline, budget sensitivity). From that point on, the Sales Accelerator continuously derives insight from this data plus the deal's activity history and, once a deal closes, real field-operations outcomes (incidents, invoices, staffing) — so the same workspace that helped win the deal also tells the rep whether it was sold accurately.

## What User Can Do
- View a tenant-wide Sales Accelerator dashboard: top leads, at-risk deals, stalled deals, forecast-risk deals, objection patterns, and deals missing discovery
- Open a per-lead or per-deal workspace showing discovery data, AI assessment, deal momentum, forecast, pricing guardrails, and value justification
- Capture/update discovery details for a lead or a deal
- Generate an AI discovery guide (suggested questions to ask next)
- Paste in a call transcript and get AI discovery-call analysis (what was covered, what's missing)
- Get real-time "live coaching" suggestions during/after a call
- Generate an AI outreach plan for a lead or deal
- Run AI lead/deal scoring (produces a `SalesAssessment` record)
- Generate a proposal directly from captured discovery notes
- Create a single manual follow-up task, or auto-generate a full multi-step follow-up sequence
- View coaching analytics per rep (discovery quality, objection handling, coaching score) and a forecast report across the whole pipeline
- Review a "learning loop" of post-close feedback — how deals that were won are actually performing operationally

## Workflow
```
Rep opens a Lead or Deal workspace
        ↓
Rep captures discovery details (property type, guard count,
pain points, risk concerns, objections, timeline, budget)
        ↓
System (AI or rule-based fallback) scores the lead/deal —
lead score, close-readiness, discovery-quality, risk profile
        ↓
Rep requests a discovery guide, outreach plan, or live-call coaching as needed
        ↓
Dashboard surfaces stalled/at-risk deals and objection patterns tenant-wide
        ↓
Rep generates a proposal straight from the discovery notes
        ↓
Deal closes → post-close operational data (incidents, staffing, invoices)
feeds back into a "learning loop" reviewed against what was promised
```

## Business Value
- Standardizes discovery so deal quality doesn't depend purely on an individual rep's memory or discipline.
- Surfaces stalling and at-risk deals proactively instead of relying on managers to notice.
- Closes the loop between sales promises and operational reality, improving future proposal accuracy and pricing discipline.
- Coaching analytics give sales managers an evidence-based way to identify where a rep needs support.

## Technical Summary
- **Modules:** `sales-accelerator` (backend), consumes `ai`, `ai-monitoring`, `audit`, `activities`, `proposals`
- **Key logic:** `SalesAcceleratorService` computes deal momentum, forecast trend, pricing guardrails, value justification, market-signal profiling, objection-pattern mining, and post-close feedback largely with deterministic scoring logic layered on top of AI-generated drafts (discovery guide, outreach plan, call analysis, live coaching, discovery-based proposal) — every AI call has an explicit rule-based fallback if Gemini is unavailable, logged and surfaced via `AiMonitoringService`.
- **Database tables:** `DiscoverySession`, `SalesAssessment` (plus reads `Lead`, `Deal`, `Activity`, `Proposal`, `Incident`, `Shift`, `Invoice`, `DailyServiceReport`, `RateCard` for post-close/pricing context)
- **Frontend:** `/sales-accelerator` (dashboard + alerts + coaching analytics + learning loop), `/sales-accelerator/reports` (forecast report), plus the `SalesAcceleratorPanel` component embedded on lead/deal detail pages for the per-entity workspace.

## Key Capabilities
- Structured discovery capture per lead/deal (`DiscoverySession`)
- AI-or-fallback lead/deal scoring (`SalesAssessment`) with priority tier, close-readiness, discovery-quality, and risk profile
- Deal momentum and forecast computation (stalled/urgent/watch/healthy, commit/likely/at-risk)
- Objection-pattern mining across discovery + assessments, with win/loss outcome correlation
- Pricing guardrails and rate-card-based revenue estimation
- Proposal generation seeded directly from discovery notes
- Manual and AI-generated multi-step follow-up sequences, with progress tracking
- Post-close "learning loop" comparing what was sold against real incidents/staffing/invoicing outcomes
- Per-rep coaching analytics and a tenant-wide forecast report

## Current Status
**Fully Implemented.** This is one of the most extensively built features in the platform — the backend service alone is thousands of lines of scoring/forecasting/coaching logic, and it is fully wired to real dashboard, workspace, and reporting pages in the frontend, not just API endpoints.

**[Insert Screenshot Here]**

---

# 16. Sales Automation

## Purpose
Automatically catches deals that are going quiet — no recent activity, weak discovery, low readiness scores, unresolved objections — and creates a follow-up task or reminder without a manager having to notice and chase it manually.

## Overview
A background job runs on a fixed interval (24 hours by default) across every tenant, scanning open (non-won/non-lost) deals. For each deal, it checks whether a follow-up is already pending or was already auto-created; if not, and the deal shows signs of stalling, it automatically creates a follow-up `Activity` (an email task if the lead has an email on file, otherwise a generic task) explaining why the deal needs attention.

## What User Can Do
- View the automation's current status (enabled/disabled, configured interval, whether a run is in progress, the last run's summary)
- Manually trigger an on-demand automation run for their own tenant
- See the auto-created follow-up activities appear on the relevant deal, tagged with a `[Sales Automation]` marker so they're clearly distinguishable from manually created tasks

## Workflow
```
Background timer fires (default: every 24 hours)
        ↓
System loads every tenant and scans their open deals
        ↓
For each deal: skip if a pending automation task already exists
or a future activity is already scheduled
        ↓
Otherwise, check stall signals — days since last activity,
missing discovery, low close-readiness/discovery-quality scores,
unresolved objections
        ↓
If any signal fires, auto-create a follow-up Activity due the next morning
        ↓
Run summary (deals scanned/skipped, activities created, errors) is recorded
```

## Business Value
- Prevents deals from silently going cold due to a busy rep simply forgetting to follow up.
- Requires no admin configuration to start protecting the pipeline — it runs automatically once the backend is deployed.
- Gives managers a lightweight, explainable signal ("why was this task created?") rather than an opaque black box.

## Technical Summary
- **Modules:** `sales-automation`
- **Key logic:** `SalesAutomationService` implements `OnModuleInit`/`OnModuleDestroy` to start/stop a `setInterval` timer (`SALES_AUTOMATION_INTERVAL_MINUTES`, default 1440 minutes / 24h; can be disabled via `SALES_AUTOMATION_DISABLED=true`). Stall detection is rule-based (no AI call): days since last activity ≥ 7, missing discovery, close-readiness/discovery-quality below threshold, or open objections. Every tenant is scanned in the same run; a manual `POST /sales-automation/run` re-runs the same logic for the caller's own tenant on demand.
- **Database tables:** reads `Deal`, `Lead`, `Activity`, `DiscoverySession`, `SalesAssessment`; writes `Activity` (and an `AuditLog` entry per auto-created task)
- **Frontend:** `/sales-automation` page showing status, interval, last run summary, and a manual "Run now" action.

## Key Capabilities
- Tenant-wide background scan on a configurable interval (default 24h)
- Rule-based stalling-deal detection (no AI dependency, so it can't fail due to AI outages)
- Idempotent — will not create a duplicate follow-up if one is already pending
- Manual on-demand run per tenant
- Full audit trail of every auto-created follow-up

## Current Status
**Fully Implemented.** The background scheduler, stall-detection logic, and manual trigger are all real and connected to a working status page — this is a genuine automated background job, not a UI-only stub.

**[Insert Screenshot Here]**

---

# 17. Sales Delivery (Email & Calendar)

## Purpose
Lets a rep send a follow-up email to a deal's contact, and generate a calendar invite for the next scheduled follow-up, directly from the deal — without leaving the CRM or manually composing anything from scratch.

## Overview
Using the deal's latest AI assessment and discovery notes, the system drafts a follow-up email referencing the specific risk/value points already captured, and lets the rep preview it before sending via the platform's configured mail server. Separately, it can generate a downloadable `.ics` calendar file for the deal's next follow-up activity, ready to import into any calendar app.

## What User Can Do
- Preview an auto-drafted follow-up email for a deal (subject + body, personalized with the contact's name, company, discovered risk, and value angle)
- Send that follow-up email directly to the lead's contact email
- Download a calendar invite (`.ics` file) for the deal's next scheduled follow-up activity

## Workflow
```
Rep opens a deal and requests a follow-up draft
        ↓
System pulls the deal's latest assessment/discovery/next activity
and drafts a subject + body referencing the specific risk/value points
        ↓
Rep reviews the draft
        ↓
Rep sends it (delivered via the tenant's configured SMTP server,
branded with the tenant's company name/support email)
        ↓
A completed "email" Activity is logged against the deal
        ↓
Rep can also download a .ics calendar file for the next follow-up
```

## Business Value
- Saves reps time drafting a personalized-sounding follow-up from scratch.
- Ensures follow-ups reference the actual discovery/risk context captured for that deal, rather than a generic template.
- Reduces missed follow-ups by making a calendar invite one click away.

## Technical Summary
- **Modules:** `sales-delivery`
- **Key logic:** `SalesDeliveryService.draftDealFollowUp` builds the email content with **deterministic template logic** (not an AI call) using the deal's latest `SalesAssessment`/`DiscoverySession`/`Activity` records. `sendDealFollowUp` sends via `nodemailer`, using real SMTP credentials if configured (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) or falling back to an in-memory `jsonTransport` (no real delivery) if not — the same SMTP-or-Ethereal pattern used by the rest of the platform's email sending. `calendarForDeal` hand-builds a valid iCalendar (`.ics`) file for the next pending activity.
- **Database tables:** reads `Deal`, `Lead`, `Activity`, `DiscoverySession`, `SalesAssessment`; writes a completed `Activity` record on send, plus an `AuditLog` entry
- **Frontend:** `/sales-delivery` page for drafting/sending the email and downloading the calendar file.

## Key Capabilities
- Context-aware follow-up email drafting (rule-based, referencing real discovery/assessment content)
- Real SMTP email delivery (brand-aware sender name/HTML shell via the tenant's branding settings)
- Downloadable `.ics` calendar invite generation for the next follow-up
- Automatic activity logging on send, with audit trail

## Current Status
**Fully Implemented**, with one caveat shared by the rest of the platform's email capability: if the tenant has not configured real SMTP credentials, sends succeed against an in-memory test transport rather than actually reaching an inbox (mirrors the Email Notifications feature's known Ethereal-by-default limitation). The drafting logic itself is rule-based text templating, not an AI-generated email — this should be described to stakeholders accurately as "smart templating," not full AI email generation.

**[Insert Screenshot Here]**

---

# 18. Sales Data Import (CSV)

## Purpose
Lets a sales team bulk-load leads and deals — plus their discovery details — from a spreadsheet/CRM export, instead of manually entering each prospect one at a time.

## Overview
An admin uploads a CSV file. The system automatically detects which columns map to which fields (contact name, company, email, deal name/stage, and a full set of discovery fields like pain points, risk concerns, and objections) using a built-in alias dictionary, and shows a preview before committing. On commit, it creates or updates matching leads and deals, and creates a `DiscoverySession` for any row that contains discovery-relevant data.

## What User Can Do
- Upload a CSV file and get an automatic column-mapping preview (with sample rows)
- Adjust the detected column mapping before committing
- Choose whether the import creates leads only, or leads + deals
- Commit the import and receive a summary: rows processed/skipped, leads/deals created vs. updated vs. matched, discovery sessions created, and any row-level errors

## Workflow
```
Admin uploads a CSV export (leads or deals)
        ↓
System parses the header row and auto-detects column mapping
using a built-in alias dictionary (e.g. "Account Name" → company)
        ↓
Admin reviews/adjusts the mapping and a sample-row preview
        ↓
Admin commits the import
        ↓
For each row: match or create a Lead (by email or name+company),
optionally match or create a Deal, and create a DiscoverySession
if discovery-relevant columns are present
        ↓
Admin receives a row-by-row summary, including any errors
```

## Business Value
- Removes the manual data-entry bottleneck when onboarding a large existing prospect list or migrating from another CRM/spreadsheet.
- Automatic column detection reduces setup friction — most common header names are recognized without configuration.
- Populating discovery data at import time means imported prospects can immediately benefit from Sales Accelerator scoring and coaching.

## Technical Summary
- **Modules:** `sales-imports`
- **Key logic:** `SalesImportsService` parses CSV via `csv-parser`, detects column mapping against a fixed `FIELD_ALIASES` dictionary covering both CRM fields (name/company/email/status/deal name/stage) and discovery fields (property type, guard count, pain points, risk concerns, objections, etc.), then performs idempotent create-or-update matching for `Lead` (by email, or by name+company) and `Deal` (by lead + deal name), and conditionally creates a `DiscoverySession` per row.
- **Database tables:** writes `Lead`, `Deal`, `DiscoverySession`; logs to `AuditLog`
- **Frontend:** `/sales-imports` page with file upload, mapping-preview UI, and a commit-summary view.

## Key Capabilities
- Automatic column-mapping detection via alias matching
- Preview mode before committing (sample rows, detected mapping, row counts)
- Leads-only or leads+deals import targets
- Idempotent matching — re-importing the same file updates rather than duplicates
- Automatic discovery-session creation from mapped discovery columns
- Per-row error reporting without failing the whole batch

## Current Status
**Fully Implemented.** Preview and commit endpoints are both real, both connected to a working frontend page with file upload and a mapping/preview/summary flow — this is a complete, usable feature end to end, not a backend-only capability (note this is distinct from the separate Lead-record CSV export/import gap called out for Core CRM, which has no dedicated UI).

**[Insert Screenshot Here]**

---

# 19. AI Prospect Search

## Purpose
Lets a sales rep describe the kind of company they're looking for in plain English (e.g. "mid-size property management companies in Texas with 50-200 employees") and get back a ranked list of matching companies they can review and import straight into the CRM as a new Lead.

## Overview
A natural-language prompt is turned into structured search filters (industry, location, employee range, revenue range, keywords) by Gemini. Those filters are then matched against a **company data source** — today, that source is a small fixed set of built-in sample security-industry companies, not a live external company database. Results are ranked by how well they match the parsed filters and keywords, cached per tenant/provider/prompt for a few minutes to avoid repeat AI/provider calls, and rate-limited per user to control cost and abuse. A rep can view an AI-generated insight about a specific company, save/rename/delete favorite search prompts, review recent search history, and import any result directly as a new Lead (with automatic duplicate detection).

## What User Can Do
- Type a natural-language prospecting request and get a ranked list of matching companies
- View an AI-generated "why this company is a good fit" insight for any result
- Import a company result directly as a new Lead (auto-populated with an import note summarizing the company)
- Get warned and choose to proceed if the import looks like a duplicate of an existing lead
- Save a search prompt for later re-use, rename or delete saved searches
- View recent search history

## Workflow
```
Rep types a natural-language prospecting request
        ↓
System checks cache (same tenant + provider + prompt, within TTL)
— if cached, returns instantly with no AI or provider call
        ↓
Otherwise: Gemini parses the prompt into structured filters
(industry, location, employee count, revenue range, keywords)
        ↓
The configured company data source is queried for candidate companies
        ↓
Candidates are scored/ranked against the parsed filters
        ↓
Rep reviews results, optionally requests an AI insight on one,
and imports promising ones as new Leads
```

## Business Value
- Speeds up prospecting by letting a rep describe an ideal customer profile in their own words instead of manually researching companies.
- Reduces duplicate CRM clutter via automatic duplicate detection on import.
- Caching and rate limiting keep AI/provider costs predictable even with heavy day-to-day use.

## Technical Summary
- **Modules:** `prospect-search`
- **Key logic:** `ProspectSearchService.search()` calls `AiService.generateProspectSearchFilters()` (Gemini) to parse the prompt, then calls an injected `CompanyRepository` (the actual data source) to fetch candidate companies, then ranks them with a deterministic keyword/field-match scoring function. The data source is selected by the `COMPANY_PROVIDER` environment variable via `resolveCompanyProviderName()` in `providers/provider.config.ts`, defaulting to `'mock'`. `ProspectSearchCacheService` is an in-memory, per-process TTL cache (default 300s) keyed by tenant+provider+prompt; `ProspectSearchRateLimitService`/`ProspectSearchRateLimitGuard` enforce an in-memory per-user rate limit (default 20/minute) on search, insight, and import calls.
- **Database tables:** `ProspectSearchHistory`, `SavedProspectSearch`; imports write a new `Lead` and an accompanying `Note` (reusing the existing Leads/Notes modules rather than a separate prospect table)
- **Frontend:** `/prospect-search` page (search bar, ranked results, AI insight panel, save/history controls) and a `ProspectDetailsDrawer` component for reviewing/importing a single result.

## Key Capabilities
- Natural-language-to-structured-filter parsing via Gemini
- Deterministic match-scoring/ranking of results against parsed filters
- AI-generated per-company fit insight
- One-click import to Lead with duplicate detection
- Saved searches (create/rename/delete) and search history
- In-memory response caching and per-user rate limiting

## Current Status
**Partially Implemented — verified mock data source.** The AI filter parsing, ranking, caching, rate limiting, saved searches, history, and lead-import flow are all real and fully wired end to end (UI → API → service → database). However, **the actual company data returned by a search is not live external data**: reading `backend/src/prospect-search/data/mock-companies.data.ts` confirms a fixed, hardcoded set of **22 sample companies** (all fictitious security-services firms with `.example.com` websites), returned unfiltered by `MockCompanyRepositoryService` and filtered/ranked only after the fact. This is also the **default behavior out of the box** — the `COMPANY_PROVIDER` environment variable defaults to `mock` if unset.
Three additional providers exist in code:
- **Apollo** (`ApolloCompanyProvider`) has a genuinely working live-API implementation — it calls Apollo's real `mixed_companies/search` endpoint when `APOLLO_API_KEY` is configured, and normalizes real results. However, it **automatically and silently falls back to the same 22-company mock dataset** whenever the key is missing, the request fails, or Apollo is unreachable — so unless that key is deliberately configured and working, the experience is identical to the mock provider with no visible warning to the end user.
- **Crunchbase** and **Clearbit** providers are confirmed placeholders — they compile and boot, but calling them always throws a `ServiceUnavailableException` ("not yet implemented"), which the module.ts wiring confirms is the only behavior available for those two provider names today.

For client-facing communication, this feature should be described as **a fully functional AI-assisted prospecting workflow currently running against a small built-in sample dataset**, not against a live company database — enabling real external data (Apollo with a valid key today; Crunchbase/Clearbit pending real implementation) is the key remaining step to make results reflect actual market prospects rather than the same 22 sample companies every time.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
