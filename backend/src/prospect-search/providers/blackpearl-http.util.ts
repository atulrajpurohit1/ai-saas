import { Logger } from '@nestjs/common';

export const BLACKPEARL_REQUEST_TIMEOUT_MS = 10_000;

/**
 * A single HTTP call to BlackPearl is retried this many times (in addition
 * to the first attempt) when it fails for a transient reason - network
 * error, timeout, HTTP 5xx (including 503, which BlackPearl has
 * confirmed is a transient condition - an async job keeps running server-side
 * even when a status check returns 503), or a 429 that is specifically
 * `rate_limit_exceeded`. Backoff is exponential
 * (RETRY_BASE_DELAY_MS * 2^attempt). This is the fast, sub-request-level
 * retry for a momentary blip; a caller polling an async job over minutes is
 * what carries a sustained outage across multiple polls without giving up or
 * resubmitting the job. Auth failures (401/403) and 404 are never retried -
 * retrying won't fix those, and neither are the budget-related 429s or a 402
 * (see BLACKPEARL_TERMINAL_BUDGET_CODES).
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Truncated for log readability - a completed job body can be several KB. */
const LOG_BODY_PREVIEW_CHARS = 500;

/**
 * BlackPearl's machine-readable error code, from `error.code` in the response
 * body. It is the ONLY way to tell apart the several distinct conditions that
 * share one HTTP status, so it drives both the retry decision and the error
 * the customer eventually sees.
 */
/**
 * Carries the error code of a failed call back to the caller. Passed in by a
 * caller that wants it; ignored entirely by the ones that do not.
 */
export interface BlackPearlRequestOutcome {
  errorCode?: BlackPearlErrorCode;
}

export type KnownBlackPearlErrorCode =
  | 'rate_limit_exceeded'
  | 'quota_exceeded'
  | 'budget_exceeded'
  | 'insufficient_credits';

/**
 * Widened to `string` on purpose: BlackPearl can add codes we have never seen,
 * and a code we do not recognise must still travel to the logs intact rather
 * than being narrowed away. KnownBlackPearlErrorCode above documents the ones
 * this code actually branches on.
 */
export type BlackPearlErrorCode = KnownBlackPearlErrorCode | (string & {});

/**
 * The 429 codes that must NOT be retried.
 *
 * A 429 from BlackPearl carries three different meanings and only one of them
 * is transient - their spec is explicit: "Only `rate_limit_exceeded` is
 * transient." `budget_exceeded` means a hard spending limit was reached (a
 * project's allowance or its daily/monthly limit, or the company's), and
 * `quota_exceeded` means a usage quota is exhausted. Neither resolves by
 * waiting a second and asking again.
 *
 * Retrying them was actively harmful: it burned three requests and seconds of
 * backoff before failing, and then reported the generic "transient failure"
 * that every other retry exhaustion reports - so a tenant who had simply run
 * out of budget produced a 503 that looked like a BlackPearl outage.
 */
const TERMINAL_429_CODES = new Set(['quota_exceeded', 'budget_exceeded']);

/**
 * Error codes that describe a spending limit rather than a fault, with the
 * level each one applies to. Surfaced to callers via
 * `lastBlackPearlErrorCode()` so a per-tenant budget stop can be told apart
 * from a company-wide one: the first is that tenant's problem, the second
 * stops everybody and needs an operator.
 */
export const BLACKPEARL_TERMINAL_BUDGET_CODES: Record<
  string,
  'tenant' | 'company'
> = {
  // One client's own allowance, its daily or monthly limit, or the minimum
  // required to start a search. BlackPearl is explicit that only that client
  // stops -- every other tenant keeps working -- and `error.details.kind`
  // says which of the four it was: `allowance`, `min_to_start`, `day` or
  // `month`.
  //
  // This was briefly mapped to 'company' here, on the reasoning that a
  // BlackPearl key is project-scoped and we hold one key, so any ceiling must
  // bind everyone. That was read off the August copy of their spec in
  // scratch/bp_openapi.json, which predates projects entirely. Per-project
  // allowances are real and the `Blackpearl-Project` header selects the
  // client per request, so this is per-tenant by design.
  //
  // Caveat worth knowing until projects are actually adopted: with no project
  // header being sent, a budget_exceeded could only come from the
  // company-wide caps set via PUT /v1/limits, which is NOT per-tenant.
  // Reading `error.details.kind` is what settles it properly, and is the
  // right follow-up when projects land.
  budget_exceeded: 'tenant',
  quota_exceeded: 'tenant',
  // No spendable prepaid credit remains company-wide. Every tenant is stopped.
  // This one really is shared fate, and per-client projects do not change it:
  // the company balance funds every project.
  insufficient_credits: 'company',
};

/**
 * Shared low-level HTTP client for every BlackPearl endpoint (Playbooks,
 * Prospecting, and any future capability). Extracted so the retry/backoff/
 * logging behavior - proven against the live API - is implemented once and
 * reused by every BlackPearl-backed provider, instead of being duplicated
 * per endpoint.
 *
 * Performs one logical HTTP call, retrying transient failures (network
 * error, timeout, a `rate_limit_exceeded` 429, 5xx) up to MAX_ATTEMPTS times
 * with exponential backoff. 401/403/404 are never retried, and neither is a
 * 402 or a budget-related 429 - those are spending limits, which retrying
 * cannot clear. Every attempt logs its outgoing
 * request and the resulting response (status, elapsed time, and a truncated
 * body preview) so a failure's exact cause is always visible in the logs,
 * not just its final null result. A 503 specifically gets a full,
 * untruncated structured capture (status, body, headers, job id, timestamp)
 * - confirmed by BlackPearl as a transient condition during job polling, so
 * this is the signal most worth debugging in full if it ever needs
 * investigating. Never logs the outgoing Authorization header, so the API
 * key is never exposed in logs.
 *
 * Returns null for every failure, as it always has. When the failure was a
 * spending limit, `outcome.errorCode` is set to BlackPearl's own `error.code`
 * so the caller can raise a 402 instead of a 503. It is an out-parameter
 * rather than a changed return type because six call sites depend on the
 * `T | null` contract, and rather than module state because several searches
 * run concurrently - a shared "last error" would be read by the wrong one.
 */
