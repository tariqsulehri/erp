'use client';

import { useState } from 'react';
import { IconBox, IconCash, IconPlus, IconPrinter, IconReceipt2 } from '@tabler/icons-react';
import { BridgeChart, ChartCard, DonutChart, MonthlyColumnChart, RankedBars, StackedMonthlyChart } from '@/components/analytics/ProCharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { THEMES, useTheme } from '@/lib/theme/theme-provider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { IconButton } from '@/components/ui/IconButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Checkbox, DateInput, Input, NumberInput, Select, Textarea } from '@/components/ui/inputs';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { Toolbar } from '@/components/ui/Toolbar';

/*
 * Design system reference (documents/design/DESIGN_STANDARDS.md, Master Prompt step 7).
 * Every number on this page is SAMPLE DATA for this page only. Real screens never show invented numbers.
 */

const SEMANTIC_TOKENS = [
  'bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-2', 'text-1', 'text-2', 'text-3',
  'accent', 'accent-h', 'accent-soft', 'accent-txt', 'accent-ring', 'brand-accent', 'brand-accent-txt', 'brand-accent-soft',
  'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-target', 'chart-track',
];

const SAMPLE_MONTHS = [
  { monthKey: '2026-05', label: 'May', longLabel: 'May 2026 (sample)', net: 42000, cash: 12000, credit: 30000 },
  { monthKey: '2026-06', label: 'Jun', longLabel: 'June 2026 (sample)', net: 51000, cash: 16000, credit: 35000 },
  { monthKey: '2026-07', label: 'Jul', longLabel: 'July 2026 (sample)', net: 38000, cash: 9000, credit: 29000 },
  { monthKey: '2026-08', label: 'Aug', longLabel: 'August 2026 (sample)', net: 61000, cash: 21000, credit: 40000 },
];

const SAMPLE_ROWS = [
  { code: 'SAMPLE-0003', party: 'Sample Customer C', status: 'Overdue', amount: 1250 },
  { code: 'SAMPLE-0001', party: 'Sample Customer A', status: 'Posted', amount: 8400.5 },
  { code: 'SAMPLE-0002', party: 'Sample Customer B', status: 'Pending Approval', amount: 300 },
];

const money = (value: number) => `Rs ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const axis = (value: number) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}K` : String(value));

