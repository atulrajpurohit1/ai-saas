"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_GEOFENCE_RADIUS_METERS = exports.MIN_GEOFENCE_RADIUS_METERS = exports.DEFAULT_GEOFENCE_RADIUS_METERS = exports.CheckpointVerificationStatus = void 0;
var CheckpointVerificationStatus;
(function (CheckpointVerificationStatus) {
    CheckpointVerificationStatus["SUCCESS"] = "SUCCESS";
    CheckpointVerificationStatus["OUTSIDE_GEOFENCE"] = "OUTSIDE_GEOFENCE";
    CheckpointVerificationStatus["LOCATION_UNAVAILABLE"] = "LOCATION_UNAVAILABLE";
    CheckpointVerificationStatus["NO_GEOFENCE_CONFIGURED"] = "NO_GEOFENCE_CONFIGURED";
    CheckpointVerificationStatus["INVALID_LOCATION"] = "INVALID_LOCATION";
})(CheckpointVerificationStatus || (exports.CheckpointVerificationStatus = CheckpointVerificationStatus = {}));
exports.DEFAULT_GEOFENCE_RADIUS_METERS = 50;
exports.MIN_GEOFENCE_RADIUS_METERS = 5;
exports.MAX_GEOFENCE_RADIUS_METERS = 2000;
//# sourceMappingURL=checkpoint-verification.constants.js.map