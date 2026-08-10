[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Sales Tools

This domain covers the tools that help sales staff find, qualify, and move prospects through the pipeline before a deal is won: an AI-assisted discovery/coaching workspace, and an AI-driven, single-company sales-intelligence tool.

> **Removed since the last documentation pass (2026-08-07):** three previously-documented features in this domain — **Sales Automation** (the background stalling-deal scanner), **Sales Delivery** (follow-up email/calendar drafting), and **Sales Data Import (CSV)** — have been **entirely deleted** from the codebase. Their backend modules (`sales-automation`, `sales-delivery`, `sales-imports`), frontend pages (`/sales-automation`, `/sales-delivery`, `/sales-imports`), and sidebar entries no longer exist. They are omitted from this document rather than described as available functionality. The follow-up task capability they used to provide is now covered by the Sales Accelerator's own manual and AI-generated follow-up sequences (see below, and `docs/features/02-crm-core.md` Activities).

---

# 14. Sales Accelerator (Discovery & AI Coaching)

## Purpose
Gives sales reps a single workspace per lead or deal that captures structured discovery notes and turns them, plus the deal's ongoing activity, into AI-assisted coaching: readiness scoring, momentum tracking, forecasting, objection-pattern analysis, follow-up sequencing, and post-close feedback.

## Overview
When a rep talks to a prospect, they record structured discovery answers (property type, guard count, current provider, pain points, risk concerns, objections, decision timeline, budget sensitivity). From that point on, the Sales Accelerator continuously derives insight from this data plus the deal's activity history and, once a deal closes, real field-operations outcomes (incidents, invoices, staffing) — so the same workspace that helped win the deal also tells the rep whether it was sold accurately.

## What User Can Do
- View a tenant-wide Sales Accelerator dashboard: top leads, at-risk deals, stalled deals, forecast-risk deals, objection patterns, and deals missing discovery
- Open a per-lead or per-deal workspace showing discovery data, AI assessment, deal momentum, forecast, pricing guardrails, and value justification
- Capture/update discovery details for a lead or a deal
- Generate an AI discovery guide (suggested questions to ask next)
- Paste in a call transcript (or upload audio via Call Transcription) and get AI discovery-call analysis (what was covered, what's missing)
- Get real-time "live coaching" suggestions during/after a call
- Generate an AI outreach plan for a lead or deal
- Run AI lead/deal scoring (produces a `SalesAssessment` record)
- Generate a proposal directly from captured discovery notes
- Create a single manual follow-up task, or auto-generate a full multi-step follow-up sequence

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
- **Frontend:** `/sales-accelerator` (single-page dashboard: top leads, at-risk/stalled deals, objection patterns), plus the `SalesAcceleratorPanel` component embedded on lead/deal detail pages for the per-entity workspace, and the `/sales-calls` page for transcript-driven analysis/coaching.
- **Note on unreachable endpoints:** the backend controller also exposes `GET /sales-accelerator/alerts`, `/forecast-report`, `/coaching-analytics`, and `/learning-loop` (each with a working service method and a corresponding `lib/sales-accelerator.ts` client function), but the current `/sales-accelerator` page only calls `GET /sales-accelerator/dashboard` — the dedicated `/sales-accelerator/reports` page that used to render these four endpoints was removed on 2026-08-07 and has not been rebuilt. These four capabilities are therefore backend-complete but currently unreachable from the UI.

## Key Capabilities
- Structured discovery capture per lead/deal (`DiscoverySession`)
- AI-or-fallback lead/deal scoring (`SalesAssessment`) with priority tier, close-readiness, discovery-quality, and risk profile
- Deal momentum and forecast computation (stalled/urgent/watch/healthy, commit/likely/at-risk) — **backend-complete, currently without a dedicated reporting page**
- Objection-pattern mining across discovery + assessments, with win/loss outcome correlation — **backend-complete, currently without a dedicated reporting page**
- Pricing guardrails and rate-card-based revenue estimation
- Proposal generation seeded directly from discovery notes
- Manual and AI-generated multi-step follow-up sequences, with progress tracking
- Post-close "learning loop" comparing what was sold against real incidents/staffing/invoicing outcomes — **backend-complete, currently without a dedicated reporting page**
- Per-rep coaching analytics — **backend-complete, currently without a dedicated reporting page**

## Current Status
**Fully Implemented for the dashboard and per-entity workspace.** This is one of the most extensively built features in the platform — the backend service alone is thousands of lines of scoring/forecasting/coaching logic. The core dashboard and lead/deal workspace are fully wired end-to-end. Four secondary reporting views (alerts, forecast report, coaching analytics, learning loop) are backend-complete and unit-ready but **currently have no frontend page** after the `/sales-accelerator/reports` route was removed — this should be treated as a known gap, not full loss of functionality, since the underlying data still drives the main dashboard's summary cards.

**[Insert Screenshot Here]**

---

# 15. AI Prospect Search

## Purpose
Lets a sales rep type in the name of a single target company and get back an AI-generated sales "playbook" for that company — business summary, value propositions, sales angles, key personas, likely objections (with suggested responses), a sample meeting note, and a readiness signal — which they can review and import straight into the CRM as a new Lead.

## Overview
This is a **single-company deep-research tool, not a multi-company discovery/filter search.** A rep types one company name and submits it. The backend hands that company name to **BlackPearl** (also referred to as "Bebop" in code comments) — a dedicated, external, paid B2B sales-intelligence API — which asynchronously generates a detailed playbook for that specific company. BlackPearl playbook generation is genuinely slow (commonly 10–15 minutes, and BlackPearl has confirmed jobs can take upwards of 10+ minutes), so the search is implemented as an async job: the initial request returns immediately with a job ID, and the frontend polls a status endpoint every 15–30 seconds (backing off automatically on transient errors) for up to 30 minutes until the playbook is ready. A completed result is cached per tenant+company for a period so re-searching the same company doesn't re-trigger a fresh (slow, billed) BlackPearl job. There is **no natural-language filter search, no ranked list of multiple candidate companies, and no separate mock/Apollo/Crunchbase/Clearbit data source** in the current code — all of that from earlier versions of this feature has been replaced by the single-company BlackPearl integration.

## What User Can Do
- Type a single company name and generate an AI sales playbook for it
- Watch generation progress (with an honest "typically 10–15 minutes" expectation set in the UI) while BlackPearl works
- View the resulting playbook: business summary, business objective, value propositions, sales angles, key personas (name/title/description), potential objections (with suggested responses), a sample meeting note, a contact overview, a readiness level (e.g. hot/warm), and a link to the full BlackPearl-hosted document if provided
- Import the searched company directly as a new Lead (auto-populated with an import note built from whatever profile fields are available), with automatic duplicate-lead detection and an "import anyway" override
- Save a searched company name for later re-use, rename or delete saved searches
- View recent search history

## Workflow
```
Rep types a company name and submits
        ↓
System checks cache (same tenant + company, within TTL)
— if cached, the playbook is returned instantly
        ↓
Otherwise: backend submits a playbook job to BlackPearl and
immediately returns a job ID (no waiting on this request)
        ↓
Frontend polls the job-status endpoint every 15-30s, showing a
progress indicator (backing off automatically on transient 503s)
        ↓
When BlackPearl reports the job "succeeded," its result is normalized
into the platform's playbook format, cached, and shown to the rep
        ↓
Rep reviews the playbook (summary, value props, personas, objections,
readiness level) and, if it's a good fit, imports it as a new Lead
```

## Business Value
- Gives a rep genuine researched sales intelligence on a specific target account — objection handling, personas, and talking points — rather than requiring manual research before a call.
- Reduces duplicate CRM clutter via automatic duplicate detection on import.
- Caching avoids paying for (and waiting on) a repeat BlackPearl job for a company that was already researched recently.

## Technical Summary
- **Modules:** `prospect-search`
- **Key logic:** `ProspectSearchService.search()` submits a job via `BlackPearlInsightProvider.submitPlaybookJob()` (`POST {BLACKPEARL_BASE_URL}/playbooks`) and returns a job ID immediately; `getSearchJobStatus()` is polled by the frontend and calls `BlackPearlInsightProvider.getJobResult()` (`GET {BLACKPEARL_BASE_URL}/jobs/{id}`) — the same job ID is reused for every poll, a job is never resubmitted just because a status check failed. A single HTTP call to BlackPearl is retried up to 3 times with exponential backoff for transient failures (network error, timeout, 429, 5xx — including 503, which BlackPearl has confirmed is a transient condition where the job keeps running server-side); 401/403/404 are never retried. `getCompanyInsight()` (used for the detail-drawer AI panel) tries a short 3-attempt/2-second poll against BlackPearl first and **falls back to a direct, synchronous Gemini call** (`AiService.generateProspectCompanyInsight`) if BlackPearl doesn't finish in that short window — so the panel always shows something, but a same-session Gemini-sourced insight may be less detailed than a fully-completed BlackPearl playbook.
- **Configuration:** requires `BLACKPEARL_API_KEY` to be set; if it is not configured, `POST /prospect-search/search` fails immediately with a clear `503 Service Unavailable` rather than silently returning fake data. `BLACKPEARL_BASE_URL` and `BLACKPEARL_BRAND_PROFILE_KEY` are optional overrides.
- **Database tables:** `ProspectSearchHistory`, `SavedProspectSearch`; imports write a new `Lead` and an accompanying `Note` (reusing the existing Leads/Notes modules rather than a separate prospect table)
- **Frontend:** `/prospect-search` page (single company-name input, recent/saved search chips, progress indicator during generation) and a `ProspectDetailsDrawer` component that lazily fetches/display the AI playbook and handles the lead-import flow.

## Key Capabilities
- Single-company, deep-research AI playbook generation via a dedicated live external provider (BlackPearl)
- Asynchronous job submission + resilient polling (auto-retry, transient-error backoff, 30-minute cap)
- Per-tenant, per-company response caching to avoid duplicate paid jobs
- Fast-path Gemini fallback for the inline company-insight panel when BlackPearl hasn't finished quickly
- One-click import to Lead with duplicate detection
- Saved searches (create/rename/delete) and search history
- Per-user rate limiting on search/insight/import calls

## Current Status
**Fully Implemented as a single-company sales-intelligence tool**, backed by a genuinely live external provider (BlackPearl), not a mock dataset. This is a meaningfully different feature from the multi-company, filter-based "AI Prospect Search" described in earlier documentation — that version (Gemini-parsed natural-language filters against a company database, with Apollo/Crunchbase/Clearbit/mock providers) no longer exists in the codebase; it was fully replaced by this BlackPearl-based, single-company playbook tool on 2026-08-07. There is currently no way to discover multiple candidate companies from a description — a rep must already know which specific company they want researched.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
