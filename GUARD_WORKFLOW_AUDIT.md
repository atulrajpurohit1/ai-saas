# Guard / Shift / Patrol workflow audit

Audited 11-11-2026 against commit `ec75546` (production). Read-only review of the
schema, every backend service in the chain, and all eleven screens on the admin
and guard sides. Not a CRUD check - this is about whether the workflow works for
a non-technical scheduler, supervisor and guard.

Each item below is meant to be fixed in its own session. Every item states the
problem, the evidence (file:line), the fix, what it touches, and what it depends
on. Items are in recommended order.

---

## Product decisions already made (do not re-raise)

Confirmed by the owner on 11-11-2026. These shape every fix below.

| # | Question | Decision | Consequence |
|---|----------|----------|-------------|
| 1 | How are guards rostered? | **Ad hoc.** Shifts are created one at a time. | Recurring/template shifts are **not** needed. Do not build them. |
| 2 | Are patrols on a schedule? | **No.** Guards walk a route when they choose. | Scheduled patrols / "patrol missed" detection are **not** needed. Only *checkpoints* missed inside a started patrol count. |
| 3 | Multiple guards on one shift? | **Yes, needed.** | `requiredGuards` must actually work. This is the largest fix (item 1). |
| 4 | Guard onboarding? | **Keep as-is** - admin sets a password on the guard form and hands it over. | No invite/reset flow. But the silent-failure case must be fixed (item 4). |
| 5 | Is "AegisLead Guard" sold without "AegisLead Operations"? | **No.** | Shifts staying in the `FINANCE` module is fine. No change. |
| 6 | Is the supervisor the same person as the admin? | **No - separate role.** | A Supervisor system role is needed (item 8). |

---

## The workflow as it exists today

Minimum path to get one guard to walk one patrol. Thirteen steps, two portals,
nothing links step to step.

```
ADMIN SIDE                                              screen
  1. Create site                                        /sites
  2. Create guard  (+ type a portal password)           /guards
  3. Create checkpoints, set QR values                  /patrol/checkpoints
  4. Create route -> Manage checkpoints -> attach/order /patrol/routes
  5. Create shift  (site, start, end, required guards)  /shifts
  6. Assign guard                                       /shifts

GUARD SIDE
  7. Sign in                                            /guard/login
  8. Tap today's shift                                  /guard/dashboard
  9. Check In              <- gate: nothing unlocks before this
 10. "Perform Patrols"     <- button only appears after 9
 11. Start Patrol          <- pick a route
 12. Scan each checkpoint -> Complete Patrol Run
 13. Check Out             <- this is what creates the timesheet
```

Dead ends a non-technical user hits, with the message they see:

- Skip step 3/4 -> guard sees "No patrol routes configured for this site."
- Skip step 9  -> guard sees "Check-in Required."
- Blank password in step 2 -> guard sees "Invalid credentials" forever (item 4).
- Guard taps the "Patrols" tab in their nav -> it is history only; nothing starts there (item 10).

### Data model (for orientation)

```
Site 1--* Shift 1--* Assignment *--1 Guard
              |
              +--* AttendanceEvent (CHECK_IN / CHECK_OUT; unique per guard+shift+type)
              +--* PatrolRun (per guard) 1--* PatrolEvent (one per checkpoint scan)
              +--* Timesheet (per guard+shift; created on check-out)

Site 1--* Checkpoint *--* PatrolRoute  (via PatrolRouteCheckpoint, ordered)
```

Shift.status lifecycle today: `open` -> `assigned` (first guard) -> `in_progress`
(any check-in) -> `completed` (any check-out). Assignment.status: `pending`, never
changes.

---

## What is good (keep it; the fixes build on it)

Offline action queue with retry + dedupe (`guard-portal.service.ts` sync queue);
audit trail on both sides; QR and geofence verification stored independently;
auto-"missed" on patrol completion; double-start prevention; timesheet created on
check-out with clock-skew guard; AI guard recommendations; branch scoping;
calendar view of shifts. The mechanisms are above average. The *process* on top
was never designed.

---

## Fix list

### 1. Multiple guards per shift (decision #3) - LARGEST

> **DONE 11-11-2026 (batch 1).** Staffing rules live in `backend/src/shifts/shift-staffing.ts`.
> `DELETE /v2/shifts/:id/unassign/:guardId` added (old route = unassign all). Attendance is
> per assignment from `findAll`; shift `completed` now means "nobody still on duty". A guard
> who has checked in cannot be unassigned (they could never check out). Public API follows
> the same rules. Tests added in `shifts.service.spec.ts` and `guard-portal.service.spec.ts`.

