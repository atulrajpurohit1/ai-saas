[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Finance

This domain covers how the platform turns approved guard work into client billing: generating and managing invoices, handling client disputes over those invoices, defining contracted billing rates, approving worked hours, reporting on financial performance, and the tenant's own subscription plan.

---

# 40. Invoice Generation & Management

## Purpose
Automates turning a period of approved guard timesheets into a professional client invoice, so finance staff don't have to manually calculate billing from shift records.

## Overview
An admin picks a client (and site, if the client has more than one), a billing date range, and generates an invoice. The system automatically pulls every approved timesheet in that window, prices it using the client's or site's active rate card (or a manual rate as a fallback), and produces a line-itemized invoice. From there the invoice moves through a lifecycle — draft, issued, disputed, resolved, paid, or cancelled — and can be downloaded as a branded PDF by both admin staff and the client.

## What User Can Do
- Generate an invoice for a client/site over a billing date range, from approved timesheets
- View all invoices tenant-wide, or filtered to a branch
- View a single invoice with its full line-item breakdown (guard, shift, hours, rate, amount)
- Issue a draft invoice to the client
- Mark an invoice paid once payment is received
- Cancel a non-paid invoice
- Download a branded PDF of the invoice (admin)
- (Client Portal) view their own invoices, accept, dispute, and download a PDF copy

## Workflow
```
Guard checks in/out for shifts
        ↓
Timesheets are auto-created from those shifts (see Timesheet Management)
        ↓
Admin/supervisor approves the relevant timesheets
        ↓
Admin selects a client, site, and billing date range and generates an invoice
        ↓
System finds the applicable active rate card (site-level, then client-level,
or a manual rate) and prices every approved timesheet in range
        ↓
Invoice is created in "draft" with a line item per shift/guard
        ↓
Admin issues the invoice → status becomes "issued"
        ↓
Client views, downloads, accepts, or disputes it in the Client Portal
        ↓
Admin marks it "paid" once payment is received
```

## Business Value
- Removes manual invoice calculation and the errors that come with it — billing is generated directly from verified worked hours.
- Guarantees a client is billed only for hours an admin has actually approved.
- Produces a professional, branded, downloadable invoice document without any manual formatting work.
- The dispute-aware lifecycle (disputed → resolved → re-issuable) keeps a contested invoice from silently blocking payment collection.

## Technical Summary
- **Modules:** `invoices` (`InvoicesController` for admin, `ClientInvoicesController` for the Client Portal)
- **Key logic:** One invoice per client/site/billing-period is enforced by a unique database constraint; invoice numbers are sequential per tenant per day (`INV-YYYYMMDD-####`). Rate resolution checks a site-specific active rate card first, then a client-level one, then falls back to a manually entered rate if explicitly allowed. PDF generation (PDFKit) is shared between the admin export endpoint and the client download endpoint and is rendered with the tenant's branding (via `BrandingService`). Field-level permissions strip the `internalAdjustments` field before any client-facing response. Invoice generation and payment both fire tenant webhook events (`invoice.generated`, `invoice.paid`).
- **Database tables:** `Invoice`, `InvoiceItem`, `RateCard` (referenced for pricing), `Timesheet` (source of billable hours)
- **Frontend:** `/invoices` (list + generate form) and `/invoices/[id]` (detail, issue/mark-paid/cancel, PDF download) for admins; `/client/invoices` and `/client/invoices/[id]` (view, download, accept, dispute) for clients.

## Key Capabilities
- Auto-numbered invoices, one per client/site/billing-period
- Automatic rate resolution: site rate card → client rate card → manual rate fallback
- Full lifecycle: Draft → Issued → Disputed → Resolved → Paid / Cancelled
- Branded PDF export for admins and download for clients
- Outbound webhook events on generation and payment
- Full audit trail of every lifecycle transition (generated, issued, paid, cancelled, downloaded)

## Current Status
**Fully Implemented.** One technical nuance worth flagging: a `RateCard` can capture an `overtime_rate` and a `holiday_rate` in addition to its base hourly rate, but invoice generation currently applies only the single resolved hourly rate to every approved hour on the invoice — overtime/holiday differential billing is captured as data on the rate card but is not yet applied differently during invoice calculation.

**[Insert Screenshot Here]**

---

# 41. Invoice Dispute Resolution

## Purpose
Gives a client a formal way to contest a billed invoice, and gives finance staff a structured, auditable process to review, respond to, and close that dispute.

## Overview
A client can dispute any invoice that has been issued to them, providing a reason and description. This immediately flags the invoice as "disputed." Admin staff see a queue of disputes; opening one automatically moves it "under review." From there, an admin can add a response note, then resolve it (closing the dispute and returning the invoice to a payable "resolved" status) or reject it (closing the dispute and reverting the invoice back to "issued," i.e. the original bill stands). Only one dispute can be open on an invoice at a time.

## What User Can Do
- **Client:** submit a dispute (reason + description) on an issued invoice; view the dispute's status and the admin's response
- **Admin:** view all disputes for the company; open a dispute (which moves it to "under review"); add a response note without closing it; resolve a dispute (invoice becomes payable again); reject a dispute (original invoice stands)

## Workflow
```
Client opens an issued invoice they disagree with
        ↓
Client submits a dispute (reason + description)
        ↓
Invoice status becomes "disputed"
        ↓
Admin opens the dispute → status auto-moves to "under review"
        ↓
Admin optionally adds a response note to communicate back to the client
        ↓
Admin resolves the dispute (invoice → "resolved", billable again)
   or rejects it (invoice reverts to "issued", original amount stands)
        ↓
Client sees the updated dispute status and the admin's response
```

## Business Value
- Gives clients a legitimate, trackable channel to question a bill instead of simply refusing to pay or emailing back and forth.
- Protects the company by requiring exactly one open dispute per invoice and a clear resolution trail.
- A resolved dispute is automatically captured as organizational knowledge, so similar future situations can be answered faster (see AI Copilot / Knowledge Base).

## Technical Summary
- **Modules:** `invoice-disputes` (admin review/respond/resolve/reject), with dispute *submission* itself living in `InvoicesService.disputeInvoice` (client-facing)
- **Key logic:** A conflict check blocks a second open dispute on the same invoice. Status moves through `open` → `under_review` → `resolved`/`rejected`. Resolving or rejecting a dispute runs inside a database transaction that also updates the parent `Invoice`'s status (`resolved` or back to `issued`, respectively). Resolved disputes are pushed into the Knowledge Base (`KnowledgeBaseService.createFromDispute`) so AI Copilot can reference how similar disputes were previously handled.
- **Database tables:** `InvoiceDispute`, `Invoice`
- **Frontend:** `/invoice-disputes` (admin queue) and `/invoice-disputes/[id]` (respond/resolve/reject); the dispute submission form is embedded directly in `/client/invoices/[id]` on the Client Portal.

## Key Capabilities
- Client-initiated disputes, restricted to issued invoices only
- One active dispute per invoice enforced server-side
- Admin respond / resolve / reject workflow
- Automatic invoice status sync across the dispute lifecycle
- Resolved disputes automatically feed the Knowledge Base for AI grounding
- Full audit trail (dispute opened, moved under review, responded to, resolved/rejected)

## Current Status
**Fully Implemented.**

**[Insert Screenshot Here]**

---

# 42. Rate Card Management

## Purpose
Lets finance staff define the contracted hourly billing rate for a client (and optionally a specific site), so invoice generation always uses the correct, pre-approved rate instead of relying on manual entry every time.

## Overview
A rate card is created for a client, optionally scoped down to one of that client's sites, with a base hourly rate (plus optional overtime and holiday rates), an effective date range, and an active/inactive status. When an invoice is generated, the system automatically looks for the most specific matching rate card — a site-level one first, then a client-level one — for the billing period in question.

## What User Can Do
- Create a rate card (client, optional site, role name, hourly/overtime/holiday rate, effective date range)
- View all rate cards, optionally filtered by status
- View a single rate card's detail
- Update a rate card's rates, dates, or status
- Deactivate a rate card

## Workflow
```
Admin opens Rate Cards and creates one for a client
(optionally scoped to a specific site), with a rate and effective dates
        ↓
Rate card becomes active
        ↓
When an invoice is later generated for that client/site/billing period,
the system automatically matches the site-level rate card first,
falling back to the client-level one
        ↓
The invoice locks in the resolved rate at the moment of generation
```

## Business Value
- Centralizes the pricing agreed with each client so it is applied consistently, removing manual pricing mistakes on invoices.
- Supports rate changes over time (via effective date ranges) without disturbing already-generated historical invoices.
- Site-level overrides let a client with multiple locations be billed differently per site where contracts differ.

## Technical Summary
- **Modules:** `rate-cards`
- **Key logic:** Two-level rate resolution — a site-scoped active rate card takes priority over a client-scoped one — matched against the invoice's billing date range via `effectiveFrom`/`effectiveTo`. Validation ensures a site belongs to the specified client and tenant, and that `effective_to` is never before `effective_from`.
- **Database tables:** `RateCard`
- **Frontend:** `/rate-cards` (list, filterable by status) and `/rate-cards/[id]` (detail/edit)

## Key Capabilities
- Client-level and site-level rate cards
- Optional overtime and holiday rate fields
- Effective date ranges, including open-ended ("until further notice")
- Active/inactive lifecycle (soft deactivation, not deletion)
- Automatic rate resolution consumed directly by Invoice Generation
- Full audit trail of rate card creation, updates, and deactivation

## Current Status
**Fully Implemented** for the core contracted-hourly-rate workflow. One caveat, verified directly in the invoice generation logic: the `overtime_rate` and `holiday_rate` fields are captured and stored on the rate card, but invoice generation does not currently apply them — every approved hour on an invoice is billed at the single resolved base hourly rate, regardless of whether it was worked as overtime or on a holiday.

**[Insert Screenshot Here]**

---

# 43. Timesheet Management & Approval

## Purpose
Converts a guard's recorded shift attendance into a reviewable, approvable worked-hours record — the record that ultimately becomes the basis for what a client is billed.

## Overview
A timesheet is automatically created whenever a guard checks in and out of a shift (see Field Operations), starting in "pending" status with the calculated total hours. Finance or supervisory staff review each one and either approve it, reject it (with a required reason), or correct it (adjusting the check-in/out times or total hours, which sends it back into the review queue as "corrected"). A guard can never approve their own timesheet, and once a timesheet has actually been used on a generated invoice, it becomes locked from any further editing or rejection.

## What User Can Do
- View all timesheets, filterable by status and by branch
- View a single timesheet with its linked shift, guard, site, and client
- Approve a pending or corrected timesheet
- Reject a timesheet with a required rejection reason
- Correct a timesheet's check-in/out times and total hours, with an optional correction reason

## Workflow
```
Guard checks in and out of a shift
        ↓
Timesheet is auto-created ("pending") with computed total hours
        ↓
Admin/supervisor reviews it
        ↓
   Approve → locks the hours in as billable
   Reject (reason required) → excluded from billing
   Correct → hours/times adjusted, re-enters review queue as "corrected"
        ↓
Approved timesheets become eligible for Invoice Generation
        ↓
Once used on a generated invoice, the timesheet can no longer be
edited, corrected, or rejected
```

## Business Value
- Creates a tamper-evident chain from "a guard actually worked these hours" to "the client was billed for these hours," which is the financial backbone of a security-guard-services business.
- Protects the company against underbilling and protects clients against being overbilled, since only admin-approved hours ever reach an invoice.
- The correction workflow lets legitimate clock errors be fixed without discarding the record, while still requiring re-approval.

## Technical Summary
- **Modules:** `timesheets`
- **Key logic:** Non-super-admin visibility is branch-scoped through the linked shift's branch. A guard is explicitly blocked from approving a timesheet that is their own. Once a timesheet has one or more linked `InvoiceItem` records, it is locked against edits (checked via an invoice-item count). Status moves through a `pending` / `approved` / `rejected` / `corrected` state machine.
- **Database tables:** `Timesheet` (with `Shift` and `Guard` relations), `InvoiceItem` (used to detect the invoiced-lock condition)
- **Frontend:** `/timesheets` (list with status/branch filters) and `/timesheets/[id]` (detail with approve/reject/correct actions)

## Key Capabilities
- Auto-generated from guard check-in/check-out (no manual data entry)
- Approve / reject (with reason) / correct (with reason) actions
- Guard self-approval is blocked
- Locked from further edits once used on an invoice
- Branch-scoped visibility for non-super-admin staff
- Full audit trail, including before/after values recorded on every correction

## Current Status
**Fully Implemented.**

**[Insert Screenshot Here]**

---

# 44. Finance Reporting

## Purpose
Gives finance staff a real-time view of billing performance — how much has been issued, collected, is still outstanding, or is under dispute — without manually tallying invoices in a spreadsheet.

## Overview
A dashboard summarizes invoice totals and counts by status. Three drill-down reports — Payments, Outstanding (with overdue detection), and Disputes — let staff filter by client, status, and date range for more detail. A filtered CSV export of matching invoices is available for use in external accounting or spreadsheet tools.

## What User Can Do
- View the dashboard summary (total issued, total paid, outstanding, and disputed amounts, plus invoice counts by status)
- View the Payments report (paid invoices, filterable)
- View the Outstanding report (unpaid/resolved invoices, with an overdue flag and days-overdue count)
- View the Disputes report (all disputes with their linked invoice detail)
- Export matching invoices to CSV

## Workflow
```
Admin opens the Finance dashboard
        ↓
Applies client / status / date-range filters
        ↓
Reviews summary totals (issued, paid, outstanding, disputed)
        ↓
Drills into the Payments, Outstanding, or Disputes report for detail
        ↓
Exports a filtered CSV for accounting/reconciliation
        ↓
Every report view and export is written to the audit log
```

## Business Value
- Gives finance leadership an always-current picture of cash flow health — what's owed, what's overdue, and what's contested — without manual reconciliation.
- The overdue-detection logic (days-overdue calculation) helps prioritize collections follow-up.
- The CSV export bridges the platform's data into whatever external accounting system a company already uses.

## Technical Summary
- **Modules:** `finance`
- **Key logic:** A shared filter parser (date range, client, status) is reused across the dashboard and all three reports. Overdue detection compares each invoice's `dueDate` against the current time and computes days overdue. CSV output is generated with manual field escaping rather than an external library. Every dashboard view, report view, and export is written to the audit log.
- **Database tables:** No dedicated finance tables — reads directly from `Invoice` and `InvoiceDispute`.
- **Frontend:** `/finance` (dashboard), `/finance/reports/payments`, `/finance/reports/outstanding`, `/finance/reports/disputes`, all sharing a common filter bar component.

## Key Capabilities
- Real-time dashboard (issued/paid/outstanding/disputed totals, invoice count by status)
- Payments report
- Outstanding/overdue report with days-overdue calculation
- Disputes report
- Filtered CSV export of invoices
- Full audit trail of every report view and export

## Current Status
**Fully Implemented.**

**[Insert Screenshot Here]**

---

# 45. Subscription Billing & Plans

## Purpose
Defines what each tenant is allowed to use — user seats, branches, lead/deal volume, and gated features like SSO or the Public API — based on a subscription plan.

## Overview
Four plans (Free, Starter, Growth, Enterprise) are defined directly in the backend code, each with its own usage limits and feature flags. Which plan a given tenant is on is decided by an environment variable — either a tenant-specific override or a platform-wide default — rather than by anything stored on the tenant's own database record. The Settings → Billing page shows the current plan, live usage against its limits, which gated features are enabled, and all four plans side by side for comparison, but it has no buttons to actually change plan.

## What User Can Do
- View the current plan, its monthly price, and which environment variable is driving the assignment
- View live usage vs. limits for admin users, client portal users, branches, leads, and deals
- View which gated features (Sales Automation, Public API, Custom Domains, SSO, Priority Support) are enabled for the current plan
- View all four plans side by side for comparison
- Be automatically blocked (server-side) from adding another admin or client user once a hard limit is reached

## Workflow
```
An operator sets an environment variable — a tenant-specific
BILLING_PLAN_<TENANT_SLUG> override, or the platform-wide
BILLING_DEFAULT_PLAN — and deploys
        ↓
The tenant's plan and limits are resolved from that variable
on every request
        ↓
Admin opens Settings → Billing to see usage against the plan's limits
        ↓
If a hard limit (e.g. admin user count) is reached, the system blocks
creating another one with an "upgrade the billing plan" error
        ↓
To actually change plans, an operator edits the environment variable
and redeploys the application
```

## Business Value
- Gives the business a lightweight way to differentiate service tiers and cap usage/cost exposure per tenant today.
- The plan-comparison screen gives account managers and prospective clients a clear reference of what each tier includes.
- The limits-and-feature-flags model is a real, working foundation that a payment processor and self-service upgrade flow could be layered onto later.

## Technical Summary
- **Modules:** `billing`
- **Key logic:** Four plan definitions (limits + feature flags) are hardcoded in `BillingService`. Plan resolution reads `process.env` at request time, keyed off a sanitized tenant slug (`BILLING_PLAN_<SLUG>`), falling back to `BILLING_DEFAULT_PLAN` (itself defaulting to `starter`) if no tenant-specific variable is set. Usage is computed live via Prisma counts against `User`, `ClientUser`, `Branch`, `Lead`, and `Deal`. Two guard methods (`assertCanAddAdminUser`, `assertCanAddClientUser`) are called from other modules to hard-block user creation once a plan's seat limit is reached.
- **Database tables:** None dedicated to billing/plans — reads `Tenant` (for its slug) and counts rows in `User`/`ClientUser`/`Branch`/`Lead`/`Deal`. There is no `Subscription` or `Plan` table in the schema, so no per-tenant plan selection is persisted in the database.
- **Frontend:** `/settings/billing` — a read-only usage, plan, and feature-comparison display; there is no upgrade/downgrade UI.

## Key Capabilities
- Four-tier plan model (Free / Starter / Growth / Enterprise) with per-plan usage limits
- Feature gating by plan (Sales Automation, Public API, Custom Domains, SSO, Priority Support)
- Live usage tracking against limits, with per-limit remaining/percent/exceeded indicators
- Hard server-side enforcement blocking over-limit admin/client user creation
- Side-by-side plan comparison view

## Current Status
**Partially Implemented.** Verified directly by reading `backend/src/billing/billing.service.ts` and `backend/src/billing/billing.controller.ts`: there is no payment processor or gateway integration of any kind (no Stripe or equivalent — nothing in the module handles a card, a charge, or a subscription object). Plan assignment is controlled entirely by environment variables (`BILLING_PLAN_<TENANT_SLUG>` / `BILLING_DEFAULT_PLAN`) rather than a field stored on the tenant's own database record, and there is no self-service upgrade/downgrade action anywhere in the frontend — changing a tenant's plan today requires an operator to edit an environment variable and redeploy. This confirms the preliminary assessment; the underlying limits/feature-flag engine itself is real and fully working.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
