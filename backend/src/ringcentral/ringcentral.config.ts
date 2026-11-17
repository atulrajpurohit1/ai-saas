/**
 * RingCentral environment configuration.
 *
 * Mirrors the CRM connectors' isConfigured() convention: with no vars set the
 * integration reports itself unconfigured and every route fails cleanly rather
 * than half-working. Nothing here throws at import time, so a deployment that
 * never uses RingCentral boots exactly as before.
 */

/** Production and sandbox are separate RingCentral deployments with separate
 *  credentials -- a sandbox JWT is rejected by production and vice versa. Same
 *  split as the Stripe test/live keys. */
export const RINGCENTRAL_PRODUCTION_SERVER = 'https://platform.ringcentral.com';
export const RINGCENTRAL_SANDBOX_SERVER =
  'https://platform.devtest.ringcentral.com';

/**
 * Scopes the app must request in the RingCentral developer console.
 *
 * - SubscriptionWebhook: create and renew the webhook subscription.
 * - ReadCallLog:         read the completed call (duration, result, direction).
 * - ReadCallRecording:   download recording audio. Includes ReadCallLog.
 * - CallControl:         receive telephony session events.
 * - RingOut:             place click-to-call dials.
 *
 * CallControl is INFERRED, not confirmed: RingCentral's permissions table does
 * not say which scope the telephony/sessions event filter needs, but a
 * subscription missing it fails with "SUB-410 Required application permission
 * [CallControl] is missing". If that error appears at connect time, this list
 * is where to correct it.
 */
export const RINGCENTRAL_SCOPES = [
  'SubscriptionWebhook',
  'ReadCallLog',
  'ReadCallRecording',
  'CallControl',
  'RingOut',
];

/**
 * How long a webhook subscription is asked to live, in seconds.
 *
 * RingCentral documents neither a default nor a maximum for expiresIn; their
 * examples all use 3600, and the long-standing community figure is a 7-day
 * ceiling. 7 days is therefore the default here because it is the largest
 * value known to have been accepted, and it is overridable because the real
 * ceiling could not be verified. The renewal scheduler runs off the expiry the
 * API returns, not off this number, so a server that silently clamps the
 * request does not break renewal.
 */
const DEFAULT_SUBSCRIPTION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Floor on the TTL. Below this the renewal scheduler cannot keep up. */
const MIN_SUBSCRIPTION_TTL_SECONDS = 15 * 60;

export function ringcentralClientId(): string {
  return process.env.RINGCENTRAL_CLIENT_ID || '';
}

export function ringcentralClientSecret(): string {
  return process.env.RINGCENTRAL_CLIENT_SECRET || '';
}

/** Defaults to sandbox: an accidental production call is worse than an
 *  accidental sandbox one. */
export function ringcentralServerUrl(): string {
  const configured = process.env.RINGCENTRAL_SERVER_URL?.trim();
  return (configured || RINGCENTRAL_SANDBOX_SERVER).replace(/\/+$/, '');
}

export function ringcentralUsesProduction(): boolean {
  return ringcentralServerUrl() === RINGCENTRAL_PRODUCTION_SERVER;
}

/**
 * Public HTTPS origin RingCentral posts webhooks to. Must be reachable from
 * the internet and must NOT be the frontend origin -- it is the API's own
 * public URL. Localhost will not work; use a tunnel in development.
 */
export function ringcentralWebhookBaseUrl(): string {
  return (process.env.RINGCENTRAL_WEBHOOK_BASE_URL || '').replace(/\/+$/, '');
}

export function ringcentralSubscriptionTtlSeconds(): number {
  const raw = Number(process.env.RINGCENTRAL_SUBSCRIPTION_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SUBSCRIPTION_TTL_SECONDS;
  return Math.max(MIN_SUBSCRIPTION_TTL_SECONDS, Math.floor(raw));
}

/**
 * True only when every var needed to complete a connection is present.
 *
 * The webhook base URL is included deliberately: without it a tenant could
 * paste a valid JWT, see "connected", and then never receive a single call,
 * because the subscription could not be created. Better to show
 * "not configured" than to accept a connection that cannot work.
 */
export function ringcentralIsConfigured(): boolean {
  return Boolean(
    ringcentralClientId() &&
      ringcentralClientSecret() &&
      ringcentralWebhookBaseUrl(),
  );
}

/** Why the integration is unavailable, for the Integrations screen. */
export function ringcentralConfigurationGaps(): string[] {
  const gaps: string[] = [];
  if (!ringcentralClientId()) gaps.push('RINGCENTRAL_CLIENT_ID');
  if (!ringcentralClientSecret()) gaps.push('RINGCENTRAL_CLIENT_SECRET');
  if (!ringcentralWebhookBaseUrl()) gaps.push('RINGCENTRAL_WEBHOOK_BASE_URL');
  return gaps;
}
