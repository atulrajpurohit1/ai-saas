# Standalone Services — Task Report

**Feature:** let a customer buy and use Lead Gen on its own, without Guard Tour or Finance
**Branch:** `feat/aegislead-branding` · **Commit:** `f594e7f`
**Period:** 2026-09-23 → 2026-09-24
**Status:** 4 of 5 phases complete. Remaining phase is blocked on client decisions.

---

## 1. Why this work happened

Anthony asked: *"if someone wanted to simply purchase the lead gen solution, can they do that without guard tour and finance options? If so, how?"*

The answer at the time was no. Investigation confirmed why:

| Finding | Evidence |
|---|---|
| No payment integration anywhere | `grep -r "stripe\|paddle\|razorpay\|checkout"` over `backend/src` + `frontend/src` → 0 hits |
| Plans lived in environment variables | `planKeyForTenant()` read `process.env.BILLING_PLAN_<SLUG>` — changing a customer's access meant editing Render config and redeploying |
| No subscription or entitlement data | `Tenant` model had id, name, slug, timestamps and ~60 relations. No plan, no modules, no trial |
| Plans were limit-based, not service-based | free/starter/growth differed by *how many* leads and users, never by *which* services |
| Billing was read-only | `billing.controller.ts` was a single `GET` |

**One thing was already in our favour:** every permission in `rbac.constants.ts` already carried a `module` field — 28 distinct modules. The service map was read out of the codebase rather than invented.

---

## 2. What was delivered

### Phase 0 — Permission catalog fix

Two sets of permissions guarded live routes but were missing from the catalog. Because `ALL_PERMISSION_KEYS` derives from that catalog, and Super Admin's `'*'` expands to it, **an uncatalogued key was in nobody's grant set — not even a Super Admin's.**

| Key | Routes it blocked | Now granted to |
|---|---|---|
| `patrols.view` / `patrols.manage` | 13 routes + 2 nav links | Branch Admin, Scheduler, Supervisor (view only) |
| `ai.manage` | 2 routes (AI feedback) | Branch Admin |

QA had logged the `patrols` gap as a missing key. It was a total feature lockout — Patrols, a headline Guard Tour feature, was dead in the admin UI for every user.

`ai.manage` was found by the regression test written alongside the fix, not by hand.

### Phase 1 — Entitlement model and enforcement

**Design decision:** entitlement and permission are separate layers. Effective access = **entitlement AND permission**.

A Super Admin at a Lead-Gen-only tenant still legitimately *holds* `guards.view` as a role — and is still refused Guard Tour, because buying is a tenant fact no role overrides. Collapsing the two would have made adding a service later a role migration across every user instead of one row.

- `TenantSubscription` + `TenantModule` models; `ServiceModule` and `SubscriptionStatus` enums
- Migration backfilling **all 38 existing tenants with all three services** — without it, shipping the guard would have locked out every current customer on deploy
- `EntitlementsService` (30s per-tenant cache) and `ModuleGuard`
- **30 `@RequireModule` decorators across 29 controllers**, covering both auth patterns: admin controllers and the client/guard portal controllers
- Session payload strips permission keys for unbought services and carries an entitlements summary

Two deliberate behaviours:

- **`PAST_DUE` keeps access.** Only `CANCELED` revokes. Dunning is a billing conversation, not a reason to strand a customer mid-shift.
- **A tenant with no subscription row fails open.** A tenant predating this system must not be locked out of a product it already pays for.

**Denial is an upsell:** 403 carries `upgradeRequired: true` and the missing module, so the UI routes to an upgrade page instead of showing a permission error.

### Phase 3 — Standalone UX

**A bug found on the way in:** `can()` and `canAny()` returned `true` for `isSuperAdmin` *before* checking permissions. That would have defeated the entire backend layer in the UI — a Super Admin at a Lead-Gen-only tenant would still see full Guard Tour nav, click it, and eat a 403 on every page. Both now check entitlement first.

- `lib/entitlements.ts` — frontend view of entitlement, so a locked page can be *labelled*, not just hidden
- `/settings/plan` — three service cards, active vs not included, deep-linkable via `?module=GUARD_TOUR`
- `ModuleLockedState` + `requiredModule` on `DashboardLayout`, applied to **38 pages** across three different `<DashboardLayout>` usage patterns
- 403 interceptor routing to the plan page without triggering a token refresh or logout
- **Login redirect fixed** — previously could send a Lead-Gen-only user to `/shifts`, a 403 immediately after signing in

**No Lead-Gen dashboard was needed.** Checked before building: `DashboardSummary` is already leads/deals/proposals only. The plan had budgeted for work that turned out to be unnecessary.

### Manual verification pass

Ran the real backend and frontend against the live database with a throwaway Lead-Gen-only tenant. **23/23 checks passed**, including a Super Admin receiving a clean 403 with `upgradeRequired` on Guard Tour — confirming against a live server what the unit tests assert.

**Found a real UX bug:** `/clients/insurance` is gated on `clients.view` (core) but sat in the **Finance** nav group, leaving a standalone Lead Gen tenant with a "Finance" heading containing one orphaned link — advertising a service they hadn't bought. Moved to Workspace.

