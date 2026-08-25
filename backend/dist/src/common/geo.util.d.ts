export interface Coordinates {
    latitude: number;
    longitude: number;
}
export declare function isValidCoordinate(latitude: unknown, longitude: unknown): boolean;
export declare function haversineDistanceMeters(a: Coordinates, b: Coordinates): number;
export declare function isWithinRadius(center: Coordinates, point: Coordinates, radiusMeters: number): boolean;
