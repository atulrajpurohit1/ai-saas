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
