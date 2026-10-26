'use client';

import { useId, useState, type ReactNode } from 'react';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChartTooltipBox } from './AnalyticsWidgets';
import { barGradientStops, chartAxisTick, useChartTheme } from './chart-palette';

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

/* ── KPI tile ─────────────────────────────────────────────────── */

export type TileTone = 'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'slate';

/** 3D icon badge in the tile's tone. Works inside .kpi-tile and .stat-card.has-tone. */
export function TileIcon({ children }: { children: ReactNode }) {
  return <span className="tile-icon" aria-hidden>{children}</span>;
}

export function KpiTile({
  label,
  value,
  detail,
  change,
  spark,
  meter,
  tone = 'blue',
  icon,
}: {
  /** Colour identity of the tile: icon badge, gradient wash, and edge. */
  tone?: TileTone;
  /** Tabler icon, about 18px. */
  icon?: ReactNode;
  label: string;
  value: string;
  detail?: ReactNode;
  /** Percent change against the previous month; null hides it. */
  change?: { percent: number | null; text: string } | null;
  /** Monthly values for the small trend line. */
  spark?: number[];
  /** Part-to-whole bar under the figure, e.g. Cash and Credit. */
  meter?: Array<{ name: string; value: number; color: string }>;
}) {
  const meterTotal = meter?.reduce((sum, part) => sum + Math.max(part.value, 0), 0) ?? 0;
  return (
    <div className={`kpi-tile tone-${tone}`}>
      {icon && <TileIcon>{icon}</TileIcon>}
      <span className="kpi-tile-label">{label}</span>
      <strong className="kpi-tile-value" title={value}>{value}</strong>
      {spark && spark.length > 1 && <Sparkline values={spark} label={`${label} trend`} />}
      <span className="kpi-tile-detail">
        {change && change.percent !== null && (
          <span className="kpi-delta" title={change.text}>
            {change.percent >= 0
              ? <IconArrowUpRight size={14} stroke={2} aria-hidden />
              : <IconArrowDownRight size={14} stroke={2} aria-hidden />}
            {`${Math.abs(change.percent).toFixed(1)}%`}
          </span>
        )}
        {change && change.percent !== null && <span>{change.text}</span>}
        {detail}
      </span>
      {meter && meterTotal > 0 && (
        <div className="kpi-meter" role="img" aria-label={meter.map(part => `${part.name} ${Math.round(part.value / meterTotal * 100)}%`).join(', ')}>
          {meter.filter(part => part.value > 0).map(part => (
            <span key={part.name} title={`${part.name}: ${Math.round(part.value / meterTotal * 100)}%`} style={{ width: `${part.value / meterTotal * 100}%`, background: part.color }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const theme = useChartTheme();
  const gradientId = useId();
  const width = 92;
  const height = 34;
  const pad = 4;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: pad + index * (width - pad * 2) / (values.length - 1),
    y: pad + (1 - (value - min) / span) * (height - pad * 2),
  }));
  const line = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const area = `${pad},${height - pad} ${line} ${last.x.toFixed(1)},${height - pad}`;
  return (
    <svg className="kpi-tile-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.series.blue} stopOpacity={0.18} />
          <stop offset="100%" stopColor={theme.series.blue} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke={theme.series.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={3.5} fill={theme.series.blue} stroke={theme.surface} strokeWidth={2} />
    </svg>
  );
}

/* ── Chart card with Chart / Table switch ─────────────────────── */

export function ChartCard({
  title,
  subtitle,
  metric,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  metric?: { label: string; value: string };
  legend?: LegendItem[];
  table: ChartTable;
  children: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-card-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="chart-card-title">{title}</h2>
          <div className="chart-card-subtitle">{subtitle}</div>
        </div>
        <div className="chart-card-tools">
          {metric && (
            <div className="chart-card-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          )}
          <SegmentedControl
            label={`${title} View`}
            value={view}
            onChange={setView}
            options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]}
          />
        </div>
      </div>
      {view === 'chart' && legend && legend.length > 1 && <SeriesLegend items={legend} />}
      <div className="chart-card-body">
        {view === 'chart' ? children : <ChartDataTable table={table} />}
      </div>
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

/* ── 3D fills ──────────────────────────────────────────────────── */

/** Per-chart id prefix, so two charts on one page never share gradient ids. */
export function useGradientPrefix() {
  return `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function gradientId(prefix: string, color: string) {
  return `${prefix}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Vertical light-to-deep gradients for the given colours. Place inside a Recharts chart, fill with `url(#…)`. */
export function BarGradientDefs({ prefix, colors }: { prefix: string; colors: string[] }) {
  return (
    <defs>
      {[...new Set(colors)].map(color => (
        <linearGradient key={color} id={gradientId(prefix, color)} x1="0" y1="0" x2="0" y2="1">
          {barGradientStops(color).map(stop => <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
        </linearGradient>
      ))}
    </defs>
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
  /** Swatch colour per data key; the bar fill itself is a gradient reference. */
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
  const prefix = useGradientPrefix();
  const color = theme.series.blue;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={labelled} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <BarGradientDefs prefix={prefix} colors={[color]} />
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={<MoneyTooltip title={tooltipTitle} format={format} colors={{ [dataKey]: color }} />} />
        {average !== undefined && average > 0 && (
          <ReferenceLine y={average} stroke={theme.axisText} strokeDasharray="4 4" ifOverflow="extendDomain" />
        )}
        <Bar dataKey={dataKey} name={seriesName} fill={`url(#${gradientId(prefix, color)})`} radius={[4, 4, 0, 0]} maxBarSize={24}>
          <LabelList dataKey="peakLabel" position="top" offset={8} fontSize={12} fontWeight={600} fill={theme.heading} />
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
  const prefix = useGradientPrefix();
  const colors = Object.fromEntries(series.map(item => [item.key, item.color]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <BarGradientDefs prefix={prefix} colors={series.map(item => item.color)} />
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={<MoneyTooltip title={tooltipTitle} format={format} colors={colors} />} />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            stackId="stack"
            fill={`url(#${gradientId(prefix, item.color)})`}
            stroke={theme.surface}
            strokeWidth={2}
            radius={index === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={24}
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
  const prefix = useGradientPrefix();
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
        <BarGradientDefs prefix={prefix} colors={[theme.series.blue, theme.series.amber, theme.series.teal]} />
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval={0} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={tooltip} />
        <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="size" stackId="bridge" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map(step => <Cell key={step.name} fill={`url(#${gradientId(prefix, colorFor(step.kind))})`} />)}
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
  color: string;
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
                <span className="fill" style={{ display: 'block', width: `${Math.max(item.value / max * 100, 1)}%`, background: `linear-gradient(180deg, ${barGradientStops(color).map(stop => `${stop.color} ${stop.offset}`).join(', ')})` }} />
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
