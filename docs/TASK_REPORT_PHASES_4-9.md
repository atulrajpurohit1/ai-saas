# Task Report — Product Improvement Audit, Phases 4–9

**Source audit:** `docs/PRODUCT_IMPROVEMENT_AUDIT.md` (audit date 2026-08-14)
**Work period:** 2026-09-01 → 2026-09-02
**Branch:** `main` (6 commits, local — not yet pushed)
**Scope of this report:** Phases 4–9 only. Phases 1–3H (the bulk of the audit,
including the five P0s, charts, Deals kanban, Prospect Search shell, RBAC/branding
polish, and the whole "Security Industry Opportunities" strategic track) were
completed in earlier work and are not re-covered here.

---

## Summary

| Phase | Title | Commit | Source files | Net lines |
|---|---|---|---|---|
| 4 | Guard shift status clarity + check-out validation + Sales Calls copy | `ff20bf8` | 3 | +30 |
| 5 | Guard portal refresh-token flow | `137f747` | 10 | +281 |
| 6 | Shifts calendar view | `3588207` | 2 | +252 |
| 7 | Admin aggregate patrol-monitoring dashboard | `acade3b` | 5 | +205 |
| 8 | Finish guard portal design-system unification | `628777e` | 2 | 0 (swaps) |
| 9 | In-app onboarding guidance | `6aa93be` | 4 | +158 |
| **Total** | | **6 commits** | **25 source files** | **~+1,400 / -112** |

(File/line counts exclude regenerated `backend/dist/` build output.)

All phases verified before commit:
- Backend: `tsc --noEmit` clean (3 pre-existing errors in untouched spec files
  ignored per project note), `jest` **338/338 unit tests pass**, e2e AppModule
  boot passes (DI re-verified after every module change), `nest build` clean.
- Frontend: `tsc --noEmit` clean, `eslint` clean (pre-existing warnings only),
  `next build` passes.

---

## Phase 4 — Guard shift status clarity + check-out validation + Sales Calls copy

**Audit items addressed:** P1 "Guard Shifts status shows COMPLETED and PENDING
simultaneously"; P1 "attendance shows check-in/check-out two minutes apart despite
a 10-day window — implausible, likely a logic defect"; P2 "Sales Calls messaging
should distinguish 'not available on your plan' from 'not configured'".

### What was implemented

1. **Guard shifts list — status labelling** (`frontend/src/app/guard/shifts/page.tsx`)
   - Investigation found the admin shift page and guard shift-*detail* page had
     already been fixed in earlier work (they show separate "Schedule:" /
     "My Status:" / "Attendance:" labels). The remaining confusing surface was the
     guard shifts **list**: it rendered a bare assignment-status string next to a
     schedule-status badge with no labels, so the two contradictory-looking values
     had no explanation.
   - Fix: the assignment status is now prefixed `"My status: …"` and humanised via
     `formatEnumLabel`; the schedule badge gets a `"Schedule"` caption — mirroring
     the detail-page pattern exactly. Purely presentational.

2. **Check-out time integrity** (`backend/src/guard-portal/guard-portal.service.ts`)
   - Root cause of the audit's "2 minutes apart" observation: `checkOut()` had no
     guard that the check-out moment is actually after the recorded check-in.
     `roundHours()` wraps the delta in `Math.max(0, …)`, so a backwards timestamp
     (clock skew / tampering) silently produced a **0-hour timesheet on a billable
     record**.
   - Fix: before creating the `CHECK_OUT` event, if `Date.now() <= checkInTime`
     the request is rejected with `BadRequestException` and logged through the
     existing `logInvalidAttendanceAttempt` audit helper — same shape as the three
     validation guards already in that method.

3. **Sales Calls messaging** (`frontend/src/app/sales-calls/page.tsx`)
   - The user-facing string `"Configure OPENAI_API_KEY to enable audio
     transcription."` leaked an env-var name into the UI.
   - Replaced with: *"Audio transcription isn't available in this environment yet.
     Paste a transcript below to use the live coach and discovery analysis."* —
     names no env var, points the user to the path that does work. The backend
     `configured` flag still drives the disabled state; no backend change.

### Files
- `backend/src/guard-portal/guard-portal.service.ts` (+16)
- `frontend/src/app/guard/shifts/page.tsx` (+8 / −2)
- `frontend/src/app/sales-calls/page.tsx` (1 line)

