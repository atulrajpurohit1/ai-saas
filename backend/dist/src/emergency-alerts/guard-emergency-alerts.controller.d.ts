import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { EmergencyAlertsService } from './emergency-alerts.service';
export declare class GuardEmergencyAlertsController {
    private readonly emergencyAlertsService;
    constructor(emergencyAlertsService: EmergencyAlertsService);
    private getGuardContext;
    trigger(user: ActiveUser): Promise<{
        id: string;
        status: string;
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        resolvedAt: Date | null;
        notes: string | null;
        guard: {
            id: string;
            name: string;
            phone: string | null;
        };
        branch: {
            id: string;
            name: string;
        } | null;
        site: {
            id: string;
            name: string;
        } | null;
        patrolRoute: {
            id: string;
            name: string;
        } | null;
        patrolRunId: string | null;
        acknowledgedBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        resolvedBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        location: {
            latitude: number;
            longitude: number;
            accuracyMeters: number | null;
            capturedAt: Date | null;
        } | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    active(user: ActiveUser): Promise<{
        id: string;
        status: string;
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        resolvedAt: Date | null;
        notes: string | null;
        guard: {
            id: string;
            name: string;
            phone: string | null;
        };
        branch: {
            id: string;
            name: string;
        } | null;
        site: {
            id: string;
            name: string;
        } | null;
        patrolRoute: {
            id: string;
            name: string;
        } | null;
        patrolRunId: string | null;
        acknowledgedBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        resolvedBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        location: {
            latitude: number;
            longitude: number;
            accuracyMeters: number | null;
            capturedAt: Date | null;
        } | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
