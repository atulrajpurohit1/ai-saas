import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiMonitoringService } from './ai-monitoring.service';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';
export declare class AiFeedbackController {
    private readonly aiMonitoringService;
    constructor(aiMonitoringService: AiMonitoringService);
    create(user: ActiveUser, dto: CreateAiFeedbackDto): Promise<{
        aiGeneration: {
            id: string;
            status: string;
            sourceModule: string;
            fallbackUsed: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        createdBy: string;
        aiGenerationId: string;
        recommendationId: string | null;
        actionId: string | null;
        rating: number;
        feedbackText: string | null;
        isUseful: boolean;
        isAccurate: boolean;
    }>;
    findAll(user: ActiveUser): Promise<({
        aiGeneration: {
            id: string;
            createdAt: Date;
            status: string;
            promptVersion: string;
            modelUsed: string;
            sourceModule: string;
            fallbackUsed: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        createdBy: string;
        aiGenerationId: string;
        recommendationId: string | null;
        actionId: string | null;
        rating: number;
        feedbackText: string | null;
        isUseful: boolean;
        isAccurate: boolean;
    })[]>;
}
