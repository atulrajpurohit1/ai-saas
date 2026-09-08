# AegisLead Complete QA Test Report

**Date:** 2026-09-07
**Performed by:** Automated QA / debugging engineer pass
**Branch:** `main` (working state at start: `856951f`; QA work committed as `1e0ed6b`)
**Scope:** Full automated discovery, end-to-end workflow testing, security testing,
database verification, static analysis and production build of the entire
AegisLead application.

---

## 1. Executive Summary

**Overall status: PASS WITH LIMITATIONS**

The application's core is in good shape. Every realistically automatable
end-to-end workflow was exercised against a **live backend + real PostgreSQL
database** using an isolated throwaway tenant, and the security model
(authentication, RBAC, tenant isolation, ownership checks, file-upload
hardening) held up under direct negative/attack testing.

Two **real bugs were found and fixed**, both in the guard portal — the
highest-priority area of the product:

1. **CRITICAL — Guard login returned HTTP 500 for every credential.** The
   `Guard.refresh_token` column was referenced by the Prisma schema and the
   guard-auth service but **no migration ever created it**. The entire guard
   portal (guard tour, checkpoint scanning, photo evidence, panic button,
   offline sync, check-in/out) was unreachable. Fixed with a proper additive
   migration; guard login and the full guard-tour workflow now pass end to end.

2. **MEDIUM — `POST /guard/sync` crashed with HTTP 500 on a malformed action.**
   `SyncOfflineActionsDto.actions` was typed as an array of DTOs but never
   validated its elements, so a bad offline-sync payload reached the database
   layer and threw a Prisma error instead of a clean `400`. Fixed by adding
   nested validation; regression tests added.

A third, pre-existing **RBAC gap** was confirmed (not fixed — see §7): the
admin patrol endpoints require permission keys (`patrols.view` /
`patrols.manage`) that **do not exist in the RBAC catalog**, so no
non-super-admin role can ever be granted access to the admin patrol dashboard.

**Limitations** (full list in §13): no browser/UI E2E was run (no
Playwright/Cypress in the repo and it was not added — see §5); external
integrations (Gemini, BlackPearl, OpenAI, HubSpot, SMTP) were not exercised
because credentials are not configured in this environment; the shared Neon
**development** database is slow and intermittently times out interactive
transactions (`/auth/register`), which is an environmental characteristic, not
an application defect.

---

## 2. Environment

| Component | Detail |
|---|---|
| Frontend | Next.js 16.2.4 (App Router), React 19.2.4, TypeScript 5, Tailwind v4 |
| Backend | NestJS 11, TypeScript 5.7, Prisma 6.19.3, Passport JWT |
| Database | PostgreSQL on **Neon** (shared **dev** endpoint `ep-rough-block-...`, `neondb`) |
| Node | v24.16.0 |
| Backend unit/integration tests | Jest 30 + ts-jest (`*.spec.ts`, 50 suites) |
| Backend E2E specs | Jest (`test/*.e2e-spec.ts`, supertest, real DB) |
| Live workflow harness | Custom Node HTTP + Prisma script (`backend/scratch/qa/run.js`) |
| Browser automation | **None present**; not added (see §5 and §13) |
| AI / integration keys | Not configured (`GEMINI_API_KEY` etc. absent) |

**Test-data strategy:** all live testing ran against an isolated tenant pair
(`qae2e-<timestamp>-a` / `-b`) plus a throwaway registration tenant and a
guard-auth E2E tenant, each fully cascade-deleted at the end. The database was
verified before and after to be unchanged (2 real tenants, 29 leads, 1 guard).
No production/real tenant data was read, modified, or deleted.

---

## 3. Feature Coverage

Legend — Tested: **Y** / partial **P** / **N**. Automated: **Y/N**.

