# Photo Evidence — QA Report

**Feature under test:** Guard captures / uploads a photo as evidence for a Guard
Tour patrol **checkpoint scan event**.
**Date:** 2026-09-07
**Scope:** ONLY the checkpoint photo-evidence workflow. No unrelated Guard Tour,
CRM, or other functionality was modified.
**Environment:** NestJS 11 + Prisma 6 backend, real PostgreSQL (Neon **dev**
`neondb`), local-disk file storage, Node v24.16.0, Jest 30. No browser E2E
framework present in the repo.

---

## 1. Feature Overview

A guard on patrol scans a checkpoint (creating a `PatrolEvent`), then attaches
one or more **photos** to that scan as evidence. The guard can review their own
attached photos; an admin/dispatcher can view them read-only on the patrol-run
timeline. Photos are **image-only**, size-capped, stored on local disk, and
served only through authenticated, ownership-scoped endpoints. There is **no
delete** endpoint for patrol evidence (audit-record immutability).

Status legend: ✅ WORKING · ❌ NOT WORKING · ⚠️ PARTIALLY WORKING · ⏸️ NOT
TESTABLE · 🔧 FIXED

**Overall: ✅ WORKING**

---

## 2. Implementation Found

### Database — `PatrolEvidence` model (`backend/prisma/schema.prisma`)

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `tenantId` → `Tenant` | `onDelete: Cascade`, indexed |
| `patrolEventId` → `PatrolEvent` | `onDelete: Cascade`, indexed — the checkpoint scan the photo belongs to |
| `patrolRunId` | denormalised (indexed), also FK-consistent with the event |
| `guardId` | the guard who owns the scan |
| `mediaType` | always `'image'` — derived server-side from the validated MIME |
| `mimeType` | canonical, lower-cased, `;charset` stripped |
| `fileName` | original client filename (display only) |
| `storedFileName` | sanitized on-disk name — **never serialized to any client** |
| `fileSizeBytes` | `Int` |
| `uploadedById` | nullable; set to the guard id on guard uploads |
| `createdAt` | `@default(now())` |

Migration: `20260905230300_add_patrol_evidence` (applied; `prisma migrate
status` → up to date).

### Backend routes

