# Prospect Search

AI-powered company prospecting: natural-language prompt → AI-parsed filters →
company search → ranked results → view details/AI insight → import as Lead.
This document covers the provider framework, configuration, caching, search
history, and saved searches.

**There is no hardcoded/sample company dataset.** Company data comes only
from a real external provider (Apollo.io today). If that provider isn't
configured or is unreachable, a search fails with a clear error instead of
returning fabricated results.

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
├── AiService.generateProspectSearchFilters()   - prompt -> structured filters
├── CompanyRepository (COMPANY_REPOSITORY)      - config-selected provider
├── ProspectSearchCacheService                  - skip AI+provider on repeat prompts
├── ProspectSearchHistoryService                - per-user search log (Postgres)
├── LeadsService / NotesService                 - reused, not duplicated, for import
└── Logger                                      - timing + failure observability
```

Nothing about which `CompanyRepository` is active leaks past
`ProspectSearchService` - the controller, frontend, and response shapes are
identical regardless of provider.

## Provider framework

`CompanyRepository` (`interfaces/prospect-search.interface.ts`) is the single
abstraction every data source implements:

```ts
interface CompanyRepository {
  search(filters: ProspectSearchFilters): Promise<ProspectCompany[]>;
}
```

Filters are passed in so a real provider can query its own search endpoint
directly with them (industry, location, employee range, keywords).

Implementations live in `providers/`:

| Provider | File | Status |
|---|---|---|
| Apollo | `providers/apollo-company.provider.ts` | **Active** - real `mixed_companies/search` call. Requires `APOLLO_API_KEY`; throws a clear `503` if it's missing, invalid, rate-limited, or Apollo is unreachable. |
| Crunchbase | `providers/crunchbase-company.provider.ts` | Placeholder - throws `ServiceUnavailableException` when used |
| Clearbit | `providers/clearbit-company.provider.ts` | Placeholder |

The active provider is chosen once, at module init, via a factory provider in
`prospect-search.module.ts` bound to the `COMPANY_REPOSITORY` DI token. Nothing
else in the codebase references a concrete provider class directly.

### Apollo provider behavior

`ApolloCompanyProvider` is the only provider with a real implementation, and
it never fabricates or substitutes data:

1. **No `APOLLO_API_KEY` configured** → throws `ServiceUnavailableException`
   ("Prospect Search is not configured...") immediately, without making a
   network call. The search request fails with a clear `503`.
2. **Key configured, request succeeds** → calls Apollo's
   `POST /v1/mixed_companies/search` with filters mapped from the AI-resolved
   `ProspectSearchFilters`, normalizes each raw organization via
   `normalizeApolloOrganization()` into the internal `ProspectCompany` shape,
   and returns them. `ProspectSearchService` re-ranks/scores these as usual -
   Apollo only supplies raw candidates, ranking stays the app's own logic.
3. **Key configured, request fails** (invalid key / 401 / 403, quota
   exceeded / 429, timeout, network error, or any non-2xx response) → throws
   a `ServiceUnavailableException` with a message describing the specific
   failure. Nothing is silently substituted - the frontend shows a real error
   instead of fake results.

Going live requires **no code changes** - only setting `APOLLO_API_KEY=<key>`
in the backend environment and restarting the backend.

### Adding a new provider

1. Add the name to `SUPPORTED_COMPANY_PROVIDERS` in `providers/provider.config.ts`.
2. Create `providers/<name>-company.provider.ts` implementing `CompanyRepository`,
   reading its API key via `ConfigService` (never hardcode credentials).
3. Add a `normalize<Name>...()` function to `providers/company-normalizer.ts`
   mapping that provider's real response shape to `ProspectCompany` - replace
   the illustrative `Raw*` interfaces already there with the provider's actual
   SDK/response types.
4. Register the provider class as a module provider and add it to the
   `COMPANY_REPOSITORY` factory's `switch` in `prospect-search.module.ts`.
5. Add it to `ACTIVE_COMPANY_PROVIDERS` once it's genuinely wired up and tested.

No changes to `ProspectSearchController`, `ProspectSearchService`'s ranking
logic, the API response shape, or the frontend are needed - that's the point
of the abstraction.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `COMPANY_PROVIDER` | `apollo` | One of `apollo`, `crunchbase`, `clearbit`. An unrecognized value throws at **application startup** (fail fast on typos). `crunchbase`/`clearbit` boot fine but return a clear `503` on an actual search - not implemented yet. |
| `APOLLO_API_KEY` | - | **Required** for Prospect Search to return any results. Get one from your Apollo.io account under Settings → Integrations → API. Without it, every search fails with a `503` explaining the key is missing - see "Apollo provider behavior" above. |
| `PROSPECT_SEARCH_CACHE_TTL_SECONDS` | `300` | Search result cache TTL. |
| `PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE` | `20` | Per-user limit on `/search`, `/insights`, `/import`. |
| `CRUNCHBASE_API_KEY` / `CLEARBIT_API_KEY` | - | Read by the respective placeholder provider; not yet used for a real call. |

## Caching strategy

`ProspectSearchCacheService` is an in-memory, per-process, TTL-based cache
keyed on `{tenantId, provider, normalizedPrompt}`. A repeat prompt within the
TTL window skips **both** the AI filter-parsing call and the provider fetch -
the strongest, simplest way to "avoid duplicate provider requests."

Filters are deliberately **not** part of the cache lookup key - they're a
deterministic function of the prompt at write time, so keying on the prompt
alone captures the same repeat-search case with one less moving part. The
resolved filters are still stored in the cached value for observability.

Limitations (documented, not hidden): per-process only. A multi-instance
deployment needs a shared store (Redis) for cache hits to work across
instances - the service is small and self-contained specifically so it's easy
to swap the `Map` for a Redis client later without touching callers.

AI-generated **company insights** (Phase 4) are cached client-side, per
company id, for the current page session - that's a separate, simpler cache
and is unchanged by this phase.

## Search history

Per-tenant, per-user log of every search performed (`ProspectSearchHistory`
Prisma model): prompt, resolved filters (JSON), provider, result count,
timestamp. Recorded on every search (cache hit or miss) since it reflects user
activity, not backend execution cost. Retrieval is paginated (`limit`, default
20, max 50) via `GET /prospect-search/history`.

A history-write failure is logged and swallowed rather than failing the
user's search - it's a convenience log, not part of the critical path.

## Saved searches

Tenant-shared resources (`SavedProspectSearch` Prisma model) - visible and
editable by anyone in the tenant with `prospect_search.manage`, matching how
Leads/Deals/Notes already work in this codebase (not restricted to the
original creator; `userId` is stored only as "created by" metadata).

- **Save**: `POST /saved-searches` - name, prompt, filters.
- **Rename**: `PATCH /saved-searches/:id`.
- **Delete**: `DELETE /saved-searches/:id`.
- **Run Again**: no dedicated endpoint - the frontend simply calls
  `POST /search` again with the saved prompt. This naturally benefits from the
  search cache above with zero extra backend logic.

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

- Per-search: AI duration, provider duration, total duration, result count,
  cache hit/miss.
- Per-insight: AI duration.
- Any AI or provider failure, with tenant/provider context, before rethrowing.

`ProspectSearchCacheService.getStats()` exposes `{ size, hits, misses,
hitRatio }` for future wiring into a metrics endpoint or dashboard - not
currently exposed over HTTP.

## Rate limiting

`ProspectSearchRateLimitGuard` + `ProspectSearchRateLimitService` implement an
in-memory, per-user, fixed-window limiter (mirrors the existing
`PublicApiRateLimitService` pattern) applied to `/search`, `/insights`, and
`/import`. Per-process only, same caveat as the cache - a multi-instance
deployment needs a shared store.
