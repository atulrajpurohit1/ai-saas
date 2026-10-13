# Prospect Search

AI-powered company prospecting: a user submits a company name → BlackPearl
generates a sales "playbook" for that company → the playbook is shown and can
be imported as a Lead. This document covers the BlackPearl integration,
caching, search history, and saved searches.

**There is no hardcoded/sample company dataset.** Playbook data comes only
from BlackPearl. If it isn't configured or is unreachable, a search fails
with a clear error instead of returning fabricated results.

## Architecture

```
ProspectSearchController
├── POST /search        (rate-limited)  -> ProspectSearchService.search()
├── POST /view                          -> ProspectSearchService.recordView()
├── POST /insights      (rate-limited)  -> ProspectSearchService.getCompanyInsight()
├── POST /import        (rate-limited)  -> ProspectSearchService.importCompany()
├── GET  /history                       -> ProspectSearchHistoryService.list()
├── GET  /saved-searches                -> SavedProspectSearchService.list()
├── POST /saved-searches                -> SavedProspectSearchService.create()
├── PATCH /saved-searches/:id           -> SavedProspectSearchService.rename()
└── DELETE /saved-searches/:id          -> SavedProspectSearchService.remove()

ProspectSearchService
├── BlackPearlInsightProvider                   - POST /v1/playbooks for a company name
├── ProspectSearchCacheService                  - skip a repeat BlackPearl call for the same company
├── ProspectSearchHistoryService                - per-user search log (Postgres)
├── LeadsService / NotesService                 - reused, not duplicated, for import
└── Logger                                      - timing + failure observability
```

## BlackPearl integration

`BlackPearlInsightProvider` (`providers/blackpearl-insight.provider.ts`) is
the single source of company data. It calls BlackPearl's `POST /v1/playbooks`
with `{ target_company, brand_profile_key }` and maps the completed job's
`result` into `ProspectCompanyInsight` (`companyName`, `domain`, `website`,
`businessSummary`, `businessObjective`, `valueProps`, `salesAngles`,
`keyPersonas`, `potentialObjections`, `meetingNoteExample`,
`contactOverview`, `readinessLevel`, `documentUrl`). Only `companyName` is
guaranteed - real BlackPearl responses regularly omit the rest.

BlackPearl is a **single-company playbook lookup**, not a filterable list
search - there is no "search by industry/location/employee count" capability,
so `/search` takes exactly one company name and returns exactly one playbook.

### The playbook API is asynchronous

`POST /v1/playbooks` does **not** return a playbook. It queues a job and
responds immediately (HTTP 202) with just a job id and status `"queued"`.
The actual playbook is only available later via `GET /v1/jobs/{id}`, once
that job's status is `"succeeded"` - **not** `"completed"` (an earlier
version of this integration assumed a synchronous response and the wrong
terminal-status string; both were confirmed wrong against the live API).
Jobs commonly take several minutes - one observed run took ~13 minutes.

