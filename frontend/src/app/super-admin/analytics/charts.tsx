'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Chart primitives for the platform analytics screen.
 *
 * Hand-built SVG rather than a charting library: the app is on Next 16 /
 * React 19, where most chart packages still declare an older React peer, and
 * the handful of forms this screen needs (monthly bars, stacked bars, ranked
 * bars, one part-to-whole row) is less code than the adapter layer a library
 * would need anyway.
 *
 * Colours are literal rather than CSS tokens because SVG attributes cannot
 * read Tailwind classes, and because this app is a single forced LIGHT theme
 * (see globals.css) -- there is no dark surface to re-step the palette for.
 * The hues are the validated categorical order, taken in slot order and never
 * cycled; `validate_palette.js` passes all six checks for the first four slots
 * on a #ffffff surface. Aqua and yellow sit below 3:1 contrast there, so every
 * chart on this screen ships a table view as the required relief.
 */
export const VIZ = {
  /** Categorical slots, in fixed order. Never generate a 5th. */
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const,
  surface: '#ffffff',
  /** Hairline grid, one shade off the surface. Solid, never dashed. */
  grid: '#eceff4',
  axis: '#dbe1ea',
  textSecondary: '#52514e',
  textMuted: '#8b919b',
};

/** Compact axis/label numbers: 1.2k, 3.4M. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000)
    return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

export function usd(value: number, dp = 2): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

/** `2026-11` -> `Nov 26`, for an x-axis tick that fits. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${names[Number(m) - 1] ?? m} ${year.slice(2)}`;
}

/** `2026-11` -> `November 2026`, for tooltips and the table. */
export function monthLong(month: string): string {
  const [year, m] = month.split('-');
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[Number(m) - 1] ?? m} ${year}`;
}

/**
 * The rendered pixel width of a container.
 *
 * Charts are drawn at real pixel width rather than with a fixed viewBox and
 * `preserveAspectRatio="none"`, which would stretch the type along with the
 * geometry and leave the labels at the wrong weight on every screen size.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Seed from the current layout so the first paint is not a 0-width chart.
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/** A bar with its data-end rounded and its base square on the axis. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

/**
 * Four or five "nice" ticks spanning 0..max, where the TOP tick is always
 * greater than or equal to max.
 *
 * Both of those matter. An earlier version stopped the loop at
 * `max + step / 2`, which for max = 0.42 and step = 0.2 produced a top tick of
 * 0.4 -- so the tallest bar was scaled against 0.4 and drew past the top of
 * the plot. `top` is now rounded UP to a whole step, so the scale always
 * contains the data.
 *
 * Ticks are also built by multiplying the index rather than by accumulating
 * `value += step`, which drifts (0.1 added three times is 0.30000000000000004)
 * and puts that drift straight into an axis label.
 */
function ticksFor(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step * 1e-6; i += 1) {
    ticks.push(Number((i * step).toFixed(decimals)));
  }
  return ticks;
}

/**
 * An axis tick label.
 *
 * `compact()` alone is wrong here: it rounds to whole numbers, so a money axis
 * running 0 -> 0.4 (an ordinary month of AI spend) printed "0" on every single
 * tick. Sub-unit values therefore keep two decimals.
 */
function axisLabel(value: number, money: boolean): string {
  const abs = Math.abs(value);
  if (money) {
    if (value === 0) return '$0';
    if (abs < 1) return `$${value.toFixed(2)}`;
    if (abs < 1000) return `$${value.toFixed(Number.isInteger(value) ? 0 : 2)}`;
    return `$${compact(value)}`;
  }
  if (value !== 0 && abs < 1) return value.toFixed(2);
  return compact(value);
}

export interface Series {
  key: string;
  label: string;
  /** Index into VIZ.series. Fixed per entity, never by rank. */
  color: number;
  values: number[];
  /** Renders values as money in tooltips and labels. */
  money?: boolean;
}

interface ChartProps {
  labels: string[];
  series: Series[];
  /** Plot height in px, excluding the x-axis band. */
  height?: number;
  /** Stack the series instead of grouping them. Same unit only. */
  stacked?: boolean;
  /** Formats the value in tooltip/labels. Defaults to compact/usd. */
  format?: (value: number) => string;
}

const AXIS_BAND = 26;
const TOP_PAD = 14;
const LEFT_PAD = 46;
const RIGHT_PAD = 10;

/**
 * Monthly bars -- grouped or stacked.
 *
 * ONE y-axis, always: every series handed to this component must share a
 * unit. Two measures of different scale get two charts, never a second axis.
 */
export function MonthlyBarChart({
  labels,
  series,
  height = 180,
  stacked = false,
  format,
}: ChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  // Any money series makes the whole axis a money axis -- they share one
  // scale, so they share one unit by construction.
  const money = series.some((s) => s.money);
  const fmt = format ?? ((v: number) => (money ? usd(v) : compact(v)));

  const max = stacked
    ? Math.max(
        ...labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)),
        0,
      )
    : Math.max(...series.flatMap((s) => s.values), 0);

  const ticks = ticksFor(max);
  const scaleMax = ticks[ticks.length - 1] || 1;

  const plotW = Math.max(width - LEFT_PAD - RIGHT_PAD, 10);
  const totalH = height + AXIS_BAND + TOP_PAD;
  const bandW = plotW / Math.max(labels.length, 1);
  // 2px surface gap between adjacent bars, per the mark spec.
  const groupW = Math.max(bandW * 0.62, 4);
  const barW = stacked
    ? groupW
    : Math.max((groupW - 2 * (series.length - 1)) / series.length, 2);

  const y = (value: number) => TOP_PAD + height - (value / scaleMax) * height;

  return (
    <div className="relative" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={totalH}
          role="img"
          aria-label={`${series.map((s) => s.label).join(', ')} by month`}
        >
          {/* Gridlines: solid hairlines, recessive. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT_PAD}
                x2={width - RIGHT_PAD}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? VIZ.axis : VIZ.grid}
                strokeWidth={1}
              />
              <text
                x={LEFT_PAD - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={VIZ.textMuted}
              >
                {axisLabel(tick, money)}
              </text>
            </g>
          ))}

          {labels.map((label, i) => {
            const bandX = LEFT_PAD + i * bandW;
            const groupX = bandX + (bandW - groupW) / 2;
            let stackTop = TOP_PAD + height;

            return (
              <g key={label}>
                {/* Hover target spans the whole band, so it is far larger
                    than the marks -- a 2px bar is not a hit target. */}
                <rect
                  x={bandX}
                  y={TOP_PAD}
                  width={bandW}
                  height={height}
                  fill={hover === i ? 'rgba(15,23,42,0.035)' : 'transparent'}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />

                {series.map((s, si) => {
                  const value = s.values[i] ?? 0;
                  const h = max > 0 ? (value / scaleMax) * height : 0;
                  if (stacked) {
                    const top = stackTop - h;
                    stackTop = top - (h > 0 ? 2 : 0);
                    return (
                      <path
                        key={s.key}
                        d={barPath(groupX, top, groupW, h)}
                        fill={VIZ.series[s.color]}
                        pointerEvents="none"
                      />
                    );
                  }
                  return (
                    <path
                      key={s.key}
                      d={barPath(
                        groupX + si * (barW + 2),
                        TOP_PAD + height - h,
                        barW,
                        h,
                      )}
                      fill={VIZ.series[s.color]}
                      pointerEvents="none"
                    />
                  );
                })}

                <text
                  x={bandX + bandW / 2}
                  y={TOP_PAD + height + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill={hover === i ? VIZ.textSecondary : VIZ.textMuted}
                >
                  {monthLabel(label)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {hover !== null && labels.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-border bg-card p-2.5 text-xs shadow-lg"
          style={{
            // Clamped to the container so the tooltip for the first or last
            // month is not half outside the card.
            left: Math.min(
              Math.max(LEFT_PAD + (hover + 0.5) * bandW - 75, 0),
              Math.max(width - 160, 0),
            ),
            top: 0,
          }}
        >
          <div className="mb-1 font-semibold text-foreground">
            {monthLong(labels[hover])}
          </div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: VIZ.series[s.color] }}
                />
                {s.label}
              </span>
              <span className="font-medium text-foreground">
                {s.money ? usd(s.values[hover] ?? 0) : fmt(s.values[hover] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legend. Always present for two or more series; a single series needs none. */
export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <span
          key={s.key}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: VIZ.series[s.color] }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Ranked horizontal bars, for "which feature costs most" style questions.
 *
 * One series, so one colour for every bar -- colouring darker-where-bigger
 * would double-encode the length the bar already shows.
 */
export function RankedBars({
  rows,
  format = compact,
  color = 0,
  emptyLabel = 'No activity in this window.',
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
  color?: number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="group">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-muted-foreground" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {format(row.value)}
              {row.hint && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {row.hint}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                background: VIZ.series[color],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One part-to-whole row, for the current plan mix.
 *
 * A segmented bar rather than a pie: it compares close values honestly, and
 * every segment is directly labelled beneath so identity never rests on
 * colour alone. Capped at the four plan states -- past ~6 segments this form
 * stops working and the numbers belong in a table.
 */
export function SegmentedBar({
  segments,
}: {
  segments: { label: string; value: number; color: number }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-lg">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className="h-full"
                style={{
                  width: `${(s.value / total) * 100}%`,
                  background: VIZ.series[s.color],
                }}
                title={`${s.label}: ${s.value}`}
              />
            ))
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ background: VIZ.series[s.color] }}
            />
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A chart card: title, optional note, the plot, and its legend. */
export function ChartCard({
  title,
  note,
  children,
  action,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}
