'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { IconChartBar, IconDownload, IconTable } from '@tabler/icons-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipBox } from './AnalyticsWidgets';
import { HelpButton } from '@/components/ui/HelpButton';
import { chartAxisTick, useChartTheme } from '@/hooks/useChartTheme';

/*
 * Shared analytics charts. Rules followed by every chart here:
 * one value axis, bars at most 24px wide with a 4px rounded end, hairline solid grid,
 * text in text colours (never the series colour), a legend whenever there are two or more series,
 * and a Table view on every card so no value is reachable only by hovering.
 */

type Format = (value: number) => string;

export interface ChartTableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ChartTable {
  columns: ChartTableColumn[];
  rows: Array<Record<string, string>>;
}

export interface LegendItem {
  name: string;
  color: string;
  /** Draw the key as a dashed rule (for reference lines such as Average). */
  line?: boolean;
}

/* ── Chart card ────────────────────────────────────────────────── */

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Saves the card's table as a CSV file. */
function downloadTable(title: string, table: ChartTable) {
  const lines = [
    table.columns.map(column => csvCell(column.label)).join(','),
    ...table.rows.map(row => table.columns.map(column => csvCell(row[column.key] ?? '')).join(',')),
  ];
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'chart'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Chart card: title with a "?" explanation, one-line subtitle, a bold headline that states the finding,
 * and icon buttons to switch to the table view or download the table. Every chart keeps a Table view.
 */
export function ChartCard({
  title,
  subtitle,
  headline,
  help,
  metric,
  legend,
  pillSwitch,
  footerNote,
  style,
  bodyStyle,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  /** The finding in one sentence, e.g. "86% of purchases are on credit." */
  headline?: ReactNode;
  help?: ReactNode;
  metric?: { label: string; value: string };
  legend?: LegendItem[];
  pillSwitch?: ReactNode;
  footerNote?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  table?: ChartTable;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="chart-card" aria-label={title} style={style}>
      <div className="chart-card-head">
        <div className="chart-card-heading">
          <h2 className="chart-card-title">
            {title}
            {help && <HelpButton title={title} size="sm">{help}</HelpButton>}
          </h2>
          <div className="chart-card-subtitle">{subtitle}</div>
          {headline && <p className="chart-card-headline">{headline}</p>}
        </div>
        <div className="chart-card-tools">
          {pillSwitch}
          {metric && (
            <div className="chart-card-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          )}
          {table && (
            <>
              <button
                type="button"
                className="chart-card-tool"
                aria-pressed={showTable}
                aria-label={showTable ? `Show ${title} Chart` : `Show ${title} Table`}
                title={showTable ? 'Show Chart' : 'Show Table'}
                onClick={() => setShowTable(value => !value)}
              >
                {showTable ? <IconChartBar size={16} stroke={1.8} aria-hidden /> : <IconTable size={16} stroke={1.8} aria-hidden />}
              </button>
              <button
                type="button"
                className="chart-card-tool"
                aria-label={`Download ${title} As CSV`}
                title="Download CSV"
                disabled={table.rows.length === 0}
                onClick={() => downloadTable(title, table)}
              >
                <IconDownload size={16} stroke={1.8} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="chart-card-body" style={bodyStyle}>
        {showTable && table ? <ChartDataTable table={table} /> : (
          <>
            {legend && legend.length > 1 && <SeriesLegend items={legend} />}
            {children}
          </>
        )}
      </div>
      {footerNote && <div className="chart-card-foot">{footerNote}</div>}
    </section>
  );
}

export function SeriesLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="series-legend">
      {items.map(item => (
        <li key={item.name}>
          <span aria-hidden className={item.line ? 'swatch swatch-line' : 'swatch'} style={item.line ? undefined : { background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function ChartDataTable({ table }: { table: ChartTable }) {
  if (table.rows.length === 0) return <div className="chart-empty">No data for the selected filters.</div>;
  return (
    <div className="chart-card-table">
      <table className="data-table">
        <thead>
          <tr>
            {table.columns.map(column => <th key={column.key} className={column.numeric ? 'num' : undefined}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {table.columns.map(column => <td key={column.key} className={column.numeric ? 'num' : undefined}>{row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Charts ───────────────────────────────────────────────────── */

export interface MonthPoint {
  monthKey: string;
  label: string;
  [key: string]: string | number;
}

function MoneyTooltip({ active, payload, title, format, colors }: {
  active?: boolean;
  payload?: any[];
  title: (point: any) => string;
  format: Format;
  /** Swatch colour per data key. */
  colors: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <ChartTooltipBox
      label={title(point)}
      entries={[...payload].reverse().map(entry => ({
        key: String(entry.dataKey),
        name: String(entry.name),
        color: colors[String(entry.dataKey)],
        value: format(Number(entry.value)),
      }))}
    />
  );
}

/** Dark value pill above a column, drawn only where the data row carries text in the label key. */
function pillLabel(theme: ReturnType<typeof useChartTheme>) {
  return function PillLabel(props: any) {
    const text = String(props.value ?? '');
    if (!text) return null;
    const width = text.length * 7 + 14;
    const cx = Number(props.x) + Number(props.width) / 2;
    const top = Number(props.y) - 24;
    return (
      <g>
        <rect x={cx - width / 2} y={top} width={width} height={19} rx={9.5} fill={theme.heading} />
        <text x={cx} y={top + 13} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="var(--font-code)" fill={theme.surface}>{text}</text>
      </g>
    );
  };
}

/** Monthly columns for one measure, with the average as a reference line and the peak month labelled. */
export function MonthlyColumnChart({
  data,
  dataKey,
  seriesName,
  average,
  format,
  axis,
  tooltipTitle,
  height = 250,
}: {
  data: MonthPoint[];
  dataKey: string;
  seriesName: string;
  average?: number;
  format: Format;
  axis: Format;
  tooltipTitle: (point: MonthPoint) => string;
  height?: number;
}) {
  const theme = useChartTheme();
  const tick = chartAxisTick(theme);
  // Only the peak month carries a label, so the chart names its extreme without a number on every column.
  const peakIndex = data.reduce((best, point, index) => (Number(point[dataKey]) > Number(data[best]?.[dataKey] ?? -Infinity) ? index : best), 0);
  const labelled = data.map((point, index) => ({ ...point, peakLabel: index === peakIndex && Number(point[dataKey]) > 0 ? axis(Number(point[dataKey])) : '' }));
  const color = theme.series.blue;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={labelled} margin={{ top: 30, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={<MoneyTooltip title={tooltipTitle} format={format} colors={{ [dataKey]: color }} />} />
        {average !== undefined && average > 0 && (
          <ReferenceLine y={average} stroke={theme.target} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" />
        )}
        {/* Flat bar with 4px rounded top on a feather track (standards section 8). */}
        <Bar dataKey={dataKey} name={seriesName} fill={color} radius={[4, 4, 0, 0]} maxBarSize={30} background={{ fill: theme.track, radius: 4 }}>
          <LabelList dataKey="peakLabel" content={pillLabel(theme)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Monthly stacked columns (e.g. Cash and Credit) on one axis, segments split by a 2px surface gap. */
export function StackedMonthlyChart({
  data,
  series,
  format,
  axis,
  tooltipTitle,
  height = 230,
}: {
  data: MonthPoint[];
  series: Array<{ key: string; name: string; color: string }>;
  format: Format;
  axis: Format;
  tooltipTitle: (point: MonthPoint) => string;
  height?: number;
}) {
  const theme = useChartTheme();
  const tick = chartAxisTick(theme);
  const colors = Object.fromEntries(series.map(item => [item.key, item.color]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={<MoneyTooltip title={tooltipTitle} format={format} colors={colors} />} />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            stackId="stack"
            fill={item.color}
            stroke={theme.surface}
            strokeWidth={2}
            radius={index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={30}
            background={index === 0 ? { fill: theme.track, radius: 4 } : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface BridgeStep {
  name: string;
  /** Signed amount: positive adds, negative reduces. Totals carry the running total. */
  amount: number;
  kind: 'total' | 'increase' | 'decrease';
}

/** Gross-to-net bridge: each step floats from the running total, totals stand on the baseline. */
export function BridgeChart({ steps, format, axis, height = 250 }: { steps: BridgeStep[]; format: Format; axis: Format; height?: number }) {
  const theme = useChartTheme();
  const tick = chartAxisTick(theme);
  let running = 0;
  const data = steps.map(step => {
    if (step.kind === 'total') {
      running = step.amount;
      return { ...step, base: 0, size: Math.abs(step.amount), valueLabel: axis(step.amount) };
    }
    const start = running;
    running += step.amount;
    const valueLabel = step.amount === 0 ? '' : `${step.amount > 0 ? '+' : '−'}${axis(Math.abs(step.amount))}`;
    return { ...step, base: Math.min(start, running), size: Math.abs(step.amount), valueLabel };
  });
  const colorFor = (kind: BridgeStep['kind']) => (kind === 'total' ? theme.series.blue : kind === 'increase' ? theme.series.amber : theme.series.teal);
  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const step = payload[0].payload as BridgeStep;
    return (
      <ChartTooltipBox
        label={step.name}
        entries={[{ key: step.name, name: step.kind === 'total' ? 'Total' : step.kind === 'increase' ? 'Adds' : 'Reduces', color: colorFor(step.kind), value: format(step.amount) }]}
      />
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval={0} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={tooltip} />
        <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="size" stackId="bridge" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map(step => <Cell key={step.name} fill={colorFor(step.kind)} />)}
          <LabelList dataKey="valueLabel" position="top" offset={8} fontSize={12} fontWeight={600} fill={theme.heading} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranked horizontal bars with the name, amount, and share of the total. Reads well for 1 to 8 rows. */
export function RankedBars({
  items,
  total,
  format,
  color,
  limit = 6,
  countLabel,
}: {
  items: Array<{ name: string; value: number; count?: number }>;
  total: number;
  format: Format;
  /** Bar colour; omit for the standard meter fill (accent, or the vivid gradient). */
  color?: string;
  limit?: number;
  countLabel?: (count: number) => string;
}) {
  if (items.length === 0) return <div className="chart-empty">No data for the selected filters.</div>;
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map(item => item.value), 0) || 1;
  const rest = items.slice(limit);
  const restValue = rest.reduce((sum, item) => sum + item.value, 0);
  return (
    <>
      <ol className="ranked-bars">
        {shown.map(item => {
          const share = total > 0 ? item.value / total * 100 : 0;
          const tip = `${item.name}: ${format(item.value)} (${share.toFixed(1)}%)${item.count !== undefined && countLabel ? ` · ${countLabel(item.count)}` : ''}`;
          return (
            <li key={item.name} title={tip}>
              <span className="name">{item.name}</span>
              <span className="value">{format(item.value)}<small>{share.toFixed(1)}%</small></span>
              <span className="track" aria-hidden>
                <span className="fill" style={{ display: 'block', width: `${Math.max(item.value / max * 100, 1)}%`, background: color ?? 'var(--meter-fill)' }} />
              </span>
            </li>
          );
        })}
      </ol>
      {rest.length > 0 && (
        <div className="ranked-bars-more">{`${rest.length} more: ${format(restValue)} (${(total > 0 ? restValue / total * 100 : 0).toFixed(1)}%)`}</div>
      )}
    </>
  );
}

/** Donut with the total in the middle and a legend of value and share beside it. Up to 5 slices; more are grouped as Other. */
export function DonutChart({
  items: allItems,
  centerValue,
  centerLabel,
  format,
}: {
  items: Array<{ name: string; value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
  format: Format;
}) {
  const theme = useChartTheme();
  // At most 5 slices (standards section 8): the four largest stay, the rest join "Other".
  const sorted = [...allItems].sort((left, right) => right.value - left.value);
  const items = sorted.length <= 5 ? allItems : [
    ...sorted.slice(0, 4),
    { name: 'Other', value: sorted.slice(4).reduce((sum, item) => sum + item.value, 0), color: theme.series.slate },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <div className="chart-empty">No data</div>;
  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload as { name: string; value: number; color: string };
    return <ChartTooltipBox entries={[{ key: item.name, name: item.name, color: item.color, value: `${format(item.value)} (${(item.value / total * 100).toFixed(0)}%)` }]} />;
  };
  return (
    <div className="donut-layout">
      <div className="donut-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={tooltip} />
            <Pie data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={1} stroke={theme.surface} strokeWidth={2} startAngle={90} endAngle={-270}>
              {items.map(item => <Cell key={item.name} fill={item.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden>
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <table className="donut-legend">
        <tbody>
          {items.map(item => (
            <tr key={item.name}>
              <td><span className="swatch" style={{ background: item.color }} aria-hidden />{item.name}</td>
              <td className="num">{format(item.value)}</td>
              <td className="num">{`${(item.value / total * 100).toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Modern 3D Data Visualizations ────────────────────────────── */

export interface PipelineDonutItem {
  name: string;
  count: number;
  share: number;
  color: string;
  gradient?: [string, string];
}

/** 3D Gradient Donut with center total and clean tabular legend */
export function PipelineDonutChart({
  items,
  totalCount,
  totalLabel,
}: {
  items: PipelineDonutItem[];
  totalCount: number | string;
  totalLabel: string;
}) {
  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((sum, item) => sum + item.count, 0);

  let accumulatedPercent = 0;
  const segments = items.map((item, idx) => {
    const pct = total > 0 ? (item.count / total) * 100 : item.share;
    const gap = pct > 2 && items.length > 1 ? 1.2 : 0;
    const effectivePct = Math.max(0, pct - gap);
    const strokeDash = (effectivePct / 100) * circumference;
    const strokeOffset = -((accumulatedPercent + gap / 2) / 100) * circumference;
    accumulatedPercent += pct;

    const gradId = `donut-grad-${idx}`;
    const gradStart = item.gradient ? item.gradient[0] : item.color;
    const gradEnd = item.gradient ? item.gradient[1] : item.color;

    return {
      ...item,
      gradId,
      gradStart,
      gradEnd,
      strokeDash,
      strokeOffset,
      hasValue: item.count > 0,
    };
  });

  return (
    <div className="pipeline-donut-layout">
      <div className="pipeline-donut-plot">
        <svg viewBox="0 0 200 200" className="pipeline-donut-svg">
          <defs>
            <filter id="pipeline-3d-shadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
            {segments.map(seg => (
              <linearGradient key={seg.gradId} id={seg.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={seg.gradStart} />
                <stop offset="100%" stopColor={seg.gradEnd} />
              </linearGradient>
            ))}
          </defs>

          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-surface-alt, #f1f5f9)"
            strokeWidth={strokeWidth}
          />

          {segments.map(seg => {
            if (!seg.hasValue || seg.strokeDash <= 0) return null;
            return (
              <circle
                key={seg.name}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={`url(#${seg.gradId})`}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.strokeDash} ${circumference - seg.strokeDash}`}
                strokeDashoffset={seg.strokeOffset}
                strokeLinecap="round"
                filter="url(#pipeline-3d-shadow)"
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
              />
            );
          })}
        </svg>

        <div className="pipeline-donut-center" aria-hidden="true">
          <strong>{totalCount}</strong>
          <span>{totalLabel}</span>
        </div>
      </div>

      <table className="pipeline-legend-table">
        <tbody>
          {items.map(item => (
            <tr key={item.name} className="pipeline-legend-row">
              <td className="pipeline-legend-label">
                <span
                  className="pipeline-dot"
                  style={{
                    background: item.gradient
                      ? `linear-gradient(135deg, ${item.gradient[0]}, ${item.gradient[1]})`
                      : item.color,
                  }}
                  aria-hidden="true"
                />
                <span>{item.name}</span>
              </td>
              <td className="pipeline-legend-count">{item.count}</td>
              <td className="pipeline-legend-share">{item.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TargetBenchmarkRow {
  name: string;
  subtitle?: string;
  achievedPercent: number;
  targetPercent: number;
  variancePoints: number;
  gradient?: [string, string];
}

/** Horizontal bullet / target progress bars with target ticks and variance badges */
export function TargetBenchmarkBars({
  rows,
}: {
  rows: TargetBenchmarkRow[];
}) {
  return (
    <div className="target-benchmark-container">
      {rows.map((row, idx) => {
        const isLast = idx === rows.length - 1;
        const isNeg = row.variancePoints < 0;
        const varianceText = `${row.variancePoints > 0 ? '+' : ''}${row.variancePoints.toFixed(1)} pts`;
        const gradient = row.gradient
          ? `linear-gradient(90deg, ${row.gradient[0]} 0%, ${row.gradient[1]} 100%)`
          : 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%)';
        const fillWidth = Math.max(0, Math.min(100, row.achievedPercent));
        const tickLeft = Math.max(0, Math.min(100, row.targetPercent));

        return (
          <div key={row.name} className="target-benchmark-item">
            <div className="target-benchmark-head">
              <div>
                <span className="target-benchmark-title">{row.name}</span>
                {row.subtitle && <span className="target-benchmark-subtitle"> · {row.subtitle}</span>}
              </div>
              <div className="target-benchmark-meta">
                <span className="target-benchmark-values">
                  {row.achievedPercent.toFixed(1)}% / {row.targetPercent.toFixed(1)}%
                </span>
                <span className={`target-variance-pill ${isNeg ? 'target-variance-neg' : 'target-variance-pos'}`}>
                  {varianceText}
                </span>
              </div>
            </div>

            <div className="target-track-wrapper">
              <div
                className="target-track-fill"
                style={{ width: `${fillWidth}%`, background: gradient }}
              />
              <div
                className="target-track-tick"
                style={{ left: `${tickLeft}%` }}
                title={`Target: ${row.targetPercent.toFixed(1)}%`}
              />
            </div>

            {isLast && (
              <div className="target-scale-axis">
                <span>0%</span>
                <span style={{ transform: 'translateX(-50%)' }}>50%</span>
                <span>100%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface CapsuleBenchmarkPillar {
  count: number;
  countUnit?: string;
  fillPercent: number;
  badgeLabel: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
}

/** 3D liquid capsule benchmark columns with internal floating pill badges */
export function CapsuleBenchmarkChart({
  pillars,
  axisLeft = 'Further from target',
  axisRight = 'Closer to target',
  summaryNote,
}: {
  pillars: CapsuleBenchmarkPillar[];
  axisLeft?: string;
  axisRight?: string;
  summaryNote?: ReactNode;
}) {
  return (
    <div className="capsule-benchmark-wrapper">
      <div className="capsule-benchmark-grid">
        {pillars.map(pillar => {
          const clamped = Math.max(0, Math.min(100, pillar.fillPercent));
          const heightPct = Math.max(clamped, 14);
          const grad = `linear-gradient(180deg, ${pillar.gradient[0]} 0%, ${pillar.gradient[1]} 100%)`;

          return (
            <div key={pillar.title} className="capsule-pillar-col">
              <div className="capsule-top-count">
                {pillar.count}
                <span className="capsule-top-unit">{pillar.countUnit || 'accounts'}</span>
              </div>

              <div className="capsule-track">
                <div
                  className="capsule-liquid"
                  style={{ height: `${heightPct}%`, background: grad }}
                >
                  <div className="capsule-badge">{pillar.badgeLabel}</div>
                </div>
              </div>

              <div className="capsule-pillar-info">
                <div className="capsule-pillar-title">{pillar.title}</div>
                <div className="capsule-pillar-sub">{pillar.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="capsule-axis-indicator">
          <span>← {axisLeft}</span>
          <span>{axisRight} →</span>
        </div>
        {summaryNote && (
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {summaryNote}
          </div>
        )}
      </div>
    </div>
  );
}

export interface GradePillarItem {
  id: string;
  count: number;
  countUnit?: string;
  percentage: number;
  label: string;
  subLabel: string;
  gradient?: [string, string];
}

/** Categorical 3D liquid capsule pillars across classifications/grades */
export function CategoryGradePillars({
  items,
  axisLeft = 'Junior',
  axisRight = 'Senior',
  summaryNote,
}: {
  items: GradePillarItem[];
  axisLeft?: string;
  axisRight?: string;
  summaryNote?: ReactNode;
}) {
  return (
    <div className="capsule-benchmark-wrapper">
      <div className="grade-pillars-grid">
        {items.map(item => {
          const clamped = Math.max(0, Math.min(100, item.percentage));
          const heightPct = Math.max(clamped, 14);
          const grad = item.gradient
            ? `linear-gradient(180deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
            : 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)';

          return (
            <div key={item.id} className="grade-pillar-col">
              <div className="grade-top-count">
                {item.count}
                <span className="grade-top-unit">{item.countUnit || 'accounts'}</span>
              </div>

              <div className="grade-track">
                <div
                  className="grade-liquid"
                  style={{ height: `${heightPct}%`, background: grad }}
                >
                  <div className="grade-badge">{item.percentage}%</div>
                </div>
              </div>

              <div className="grade-bottom-label">
                <div className="grade-id-badge">{item.label}</div>
                <div className="grade-sub-text" title={item.subLabel}>
                  {item.subLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="capsule-axis-indicator">
          <span>← {axisLeft}</span>
          <span>{axisRight} →</span>
        </div>
        {summaryNote && (
          <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {summaryNote}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── High-fidelity Calibr / 3D Pipeline & Funnel components ──────── */

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
  maxCount: number;
  percentage: number;
  delta?: number;
}

export function PromotionFunnelChart({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="funnel-container">
      {steps.map(step => {
        const pct = step.maxCount > 0 ? Math.min(100, Math.max(0, (step.count / step.maxCount) * 100)) : 0;
        return (
          <div key={step.id} className="funnel-row">
            <span className="funnel-label" title={step.label}>{step.label}</span>
            <div className="funnel-track">
              {step.count > 0 ? (
                <div
                  className="funnel-fill-3d"
                  style={{ width: `${Math.max(pct, 12)}%` }}
                >
                  <span className="funnel-fill-count">{step.count}</span>
                </div>
              ) : (
                <div className="funnel-fill-empty" />
              )}
            </div>
            <div className="funnel-stat">
              <span className="funnel-pct">{step.percentage}%</span>
              {step.delta !== undefined && step.delta !== 0 && (
                <span className="funnel-delta">{step.delta > 0 ? `+${step.delta}` : step.delta}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface GapSpreadColumn {
  id: string;
  label: string;
  count: number;
  maxCount: number;
  gradient: [string, string];
}

export function GapSpreadPillars({ columns }: { columns: GapSpreadColumn[] }) {
  const max = Math.max(...columns.map(c => c.count), 1);
  return (
    <div className="gap-spread-container">
      <div className="gap-spread-grid">
        {columns.map(col => {
          const heightPct = col.count > 0 ? Math.max(12, Math.round((col.count / max) * 100)) : 0;
          return (
            <div key={col.id} className="gap-spread-col">
              <span className="gap-spread-count">{col.count}</span>
              <div className="gap-spread-track">
                {col.count > 0 && (
                  <div
                    className="gap-spread-pillar-3d"
                    style={{
                      height: `${heightPct}%`,
                      background: `linear-gradient(180deg, ${col.gradient[0]} 0%, ${col.gradient[1]} 100%)`,
                    }}
                  />
                )}
              </div>
              <span className="gap-spread-label">{col.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ShortfallRow {
  id: string;
  label: string;
  belowCount: number;
  metCount: number;
  notAssessedCount: number;
  shortfallBadge: string;
  deficitPct: number;
  metPct: number;
}

export function CategoryShortfallList({ rows }: { rows: ShortfallRow[] }) {
  return (
    <div className="shortfall-list">
      <div className="shortfall-header">
        <span className="shortfall-col-title">Skill / Category</span>
        <div className="shortfall-header-counts">
          <span>Below</span>
          <span>Met</span>
          <span>Unposted</span>
          <span>Deficit</span>
        </div>
      </div>
      {rows.map(row => (
        <div key={row.id} className="shortfall-row">
          <span className="shortfall-name" title={row.label}>{row.label}</span>
          <div className="shortfall-bar-track">
            <div
              className="shortfall-bar-deficit"
              style={{ width: `${Math.min(row.deficitPct, 100)}%` }}
            />
            <div
              className="shortfall-bar-met"
              style={{ width: `${Math.min(row.metPct, 100)}%` }}
            />
          </div>
          <div className="shortfall-counts">
            <span className="shortfall-num-below">{row.belowCount}</span>
            <span className="shortfall-num-met">{row.metCount}</span>
            <span className="shortfall-num-unposted">{row.notAssessedCount}</span>
            <span className="shortfall-badge">{row.shortfallBadge}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusNextInLineCards({
  readyCount,
  readyLabel,
  pendingCount,
  pendingLabel,
  checklist,
}: {
  readyCount: number;
  readyLabel: string;
  pendingCount: number;
  pendingLabel: string;
  checklist: Array<{ label: string; count: number; met: boolean }>;
}) {
  return (
    <div className="next-in-line-container">
      <div className="next-in-line-tiles">
        <div className="next-tile ready-tile">
          <span className="next-tile-num">{readyCount}</span>
          <span className="next-tile-label">{readyLabel}</span>
        </div>
        <div className="next-tile pending-tile">
          <span className="next-tile-num">{pendingCount}</span>
          <span className="next-tile-label">{pendingLabel}</span>
        </div>
      </div>
      <div className="next-in-line-checklist">
        {checklist.map((item, idx) => (
          <div key={idx} className="checklist-row">
            <span className="checklist-label">{item.label}</span>
            <div className="checklist-track">
              <div
                className={`checklist-fill ${item.met ? 'is-met' : 'is-pending'}`}
                style={{ width: `${item.met ? 100 : 35}%` }}
              />
            </div>
            <span className="checklist-count">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface TargetScaleRow {
  id: string;
  label: string;
  actualPct: number;
  targetPct: number;
  peopleCount: number;
}

export function TargetGapScale({ rows }: { rows: TargetScaleRow[] }) {
  return (
    <div className="target-gap-scale-container">
      {rows.map(row => {
        const left = Math.min(row.actualPct, row.targetPct);
        const right = Math.max(row.actualPct, row.targetPct);
        const width = right - left;
        return (
          <div key={row.id} className="target-gap-row">
            <span className="target-gap-label">{row.label}</span>
            <div className="target-gap-track">
              <div
                className="target-gap-line"
                style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
              />
              <div
                className="target-gap-dot"
                style={{ left: `${row.actualPct}%` }}
                title={`Actual: ${row.actualPct}%`}
              />
              <div
                className="target-gap-ring"
                style={{ left: `${row.targetPct}%` }}
                title={`Target: ${row.targetPct}%`}
              />
            </div>
            <div className="target-gap-stats">
              <span className="target-gap-actual">{row.actualPct}%</span>
              <span className="target-gap-sep">/</span>
              <span className="target-gap-target">{row.targetPct}%</span>
              <span className="target-gap-people">· {row.peopleCount} vouchers</span>
            </div>
          </div>
        );
      })}
      <div className="target-gap-legend">
        <span>0%</span>
        <span>45%</span>
        <span>90%</span>
      </div>
    </div>
  );
}

