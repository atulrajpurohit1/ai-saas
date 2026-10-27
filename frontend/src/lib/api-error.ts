import axios from 'axios';

/**
 * Server "messages" that are really framework or infrastructure diagnostics,
 * not something an end user can read or act on. The one that prompted this --
 * `Cannot POST /api/platform-auth/login` -- is NestJS's default route-not-found
 * body; surfacing it verbatim put a raw API path in front of an operator. We
 * never show any of these: when one is detected we fall back to a message
 * chosen from the HTTP status instead.
 */
const TECHNICAL_MESSAGE_PATTERNS: RegExp[] = [
  // NestJS/Express "Cannot POST /api/..." route-not-found bodies.
  /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i,
  // The generic 500 body Nest emits when nothing friendlier was thrown.
  /^Internal server error$/i,
  // Node network/DNS error codes that occasionally leak into a message.
  /\b(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ERR_[A-Z_]+)\b/,
  // A stack frame that leaked into the message text.
  /\bat .+:\d+:\d+\)?/,
  // An HTML error page returned where JSON was expected.
  /^<!doctype|^<html/i,
];

function looksTechnical(message: string): boolean {
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * A plain-language, actionable message for an HTTP status, used when the server
 * gave us nothing a person can read. `fallback` is the caller's own wording for
 * the expected failure (e.g. "Invalid credentials") and is used for 401 and for
 * anything we do not specifically recognise.
 */
function messageForStatus(status: number, fallback: string): string {
  if (status === 400) {
    return 'Some of the information entered isn’t valid. Please check your details and try again.';
  }
  if (status === 401) {
    return fallback;
  }
  if (status === 403) {
    return 'You don’t have permission to do this.';
  }
  if (status === 404) {
    return 'We couldn’t find what you were looking for. It may have been moved or removed, or the service may still be starting up.';
  }
  if (status === 409) {
    return 'This conflicts with something that already exists.';
  }
  if (status === 413) {
    return 'That file is too large to upload. Please try a smaller one.';
  }
  if (status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }
  return fallback;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    // No response at all: the request never completed -- server down, network
    // dropped, CORS, or DNS. Never show the old developer-oriented hint about
    // ports and env vars to an end user.
    return 'We couldn’t reach the server. Please check your connection and try again.';
  }

  const raw = error.response.data?.message;
  const message = Array.isArray(raw) ? raw.join(', ') : raw;

  // Trust the server's own text only when it reads like something written for a
  // person. A genuine validation error or "Invalid credentials" passes through;
  // a framework diagnostic such as "Cannot POST /api/..." does not.
  if (
    typeof message === 'string' &&
    message.trim() &&
    !looksTechnical(message.trim())
  ) {
    return message.trim();
  }

  return messageForStatus(error.response.status, fallback);
}

export interface InsufficientCreditsDetail {
  required: number;
  available: number;
  message: string;
}

/**
 * Recognises the 402 the backend raises when a tenant has run out of Prospect
 * Search credits. Matching on the `code` rather than the message text keeps the
 * UI working if the wording changes; the status is checked too so an unrelated
 * 402 from anywhere else cannot be mistaken for this.
 */
export function getInsufficientCreditsError(
  error: unknown,
): InsufficientCreditsDetail | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 402) {
    return null;
  }

  const data = error.response.data;
  if (data?.code !== 'INSUFFICIENT_CREDITS') return null;

  return {
    required: Number(data.required) || 0,
    available: Number(data.available) || 0,
    message:
      typeof data.message === 'string'
        ? data.message
        : 'You have run out of Prospect Search credits.',
  };
}
