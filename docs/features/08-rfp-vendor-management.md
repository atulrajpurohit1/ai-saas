[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# RFP & Vendor Management

**New domain, added 2026-07-23 through 2026-08-01.** This is a self-contained procurement workflow: it lets the tenant (a security guard services company) draft a formal Request for Proposal for a piece of business, invite its own subcontracted security vendors to bid on fulfilling it, collect and AI-evaluate their submissions, award the contract, and track the winning vendor's ongoing performance. It does **not** connect to the existing sales-side CRM (Leads/Deals/Clients/Proposals) — it is a separate procurement flow between the tenant and its vendor pool, not part of the tenant's own sales pipeline to its end clients.

---

# 47. RFP Management

## Purpose
Lets an admin turn a piece of security-services business into a formal, structured Request for Proposal document, send it out to a shortlist of vendors for competitive bidding, and run the entire process — invite, submit, evaluate, award — from one place.

## Overview
An admin fills out a structured RFP form (client/project context, security types needed, number of locations, guard requirements, pricing model and required pricing items, payment terms, additional requirements) and can have AI draft the full RFP document from those fields. The RFP is then shortlisted and/or formally invited out to vendors, who submit proposal documents through a public, tokenized link (see Vendor Portal, feature 49). Once submissions are in, an admin can trigger an AI evaluation report comparing vendors, then award the contract to one vendor (or reject others) — each action emails the vendor automatically.

## What User Can Do
- Create, edit, duplicate, and delete an RFP
- Generate a full RFP document from the form fields using AI (or write/edit it manually in a rich-text editor)
- Export any RFP as a branded PDF
- Shortlist ("assign") vendors to an RFP, and separately, formally invite vendors — which emails them a secure, tokenized submission link
- View submitted proposal documents per vendor and download the original files (proposal, pricing, insurance, license)
- Generate an AI evaluation report comparing all vendor submissions against the RFP's requirements
- Award the contract to one vendor, or reject individual vendors (each action sends an automatic email)
- Log and update post-award vendor performance reviews (rating, SLA compliance %, incident count, response time, notes)

## Workflow
```
Admin fills out the RFP form (client/project, security types, guard
count, pricing model/items, payment terms, additional requirements)
        ↓
Admin clicks "Generate RFP" → AI drafts a full Markdown/HTML document,
which the admin reviews and edits in a rich-text editor
        ↓
Admin saves the RFP as Draft or Generated
        ↓
Admin shortlists and/or formally invites vendors — an invite
emails each vendor a secure, single-use tokenized link
        ↓
Vendor opens the link (no login required), reviews the RFP, and
uploads their proposal + optional pricing/insurance/license documents
before the RFP's due date
        ↓
Admin reviews submissions, then triggers an AI evaluation report
comparing all submitted vendors — RFP status becomes "Evaluated"
        ↓
Admin awards the contract to one vendor (requires an evaluation and
a submission from that vendor) and/or rejects others — each
action automatically emails the vendor — RFP status becomes "Awarded"
        ↓
Admin logs ongoing vendor performance reviews against the awarded RFP
```

## Business Value
- Replaces an ad-hoc, email-based vendor-bidding process with a structured, auditable workflow and a hard deadline enforced by the system.
- AI drafting removes the blank-page problem for what is normally a long, boilerplate-heavy procurement document.
- The AI evaluation report gives a defensible, side-by-side comparison of vendor bids instead of relying purely on gut feel.
- Post-award performance tracking closes the loop — did the vendor actually deliver what they promised?

## Technical Summary
- **Modules:** `rfp` (`RfpController`, `RfpService`), consumes `ai` (`AiService.generateRfp`/`generateEvaluationReport`), `email` (`EmailService`), `branding` (PDF header)
- **Key logic:** An `Rfp` record moves through a status lifecycle: `DRAFT → GENERATED → EVALUATED → AWARDED` (a `FINALIZED` value exists in the schema and DTO validation list but is never actually set by any service method — a dead/unused status today). Vendor "assignment" (shortlisting) and vendor "invitation" are two distinct actions that both write to the same `RfpVendor` join record; invitation generates a unique, cryptographically random token (`randomBytes(32)`, base64url) and emails the vendor a link containing it — vendors without an email on file are skipped, and email-send failures are tolerated (the link still works) and reported back to the admin. AI evaluation (`POST /rfp/:id/evaluate`) requires at least one vendor submission, extracts text from submitted PDFs (best-effort, first ~3000 characters via `pdf-parse`) to give the AI real proposal content to compare, and persists an `EvaluationReport`. Awarding a contract uses an atomic conditional database update (`updateMany` that only succeeds if `awardedVendorId` is still null) specifically to prevent two admins from racing to award the same RFP twice.
- **Database tables:** `Rfp`, `RfpVendor` (invitation/submission state), `ProposalSubmission` (submitted files), `EvaluationReport`, `VendorPerformance`
- **Frontend:** `/rfp` (list, create/duplicate/delete, PDF export), `/rfp/new` and `/rfp/[id]/edit` (form with AI "Generate RFP" action + `RfpEditor` rich-text review/edit), `/rfp/[id]` (detail page assembling the `AssignedVendorsPanel`, `VendorSubmissionsPanel`, `AiEvaluationPanel`, `ContractAwardPanel`, and `VendorPerformancePanel` components).

## Key Capabilities
- Structured RFP intake covering scope, security types, guard/location counts, pricing model, and payment terms
- AI-generated full RFP document (12-section Markdown template: scope, staffing, site, reporting, insurance, compliance, pricing-submission instructions, evaluation criteria, etc.), with an explicit anti-hallucination instruction that the AI must never invent dollar figures
- Branded PDF export
- Vendor shortlisting and formal, tokenized email invitation (distinct actions)
- Per-vendor submission review and original-document download
- AI-generated evaluation report (vendor comparison table, strengths/weaknesses, recommended vendor, risk analysis) with a deterministic fallback if Gemini is unavailable
- Race-safe contract award with automatic winner/loser notification emails
- Post-award vendor performance tracking (rating, SLA%, incidents, response time)

## Current Status
**Fully Implemented.** Every controller endpoint has a matching service method, Prisma model, frontend API client function (`frontend/src/lib/rfp.ts`), and is invoked from a corresponding page or component — this is a complete, working end-to-end workflow, not a partial build. The only loose thread is the `FINALIZED` status value, which is defined in the schema/DTO but never actually reached by any code path — a cosmetic artifact rather than a functional gap. This domain does not integrate with the existing Leads/Deals/Clients/Proposals CRM — `clientName`/`companyName` on an RFP are free-text fields for labeling only, not foreign keys.

**[Insert Screenshot Here]**

---

# 48. Vendor Management

## Purpose
Maintains the tenant's own directory of subcontracted security vendors — the companies invited to bid on RFPs — separate from the tenant's own sales-side Client records.

## Overview
A vendor is a simple company/contact record (company name, contact person, email, phone, address, services offered, notes, active/inactive status). Vendors are created and managed independently, then referenced when shortlisting or inviting bidders on an RFP.

## What User Can Do
- Create, edit, and delete a vendor
- Search vendors by company name, contact, or email
- Set which services a vendor offers (drawn from the same security-type catalog used on RFPs)
- Mark a vendor active or inactive

## Workflow
```
Admin adds a vendor (company, contact, email, phone, services offered)
        ↓
Vendor appears in the vendor directory, searchable by name/contact/email
        ↓
Vendor becomes available to shortlist/invite on any RFP
        ↓
(Vendor cannot be deleted while it currently holds an awarded RFP contract)
```

## Business Value
- Builds reusable institutional knowledge of which vendors the company works with, instead of re-entering vendor details for every RFP.
- Service-offering tags let an admin quickly find vendors relevant to a specific type of job when shortlisting.

## Technical Summary
- **Modules:** `vendors` (`VendorsController`, `VendorsService`)
- **Key logic:** Standard tenant-scoped CRUD with a search filter across company name/contact/email. Deletion is explicitly blocked with a `BadRequestException` if the vendor currently holds an awarded RFP contract (checked via the `awardedRfps` relation), preventing a data-integrity gap on an active contract.
- **Database tables:** `Vendor` (relations: `rfpAssignments` → `RfpVendor`, `performanceReviews` → `VendorPerformance`, `awardedRfps` → `Rfp`)
- **Frontend:** `/vendors` — full CRUD table with a search box and create/edit modal, reusing the shared security-type option list for the "Services Offered" picker.

## Key Capabilities
- Full vendor directory CRUD with search
- Service-offering tagging (shared catalog with RFP security types)
- Active/inactive status
- Delete protection for vendors holding an awarded contract

## Current Status
**Fully Implemented.** A straightforward, complete CRUD feature verified end-to-end (UI → API → service → database).

**[Insert Screenshot Here]**

---

# 49. Vendor Portal (Public Invitation Link)

## Purpose
Lets an external vendor — who has no account and no login on this platform — securely view an RFP they've been invited to and submit their bid, using nothing but the link emailed to them.

## Overview
This is **not** a login-based portal like the Client Portal or Guard Portal — there is no vendor account, password, or session anywhere in this flow. Access is entirely via a secure, unguessable, single-purpose invitation token embedded in the emailed link. The controller behind this page has no authentication guard at all; the token itself, plus the RFP's due date, are the only access controls.

## What User Can Do
- Open the invitation link and view a read-only summary of the RFP (company, title, industry, due date, security types, additional requirements)
- Upload a proposal document (required) plus optional pricing, insurance, and license documents, with a notes field
- See a "submitted" confirmation state after uploading

## Workflow
```
Vendor receives an emailed invitation link (no login required)
        ↓
Vendor opens the link → page auto-marks the invitation as "viewed"
        ↓
Vendor reviews the RFP summary and security-type requirements
        ↓
Vendor uploads proposal file (required) + pricing/insurance/license
files (optional) and any notes, then submits
        ↓
Submission is stored and the invitation status becomes "Submitted"
        ↓
(If the RFP's due date has already passed, both viewing and
submitting are blocked with a clear "closed" response)
```

## Business Value
- Removes friction for external vendors — no account creation, no password, just a link and a form.
- The due-date cutoff enforces a hard, fair bidding deadline automatically, without an admin manually closing submissions.

## Technical Summary
- **Modules:** `vendor-portal` (`VendorPortalController`, `VendorPortalService`) — explicitly documented in code as public, with no `JwtAuthGuard` or any other guard on the controller
- **Key logic:** The invitation token (`randomBytes(32)`, base64url) is the sole access credential, generated when an admin invites a vendor from the RFP Management feature. Viewing the link (`POST /vendor/invitation/:token/view`) transitions status `PENDING`/`INVITED` → `VIEWED`. Submission (`POST /vendor/invitation/:token/submit`) is a multipart upload of up to 4 files, validated by extension (PDF/DOCX/XLSX/ZIP) and size, stored to disk with sanitized/randomized filenames, and creates a `ProposalSubmission` linked 1:1 to the invitation. A submission is rejected with `409 Conflict` if the vendor already submitted, and with `410 Gone` if the RFP's due date has passed — in both rejection cases, any uploaded files are cleaned up rather than left orphaned on disk.
- **Database tables:** `RfpVendor` (holds the token and `invitationStatus`: `PENDING → INVITED → VIEWED → SUBMITTED`), `ProposalSubmission`
- **Frontend:** `/vendor/invitation/[token]` — a fully public page (no admin layout, no login) with the RFP summary, a 4-file upload form, and a post-submission confirmation state.

## Key Capabilities
- Token-based access with no vendor account or password required
- Automatic "viewed" tracking on link open
- Multi-file submission (proposal required; pricing/insurance/license optional) with type/size validation
- Hard due-date cutoff enforced server-side (`410 Gone` after the deadline)
- Duplicate-submission protection

## Current Status
**Fully Implemented.** A genuinely public, unauthenticated flow, verified to have no guard on its controller, with real file validation, storage, and deadline enforcement — not a placeholder form. There is no vendor-side way to check submission outcome (award/reject) after the fact; that notification only reaches the vendor by email from the RFP Management award/reject actions.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
