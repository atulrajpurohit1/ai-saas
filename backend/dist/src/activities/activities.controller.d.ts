import { ActivitiesService } from './activities.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class ActivitiesController {
    private readonly activitiesService;
    constructor(activitiesService: ActivitiesService);
    create(body: any, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        subject: string;
        type: string;
        description: string | null;
        dueDate: Date | null;
    }>;
    findAll(dealId: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        subject: string;
        type: string;
        description: string | null;
        dueDate: Date | null;
    }[]>;
    updateStatus(id: string, status: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        subject: string;
        type: string;
        description: string | null;
        dueDate: Date | null;
    }>;
}
