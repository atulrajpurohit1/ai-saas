import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { EmergencyAlertActionDto } from './dto/emergency-alert-action.dto';
export declare class EmergencyAlertsController {
    private readonly emergencyAlertsService;
    constructor(emergencyAlertsService: EmergencyAlertsService);
    findAll(user: ActiveUser, status?: string): Promise<{
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
    }[]>;
    acknowledge(user: ActiveUser, id: string, dto: EmergencyAlertActionDto): Promise<{
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
    resolve(user: ActiveUser, id: string, dto: EmergencyAlertActionDto): Promise<{
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
}
