# Standalone Services — Build Log

Running record of what was actually built, why, and what is verified.
Companion to `STANDALONE_MODULES_IMPLEMENTATION_PLAN.md` (the plan).
Branch: `feat/aegislead-branding`

**Goal:** let a customer buy and use Lead Gen standalone, without Guard Tour or Finance.

| Phase | Status | Date |
|---|---|---|
| 0 — Permission catalog fix | **Done** | 2026-09-23 |
| 1 — Entitlement model + enforcement | **Done** | 2026-09-23 |
| 2 — Checkout + provisioning (Stripe) | **Code done**, awaiting keys + pricing | 2026-09-24 |
| 3 — Standalone UX | **Done** | 2026-09-23 |
| 4 — Hardening / e2e | **Done** | 2026-09-24 |

---

## Phase 0 — Permission catalog fix ✅

### The bug, and why it was worse than logged

QA had logged "`patrols.*` RBAC keys missing from catalog." Tracing it properly:

- `ALL_PERMISSION_KEYS` is derived from `PERMISSIONS` (`rbac.constants.ts:534`).
- Super Admin's `'*'` expands to `ALL_PERMISSION_KEYS` (`rbac.constants.ts:710`).
- `hasPermissions()` checks membership in that set (`roles.service.ts:650`).

So an **uncatalogued key is in nobody's grant set — not even a Super Admin's**.
Every route guarded by one was unreachable by every user, silently, with no
startup error. That is a total feature lockout, not a missing-key nit.

### Fixed

| Key | Routes unblocked | Granted to |
|---|---|---|
| `patrols.view` | 13 in `patrols.controller.ts` + 2 nav links | Branch Admin, Scheduler, Supervisor |
| `patrols.manage` | (same controller) | Branch Admin, Scheduler |
| `ai.manage` | 2 in `ai-feedback.controller.ts` | Branch Admin |

`ai.manage` was **found by the new regression test**, not by hand — same bug
class, second instance, previously unknown.

Supervisor gets `patrols.view` only: they monitor patrols, they do not
configure routes.

### Regression guard

`src/roles/rbac-catalog.spec.ts` — walks every non-spec source file, extracts
permission strings from `@RequirePermission` / `@RequireAnyPermission`, and
asserts each exists in the catalog. Also checks for orphaned keys, duplicates,
and missing `module` fields.

This matters more now than before: once entitlement keys off the catalog, an
uncatalogued permission is a service you cannot reliably gate.

### Files
- `backend/src/roles/rbac.constants.ts` (+26)
- `backend/src/roles/rbac-catalog.spec.ts` (new, 5 tests)

---

## Phase 1 — Entitlement model + enforcement ✅

### Core decision: entitlement is not permission

Two separate layers. Effective access = **entitlement AND permission**.

A Super Admin at a Lead-Gen-only tenant legitimately *holds* `guards.view` as a
role — they are an admin. Entitlement denies it anyway, because the tenant did
not buy Guard Tour.

Collapsing the two would mean adding a service later becomes a role migration
across every user at that tenant, instead of flipping one row. It would also
mean rewriting RBAC, which already works.

**`isSuperAdmin` bypasses `PermissionGuard` but deliberately does NOT bypass
`ModuleGuard`** — buying is a tenant fact, not a role capability. Covered by a
test.

### Database

New enums `ServiceModule` (LEAD_GEN / GUARD_TOUR / FINANCE) and
`SubscriptionStatus` (TRIALING / ACTIVE / PAST_DUE / CANCELED).

`TenantSubscription` — one per tenant, carries status, trial end, period end,
and `provider_customer_id` / `provider_subscription_id` ready for Stripe.
`TenantModule` — one row per purchased service, unique on `(tenant_id, module)`.

**Migration `20260923120000_add_tenant_entitlements` backfills every existing
tenant with all three modules.** Without this, shipping `ModuleGuard` would
instantly lock out every current customer.

Verified against the live Neon DB after applying:
`38 tenants | 38 subscriptions | 114 modules (= 38 × 3)` — exact.

### Module map

Built on the `module` field every permission already carried, so the mapping
was read out of the codebase rather than invented.

