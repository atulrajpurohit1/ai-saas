import { Logger } from '@nestjs/common';

export const BLACKPEARL_REQUEST_TIMEOUT_MS = 10_000;

/**
 * A single HTTP call to BlackPearl is retried this many times (in addition
 * to the first attempt) when it fails for a transient reason - network
 * error, timeout, a rate-limit HTTP 429, or HTTP 5xx (including 503, which BlackPearl has
 * confirmed is a transient condition - an async job keeps running server-side
 * even when a status check returns 503). Backoff is exponential
 * (RETRY_BASE_DELAY_MS * 2^attempt). This is the fast, sub-request-level
 * retry for a momentary blip; a caller polling an async job over minutes is
 * what carries a sustained outage across multiple polls without giving up or
 * resubmitting the job. Auth failures (401/403), 404, 402, and the 429s that
 * mean a hard budget or quota rejected the request are never retried -
 * retrying won't fix those. BlackPearl's own response documentation is
 * explicit that of the 429s, only `rate_limit_exceeded` is transient.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Truncated for log readability - a completed job body can be several KB. */
const LOG_BODY_PREVIEW_CHARS = 500;

/**
 * Why a BlackPearl call produced no result.
 *
 * BlackPearl returns a stable `error.code` on every failure (their
 * ErrorResponse envelope) and their own documentation says to branch on that
 * code rather than on the HTTP status. These are the distinctions that change
 * what we should DO, which a bare `null` threw away:
 *
 *   - `insufficient_credits` (402) is the ORGANIZATION's prepaid pot running
 *     dry. It is shared by every tenant, so no customer action fixes it and
 *     no retry helps.
 *   - `budget_exceeded` / `quota_exceeded` (429) is a configured ceiling
 *     refusing the work. NOT transient: BlackPearl's own response
 *     documentation says that of the 429s, "Only `rate_limit_exceeded` is
 *     transient."
 *   - `rate_limited` is the one 429 worth backing off and retrying.
 *   - `auth` (401/403) and `not_found` (404) were already terminal here.
 *   - `unavailable` is everything else, which is what `null` used to mean.
 */
export type BlackPearlFailureKind =
  | 'insufficient_credits'
  | 'budget_exceeded'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'auth'
  | 'not_found'
  | 'unavailable';

export interface BlackPearlFailure {
  kind: BlackPearlFailureKind;
  /** BlackPearl's stable `error.code`, when the body carried a parseable one. */
  code: string | null;
  httpStatus: number | null;
  /** BlackPearl's own end-user-safe message, when one was parseable. */
  message: string | null;
  /** Their request correlation id -- the thing their support asks for. */
  requestId: string | null;
}

export type BlackPearlOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; failure: BlackPearlFailure };

/**
 * The result of submitting an asynchronous BlackPearl job: the job id, or why
 * it could not be started. Shared by every capability that submits jobs, so
 * callers map a refusal to a user-facing error in one place.
 */
export type BlackPearlSubmission =
  | { ok: true; jobId: string }
  | { ok: false; failure: BlackPearlFailure };

/**
 * Shared low-level HTTP client for every BlackPearl endpoint (Playbooks,
 * Prospecting, and any future capability). Extracted so the retry/backoff/
 * logging behavior - proven against the live API - is implemented once and
 * reused by every BlackPearl-backed provider, instead of being duplicated
 * per endpoint.
 *
 * Performs one logical HTTP call, retrying transient failures (network
 * error, timeout, 5xx, and a 429 that is actually a rate limit) up to
 * MAX_ATTEMPTS times with exponential backoff. 401/403/404, 402, and a 429
 * raised by a hard budget or quota are never retried. Every attempt logs its
 * outgoing request and the resulting response (status, elapsed time, and a
 * truncated body preview) so a failure's exact cause is always visible in
 * the logs, not just its final null result. A 503 specifically gets a full,
 * untruncated structured capture (status, body, headers, job id, timestamp)
 * - confirmed by BlackPearl as a transient condition during job polling, so
 * this is the signal most worth debugging in full if it ever needs
 * investigating. Never logs the outgoing Authorization header, so the API
 * key is never exposed in logs.
 *
 * Returns the parsed body, or null on any failure. Kept as the default for
 * the many call sites that can only report "it didn't work" anyway; callers
 * that need to tell an empty prepaid pot apart from a dead network use
 * blackPearlRequestOutcome instead.
 */
export async function blackPearlRequest<T>(
  logger: Logger,
  url: string,
  init: RequestInit,
  context: string,
  jobId?: string,
): Promise<T | null> {
  const outcome = await blackPearlRequestOutcome<T>(
    logger,
    url,
    init,
    context,
    jobId,
  );
  return outcome.ok ? outcome.data : null;
}

/**
 * As blackPearlRequest, but reports WHY a call failed (see
 * BlackPearlFailureKind). Retries transient failures only -- a network error,
 * timeout, 5xx, or a 429 that is genuinely a rate limit. A 429 carrying
 * `budget_exceeded` or `quota_exceeded` is returned immediately: retrying a
 * ceiling that has already rejected us just spends three requests and six
 * seconds of backoff to be told the same thing.
 */
