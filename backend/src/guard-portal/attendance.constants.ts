/**
 * Rules for when a guard may record attendance against a shift.
 *
 * Without a window, check-in validated only "not already checked in", so a
 * guard could check in to next Thursday's shift today, or to last week's, and
 * the timesheet produced on check-out was then for any duration against any
 * date.
 */

/**
 * Check-in opens this long before the shift's start time, so a guard who
 * arrives early is not told to wait, and closes at the shift's end time.
 */
export const CHECK_IN_OPENS_MINUTES_BEFORE_START = 60;

/**
 * Check-out is deliberately NOT bounded -- guards forget, and refusing the
 * check-out would leave the shift open and produce no timesheet at all. A
 * check-out this long after the shift ended is instead flagged on the event
 * so whoever reviews the timesheet can see it.
 */
export const LATE_CHECK_OUT_GRACE_MINUTES = 30;

export const LATE_CHECK_OUT_NOTE = 'Checked out late';

const MINUTE_MS = 60 * 1000;

export function checkInWindow(shift: { startTime: Date; endTime: Date }) {
  return {
    opensAt: new Date(
      shift.startTime.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE_START * MINUTE_MS,
    ),
    closesAt: shift.endTime,
  };
}

export function isWithinCheckInWindow(
  shift: { startTime: Date; endTime: Date },
  at: Date,
) {
  const { opensAt, closesAt } = checkInWindow(shift);
  return at.getTime() >= opensAt.getTime() && at.getTime() <= closesAt.getTime();
}

export function isLateCheckOut(shift: { endTime: Date }, at: Date) {
  return (
    at.getTime() > shift.endTime.getTime() + LATE_CHECK_OUT_GRACE_MINUTES * MINUTE_MS
  );
}

/**
 * DD-MM-YYYY HH:mm, the date format used throughout the product, for the
 * message a guard reads when they are outside the window.
 */
export function formatShiftMoment(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}` +
    ` ${pad(value.getHours())}:${pad(value.getMinutes())}`
  );
}

export function checkInWindowMessage(shift: {
  startTime: Date;
  endTime: Date;
}) {
  const { opensAt } = checkInWindow(shift);
  return (
    `This shift starts at ${formatShiftMoment(shift.startTime)}. ` +
    `Check-in opens at ${formatShiftMoment(opensAt)} and closes when the shift ends.`
  );
}
