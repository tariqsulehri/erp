'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconBroadcast, IconCalendarStats, IconCalendarTime, IconHistory } from '@tabler/icons-react';
import { fiscalYearsQueryKey, useFiscalYearsList, type FiscalYearItem } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatCount, formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { Tabs } from '@/components/ui/Tabs';
import { CreateFiscalYearDialog } from '@/components/fiscal-years/CreateFiscalYearDialog';
import { FiscalYearsTable } from '@/components/fiscal-years/FiscalYearsTable';
import { YearClosingTab } from '@/components/fiscal-years/YearClosingTab';
import { statusLabel, summarizeFiscalYears } from '@/components/fiscal-years/fiscal-year-rules';

type FiscalYearTab = 'years' | 'closing';

const FISCAL_YEAR_TABS: Array<{ value: FiscalYearTab; label: string }> = [
  { value: 'years',   label: 'Fiscal Years' },
  { value: 'closing', label: 'Year Closing' },
];

export default function FiscalYearPage() {
  const [activeTab, setActiveTab] = useState<FiscalYearTab>('years');
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFiscalYearsList({ page: 1, limit: 50 });
  const { data: settings } = useGeneralSettings();
  const years: FiscalYearItem[] = data?.data ?? [];
  const summary = summarizeFiscalYears(years);
  const currentYear = summary.active ?? years.find(year => year.status !== 'closed') ?? years[0];
  const refresh = () => queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });

  return (
    <main className="page-shell">
      <ScreenHeader
        icon={<IconCalendarStats size={22} stroke={1.8} />}
        title="Fiscal Years"
        badge={<Badge variant="info">Accounting Calendar</Badge>}
        description="Accounting years and their periods. A voucher can be posted only into an open period of an open year."
      />

      {error && <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Unable to load Fiscal Years.')}</InlineAlert>}
      {notice && <InlineAlert tone="success" onDismiss={() => setNotice('')}>{notice}</InlineAlert>}

      <div className="summary-grid">
        <SummaryCard
          tone="blue"
          icon={<IconBroadcast size={20} stroke={1.8} />}
          label="Active Fiscal Year"
          value={summary.active ? summary.active.fiscal_year : 'None'}
          detail={summary.active
            ? `${formatDate(summary.active.start_date, settings)} – ${formatDate(summary.active.end_date, settings)} · ${statusLabel(summary.active.status)} for posting`
            : 'Create a Fiscal Year to start posting'}
        />
        <SummaryCard
          tone="amber"
          icon={<IconCalendarTime size={20} stroke={1.8} />}
          label="Total Fiscal Years"
          value={`${formatCount(summary.total, settings)} Configured`}
          detail={`${formatCount(summary.open, settings)} open · ${formatCount(summary.locked, settings)} locked · ${formatCount(summary.closed, settings)} closed`}
        />
        <SummaryCard
          tone="teal"
          icon={<IconHistory size={20} stroke={1.8} />}
          label="Calendar Years Covered"
          value={`${formatCount(summary.calendarYears.length, settings)} ${summary.calendarYears.length === 1 ? 'Year' : 'Years'}`}
          detail={summary.calendarYears.length ? summary.calendarYears.join(', ') : 'No years yet'}
        />
      </div>

      <Tabs label="Fiscal Year Sections" value={activeTab} onChange={setActiveTab} items={FISCAL_YEAR_TABS} />

      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`} style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTab === 'years' && (
          <FiscalYearsTable
            years={years}
            loading={isLoading}
            settings={settings}
            calendarYears={summary.calendarYears}
            onNew={() => setCreateOpen(true)}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'closing' && (
          <YearClosingTab fiscalYear={currentYear} onRefresh={refresh} onNewYear={() => setCreateOpen(true)} settings={settings} />
        )}
      </div>

      <CreateFiscalYearDialog open={createOpen} settings={settings} onClose={() => setCreateOpen(false)} onCreated={setNotice} />
    </main>
  );
}