- **LEAD_GEN** — leads, deals, proposals, prospect_search, rfp, vendors
- **GUARD_TOUR** — guards, patrols, shifts, incidents, timesheets, reports
- **FINANCE** — invoices, invoice_disputes, finance, rate_cards
- **CORE** (always on) — dashboard, identity, settings, billing, audit,
  integrations, branches, clients, sites, documents, notes, activities, ai

All 28 permission modules are classified; a test asserts none is unmapped and
none is both core and sellable.

**`clients` and `sites` are CORE** because all three services read them — a
Lead Gen customer needs clients, a Guard Tour customer needs sites. Flagged for
client confirmation in the plan; treating them as sellable would mean
duplicating records per service.

### Enforcement

- `EntitlementsService` — resolves a tenant's modules, 30s cache, `invalidate()`
  for after writes.
- `ModuleGuard` + `@RequireModule('LEAD_GEN')` — added to the guard chain
  alongside the existing guards.
- **29 controllers annotated**, covering both patterns in the codebase:
  admin controllers (`JwtAuthGuard, PermissionGuard`) and portal controllers
  (`JwtAuthGuard, RolesGuard`). Portal controllers matter — a Lead-Gen-only
  tenant's *client portal* must not serve patrol data either.

Two deliberate behaviours, both tested:

**`PAST_DUE` keeps access.** Dunning is a billing conversation, not a reason to
strand a paying customer mid-shift. Only `CANCELED` revokes.

**A tenant with no subscription row fails OPEN** (all modules granted, warning
logged). A tenant predating this system that somehow missed the backfill must
not be locked out of a product it already pays for.

### Denial is an upsell, not an error

`ModuleGuard` throws 403 with `upgradeRequired: true` plus the module list, so
the frontend can route to the upgrade page instead of showing a generic
permission error. Phase 3 consumes this.

### Session payload

`getUserAccessProfile()` (`roles.service.ts:205`) is the single choke point for
login, refresh and profile — all four callers. It now:

- filters permission keys down to entitled services, so the frontend renders no
  Guard Tour nav for a Lead-Gen-only tenant;
- returns an `entitlements` summary for the UI to consume.

Roles stay intact; only the advertised permission list narrows. `ModuleGuard`
is the real boundary — this is presentation.

`billing.service.ts` also returns the entitlement summary. Its env-var plan
lookup (`BILLING_PLAN_<SLUG>`) is left in place as a fallback and gets replaced
in Phase 2.

### Files

**New:** `entitlements.constants.ts`, `entitlements.service.ts`,
`entitlements.module.ts`, `auth/guards/module.guard.ts`,
`auth/decorators/module.decorator.ts`, migration, + 3 spec files

**Changed:** `schema.prisma`, `app.module.ts`, `roles.service.ts`,
`billing.service.ts`, 29 controllers, 2 existing specs (DI mocks)

---

## Phase 3 — Standalone UX ✅

### A bug found on the way in

`can()` and `canAny()` in `AuthContext` returned `true` for any
`isSuperAdmin` user **before** looking at the permission list. That would have
defeated the Phase 1 backend filtering in the UI: a Super Admin at a
Lead-Gen-only tenant would still see full Guard Tour and Finance nav, click it,
and get a 403 from `ModuleGuard` on every page.

Both now check entitlement *first*, and only then short-circuit on
`isSuperAdmin`. Role still grants every permission; it no longer grants a
service the tenant never bought.

### The dashboard needed no work

Checked before building: `DashboardSummary` is leads/deals/proposals only.
The main dashboard is already Lead-Gen shaped, so there were no Guard Tour
widgets to strip for a standalone tenant. The plan had budgeted for this.

### What was built

**`lib/entitlements.ts`** — the frontend's view of entitlement. Mirrors the
backend permission-module → service map so a locked page can be *labelled*
("Guard Tour is not part of your plan") rather than merely hidden.

Missing entitlement payload is treated as *all services granted*, not none — an
older session or a stale cached login must not blank a working customer's nav.

**`/settings/plan`** — the three services as cards, active vs not included,
with what each one does. Deep-linkable via `?module=GUARD_TOUR` to highlight
the one the user just hit. Currently the "Add" button opens a mailto, because
there is no checkout yet (Phase 2); that swaps for a Stripe redirect without
touching the page's structure.

