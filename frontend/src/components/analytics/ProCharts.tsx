'use client';

import { useId, useState, type ReactNode } from 'react';
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
  table,
  children,
}: {
  title: string;
  subtitle: string;
  /** The finding in one sentence, e.g. "86% of purchases are on credit." */
  headline?: ReactNode;
  help?: string;
  metric?: { label: string; value: string };
  legend?: LegendItem[];
  table: ChartTable;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-card-head">
        <div className="chart-card-heading">
          <h2 className="chart-card-title">
            {title}
            {help && <span className="stat-tile-help chart-card-help" role="note" tabIndex={0} title={help} aria-label={`About ${title}: ${help}`}>?</span>}
          </h2>
          <div className="chart-card-subtitle">{subtitle}</div>
          {headline && <p className="chart-card-headline">{headline}</p>}
        </div>
        <div className="chart-card-tools">
          {metric && (
            <div className="chart-card-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          )}
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
        </div>
      </div>
      <div className="chart-card-body">
        {showTable ? <ChartDataTable table={table} /> : (
          <>
            {legend && legend.length > 1 && <SeriesLegend items={legend} />}
            {children}
          </>
        )}
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
  const prefix = useGradientPrefix();
  const color = theme.series.blue;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={labelled} margin={{ top: 30, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
        <BarGradientDefs prefix={prefix} colors={[color]} />
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickFormatter={axis} tick={tick} axisLine={false} tickLine={false} width={52} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.6 }} content={<MoneyTooltip title={tooltipTitle} format={format} colors={{ [dataKey]: color }} />} />
        {average !== undefined && average > 0 && (
          <ReferenceLine y={average} stroke={theme.axisText} strokeDasharray="4 4" ifOverflow="extendDomain" />
        )}
        {/* Tube style: each month has a light track to full height, the value fills it from the baseline. */}
        <Bar dataKey={dataKey} name={seriesName} fill={`url(#${gradientId(prefix, color)})`} radius={[6, 6, 6, 6]} maxBarSize={30} background={{ fill: theme.grid, radius: 6 }}>
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
            radius={index === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={30}
            background={index === 0 ? { fill: theme.grid, radius: 6 } : undefined}
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

/** Donut with the total in the middle and a legend of count and share beside it. For part-to-whole with up to 6 parts. */
export function DonutChart({
  items,
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
  const prefix = useGradientPrefix();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <div className="chart-empty">No data yet.</div>;
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
            <BarGradientDefs prefix={prefix} colors={items.map(item => item.color)} />
            <Tooltip content={tooltip} />
            <Pie data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={1} stroke={theme.surface} strokeWidth={2} startAngle={90} endAngle={-270}>
              {items.map(item => <Cell key={item.name} fill={`url(#${gradientId(prefix, item.color)})`} />)}
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
