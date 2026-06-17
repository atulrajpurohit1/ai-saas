import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SalesDeliveryService } from './sales-delivery.service';
export declare class SalesDeliveryController {
    private readonly salesDeliveryService;
    constructor(salesDeliveryService: SalesDeliveryService);
    draftDealFollowUp(dealId: string, user: ActiveUser): Promise<{
        dealId: string;
        dealName: string;
        to: string | null;
        contactName: string;
        company: string;
        subject: string;
        body: string;
        nextActivity: {
            id: any;
            subject: any;
            dueDate: Date | null;
            description: any;
        } | null;
    }>;
    sendDealFollowUp(dealId: string, user: ActiveUser): Promise<{
        status: string;
        messageId: any;
        previewUrl: string | false;
        activityId: string;
    }>;
    calendarForDeal(dealId: string, user: ActiveUser, res: Response): Promise<void>;
}
