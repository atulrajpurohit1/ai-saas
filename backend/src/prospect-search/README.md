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
4. **Job submission itself fails** (invalid key / 401 / 403, quota exceeded /
   429, timeout, network error, malformed JSON, or any non-2xx response) →
   `BlackPearlInsightProvider` logs the specific failure (without ever
   logging the API key) and returns `null`; the service turns that into a
   `ServiceUnavailableException`. Nothing is silently substituted - the
   frontend shows a real error instead of fake results.

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