### Risk
Very low. Two changes are cosmetic; the check-out guard only fires on a
clock-skew/tamper condition that currently corrupts data silently.

---

## Phase 5 — Guard portal refresh-token flow

**Audit items addressed:** P1 "intermittent session-expiry bug"; Technical Audit
"guard portal has no refresh flow at all (`REFRESH_ENDPOINTS.guard = ''`), so
guards still hard-logout on token expiry"; and a latent bug: with an empty
endpoint string, `api.ts` line 127 `originalRequest.url?.includes('')` matched
**every** request, so any guard 401 forced an immediate logout.

### What was implemented

**Schema** (`backend/prisma/schema.prisma`)
- New nullable column `Guard.refreshToken` (`@map("refresh_token")`) — stores the
  bcrypt hash of the guard's current refresh token; `null` = no active session.

**Migration helper** (`backend/scripts/apply-guard-refresh-token-column.ts`)
- Idempotent `ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT`,
  matching the existing `apply-*-column.ts` convention. **Not yet run against the
  live database** (see Outstanding Items).

**Backend `guard-auth`**
- `guard-auth.service.ts`: added a `getTokens()` helper issuing an access token
  (`JWT_ACCESS_SECRET`) + refresh token (`JWT_REFRESH_SECRET`) with a
  `role: 'guard'` payload; `login()` now returns the pair and persists the hash;
  new `refreshTokens(guardId, rt)` validates the stored hash, rotates, and
  re-issues; new `logout(guardId)` clears the hash.
- `guard-auth.controller.ts`: new `POST guard-auth/refresh` and
  `POST guard-auth/logout`, both behind the shared `JwtRefreshGuard` and
  hard-checked to `role === 'guard'`.
- `guard-auth.module.ts`: imports `AuthModule` so the shared `jwt-refresh`
  passport strategy is registered for this module's routes.
- `guards.service.ts`: `withoutPasswordHash()` was renamed in intent — it now
  strips **both** `passwordHash` and `refreshToken`, so the new hash can never
  reach an admin-facing API response. (Audited every other guard-returning query;
  all use explicit `select` or only read `.name`/`.id`/`.phone`.)

**Frontend**
- `lib/api.ts`: `PORTAL_STORAGE_KEYS.guard.refreshToken` set to
  `'guard_refresh_token'`; `REFRESH_ENDPOINTS.guard` set to `'guard-auth/refresh'`;
  the refresh-call detection reworked to `Boolean(refreshEndpoint) &&
  url?.includes(refreshEndpoint)` so an empty endpoint can never again match every
  request.
- `app/guard/login/page.tsx`: stores `guard_refresh_token` from the login response.
- `components/GuardLayout.tsx`: logout clears `guard_refresh_token` and fires a
  best-effort `guard-auth/logout` (never blocks the client-side logout).

### Files
`schema.prisma` (+3), `apply-guard-refresh-token-column.ts` (new, +30),
`guard-auth.service.ts` (+102/−…), `guard-auth.controller.ts` (+37/−…),
`guard-auth.module.ts` (+5/−…), `guards.service.ts` (+9/−…),
`lib/api.ts` (+8/−…), `guard/login/page.tsx` (+3), `GuardLayout.tsx` (+9).

### Risk
Medium (auth-sensitive) — isolated to its own commit for reviewability.
Verified by the e2e AppModule boot (DI wiring for the modified `GuardAuthModule`)
and the full unit suite. Until the DB column is applied, guard **login still
works** (the returned refresh token just isn't persisted, so `guard-auth/refresh`
fails gracefully) — behaviour is no worse than before this phase.

---

## Phase 6 — Shifts calendar view

**Audit items addressed:** P1/P2 "No calendar or timeline visualization — a
scheduling tool without a calendar is a significant functional gap for its own
domain"; Feature Gap #5; Strategic Feature #2.

### What was implemented

1. **`frontend/src/components/ShiftsCalendar.tsx` (new)**
   - Dependency-free month grid (no `@fullcalendar` / `date-fns` added). 6-week
     fixed height so the grid doesn't jump between months. Prev / next / "Today"
     navigation.
   - Shifts bucketed by start day into a `Map`; each day cell shows up to 3
     status-toned chips (start time · site name · `assigned/required` guard count)
     with a `"+N more"` overflow indicator. Chip tone reuses `toneForStatus` from
     the shared `StatusBadge`.
   - `onSelectShift` callback: clicking an unassigned shift opens the page's
     existing Assign-Guard modal (already permission-gated).

