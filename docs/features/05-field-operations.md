[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Field Operations

This domain covers everything that happens at a client's physical site: setting up sites and guards, scheduling and assigning shifts, tracking attendance, running patrols, filing and reviewing incidents, and the guard-facing mobile portal that ties it all together — including its offline support.

---

# 32. Site Management

## Purpose
Lets admin staff record every physical location a company provides guard services to, so shifts, patrols, incidents, and invoices can all be tied to a specific address.

## Overview
A site represents one client location (an office, warehouse, retail store, etc.). Each site has a name, address, and optional post-orders/instructions for guards, and can be linked to a specific client and branch so billing and reporting roll up correctly.

## What User Can Do
- Create a new site with a name, address, and special instructions
- Link a site to a client (so invoices and reports attribute correctly)
- Assign a site to a branch (for multi-branch tenants)
- Edit a site's details
- View the full list of sites, filterable by branch

## Workflow
```
Admin opens Sites → "New Site"
        ↓
Admin enters name, address, instructions
        ↓
Admin optionally links the site to a Client and a Branch
        ↓
Site is saved and immediately available for
Shift creation, Checkpoints, and Patrol Routes
```

## Business Value
- Gives every guard, shift, patrol, and invoice a single, consistent point of reference — the site.
- Post-order instructions travel with the site record, so every guard assigned there sees the same guidance.
- Branch/client linkage keeps multi-location, multi-branch operations organized without duplicate data entry.

## Technical Summary
- **Modules:** `sites`
- **Key logic:** Validates that a linked client belongs to the same tenant (and branch, if one is set) before saving. Every site query is scoped by tenant and, for non-super-admins, by branch.
- **Database tables:** `Site` (relations to `Tenant`, `Branch`, `Client`, and downstream to `Shift`, `Incident`, `Checkpoint`, `PatrolRoute`, `Invoice`, `Timesheet`, `RateCard`, `DailyServiceReport`)
- **Frontend:** `Sites` page (`frontend/src/app/sites`) with a create/edit form and branch filter.

## Key Capabilities
- Create/edit sites with address and instructions
- Optional client and branch linkage with cross-validation
- Branch-scoped visibility for non-super-admin staff
- Full audit logging of site creation/updates

## Current Status
**Fully Implemented.** UI, API (`sites.controller.ts`/`sites.service.ts`), and database model are all connected. There is currently no delete/archive action for a site — only create and edit.

**[Insert Screenshot Here]**

---

# 33. Guard Management

## Purpose
Maintains the roster of field security personnel — their contact details, login credentials, and (where permitted) sensitive payroll information — so they can be scheduled, paid, and given portal access.

## Overview
Admins add guards with a name and at least a phone or email; setting a password also gives that guard login access to the Guard Portal. Sensitive fields (salary, bank details, documents, personal notes) are protected by the platform's Field-Level Permissions system, so only roles explicitly granted access can view or edit them.

## What User Can Do
- Create a guard record (name, phone/email, optional portal password)
- Edit a guard's details
- View a guard's profile, including availability status
- View/edit sensitive fields (salary, bank details, documents, personal notes) — subject to field-level permission
- List all guards, filterable by branch

## Workflow
```
Admin opens Guards → "New Guard"
        ↓
Admin enters name + phone/email (+ optional password for portal login)
        ↓
Admin optionally records salary/bank/document details (if permitted)
        ↓
Guard is saved and can now be assigned to shifts,
and — if a password was set — can log into the Guard Portal
```

## Business Value
- One central roster feeds scheduling, payroll, and the guard's own portal access.
- Sensitive payroll data (salary, bank account) stays hidden from staff who shouldn't see it, without needing separate "restricted" guard records.

## Technical Summary
- **Modules:** `guards`
- **Key logic:** Passwords are bcrypt-hashed before storage; the password hash is always stripped from API responses. Every read/write of salary, bank details, documents, and personal notes is checked against `FieldPermissionsService` before the data leaves (or reaches) the database.
- **Database tables:** `Guard`, `Availability` (one-to-one)
- **Frontend:** `Guards` page (`frontend/src/app/guards`) with a create/edit form, an availability toggle, and conditional rendering of sensitive fields based on the logged-in user's field permissions.

## Key Capabilities
- Guard roster CRUD (create/edit/list/detail)
- Optional Guard Portal login credential (phone/email + password)
- Branch-scoped visibility
- Field-level protection of salary/bank/documents/personal notes
- Availability status view/toggle from the same screen
- Full audit logging (`GUARD_CREATED`, `GUARD_UPDATED`)

## Current Status
**Fully Implemented.** UI, API (`guards.controller.ts`/`guards.service.ts`), and database model are all connected and verified, including the field-permission integration.

**[Insert Screenshot Here]**

---

# 34. Shift Scheduling & Assignment

## Purpose
Lets admins define the work that needs covering at each site (a shift with a start/end time and guard count) and assign specific guards to fill it — with an AI-assisted recommendation to help pick the right guard.

## Overview
A shift is created against a site with a time window and a required guard count. From there, an admin can either assign a guard manually or ask the system for guard recommendations (based on availability, branch match, and other signals) before confirming an assignment. A shift's status (`open` → `assigned` → `in_progress` → `completed`) moves automatically as guards are assigned and as they check in/out.

## What User Can Do
- Create a shift for a site (time window, number of guards required)
- View all shifts, filterable by branch
- Request AI-generated guard recommendations for a shift
- Assign a guard to a shift
- Unassign a guard from a shift
- See a shift's live status and attendance summary

## Workflow
```
Admin opens Shifts → "New Shift"
        ↓
Admin selects site, start/end time, guard count
        ↓
Admin requests guard recommendations (optional)
        ↓
Admin assigns a guard to the shift
        ↓
Shift status moves to "assigned"
        ↓
Guard checks in/out via the Guard Portal
        ↓
Shift status moves to "in_progress" then "completed"
```

## Business Value
- Turns client contracts into concrete, coverable work orders.
- AI-assisted recommendations reduce scheduling guesswork and help avoid double-booking or availability conflicts.
- Automatic status transitions give admins a live view of coverage without manual updates.

## Technical Summary
- **Modules:** `shifts` (plus `ai-insights` for recommendations)
- **Key logic:** Assignment validates that the guard isn't marked unavailable and rejects assigning a second guard to a shift that already has one (single-assignment-per-shift rule). Guard recommendations are generated by `RecommendationService` and cross-referenced against the guard actually chosen for audit purposes. Outbound webhooks fire on shift creation and assignment.
- **Database tables:** `Shift`, `Assignment`, `Availability`
- **Frontend:** `Shifts` page (`frontend/src/app/shifts`) with create-shift form, assign/unassign actions, and recommendation display.

## Key Capabilities
- Shift creation with site/time/guard-count
- Branch-scoped shift visibility
- AI-assisted guard recommendation (`shifts.assign` permission)
- Assign / unassign with availability and branch-match checks
- Automatic shift status lifecycle
- Full audit trail and outbound webhooks (`shift.created`, `shift.assigned`)

## Current Status
**Fully Implemented.** One deliberate simplification: a shift currently supports exactly one assigned guard at a time — assigning a second guard to an already-assigned shift is rejected rather than supporting multi-guard coverage per shift, even when `requiredGuards` is greater than 1.

**[Insert Screenshot Here]**

---

# 35. Assignments Overview

## Purpose
Provides a single combined list of every guard-to-shift assignment across the company, for reference and reporting purposes.

## Overview
Whenever a guard is assigned to a shift (see Shift Scheduling above), an assignment record is created. This feature exposes a read-only endpoint that lists all of those records tenant-wide, with the related shift and site details attached.

## What User Can Do
- (Via API only) Retrieve the full list of guard-shift assignments for the company, including site and guard names

## Workflow
```
Assignments are created as a side effect of the
Shift Scheduling & Assignment workflow
        ↓
The Assignments API returns the combined list on request
```

## Business Value
- Provides a single query point for "who is assigned where" that other tools or a future dashboard could build on.

## Technical Summary
- **Modules:** `assignments`
- **Key logic:** A single read-only method loads every shift for the tenant, then every assignment tied to those shifts, including guard and site details.
- **Database tables:** `Assignment` (reads `Shift`, `Site`, `Guard`)
- **Frontend:** None. No dedicated page in `frontend/src/app` consumes the `/assignments` endpoint — assignment information is instead surfaced piecemeal inside the Shifts page.

## Key Capabilities
- Tenant-wide assignment listing with site/guard detail
- Permission-gated (`shifts.view`)

## Current Status
**Partially Implemented — no dedicated UI.** The `GET /assignments` API is fully built and permission-protected, and the underlying data (creation, unassignment) is fully functional as part of Shift Scheduling. However, there is no standalone "Assignments" screen in the frontend; nothing currently calls this endpoint from the UI. It should be treated as a backend-only capability today.

**[Insert Screenshot Here]**

---

# 36. Attendance & Availability

## Purpose
Tracks whether a guard is available to be scheduled, and records the actual times they checked in and out of a shift — which in turn drives payroll.

## Overview
Each guard has an availability status (`available`/`unavailable`, optionally with a date range) that scheduling checks before allowing an assignment. Separately, when a guard checks in and out of a shift through the Guard Portal, timestamped attendance events are recorded, and checking out automatically creates or updates a pending timesheet for that shift.

## What User Can Do
- Admin: view and toggle a guard's availability status (with optional date range)
- Guard: check in at the start of a shift
- Guard: check out at the end of a shift
- Admin: see each shift's live attendance status (not started / checked in / completed) and check-in/out times

## Workflow
```
Guard opens their shift in the Guard Portal
        ↓
Guard taps "Check In" (blocked if already checked in/out,
or if not assigned to the shift)
        ↓
An AttendanceEvent is recorded; shift status → "in_progress"
        ↓
Guard taps "Check Out" at shift end
        ↓
An AttendanceEvent is recorded; shift status → "completed"
        ↓
A Timesheet is automatically created/updated with total hours,
status "pending", ready for admin approval
```

## Business Value
- Removes manual timekeeping — hours worked are captured automatically from real check-in/out actions, feeding directly into payroll and invoicing.
- Availability status prevents admins from accidentally scheduling a guard who has flagged themselves unavailable.
- A duplicate check-in/out attempt is rejected and logged, preventing accidental double-billing.

## Technical Summary
- **Modules:** `guards` (availability), `guard-portal` (check-in/out)
- **Key logic:** A database-level unique constraint (`guardId` + `shiftId` + event type) prevents duplicate attendance events even under race conditions; duplicate attempts are caught and logged as `GUARD_CHECK_IN_INVALID`/`GUARD_CHECK_OUT_INVALID`. Checking out computes total hours from the check-in/out timestamps and upserts a `Timesheet` in one transaction.
- **Database tables:** `Availability`, `AttendanceEvent`, `Timesheet` (created as a side effect)
- **Frontend:** Availability toggle on the Guards page; check-in/out buttons on the Guard Portal shift-detail page (`frontend/src/app/guard/shifts/[id]`).

## Key Capabilities
- Guard availability status with optional unavailable date range
- Assignment-aware, duplicate-proof check-in/check-out
- Automatic shift status transitions tied to attendance
- Automatic pending-timesheet creation on check-out
- Full audit trail, including invalid-attempt logging

## Current Status
**Fully Implemented.** Verified end-to-end: UI buttons call real endpoints, the database enforces the no-duplicate-event rule, and check-out reliably produces a timesheet ready for the Finance module's approval flow.

**[Insert Screenshot Here]**

---

# 37. Patrol Management

## Purpose
Lets admins define checkpoints and patrol routes at a site, and lets guards walk those routes during a shift, confirming they passed each checkpoint.

## Overview
An admin creates checkpoints at a site (each with a name, location note, and an optional reference code) and groups them into an ordered patrol route. During a shift, an assigned guard starts a patrol run against one of the site's routes, taps to confirm each checkpoint as they reach it, and completes the run — at which point any checkpoint never confirmed is automatically marked "missed."

## What User Can Do
- Admin: create/edit checkpoints for a site (name, description, location note, optional reference code)
- Admin: create/edit patrol routes and attach an ordered sequence of checkpoints
- Admin: view all patrol runs and their checkpoint-by-checkpoint history
- Guard: view the active patrol route(s) available for their current shift
- Guard: start a patrol run
- Guard: confirm ("scan") each checkpoint, optionally marking it "skipped" with a note
- Guard: complete the patrol run

## Workflow
```
Admin creates checkpoints for a site
        ↓
Admin groups checkpoints into an ordered Patrol Route
        ↓
Guard checks in for their shift, opens "Patrols"
        ↓
Guard starts a patrol run against the site's route
        ↓
Guard taps to confirm each checkpoint in turn (optionally adding a note)
        ↓
Guard completes the run
        ↓
Any checkpoint not confirmed is auto-marked "missed"
```

## Business Value
- Gives clients documented proof that guards actually walked their assigned route during a shift.
- Automatically flagging missed checkpoints surfaces coverage gaps without requiring a supervisor to manually cross-check.

## Technical Summary
- **Modules:** `patrols` (admin CRUD + shared service logic used by both the admin and guard controllers)
- **Key logic:** A checkpoint optionally stores a `qrCodeValue` reference string, and the frontend checkpoints screen displays it with a QR-code icon — **but there is no camera-based QR/barcode decoding, NFC reading, or GPS/geofence verification anywhere in the code.** "Scanning" a checkpoint is simply a `POST` to `/guard/patrol-runs/:id/checkpoints/:checkpointId/scan` with an optional notes/status field, triggered by the guard tapping the checkpoint in a confirmation modal. Completing a run diffs scanned checkpoints against the route's full checkpoint list and bulk-inserts "missed" events for anything left over.
- **Database tables:** `Checkpoint`, `PatrolRoute`, `PatrolRouteCheckpoint`, `PatrolRun`, `PatrolEvent`
- **Frontend:** Admin — `frontend/src/app/patrol/checkpoints`, `/patrol/routes`, `/patrol/runs`. Guard — `frontend/src/app/guard/shifts/[id]/patrols`.

## Key Capabilities
- Ordered checkpoints-per-route configuration
- Guard-facing start / confirm-checkpoint / complete-run flow
- Automatic "missed checkpoint" detection on run completion
- Full patrol run history with per-checkpoint timestamps, viewable by admins
- Offline-queueable checkpoint confirmation and run completion (see Guard Portal & Offline Sync)

## Current Status
**Fully Implemented as a manual confirmation checklist — not QR/NFC/GPS-verified.** Every layer (UI, API, service, database) is connected and working for the actual mechanism built: a guard tapping "confirm" on a checkpoint they select from a list. Despite the `qrCodeValue` field and QR-code icon in the UI, the app never decodes a real QR code, reads NFC, or checks device location — a guard could tap "confirm" on any checkpoint without physically being there. One additional technical note for developers: the admin-side endpoints require `patrols.manage`/`patrols.view` permissions that are **not present in the platform's ~85-key RBAC permission catalog** (`backend/src/roles/rbac.constants.ts`), so no system or custom role can currently be granted them — in practice, only Super Admins (who bypass permission checks entirely) can use the admin patrol screens today.

**[Insert Screenshot Here]**

---

# 38. Incident Reporting & Review

## Purpose
Lets a guard formally report something that happened during a shift (a theft, safety issue, disturbance, etc.), and lets office staff review, approve, or reject that report before it becomes visible to the client.

## Overview
A guard who has checked in for a shift can file an incident with a title, description, severity, when it occurred, and an optional attachment link. It starts in "submitted" status; opening it as an admin automatically moves it to "under review," and a reviewer then approves or rejects it with an optional note. Approved incidents become visible in the Client Portal and are added to the platform's knowledge base for future AI grounding.

## What User Can Do
- Guard: file an incident report for a shift they've checked into
- Guard: view their own submitted incidents
- Admin: view all incidents (filterable by branch) and a dedicated review queue
- Admin: view full incident detail, including similar historical cases
- Admin: approve or reject an incident, with a review note
- Client: view approved incidents for their own sites only

## Workflow
```
Guard checks in for shift → something happens
        ↓
Guard files an incident (title, description, severity, time, attachment link)
        ↓
Incident enters "submitted" status
        ↓
Admin opens the incident → status auto-moves to "under review"
        ↓
Admin approves or rejects, with an optional note
        ↓
If approved: incident becomes visible to the client
and is captured into the Knowledge Base for future AI reference
```

## Business Value
- Creates a documented, timestamped paper trail for every field incident, useful for liability and client trust.
- The submit → review → approve gate ensures nothing reaches a client's view unvetted.
- Feeding approved incidents into the AI knowledge base lets the AI Copilot and similar-case lookups learn from real operational history.

## Technical Summary
- **Modules:** `incidents` (three controllers: admin, guard, client, sharing one service)
- **Key logic:** A guard can only file an incident if they are assigned to the shift and have already checked in. Status transitions (`submitted` → `under_review` → `approved`/`rejected`) are enforced with guarded SQL updates so a review can't be double-applied. Approval triggers `KnowledgeBaseService.createFromIncident` and an outbound `incident.approved` webhook. Incident detail lookup also runs a similar-case retrieval against the knowledge base.
- **Database tables:** `Incident`
- **Frontend:** Admin — `frontend/src/app/incidents` (list + detail) and `frontend/src/app/incidents/review` (review queue + detail). Guard — `frontend/src/app/guard/incidents`. Client — `frontend/src/app/client/incidents`.

## Key Capabilities
- Guard-side incident filing gated on shift assignment + check-in
- Severity levels (low/medium/high/critical)
- Admin review queue with auto "under review" transition on open
- Approve/reject with reviewer note, one-time-only review enforcement
- Client-visible feed limited to approved incidents at their own sites
- Similar-historical-case lookup on incident detail (AI knowledge retrieval)
- Full audit trail and outbound webhooks

## Current Status
**Fully Implemented.** Verified end-to-end across all three portals (guard filing, admin review, client viewing) with real enforcement of the assignment/check-in precondition and the one-time review rule.

**[Insert Screenshot Here]**

---

# 39. Guard Portal & Offline Sync

## Purpose
Gives field guards a lightweight, phone-first application for their daily work — viewing shifts, checking in/out, running patrols, and filing incidents — that keeps working even when a guard has no signal, and catches up automatically once they're back online.

## Overview
The Guard Portal (`/guard/*`) is a separate, simplified experience from the main admin app, built for guards to use on their phones in the field. When the browser detects it has no network connection, check-in/check-out, incident filing, and patrol-checkpoint actions are saved to a local queue on the device instead of failing outright. As soon as the connection returns, the queue is automatically replayed against the server in the original order, and the server safely ignores anything already processed.

## What User Can Do
- View assigned shifts (today and upcoming)
- View shift detail (site, address, instructions)
- Check in / check out — instantly, or queued for later if offline
- Start a patrol run, confirm checkpoints, and complete the run — instantly, or queued if offline
- File an incident — instantly, or queued if offline
- See a persistent on-screen indicator of online/offline status and any pending queued actions
- Manually retry a sync if it fails

## Workflow
```
Guard performs an action (check-in, incident, checkpoint confirm) with no signal
        ↓
Action is saved to a local offline queue in the browser (with a unique ID)
        ↓
A visible indicator shows "N actions saved offline"
        ↓
Device regains connectivity (browser "online" event fires)
        ↓
Queued actions are sent, in original order, to /guard/sync
        ↓
Server processes each action; if an action with that same ID
was already processed, it is skipped rather than duplicated
        ↓
Successfully processed actions are cleared from the local queue
```

## Business Value
- Guards routinely work in basements, remote perimeters, or buildings with poor signal — offline support means their shift record doesn't get lost because of a dead zone.
- Automatic, order-preserving replay means no manual re-entry once a guard is back online.
- Server-side idempotency means a flaky connection retry can never double-count a check-in or duplicate an incident.

## Technical Summary
- **Modules:** `guard-portal` (profile, shifts, check-in/out, sync endpoints), `guard-auth` (login), reused by `incidents` and `patrols` services for the actual offline-queued actions
- **Key logic:** The frontend queue (`frontend/src/lib/offline-sync.ts`) stores pending actions in `localStorage`, each carrying a client-generated UUID. `NetworkContext` (`frontend/src/context/NetworkContext.tsx`) listens for the browser's `online`/`offline` events and automatically calls `POST /guard/sync` with the full queue when connectivity returns; `SyncIndicator` shows live status. Server-side, `GuardPortalService.processSyncQueue` sorts incoming actions by their original timestamp, checks each action's ID against `GuardSyncQueue` before processing (skipping duplicates), and marks each as `synced` or `failed` with an error message — a genuine idempotent replay, not just a resend.
- **Database tables:** `GuardSyncQueue` (dedupe/audit trail of every offline action), plus whatever each action ultimately writes to (`AttendanceEvent`, `Timesheet`, `Incident`, `PatrolEvent`, `PatrolRun`)
- **Frontend:** Guard Portal pages under `frontend/src/app/guard/*` (dashboard, shifts, shift detail, patrols, incidents, login); shared `NetworkContext` + `SyncIndicator` components used across those pages.

## Key Capabilities
- Phone-first guard dashboard, shift list, and shift detail
- Offline queuing for check-in, check-out, incident creation, patrol-checkpoint confirmation, and patrol-run completion
- Automatic replay on reconnect, in original chronological order
- Server-side idempotent de-duplication keyed by client-generated action ID
- Manual "Retry Sync" control and live online/offline + pending-count indicator
- Full audit logging of sync completion (`GUARD_OFFLINE_SYNC_COMPLETED`)

## Current Status
**Fully Implemented.** This is a genuinely complete offline-first design, verified from the UI action (`navigator.onLine` check → `OfflineSync.enqueueAction`) through to the server's ID-based de-duplication in `GuardSyncQueue` — not just a queue that exists unused. One caveat: the offline queue lives in `localStorage`, so it is per-browser/per-device (clearing site data would lose unsynced actions), and there is no background/service-worker sync — replay only triggers when the app is open and the browser fires an `online` event.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
