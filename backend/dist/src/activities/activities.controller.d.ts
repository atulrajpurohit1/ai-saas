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
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }>;
    findAll(dealId: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }[]>;
    updateStatus(id: string, status: string, user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }>;
}