2. **`frontend/src/app/shifts/page.tsx`**
   - `view` state (`'list' | 'calendar'`), persisted to `localStorage`
     (`ai-saas-shifts-view`), list is the default — mirroring the Deals
     kanban/list toggle pattern.
   - List/Calendar toggle added to the page header.
   - The search + branch filter bar was lifted out of the table card into its own
     card so it applies to **both** views.
   - The three duplicated inline filter predicates in the table body were
     collapsed into a single `filteredShifts` (also fed to the calendar).
   - **No backend change** — `shifts.service.findAll()` already returns
     `startTime`, `endTime`, `site`, `status`, `assignments`.

### Files
`ShiftsCalendar.tsx` (new, +202), `app/shifts/page.tsx` (+126/−38).

### Risk
Low — pure frontend, additive. The existing table view is unchanged in behaviour;
the calendar is a second rendering of the same filtered data.

---

## Phase 7 — Admin aggregate patrol-monitoring dashboard

**Audit items addressed:** P1/P2 "No admin-side **aggregate** patrol view (across
guards/sites) — what's shown is a single checkpoint list, not a cross-guard,
cross-site monitoring dashboard"; Feature Gap #6; Strategic Feature #3.

### What was implemented

**Backend — read-only, branch-scoped, no new tracking introduced**
- `patrols.service.ts` → `getPatrolOverview(user)`: one query returning
  - `summary`: active runs, guards on patrol, completed today, checkpoints scanned
    today, missed checkpoints today, geofence failures today;
  - `activeRuns[]` and `completedToday[]` rows: guard, route, site, shift window,
    status, checkpoint progress (`scanned / total / missed`), geofence-failure
    count, last scan time, and — for active runs only — the existing
    `PatrolRun.last{Latitude,Longitude,AccuracyMeters,LocationAt}` fields
    (introduced in Phase 3B, surfaced as-is).
- `patrols.controller.ts` → `GET patrol-runs/overview`, declared **before**
  `patrol-runs/:id` so the `:id` route can't capture `"overview"`. Same
  `patrols.view` / `patrols.manage` permission as the other patrol reads.

**Frontend**
- `frontend/src/app/patrol/monitor/page.tsx` (new): 6-card summary row;
  "In progress" table with checkpoint progress and a live/stale location link to
  Google Maps (staleness from `LOCATION_STALE_THRESHOLD_MS`); "Completed today"
  table with a clean/issue flag. Auto-refreshes on
  `ADMIN_LOCATION_POLL_INTERVAL_MS` (15s). Built on the shared design-system
  primitives (`PageHeader`, `LoadingState`, `ErrorState`, `EmptyState`,
  `StatusBadge`).
- `lib/patrols.ts`: `PatrolOverview` / `PatrolOverviewRun` types + `getPatrolOverview()`.
- `lib/nav-links.ts`: "Patrol Monitor" link added under the Operations group.

### Files
`patrols.service.ts` (+119), `patrols.controller.ts` (+7),
`app/patrol/monitor/page.tsx` (new, +241), `lib/patrols.ts` (+41),
`lib/nav-links.ts` (+1).

### Risk
Low — new read-only endpoint + new page; no existing patrol code paths modified.
Verified by the patrols suite (37/37) and the e2e boot.

---

## Phase 8 — Finish guard portal design-system unification

**Audit items addressed:** P1/P2 "The three role-based portals use three visibly
different design languages"; Design System Audit "having field workers experience
a visibly different product is a real inconsistency"; Strategic Feature #1.

### Context

Most of this was already done in earlier work: `GuardLayout`, the guard login
page, and the guard list/dashboard pages are already fully token-based
(`bg-background` / `bg-card` / `border-border` / `--radius` / `BrandMark` /
primary accent), and a large `!important` override layer in `globals.css`
re-themes the remaining copy-pasted dark utility classes (`bg-white/N`,
`text-slate-N`, `bg-[#0e0e1a]`, etc.) app-wide.

### What was implemented (the last real gaps)

`frontend/src/app/guard/shifts/[id]/page.tsx` and
`frontend/src/app/guard/shifts/[id]/patrols/page.tsx`:
- Replaced the two hardcoded green hexes `bg-[#0b1718]` and `bg-[#132122]` with
  `bg-card` / `bg-muted` tokens. These specific hexes are **not** covered by the
  `globals.css` override layer, so they rendered as raw dark-green boxes in the
  light theme — exactly the "different product" divergence the audit flagged.