**`ModuleLockedState`** + `DashboardLayout requiredModule="..."` — a stale
bookmark or shared link to `/shifts` on a Lead-Gen tenant now renders an
explanation, not a silent bounce to the dashboard. Applied to **38 pages**
across all three services, handling the three `<DashboardLayout>` usage
patterns in the codebase (bare, `requiredPermissions`, `allowedRoles`).

The module check deliberately takes precedence over the permission redirect:
explaining beats bouncing.

**403 interceptor** (`lib/api.ts`) — a `upgradeRequired` response routes to
`/settings/plan`, and explicitly does *not* trigger a token refresh or logout.
Without this a module denial would have looked like an auth failure.

**Login redirect** — `getRedirectPath` now checks entitlement as well as
permission. It previously could send a Lead-Gen-only user straight to
`/shifts`, i.e. a 403 immediately after a successful login.

### Keeping the two maps honest

The frontend keeps its own copy of the module map, so it can label a locked
page without a round trip. Two copies drift, and drift here is user-visible.

`entitlements-frontend-parity.spec.ts` (backend, where a runner exists) parses
the frontend file and asserts the maps match exactly. **Verified it actually
fails on drift** by flipping `rfp` to `FINANCE` — the test caught it — then
restoring.

No frontend test runner exists in this repo; adding one mid-feature was out of
scope, so the parity check lives where it can run today.

### Files

**New:** `frontend/src/lib/entitlements.ts`,
`frontend/src/app/settings/plan/page.tsx`,
`frontend/src/components/ModuleLockedState.tsx`,
`backend/src/entitlements/entitlements-frontend-parity.spec.ts`

**Changed:** `AuthContext.tsx`, `lib/api.ts`, `lib/nav-links.ts`,
`components/DashboardLayout.tsx`, 38 page files

---

## Verification

| Check | Result |
|---|---|
| Backend unit suite | **436 passed, 57 suites, 0 failed** |
| Backend typecheck | Clean — the only 5 errors are pre-existing, confirmed via `git stash` (2 in `scratch/`, 3 in unrelated specs) |
| Frontend typecheck | Clean |
| Frontend production build | Succeeds; `/settings/plan` present in the route manifest |
| Migration | Applied to Neon; backfill verified exact (38/38/114) |
| New tests | 25 (5 catalog, 12 entitlements, 7 guard, 1 parity) |

Neon cold-start `P1001` on first `migrate deploy` — retry succeeded, as usual.

---

## Manual verification pass ✅ (2026-09-23)

Ran the real backend and frontend against the live DB, with a throwaway
Lead-Gen-only tenant, rather than trusting unit tests alone.

### API probe — 23/23 checks passed

Created a tenant, logged in over real HTTP, then removed Guard Tour and
Finance and logged in again:

| Behaviour | Result |
|---|---|
| Session payload carries `entitlements` | pass |
| `patrols.view` present when entitled (Phase 0 fix, live) | pass |
| `patrols.*` / `invoices.*` **stripped** from payload once unentitled | pass |
| Core keys (`sites.view`, `dashboard.view`) retained | pass |
| `GET /leads` still 200 | pass |
| `GET /checkpoints` → **403** | pass |
| `GET /invoices` → **403** | pass |
| `GET /sites` still 200 (core) | pass |
| 403 carries `upgradeRequired: true` + `modules: ["GUARD_TOUR"]` | pass |
| 403 message reads *"Your plan does not include Guard Tour. Upgrade to enable it."* | pass |
| `CANCELED` subscription → `/leads` 403, core dashboard still 200 | pass |

The probe user was **`isSuperAdmin: true`**, so this confirms against a live
server what the unit test asserts: **role does not override entitlement.**

### Nav check

Fed the real session payload through the Sidebar's own filtering rules.
A Lead-Gen-only Super Admin sees **17 links, 12 hidden**, permission count down
from ~90 to 60, and no Guard Tour or Finance link anywhere.

### One real UX bug found and fixed

`/clients/insurance` ("Client Insurance") is gated on `clients.view`, which is
**core**, but it lived in the **Finance** nav group. A standalone Lead Gen
tenant therefore got a "Finance" heading containing exactly one orphaned link —
advertising a service they had not bought.

Moved to Workspace, where the other client-record pages live. The Finance group
is now purely Finance, so it disappears entirely for a Lead-Gen tenant (the
Sidebar already drops empty groups).

This is exactly the class of thing unit tests do not catch, and the reason for
doing the pass before writing e2e.