**Problem.** The shift form asks for "Required guards" and the list shows
"1 of 3 assigned", but the backend hard-rejects a second guard. A 3-guard shift
can never be filled.

**Evidence.**
- `backend/src/shifts/shifts.service.ts:229` - `if (shift.assignments.length > 0) throw new ForbiddenException('Shift is already assigned')`
- `backend/src/shifts/shifts.service.ts:303-341` - `unassign()` deletes **all** assignments on the shift (`deleteMany({ where: { shiftId } })` at `:318`)
- `backend/src/shifts/shifts.service.ts:37-54` - `summarizeAttendance()` takes every event on the shift, so with two guards "checked in" means *someone* checked in
- `backend/src/guard-portal/guard-portal.service.ts:304` - first guard's check-in sets `shift.status = 'in_progress'`; `:409` first guard's **check-out sets `shift.status = 'completed'`** while others are still on duty
- `frontend/src/app/shifts/page.tsx:395` - Staffing cell renders only `shift.assignments[0].guard.name`
- `frontend/src/app/shifts/page.tsx:420-428` - Action is a single "Unassign" (all) or "Assign Guard"
- `frontend/src/app/shifts/page.tsx:327-332` - calendar `onSelectShift` opens assign modal only when `assignments.length === 0`

**Fix.**
- `assign()`: reject if this guard is already on the shift; reject if `assignments.length >= requiredGuards` ("Shift is fully staffed"); set `status = 'assigned'` only when full, otherwise leave `open`. Keep the AI-recommendation and availability checks as they are.
- `unassign()`: take a `guardId` (route `DELETE /v2/shifts/:id/unassign/:guardId`, keep old route as "unassign all" or remove it); delete that one assignment; set `status = 'open'` if now below `requiredGuards`.
- Attendance: return it **per assignment** (`assignments[].attendanceStatus/checkInTime/checkOutTime`) from `findAll`, not per shift. Derive the shift-level badge in the UI: "2 of 3 checked in".
- Shift status on check-in/out: `in_progress` on first check-in is fine; `completed` only when **every** assigned guard has checked out (or stop writing it from the guard portal and derive it). Pick one and document it in `shifts.service.ts`.
- Admin shifts page: one row per guard under the shift (name + their attendance badge + per-guard Unassign); "Assign Guard" stays visible until full; calendar click opens assign modal while not full.
- Guard side needs no change: `getAssignedShiftContext()` already filters assignments and attendance by `guardId`; `AttendanceEvent` and `Timesheet` are already unique per guard+shift; `PatrolRun` is per guard.

**Verify while in there.**
- `backend/src/incidents/incidents.service.ts:411` uses `assignment.guard.email` - make sure it picks the *reporting* guard's assignment, not `[0]`.
- `backend/src/public-api/public-api.service.ts:~300-320` has its own assign path that logs `GUARD_ASSIGNED` - apply the same rules there.
- `backend/src/reports/reports.service.ts:332,479` already treat `assignedGuards` as plural - should be fine.
- `frontend/src/components/ShiftsCalendar.tsx` - check how it renders staffing.

**Size.** 1.5-2 days. Backend tests exist for shifts; add cases for second guard, full shift, per-guard unassign, per-guard attendance.

**Depends on.** Nothing. Do this first - items 2, 6 and 7 touch the same files and should be built on the multi-guard shape.

---

### 2. Assignment status is "Pending" forever

> **DONE 11-11-2026 (batch 1).** Assignments are created `confirmed`; `assignmentStatus` dropped
> from the guard portal responses and the "My Status" badge removed. Existing rows still say
> `pending` in the DB (only daily reports still echo `assignment.status`); harmless, no migration.

**Problem.** Every assignment is created `pending` and nothing ever changes it.
The guard sees **"My Status: Pending"** on every shift for its whole life and
cannot tell if it is confirmed. One shift shows three badges (Schedule: Assigned
/ My Status: Pending / Attendance: Not started) and only one means anything.

**Evidence.**
- `backend/src/shifts/shifts.service.ts:256` - `status: 'pending'` on create
- grep of `backend/src` for `assignment.update` / `'confirmed'` -> no hits
- `frontend/src/app/guard/shifts/page.tsx:76` - "My status: {assignmentStatus}"
- `frontend/src/app/guard/shifts/[id]/page.tsx:253` - "My Status: {assignmentStatus}"

