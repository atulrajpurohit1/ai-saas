/**
 * Shift.status lifecycle.
 *
 *   open        - fewer guards assigned than `requiredGuards`
 *   assigned    - every required slot is filled, nobody has checked in yet
 *   in_progress - at least one assigned guard is currently checked in
 *   completed   - every guard who checked in has checked out again
 *
 * `open` / `assigned` are staffing states: they are recomputed by
 * `staffingStatus()` whenever an assignment is added or removed. A shift that
 * has already moved to `in_progress` / `completed` is never pulled back to a
 * staffing state by a roster change.
 *
 * `in_progress` / `completed` are attendance states, written by the guard
 * portal on check-in / check-out. With several guards on one shift,
 * `completed` means "no guard is still on duty", not "the first guard left":
 * it is set when the number of check-outs catches up with the number of
 * check-ins, and a late guard checking in afterwards flips it back to
 * `in_progress`.
 */
export function staffingStatus(
  currentStatus: string,
  assignedCount: number,
  requiredGuards: number,
): string {
  if (currentStatus === 'in_progress' || currentStatus === 'completed') {
    return currentStatus;
  }
  return assignedCount >= requiredGuards ? 'assigned' : 'open';
}

export function attendanceStatusAfterCheckOut(
  checkInCount: number,
  checkOutCount: number,
): 'in_progress' | 'completed' {
  return checkOutCount >= checkInCount ? 'completed' : 'in_progress';
}

/**
 * How late an assigned guard may be before the shift counts them a no-show.
 */
export const NO_SHOW_GRACE_MINUTES = 15;

/**
 * Whether an assigned guard has failed to turn up.
 *
 * Derived, never stored. A stored flag would be wrong the moment a late guard
 * finally checks in, and would need a job to set it in the first place; this
 * is true exactly while the guard is overdue and has no check-in, and stops
 * being true the instant they arrive.
 */
export function isNoShow(
  shift: { startTime: Date },
  hasCheckedIn: boolean,
  now: Date = new Date(),
): boolean {
  if (hasCheckedIn) return false;
  return (
    now.getTime() >
    shift.startTime.getTime() + NO_SHOW_GRACE_MINUTES * 60 * 1000
  );
}
