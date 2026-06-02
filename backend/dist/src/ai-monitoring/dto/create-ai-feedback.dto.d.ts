export declare class CreateAiFeedbackDto {
    aiGenerationId?: string;
    recommendationId?: string;
    actionId?: string;
    rating: number;
    feedbackText?: string;
    isUseful: boolean;
    isAccurate: boolean;
}