**Fix (simplest, matches ad-hoc decision #1).** Guards don't accept/decline, so
the concept has no job. Create assignments as `confirmed` (or drop the column's
meaning entirely), and **remove the "My Status" badge** from both guard screens.
Leave the guard with two things: the shift's schedule state and their own
attendance state. Also drop `assignmentStatus` from `getAssignedShifts()` /
`getShiftDetail()` in `guard-portal.service.ts` once nothing reads it.

**Size.** 1-2 hours.

**Depends on.** Do after item 1 so the guard-side status cleanup is done once.

---

### 3. The guard is never told they've been assigned

> **DONE 11-11-2026 (batch 2).** `EmailService.sendShiftAssignmentEmail` sends site, address and
> DD-MM-YYYY HH:mm times with a link to `/guard/login`, for assigned / unassigned / updated.
> Fire-and-forget in `ShiftsService.notifyGuardOfShiftChange`: a send failure is logged and
> audited `GUARD_NOTIFY_FAILED` but never fails the roster change; a guard with no email is
> audited `GUARD_NOTIFY_SKIPPED` and the assign modal says to tell them directly.

**Problem.** Assignment "notification" is a `console.log`. No email, no SMS. The
guard has to log in on their own and look. For a scheduling system this is the
single most important message.

**Evidence.**
- `backend/src/shifts/shifts.service.ts:297-299` - `console.log('[NOTIFICATION] Guard ... assigned to Shift ...')`
- `backend/src/shifts/shifts.service.ts:339` - same for unassign
- A `shift.assigned` **webhook** fires (`:278`), but that is for integrators, not the guard.

**Fix.** On assign and unassign, if the guard has an email, send one through the
existing platform email module (`backend/src/email/`, Resend - see
`docs/` + memory `aegislead-platform-email`). Content: site name + address, start
and end (DD-MM-YYYY HH:mm), and a link to `/guard/login`. Fire-and-forget: a
send failure must not fail the assignment (log it, audit `GUARD_NOTIFY_FAILED`).
Guards with phone only: out of scope unless an SMS provider is added - say so in
the admin UI ("No email - tell the guard directly").

**Size.** Half a day.

**Depends on.** Item 1 (the assign path is being rewritten anyway).

---

### 4. A guard with no password is silently dead

> **DONE 11-11-2026 (batch 1).** `canSignIn` returned from the guards API; "Portal access"
> column (Ready / No password set, click to edit); password required on create with helper
> text; assign modal warns when the chosen guard can't sign in.

**Problem.** "Portal Password" is optional on the guard form. Left blank, the
guard has `passwordHash = null`, the login loop skips them, and they get
"Invalid credentials" forever. Nothing warns the admin, nothing in the guards
list shows who can log in. (Decision #4: keep the admin-sets-password model,
just make the failure visible.)

**Evidence.**
- `backend/src/guards/guards.service.ts:86-88` - `passwordHash = dto.password ? hash : undefined`
- `backend/src/guard-auth/guard-auth.service.ts:38` - `if (!guard.passwordHash) continue;`
- `frontend/src/app/guards/page.tsx:517-526` - the password field, no helper text, not required

**Fix.**
- Backend: return `canSignIn: boolean` (`!!passwordHash`) from `guards.service.ts` `withoutPasswordHash()` so the hash never leaves but the fact does.
- Guards list: a "Portal access" column - "Ready" / "No password set".
- Guard form: helper text under the password field - "Required for the guard to sign in to the guard portal. Share it with them directly." Consider making it required on **create** (still optional on edit).
- Shift assign modal: if the chosen guard has `canSignIn === false`, show an inline warning before confirming - "This guard can't sign in yet. Set a portal password on their profile."

**Size.** 2-3 hours.

**Depends on.** Nothing.

---

### 5. Check-in has no time window

> **DONE 11-11-2026 (batch 2).** Rules in `backend/src/guard-portal/attendance.constants.ts`:
> check-in opens 60 min before start and closes at end; outside it a plain message naming the
> time plus audit `GUARD_CHECK_IN_INVALID`. Check-out stays unbounded but a check-out more than
> 30 min late is stamped `notes: 'Checked out late'`. **Decided:** offline replay validates
> against `action.createdAt`, bounded to no later than now (so a fast device clock can't open
> the window early), and the event is stamped with that same moment. The guard screen disables
> Check In with "Check-in opens ..." on a ticking clock, so it enables itself at the hour.

**Problem.** Check-in validates only "not already checked in." A guard can check
in to next Thursday's shift today, or to last week's. The timesheet produced on
check-out is then for any duration against any date.

**Evidence.**
- `backend/src/guard-portal/guard-portal.service.ts:255-300` - `checkIn()` checks `checkInTime` / `checkOutTime` only; never compares `Date.now()` to `shift.startTime` / `endTime`

**Fix.** Add constants in `guard-portal.service.ts` (or a new
`attendance.constants.ts`):
- `CHECK_IN_OPENS_MINUTES_BEFORE_START = 60`
- Check-in allowed when `startTime - 60min <= now <= endTime`. Outside that: `BadRequestException` with a plain message ("This shift starts at 22:00 on 14-11-2026. Check-in opens one hour before.") and an audit `GUARD_CHECK_IN_INVALID` (helper already exists: `logInvalidAttendanceAttempt`).
- Check-out: leave unbounded (guards forget), but record lateness: if `now > endTime + 30min` add `notes: 'Checked out late'` on the event so the timesheet reviewer sees it.
- Guard shift detail: show the Check In button disabled with "Opens at HH:mm" when outside the window, instead of letting them tap and fail.
- Offline sync (`processSyncQueue`) replays `check_in` through the same method, so a queued check-in from inside the window will still be accepted if the request's own timestamp is used - **decide** whether to validate against `action.createdAt` (fairer to a guard with no signal) or `now`. Recommend `createdAt`, bounded to within the window.

**Size.** Half a day including tests.

**Depends on.** Nothing.

---

### 6. Shifts can't be edited or deleted

> **DONE 11-11-2026 (batch 2).** `PUT /v2/shifts/:id` (permission `shifts.create`, whose
> description now reads "Create and edit shifts" - no separate `shifts.update` key was added)
> and `DELETE /v2/shifts/:id` (permission `shifts.delete`). Times and site are frozen once any
> attendance exists, headcount stays editable, and `requiredGuards` can't drop below the guards
> already assigned. Delete is refused when any attendance, patrol run, timesheet or invoice item
> exists. Audited `SHIFT_UPDATED` (with before/after) and `SHIFT_DELETED`; new webhook events
> `shift.updated` / `shift.deleted`. Assigned guards are emailed when a shift moves (item 3).
> The shifts page gained pencil and trash actions reusing the create form.

**Problem.** The shifts controller has create / list / recommend / assign /
unassign. A typo in the end time means creating a second shift; the wrong one
sits in the list as `open` forever and, if it was ever assigned, in the guard's
Upcoming list.

**Evidence.**
- `backend/src/shifts/shifts.controller.ts:21-50` - no `PUT :id`, no `DELETE :id`
- `backend/src/roles/rbac.constants.ts` already defines `shifts.delete` - the permission exists, the endpoint doesn't

**Fix.**
- `PUT /v2/shifts/:id` (site, start, end, requiredGuards). Rules: time edits allowed while no guard has checked in; once attendance exists, allow only `requiredGuards` and reject the rest with a clear message. Audit `SHIFT_UPDATED` with before/after. If `requiredGuards` is lowered below current assignments, reject.
- `DELETE /v2/shifts/:id`. Rules: refuse if any `AttendanceEvent`, `PatrolRun` or `Timesheet` exists ("This shift has attendance recorded. Unassign the guard instead."); otherwise delete (assignments cascade). Audit `SHIFT_DELETED`. Permission `shifts.delete`.
- Frontend `shifts/page.tsx`: pencil (edit dialog reusing the create form) and trash (ConfirmDialog) in the Action cell. Notify assigned guards on a time change (reuse item 3's email).

**Size.** Half a day to a day.

**Depends on.** Item 1 (shape of assignments), item 3 (notify on change).

---

### 7. There is no "no-show"

> **DONE 11-11-2026 (batch 3).** Derived, not stored: `isNoShow` in `shift-staffing.ts` with
> `NO_SHOW_GRACE_MINUTES = 15`, so a late guard who finally arrives stops counting with no job
> to clear a flag. `noShow` is returned per assignment from `findAll`. The shifts list shows a
> red "No-show" badge on that guard, a roll-up badge on the row, and a "N no-shows today" chip
> that doubles as the filter. `dashboard/summary` gained `noShowsToday`; the dashboard renders
> it as an alert linking to Shifts rather than a stat tile, since the tiles carry a 7-day delta
> that means nothing here, and it is hidden at zero and for tenants without the shifts module.
> Supervisor alerting still needs a scheduled job and is not built.

**Problem.** If an assigned guard never checks in, the shift stays `assigned`
forever. Nothing goes red, nobody is alerted, no report shows it. For a guard
company this is the thing they most need to know, in real time.

**Evidence.**
- Shift.status values in use: `open`, `assigned`, `in_progress`, `completed` (`shifts.service.ts`, `guard-portal.service.ts`). No `missed` / `no_show`.
- `frontend/src/app/shifts/page.tsx:240-252` - attendance badge is Not started / Checked in / Completed only.

**Fix.** Derive, don't store (a stored flag goes stale):
- `NO_SHOW_GRACE_MINUTES = 15`. A per-guard assignment is a no-show when `now > shift.startTime + grace` and that guard has no `CHECK_IN`.
- `shifts.service.ts findAll`: add `noShow: boolean` per assignment (needs item 1's per-assignment attendance).
- Admin shifts list: red "No-show" badge on that guard; a count chip at the top of the page ("2 no-shows today"); sort/filter for it.
- Admin dashboard (`backend/src/dashboard/`): a "No-shows today" stat.
- Patrol Monitor is the wrong home for this (it is patrol-scoped) - put it on Shifts and the dashboard.
- Later (separate item): email the supervisor role (item 8) when a no-show is detected - needs a scheduled job; `@nestjs/schedule` may already be present, check `app.module.ts`.

**Size.** Half a day for the derived state + UI. Alerting is extra.

**Depends on.** Item 1 (per-assignment attendance).

---

### 8. Supervisor role (decision #6)

> **DONE 11-11-2026 (batch 2).** Added to `SYSTEM_ROLES` with the eight permissions below.
> **Trap found:** `Supervisor` was also a key in `REMOVED_SYSTEM_ROLES` (mapped to Operations),
> so seeding it and then retiring it happened in the same sync and the role could never exist.
> That entry is removed and `rbac-catalog.spec.ts` now fails if any name appears in both lists.
> Anyone previously moved from the old Supervisor to Operations stays there. A Supervisor lands
> on `/patrol/monitor` after login (`AuthContext`), and its portal role stays `supervisor`,
> which is safe because only the finance pages gate on role.

**Problem.** The admin side assumes one person does everything. The owner wants
a supervisor who watches patrols and reviews flags but does not run scheduling
or finance.

**Evidence.**
- `backend/src/roles/rbac.constants.ts:609-835` - `SYSTEM_ROLES`: Super Admin, Manager, Sales, Operations, Finance, Guard, Client. No Supervisor.
- `backend/src/roles/roles.service.ts:120-200` - system roles are seeded/reconciled per tenant from that array (`SYSTEM_ROLES.map` at `:122`), so adding one there creates it everywhere (and `REMOVED_SYSTEM_ROLES` handles renames).
- Nav and pages are permission-gated (`frontend/src/lib/nav-links.ts`, `DashboardLayout requiredPermissions`), so a correctly scoped role gets the right sidebar automatically.

**Fix.** Add to `SYSTEM_ROLES`:
```
name: 'Supervisor'
description: 'Watches live patrols, reviews flagged scans and incidents, sees guards and shifts. Cannot schedule, edit guards, or see finance.'
permissions:
  dashboard.view
  guards.view
  shifts.view
  patrols.view
  incidents.view
  incidents.review
  reports.view
  timesheets.view
```
Then check: `frontend/src/context/AuthContext.tsx:74-75` (`fallbackPath` / landing page after login - a Supervisor should land on `/patrol/monitor`, not `/finance`); `backend/src/roles/rbac-catalog.spec.ts` will need the new role in its expectations; the Users/Roles settings pages should show it as a system role (non-editable).

**Size.** 2-3 hours.

**Depends on.** Nothing. Can be done any time.

---

### 9. Guard status badges - one vocabulary

> **DONE 11-11-2026 (batch 1, with item 2).** Guard list and detail show only their own
> attendance: Not started / Checked in / Completed. Schedule badge removed from guard side.

**Problem.** Covered under item 2: three badges, different words for the same
idea. After item 2 the guard sees "Schedule: Assigned" + "Attendance: Not
started". "Assigned" means nothing to a guard looking at their own shift.

**Fix.** On guard screens show one line: **Not started / Checked in / Completed**
(their attendance), plus "No-show" if item 7's rule applies to them. Drop the
schedule badge from the guard side entirely (`frontend/src/app/guard/shifts/page.tsx:98`,
`frontend/src/app/guard/shifts/[id]/page.tsx:250`). Keep it on the admin side.

**Size.** 1 hour. Fold into item 2's session.

---

### 10. Guard nav "Patrols" tab doesn't start a patrol

> **DONE 11-11-2026 (batch 3).** `/guard/patrol-runs` now leads with a card: "On duty at {site}
> - Start a patrol" linking to the patrol screen when the guard is checked in, "Check in to
> {site} to start patrolling" when they have a shift today but have not, and a plain "No shift
> today" note otherwise. The history below is headed "Previous patrols" and the page is titled
> "Patrols".

**Problem.** The guard's bottom nav has Dashboard / Shifts / Incidents /
Patrols. "Patrols" is `/guard/patrol-runs` - a history list. To *do* a patrol
the guard must go Shifts -> shift -> Check In -> Perform Patrols. The tab they
tap first is a dead end.

**Evidence.**
- `frontend/src/components/GuardLayout.tsx:14-17` - nav items
- `frontend/src/app/guard/patrol-runs/page.tsx` - history only

**Fix.** At the top of `/guard/patrol-runs`, if the guard has a shift that is
`checked_in` right now, show a card: "On duty at {site} - Start a patrol ->"
linking to `/guard/shifts/{id}/patrols`. If they have a shift today but are not
checked in: "Check in to {site} to start patrolling ->" linking to the shift.
Rename the history section below it "Previous patrols". Data is already
available from `guard/shifts` (attendanceStatus per shift).

**Size.** 2 hours.

---

### 11. Guard shift list is unbounded and ungrouped

> **DONE 11-11-2026 (batch 3).** `getAssignedShifts` defaults to `endTime >= now - 7 days` and
> sorts newest first; `GET guard/shifts?history=1` returns everything behind a "Show older
> shifts" action. The screen is split Today / Upcoming / Recent, with today's card first and
> largest, and "Today" means on duty at any point today so a night shift that began yesterday
> still appears.

**Problem.** `getAssignedShifts()` returns every assignment the guard has ever
had, oldest-first after sort, no grouping. After a few months "Assigned Shifts"
is a wall of completed shifts with today's somewhere in the middle.

**Evidence.**
- `backend/src/guard-portal/guard-portal.service.ts:166-205` - `findMany` with no date filter or `take`
- `frontend/src/app/guard/shifts/page.tsx` - flat list

**Fix.** Backend: default to shifts with `endTime >= now - 7 days`, newest-first
within Today, then Upcoming, then Recent; `?history=1` for the rest. Frontend:
three sections (Today / Upcoming / Recent) with Today's card first and biggest;
"Show older shifts" link. The dashboard already does the Today/Upcoming split -
reuse `overlapsToday` from `frontend/src/app/guard/dashboard/page.tsx:71-77`.

**Size.** 2-3 hours.

---

### 12. Admin setup has no guidance and sites are an island

> **DONE 11-11-2026 (batch 3).** `sites.findAll` returns `counts` (checkpoints / routes /
> shifts) and a derived `patrolReady`. The Sites list gained a "Set up" column linking each
> count to that page pre-filtered by `?site_id=`, plus a warning chip reading "Not ready for
> patrols - add a route" or "A route has no checkpoints". The shifts, checkpoints and routes
> pages now read `site_id` from the URL (wrapped in Suspense, matching the existing pattern on
> the compliance page), and the shifts page shows a clearable site chip. Both patrol empty
> states explain the step and link on to the next one.

**Problem.** Six screens in a strict order with nothing connecting them. The
Sites page (`frontend/src/app/sites/page.tsx`) has no link to that site's
checkpoints, routes or shifts - everything is reached through filters on other
pages. A first-time admin has no way to know a site "isn't ready for patrols".

**Fix.**
- Sites list: per row, counts with links - "Checkpoints (6) · Routes (2) · Shifts (14)" to the filtered pages (`/patrol/checkpoints?site_id=`, `/patrol/routes?site_id=`, `/shifts?site_id=` - the shifts page needs a `site_id` query param added).
- A readiness hint on the site row when it has 0 routes or a route with 0 checkpoints: "Not ready for patrols - add a route".
- Patrol Routes empty state: link to Checkpoints. Checkpoints empty state: link to Sites.
- The "Print QR Codes" button already carries the site filter; keep that pattern.

**Size.** Half a day.

---

### 13. iPhone camera scanning

> **DONE 11-11-2026 (batch 3).** `jsqr@1.4.0` added as the fallback in `qr-scan.ts`: frames are
> drawn to a reused canvas and decoded with `inversionAttempts: 'attemptBoth'` when
> `BarcodeDetector` is absent. It is a dynamic `import()`, so the build puts it in its own
> 49 KB chunk that only iOS devices fetch. `isQrCameraScanSupported` now asks only for a
> camera, so the Scan button appears on iPhones. `scanQrFromCamera`'s contract is unchanged and
> the manual-entry path is untouched. **Still needs a test on a real iPhone**; it has not been
> run on a physical device.

**Problem.** Camera QR decoding uses the browser `BarcodeDetector` API, which
Safari/iOS does not ship. Guards on iPhones see **no Scan button** - only the
type-the-code field. Works on Android/Chrome.

**Evidence.**
- `frontend/src/lib/qr-scan.ts:1-40` - capability check, no fallback decoder
- `frontend/src/components/CheckpointQrScanner.tsx:50` - hides the camera button when unsupported

**Fix.** Add `jsqr` (pure JS, ~40 KB) as the fallback in `qr-scan.ts`: when
`BarcodeDetector` is absent, draw video frames to a canvas on an interval and
run `jsQR(imageData)`. Same `scanQrFromCamera()` contract so the component does
not change. Keep the manual entry path exactly as it is.

**Size.** Half a day including a device test on an actual iPhone.

---

## Minor / wording

- ~~Patrol Monitor "Missed today" counts **checkpoints** missed inside completed patrols; label it "Checkpoints missed today" so nobody reads it as "patrols missed".~~ Done 11-11-2026 (batch 3).
- ~~Guard shift detail: "Report Incident" is disabled until checked in with no explanation.~~ Done 11-11-2026 (batch 2): the button now carries a "Check in first" tooltip.
- Shift Management page header says "Schedule and manage guard presence" but the module it lives in is branded "Operations" - fine per decision #5, just be aware when writing client-facing copy.

---

## Decided: no change

Listed so a future session does not re-raise them.

- **Recurring / template shifts** - decision #1 (ad hoc). Not building.
- **Scheduled patrols and "patrol missed" alerts** - decision #2. Not building. Patrols stay voluntary; only checkpoints inside a started patrol are tracked.
- **Guard invite / password-reset flow** - decision #4. Admin sets the password; only the visibility of "no password" is fixed (item 4).
- **Moving Shifts out of the `FINANCE` module** - decision #5. Guard is always sold with Operations.

---

## Suggested session order

1. ~~Item 1 - multiple guards~~ done 11-11-2026
2. ~~Items 2 + 9 together - status cleanup on the guard side~~ done 11-11-2026
3. ~~Item 4 - password visibility~~ done 11-11-2026
4. ~~Item 8 - Supervisor role~~ done 11-11-2026
5. ~~Item 5 - check-in window~~ done 11-11-2026
6. ~~Item 3 - assignment email~~ done 11-11-2026
7. ~~Item 6 - shift edit/delete~~ done 11-11-2026
8. ~~Item 7 - no-show~~ done 11-11-2026
9. ~~Item 10 + 11 - guard portal navigation and list~~ done 11-11-2026
10. ~~Item 12 - admin setup guidance~~ done 11-11-2026
11. ~~Item 13 - iPhone scanning~~ done 11-11-2026 (still needs a real-device test)

**Every item in this audit is now implemented.** What is deliberately left:

- **No-show alerting to the supervisor** (item 7's "later"), which needs a scheduled job.
- **A real iPhone test of the QR fallback** (item 13). The code ships and builds; nobody has
  held an actual iPhone to a sticker.
- **SMS to guards with no email** (item 3), out of scope until an SMS provider exists. The
  admin UI says to tell those guards directly.

Each session: branch from `production`, run `npm run build` in `frontend/` and
the backend test suite before pushing; pushing `production` deploys live via CI
(see `docs/PRODUCTION_DEPLOYMENT.md`).