**Guard-facing** — `backend/src/patrols/guard-patrols.controller.ts`,
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('guard')`:

| Method | Route | Purpose |
|---|---|---|
| POST | `guard/patrol-runs/:id/events/:eventId/evidence` | upload one photo (multipart field **`file`**) |
| GET | `guard/patrol-runs/:id/events/:eventId/evidence` | list evidence metadata for own event |
| GET | `guard/patrol-runs/:id/events/:eventId/evidence/:evidenceId/file` | stream the image bytes |

**Admin-facing** — `backend/src/patrols/patrols.controller.ts`,
`@UseGuards(JwtAuthGuard, PermissionGuard)` + `@RequireAnyPermission('patrols.view','patrols.manage')`:

| Method | Route | Purpose |
|---|---|---|
| GET | `patrol-runs/:id/events/:eventId/evidence` | list evidence metadata |
| GET | `patrol-runs/:id/events/:eventId/evidence/:evidenceId/file` | stream the image bytes |
| GET | `patrol-runs/:id` | run detail — includes `events[].evidence[]` **id-only metadata inline** (no `storedFileName`) |

### Backend service (`backend/src/patrols/patrols.service.ts`)

- `addCheckpointEvidenceForGuard(tenantId, guardId, runId, eventId, file)`
  - `findGuardPatrolEventForEvidence` — the `PatrolEvent` must match
    `{ id: eventId, tenantId, guardId, patrolRunId: runId, patrolRun: { tenantId, guardId, status: 'in_progress' } }`. All identity comes from the **JWT**, never the request body. A cross-tenant / cross-guard / cross-run / wrong-status id simply does not match → `NotFoundException`.
  - `isAllowedPatrolEvidencePhoto(originalname, mimetype)` — extension **AND**
    declared MIME must both be on the image allow-list
    (`jpe?g|png|webp|gif|heic|heif` × `image/jpeg|png|webp|gif|heic|heif`).
    Reuses `INCIDENT_EVIDENCE_IMAGE_MIME_TYPES`. On failure the just-written
    temp file is `unlinkSync`'d, then `BadRequestException`.
  - size re-check against `patrolEvidenceImageMaxBytes()` (default **15 MB**,
    env `PATROL_EVIDENCE_IMAGE_MAX_MB`) — belt-and-braces on top of the multer
    `limits.fileSize`.
  - writes the row, writes an `AuditLog` (`PATROL_EVIDENCE_UPLOADED`), returns
    `serializePatrolEvidence(...)` (which **omits `storedFileName`**).
- `listCheckpointEvidenceForGuard` — looser check (no `in_progress`
  requirement) so a guard can review photos after completing the run; still
  scoped to `{ tenantId, guardId, patrolRunId }`.
- `getCheckpointEvidenceFileForGuard` / `...ForAdmin` → `resolvePatrolEvidenceFile(tenantId, patrolEventId, evidenceId)` — the evidence row must match `{ id, tenantId, patrolEventId }`; then `join(PATROL_EVIDENCE_UPLOAD_DIR, storedFileName)` and stream. Missing file → 404.
- Admin path adds `findAdminPatrolEventForEvidence` — event must be in
  `user.tenantId` **and** on a run whose shift passes `branchWhere(user)`
  (branch scoping).

### File storage (`backend/src/common/file-storage.util.ts`)

- `multer.diskStorage` → `PATROL_EVIDENCE_UPLOAD_DIR = <cwd>/uploads/patrol-evidence/` (dir auto-created; `/uploads` is git-ignored).
- Stored filename: `` `${Date.now()}-${randomBytes(6).toString('hex')}-${sanitizeFilename(file.originalname)}` ``.
  `sanitizeFilename` = `basename` split on `/` and `\`, then
  `replace(/[^a-zA-Z0-9.\-_]/g, '_')`, capped at 150 chars → **path-traversal
  safe**, and the random prefix defuses filename collisions.
- File-download responses set `Cache-Control: private, no-store` and
  `Content-Disposition: inline; filename="<url-encoded>"`.
- **No object storage** (no S3 / Cloudinary / Firebase / GCS). Local disk only
  — same pattern as every other upload module. Known caveat: on a PaaS without
  a persistent volume, `uploads/` does not survive a redeploy. Documented in
  the util file.

### Frontend

- **Guard:** `frontend/src/components/CheckpointPhotoCapture.tsx` — one
  `<input type="file" accept="image/*" capture="environment">` (rear camera
  first, gallery fallback), thumbnail strip via authenticated blob → object
  URL, lightbox, `sonner` toast on success/error, lazy-loads already-attached
  photos on mount (survives refresh). Wired into
  `app/guard/shifts/[id]/patrols/page.tsx` under each **scanned, non-skipped**
  checklist row; shows *"Photos can be added once this checkpoint syncs."* when
  the scan is still an offline optimistic entry.
- **Admin:** `frontend/src/components/CheckpointEvidenceViewer.tsx` —
  read-only thumbnails + lightbox on the patrol-run timeline
  (`app/patrol/runs/page.tsx`), fed by the `events[].evidence[]` metadata from
  the run-detail payload, bytes streamed on demand.
- API client: `frontend/src/lib/patrols.ts` —
  `uploadCheckpointEvidence(runId, eventId, file)` (FormData, field `file`),
  `getCheckpointEvidence(scope, runId, eventId)`,
  `fetchCheckpointEvidenceObjectUrl(scope, runId, eventId, evidenceId)`
  (`responseType: 'blob'` through the authenticated axios instance).

---

## 3. Backend / API Tests

Automated via `backend/test/patrol-photo-evidence.e2e-spec.ts` — a real
end-to-end suite (real DB, real HTTP through the full Nest app, real file
storage). It provisions an isolated two-tenant fixture (tenant A with 2 guards
+ admin + site + shift + route + checkpoint; tenant B with a guard + admin),
starts a run, scans the checkpoint, then runs 43 assertions, and
cascade-deletes everything.

| # | Test | Status |
|---|---|---|
| 1 | Authenticated guard uploads a valid PNG → **201**, body has correct `id`/`mediaType`/`mimeType`/`fileName`/`patrolEventId`/`patrolRunId`/`guardId`/`uploadedById`/`fileSizeBytes` | ✅ WORKING |
| 2 | Response **omits `storedFileName`** | ✅ WORKING |
| 3 | Photo is associated with the **correct patrol event / run / guard** (asserted on the response and in the DB) | ✅ WORKING |
| 4 | Guard can **list** evidence for their own event; list also omits `storedFileName` | ✅ WORKING |
| 5 | Guard can **download** the file — `Content-Type: image/*`, correct `Content-Length`, `Cache-Control: no-store` | ✅ WORKING |
| 6 | **Admin** can list the same event's evidence | ✅ WORKING |
| 7 | **Admin** can download the file | ✅ WORKING |
| 8 | Admin `GET patrol-runs/:id` includes `events[].evidence[]` inline (id-only, no `storedFileName`) | ✅ WORKING |
| 9 | **Multi-photo** — a second upload on the same event succeeds; both persist | ✅ WORKING |
| 10 | Each allowed image type accepted: **jpeg / webp / gif / heic** | ✅ WORKING |
| 11 | Disallowed extension **`.exe`** → **400** | ✅ WORKING |
| 12 | **Spoofed MIME** (`shell.png` + `application/octet-stream`) → **400** | ✅ WORKING |
| 13 | Real **PDF** (`report.pdf` + `application/pdf`) → **400** (photos only) | ✅ WORKING |
| 14 | **Video** (`clip.mp4` + `video/mp4`) → **400** | ✅ WORKING |
| 15 | **SVG** with an image MIME (extension not on allow-list) → **400** | ✅ WORKING |
| 16 | **Oversized** file (16 MB > 15 MB cap) → **400/413** | ✅ WORKING |
| 17 | **Missing file part** (only a text field) → **400** | ✅ WORKING |
| 18 | Wrong multipart field name (`photo` instead of `file`) → **400** | ✅ WORKING |
| 19 | Unauthenticated **upload** → **401** | ✅ WORKING |
| 20 | Unauthenticated **list** → **401** | ✅ WORKING |
| 21 | Unauthenticated **file download** → **401** | ✅ WORKING |
| 22 | **Admin JWT** on the **guard** upload endpoint (role gate) → **401/403** | ✅ WORKING |
| 23 | **Guard JWT** on the **admin** list endpoint → **401/403** | ✅ WORKING |
| 24 | Garbage / malformed bearer token → **401** | ✅ WORKING |
| 25 | Upload to a **non-existent run id** → **404** | ✅ WORKING |
| 26 | Upload to a **non-existent event id** → **404** | ✅ WORKING |
| 27 | Upload with an **event id from a different run** → **404** (invalid checkpoint/event association rejected) | ✅ WORKING |
| 28 | Download a **non-existent evidence id** (event in scope) → **404** | ✅ WORKING |
| 29 | Download an evidence id that exists but is **not on the given event** → **404** | ✅ WORKING |
| 30 | **Path-traversal** style evidence id (`../../etc/passwd`) → **400/404**, never 200/500 | ✅ WORKING |
| 31 | Another guard, **same tenant**, cannot **upload** to this event → **404** | ✅ WORKING |
| 32 | Another guard, same tenant, cannot **list** this event's evidence → **404** | ✅ WORKING |
| 33 | Another guard, same tenant, cannot **download** this evidence file → **404** | ✅ WORKING |
| 34 | Guard from **another tenant** cannot download this evidence file → **404** | ✅ WORKING |
| 35 | Admin from **another tenant** cannot **list** this event's evidence → **404** | ✅ WORKING |
| 36 | Admin from another tenant cannot **download** this evidence file → **404** | ✅ WORKING |
| 37 | **Identity-based auth** — guard A2 forging `guardId=A1` / `tenantId` in the request body does **not** grant access → **404** | ✅ WORKING |
| 38 | Evidence remains **listable & downloadable after the run is completed** | ✅ WORKING |
| 39 | Uploading a **new** photo **after run completion** → **404** (run not `in_progress`) | ✅ WORKING |
| 40 | DB: exactly the expected row count on the event after the lifecycle tests (no leakage) | ✅ WORKING |
| 41 | DB: **no evidence row created for any rejected upload** (count stays at the allowed-upload total) | ✅ WORKING |
| 42 | The scan event links back to exactly the expected number of `PatrolEvidence` rows (no orphans / dupes) | ✅ WORKING |
| 43 | Deleting the `PatrolEvent` **cascade-deletes** its `PatrolEvidence` rows | ✅ WORKING |

**Result: 43 / 43 passed, 0 failed.**

(These are in addition to the 16 pre-existing unit tests in
`src/patrols/patrols-evidence.service.spec.ts` (10) and
`src/patrols/patrol-evidence.util.spec.ts` (6), plus 6 in
`src/patrols/guard-patrols.controller.spec.ts` covering the evidence upload
controller wiring — all still pass.)

---

## 4. Database Tests

| Check | Status | Detail |
|---|---|---|
| Evidence row actually persisted | ✅ WORKING | `prisma.patrolEvidence.findUnique` after upload returns the row |
| Correct **guard ID** stored | ✅ WORKING | `row.guardId` and `row.uploadedById` both = the authenticated guard |
| Correct **tenant ID** stored | ✅ WORKING | `row.tenantId` = the guard's tenant (from JWT, not the request) |
| Correct **patrol event / run** relationship | ✅ WORKING | `row.patrolEventId` = the scanned event, `row.patrolRunId` = its run |
| **Timestamps** correct | ✅ WORKING | `createdAt` within 60 s of the upload |
| **Metadata** correct | ✅ WORKING | `mediaType='image'`, `mimeType` canonicalised, `fileName` = client name, `fileSizeBytes` = byte length, `storedFileName` matches the `` `<ts>-<hex>-<sanitized>` `` pattern |
| **No orphaned records** | ✅ WORKING | rejected uploads create 0 rows; event→evidence count is exact after every phase |
| **DB constraints / cascade** | ✅ WORKING | deleting the `PatrolEvent` removes its `PatrolEvidence` rows (`onDelete: Cascade`); the model's `@@index` on `tenantId` / `patrolEventId` / `patrolRunId` present |
| Tenant cascade | ✅ WORKING (by schema) | `PatrolEvidence.tenant` is `onDelete: Cascade`; test teardown relies on it |

---

## 5. File / Storage Tests

| Check | Status | Detail |
|---|---|---|
| Uploaded image **actually stored** | ✅ WORKING | `existsSync(join(PATROL_EVIDENCE_UPLOAD_DIR, row.storedFileName))` = true after upload |
| Stored file **retrievable via the authorized API** | ✅ WORKING | guard and admin `.../file` endpoints stream the bytes with `image/*` and correct length |
| Files **not publicly accessible** without authorization | ✅ WORKING | no static route serves `uploads/`; the only path to the bytes is the JWT-guarded, ownership-scoped `.../file` endpoint; unauthenticated → 401, wrong owner/tenant → 404 |
| Invalid files **cannot bypass validation** | ✅ WORKING | `.exe`, spoofed MIME, PDF, video, SVG all rejected at the controller `fileFilter` **and** re-checked in the service; the temp file is `unlink`'d on rejection |
| **Path traversal** in the filename | ✅ WORKING | `sanitizeFilename` strips `/` and `\` and all non-`[A-Za-z0-9.\-_]`; the stored name is prefixed with `<timestamp>-<random hex>` so a crafted `originalname` cannot escape the dir or collide |
| **Path traversal** in the evidence-id URL segment | ✅ WORKING | `../../etc/passwd` as `:evidenceId` → 400/404 (it is looked up as a DB id scoped by tenant + event, never used as a path) |
| Duplicate / edge-case filenames | ✅ WORKING | same `originalname` twice → two distinct `storedFileName`s (random prefix); multi-photo test confirms both persist and are independently downloadable |

---

## 6. Frontend / Browser Tests

**No browser E2E framework is present in the repository** (no Playwright,
Cypress, WebdriverIO, or test runner config under the frontend). One was **not
added** this pass: standing up a browser suite needs a stable backend, and this
environment's shared Neon **dev** database intermittently stalls interactive
transactions (login/registration take 15–45 s and occasionally time out),
which would make a fresh UI login flow an unreliable signal. Adding a flaky
suite was judged worse than not adding one.

What **was** verified for the frontend:

| Check | Status | Detail |
|---|---|---|
| Guard photo-evidence control exists & is wired in | ✅ WORKING | `CheckpointPhotoCapture` rendered per scanned, non-skipped checklist row in `app/guard/shifts/[id]/patrols/page.tsx`; hidden until a checkpoint is scanned |
| Camera-first capture configured | ✅ WORKING (config verified) | `<input type="file" accept="image/*" capture="environment">` — rear-camera capture on mobile, gallery/file fallback everywhere. `capture` attribute present and correct. |
| Upload path uses the authenticated client + correct field name | ✅ WORKING | `uploadCheckpointEvidence` → `FormData` field **`file`**, `multipart/form-data`, through the JWT axios instance — matches the backend `FileInterceptor('file')` |
| Selected image preview / thumbnails | ✅ WORKING (code verified) | thumbnails fetched as authenticated blobs → `URL.createObjectURL`, revoked on unmount; lightbox on click |
| Success / error feedback | ✅ WORKING (code verified) | `toast.success('Photo attached to checkpoint.')` / `toast.error(getApiErrorMessage(...))` |
| Evidence appears after upload & survives refresh | ✅ WORKING (code verified) | new item prepended to state on success; `ensureLoaded()` re-fetches attached evidence on mount via `getCheckpointEvidence('guard', …)` |
| Admin/dispatcher can view uploaded evidence | ✅ WORKING (code verified + API verified) | `CheckpointEvidenceViewer` on the patrol-run timeline; fed by `events[].evidence[]` metadata, bytes streamed via the admin `.../file` endpoint (backend contract verified in §3) |
| Mobile viewport layout | ⏸️ NOT TESTABLE | no browser automation / device; component uses responsive Tailwind utilities but rendering was not visually verified |
| Live in-browser upload / preview / error banner | ⏸️ NOT TESTABLE | no browser automation framework present (not added — see above). The complete backend contract these UI actions depend on **is** verified end-to-end. |

**Static frontend checks that passed:** `tsc --noEmit` (0 errors),
`eslint` on the two evidence components + `lib/patrols.ts` (0 errors),
`next build` (success, 55 routes).

---

## 7. Security Tests

Authorization is **identity-based**: every tenant / guard / run / event
decision is made server-side from the authenticated JWT
(`user.tenantId`, `user.guardId`), never from a client-supplied id or body
field. Verified:

| Attack | Result | Status |
|---|---|---|
| Guard A2 reads / downloads Guard A1's evidence (same tenant) | 404 on list, download, and upload-to-A1's-event | ✅ WORKING |
| Tenant B guard downloads Tenant A's evidence file | 404 | ✅ WORKING |
| Tenant B **admin** lists / downloads Tenant A's evidence | 404 | ✅ WORKING |
| Unauthenticated upload / list / download | 401 | ✅ WORKING |
| Admin JWT used on the guard endpoint / guard JWT on the admin endpoint | 401/403 (role gate) | ✅ WORKING |
| Malformed / garbage bearer token | 401 | ✅ WORKING |
| Manipulated IDs — non-existent run, non-existent event, event-from-another-run, non-existent evidence id, evidence-id-not-on-this-event | 404 in every case | ✅ WORKING |
| Forged `guardId` / `tenantId` in the multipart body | ignored — still 404 (identity comes from the JWT) | ✅ WORKING |
| Direct access to the stored file without the API | no static route exists; `Cache-Control: private, no-store` on the streamed response | ✅ WORKING |
| Path traversal via `originalname` | sanitized (`/`, `\`, non-`[A-Za-z0-9.\-_]` stripped) + random prefix | ✅ WORKING |
| Path traversal via the `:evidenceId` URL segment | treated as a tenant+event-scoped DB id, not a path → 400/404 | ✅ WORKING |
| Renamed executable (`shell.png` + `octet-stream`) / disguised document | rejected at `fileFilter` and re-checked in the service; temp file unlinked | ✅ WORKING |

No cross-tenant leak, no IDOR, no path traversal, no auth bypass found.

---

## 8. Regression Tests

Run after adding the photo-evidence e2e spec and the two prior fixes from the
broader QA pass (guard-login migration; sync-DTO validation):

| Suite | Result |
|---|---|
| Backend unit + integration — `jest` | **50 suites / 367 tests — PASS** |
| Patrol module unit specs — `jest src/patrols` | **6 suites / 56 tests — PASS** |
| Backend E2E specs — `jest --config test/jest-e2e.json` | **3 suites / 47 tests — PASS** (`app` 1, `guard-auth` 3, `patrol-photo-evidence` 43) |
| Backend TypeScript (build config) — `tsc -p tsconfig.build.json` | **0 errors — PASS** |
| Frontend TypeScript — `tsc --noEmit` | **0 errors — PASS** |
| Frontend ESLint (evidence components + `lib/patrols.ts`) | **0 errors — PASS** |
| Frontend build — `next build` | **PASS** (55 routes) |

Specifically confirmed **not broken** by the photo-evidence work:

- **Patrol runs** — start / scan / geofence verify / complete / missed-checkpoint auto-marking (covered by `patrols.service.spec.ts` + exercised live in the e2e fixture setup).
- **Checkpoint scanning** — `POST guard/patrol-runs/:id/checkpoints/:cpId/scan` still creates/updates `PatrolEvent` correctly (used to create the event every evidence test attaches to).
- **Guard authentication** — `guard-auth.e2e-spec.ts` (3 tests) still green; guard login used for every evidence test.
- **Admin access** — `patrol-runs/:id` detail, admin evidence list/download still enforce tenant + branch scoping.
- **Existing evidence / report functionality** — incident evidence unit specs (`incidents-evidence.service.spec.ts`, `incident-evidence.util.spec.ts`) unchanged and passing; the shared `file-storage.util.ts` was **not modified** in this pass.

**No unrelated Guard Tour or CRM functionality was changed.** No production
data was touched — the shared DB is back to its exact pre-test state (2
tenants, 29 leads, 1 guard), verified before and after.

---

## 9. Bugs Found

**None in the photo-evidence feature.**

The dedicated 43-check e2e suite passed on the first full run. Every
validation, authorization, tenant-isolation, guard-ownership, id-manipulation,
path-traversal, lifecycle and cascade case behaves correctly.

(For completeness: the two bugs fixed earlier in the broader QA pass —
`guard-login` HTTP 500 from a missing migration, and `POST /guard/sync` HTTP
500 from a missing nested-DTO validation — are **prerequisites** for this
feature working at all (guard login) / adjacent to it (offline sync), but are
not defects in the photo-evidence code itself. They are documented in
`docs/COMPLETE_QA_TEST_REPORT.md`.)

---

## 10. Bugs Fixed

**None required for the photo-evidence feature.** 🔧 count for this feature: **0**.

The guard-login migration (`20260906000000_add_guard_refresh_token`) had to be
applied for guard authentication — and therefore any guard photo upload — to
function; that fix is from the earlier pass and is already committed.

---

## 11. External APIs / Keys / Services

Determined from `backend/.env`, `package.json`, and the implementation:

| Dependency | Status for photo evidence |
|---|---|
| PostgreSQL (`DATABASE_URL`) | **REQUIRED** — the `PatrolEvidence` row lives here |
| JWT secrets (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) | **REQUIRED** — guard & admin auth |
| Local disk (`uploads/patrol-evidence/`, auto-created) | **REQUIRED** — the image bytes are written here |
| `PATROL_EVIDENCE_IMAGE_MAX_MB` | **OPTIONAL** — size cap; defaults to 15 MB if unset |
| **Cloudinary** | **NOT REQUIRED** — not used anywhere |
| **AWS S3 / `aws-sdk` / `multer-s3`** | **NOT REQUIRED** — not a dependency |
| **Firebase / GCS / Azure Blob** | **NOT REQUIRED** — not a dependency |
| Any external image/CDN/transform service | **NOT REQUIRED** — `multer.diskStorage`, no image processing (`sharp`/`jimp` not installed) |
| Camera API key / SDK | **NOT REQUIRED** — capture is the native browser `<input type="file" capture="environment">`, no `getUserMedia`, no third-party camera lib |

**EXTERNAL KEYS REQUIRED: NO.** The feature runs fully on Postgres + local disk
+ JWT. (Operational note, not a dependency: local disk is not persistent on a
PaaS without a mounted volume — documented in `file-storage.util.ts`; moving to
object storage is a deployment decision, not a code requirement.)

---

## 12. Physical Device Tests

Clearly separated from the automated results above.

| Test | Status |
|---|---|
| Native browser **camera capture** on a real phone (rear camera via `capture="environment"`) | ⏸️ **NOT TESTABLE — requires physical camera/device.** The `<input capture="environment">` configuration is present and correct; the resulting file goes through the same upload path that is fully covered automatically. |
| Real mobile-device **viewport / layout** | ⏸️ **NOT TESTABLE — requires physical device or browser automation** (neither available; no Playwright/Cypress in repo). |
| Photo taken by a real camera actually uploads & appears | ⏸️ **NOT TESTABLE — requires physical camera/device.** |

The implementation uses **native browser file input with `capture`** — **not**
`MediaDevices` / `getUserMedia`, and **not** any custom camera mechanism. So
the only thing a physical device would add is confirming the OS camera picker
opens and hands back a JPEG; the upload, validation, storage, retrieval and
authorization of that JPEG are all verified automatically.

**The physical camera was NOT tested. This is not claimed.**

---

## 13. Final Feature Status

```
PHOTO EVIDENCE:
✅ WORKING

AUTOMATED TESTS (photo-evidence feature):
  Passed:   43  (dedicated e2e: backend/test/patrol-photo-evidence.e2e-spec.ts)
          + 22  pre-existing patrol-evidence unit/controller tests still green
  Failed:    0
  Skipped / not testable:  3  (physical camera capture, real-device upload, mobile viewport — all require hardware/browser automation)

FULL REGRESSION (to prove nothing else broke):
  Backend unit + integration:      367 passed / 0 failed  (50 suites)
  Backend E2E specs:               47 passed / 0 failed  (3 suites: app + guard-auth + patrol-photo-evidence)
  Frontend tsc / eslint / build:   0 errors / 0 errors / build OK

BUGS FOUND:   0   (in the photo-evidence feature)
BUGS FIXED:   0   (feature needed no fix; the guard-login migration prerequisite was already fixed in the prior QA pass)

EXTERNAL KEYS REQUIRED:   NO
  (Postgres + local disk + JWT only. No Cloudinary / S3 / Firebase / GCS / camera SDK.)

PHYSICAL CAMERA TEST REQUIRED:   YES
  (only to confirm the OS camera picker on a real phone; the file it produces is
   fully covered by automated tests. Not performed — not claimed.)

FINAL RECOMMENDATION:   Ready for review
  The checkpoint photo-evidence workflow is functionally complete and secure:
  upload, association, persistence, metadata, retrieval, multi-photo,
  post-completion read access, tenant isolation, guard-ownership, role gating,
  id-manipulation and path-traversal resistance, file-type/size validation and
  cascade cleanup are all verified end-to-end against a real DB, real HTTP and
  real file storage (43/43). Before production: (a) a manual pass on a real
  phone for the camera picker + mobile layout, and (b) a deployment decision on
  persistent/object storage for `uploads/` (local disk does not survive a PaaS
  redeploy — a pre-existing, documented platform limitation shared by every
  upload feature, not a defect in this one).
```
