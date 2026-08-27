"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergencyAlertStatus = void 0;
exports.assertCanAcknowledge = assertCanAcknowledge;
exports.assertCanResolve = assertCanResolve;
const common_1 = require("@nestjs/common");
var EmergencyAlertStatus;
(function (EmergencyAlertStatus) {
    EmergencyAlertStatus["ACTIVE"] = "ACTIVE";
    EmergencyAlertStatus["ACKNOWLEDGED"] = "ACKNOWLEDGED";
    EmergencyAlertStatus["RESOLVED"] = "RESOLVED";
})(EmergencyAlertStatus || (exports.EmergencyAlertStatus = EmergencyAlertStatus = {}));
function assertCanAcknowledge(status) {
    if (status !== EmergencyAlertStatus.ACTIVE) {
        throw new common_1.BadRequestException(`Cannot acknowledge an alert with status "${status}" - only ACTIVE alerts can be acknowledged.`);
    }
}
function assertCanResolve(status) {
    if (status !== EmergencyAlertStatus.ACKNOWLEDGED) {
        throw new common_1.BadRequestException(`Cannot resolve an alert with status "${status}" - only ACKNOWLEDGED alerts can be resolved.`);
    }
}
//# sourceMappingURL=emergency-alert-status.util.js.map