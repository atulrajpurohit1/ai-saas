import { Logger } from '@nestjs/common';

export const BLACKPEARL_REQUEST_TIMEOUT_MS = 10_000;

/**
 * A single HTTP call to BlackPearl is retried this many times (in addition
 * to the first attempt) when it fails for a transient reason - network
 * error, timeout, HTTP 429, or HTTP 5xx (including 503, which BlackPearl has
 * confirmed is a transient condition - an async job keeps running server-side
 * even when a status check returns 503). Backoff is exponential
 * (RETRY_BASE_DELAY_MS * 2^attempt). This is the fast, sub-request-level
 * retry for a momentary blip; a caller polling an async job over minutes is
 * what carries a sustained outage across multiple polls without giving up or
 * resubmitting the job. Auth failures (401/403) and 404 are never retried -
 * retrying won't fix those.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Truncated for log readability - a completed job body can be several KB. */
const LOG_BODY_PREVIEW_CHARS = 500;

/**
 * Shared low-level HTTP client for every BlackPearl endpoint (Playbooks,
 * Prospecting, and any future capability). Extracted so the retry/backoff/
 * logging behavior - proven against the live API - is implemented once and
 * reused by every BlackPearl-backed provider, instead of being duplicated
 * per endpoint.
 *
 * Performs one logical HTTP call, retrying transient failures (network
 * error, timeout, 429, 5xx) up to MAX_ATTEMPTS times with exponential
 * backoff. 401/403/404 are never retried. Every attempt logs its outgoing
 * request and the resulting response (status, elapsed time, and a truncated
 * body preview) so a failure's exact cause is always visible in the logs,
 * not just its final null result. A 503 specifically gets a full,
 * untruncated structured capture (status, body, headers, job id, timestamp)
 * - confirmed by BlackPearl as a transient condition during job polling, so
 * this is the signal most worth debugging in full if it ever needs
 * investigating. Never logs the outgoing Authorization header, so the API
 * key is never exposed in logs.
 */
export async function blackPearlRequest<T>(
  logger: Logger,
  url: string,
  init: RequestInit,
  context: string,
  jobId?: string,
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

    if (response.status === 429 || response.status >= 500) {
      if (response.status !== 503) {
        logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`,
        );
      }
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs =
          RETRY_BASE_DELAY_MS *
          2 ** (attempt - 1) *
          (response.status === 429 ? 2 : 1);
        await sleep(backoffMs);
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
