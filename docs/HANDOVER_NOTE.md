# Handover note — read this first

Context for picking up work on AegisLead. Written 2026-09-27.

## Who's who

- **Client:** Anthony Rumore. Communicates via Teams. Wants AegisLead launched;
  a previous launch date slipped and he is sensitive about delays.
- **Atul** — account holder, owns the machine, all client messages go out under
  his name.
- **Nayan** — now doing the work. Took over from Atul at the Lead Gen stage and
  is new to this codebase. Messages to Anthony are still signed "Atul"; this is
  an internal reassignment, not a secret.
- Keep client messages **short and plain**, no jargon, **no "Thanks, Atul"
  sign-off** — the thread is informal.

## The product

Security-industry SaaS. Four packages, renamed by Anthony on 25 Sep:

| Package | Internal enum | Covers |
|---|---|---|
| AegisLead Generation™ | `LEAD_GEN` | Leads, deals, proposals, prospect search, RFP, vendors |
| AegisLead Guard™ | `GUARD_TOUR` | Patrols, incidents, checkpoints, compliance, reports |
| AegisLead Operations™ | `FINANCE` | **Scheduling, timesheets**, invoices, rate cards, finance |
| AegisLead Complete™ | all three | — |

**Enum values deliberately still say `LEAD_GEN`/`GUARD_TOUR`/`FINANCE`.**
Renaming them would mean migrating every tenant's module rows for no functional
gain. Display names live in `entitlements.constants.ts` (backend) and
`lib/entitlements.ts` (frontend).

**Scheduling sits with Operations, not Guard.** This was a judgement call:
Anthony's description put "scheduling, workforce management" under Operations,
but shifts/timesheets were with Guard. Rationale to defend if asked: *Guard
proves the work happened, Operations plans the workforce and bills for it* —
timesheets are what invoicing is built on. A Guard-only customer therefore
cannot roster shifts. Anthony has not explicitly confirmed this.

## What's built and live

- **Per-service entitlements.** `TenantSubscription` + `TenantModule`,
  `EntitlementsService`, `ModuleGuard`, `@RequireModule` on ~30 controllers.
  Effective access = **entitlement AND permission**. `isSuperAdmin` bypasses
  PermissionGuard but deliberately **not** ModuleGuard.
- **Standalone UX.** Nav filtered by entitlement, `/settings/plan`,
  `ModuleLockedState`, 403s carry `upgradeRequired` and route to the plan page.
- **Daily report emails.** Publishing a report generates an AI summary (Gemini)
  from recorded activity and emails it with the PDF attached. Per-client
  setting: off by default, MANUAL (supervisor publishes) or AUTOMATIC (hourly
  sweep). `ReportDeliveryScheduler` handles the sweep.
- **Stripe integration** — built but **switched off**. No keys, no products.
  With `STRIPE_SECRET_KEY` unset the app runs normally and the plan page shows
  "Contact us" instead of buy buttons.
- **Price table + guard metering.** Four packages × six guard bands.

## Immediate next task: switch email to Brevo

**The problem.** Resend is in sandbox mode — it can only send to
`atulrajpurohit25@gmail.com` and rejects everything else with a 550. Verified
live: a report publish returned
`"You can only send testing emails to your own email address"`.

**Why Brevo.** From a comment already in `email.service.ts`: *"Brevo only
requires a verified sender ADDRESS rather than a verified domain, which is why
it is preferred over Resend here."* Anthony/Atul did not want to do DNS domain
verification, so Brevo's single-address verification is the path.

**What's needed.** No code change — the Brevo transport is already written and
wins automatically over Resend when its key is present. Someone must:
1. Verify a sender address in the Brevo dashboard
2. Set `BREVO_API_KEY` in `backend/.env` and in Render's environment

Transport priority in `EmailService` constructor: `BREVO_API_KEY` →
`RESEND_API_KEY` → SMTP. Render's free tier **blocks outbound SMTP ports**, so
an HTTP API is the only workable option in production.

## Open with the client

1. **Stripe keys** — test secret key (`sk_test_`) and webhook signing secret
   (`whsec_`). Asked three times. Anthony offered his account login; we asked
   for API keys instead rather than have him disable 2FA on a payments account.
2. **Generation pricing confirmed:** Generation-only is a flat **$299/mo**
   whatever the guard count. Other packages band by guard count.
3. **"Active guards" definition** — flagged to Anthony, not yet answered. We
   count guards rostered in the last 30 days, not every guard row, so customers
   aren't billed for leavers. The Guard model has no active/inactive flag.
4. **New signups get all three services.** Known gap: signup creates no
   subscription row, and `EntitlementsService` fails open for tenants without
   one. Not yet fixed. Needs a decision: trial with expiry, or active with none.

## State of the repo

- Branch `feat/aegislead-branding`, all work pushed.
- **PR #11 (price table + guard metering) is open and NOT merged.** Everything
  earlier is merged and deployed.
- Backend `dist/` is **tracked deliberately** for the Render deploy — rebuild
  with `npm run build` before committing, don't ship dev-watch output.
- Render's backend service is configured in their dashboard, not `render.yaml`
  (which only defines the frontend). Deploys have needed a **manual trigger**.
- 521 unit tests, 62 suites. Plus 44 e2e in `test/entitlements.e2e-spec.ts`
  (real DB + HTTP, run with `--runInBand`, takes ~6 min).
- 5 pre-existing typecheck errors (2 in `scratch/`, 3 in unrelated specs) —
  not ours, confirmed via `git stash`.

## Gotchas worth knowing

- **Neon cold-starts**: first `prisma migrate deploy` often fails with P1001.
  Just retry.
- **`prisma generate` EPERM** on Windows when a node process holds the engine —
  kill node first.
- **`@nestjs/schedule` pinned to v6.** v12 is ESM-only and breaks this
  project's CommonJS Jest setup.
- **Heredocs mangle `\n` escapes** — use the Edit tool for those lines.
- Migrations get applied to the **live Neon DB** from this machine. Code and
  schema can drift; keep the branch merged.

## Demo data currently on the production DB

- **"Report Demo Security"** (`report-demo`) — Guard Tour + Operations, 1 site,
  2 guards, 2 shifts, 1 incident, 1 published report. Client email was pointed
  at `atulrajpurohit25@gmail.com` to test delivery. Created by
  `backend/scratch/demo-report.js`; remove with `--clean`.
- An earlier Lead-Gen-only demo tenant was already removed.

## Working style that's been useful

- Verify against the real DB/API rather than trusting unit tests — the manual
  pass caught a nav bug every test missed.
- Write the regression test **and confirm it fails** before trusting it. Two
  real bugs were found this way (`ai.manage`, `GuardsAliasController`).
- Flag product decisions to Anthony rather than guessing; note the assumption
  in code when proceeding anyway.
