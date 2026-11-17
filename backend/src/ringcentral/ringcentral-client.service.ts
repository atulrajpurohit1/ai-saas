import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ringcentralClientId,
  ringcentralClientSecret,
  ringcentralServerUrl,
} from './ringcentral.config';

/**
 * Provider error bodies quote the request back, which for the token endpoint
 * includes the JWT assertion itself. Logging one verbatim writes a live,
 * non-expiring tenant credential into the application log. Same defect class
 * the transcription service guards against with its own redaction list.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
  /Basic\s+[A-Za-z0-9+/=]{10,}/gi,
  /access_token=[^&\s"']+/gi,
];

export function redactRingCentralSecrets(message: string): string {
  return CREDENTIAL_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '[redacted]'),
    message,
  );
}

/** A RingCentral API failure carrying the HTTP status, so callers can tell a
 *  bad credential (401) from an outage (5xx) from a missing scope (403). */
export class RingCentralApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errorCode?: string,
  ) {
    super(redactRingCentralSecrets(message));
    this.name = 'RingCentralApiError';
  }

  /** The credential itself is bad or revoked -- reconnecting is the only fix. */
  get isCredentialFailure() {
    return this.status === 400 || this.status === 401;
  }

  /** The app is missing a scope, or the user's RingCentral role lacks the
   *  matching permission. Reconnecting will not help; the console must change. */
  get isPermissionFailure() {
    return this.status === 403 || this.errorCode === 'SUB-410';
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * Access tokens are short-lived but a JWT credential is not, so the token is
 * minted on demand and cached in memory rather than stored.
 *
 * Deliberately NOT persisted: an access token in the database is one more
 * copy of a bearer secret to protect, and re-minting costs a single request
 * that RingCentral expects us to make. The cache is per-process; several API
 * instances each holding their own token is fine, because JWT minting does not
 * invalidate a previously issued token the way refresh-token rotation does.
 */
@Injectable()
export class RingCentralClientService {
  private readonly logger = new Logger(RingCentralClientService.name);
  private readonly tokens = new Map<string, CachedToken>();

  /** Re-mint this long before the stated expiry, so a token cannot lapse
   *  mid-flight on a slow request. */
  private static readonly EXPIRY_MARGIN_MS = 5 * 60 * 1000;

  /**
   * Mints (or returns a cached) access token for one tenant's credential.
   *
   * `cacheKey` is the connection id. The JWT is passed in rather than read
   * here so this service never touches the database or the decryption key.
   */
  async getAccessToken(cacheKey: string, jwtCredential: string): Promise<string> {
    const cached = this.tokens.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accessToken;
    }

    const token = await this.mintToken(jwtCredential);
    this.tokens.set(cacheKey, token);
    return token.accessToken;
  }

  /** Drops a cached token, so the next call re-mints. Used when a request
   *  comes back 401 despite a token we believed was live. */
  invalidate(cacheKey: string) {
    this.tokens.delete(cacheKey);
  }

  private async mintToken(jwtCredential: string): Promise<CachedToken> {
    const basic = Buffer.from(
      `${ringcentralClientId()}:${ringcentralClientSecret()}`,
    ).toString('base64');

    const response = await this.fetchWithTimeout(
      `${ringcentralServerUrl()}/restapi/oauth/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwtCredential,
        }),
      },
    );

    const payload = (await this.readJson(response)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !payload.access_token) {
      throw new RingCentralApiError(
        response.status,
        payload.error_description ||
          payload.error ||
          `RingCentral token request failed (${response.status})`,
      );
    }

    // Trust the server's expires_in over any documented figure: the guides and
    // the sample responses disagree (3600 vs 7199), and a wrong assumption here
    // shows up as intermittent 401s rather than a clean failure.
    const ttlMs = Number(payload.expires_in || 3600) * 1000;
    return {
      accessToken: payload.access_token,
      expiresAt:
        Date.now() +
        Math.max(ttlMs - RingCentralClientService.EXPIRY_MARGIN_MS, 30_000),
    };
  }

  /**
   * An authenticated RingCentral API call.
   *
   * Retries once on 401 with a freshly minted token: a cached token can be
   * invalidated server-side (password change, admin session timeout, the
   * parallel-session cap) while our cache still believes it is live.
   */
  async request<T>(
    cacheKey: string,
    jwtCredential: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const send = async (token: string) =>
      this.fetchWithTimeout(this.resolveUrl(path), {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

    let response = await send(await this.getAccessToken(cacheKey, jwtCredential));

    if (response.status === 401) {
      this.invalidate(cacheKey);
      response = await send(await this.getAccessToken(cacheKey, jwtCredential));
    }

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    if (response.status === 204) return undefined as T;
    return (await this.readJson(response)) as T;
  }

  /**
   * Downloads binary content (a call recording) as a Buffer.
   *
   * RingCentral's docs show the access token as a query parameter for the
   * recording contentUri and never confirm that a bearer header works there.
   * The header is tried first because it keeps the credential out of URLs,
   * access logs and redirect chains; the query parameter is the documented
   * fallback. Only the status codes that mean "auth was not accepted" trigger
   * the fallback, so a genuine 404 is not retried pointlessly.
   */
  async downloadContent(
    cacheKey: string,
    jwtCredential: string,
    contentUri: string,
  ): Promise<{ buffer: Buffer; contentType: string | null }> {
    const token = await this.getAccessToken(cacheKey, jwtCredential);

    let response = await this.fetchWithTimeout(contentUri, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      const url = new URL(contentUri);
      url.searchParams.set('access_token', token);
      response = await this.fetchWithTimeout(url.toString(), {});
    }

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
    };
  }

  private resolveUrl(path: string) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${ringcentralServerUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private async toApiError(response: Response): Promise<RingCentralApiError> {
    const payload = (await this.readJson(response)) as {
      message?: string;
      errorCode?: string;
      errors?: Array<{ errorCode?: string; message?: string }>;
    };
    const first = payload.errors?.[0];
    return new RingCentralApiError(
      response.status,
      payload.message || first?.message || `RingCentral API error`,
      payload.errorCode || first?.errorCode,
    );
  }

  /** Never throws on a non-JSON body: RingCentral returns HTML for some
   *  gateway errors, and a JSON parse failure would mask the real status. */
  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 500) };
    }
  }

  /**
   * fetch with a hard timeout. Without one a hung RingCentral connection holds
   * a request handler (and, in the scheduler, the renewal run) open forever.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 20_000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown network error';
      this.logger.warn(
        `RingCentral request failed: ${redactRingCentralSecrets(message)}`,
      );
      throw new ServiceUnavailableException(
        'Could not reach RingCentral. Try again shortly.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