### Cleanup

Probe scripts and the demo tenant were removed after the run; `backend/scratch`
is clean in git.

---

## Phase 4 — Hardening / e2e ✅

### A second leak, found before writing a single test

While mapping which routes to probe, `/guards` turned out to be served by
**two** controllers in one file: `GuardsController` (`/v2/guards`) and
`GuardsAliasController` (`/guards`).

The Phase 1 annotation script patched the first class per file. The alias
controller had `ModuleGuard` in its `@UseGuards` chain but **no
`@RequireModule`** of its own — and a guard with no module declared waves every
request through. So `/guards` served guard data to tenants without Guard Tour.

Fixed, and the coverage test rewritten to count **per class** rather than per
file: it splits each file on `export class` so every controller is checked
against its own decorator block. Verified it catches the bug by reverting the
fix — it names `guards.controller.ts :: GuardsAliasController` exactly.

This is the second time an automated check has found a gap the plan missed
(`ai.manage` in Phase 0 was the first). Both were invisible to a per-file or
by-hand review.

### The e2e suite

`test/entitlements.e2e-spec.ts` — **44 tests, all passing**, real database,
real HTTP, ~6.5 minutes. One tenant per purchasable combination, all seven:

| Combination | | Combination | |
|---|---|---|---|
| LEAD_GEN | ✅ | LEAD_GEN + FINANCE | ✅ |
| GUARD_TOUR | ✅ | GUARD_TOUR + FINANCE | ✅ |
| FINANCE | ✅ | all three | ✅ |
| LEAD_GEN + GUARD_TOUR | ✅ | | |

Each combination asserts four things: every route of every service it bought
returns 200; every route of every service it did not buy returns 403; core
routes work regardless; and the session payload advertises exactly the right
modules with unentitled permission keys stripped.

Plus targeted cases:

- **Denial shape** — 403 carries `upgradeRequired`, the module list, and a
  message naming the service.
- **Super Admin refused** — every fixture admin is `isSuperAdmin: true` *on
  purpose*. `isSuperAdmin` short-circuits `PermissionGuard`, so if entitlement
  were merely a permission filter, every "is refused" assertion above would
  pass vacuously. They only pass because `ModuleGuard` treats buying as a
  tenant fact no role overrides.
- **Status transitions** — TRIALING and PAST_DUE keep access, CANCELED revokes
  purchased services but leaves core routes reachable, and reactivating
  restores access.
- **Single-module toggle** — turning off Guard Tour on a LEAD_GEN+GUARD_TOUR
  tenant revokes only that service; turning it back on restores access
  immediately. This is the Phase 1 design claim tested directly: adding a
  service is one row, not a role migration.
- **Legacy tenant with no subscription row** — fails open across all three
  services.

Cleanup verified: the DB returned to exactly its 38 tenants / 38 subscriptions
/ 114 modules baseline, with no `ent-e2e-` tenants left behind.

### Files

**New:** `backend/test/entitlements.e2e-spec.ts` (44 tests)
**Changed:** `guards.controller.ts` (the leak), `entitlements-coverage.spec.ts`
(per-class check)

---

## Phase 2 — Stripe checkout (code complete, unconfigured)

Built while waiting on Stripe keys and pricing. **Prices live in Stripe, not in
the code** — the config only records which price id sells which service, so
setting the numbers later is env vars, not a deploy.

**The app runs normally with no Stripe config at all.** `STRIPE_SECRET_KEY`
unset means checkout is simply off: `/settings/plan` shows "Contact us" instead
of a buy button, and the checkout endpoints answer 503 with a clear message.
Verified by booting with an empty config — all routes register, nothing throws.

### What was built

| Piece | Purpose |
|---|---|
| `billing.config.ts` | Price-id ↔ service mapping, all from env |
| `stripe.service.ts` | Checkout sessions, billing portal, signature verification. Lazily constructed so a missing key never breaks boot |
| `stripe-webhook.service.ts` | Translates Stripe events into entitlement changes |
| `stripe-webhook.controller.ts` | `POST /billing/webhook/stripe`, unauthenticated by necessity — the signature *is* the auth |
| `subscription-provisioning.service.ts` | Turns "paid for these services" into rows. Knows nothing about Stripe |
| `BillingController` additions | `checkout/availability`, `checkout/session`, `portal/session` |

