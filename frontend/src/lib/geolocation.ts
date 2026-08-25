// One-shot device location capture for checkpoint verification (Phase 3A).
// Deliberately uses getCurrentPosition (a single reading), never
// watchPosition - Phase 3A explicitly does not track a guard's location
// continuously, only "was the guard here when they scanned this checkpoint."
export type GeolocationResult =
  | { status: 'success'; latitude: number; longitude: number; accuracy: number }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'timeout' };

const DEFAULT_TIMEOUT_MS = 10_000;

export function requestCurrentLocation(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ status: 'unsupported' });
      return;
    }

    let settled = false;
    const settle = (result: GeolocationResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Safety net in addition to the native `timeout` option below, in case
    // a device/browser fails to honor it - the UI must never hang waiting
    // on a location that will never arrive.
    const fallbackTimer = setTimeout(() => settle({ status: 'timeout' }), timeoutMs + 1000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(fallbackTimer);
        settle({
          status: 'success',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        clearTimeout(fallbackTimer);
        if (error.code === error.PERMISSION_DENIED) {
          settle({ status: 'denied' });
        } else if (error.code === error.TIMEOUT) {
          settle({ status: 'timeout' });
        } else {
          settle({ status: 'unavailable' });
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function geolocationErrorMessage(status: Exclude<GeolocationResult['status'], 'success'>): string {
  switch (status) {
    case 'denied':
      return 'Location access is required to verify this checkpoint. Please allow location access and try again.';
    case 'unsupported':
      return 'This device/browser does not support location verification.';
    case 'timeout':
      return 'Could not get your location in time. Check your GPS signal and try again.';
    case 'unavailable':
    default:
      return 'Location is currently unavailable. Check your GPS signal and try again.';
  }
}
