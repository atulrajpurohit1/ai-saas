import { ActivitiesService } from './activities.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class ActivitiesController {
    private readonly activitiesService;
    constructor(activitiesService: ActivitiesService);
    create(body: any, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        description: string | null;
        status: string;
        dealId: string | null;
        type: string;
        subject: string;
        dueDate: Date | null;
    }>;
    findAll(dealId: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        description: string | null;
        status: string;
        dealId: string | null;
        type: string;
        subject: string;
        dueDate: Date | null;
    }[]>;
    updateStatus(id: string, status: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        description: string | null;
        status: string;
        dealId: string | null;
        type: string;
        subject: string;
        dueDate: Date | null;
    }>;
}
