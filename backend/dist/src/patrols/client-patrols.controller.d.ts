import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PatrolsService } from './patrols.service';
export declare class ClientPatrolsController {
    private readonly patrolsService;
    constructor(patrolsService: PatrolsService);
    private getClientContext;
    liveStatus(user: ActiveUser): Promise<{
        site: {
            id: string;
            name: string;
            address: string;
        };
        guardsOnSite: {
            guardId: string;
            guardName: string;
            shiftId: string;
            patrolRoute: {
                id: string;
                name: string;
            } | null;
            location: {
                latitude: number;
                longitude: number;
                accuracyMeters: number | null;
                capturedAt: Date | null;
            } | null;
        }[];
    }[]>;
}
