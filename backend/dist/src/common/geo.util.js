"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCoordinate = isValidCoordinate;
exports.haversineDistanceMeters = haversineDistanceMeters;
exports.isWithinRadius = isWithinRadius;
const EARTH_RADIUS_METERS = 6_371_000;
function isValidCoordinate(latitude, longitude) {
    return (typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180);
}
function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}
function haversineDistanceMeters(a, b) {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return EARTH_RADIUS_METERS * c;
}
function isWithinRadius(center, point, radiusMeters) {
    return haversineDistanceMeters(center, point) <= radiusMeters;
}
//# sourceMappingURL=geo.util.js.map