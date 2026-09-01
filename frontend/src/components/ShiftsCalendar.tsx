'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneForStatus } from '@/components/StatusBadge';
import { formatEnumLabel } from '@/lib/format';

// Minimal shape this calendar needs. The Shifts page's richer Shift type is
// structurally compatible, so it can be passed straight through.
export interface CalendarShift {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  requiredGuards: number;
  site?: { name?: string | null } | null;
  assignments?: { id: string; guard: { name: string } }[];
}

interface ShiftsCalendarProps {
  shifts: CalendarShift[];
  onSelectShift?: (shiftId: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TONE_DOT: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  primary: 'bg-primary',
  neutral: 'bg-muted-foreground',
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfMonthGrid = (monthAnchor: Date) => {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay()); // back up to the Sunday
  return gridStart;
};

const formatTimeShort = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function ShiftsCalendar({ shifts, onSelectShift }: ShiftsCalendarProps) {
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();

  const days = useMemo(() => {
    const gridStart = startOfMonthGrid(monthAnchor);
    // 6 weeks always shown so the grid height doesn't jump between months.
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [monthAnchor]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, CalendarShift[]>();
    for (const shift of shifts) {
      const start = new Date(shift.startTime);
      if (Number.isNaN(start.getTime())) continue;
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const bucket = map.get(key) ?? [];
      bucket.push(shift);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    }
    return map;
  }, [shifts]);

  const monthLabel = monthAnchor.toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) =>
    setMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );

  return (
    <div className="glass-card overflow-hidden rounded-3xl border border-white/5">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-4 sm:p-5">
        <h3 className="text-lg font-bold">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.02] text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const inMonth = date.getMonth() === monthAnchor.getMonth();
          const isToday = sameDay(date, today);
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const dayShifts = shiftsByDay.get(key) ?? [];

          return (
            <div
              key={index}
              className={cn(
                'min-h-[104px] border-b border-r border-white/5 p-1.5 sm:min-h-[128px] sm:p-2',
                index % 7 === 0 && 'border-l',
                !inMonth && 'bg-white/[0.015] text-muted-foreground',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    isToday ? 'bg-primary text-white' : 'text-muted-foreground',
                    inMonth && !isToday && 'text-foreground',
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {dayShifts.slice(0, 3).map((shift) => {
                  const tone = toneForStatus(shift.status);
                  const assigned = shift.assignments?.length ?? 0;
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => onSelectShift?.(shift.id)}
                      title={`${shift.site?.name ?? 'Shift'} - ${formatEnumLabel(shift.status)} - ${assigned}/${shift.requiredGuards} guards`}
                      className="flex w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-left text-[11px] font-medium transition hover:bg-white/10"
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])}
                      />
                      <span className="truncate">
                        {formatTimeShort(shift.startTime)} {shift.site?.name ?? 'Shift'}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground">
                        <Users size={10} />
                        {assigned}/{shift.requiredGuards}
                      </span>
                    </button>
                  );
                })}
                {dayShifts.length > 3 && (
                  <div className="px-1.5 text-[10px] font-semibold text-muted-foreground">
                    +{dayShifts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
