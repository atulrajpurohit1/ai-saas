[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Core CRM

This domain covers the sales-side data model at the heart of the platform: capturing prospective business (Leads), tracking it through a sales pipeline (Deals), producing proposal documents, recording internal notes and follow-up tasks, and managing the company's own paying customers (Clients).

---

# 9. Lead Management

## Purpose
Lets office staff capture and track prospective customers — companies that might buy security guard services — from first contact through to becoming a deal.

## Overview
A lead is a simple record: a contact name, company, email, and status (new, contacted, proposal sent, responded, closed). Leads can be entered by hand, bulk-imported from a CSV file, or extracted automatically by AI from an uploaded PDF (e.g. an RFP or inbound inquiry document). Once a lead looks promising, it's converted into a Deal to move it into the sales pipeline.

## What User Can Do
- Create a lead manually (name, company, email)
- Upload a PDF and have AI auto-extract the contact/company details into the "new lead" form
- View the full list of leads with their AI-generated sales score (see Sales Accelerator / AI Sales Assessment)
- Open a lead's detail page to see its notes and AI discovery/scoring panel
- Change a lead's status directly from the list (dropdown per row)
- Convert a lead into a Deal with one click
- Edit lead details and delete a lead (API only — see Current Status)
- Bulk import leads from CSV and export all leads to CSV (API only — see Current Status)

## Workflow
```
Admin adds a lead (manually, CSV import, or PDF upload)
        ↓
AI can auto-extract name/company/email from an uploaded PDF
        ↓
Lead appears in the Leads list with status "new"
        ↓
Admin updates status as contact progresses (contacted → proposal sent → responded → closed)
        ↓
Admin clicks "Convert" → a Deal is created and the lead is marked "converted"
```

## Business Value
- Gives sales staff a single place to track every incoming opportunity instead of emails/spreadsheets.
- AI PDF extraction saves manual data entry when a lead arrives as a document (e.g. an emailed RFP).
- Clean hand-off into the Deal pipeline keeps the sales process moving without duplicate data entry.

## Technical Summary
- **Modules:** `leads` (backend)
- **Key logic:** Standard CRUD plus three AI/data-processing endpoints — CSV import (`csv-parser`) and export (`fast-csv`), and PDF analysis (`pdf-parse` + `AiService.extractLeadFromText`) that pulls out name/company/email from unstructured text. A duplicate-detection lookup (by company name or email domain) is available to calling code (used by Sales Automation's CSV import flow).
- **Database tables:** `Lead`
- **Frontend:** `/leads` (list, search, status dropdown, "Add Lead" modal with PDF-upload auto-fill, "Convert to Deal" action) and `/leads/[id]` (detail page embedding the Sales Accelerator panel and the shared Notes panel).

## Key Capabilities
- Manual lead creation
- AI PDF-to-lead extraction (`analyze-pdf`, `upload-pdf`)
- CSV bulk import and CSV export
- Status lifecycle (new/contacted/proposal_sent/responded/closed)
- One-click Lead → Deal conversion
- Full audit trail (create/update/status-change/delete)
- Duplicate-lead detection helper (used by import flows)

## Current Status
**Fully Implemented for the core workflow** that a salesperson actually uses day to day: create, list, search, view detail, change status, and convert to a deal all work end-to-end with a real UI. Two backend-complete capabilities have **no frontend UI to trigger them**: CSV import/export, and direct lead editing/deletion (the leads list has no working "..." menu action and no edit/delete button — those operations only exist as API endpoints (`PUT /leads/:id`, `DELETE /leads/:id`, `POST /leads/import`, `GET /leads/export`)).

**[Insert Screenshot Here]**

---

# 10. Deal / Pipeline Management

## Purpose
Tracks a sales opportunity — created from a qualified lead — as it moves toward becoming a signed, paying client.

## Overview
A Deal represents a specific sales opportunity tied back to its originating Lead, optionally linked to an existing Client, and carrying a pipeline "stage" (e.g. new, in the current build). Deals are the anchor point for Notes, Activities, AI Sales Assessments, and Proposals related to that opportunity.

## What User Can Do
- Create a new deal, choosing the source lead and (optionally) an existing client to link it to
- View all deals in a card grid, with each deal's current stage, linked lead/client, and latest AI close-readiness score
- Search/filter the deal list
- Open a deal's detail page to see full context, run AI Sales Accelerator scoring, and manage notes
- Convert a lead directly to a deal in one action (from the Leads screen)
- Change a deal's pipeline stage and delete a deal (API only — see Current Status)

## Workflow
```
Admin creates a deal from a lead (manually, or via "Convert" on the Leads screen)
        ↓
Deal appears in the pipeline with stage "new"
        ↓
Admin adds notes and reviews AI-generated close-readiness scoring on the deal detail page
        ↓
(Backend supports moving the deal through further pipeline stages and deleting it,
 but today the interface only supports creating and viewing deals)
```

## Business Value
- Gives managers a single view of every active opportunity and its AI-estimated likelihood of closing.
- Keeps the sales opportunity connected to its originating lead and (once known) the client record, avoiding duplicate data entry.

## Technical Summary
- **Modules:** `deals` (backend)
- **Key logic:** Deal creation validates that the referenced lead belongs to the same tenant; `convertLeadToDeal` creates a deal and flips the source lead's status to "converted" in one transhttp-level action. `updateStage` and `remove` are implemented and permission-guarded (`deals.update`, `deals.delete`) but are not called from anywhere in the frontend.
- **Database tables:** `Deal` (relates to `Lead`, `Client`, `Note`, `Activity`, `Proposal`, `SalesAssessment`, `DiscoverySession`)
- **Frontend:** `/deals` (card list with "New Deal" modal, showing stage badge and AI readiness score) and `/deals/[id]` (detail page with the Sales Accelerator panel and Notes panel). Neither page exposes a stage-change control or a delete action.

## Key Capabilities
- Deal creation (from scratch or via lead conversion)
- Deal listing with linked lead/client and latest AI assessment summary
- Deal detail view with notes and AI scoring
- Full audit trail (create/convert/stage-update/delete)
- Backend-only: stage transition (`PUT /deals/:id/stage`), deal deletion (`DELETE /deals/:id`)

## Current Status
**Partially Implemented.** Creating and viewing deals works fully end-to-end. **There is no UI control anywhere to change a deal's stage or to delete a deal** — both operations are fully built, permission-guarded backend endpoints with no frontend button, form, or drag-and-drop calling them. In practice, today's interface treats a deal as a single static stage ("new") from creation onward; moving deals through a pipeline or removing one currently requires a direct API call, not anything reachable from the app.

**[Insert Screenshot Here]**

---

# 11. Proposal Management

## Purpose
Lets sales staff generate, refine, version, share, and track formal security-services proposal documents for a lead or client, with AI doing the first draft.

## Overview
A proposal is a titled document (with full version history) that can be linked to a lead, a deal, and/or a client. Staff can write one manually or have AI draft it automatically from the lead's context; either way, every content edit is preserved as a numbered version. Once ready, a proposal can be shared into the Client Portal, where the client can view it, download a PDF, and leave comments that flow back to the admin side as a two-way comment thread.

## What User Can Do
- Generate an AI-drafted proposal for a specific lead (optionally linking it to a client in the same step, including creating a brand-new client directly from the lead)
- Bulk-generate AI proposals for every lead that doesn't have one yet
- View all proposals with status (draft/sent/approved/rejected) and version count
- View a proposal's full content and comment thread in a detail modal
- Share a proposal with a client (assigns/links the client and flips status to "sent")
- Download any proposal as a branded PDF
- Comment on a proposal (visible to both admin and client sides)
- Send a proposal email to a lead individually, or bulk-send proposal emails to all eligible leads
- (Client Portal side) view a shared proposal, approve/reject it, comment, and see a timeline of activity

## Workflow
```
Admin selects a lead and (optionally) a client, clicks "Generate Proposal"
        ↓
AI drafts proposal content from the lead's context (falls back to a template if AI is unavailable)
        ↓
Proposal is saved as a draft with version 1
        ↓
Admin edits content (each save creates a new version) or downloads/shares as-is
        ↓
Admin shares the proposal with a client → status becomes "sent", client gains portal access to it
        ↓
Client views the proposal in the Client Portal, comments, and approves or rejects
        ↓
Admin sees client comments and the decision on the admin side
```

## Business Value
- Cuts proposal turnaround time dramatically — a professional first draft is available in seconds instead of being written from scratch.
- Full version history protects against lost work and supports "what did we actually send" audits.
- Two-way commenting and a client-visible approval flow move the sales conversation into the platform instead of email threads.
- Bulk generation and bulk email let a small sales team cover a much larger lead volume.

## Technical Summary
- **Modules:** `proposals` (backend), consumes `AiService` (drafting), `BrandingService` (PDF header/branding)
- **Key logic:** Every content change on update is diffed against the current version and, if different, appended as a new `ProposalVersion`; PDF export is generated on demand with PDFKit using the tenant's branding snapshot; `generateForLead` calls the shared AI service with the lead's notes/deals as context; `generateBulkProposals` iterates every proposal-less lead in the tenant. Client- and lead-membership are verified against the tenant before any linkage is allowed.
- **Database tables:** `Proposal`, `ProposalVersion`, `ProposalComment`
- **Frontend:** `/proposals` (list, AI-generate modal with inline "create client from this lead" shortcut, bulk-generate, bulk-email, share-to-client modal, full-content view modal with comment thread, PDF download); Client Portal `/client/proposals/[id]` (view, approve/reject, comment, timeline).

## Key Capabilities
- AI-assisted proposal drafting (single and bulk)
- Full version history on every content edit
- PDF export with tenant branding
- Client-portal sharing and two-way commenting
- Client approve/reject workflow (Client Portal side)
- Proposal email delivery (single and bulk)
- Full audit trail (create/update/share/comment)

## Current Status
**Fully Implemented.** Verified end-to-end: AI generation, versioning, PDF export, client sharing, commenting, and the client-side approve/reject flow all have working UI, API, service, and database wiring on both the admin and Client Portal sides.

**[Insert Screenshot Here]**

---

# 12. Notes

## Purpose
Gives staff a simple place to capture internal context and history against a specific Lead or Deal — the kind of running commentary a salesperson needs ("client asked about weekend coverage," "budget confirmed at $X").

## Overview
A note is a short free-text entry attached to exactly one Lead or one Deal (never both), timestamped and attributed to whichever admin user wrote it. Notes appear directly on the Lead and Deal detail pages via a shared panel.

## What User Can Do
- Add a note to a lead or a deal
- View all notes for that lead/deal, newest first, each showing who wrote it and when
- Delete a note

## Workflow
```
Admin opens a Lead or Deal detail page
        ↓
Admin types a note and submits
        ↓
Note is saved, tagged to that lead/deal, and attributed to the logged-in admin
        ↓
Note appears immediately at the top of the notes list for that record
        ↓
Admin can delete a note if it's no longer needed
```

## Business Value
- Keeps institutional knowledge about a prospect or opportunity attached to the record itself, not scattered across email or memory.
- The "who wrote this and when" attribution supports accountability and handoffs between staff.

## Technical Summary
- **Modules:** `notes` (backend)
- **Key logic:** Enforces "exactly one of leadId or dealId" at creation time and verifies the target lead/deal belongs to the caller's tenant before allowing the note. Author attribution is derived by cross-referencing the `AuditLog`'s `CREATE`/`NOTE` entries rather than a direct `createdBy` column on the `Note` table itself.
- **Database tables:** `Note`
- **Frontend:** Shared `NotesPanel` component, embedded on both `/leads/[id]` and `/deals/[id]`, with add/list/delete and toast feedback.

## Key Capabilities
- Single-entity attachment (lead OR deal, enforced)
- Author attribution via audit trail cross-reference
- Newest-first listing
- Delete with optimistic UI update
- Full audit trail (create/delete)

## Current Status
**Fully Implemented.** Confirmed working end-to-end on both Lead and Deal detail pages, including author display and delete.

**[Insert Screenshot Here]**

---

# 13. Activities

## Purpose
Intended to let staff schedule and track follow-up tasks, calls, and meetings tied to a specific deal, and to power the automatic follow-up tasks the Sales Automation engine creates for stalling deals.

## Overview
An Activity is a typed record (call, meeting, or task) with a subject, optional description, due date, and status (pending/completed), linked to a Deal. The backend is fully built to create, list (optionally filtered by deal), and update the status of activities. In practice, Activity records today are created only by the background Sales Automation job when it detects a stalling deal — there is no screen anywhere in the application where a user can create, view, or complete an activity themselves.

## What User Can Do
- Nothing directly today — there is no Activities page, button, or panel anywhere in the admin app. (See Current Status.)

## Workflow
```
Sales Automation job scans deals on its schedule
        ↓
For a stalling deal, it creates an Activity record (e.g. "Follow up with...")
        ↓
Activity is stored with status "pending"
        ↓
(No screen exists for a user to see, complete, or reschedule that activity)
```

## Business Value
- As designed, this would give sales staff a task list tied to their deals (calls to make, meetings to hold) and confirm that automated follow-up suggestions actually get done — but since there is no user-facing surface, that value is not currently realized.

## Technical Summary
- **Modules:** `activities` (backend)
- **Key logic:** Standard CRUD-style service — `create`, `findAll` (tenant + optional dealId filter), `updateStatus` — each guarded by `activities.manage` / `activities.view` permissions and logged to the audit trail. No frontend API client, page, or component calls any `/activities` endpoint anywhere in `frontend/src`.
- **Database tables:** `Activity`
- **Frontend:** **None.** No `/activities` route exists. The dashboard's "recent activity" feed is a client-side computed list built from leads/deals/proposals timestamps — a different, cosmetic feature — not a view of the `Activity` table.

## Key Capabilities
- Create/list/update-status API for call, meeting, and task records tied to a deal
- Automatic activity creation from the Sales Automation stalling-deal scan
- Full audit trail (create/status-update)

## Current Status
**Limited Implementation — backend only.** The service and API are complete and are actively written to by Sales Automation, but there is no frontend page, panel, or component that lets a user view, create, or complete an activity. This should be treated as an internal/automation-only data store today, not a usable feature for end users.

**[Insert Screenshot Here]**

---

# 14. Client Management

## Purpose
Manages the tenant's own paying customers — the companies that receive guard services, invoices, and proposals — including giving them their own portal login.

## Overview
A Client record holds contact and company details, optional billing/internal notes (protected by Field-Level Permissions), an optional branch assignment, and can be linked to Deals, Proposals, Sites, Invoices, Timesheets, and Shared Documents elsewhere in the platform. An admin can enable a self-service Client Portal login for a client with one click, generating a one-time temporary password.

## What User Can Do
- Create a new client (name, company, email, phone, branch, billing/internal notes)
- Edit an existing client
- View all clients, filterable by branch, with search
- Enable Client Portal access for a client (creates their login + temporary password)
- Share documents with a client and manage/remove previously shared documents
- View/edit billing and internal notes, subject to the logged-in user's Field-Level Permissions (sensitive fields are hidden or read-only if not permitted)

## Workflow
```
Admin adds a client (name, company, contact info, optional branch)
        ↓
Client appears in the Clients list, filterable by branch
        ↓
Admin clicks "Enable Portal" → system generates a one-time temporary password
        ↓
Client logs into the Client Portal with that email/password
        ↓
Admin can share documents with the client, and link the client to deals/proposals/invoices
```

## Business Value
- Central, structured client record instead of scattered spreadsheets or email threads.
- One-click portal enablement removes IT overhead from onboarding a client to self-service.
- Field-level protection means billing/internal notes can be safely entered without exposing them to every role that can see a client record.
- Branch scoping lets multi-branch tenants keep client visibility aligned with their organizational structure.

## Technical Summary
- **Modules:** `clients` (backend), integrates with `field-permissions`, `branches`, `billing`, `webhooks`
- **Key logic:** Field-Level Permissions are enforced on both write (`assertCanEditFields`) and read (`filterFieldsByPermission`) for the `billingNotes`/`internalNotes` fields; branch assignment/visibility goes through the shared branch-scoping helpers (`branchScopedWhere`, `branchWhere`, `resolveWriteBranchId`); creating a portal user is gated by the `BillingService`'s seat/plan check and hashes a randomly generated temporary password with bcrypt; client creation fires a `client.created` webhook event.
- **Database tables:** `Client`, `ClientUser`
- **Frontend:** `/clients` — full list with branch filter and search, create/edit modal (with field-permission-aware note fields), "Enable Portal" action, and a document-sharing modal (list/upload-by-URL/remove) backed by the Shared Documents feature.

## Key Capabilities
- Full client CRUD with branch scoping
- Field-level protection of billing/internal notes
- One-click Client Portal user provisioning with temporary password
- Document sharing per client
- Outbound webhook on client creation
- Full audit trail (create/update)

## Current Status
**Fully Implemented.** Verified end-to-end: list/create/edit, branch filtering, field-level permission enforcement in the UI, portal-user creation, and document sharing all have working UI, API, service, and database wiring.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
