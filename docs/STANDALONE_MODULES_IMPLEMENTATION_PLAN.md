# Standalone Service Purchase — Implementation Plan

**Goal:** let a customer buy and use Lead Gen on its own, without Guard Tour or Finance.
**Priority:** Lead Gen standalone ships first (client: "already delayed").
**Date:** 2026-09-23

---

## 1. Findings — verified against the codebase

### What already exists (the head start)

| Asset | Location | Why it matters |
|---|---|---|
| Per-permission `module` field | `backend/src/roles/rbac.constants.ts:1-6` | Every permission already declares its module. 28 distinct modules. This is the mapping table the entitlement layer needs — it does not have to be invented. |
| Route-level RBAC | `backend/src/auth/guards/permission.guard.ts` | `JwtAuthGuard` + `PermissionGuard` already run on every controller. Enforcement plumbing exists. |
| Permission-filtered nav | `frontend/src/lib/nav-links.ts`, `frontend/src/components/Sidebar.tsx:45-47` | Nav groups are already split Leads/Sales, Operations, Finance and filtered by permission. |
| Per-tenant role sync | `backend/src/roles/roles.service.ts:87` (`ensureTenantSystemRoles`) | Single choke point where a tenant's roles/permissions are materialised. Entitlement-aware seeding hooks in here. |
| Signup + OTP | `backend/src/auth/auth.service.ts:43` | Tenant+User creation in a transaction, email verification working. |
| Plan concept | `backend/src/billing/billing.service.ts` | free/starter/growth/enterprise with limits + `featuresForPlan()`. |

### What is missing (the actual scope)

1. **No payment integration.** Grep for `stripe|paddle|razorpay|checkout` across `backend/src` + `frontend/src` returns zero hits.
2. **Plans live in env vars, not the database.** `planKeyForTenant()` reads `process.env.BILLING_PLAN_<SLUG>`. Changing a customer's plan = edit Render env + redeploy. Cannot support self-serve.
3. **No subscription/entitlement model.** `Tenant` (`schema.prisma:40`) has id/name/slug/timestamps + ~60 relations. No plan, no modules, no subscription, no trial.
4. **Plans are limit-based, not module-based.** Plans differ by *how many* leads/users/branches, never by *which* modules. `featuresForPlan()` returns `salesAccelerator: true` unconditionally.
5. **Billing is read-only.** `billing.controller.ts` = one `GET`. No select/change/pay.
6. **Signup captures no product selection.** `RegisterDto` = email, password, name, tenantName.
7. **`patrols.*` permissions are not in the catalog.** `grep -c "patrols\." rbac.constants.ts` = **0**, yet `patrols.controller.ts` guards on `patrols.manage` / `patrols.view`. Previously logged in QA; now load-bearing.

### Architectural decision

**Separate ENTITLEMENT (what the tenant bought) from PERMISSION (what this user may do).**

Effective access = `entitlement AND permission`.

Rationale: RBAC already works and is battle-tested. Wrapping it is far cheaper and safer than rewriting it, and it keeps two genuinely different concepts from being conflated — a Super Admin at a Lead-Gen-only tenant should legitimately hold `guards.view` as a *role*, but be denied by *entitlement*. Collapsing them would make later module upgrades a role-migration problem instead of a single row flip.

### Module map (three sellable services)

Derived from the existing `module` field on each permission:

- **LEAD_GEN** — leads, deals, proposals, prospect_search, activities, notes, clients, documents, ai, rfp, vendors
- **GUARD_TOUR** — guards, shifts, sites, incidents, reports, timesheets, patrols*, branches
- **FINANCE** — invoices, invoice_disputes, finance, rate_cards
- **CORE (always on)** — dashboard, identity, settings, billing, audit, integrations

(*patrols must first be added to the catalog — see Phase 0.)

Open question for the client: `clients` and `sites` are shared by all three. Proposal: treat as CORE, visible to any tenant.

---

## 2. Phases

### Phase 0 — Fix the permission catalog (blocking)
Add the missing `patrols.*` entries to `rbac.constants.ts` and to the relevant system roles. This is a prerequisite: an entitlement system built on an incomplete catalog has a hole in it.

**Est: 0.5 day**

### Phase 1 — Entitlement model + enforcement
- Prisma: `TenantSubscription` (status, trialEndsAt, currentPeriodEnd, provider ids) + `TenantModule` (tenantId, module, status) + `ServiceModule` enum.
- Migration + backfill: **every existing tenant gets all three modules** (no regressions).
- `EntitlementService` with a per-request cache.
- `ModuleGuard` + `@RequireModule('LEAD_GEN')` decorator, registered alongside `PermissionGuard`.
- Annotate all controllers in the three module groups.
- Rewrite `planKeyForTenant()` to read the DB, keeping the env var as fallback during transition.
- Make `ensureTenantSystemRoles` entitlement-aware: seed only purchased modules' permissions.
- Expose entitlements on `/auth/me` for the frontend.

**Est: 5-6 days**

### Phase 2 — Checkout + provisioning (Stripe)
- 3 products x monthly/annual + bundle pricing.
- `POST /billing/checkout-session`, `POST /billing/portal-session`.
- Webhook endpoint (raw body, signature verification, **idempotent**) for `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.payment_failed`.
- Provisioning: on payment -> write `TenantSubscription` + `TenantModule` rows -> re-run role seeding.
- `RegisterDto` carries selected modules; signup -> checkout handoff.

**Est: 5-6 days**

### Phase 3 — Standalone UX
- Module filter in `Sidebar.tsx` **before** the permission filter.
- Lead-Gen-only dashboard (not the full dashboard with 2/3 empty).
- Pricing / plan-selection page, upgrade/add-module page, billing settings.
- Locked-state teasers for unpurchased modules (conversion surface).
- Route-level guard so a direct URL to `/invoices` on a Lead-Gen tenant redirects to upgrade.

**Est: 5-7 days**

### Phase 4 — Hardening
- Seed scripts per module combination.
- e2e across all 7 purchasable combinations.
- Webhook replay / failure / out-of-order tests.
- Negative tests: entitlement denial returns 403 with an upgrade hint, never a 500.

**Est: 3-4 days**

---

## 3. Timeline

| Path | Scope | Duration |
|---|---|---|
| **Fast path (recommended)** | Phase 0 + 1 + 3-lite, access provisioned manually, invoicing outside the app | **~2 weeks — sellable** |
| **Full self-serve** | + Phase 2 + rest of 3 | **4 weeks** |
| **Hardened** | + Phase 4 | **5 weeks** |

The fast path is not throwaway work: the entitlement model is identical either way, so Phase 2 lands on top without rework.

Assumes Lead Gen is the sole focus. Parallel Guard Tour work extends these dates.

---

## 4. Decisions needed before Phase 2

1. **Pricing** — standalone price per service, bundle discount, monthly vs annual, trial?
2. **Payment provider** — Stripe assumed. Confirm + account ownership.
3. **Mid-cycle add-on** — can a Lead Gen customer add Guard Tour immediately (proration) or only at renewal?
4. **Checkout ownership** — website or app? *Critical path, cross-team, chase first.*
5. **Existing tenants** — grandfather into all three modules? (Plan assumes yes.)
6. **Shared modules** — are `clients`/`sites` CORE, or per-service?

Phases 0, 1 and 3 need none of these and can start immediately.