Every individual check was passing. It only surfaced by rendering the nav a real customer would see.

### Phase 4 — Hardening and e2e

**A second leak, found before writing any test:** `/guards` is served by *two* controllers in one file. The Phase 1 annotation script patched only the first class per file, so `GuardsAliasController` had `ModuleGuard` in its chain but no `@RequireModule` — and a guard with no module declared passes everything through. `/guards` was serving guard data to tenants without Guard Tour.

Fixed, and the coverage test rewritten to check **per class** rather than per file.

`test/entitlements.e2e-spec.ts` — **44 tests**, real database, real HTTP, ~6.5 minutes. One tenant per purchasable combination, all seven:

| Combination | Combination |
|---|---|
| Lead Gen | Lead Gen + Finance |
| Guard Tour | Guard Tour + Finance |
| Finance | All three |
| Lead Gen + Guard Tour | |

Each asserts: bought services return 200, unbought return 403, core routes work regardless, and the session payload advertises exactly the right modules.

Plus: denial shape, **Super Admin refused** (every fixture admin is `isSuperAdmin: true` on purpose — otherwise every "is refused" assertion would pass vacuously), status transitions, single-module toggle, and a legacy tenant with no subscription row.

---

## 3. Verification

| Check | Result |
|---|---|
| Backend unit tests | **437 passed, 57 suites, 0 failed** |
| Entitlements e2e | **44 passed**, real DB + HTTP, all 7 combinations |
| API manual probe | **23/23** against the running server |
| Backend typecheck | Clean (5 pre-existing errors only, confirmed via `git stash`) |
| Frontend typecheck | Clean |
| Frontend production build | Succeeds |
| Database after e2e | Returned to exact baseline — 38 tenants / 38 subscriptions / 114 modules, no fixtures left behind |

**26 new tests written** (5 catalog, 12 entitlements service, 7 guard, 1 parity, plus coverage checks), and **44 e2e**.

---

## 4. Scale of change

Commit `f594e7f` — 188 files, 3,199 insertions, 197 deletions.

Excluding compiled `dist/` output: **95 source files**.

**17 new files:**

| Backend | Frontend / docs |
|---|---|
| `entitlements.service.ts` | `lib/entitlements.ts` |
| `entitlements.constants.ts` | `app/settings/plan/page.tsx` |
| `entitlements.module.ts` | `components/ModuleLockedState.tsx` |
| `auth/guards/module.guard.ts` | `STANDALONE_MODULES_IMPLEMENTATION_PLAN.md` |
| `auth/decorators/module.decorator.ts` | `STANDALONE_MODULES_BUILD_LOG.md` |
| migration `20260923120000_add_tenant_entitlements` | |
| 5 spec files + 1 e2e spec | |

---

## 5. Bugs found and fixed along the way

Three of these were pre-existing and unrelated to the original request. Two were found by automated checks rather than review.

| # | Bug | Impact | Found by |
|---|---|---|---|
| 1 | `patrols.*` missing from permission catalog | 13 routes unreachable by **every** user including Super Admin | Prior QA (severity understated) |
| 2 | `ai.manage` missing from catalog | AI feedback controller entirely unreachable | New regression test |
| 3 | `GuardsAliasController` had `ModuleGuard` without `@RequireModule` | `/guards` served guard data to tenants without Guard Tour | Route mapping for e2e |
| 4 | `can()`/`canAny()` checked `isSuperAdmin` before permissions | Would have defeated the whole backend layer in the UI | Code review during Phase 3 |
| 5 | Login redirect ignored entitlement | Lead-Gen-only user sent to `/shifts` → 403 right after login | Code review during Phase 3 |
| 6 | Client Insurance in Finance nav group | Orphaned "Finance" heading for standalone tenants | Manual verification pass |

---

## 6. What is NOT done

- **No payment integration.** Services are provisioned by database row. Selling today means manual provisioning — which is exactly the 2-week fast path. The `/settings/plan` "Add" button is a mailto until checkout lands.
- **No browser click-through.** Verified at API, session-payload, type and build level. Nobody has visually inspected the rendered pages. Worth five minutes before a demo.

---

## 7. Blocked on the client

Phase 2 (checkout) cannot start without these. Everything else is done.

1. **Checkout ownership** — does the website own the purchase step and hand off to the app, or does the app own it? *Cross-team, longest lead time, ask first.*
2. **Pricing** — per-service standalone price, bundle discount, monthly/annual, trial?
3. **Payment provider** — Stripe recommended; confirm and who owns the account.

**Two decisions already made and live in code** — cheap to change now, expensive after a customer signs up:

- Existing tenants are grandfathered into all three services
- `clients` and `sites` are shared across all three services, not sold separately

---

## 8. Bottom line

Anthony's question — *can someone purchase Lead Gen on its own?* — now has a different answer:

**Yes. We can onboard a standalone Lead Gen customer today with manual provisioning. Self-serve checkout is ~2 weeks once pricing and the checkout-ownership question are settled.**

The manual path is not throwaway work: automated checkout is built on the same foundation.
