# Stripe Setup — Standalone Services

What to do in Stripe once pricing is agreed, and which environment variables
to set. The code is built and tested; this is the remaining configuration.

**Until `STRIPE_SECRET_KEY` is set, checkout is simply off.** The app runs
normally, `/settings/plan` shows services without buy buttons, and the checkout
endpoints answer 503 with a clear message. Nothing half-works.

---

## 1. In the Stripe Dashboard

Do all of this in **Test mode** first (toggle, top right).

### Create three products

One per sellable service:

| Product | Sells |
|---|---|
| AegisLead — Lead Gen | Leads, deals, proposals, prospect search, RFP, vendors |
| AegisLead — Guard Tour | Guards, patrols, shifts, incidents, timesheets, reports |
| AegisLead — Finance | Invoices, disputes, rate cards, finance reporting |

### Add prices

For each product add a **recurring** price — monthly, annual, or both. The
amount, currency and interval live in Stripe; the app never hardcodes them, so
a price change needs no deploy.

Copy each price id (`price_...`). Those go in the env vars below.

**Bundles:** no separate product. Buying two or three services adds two or
three line items to one subscription, so the customer gets a single invoice.
If a bundle discount is wanted, apply a **coupon** to the checkout session
rather than creating bundle products — otherwise every combination needs its
own product and the list grows to seven.

### Add the webhook endpoint

**Developers → Webhooks → Add endpoint**

- URL: `https://<your-backend-domain>/api/billing/webhook/stripe`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the **signing secret** (`whsec_...`).

### Enable the Billing Portal

**Settings → Billing → Customer portal.** Allow updating payment methods,
viewing invoices, and cancelling. This is what `/billing/portal/session` opens,
and it is why the app does not build card forms, dunning emails or invoice
screens itself.

---

## 2. Environment variables

Set on the backend service (Render dashboard → Environment). Locally they go in
`backend/.env`, which is gitignored.

| Variable | Example | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Yes — enables checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Yes — without it webhooks are refused |
| `STRIPE_PRICE_LEAD_GEN_MONTHLY` | `price_...` | Per service/interval sold |
| `STRIPE_PRICE_LEAD_GEN_ANNUAL` | `price_...` | |
| `STRIPE_PRICE_GUARD_TOUR_MONTHLY` | `price_...` | |
| `STRIPE_PRICE_GUARD_TOUR_ANNUAL` | `price_...` | |
| `STRIPE_PRICE_FINANCE_MONTHLY` | `price_...` | |
| `STRIPE_PRICE_FINANCE_ANNUAL` | `price_...` | |
| `STRIPE_TRIAL_DAYS` | `14` | Optional; blank = no trial |
| `BILLING_RETURN_URL` | `https://app.aegislead.com` | Optional; defaults to `FRONTEND_URL` |

Only configure the intervals actually being sold. `GET /billing/checkout/availability`
reports which services have a usable price, and the plan page uses that to
decide what to offer.

---

## 3. Testing before going live

With test keys set:

```bash
# Local webhook forwarding
stripe listen --forward-to localhost:5000/api/billing/webhook/stripe

# Use the whsec_ it prints as STRIPE_WEBHOOK_SECRET while testing
stripe trigger checkout.session.completed
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

Worth exercising by hand:

1. Buy Lead Gen alone → tenant gets `LEAD_GEN` only, Guard Tour and Finance
   still 403
2. Add Guard Tour to that tenant → both active, no other change
3. Cancel in the portal → services revoked, core routes still reachable
4. Fail a payment (card `4000 0000 0000 0341`) → status `PAST_DUE`, **access
   retained** — that is deliberate

---

## 4. Going live

1. Recreate products, prices and the webhook endpoint in **Live mode** — test
   objects do not carry over
2. Swap the env vars for live ids (`sk_live_...`, new `price_...`, new `whsec_...`)
3. Take one real payment on a real card and refund it

---

## 5. Behaviour worth knowing

**`PAST_DUE` keeps access.** A failed payment marks the subscription past due
but does not revoke services — Stripe retries, and only a real cancellation
removes access. Cutting off a guard company mid-shift over a declined card is
the wrong trade.

**Services are resolved from what was billed, not from metadata.** The webhook
maps the price ids on the subscription back to services. Metadata is editable
in the Dashboard; what was actually charged is not.

**An unrecognised price id provisions nothing and logs an error.** If a price
exists in Stripe but its id is missing from the env vars, the webhook refuses
rather than silently stripping a paying customer of everything. If a customer
pays and gets no access, check these env vars first.

**Webhooks are idempotent.** Every handler computes the full desired state, so
a replayed or out-of-order event converges on the same result. Stripe retries
freely and that is fine.

**A tenant keeps its Stripe customer across purchases.** Adding a second
service reuses the existing customer, so the customer gets one billing
relationship rather than two unrelated invoices.
