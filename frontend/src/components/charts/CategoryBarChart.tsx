'use client';

import React from 'react';

export interface CategoryBarDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface CategoryBarChartProps {
  data: CategoryBarDatum[];
  emptyMessage?: string;
  defaultColor?: string;
}

// Horizontal bar chart. Each row's own text label sits directly beside its
// bar, so identity never depends on color alone — no separate legend needed
// for this form.
export default function CategoryBarChart({ data, emptyMessage = 'No data yet.', defaultColor = '#4f46e5' }: CategoryBarChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((datum) => {
        const widthPct = Math.max((datum.value / maxValue) * 100, datum.value > 0 ? 4 : 0);
        return (
          <div key={datum.key} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-xs font-semibold text-foreground sm:w-36" title={datum.label}>
              {datum.label}
            </div>
            <div className="h-5 flex-1 rounded-full bg-muted">
              <div
                className="flex h-5 items-center justify-end rounded-full pr-2 transition-all duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: datum.color || defaultColor, minWidth: datum.value > 0 ? '1.75rem' : 0 }}
              >
                {datum.value > 0 && (
                  <span className="text-xs font-bold text-white">{datum.value}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
