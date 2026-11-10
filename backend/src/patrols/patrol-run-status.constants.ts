// The complete set of PatrolRun.status values this application writes.
// PatrolRun.status is a plain string column (matching the
// Incident.status / Checkpoint.status convention in this schema), so the
// allowed values are enforced at the application layer.
//
// 'not_started' is the schema default; 'active' is accepted as a legacy
// synonym for 'in_progress' by the admin monitoring read (see
// PatrolsService.getPatrolOverview) and so remains a valid filter value.
export const PATROL_RUN_STATUSES = [
  'not_started',
  'in_progress',
  'active',
  'completed',
  'missed',
] as const;

export type PatrolRunStatus = (typeof PATROL_RUN_STATUSES)[number];

export function isPatrolRunStatus(value: string): value is PatrolRunStatus {
  return (PATROL_RUN_STATUSES as readonly string[]).includes(value);
}