`rawBody: true` added in `main.ts` — Stripe signs the exact bytes it sent, so
verification needs the unparsed body alongside the normal parsed one.

### Decisions worth recording

**Provisioning is provider-agnostic.** The webhook translates Stripe events
into a `ProvisionInput` and calls the same service an admin would. That matters
now: manual provisioning is how the first customers get onboarded, and it runs
through the same code payments will, rather than a shortcut that rots.

**Services are resolved from what was billed, not from metadata.** A webhook is
untrusted input and metadata is editable in the Stripe Dashboard; the price ids
actually charged are not.

**An unrecognised price id provisions nothing and logs an error.** Provisioning
an empty module list would silently strip a paying customer of everything, so
it refuses instead.

**`PAST_DUE` keeps access**, consistent with Phase 1. `invoice.payment_failed`
sets the status but revokes nothing.

**Idempotent by construction.** Every handler computes the full desired state
rather than applying a delta, so replayed or out-of-order events converge.
Stripe retries freely and that is fine.

**A tenant keeps one Stripe customer** across purchases, so adding a second
service produces one billing relationship, not two unrelated invoices.

**Unhandled event types return 200 without throwing.** A 500 makes Stripe retry
forever and eventually disable the endpoint.

### Not done (needs the client)

- No products or prices exist in Stripe yet — pricing is not agreed
- No keys configured
- Nothing tested against real Stripe traffic. The webhook logic is unit tested
  against realistic event payloads, but no live event has been through it

`docs/STRIPE_SETUP.md` has the full setup runbook: products, prices, webhook
endpoint, env vars, test cards and the go-live steps.

### Files

**New:** `billing.config.ts`, `stripe.service.ts`, `stripe-webhook.service.ts`,
`stripe-webhook.controller.ts`, `subscription-provisioning.service.ts`,
`dto/create-checkout-session.dto.ts`, 2 spec files (32 tests),
`docs/STRIPE_SETUP.md`

**Changed:** `main.ts` (rawBody), `billing.controller.ts`, `billing.module.ts`,
`frontend/src/lib/billing.ts`, `frontend/src/app/settings/plan/page.tsx`

---

## Current verification totals

| Check | Result |
|---|---|
| Backend unit suite | **437 passed, 57 suites** |
| Entitlements e2e | **44 passed**, real DB + HTTP |
| Backend typecheck | Clean (5 pre-existing errors only) |
| Frontend typecheck | Clean |
| Frontend production build | Succeeds |
| API manual probe | 23/23 against the running server |

---

## What is NOT done

- **No payment integration.** Modules are provisioned by DB row only. Selling
  today means an admin inserting rows — which is exactly the 2-week fast path.
  The `/settings/plan` "Add" button is a mailto until Stripe lands.
- **No browser click-through.** Everything is verified at the API, session-
  payload, type and build level, but nobody has visually inspected the rendered
  pages. Worth five minutes before a demo.
- **Not committed.** All of this is uncommitted on `feat/aegislead-branding`,
  while the migration is already applied to the production Neon DB. Safe in
  that order — the tables exist and nothing reads them yet — but the branch
  should be merged before the two drift.

## How to try it

There is no UI for provisioning yet, so flip a test tenant by hand:

```sql
-- Make a tenant Lead Gen only
DELETE FROM "TenantModule"
WHERE tenant_id = '<id>' AND module IN ('GUARD_TOUR', 'FINANCE');
```

Log out and back in (entitlements ride the session payload; the service also
caches for 30s). Expect: no Operations or Finance nav, `/shifts` renders the
locked state, and API calls to those routes 403 with `upgradeRequired`.

Restore with an `INSERT` of the two rows, or re-run the backfill query from the
migration.

## Open questions for the client

Phases 0, 1 and 3 need none of these. Only Phase 2 is blocked.

1. **Pricing** — standalone price per service, bundle discount, monthly/annual, trial?
2. **Payment provider** — Stripe assumed; confirm + who owns the account.
3. **Mid-cycle add-on** — immediate with proration, or at renewal?
4. **Checkout ownership** — website or app? *Cross-team, critical path, chase first.*
5. **Existing tenants** — grandfathered into all three. Implemented as yes; confirm.
6. **Shared data** — `clients`/`sites` treated as CORE. Confirm.
