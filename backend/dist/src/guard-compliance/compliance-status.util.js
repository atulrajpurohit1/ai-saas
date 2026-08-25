"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLIANCE_EXPIRING_SOON_DAYS = exports.ComplianceStatus = void 0;
exports.calculateRecordStatus = calculateRecordStatus;
var ComplianceStatus;
(function (ComplianceStatus) {
    ComplianceStatus["VALID"] = "VALID";
    ComplianceStatus["EXPIRING_SOON"] = "EXPIRING_SOON";
    ComplianceStatus["EXPIRED"] = "EXPIRED";
    ComplianceStatus["MISSING"] = "MISSING";
})(ComplianceStatus || (exports.ComplianceStatus = ComplianceStatus = {}));
exports.COMPLIANCE_EXPIRING_SOON_DAYS = 30;
const EXPIRING_SOON_WINDOW_MS = exports.COMPLIANCE_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
function calculateRecordStatus(expirationDate, now = new Date()) {
    if (!expirationDate)
        return ComplianceStatus.VALID;
    const expiry = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
    if (Number.isNaN(expiry.getTime())) {
        throw new Error('Invalid expiration date');
    }
    const msUntilExpiry = expiry.getTime() - now.getTime();
    if (msUntilExpiry < 0)
        return ComplianceStatus.EXPIRED;
    if (msUntilExpiry <= EXPIRING_SOON_WINDOW_MS)
        return ComplianceStatus.EXPIRING_SOON;
    return ComplianceStatus.VALID;
}
//# sourceMappingURL=compliance-status.util.js.map