// Phase 3B live guard tracking - all timing constants in one place so
// there's a single source of truth instead of intervals scattered across
// guard and admin code.

// How often the guard's device sends a location update while a patrol is
// in_progress. One-shot capture (Phase 3A's requestCurrentLocation), not
// watchPosition - this constant IS the tracking frequency.
export const LOCATION_UPDATE_INTERVAL_MS = 30_000;

// How often the admin "live guards" view re-polls for updated locations.
export const ADMIN_LOCATION_POLL_INTERVAL_MS = 15_000;

// A location is considered stale once it's older than this - the guard is
// not shown as reliably "live" past this threshold. Set to comfortably
// more than one missed update cycle so a single slow/failed request
// doesn't immediately flip the badge.
export const LOCATION_STALE_THRESHOLD_MS = LOCATION_UPDATE_INTERVAL_MS * 3;

// Phase 3D: how often the admin active-alerts panel re-polls for new/updated
// panic alerts. Faster than the location poll above since this is a safety
// signal, but still plain polling - no WebSockets/SSE exist in this app.
export const EMERGENCY_ALERT_POLL_INTERVAL_MS = 10_000;

// Phase 3E: how often the client portal's "guard on site now" panel
// re-polls. Same cadence as the admin live-guards panel - not safety-
// critical like the alert poll above, just a presence/trust indicator.
export const CLIENT_LIVE_STATUS_POLL_INTERVAL_MS = ADMIN_LOCATION_POLL_INTERVAL_MS;