function Swatch({ token }: { token: string }) {
  return (
    <div className="ds-swatch">
      <span className="ds-swatch-color" style={{ background: `rgb(var(--${token}))` }} aria-hidden />
      <code>--{token}</code>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, setTheme, vivid, setVivid } = useTheme();
  const chart = useChartTheme();
  const toast = useToast();
  const [tab, setTab] = useState<'one' | 'two'>('one');
  const [segment, setSegment] = useState<'all' | 'open'>('all');
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(true);

  return (
    <main className="page-shell" style={{ overflow: 'auto' }}>
      <PageHeader
        title="Design System"
        description="Tokens, components, and charts in one place. All numbers here are sample data for this page only."
        help={<p>This page shows how every part of the screens looks in the Light and Dark themes. Use it to check a change before building a real screen.</p>}
        actions={(
          <>
            <SegmentedControl
              label="Theme"
              value={theme}
              options={THEMES.map(item => ({ value: item.value, label: `${item.emoji} ${item.label}` }))}
              onChange={setTheme}
            />
            <Button title="Soft depth on cards and meters" onClick={() => setVivid(!vivid)}>{vivid ? 'Vivid Depth: On' : 'Vivid Depth: Off'}</Button>
          </>
        )}
      />

      <InlineAlert tone="info">Sample data: every amount, name and code on this page is made up and appears nowhere else.</InlineAlert>

      <Card
        title="Theme Gallery"
        help="All themes available across the ERP platform. Click any theme to activate it live across all components, sidebars, charts, and tokens."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {THEMES.map(opt => {
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 'var(--radius)',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected ? 'var(--color-surface-alt)' : 'var(--color-surface)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-heading)' }}>
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {opt.preview.map((col, i) => (
                      <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: col, display: 'inline-block' }} />
                    ))}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {opt.desc}
                </p>
                {isSelected && (
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-primary-text)' }}>
                    ✓ Active Theme
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Colour Tokens" help="Semantic tokens from styles/themes/light.css and dark.css. Raw colours live only in brand-palette.css.">
        <div className="ds-swatches">{SEMANTIC_TOKENS.map(token => <Swatch key={token} token={token} />)}</div>
      </Card>

      <Card title="Type" help="Poppins for all text, JetBrains Mono for numbers. Nothing below 12px.">
        <div className="ds-type">
          <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, margin: 0 }}>Page title, Poppins 600</p>
          <p style={{ fontSize: 'var(--font-size-md)', margin: 0 }}>Body text, Poppins 400, 14px.</p>
          <p style={{ fontSize: 'var(--font-size-xs)', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Small label, 12px uppercase</p>
          <p className="tabular-nums" style={{ margin: 0 }}>1,234,567.89 · 0001234 · 27/10/2026 (JetBrains Mono)</p>
        </div>
      </Card>

      <Card title="Buttons, Status, And Feedback" help="One primary action per area. Every icon button has a tooltip.">
        <div className="ds-row">
          <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />}>Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Danger</Button>
          <IconButton icon={<IconPrinter size={16} stroke={1.8} />} label="Print Sample" />
          <HelpButton title="Help Button">A short explanation in plain words.</HelpButton>
        </div>
        <div className="ds-row">
          {['Draft', 'Pending Approval', 'Posted', 'Overdue', 'Open', 'Flagged'].map(status => <StatusChip key={status} status={status} />)}
          <Badge variant="info">Badge</Badge>
        </div>
        <div className="ds-row">
          <Button onClick={() => toast('Sample saved.', 'success')}>Show Toast</Button>
          <Button onClick={() => setModal(true)}>Open Modal</Button>
          <Button onClick={() => setDrawer(true)}>Open Drawer</Button>
        </div>
        <InlineAlert tone="success">Success message.</InlineAlert>
        <InlineAlert tone="warning">Warning message.</InlineAlert>
        <InlineAlert tone="danger">Error message with what to do next.</InlineAlert>
      </Card>

      <Card title="Form Fields" help="Label above the field, required mark, errors under the field.">
        <div className="form-grid">
          <Input label="Customer Name" required value={text} onChange={setText} hint="Shown on invoices." />
          <NumberInput label="Amount" value="1250.00" onChange={() => {}} />
          <DateInput label="Invoice Date" value="2026-10-27" onChange={() => {}} />
          <Select label="Payment Type" value="Cash" onChange={() => {}} options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]} />
          <Input label="Reference" value="" onChange={() => {}} error="Enter a Reference." />
          <div className="span-all"><Textarea label="Notes" value="" onChange={() => {}} /></div>
          <Checkbox label="Send a copy by email" checked={checked} onChange={setChecked} />
        </div>
      </Card>

      <Card title="Navigation" help="Tabs switch views inside a page; the segmented control filters a list.">
        <Tabs label="Sample Tabs" value={tab} onChange={setTab} items={[{ value: 'one', label: 'First Tab' }, { value: 'two', label: 'Second Tab' }]} />
        <div style={{ marginTop: 12 }}><SegmentedControl label="Sample Filter" value={segment} onChange={setSegment} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }]} /></div>
        <div style={{ marginTop: 12 }}><Toolbar end={<Button variant="ghost">Clear Filters</Button>}><Input label="Search" value="" onChange={() => {}} /></Toolbar></div>
      </Card>

      <Card title="Table" padded={false} help="Sortable headers, numbers right-aligned in mono, a bold totals row.">
        <DataTable
          caption="Sample invoices"
          rowKey={row => row.code}
          rows={SAMPLE_ROWS}
          columns={[
            { key: 'code', header: 'Invoice No.', sortable: true, render: row => <span className="code-chip">{row.code}</span> },
            { key: 'party', header: 'Customer', sortable: true },
            { key: 'status', header: 'Status', render: row => <StatusChip status={row.status} /> },
            { key: 'amount', header: 'Amount', numeric: true, sortable: true, render: row => money(row.amount) },
          ]}
          totals={{ party: 'Total', amount: money(SAMPLE_ROWS.reduce((sum, row) => sum + row.amount, 0)) }}
        />
      </Card>

      <Card title="Summary Tiles" help="Label, mono value, change, optional bar, and help on every tile.">
        <StatGrid label="Sample Tiles">
          <StatTile label="Net Sales" tone="blue" icon={<IconReceipt2 />} value="Rs 192,000.00" change={{ percent: 12.4, text: 'Aug vs Jul (sample)' }} help="Sample: total of posted sales." />
          <StatTile label="Cash Received" tone="teal" icon={<IconCash />} value="58%" suffix="/ Rs 112,000" progress={58} help="Sample: share received in cash." />
          <StatTile label="Overdue" tone="rose" icon={<IconBox />} value="Rs 1,250.00" detail="1 invoice past its due date" help="Sample: unpaid after the due date." />
        </StatGrid>
      </Card>

      <div className="analytics-row-main">
        <ChartCard title="Bar With Target" subtitle="Sample monthly totals; the dashed orange line is the average" headline="Sample: August is the highest month." help="Bars compare months. The dashed line is the target or average." table={{ columns: [{ key: 'month', label: 'Month' }, { key: 'net', label: 'Net', numeric: true }], rows: SAMPLE_MONTHS.map(row => ({ month: row.longLabel, net: money(row.net) })) }}>
          <MonthlyColumnChart data={SAMPLE_MONTHS} dataKey="net" seriesName="Net (sample)" average={48000} format={money} axis={axis} tooltipTitle={point => String(point.longLabel)} />
        </ChartCard>
        <ChartCard title="Bridge" subtitle="Sample gross to net" help="Each step adds or takes away from the total." table={{ columns: [{ key: 'step', label: 'Step' }], rows: [] }}>
          <BridgeChart format={money} axis={axis} steps={[{ name: 'Gross', amount: 200000, kind: 'total' }, { name: 'Discount', amount: -12000, kind: 'decrease' }, { name: 'Tax', amount: 18000, kind: 'increase' }, { name: 'Net', amount: 206000, kind: 'total' }]} />
        </ChartCard>
      </div>

      <div className="analytics-row-three">
        <ChartCard title="Stacked Bar" subtitle="Sample cash and credit" legend={[{ name: 'Credit', color: chart.series.blue }, { name: 'Cash', color: chart.series.teal }]} help="Two parts of each month, stacked." table={{ columns: [{ key: 'month', label: 'Month' }], rows: [] }}>
          <StackedMonthlyChart data={SAMPLE_MONTHS} series={[{ key: 'cash', name: 'Cash', color: chart.series.teal }, { key: 'credit', name: 'Credit', color: chart.series.blue }]} format={money} axis={axis} tooltipTitle={point => String(point.longLabel)} />
        </ChartCard>
        <ChartCard title="Ranked Bars" subtitle="Sample top customers" help="Sorted, largest first, with share of the total." table={{ columns: [{ key: 'name', label: 'Customer' }], rows: [] }}>
          <RankedBars total={100} format={value => `${value}%`} items={[{ name: 'Sample Customer A', value: 46 }, { name: 'Sample Customer B', value: 31 }, { name: 'Sample Customer C', value: 23 }]} />
        </ChartCard>
        <ChartCard title="Donut" subtitle="Sample part of a whole (5 slices at most)" help="Use only for up to five parts." table={{ columns: [{ key: 'name', label: 'Status' }], rows: [] }}>
          <DonutChart centerValue="42" centerLabel="sample" format={value => String(value)} items={[{ name: 'Posted', value: 30, color: chart.status.success }, { name: 'Pending', value: 8, color: chart.status.warning }, { name: 'Overdue', value: 4, color: chart.status.danger }]} />
        </ChartCard>
      </div>

      <Card title="Empty And Loading States">
        <div className="ds-row" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: 1 }}><EmptyState title="No Invoices Yet" description="Create the first invoice to see it here." action={<Button variant="primary">New Invoice</Button>} /></div>
          <div style={{ flex: 1, display: 'grid', gap: 8, padding: 16 }} aria-busy="true"><Skeleton width="60%" /><Skeleton /><Skeleton width="80%" /></div>
        </div>
      </Card>

      <Modal open={modal} title="Sample Modal" onClose={() => setModal(false)} footer={<Button variant="primary" onClick={() => setModal(false)}>Close</Button>}>
        <p>A general dialog with a title, content, and a footer.</p>
      </Modal>
      <Drawer open={drawer} title="Sample Drawer" onClose={() => setDrawer(false)}>
        <p>Details or a short form slide in from the right.</p>
      </Drawer>
      <ConfirmDialog open={confirm} title="Delete Sample?" message="This removes the sample. It cannot be undone." confirmLabel="Yes, Delete" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
    </main>
  );
}
