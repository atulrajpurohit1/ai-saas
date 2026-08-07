export type AiInsightCategory = 'operations' | 'clients' | 'guards' | 'sites' | 'billing' | 'incidents' | 'revenue' | 'contracts' | 'renewals';
export type AiRecommendationPriority = 'high' | 'medium' | 'low';
export type AiRecommendationSource = 'rule' | 'ai';
export type AiRecommendationConfidence = 'high' | 'medium' | 'low';
export interface AiRecommendation {
    id: string;
    category: AiInsightCategory;
    priority: AiRecommendationPriority;
    title: string;
    action: string;
    reason: string;
    source: AiRecommendationSource;
    confidence?: AiRecommendationConfidence;
    aiGenerationId?: string;
    actionType?: 'create_follow_up_task' | 'notify_admin' | 'flag_client_risk' | 'flag_site_risk' | 'suggest_guard_reassignment' | 'create_invoice_followup';
    targetModule?: 'ai_insights' | 'client' | 'site' | 'guard' | 'shift' | 'invoice' | 'command_center' | 'operations' | 'billing' | 'revenue' | 'incident';
    targetEntityId?: string | null;
}
export interface GuardRecommendationMetrics {
    attendance_rate: number | null;
    site_shifts: number;
    late_check_ins: number;
    missed_shifts: number;
    incidents: number;
    upcoming_workload: number;
}
export interface GuardRecommendation {
    guard_id: string;
    guard_name: string;
    score: number;
    reasons: string[];
    warnings: string[];
    explanation: string;
    metrics: GuardRecommendationMetrics;
}
export interface SchedulingCoverageGap {
    shiftId: string;
    siteId: string;
    siteName: string;
    startTime: string;
    endTime: string;
    requiredGuards: number;
    assignedGuards: number;
    shortageSlots: number;
    status: string;
}
export interface SchedulingOverview {
    generatedAt: string;
    horizonDays: number;
    totalUpcomingShifts: number;
    fullyCoveredShifts: number;
    coverageGaps: number;
    shortageSlots: number;
    unassignedShifts: number;
    gaps: SchedulingCoverageGap[];
    recommendations: AiRecommendation[];
}