export async function blackPearlRequest<T>(
  logger: Logger,
  url: string,
  init: RequestInit,
  context: string,
  jobId?: string,
  outcome?: BlackPearlRequestOutcome,
): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      BLACKPEARL_REQUEST_TIMEOUT_MS,
    );
    const startedAt = Date.now();

    logger.debug(
      `BlackPearl -> ${init.method} ${context} (attempt ${attempt}/${MAX_ATTEMPTS})`,
    );

    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      const elapsedMs = Date.now() - startedAt;
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const reason = isTimeout
        ? `timed out after ${BLACKPEARL_REQUEST_TIMEOUT_MS}ms`
        : `network error: ${error instanceof Error ? error.message : String(error)}`;

      logger.error(
        `BlackPearl <- FAILED ${context} (attempt ${attempt}/${MAX_ATTEMPTS}) after ${elapsedMs}ms: ${reason}`,
      );

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return null;
    }
    clearTimeout(timeout);

    const elapsedMs = Date.now() - startedAt;
    const bodyText = await safeReadText(response);

    if (response.status === 401 || response.status === 403) {
      logger.error(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - authentication failed, check BLACKPEARL_API_KEY. Body: ${truncate(bodyText)}`,
      );
      return null; // never retry - a bad key won't fix itself
    }

    if (response.status === 404) {
      logger.warn(
        `BlackPearl <- HTTP 404 ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
      );
      return null; // never retry - the resource genuinely doesn't exist
    }

    if (response.status === 503) {
      logCompleteErrorResponse(logger, response, bodyText, context, jobId);
    }

    // A 402 or a budget-related 429 is a spending decision, not a fault. It is
    // recorded so the caller can turn it into the right customer-facing error
    // (a 402 "you are out of credits" rather than a 503 "try again later"),
    // and returned immediately -- retrying a hard limit cannot clear it.
    if (response.status === 402 || response.status === 429) {
      const code = parseErrorCode(bodyText);

      if (response.status === 402 || TERMINAL_429_CODES.has(code ?? '')) {
        // A 402 means insufficient credits whether or not the body said so:
        // the status alone carries that meaning in BlackPearl's spec. Falling
        // back to the code keeps the caller's budget handling working on a
        // 402 with an unreadable body, which would otherwise look like an
        // ordinary failure and be reported as a generic outage.
        if (outcome) {
          outcome.errorCode =
            code ??
            (response.status === 402 ? 'insufficient_credits' : undefined);
        }
        logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - ` +
            `terminal (code=${code ?? 'unreported'}), not retrying. Body: ${truncate(bodyText)}`,
        );
        return null;
      }

      // Falls through to the transient path below: rate_limit_exceeded, or a
      // 429 whose code we could not read. An unreadable code is retried
      // deliberately -- treating an unknown 429 as terminal would turn a
      // momentary rate limit into a failed search, which is the worse error.
      logger.error(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - ` +
          `transient (code=${code ?? 'unreported'}). Body: ${truncate(bodyText)}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) * 2);
        continue;
      }
      return null;
    }

    if (response.status >= 500) {
      if (response.status !== 503) {
        logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`,
        );
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return null;
    }

    if (!response.ok) {
      logger.error(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
      );
      return null;
    }

    logger.log(
      `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
    );

    try {
      return JSON.parse(bodyText) as T;
    } catch (error) {
      logger.error(
        `BlackPearl returned an unparseable response trying to ${context}: ${
          error instanceof Error ? error.message : String(error)
        }. Raw body: ${truncate(bodyText)}`,
      );
      return null;
    }
  }

  return null;
}

export function blackPearlHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeString(
  value: string | null | undefined,
): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Reads `error.code` out of a BlackPearl error body. Returns undefined when
 * the body is not JSON or carries no code - callers must treat that as
 * "unknown", never as a particular code, since the retry decision depends on
 * it and guessing wrong either fails a retryable call or retries a hard limit.
 */
function parseErrorCode(bodyText: string): BlackPearlErrorCode | undefined {
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { code?: unknown };
    };
    const code = parsed?.error?.code;
    return typeof code === 'string' && code.trim() ? code.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<failed to read response body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function truncate(
  text: string,
  maxLength: number = LOG_BODY_PREVIEW_CHARS,
): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... (${text.length} chars total)`;
}

/**
 * Full, untruncated capture of a 503 response for debugging - status,
 * complete body, response headers, job id, and an explicit ISO timestamp.
 * Only ever logs response headers (never our own outgoing Authorization
 * request header), so the API key is never exposed.
 */
function logCompleteErrorResponse(
  logger: Logger,
  response: Response,
  bodyText: string,
  context: string,
  jobId?: string,
): void {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  logger.error(
    `BlackPearl 503 (transient - job continues running server-side) trying to ${context}: ${JSON.stringify(
      {
        httpStatus: response.status,
        jobId: jobId ?? null,
        timestamp: new Date().toISOString(),
        responseHeaders: headers,
        responseBody: bodyText,
      },
    )}`,
  );
}