| Feature | Tested | Result | Automated | Notes |
|---|---|---|---|---|
| **Authentication** |  |  |  |  |
| Admin register (happy path) | Y | PASS | Y | 201 + tokens; slow (~15–30s) on cold Neon |
| Admin register — duplicate slug/email | Y | PASS | Y | 409 |
| Admin register — invalid payload | Y | PASS | Y | 400 |
| Admin login (correct / wrong / unknown) | Y | PASS | Y | 200 / 401 / 401 |
| `GET /users/me` with valid token | Y | PASS | Y | 200 |
| Protected route: no token / bad token / bad signature-expiry | Y | PASS | Y | all 401 |
| Refresh with refresh token | Y | PASS | Y | 200 + new tokens |
| Refresh with access token (wrong token type) | Y | PASS | Y | rejected |
| Logout | Y | PASS | Y | 200 |
| **Guard auth** |  |  |  |  |
| Guard login (valid) | Y | **FIXED** & PASS | Y | Was HTTP 500 for all creds (BUG #1); now 200 + tokens |
| Guard login (wrong password / unknown identifier) | Y | **FIXED** & PASS | Y | Was 500; now clean 401 |
| Guard refresh-token persistence | Y | PASS | Y | hash written to the newly-added column |
| **Client-portal auth** |  |  |  |  |
| Client portal login | Y | PASS | Y | 200 + tokens (temp password from admin create-user) |
| **RBAC / Security** |  |  |  |  |
| Super-admin (tenant owner) bypasses permission checks | Y | PASS (by design) | Y | `User.isSuperAdmin` defaults `true` for the signup owner |
| Non-super Branch-Admin permission enforcement | Y | PASS | Y | can read `/leads`, blocked from admin patrol endpoints (§7) |
| Guard token rejected on admin routes | Y | PASS | Y | `/leads`, `/dashboard/summary`, `/emergency-alerts` → 401/403 |
| Client token rejected on admin + guard routes | Y | PASS | Y | `/leads`, `/guard/shifts` → 401/403 |
| RBAC permission catalog served | Y | PASS | Y | 97 keys via `GET /roles/permissions` |
| **Tenant isolation** |  |  |  |  |
| Cross-tenant GET / UPDATE / DELETE of a lead | Y | PASS | Y | all 404/403; DB verified unchanged |
| Cross-tenant lead does not appear in list | Y | PASS | Y | |
| Cross-tenant client `create-user` | Y | PASS | Y | 404/403 |
| Cross-tenant incident review | Y | PASS | Y | 403/404 |
| Cross-tenant emergency-alert visibility / acknowledge / resolve | Y | PASS | Y | not visible; action 403/404 |
| Cross-tenant patrol-evidence file download | Y | PASS | Y | 404 |
| **Dashboard** | Y | PASS | Y | `GET /dashboard/summary` 200 for admin, 401 unauth |
| **Leads / CRM** |  |  |  |  |
| Create / list / get / update / status-change | Y | PASS | Y | full CRUD; DB row + tenantId verified |
| Invalid status value | Y | PASS | Y | 400 (enum: new/contacted/proposal_sent/responded/closed) |
| Get non-existent id | Y | PASS | Y | 404 |
| Create without token | Y | PASS | Y | 401 |
| Duplicate lead submissions | Y | PASS | Y | both handled, no 5xx |
| Lead PDF upload/analyze, CSV export/import | N | — | N | Not exercised (needs Gemini / file fixtures) |
| **Deals / Proposals / Notes / Activities** | N | — | N | Endpoints discovered; not exercised this pass (CRM depth) |
| **Clients** |  |  |  |  |
| Create client + create portal user | Y | PASS | Y | temp password returned |
| **Sites** | Y | PASS | Y | create 201 |
| **Guards** | Y | PASS | Y | create via `POST /v2/guards` with password 201 (`/guards` alias has no POST) |
| **Shifts** |  |  |  |  |
| Create shift (v2) + assign guard | Y | PASS | Y | 201 / 200; DB assignment row verified |
| Shift AI guard recommendations | N | requires external | N | Gemini not configured |
| **Attendance** |  |  |  |  |
| Guard check-in | Y | PASS | Y | 200; DB `CHECK_IN` AttendanceEvent verified |
| Cross-tenant guard check-in to a shift | Y | PASS | Y | 403/404 |
| Unassigned same-tenant guard check-in | Y | PASS | Y | 403/404 |
| Guard check-out | P | — | N | Endpoint present; not exercised in isolation |
| **Guard Tour** |  |  |  |  |
| Guard lists patrol routes for their shift's site | Y | PASS | Y | 200; unassigned guard → 403 |
| Start patrol run | Y | PASS | Y | `in_progress`; bad route id → 404; non-assigned guard → 403 |
| Scan checkpoint (no geofence) | Y | PASS | Y | event created, `verificationStatus = NO_GEOFENCE_CONFIGURED` |
| Scan checkpoint inside geofence | Y | PASS | Y | `SUCCESS`, `distanceMeters` computed server-side |
| Re-scan checkpoint outside geofence | Y | PASS | Y | `OUTSIDE_GEOFENCE` |
| Scan checkpoint not on route | Y | PASS | Y | 400 |
| Another guard scanning someone else's run | Y | PASS | Y | 404 |
| Live location ping (valid / invalid lat) | Y | PASS | Y | 200 / 400 |
| Complete run; already-completed run | Y | PASS | Y | `completed` / 404 |
| Location ping after completion | Y | PASS | Y | 404 (tracking stops with the run) |
| Missed-checkpoint auto-marking on completion | Y | PASS | Y | unscanned checkpoint → `PatrolEvent.status = 'missed'` (DB verified) |
| Guard patrol history | Y | PASS | Y | includes the completed run |
| **Guard Tour — Photo Evidence** (in-progress feature) |  |  |  |  |
| Upload checkpoint photo (PNG) | Y | PASS | Y | 201; response omits `storedFileName` (verified) |
| DB linkage (event / run / guard) | Y | PASS | Y | `PatrolEvidence` row FK-verified |
| List evidence for own event | Y | PASS | Y | 200 |
| Download evidence file | Y | PASS | Y | 200, `image/*` content-type |
| Another guard lists / downloads evidence | Y | PASS | Y | 404 |
| Cross-tenant guard downloads evidence | Y | PASS | Y | 404 |
| Unauthenticated evidence file request | Y | PASS | Y | 401 |
| Reject `.exe` upload | Y | PASS | Y | 400 (extension filter) |
| Reject spoofed MIME (`.png` name, `octet-stream` type) | Y | PASS | Y | 400 (MIME re-check on disk) |
| Reject PDF (photos only) | Y | PASS | Y | 400 |
| Reject oversized file (>15 MB) | Y | PASS | Y | 400/413 (multer limit) |
| Multiple photos per event | Y | PASS | Y | second upload 201; list shows 2 |
| Evidence still readable after run completion | Y | PASS | Y | 200 |
| Physical camera capture | **N** | not testable | N | No device/camera; file-upload pathway fully covered instead (see §13) |
| **Incidents** |  |  |  |  |
| Guard files incident for a shift | Y | PASS | Y | 201 |
| Invalid severity | Y | PASS | Y | 400 |
| Guard attaches incident evidence (image) | Y | PASS | Y | 201 |
| Admin review queue shows the incident | Y | PASS | Y | 200 |
| Admin approves incident | Y | PASS | Y | 200; DB `reviewStatus = approved` |
| Cross-tenant admin cannot review | Y | PASS | Y | 403/404 |
| Client sees only approved incidents | P | PASS | Y | `GET /client/incidents` 200 (list shape ok; approval-filter logic not asserted per-row) |
| **Panic / Emergency Alerts** |  |  |  |  |
| Guard triggers panic | Y | PASS | Y | 201 |
| Guard sees own active alert | Y | PASS | Y | 200 |
| Admin/dispatcher sees alert | Y | PASS | Y | 200 |
| Cross-tenant admin does not see alert | Y | PASS | Y | verified absent |
| Guard cannot hit admin alert endpoints | Y | PASS | Y | 401/403 |
| Admin acknowledge → resolve | Y | PASS | Y | 200 / 200; DB `status = RESOLVED`, `acknowledgedAt` + `resolvedAt` set |
| Cross-tenant admin cannot resolve | Y | PASS | Y | 403/404 |
| Audit trail for alerts | Y | PASS | Y | `AuditLog` entries present |
| **Guard Location / Live Status** |  |  |  |  |
| Client "guard on site now" live status | Y | PASS | Y | `GET /client/patrols/live-status` 200 |
| **Client Portal** |  |  |  |  |
| Login, profile, proposals list, incidents list, live-status | Y | PASS | Y | all 200 |
| Client token blocked from admin/guard routes | Y | PASS | Y | 401/403 |
| Proposals approve/reject, invoices, disputes, reports, documents | N | — | N | Endpoints discovered; not exercised (needs seeded proposals/invoices) |
| **Offline Sync** |  |  |  |  |
| `GET /guard/sync/status` | Y | PASS | Y | 200 |
| Empty batch | Y | PASS | Y | 200/201 |
| Queued `patrol_checkpoint_scan` processed | Y | PASS | Y | DB `PatrolEvent` created; `GuardSyncQueue` row persisted |
| Replay same batch is idempotent | Y | PASS | Y | no 5xx; exactly 1 `PatrolEvent` (no duplicate) |
| Malformed action | Y | **FIXED** & PASS | Y | Was HTTP 500 (BUG #2); now 400 |
| Sync without token | Y | PASS | Y | 401 |
| Binary media over offline queue | N | not supported | N | Queue carries JSON actions only; photo capture is documented as online-only |
| **Public API** |  |  |  |  |
| No API key / bad API key | Y | PASS | Y | 401 / 401 |
| Authenticated public API calls | N | — | N | No API key provisioned this pass |
| **Webhooks** | N | — | N | Endpoints discovered; outbound delivery needs a receiver + config |
| **Vendor Portal** |  |  |  |  |
| Invitation with bogus token | Y | PASS | Y | 401/404 |
| Full RFP → invite → submit → evaluate → award | N | — | N | Not exercised (multi-step + AI evaluation) |
| **RFP / Vendors** | N | — | N | Endpoints discovered; AI generate/evaluate needs Gemini |
| **Finance (Invoices / Timesheets / Rate Cards / Disputes)** | N | — | N | Endpoints discovered; workflow needs seeded approved timesheets |
| **Guard Compliance** | N | — | N | Endpoints discovered; not exercised this pass |
| **Client Insurance / Compliance** | N | — | N | Endpoints discovered; not exercised this pass |
| **Branding / Branches / Documents** | N | — | N | Endpoints discovered; not exercised this pass |
| **Sales Accelerator / Prospect Search / Call Transcription** | N | requires external | N | Gemini / BlackPearl / OpenAI not configured |
| **Reliability** |  |  |  |  |
| 15 concurrent `GET /dashboard/summary` | Y | PASS | Y | all 200 |
| Duplicate form submission | Y | PASS | Y | no 5xx |

---

## 4. Backend / API Results

- **Route surface discovered:** 326 route decorators across **60 controllers**
  (see the controller enumeration performed during discovery).
- **Endpoints exercised over HTTP in the live workflow harness:** ~55 distinct
  endpoints across auth, users, roles, dashboard, leads, clients, sites,
  guards (v2), shifts (v2), guard-auth, guard portal (me/shifts/check-in/
  sync/sync-status), guard patrols (routes/runs/scan/location/complete/
  history/evidence×3), admin patrols (checkpoints/patrol-routes), guard
  incidents (create/evidence), admin incidents (review-queue/review/evidence),
  guard + admin emergency-alerts (trigger/active/list/acknowledge/resolve),
  client-auth, client-portal (proposals/profile/incidents), client patrols
  (live-status), public API (clients), vendor invitation.
- **Result:** every exercised endpoint behaved correctly after the two fixes.
  131/131 live checks pass on the final regression run (0 failures).
- **Existing backend test suites:** 50 suites / **367 tests pass**
  (49/361 before this pass; +1 suite / +6 tests added for the sync-DTO
  regression).
- **Backend E2E specs:** 2 suites / **4 tests pass** (`app.e2e-spec.ts` plus
  the new `guard-auth.e2e-spec.ts` regression, which hits the real DB).

### Negative / attack tests run (all handled correctly)

- Unauthenticated requests to protected admin, guard and client routes → 401.
- Malformed JWT, wrong-signature/expired JWT → 401.
- Wrong-token-type (access token on the refresh endpoint) → rejected.
- Authenticated **wrong-role** requests (guard→admin, client→admin,
  client→guard, guard→admin-alerts, non-super-admin→admin-patrols) → 401/403.
- **Cross-tenant** resource access (read/update/delete a lead, review an
  incident, resolve an alert, download patrol evidence, create a client user)
  → 404/403, and the DB was verified unchanged after each attempt.
- **Guard-vs-guard** isolation (scan another guard's run, list/download
  another guard's checkpoint evidence, check in to an unassigned shift) → 404/403.
- Invalid resource IDs → 404.
- Invalid payloads / wrong enum values / missing required fields → 400.
- **File-upload abuse** on patrol evidence: `.exe`, MIME spoof
  (`shell.png` + `application/octet-stream`), disallowed type (PDF),
  oversized (>15 MB) → all 400/413. `storedFileName` is never returned to a
  client.
- Public API with no key / bad key → 401.
- Vendor invitation with a bogus token → 401/404.
- Idempotency: replaying an offline-sync batch does not create duplicate
  `PatrolEvent` rows.

---

## 5. Frontend / E2E Results

**No browser-automation E2E was executed.**

- The repository contains **no Playwright, Cypress, or other browser-driver
  configuration**, and no frontend test files.
- A browser E2E framework was **not added**. Standing up Playwright against
  this app would require a reliable backend, and this environment's shared Neon
  **dev** database intermittently times out interactive transactions
  (`/auth/register` took 15–45s and occasionally failed with Prisma `P2028`),
  which would make a UI login flow flaky and unreliable as a signal. Adding a
  flaky E2E suite was judged worse than not adding one; this is called out
  honestly here rather than papered over.
- **Frontend static verification that WAS run:**
  - `tsc --noEmit`: **0 errors**.
  - `eslint .`: **0 errors**, 28 warnings (pre-existing: unused imports,
    `<img>` vs `next/image`, `any` types, `react-hooks/exhaustive-deps`).
  - `next build`: **success** — 55 routes compiled and prerendered, exit 0.
- The frontend API-client layer (`frontend/src/lib/*.ts`) and the guard-tour
  components under test in the working tree (`CheckpointPhotoCapture.tsx`,
  `CheckpointEvidenceViewer.tsx`) compile and lint clean; their **backend
  contracts** (upload, list, download, auth, tenant isolation, type/size
  rejection) were fully verified at the API level in §3.

**What this means:** business logic, data flow, authorization and persistence
are verified end-to-end at the API+DB layer. Pixel-level rendering, client-side
form validation, responsive layout, and in-browser camera behaviour were **not**
verified and require a manual or browser-automation pass (see §13).

---

## 6. Guard Tour Results

| Area | Result | Detail |
|---|---|---|
| Patrol routes | PASS | Guard sees only routes for their assigned shift's site; unassigned guard blocked (403) |
| Checkpoints | PASS | Seeded via DB (admin API is Super-Admin-only, see §7); on-route check enforced |
| Route ↔ checkpoint relationship | PASS | `PatrolRouteCheckpoint` ordering respected; off-route scan → 400 |
| Patrol run creation & lifecycle | PASS | start → `in_progress`; complete → `completed`; re-complete → 404 |
| Start patrol | PASS | assignment + active-route checks; bad route → 404; non-assigned guard → 403 |
| Checkpoint scanning | PASS | creates/updates `PatrolEvent`; re-scan updates the same event |
| Geofence verification | PASS | server-authoritative: `NO_GEOFENCE_CONFIGURED` / `SUCCESS` (14 m) / `OUTSIDE_GEOFENCE`; client verdicts never trusted; invalid coords → soft `INVALID_LOCATION`/`LOCATION_UNAVAILABLE` (no raw 400 on scan) |
| Missed checkpoints | PASS | unscanned checkpoints auto-marked `missed` on completion (DB verified) |
| Patrol completion | PASS | `completedAt` set; events returned |
| Guard authorization | PASS | run must belong to the JWT's guard; another guard → 404 |
| Tenant authorization | PASS | all run/event/evidence queries filter by `tenantId` |
| Patrol history | PASS | `GET /guard/patrol-runs` includes completed run |
| Audit trail | PASS | `PATROL_EVIDENCE_UPLOADED` audit entries written |
| **Status / Location** | PASS | live location ping scoped to `in_progress` run only; stops with the run; client `live-status` endpoint 200 |
| **Panic / Duress** | PASS | trigger → admin visibility → acknowledge → resolve → audit; cross-tenant blocked; guard blocked from admin endpoints; DB `status`, `acknowledgedAt`, `resolvedAt` verified |
| **Photo Evidence** | PASS | upload (PNG/JPG), multi-photo, list, download (`image/*`), DB FK linkage, `storedFileName` not leaked, readable after completion; **security**: cross-guard 404, cross-tenant 404, unauth 401, `.exe`/MIME-spoof/PDF/oversized all 400/413 |
| **Admin / Dispatcher visibility** | PASS (API) | admin can create checkpoints/routes (Super Admin); incident review queue + approve; alert list + acknowledge/resolve. **Admin patrol dashboard for non-super roles is blocked — see §7** |
| **Client visibility** | PASS (API) | `client/patrols/live-status` and `client/incidents` return 200 for a client token; blocked from guard/admin routes |
| Physical camera capture | NOT VERIFIED | no camera/device; the file-upload code path (which is what the browser camera input feeds) is fully covered |

---

## 7. Security Results

| Control | Result | Evidence |
|---|---|---|
| **Authentication** | PASS | JWT access/refresh; bad/missing/expired/wrong-signature tokens all → 401; wrong-token-type on refresh rejected; guard & client portals use separate login + `role` claim |
| **RBAC** | PASS (with one gap) | `PermissionGuard` + `@RequirePermission` enforced server-side; guard/client tokens always rejected on admin routes even with a valid signature; permission catalog (97 keys) served; **GAP:** `patrols.view` / `patrols.manage` are referenced by `patrols.controller.ts` but absent from `rbac.constants.ts`, so a non-super-admin role can **never** be granted admin patrol access (confirmed: Branch Admin → 403 on `POST /checkpoints` and `GET /patrol-routes`, while the same token gets 200 on `/leads`). Super Admin bypasses it, so the feature "works" for the tenant owner only. **Not fixed** — changing the RBAC catalog affects every tenant's role definitions and warrants a product decision on which roles should hold these keys. |
| **Tenant isolation** | PASS | Every cross-tenant read/write/delete attempt (lead, client-user, incident review, emergency alert, patrol evidence) → 404/403; DB verified unchanged after each; cross-tenant list results verified to exclude the other tenant's rows |
| **Ownership / context validation** | PASS | Guard-vs-guard: cannot scan another guard's run, cannot list/download another guard's checkpoint evidence, cannot check in to an unassigned shift — all 404/403 |
| **File-upload security** | PASS | Patrol + incident evidence: extension allow-list AND on-disk MIME re-check (renamed-executable and spoofed-MIME both rejected), per-type size cap (multer + service), `storedFileName` never returned, evidence file download requires auth + ownership + tenant match |
| **Public API auth** | PASS | Missing/invalid `X-API-Key` → 401 |
| **Vendor portal** | PASS | Bogus invitation token → 401/404 |
| **Super-admin default** | NOTE (by design) | `User.isSuperAdmin` defaults to `true`; the `/auth/register` owner becomes Super Admin. Standard "signup owns the tenant" pattern, but worth being aware of — a staff user created directly with `isSuperAdmin` unset would also be a super admin. |
| **Input validation** | PASS after fix | Global `ValidationPipe({ whitelist, transform })`; BUG #2 was a missing `@ValidateNested` on the offline-sync DTO — now fixed, malformed sync payloads → 400 |
| **Tokens in `localStorage`, no refresh rotation on the frontend** | KNOWN (documented) | Pre-existing, documented in `PROJECT_OVERVIEW.md` §10; out of scope for this pass |

---

## 8. Offline Sync Results

**Implementation:** `POST /guard/sync` accepts `{ actions: [{ id, actionType,
payload, createdAt }] }`. Actions are sorted by `createdAt`, deduplicated by
`id` against `GuardSyncQueue`, then dispatched to `check_in`, `check_out`,
`incident_create`, or `patrol_checkpoint_scan` handlers. "Already done" errors
(double check-in/out) are swallowed. `GET /guard/sync/status` returns queue
state.

| Scenario | Result |
|---|---|
| Empty batch | PASS — 200/201 |
| Queued checkpoint scan processed | PASS — real `PatrolEvent` created in DB; `GuardSyncQueue` row persisted |
| **Idempotent replay** of the same batch | PASS — no 5xx; still exactly **1** `PatrolEvent` (dedup by action `id` works) |
| Malformed action (`{id:'x'}` only) | **FIXED** — was HTTP 500 (Prisma error from `new Date("Invalid Date")` / `undefined` fields); now **400** |
| Unauthenticated sync | PASS — 401 |
| Failed-sync / retry accounting | PARTIAL — `GuardSyncQueue` has `status` / `retryCount` / `lastError`; the happy and idempotent paths are covered, deliberate mid-sync failure injection was not |

**What works:** JSON action queue, ordering, dedup/idempotency, auth,
per-tenant + per-guard scoping, checkpoint-scan replay into the real DB.

**What does NOT / limitation:** the offline queue carries **JSON actions
only** — it has no mechanism for binary media. Checkpoint **photo capture is
online-only** (documented in the codebase and in memory). A guard who scans a
checkpoint offline and syncs later gets the `PatrolEvent`, but any photo must
be taken/uploaded while connected. This was **not redesigned**; it is reported
as the current, intentional behaviour.

---

## 9. External Dependencies

Secret values are **not** shown. "Configured here" = present in this
environment's `backend/.env`.

| Dependency | Required to run? | Configured here? | Tested? | Configuration needed |
|---|---|---|---|---|
| PostgreSQL (`DATABASE_URL`) | **Yes** | Yes (Neon dev) | Yes | A Postgres URL; migrations via `prisma migrate deploy` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` + expiries | **Yes** | Yes | Yes (all auth flows) | Any strong secrets |
| `PORT` | No (defaults 5000) | Yes | Yes | — |
| **Google Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`, `ENABLE_AI_FALLBACK`) | No (deterministic fallback) | Key **absent**; fallback vars present | **No** | API key for real AI proposals/scoring/RFP/coaching; otherwise fallbacks |
| **BlackPearl / Bebop** (`BLACKPEARL_API_KEY`, `BLACKPEARL_BASE_URL`) | No | Base URL present, key **absent** | **No** | Paid async API for AI Prospect Search; 503 without it |
| **OpenAI** (`OPENAI_API_KEY`) | No | **Absent** | **No** | Call-audio transcription only; hard-fails without it |
| **HubSpot** (`HUBSPOT_CLIENT_ID` / `SECRET` / `REDIRECT_URI`) | No | **Absent** | **No** | OAuth app for CRM contact import; needs a HubSpot account + callback URL |
| **SMTP** (`SMTP_HOST/PORT/USER/PASS`) | No (Ethereal fallback) | Present | **No** (no email sent this pass) | Real SMTP for proposal + RFP vendor emails |
| **GoHighLevel** widget | No | N/A (frontend script) | **No** | Third-party chat widget; not a data integration |
| Outbound webhooks | No | N/A | **No** | Needs a tenant-configured receiver URL + secret |

---

## 10. Bugs Found

| # | Bug | Severity | Root cause | Fixed? | Retested? |
|---|---|---|---|---|---|
| 1 | **Guard login returns HTTP 500 for every credential** — entire guard portal (tour, evidence, panic, offline sync, check-in/out) unreachable | **Critical** | `Guard.refreshToken @map("refresh_token")` was added to `schema.prisma` and is read by `GuardAuthService` on every login (`findMany` + refresh-hash write), but **no migration ever created the `refresh_token` column**. Postgres rejects the query with `P2022`. A manual patch script (`scripts/apply-guard-refresh-token-column.ts`) existed but had never been run against this DB. | **Yes** — added migration `20260906000000_add_guard_refresh_token` (`ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT`), applied via `prisma migrate deploy`. | **Yes** — `guard-auth.e2e-spec.ts` (3 tests, real DB) + full guard-tour workflow in the live harness (all pass). Would fail with 500 pre-fix. |
| 2 | **`POST /guard/sync` returns HTTP 500 on a malformed action** instead of 400 | **Medium** | `SyncOfflineActionsDto.actions` typed `OfflineActionDto[]` but decorated only with `@IsArray()`. class-validator does not recurse into array elements without `@ValidateNested({ each: true })` + `@Type()`. A bad action (`{id:'x'}`) passed validation, reached `guardSyncQueue.create` with `actionType: undefined` / `createdAt: new Date("Invalid Date")` → `PrismaClientValidationError`. | **Yes** — added `@ValidateNested({ each: true })`, `@Type(() => OfflineActionDto)`, `@ArrayMaxSize(500)` to the DTO. | **Yes** — new `sync-offline-actions.dto.spec.ts` (6 tests) + live harness "malformed action → 400" now passes; idempotent-replay and happy-path sync still pass. |
| 3 | **RBAC catalog missing `patrols.view` / `patrols.manage`** — no non-super-admin role can access the admin patrol dashboard/API | **Medium** (pre-existing, documented as *suspected* in `PROJECT_OVERVIEW.md` §10) | `patrols.controller.ts` guards every route with `@RequirePermission('patrols.manage')` / `@RequireAnyPermission('patrols.view','patrols.manage')`, but neither key exists in `backend/src/roles/rbac.constants.ts`, so no role (system or custom) can be granted them. Only Super Admin (who bypasses the permission check) can reach these endpoints. | **No** — confirmed with a live test (Branch Admin → 403 on `POST /checkpoints` and `GET /patrol-routes`; same token → 200 on `/leads`). Fixing means adding the keys to the catalog and deciding which system roles (Supervisor? Scheduler? Branch Admin?) should hold them — a product/permissions decision that changes every tenant's role definitions. Flagged for the team. |

Environmental (not application bugs, not fixed):

- **Neon dev-endpoint interactive-transaction latency.** `/auth/register` and
  other `$transaction` endpoints take 15–45s on a cold connection and
  occasionally fail with Prisma `P2028` ("Unable to start a transaction in the
  given time"). Non-transaction queries are fast (~1s). This is a
  characteristic of the shared Neon **dev** tier, not the application — the
  same code runs the fixture setup instantly via a tuned connection pool. On a
  production-grade Postgres this would not manifest. Worth noting because a
  real user hitting registration on a cold instance would see a very slow
  response.

---

## 11. Tests Added

| File | Type | Tests | Covers |
|---|---|---|---|
| `backend/src/guard-portal/dto/sync-offline-actions.dto.spec.ts` | Unit | 6 | Nested validation of offline-sync actions (regression for BUG #2): empty array ok, well-formed action ok, missing `actionType`/`payload`/`createdAt` rejected on the `actions` property, non-array rejected, non-object `payload` rejected, `OfflineActionDto` requires all four fields |
| `backend/test/guard-auth.e2e-spec.ts` | E2E (real DB) | 3 | Regression for BUG #1: wrong credentials → 401 (never 500), unknown identifier → 401, valid guard → 200 + tokens + `refreshToken` persisted to the previously-missing column. Creates and cascade-deletes its own tenant. |
| `backend/prisma/migrations/20260906000000_add_guard_refresh_token/` | Migration | — | Adds the missing `Guard.refresh_token` column (the fix for BUG #1) |
| `backend/scratch/qa/lib.js` + `run.js` | Live workflow harness | 131 checks | Full end-to-end HTTP + DB verification suite (auth, RBAC, tenant isolation, CRM, field ops, full guard tour, photo evidence + security, incidents, panic, client portal, offline sync, public API, reliability). Provisions an isolated `qae2e-*` tenant pair and tears it down. Re-runnable: `node backend/scratch/qa/run.js` (needs a running backend on `:5000`). |

---

## 12. Validation Results

Exact numbers from the final regression run:

| Check | Command | Result |
|---|---|---|
| Backend unit + integration | `jest --ci` | **50 suites / 367 tests — PASS** (was 49/361; +1 suite/+6 tests) |
| Backend E2E specs | `jest --config test/jest-e2e.json` | **2 suites / 4 tests — PASS** (was 1/1; +1 suite/+3 tests) |
| **Live end-to-end workflow suite** | `node backend/scratch/qa/run.js` | **131 checks — PASS, 0 FAIL** |
| Backend TypeScript (app code) | `tsc --noEmit -p tsconfig.build.json` | **0 errors — PASS** |
| Backend TypeScript (incl. spec files) | `tsc --noEmit -p tsconfig.json` | 3 pre-existing errors in `invoices.service.spec.ts` (2) and `shifts.service.spec.ts` (1) — self-referential `typeof tx` annotations; **not introduced by this pass**, excluded from the build, tolerated by ts-jest, all affected tests pass. Left as-is per "don't modify unrelated functionality". |
| Backend ESLint (changed files) | `eslint <my 3 files>` | **0 errors — PASS** |
| Backend ESLint (whole `src`) | `eslint "src/**/*.ts"` | ~1510 errors / 67 warnings **pre-existing project-wide** (`@typescript-eslint/no-unsafe-*`, `no-explicit-any`, prettier). The lint script is `eslint --fix`; a blanket fix is explicitly discouraged in project memory. Not caused by, and not addressed in, this pass. |
| Frontend TypeScript | `tsc --noEmit` | **0 errors — PASS** |
| Frontend ESLint | `eslint .` | **0 errors**, 28 pre-existing warnings — PASS |
| Frontend production build | `next build` | **PASS** — 55 routes, exit 0 |
| Prisma schema | `prisma validate` | **valid** |
| Prisma migrations | `prisma migrate deploy` / `migrate status` | 52 migrations applied; **"Database schema is up to date"** |

---

## 13. Remaining Limitations

Honest list of what was **not** verified and why:

1. **No browser / UI end-to-end testing.** No Playwright/Cypress in the repo;
   not added because this environment's DB latency would make a UI suite
   flaky (see §5). Pixel rendering, client-side form validation, navigation,
   refresh-persistence, loading/empty/error states, and responsive layout
   (desktop/tablet/mobile viewports) are **unverified**. Requires a manual or
   browser-automation pass against a stable backend.
2. **Physical camera capture is unverified.** No device/camera available.
   The file-upload pathway that the browser camera input feeds (`multipart`
   POST to the evidence endpoint) is **fully covered** at the API level,
   including type/size/spoof rejection. In-browser `getUserMedia` / capture UI
   behaviour was not tested.
3. **Real mobile-device testing is unverified.** Viewport testing was not
   performed either (see #1). Browser viewport testing ≠ physical device.
4. **External integrations are unverified** — no credentials configured:
   Google Gemini (AI proposals/scoring/RFP/coaching — falls back), BlackPearl
   (AI Prospect Search — 503 without key), OpenAI (call transcription),
   HubSpot OAuth (CRM import), SMTP (proposal/RFP emails), outbound webhooks.
   All require an account/key/receiver to test.
5. **Offline media is not supported by design.** The offline queue is
   JSON-only; checkpoint photo capture is online-only. Documented, tested as
   the current behaviour, **not redesigned**.
6. **Several backend domains have endpoints but were not exercised this pass:**
   Deals/Proposals/Notes/Activities depth, full RFP → vendor → evaluate →
   award flow, Finance (invoices/timesheets/rate-cards/disputes) lifecycle,
   Guard Compliance, Client Insurance, Branding/Branches/Documents,
   Sales Accelerator, webhooks delivery, authenticated Public API. These need
   seeded prerequisite data (approved timesheets, proposals, API keys) and/or
   external services. Their route surface, guards, and DTOs were reviewed
   during discovery.
7. **Client-portal "approved incidents only" filter** — the endpoint returns
   200 and the correct shape; per-row approval filtering logic was not
   asserted with a mixed approved/pending dataset.
8. **Session-expiry stability** (the intermittent-logout issue noted in the
   product docs) was not reproduced or root-caused — it needs sustained
   real-usage observation, not a single automated pass.
9. **Neon dev database** is slow/flaky for interactive transactions; a
   production Postgres is needed to characterise real registration/latency.
10. **Load / soak testing** was intentionally not performed against the shared
    database (only a light 15-request concurrency check).

---

## 14. Production Readiness

| Dimension | Rating | Notes |
|---|---|---|
| **Code quality** | **B+** | Clean module structure, consistent controller→service→DTO pattern, server-authoritative geofence, good file-upload hardening. Dragged down by large pre-existing `typescript-eslint` strict-rule debt (1500+ lint errors) and a committed `dist/`. |
| **Security** | **B+** | Auth, RBAC, tenant isolation, ownership checks and file-upload validation all held up under direct attack testing. One RBAC catalog gap (BUG #3), `localStorage` tokens (known), `isSuperAdmin` defaults `true`. No IDOR / cross-tenant leak found. |
| **Backend** | **A−** | 367 unit/integration + 131 live E2E checks green after two real fixes. Every exercised endpoint correct. Broad domains (finance, RFP, webhooks) still need workflow-level testing. |
| **Frontend** | **C+ / incomplete** | Typechecks, lints (0 errors), and builds cleanly; API contracts verified server-side. But **zero** in-browser verification — rendering, UX, responsive, camera all unverified. |
| **E2E (API/workflow)** | **A−** | Full guard-tour, panic, evidence, incidents, offline-sync, tenant-isolation and auth flows verified against a live server + real DB with negative tests. |
| **E2E (browser/UI)** | **F / not done** | No browser automation exists or was added. |
| **Mobile** | **F / not done** | No device, no viewport testing, camera unverified. Guards are a mobile-first user — this is a real gap. |
| **External integrations** | **Unverified** | Gemini/BlackPearl/OpenAI/HubSpot/SMTP/webhooks not configured or tested here. |
| **Production infrastructure** | **C** | No object storage — all uploads (patrol/incident/compliance/insurance/vendor evidence) are local-disk and **do not survive a PaaS redeploy** (documented in `file-storage.util.ts`). In-memory rate-limiting and prospect-search cache (need Redis for multi-instance). No payment processor. Custom-domain SSL/routing not automated. |

### Overall recommendation

**Not yet production-ready as a whole — but the backend and its security model
are close, and the guard portal is now actually functional.**

- **Ship-blocking before any real launch:**
  1. The guard-login fix (**BUG #1**) must be deployed — without it the guard
     portal is 100% down. *(Migration is committed; run `prisma migrate deploy`
     on every environment.)*
  2. Decide and implement the patrol RBAC keys (**BUG #3**) or the admin
     patrol dashboard is Super-Admin-only.
  3. Move file uploads to real object storage, or accept that all photo/PDF
     evidence is lost on every redeploy.
- **Strongly recommended before launch:**
  4. A browser E2E pass (Playwright) against a stable DB, including the guard
     mobile flow and camera capture on a real device.
  5. Configure and smoke-test the external integrations that the product
     depends on (at minimum Gemini and SMTP).
  6. Redis for rate-limiting / cache if running more than one backend instance.
- **The API layer itself** — auth, RBAC, tenant isolation, CRM core, the full
  guard-tour + evidence + panic + offline-sync workflow — **passed
  comprehensive automated end-to-end and negative testing** and can be trusted
  to behave as designed.

---

## Concise Summary

```
TOTAL FEATURES DISCOVERED:   ~55 feature areas across 60 controllers / 326 routes / 67 DB models
TOTAL FEATURES TESTED:       38 exercised end-to-end (Y/P in the coverage table); 17 discovered-only (needs external creds or seed data)
PASSED:                      all exercised features pass after fixes (131/131 live checks, 367 unit, 4 e2e-spec)
FAILED:                      0 remaining (2 real bugs found were fixed; 1 RBAC gap confirmed, not fixed — needs product decision)
FIXED:                       2 (guard-login 500 via missing migration; offline-sync 500 via missing nested DTO validation)
NOT TESTABLE:                browser/UI E2E, physical camera, real mobile device, external integrations (Gemini/BlackPearl/OpenAI/HubSpot/SMTP/webhooks), offline binary media (unsupported by design)
TESTS ADDED:                 9 automated tests (6 unit + 3 e2e-spec) + 1 migration + a 131-check live workflow harness
TOTAL AUTOMATED TESTS:       367 unit/integration + 4 backend e2e-spec + 131 live workflow checks = 502 automated checks, all green
TYPECHECK:                   PASS  (backend app code 0 errors; frontend 0 errors; 3 pre-existing errors in 2 backend spec files, excluded from build)
LINT:                        PASS on changed files (0 errors); pre-existing project-wide strict-rule debt left untouched per project policy
BUILD:                       PASS  (backend nest build exit 0; frontend next build exit 0, 55 routes)
E2E:                         PASS at API/workflow level (131/131); NOT DONE at browser/UI level (no framework present, not added)
SECURITY:                    PASS  (auth, RBAC, tenant isolation, ownership, file-upload hardening all verified under negative testing; 1 RBAC catalog gap flagged)
PRODUCTION READINESS:        PASS WITH LIMITATIONS — backend/API + security near-ready; deploy the guard-login migration; resolve patrol RBAC keys and object storage; browser/mobile and external-integration testing still required
```
