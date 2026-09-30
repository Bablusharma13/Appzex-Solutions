'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

/**
 * Chart palette: categorical slots 1-3 of the validated reference palette.
 * These three pass all-pairs CVD separation; slot 3 is below 3:1 contrast on
 * white, so every chart pairs color with visible labels (legend with counts).
 * Colors are bound to meaning so they stay stable across charts:
 *   in flight (active / in progress) = slot 1, waiting (on hold / to do) = slot 2,
 *   done (completed) = slot 3.
 */
export const CHART_COLORS = {
  inFlight: '#2a78d6',
  waiting: '#eb6834',
  done: '#1baf7a',
  grid: '#e2e8f0',
  axisText: '#64748b',
  labelText: '#334155',
} as const;

/** Fixed categorical order for nominal series (e.g. plans); never cycled. */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a'] as const;

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Part-to-whole in a single horizontal stacked bar with a counted legend. */
export function SegmentedBar({ segments, label, emptyText = 'No data yet' }: { segments: Segment[]; label: string; emptyText?: string }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const percentOf = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  // Center of the hovered segment, for the tooltip position
  let offset = 0;
  const positions = new Map<string, number>();
  for (const segment of visible) {
    const width = (segment.value / total) * 100;
    positions.set(segment.key, offset + width / 2);
    offset += width;
  }
  const active = visible.find((segment) => segment.key === activeKey);

  return (
    <div>
      <div className="relative pt-1">
        {total === 0 ? (
          <div className="h-3 w-full rounded bg-slate-100" aria-label={`${label}: ${emptyText}`} role="img" />
        ) : (
          <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
            {visible.map((segment, index) => (
              <div
                key={segment.key}
                tabIndex={0}
                aria-label={`${segment.label}: ${segment.value} (${percentOf(segment.value)}%)`}
                onMouseEnter={() => setActiveKey(segment.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(segment.key)}
                onBlur={() => setActiveKey(null)}
                className={cn(
                  'h-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  index === 0 && 'rounded-l',
                  index === visible.length - 1 && 'rounded-r',
                  activeKey && activeKey !== segment.key && 'opacity-50',
                )}
                style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
              />
            ))}
          </div>
        )}
        {active && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${positions.get(active.key)}%` }}
            role="tooltip"
          >
            <span className="font-semibold text-foreground">{active.value}</span>{' '}
            <span className="text-muted-foreground">
              {active.label} · {percentOf(active.value)}%
            </span>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} aria-hidden />
            <span className="flex-1 text-slate-600">{segment.label}</span>
            <span className="font-medium tabular-nums text-foreground">{segment.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{percentOf(segment.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ProgressDatum {
  id: string;
  name: string;
  clientName: string;
  percent: number;
  completedTasks: number;
  totalTasks: number;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Single-line category label (Recharts would otherwise wrap long names). */
function CategoryTick({ x, y, payload, maxChars }: { x?: number | string; y?: number | string; payload?: { value: string }; maxChars: number }) {
  const value = payload?.value ?? '';
  return (
    <text x={Number(x)} y={Number(y)} dy={4} textAnchor="end" fill={CHART_COLORS.labelText} fontSize={12}>
      <title>{value}</title>
      {truncate(value, maxChars)}
    </text>
  );
}

/**
 * Completion by project: one series, one color. Values are labeled at the bar
 * tips (the tooltip only adds task counts), so nothing is gated behind hover.
 */
export function ProjectProgressChart({ data, onSelect }: { data: ProgressDatum[]; onSelect?: (id: string) => void }) {
  const wide = useMediaQuery('(min-width: 640px)');
  const axisWidth = wide ? 150 : 92;
  const maxChars = wide ? 22 : 12;
  const height = data.length * 48 + 36;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={16}>
          <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={axisWidth}
            tickLine={false}
            axisLine={false}
            tick={(props: { x?: number | string; y?: number | string; payload?: { value: string } }) => <CategoryTick {...props} maxChars={maxChars} />}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as ProgressDatum | undefined;
              if (!active || !datum) return null;
              return (
                <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
                  <p className="text-sm font-semibold text-foreground">{datum.percent}%</p>
                  <p className="font-medium text-foreground">{datum.name}</p>
                  <p className="text-muted-foreground">
                    {datum.clientName} · {datum.completedTasks} of {datum.totalTasks} tasks
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="percent"
            fill={CHART_COLORS.inFlight}
            barSize={12}
            radius={[0, 4, 4, 0]}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={(entry) => {
              const id = (entry as { payload?: ProgressDatum }).payload?.id;
              if (id) onSelect?.(id);
            }}
            isAnimationActive={false}
          >
            <LabelList dataKey="percent" position="right" formatter={(value) => `${String(value)}%`} fill={CHART_COLORS.labelText} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
