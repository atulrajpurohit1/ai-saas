import { EmailService } from './email.service';
import { Request } from 'express';
export declare class EmailController {
    private readonly emailService;
    constructor(emailService: EmailService);
    sendEmail(req: Request, leadId: string): Promise<{
        messageId: string;
        previewUrl: string | false;
        status: string;
    }>;
}
