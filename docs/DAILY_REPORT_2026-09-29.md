# Daily Work Report — 29–30 September 2026

**Developer:** Atul
**Focus:** Pre-launch security review, Prospect Search billing model, brand assets
**Branch:** `claude/affectionate-fermat-vjqn4b` → merged to `main`
**Commits:** `bfd3ef8`, `a209443`, `9db4aa0`, `d6ba51f`, `101544f`, `0e3856e`,
`471887d`, `669a046`, `267344d`, `c65a031`, `19e8619`, `f7d602c`

---

## Summary

Twelve commits across three areas. The security pass found and fixed a flaw
that allowed unauthenticated access to any verified account. The Prospect
Search billing model was found to be structurally wrong once Bebop's real
pricing was obtained, and was rebuilt. Brand assets were replaced with the
supplied artwork.

Test suite went from 562 to 673 passing. All work is on `main` and deployed.

---

## Security (6 commits)

**Critical — authentication bypass.** `POST /auth/verify-email` checked the
one-time code only when the account was *not* already verified, then issued
session tokens either way. For any verified account, an email address plus any
six digits returned a working access and refresh token — no password. Present
in both the admin and client portals. Regression test confirmed failing
against the old code before the fix was trusted.

**Other fixes:** every signup and password-reset code was being written to
production logs in cleartext; no rate limiting existed on any auth endpoint;
`getTokens` defaulted `isSuperAdmin` to `true`; webhook URLs could point at
cloud metadata or internal addresses (SSRF); the CRM token encryption key fell
back to a literal published in this repository; nodemailer carried 6
advisories including cross-tenant SMTP credential disclosure.

**Hardening:** bcrypt 10→12 for passwords, 72-byte password cap (bcrypt
silently truncates beyond that), client portal raised from 6 to 8 characters
to match admin, login timing side-channel closed, boot-time config validation,
and an unset `NODE_ENV` now treated as production rather than development —
it previously fell open on five separate security decisions.

Tenant isolation, file uploads, SQL injection and the Stripe webhook were
audited and found clean. Not yet reviewed: the frontend for XSS, and session
tokens still live in `localStorage`.

---

## Prospect Search billing (3 commits)

Bebop's published pricing was obtained and contradicted what the code assumed.
Credits measure **AI compute, not prospects** — 50–500 credits per action,
decided by the AI at runtime.

The old model billed per prospect returned and refunded the difference. But a
search returning few prospects is a *hard* search, which costs more upstream —
so we refunded the customer precisely when we had spent the most. Now a flat
price per search, with prices configurable without a deploy.

Actual cost per job (`usage.cost_usd`) is now recorded against the ledger; it
was previously discarded, so nothing knew what a search cost. A spend guard
reads the remaining upstream balance and refuses new jobs below a floor.

Also removed an unverified "~$0.11 per prospect, confirmed empirically" figure
from six files. It was never measured.

**Commercially outstanding:** AegisLead runs on a one-off $500 Bebop credit,
not a plan — roughly 100–500 searches in total across all customers. Credit
pack prices are placeholders until a week of real cost data exists.

---

## Integrations and brand (3 commits)

Sales call transcription moved from OpenAI to Gemini, so one API key now
powers every AI feature and no second vendor account is needed. OpenAI remains
available as an opt-in override.

Brand assets replaced with the supplied artwork (both lockups and the mark),
favicon set generated, and the sidebar logo fixed — tenant logos were capped at
32px tall, rendering them at under half the intended size.

---

## Outstanding

1. End-to-end test of signup, payment and search on the live site — never run
2. Confirm Stripe credit pack price IDs are set, or nothing is purchasable
3. Decide the Bebop plan before the development credit runs out
4. Set final credit prices once real cost data exists
5. Session storage hardening, and a frontend security review
