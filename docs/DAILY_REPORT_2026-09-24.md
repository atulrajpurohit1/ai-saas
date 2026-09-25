# Daily Work Report — 24 September 2026

**Developer:** Atul
**Feature:** Standalone service purchasing (sell Lead Gen without Guard Tour or Finance)
**Branch:** `feat/aegislead-branding`
**Commits:** `f594e7f`, `510413f`

---

## Summary

Two commits. The first completed the service-separation work and shipped it;
the second built the payment integration around it.

At the start of the day the answer to Anthony's question — *"can someone
purchase Lead Gen on its own?"* — was no. It is now: **yes, we can onboard a
standalone Lead Gen customer manually today, and self-serve checkout is ready
to switch on as soon as pricing and Stripe keys arrive.**

---

## Commit 1 — `f594e7f` · Per-service entitlements

95 source files (plus compiled output). Completed and committed the work
started the previous day.

### Finished and verified

- **End-to-end e2e suite** — 44 tests against the real database over real
  HTTP, one tenant per purchasable combination (all seven: three standalone,
  three pairs, one bundle). Runtime ~6.5 minutes.
- **Manual verification pass** — 23/23 checks against the running server with
  a throwaway Lead-Gen-only tenant.
- **Database cleanup verified** — returned to its exact baseline (38 tenants,
  38 subscriptions, 114 module rows) with no fixtures left behind.

### Bugs found and fixed today

| Bug | Impact | Found by |
|---|---|---|
| `GuardsAliasController` wired `ModuleGuard` but declared no module | `/guards` served guard data to tenants without Guard Tour | Mapping routes for the e2e suite |
| Client Insurance sat in the Finance nav group but is gated on a core permission | Standalone Lead Gen tenants saw a "Finance" heading with one orphaned link | Manual verification pass |

The first is worth noting: two controllers live in one file, and the earlier
annotation pass had patched only the first class. A guard with no module
declared waves every request through. The coverage test was rewritten to check
**per class** rather than per file, and verified to catch the bug by reverting
the fix.

### Committed

188 files, 3,199 insertions. Included a clean rebuild of `dist/` (tracked for
the Render deploy) rather than leftover dev-watch output.

---

## Commit 2 — `510413f` · Stripe checkout and provisioning

18 source files, 2,734 insertions. Built without Stripe keys or pricing, which
were not available.

### Approach

Prices are **not** in the code. They live in Stripe; the config only records
which price id sells which service. Setting the real numbers later is an
environment variable change, not a deploy.

The app runs normally with no Stripe configuration at all — which is how it
ships today. `STRIPE_SECRET_KEY` unset means checkout is simply off: the plan
page offers a contact route instead of a buy button, and checkout endpoints
answer 503 with a clear message. Verified by booting with an empty config.

### Built

| Component | Purpose |
|---|---|
| `billing.config.ts` | Price-id ↔ service mapping, env-driven |
| `stripe.service.ts` | Checkout sessions, billing portal, signature verification |
| `stripe-webhook.service.ts` | Translates Stripe events into entitlement changes |
| `stripe-webhook.controller.ts` | `POST /billing/webhook/stripe` |
| `subscription-provisioning.service.ts` | Turns "paid for these services" into rows |
| 3 new endpoints | `checkout/availability`, `checkout/session`, `portal/session` |
| Frontend | Plan page switches to real checkout when configured |

### Design decisions

**Provisioning is provider-agnostic.** The webhook translates Stripe events into
a generic input and calls the same service an admin would when provisioning by
hand. Manual provisioning is how the first customers get onboarded, so that
path runs through the same code payments will use rather than a shortcut that
rots.

**Services resolve from what was billed, not from metadata.** A webhook is
untrusted input and metadata is editable in the Stripe Dashboard; the price ids
actually charged are not.

**An unrecognised price provisions nothing and logs an error**, rather than
silently stripping a paying customer of every service.

**Idempotent by construction.** Handlers compute the full desired state rather
than applying a delta, so Stripe's retries and out-of-order delivery converge
on the same result.

**`PAST_DUE` keeps access**, consistent with the existing rule — dunning is a
billing conversation, not a reason to cut off a guard company mid-shift.

### Documentation

`docs/STRIPE_SETUP.md` — setup runbook covering products, prices, the webhook
endpoint, every environment variable, test cards, four scenarios to exercise by
hand, and go-live steps.

`docs/STANDALONE_SERVICES_TASK_REPORT.md` — full feature report.

---

## Verification at end of day

| Check | Result |
|---|---|
| Backend unit tests | **469 passed, 59 suites, 0 failed** |
| Entitlements e2e | **44 passed** (real DB + HTTP, all 7 combinations) |
| API manual probe | **23/23** against the running server |
| Backend typecheck | Clean (5 pre-existing errors only) |
| Frontend typecheck | Clean |
| Frontend production build | Succeeds |
| Working tree | Clean, both commits landed |

**63 tests** now cover the entitlement and billing code specifically.

---

## Feature status

| Phase | State |
|---|---|
| 0 — Permission catalog fix | Done |
| 1 — Entitlement model + enforcement | Done |
| 2 — Stripe checkout | **Code complete, awaiting keys + pricing** |
| 3 — Standalone UX | Done |
| 4 — Hardening / e2e | Done |

---

## Blocked on the client

1. **Pricing** — per-service standalone price, bundle discount, monthly/annual,
   trial length. Stripe products cannot be created without these.
2. **Stripe keys** — test-mode secret key and webhook signing secret. (An
   account email and password were offered; API keys are what is needed, and
   credentials sent by email should be rotated.)
3. **Checkout ownership** — does the website own the purchase step and hand off
   to the app, or does the app own it? Cross-team, longest lead time.

Messages covering all three have been drafted for Anthony.

---

## Known gaps

- **Nothing has touched live Stripe traffic.** The webhook logic is unit tested
  against realistic event payloads, but no real event has been through it. That
  cannot change until keys exist.
- **No browser click-through.** Everything is verified at API, session-payload,
  typecheck and build level; the rendered pages have not been visually
  inspected. Worth five minutes before any demo.

---

## Suggested next

Work that needs none of the blocked answers:

- **Admin UI for provisioning services** — manual onboarding currently requires
  running SQL. A small screen would remove that, and it directly supports
  selling before checkout is live.
- **Browser pass** over the standalone experience.