`BlackPearlInsightProvider` exposes this as two calls:
- `submitPlaybookJob(company)` - submits and returns a job id.
- `getJobResult(jobId)` - checks status once; returns `{status: 'pending', progress}`
  while BlackPearl reports `queued`/`running`, `{status: 'completed', insight}`
  once it reports `succeeded` with a usable result, or `{status: 'failed'}`
  for any other terminal status (failed/cancelled/timeout/error/unrecognized -
  the exact set of failure strings isn't documented, so anything that isn't
  `succeeded` and isn't pending is treated as failed and logged verbatim).

### `/search` behavior

1. **No `BLACKPEARL_API_KEY` configured** → throws `ServiceUnavailableException`
   ("Prospect Search is not configured...") immediately, without making a
   network call.
2. **Cache hit** → returns `{ status: 'completed', companyName, insight }` immediately.
3. **Cache miss, key configured** → submits the job and returns
   `{ status: 'pending', jobId, companyName }`. The caller (frontend) polls
   `GET /search/:jobId` until the job reaches a terminal state - this can
   take minutes, so the polling client should not give up quickly.
4. **Job submission itself fails** (invalid key / 401 / 403, timeout,
   network error, malformed JSON, or any non-2xx response) →
   `BlackPearlInsightProvider` logs the specific failure (without ever
   logging the API key) and returns `null`; the service turns that into a
   `ServiceUnavailableException`. Nothing is silently substituted - the
   frontend shows a real error instead of fake results.
5. **BlackPearl refuses the job over a spending limit** → a 402, or a 429
   whose `error.code` is `budget_exceeded` / `quota_exceeded`. This is not a
   failure and is not retried; see "Upstream spending limits" below.

`GET /search/:jobId` calls `getJobResult()` once per request and returns the
current status; on completion it writes to cache/history (which `/search`
itself no longer does, since it doesn't wait for the result).

`/insights` uses the same provider for a single already-known company via
`getPlaybook()`, a short bounded poll (~3 attempts, a few seconds total) -
given real jobs take minutes, this will almost always miss and fall back to
a Gemini-generated insight (`AiService.generateProspectCompanyInsight`).
The Gemini fallback deliberately only fills the fields it can honestly
produce from general reasoning (`businessSummary`, `businessObjective`,
`valueProps`, `salesAngles`, `meetingNoteExample`, `readinessLevel`) - it
never fabricates `keyPersonas`, `potentialObjections`, `contactOverview`, or
`documentUrl`, since those are meant to be real, sourced facts from
BlackPearl's own research, not something an LLM should invent.

## Upstream spending limits

BlackPearl answers a 429 for three different reasons and the codes matter,
because **only `rate_limit_exceeded` is transient** (their spec says so
explicitly). `budget_exceeded` means a hard spending limit was hit and
`quota_exceeded` means a usage quota is exhausted. A 402
`insufficient_credits` means our own prepaid balance is gone.

`blackPearlRequest` therefore reads `error.code` and:

- retries only `rate_limit_exceeded` (and a 429 whose code it could not read,
  since treating an unknown 429 as terminal would fail a search over a
  momentary rate limit - the worse error);
- returns a 402 or a budget 429 immediately, reporting the code to the caller
  via the `outcome` out-parameter.

Previously every 429 was retried three times with backoff and then reported as
a generic transient failure, so a tenant that had merely run out of budget
produced a 503 that looked like a BlackPearl outage.

The providers raise `UpstreamBudgetExceededError` with a **scope**, and
`ProspectSearchService.submitOrTranslateBudgetError` turns it into the right
customer-facing answer:

| Scope | Meaning | Response |
|---|---|---|
| `tenant` | One client's allowance, daily/monthly limit, or minimum-to-start. Everyone else keeps working. | `402 INSUFFICIENT_CREDITS` - the frontend offers a top-up |
| `company` | Our prepaid balance is spent. Every tenant is stopped. | `503` + the cached balance is invalidated, since only an operator can fix it |

Until per-client projects are actually adopted, no `Blackpearl-Project` header
is sent, so a `budget_exceeded` could only come from the company-wide caps set
via `PUT /v1/limits` - which is not per-tenant. Reading `error.details.kind`
(`allowance`, `min_to_start`, `day`, `month`) is what settles it properly, and
is the right follow-up when projects land.

No credits are taken in either case: the hold is placed only *after* a
submission succeeds, so a refusal costs the customer nothing.

## The three spending limits

Three separate limits have to hold before a billed job is submitted
(`ProspectSearchService.assertCanAfford`), and they fail differently on
purpose:

| Limit | Whose | Failure | Fixed by |
| --- | --- | --- | --- |
| Upstream spending room | ours, shared | 503 | nothing the customer can do |
| Per-tenant monthly upstream cost | ours, per tenant | 429 `UPSTREAM_SPEND_CAP_EXCEEDED` | waiting for the reset, or support raising it |
| Tenant credit balance | theirs | 402 `INSUFFICIENT_CREDITS` | buying credits |

`UpstreamBudgetService` owns the first two. The shared one reads `GET
/v1/usage` and enforces against whichever ceiling is closest: the
organization's prepaid balance, or the tightest HARD budget BlackPearl
reports. The per-tenant one is enforced against
`CreditsService.monthToDateUpstreamCostUsd()` -- the sum of
`CreditLedgerEntry.upstream_cost_usd` for that tenant this month -- and is
configured by `BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD`, which has no default
(see `.env.example` for why).

Those three are the limits WE apply before submitting. The section above is
what happens when BlackPearl refuses a job we did submit.

### The per-tenant cap here is a stopgap, not the destination

BlackPearl supports one project per client, and that is where this ceiling
belongs. `POST /v1/projects` creates a project, the `Blackpearl-Project` header
names the client on each request, `POST /v1/projects/{ref}/allowance` tops it
up and `/allowance/reductions` reverses it, both idempotent on a `reference`
we already have (the Stripe session id, already unique on the ledger). A client
over its allowance gets a 429 `budget_exceeded` and nobody else is affected.

That is not built yet. The cap in `UpstreamBudgetService` is enforced from our
own ledger instead, which needs no upstream changes and works today, but it is
an approximation: it reads costs we recorded ourselves rather than a balance
BlackPearl is enforcing.

Two things to carry into that work:

- **Projects do not fix shared fate.** Prepaid credit is held at the company
  level and funds every project, so an exhausted balance is still a 402 that
  stops every tenant. Auto top-up is console-only, with no API, so customer
  purchases cannot programmatically fund it either.
- **Keep our ledger authoritative.** A project allowance is a second record of
  what a tenant may spend, and the two drift whenever a job's real cost differs
  from the flat credit price - which is always, since we charge flat and
  BlackPearl bills variable compute. Treat the allowance as a blast-radius cap,
  not a second billing system, or there will be two balances to reconcile.

> **A warning about `scratch/bp_openapi.json`.** That file is an August copy
> and does not contain projects, allowances, limits, charges or pricing
> estimates, all of which shipped later. Its `info.version` still reads
> `0.2.0`, exactly as the live spec does, so the version string cannot tell
> you it is stale. Fetch `https://api.blackpearl.com/v1/openapi.json` before
> concluding anything about what the API does or does not support - reading
> the cached copy as current is how an earlier revision of this document came
> to claim, wrongly, that per-client projects were impossible.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `BLACKPEARL_API_KEY` | - | **Required** for Prospect Search to return any results. Without it, every search fails with a `503` explaining the key is missing. |
| `BLACKPEARL_BASE_URL` | `https://api.blackpearl.com/v1` | BlackPearl API base URL. |
| `BLACKPEARL_BRAND_PROFILE_KEY` | `blackpearl` | Sent as `brand_profile_key` on every playbook request. |
| `PROSPECT_SEARCH_CACHE_TTL_SECONDS` | `300` | Search result cache TTL. |
| `PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE` | `20` | Per-user limit on `/search`, `/insights`, `/import`. |

## Caching strategy

`ProspectSearchCacheService` is an in-memory, per-process, TTL-based cache
keyed on `{tenantId, provider, normalizedCompanyName}`. A repeat lookup for
the same company within the TTL window skips the BlackPearl call entirely.

Limitations (documented, not hidden): per-process only. A multi-instance
deployment needs a shared store (Redis) for cache hits to work across
instances.

## Search history

Per-tenant, per-user log of every search performed (`ProspectSearchHistory`
Prisma model): the submitted company name (`prompt` column), provider
(`blackpearl`), result count, timestamp. The `filters` column is still
present in the schema for backward compatibility but is always written as
`{}` - there is nothing to filter on with a single-company lookup. Retrieval
is paginated (`limit`, default 20, max 50) via `GET /prospect-search/history`.

A history-write failure is logged and swallowed rather than failing the
user's search - it's a convenience log, not part of the critical path.

## Saved searches

Tenant-shared resources (`SavedProspectSearch` Prisma model) - visible and
editable by anyone in the tenant with `prospect_search.manage`, matching how
Leads/Deals/Notes already work in this codebase (not restricted to the
original creator; `userId` is stored only as "created by" metadata).

- **Save**: `POST /saved-searches` - name, prompt (the company name).
- **Rename**: `PATCH /saved-searches/:id`.
- **Delete**: `DELETE /saved-searches/:id`.
- **Run Again**: no dedicated endpoint - the frontend simply calls
  `POST /search` again with the saved company name.

## Permissions

| Permission | Grants |
|---|---|
| `prospect_search.view` | See search results, view company details, view history/saved searches |
| `prospect_search.search` | Execute a search or generate an AI insight |
| `prospect_search.manage` | Create/rename/delete saved searches |
| `leads.create` (existing) | Required in addition to the above to import a company as a Lead |

## Observability

`ProspectSearchService` logs (via the standard Nest `Logger`, same convention
as `AiService`):

- Per-search: provider duration, total duration, cache hit/miss.
- Per-insight: AI duration.
- Any provider failure, with tenant context, before rethrowing.

`ProspectSearchCacheService.getStats()` exposes `{ size, hits, misses,
hitRatio }` for future wiring into a metrics endpoint or dashboard - not
currently exposed over HTTP.

## Rate limiting

`ProspectSearchRateLimitGuard` + `ProspectSearchRateLimitService` implement an
in-memory, per-user, fixed-window limiter (mirrors the existing
`PublicApiRateLimitService` pattern) applied to `/search`, `/insights`, and
`/import`. Per-process only, same caveat as the cache - a multi-instance
deployment needs a shared store.
