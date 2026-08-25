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
