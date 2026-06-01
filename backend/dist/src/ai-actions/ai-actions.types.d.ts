import { AiRecommendation } from '../ai-insights/ai-insights.types';
export type RecommendationActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type RecommendationActionType = 'create_follow_up_task' | 'notify_admin' | 'flag_client_risk' | 'flag_site_risk' | 'suggest_guard_reassignment' | 'create_invoice_followup';
export type RecommendationTargetModule = 'ai_insights' | 'client' | 'site' | 'guard' | 'shift' | 'invoice' | 'command_center' | 'operations' | 'billing' | 'revenue' | 'incident';
export interface RecommendationActionDraft {
    recommendationId: string;
    actionType: RecommendationActionType;
    title: string;
    description: string;
    targetModule: RecommendationTargetModule;
    targetEntityId?: string | null;
}
export type ActionableRecommendation = AiRecommendation & {
    actionType?: RecommendationActionType;
    targetModule?: RecommendationTargetModule;
    targetEntityId?: string | null;
};
export declare const RECOMMENDATION_ACTION_STATUSES: RecommendationActionStatus[];
export declare const RECOMMENDATION_ACTION_TYPES: RecommendationActionType[];
