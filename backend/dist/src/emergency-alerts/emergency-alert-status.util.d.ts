export declare enum EmergencyAlertStatus {
    ACTIVE = "ACTIVE",
    ACKNOWLEDGED = "ACKNOWLEDGED",
    RESOLVED = "RESOLVED"
}
export declare function assertCanAcknowledge(status: string): void;
export declare function assertCanResolve(status: string): void;
