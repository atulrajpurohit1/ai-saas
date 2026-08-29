'use client';

import React, { useState } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendAreaChartProps {
  points: TrendPoint[];
  emptyMessage?: string;
  seriesColor?: string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PADDING_X = 12;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 28;

// Single-series line + area chart (weekly trend). No legend box needed for a
// single series per the dataviz method - the card title already names it.
export default function TrendAreaChart({ points, emptyMessage = 'No activity yet.', seriesColor = '#4f46e5' }: TrendAreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = points.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PADDING_X + i * stepX,
    y: PADDING_TOP + plotHeight - (p.value / maxValue) * plotHeight,
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${PADDING_TOP + plotHeight} L ${coords[0].x} ${PADDING_TOP + plotHeight} Z`;

  const gridLines = [0, 0.5, 1].map((fraction) => ({
    y: PADDING_TOP + plotHeight * (1 - fraction),
    value: Math.round(maxValue * fraction),
  }));

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;
  const labelEvery = points.length > 6 ? 2 : 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Weekly trend chart"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="trend-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seriesColor} stopOpacity={0.16} />
            <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridLines.map((line) => (
          <g key={line.y}>
            <line x1={PADDING_X} y1={line.y} x2={WIDTH - PADDING_X} y2={line.y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={0} y={line.y - 4} fill="#9ca3af" fontSize={11}>{line.value}</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#trend-area-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke={seriesColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c, i) => (
          <g key={c.label}>
            {i % labelEvery === 0 || i === coords.length - 1 ? (
              <text x={c.x} y={HEIGHT - 8} fill="#9ca3af" fontSize={11} textAnchor="middle">
                {c.label}
              </text>
            ) : null}
            {i === coords.length - 1 && (
              <>
                <circle cx={c.x} cy={c.y} r={4} fill={seriesColor} stroke="#ffffff" strokeWidth={2} />
                <text x={c.x} y={c.y - 10} fill="#111827" fontSize={12} fontWeight={700} textAnchor="end">
                  {c.value}
                </text>
              </>
            )}
            <rect
              x={c.x - stepX / 2}
              y={PADDING_TOP}
              width={stepX || plotWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          </g>
        ))}

        {hovered && (
          <g>
            <line x1={hovered.x} y1={PADDING_TOP} x2={hovered.x} y2={PADDING_TOP + plotHeight} stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={seriesColor} stroke="#ffffff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          <div className="font-bold text-foreground">{hovered.value}</div>
          <div className="text-muted-foreground">{hovered.label}</div>
        </div>
      )}
    </div>
  );
}
