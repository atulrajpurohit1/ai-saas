import { haversineDistanceMeters, isValidCoordinate, isWithinRadius } from './geo.util';

describe('geo.util', () => {
  describe('isValidCoordinate', () => {
    it('accepts valid coordinates', () => {
      expect(isValidCoordinate(40.7128, -74.006)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it('rejects out-of-range latitude/longitude', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
    });

    it('rejects non-numeric or non-finite input', () => {
      expect(isValidCoordinate('40.7' as unknown, -74 as unknown)).toBe(false);
      expect(isValidCoordinate(NaN, 0)).toBe(false);
      expect(isValidCoordinate(Infinity, 0)).toBe(false);
      expect(isValidCoordinate(undefined, undefined)).toBe(false);
      expect(isValidCoordinate(null, null)).toBe(false);
    });
  });

  describe('haversineDistanceMeters', () => {
    it('returns ~0 for identical coordinates', () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };
      expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 3);
    });

    it('returns a small, correct distance for clearly nearby coordinates', () => {
      // Two points ~111m apart (0.001 degree of latitude ≈ 111m).
      const a = { latitude: 40.0, longitude: -74.0 };
      const b = { latitude: 40.001, longitude: -74.0 };
      const distance = haversineDistanceMeters(a, b);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });

    it('returns a large, correct distance for clearly distant coordinates', () => {
      // New York City to Los Angeles, ~3,935 km great-circle distance.
      const nyc = { latitude: 40.7128, longitude: -74.006 };
      const la = { latitude: 34.0522, longitude: -118.2437 };
      const distanceKm = haversineDistanceMeters(nyc, la) / 1000;
      expect(distanceKm).toBeGreaterThan(3900);
      expect(distanceKm).toBeLessThan(3970);
    });

    it('is symmetric regardless of argument order', () => {
      const a = { latitude: 51.5074, longitude: -0.1278 };
      const b = { latitude: 48.8566, longitude: 2.3522 };
      expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
    });
  });

  describe('isWithinRadius', () => {
    it('is true when the point is inside the radius', () => {
      const center = { latitude: 40.0, longitude: -74.0 };
      const nearby = { latitude: 40.0001, longitude: -74.0 };
      expect(isWithinRadius(center, nearby, 50)).toBe(true);
    });

    it('is false when the point is outside the radius', () => {
      const center = { latitude: 40.0, longitude: -74.0 };
      const far = { latitude: 40.01, longitude: -74.0 };
      expect(isWithinRadius(center, far, 50)).toBe(false);
    });

    it('treats the exact radius boundary as inside', () => {
      const center = { latitude: 0, longitude: 0 };
      const point = { latitude: 0, longitude: 0 };
      expect(isWithinRadius(center, point, 0)).toBe(true);
    });
  });
});
