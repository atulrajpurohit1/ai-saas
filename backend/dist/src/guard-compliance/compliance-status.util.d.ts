export declare enum ComplianceStatus {
    VALID = "VALID",
    EXPIRING_SOON = "EXPIRING_SOON",
    EXPIRED = "EXPIRED",
    MISSING = "MISSING"
}
export declare const COMPLIANCE_EXPIRING_SOON_DAYS = 30;
export declare function calculateRecordStatus(expirationDate: Date | string | null | undefined, now?: Date): ComplianceStatus.VALID | ComplianceStatus.EXPIRING_SOON | ComplianceStatus.EXPIRED;