- Fixed the patrol scan-confirmation modal, which had `border-white/10` with **no
  background class at all** (a transparent modal floating over the page) → now
  `border border-border bg-card` like every other modal.

**Deliberately left as-is:** `bg-emerald-500` on guard positive-action buttons —
a documented shared semantic with the admin Approve/Export buttons, not a
divergence.

### Files
`guard/shifts/[id]/page.tsx` (2 class swaps), `guard/shifts/[id]/patrols/page.tsx`
(2 class swaps). Zero net lines.

### Risk
Minimal — four class-string substitutions, no logic touched.

---

## Phase 9 — In-app onboarding guidance

**Audit items addressed:** UI/UX Audit #6 "No product onboarding, tour, or
contextual help was observed in any of the three portals"; Feature Gap #7;
"empty-state guidance beyond a bare sentence".

### What was implemented

1. **`frontend/src/components/GettingStartedCard.tsx` (new)**
   - Dismissible card on the admin dashboard. A 5-step setup path
     (branch → site → guards → shift → leads); each step is gated on a permission
     (`branches.view`, `sites.view`, …) via `useAuth().can()`, so a user only sees
     tasks they can actually perform, and each step links to the relevant page.
   - Dismiss state stored in `localStorage` (`ai-saas-getting-started-dismissed`);
     the card is hidden once dismissed or if the user has no applicable steps.
   - Deliberately a **static guide, not auto-checked against data** — keeps it
     backend-free and zero-risk. No product-tour library / overlay was added
     (would be a new dependency plus intrusive behaviour).

2. **Richer first-touch empty states**
   - `app/leads/page.tsx`: the "No leads yet" state now carries an "Add New Lead"
     button + a "Find Prospects" link and a sentence on what to do next.
   - `app/deals/page.tsx`: the "No active deals" state (used in both kanban and
     list views) now carries a "New Deal" button + "View Leads" link and a
     one-line explanation of what a deal is.

3. **`app/page.tsx`**: renders `<GettingStartedCard />` between the welcome header
   and the KPI cards.

### Files
`GettingStartedCard.tsx` (new, +107), `app/page.tsx` (+3),
`app/leads/page.tsx` (+20/−…), `app/deals/page.tsx` (+34/−…).

### Risk
Low — one new self-contained component + additive empty-state props.

---

## Outstanding items (not code — require a human decision/action)

1. **Run the Phase 5 database migration on the live Neon database before deploying
   the backend:**
   `cd backend && npx ts-node scripts/apply-guard-refresh-token-column.ts`
   (or `npx prisma migrate deploy`). The automated environment blocked running a
   schema mutation against production. Until this runs, guard login works but
   `guard-auth/refresh` will fail (no regression vs. current behaviour).

2. **Push the 6 commits.** All work is local on `main` (`ff20bf8` … `6aa93be`).

3. **Establish a permanently clean demo/staging tenant** separate from any
   environment test data is dumped into (audit Final Recommendation #5 /
   Strategic Feature #7). This is an infrastructure/process decision, not an
   implementation task.

---

## Verification log (per phase, before each commit)

| Check | Phase 4 | Phase 5 | Phase 6 | Phase 7 | Phase 8 | Phase 9 |
|---|---|---|---|---|---|---|
| backend `tsc --noEmit` | ✅ | ✅ | — | ✅ | — | — |
| backend `jest` (338 tests) | n/a* | ✅ 338/338 | — | ✅ (patrols 37/37 + full) | — | — |
| backend e2e (AppModule boot) | — | ✅ | — | ✅ | — | — |
| `nest build` | ✅ | ✅ | — | ✅ | — | — |
| frontend `tsc --noEmit` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| frontend `eslint` | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| `next build` | — | — | ✅ | ✅ | ✅ | ✅ |

\* Phase 4's backend change had no dedicated spec file; it follows the exact
pattern of the three existing validation guards in the same method. The full
suite was run green at Phase 5 (which builds on the same file).

Pre-existing, unrelated `tsc` errors in `invoices.service.spec.ts` and
`shifts.service.spec.ts` were present on clean `HEAD` before this work and are
ignored per the project's own tooling note.