export async function blackPearlRequestOutcome<T>(
  logger: Logger,
  url: string,
  init: RequestInit,
  context: string,
  jobId?: string,
): Promise<BlackPearlOutcome<T>> {
  let lastFailure: BlackPearlFailure = {
    kind: 'unavailable',
    code: null,
    httpStatus: null,
    message: null,
    requestId: null,
  };

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

      lastFailure = {
        kind: 'unavailable',
        code: null,
        httpStatus: null,
        message: reason,
        requestId: null,
      };

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      return { ok: false, failure: lastFailure };
    }
    clearTimeout(timeout);

    const elapsedMs = Date.now() - startedAt;
    const bodyText = await safeReadText(response);

    if (response.status === 401 || response.status === 403) {
      const parsed = parseErrorBody(bodyText);
      logger.error(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - authentication failed, check BLACKPEARL_API_KEY. Body: ${truncate(bodyText)}`,
      );
      // never retry - a bad key won't fix itself
      return {
        ok: false,
        failure: toFailure(response.status, parsed),
      };
    }

    if (response.status === 404) {
      const parsed = parseErrorBody(bodyText);
      logger.warn(
        `BlackPearl <- HTTP 404 ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
      );
      // never retry - the resource genuinely doesn't exist
      return { ok: false, failure: toFailure(404, parsed) };
    }

    if (response.status === 503) {
      logCompleteErrorResponse(logger, response, bodyText, context, jobId);
    }

    if (response.status === 429 || response.status >= 500) {
      const parsed = parseErrorBody(bodyText);
      const failure = toFailure(response.status, parsed);

      // A ceiling that has already refused us is not a blip. Returning here
      // keeps a tenant who hit a hard budget from waiting out two pointless
      // retries and then being told only that something was "unavailable".
      if (response.status === 429 && failure.kind !== 'rate_limited') {
        logger.error(
          `BlackPearl <- HTTP 429 ${context} in ${elapsedMs}ms - ${failure.code ?? 'ceiling'} rejected the request; not retrying. Body: ${truncate(bodyText)}`,
        );
        return { ok: false, failure };
      }

      if (response.status !== 503) {
        logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`,
        );
      }

      lastFailure = failure;

      if (attempt < MAX_ATTEMPTS) {
        const backoffMs =
          RETRY_BASE_DELAY_MS *
          2 ** (attempt - 1) *
          (response.status === 429 ? 2 : 1);
        await sleep(backoffMs);
        continue;
      }
      return { ok: false, failure };
    }

    if (!response.ok) {
      const parsed = parseErrorBody(bodyText);
      logger.error(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
      );
      return { ok: false, failure: toFailure(response.status, parsed) };
    }

    logger.log(
      `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
    );

    try {
      return { ok: true, data: JSON.parse(bodyText) as T };
    } catch (error) {
      logger.error(
        `BlackPearl returned an unparseable response trying to ${context}: ${
          error instanceof Error ? error.message : String(error)
        }. Raw body: ${truncate(bodyText)}`,
      );
      return {
        ok: false,
        failure: {
          kind: 'unavailable',
          code: null,
          httpStatus: response.status,
          message: 'BlackPearl returned an unparseable response.',
          requestId: null,
        },
      };
    }
  }

  return { ok: false, failure: lastFailure };
}

interface ParsedErrorBody {
  code: string | null;
  message: string | null;
  requestId: string | null;
}

/**
 * Pulls BlackPearl's stable error fields out of their failure envelope
 * (`{ "error": { "code", "message", "request_id", ... } }`). Best effort by
 * design: a 5xx from a proxy in front of their API, or a timeout page, is not
 * JSON at all, and that must not throw on an error path.
 */
function parseErrorBody(bodyText: string): ParsedErrorBody {
  const empty: ParsedErrorBody = {
    code: null,
    message: null,
    requestId: null,
  };
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const error = (parsed as { error?: unknown }).error;
    if (typeof error !== 'object' || error === null) return empty;
    const body = error as {
      code?: unknown;
      message?: unknown;
      request_id?: unknown;
    };
    return {
      code: typeof body.code === 'string' ? body.code : null,
      message: typeof body.message === 'string' ? body.message : null,
      requestId: typeof body.request_id === 'string' ? body.request_id : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Classifies a failure by BlackPearl's error code where there is one, falling
 * back to the HTTP status. Code first, per their guidance: the status alone
 * cannot separate a rate limit from a hard budget, and those want opposite
 * handling.
 */
function toFailure(
  httpStatus: number,
  parsed: ParsedErrorBody,
): BlackPearlFailure {
  return {
    kind: classifyFailure(httpStatus, parsed.code),
    code: parsed.code,
    httpStatus,
    message: parsed.message,
    requestId: parsed.requestId,
  };
}

function classifyFailure(
  httpStatus: number,
  code: string | null,
): BlackPearlFailureKind {
  switch (code) {
    case 'insufficient_credits':
      return 'insufficient_credits';
    case 'budget_exceeded':
      return 'budget_exceeded';
    case 'quota_exceeded':
      return 'quota_exceeded';
    case 'rate_limit_exceeded':
      return 'rate_limited';
    default:
      break;
  }

  if (httpStatus === 402) return 'insufficient_credits';
  if (httpStatus === 401 || httpStatus === 403) return 'auth';
  if (httpStatus === 404) return 'not_found';
  // An unrecognised 429 is treated as a rate limit, which is the retryable
  // reading. Guessing "hard ceiling" for a code we do not know would turn a
  // momentary throttle into an immediate failure.
  if (httpStatus === 429) return 'rate_limited';
  return 'unavailable';
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
