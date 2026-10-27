'use client';

import { Fragment, useState } from 'react';
import { IconCalendar, IconCircleCheck, IconClock, IconLock, IconPlus, IconSearch } from '@tabler/icons-react';
import { useLockFiscalYear, useUnlockFiscalYear, type FiscalYearItem } from '@/lib/api/fiscal-years';
import { formatCount, formatDate, type AppFormatSettingsSource } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { PeriodsTable } from './PeriodsTable';
import { YEAR_STATUS_TONE, basisLabel, filterFiscalYears, statusLabel, type FiscalYearFilters } from './fiscal-year-rules';

type ConfirmState = { year: FiscalYearItem; action: 'lock' | 'unlock' } | null;

export function FiscalYearsTable({ years, loading, settings, calendarYears, onNew, onRefresh }: {
  years: FiscalYearItem[];
  loading: boolean;
  settings?: AppFormatSettingsSource | null;
  /** Calendar years for the Year filter. */
  calendarYears: number[];
  onNew: () => void;
  onRefresh: () => void;
}) {
  const [filters, setFilters] = useState<FiscalYearFilters>({ search: '', year: '', status: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const lockMutation = useLockFiscalYear();
  const unlockMutation = useUnlockFiscalYear();
  const rows = filterFiscalYears(years, filters);
  const busy = lockMutation.isPending || unlockMutation.isPending;
  const date = (value: string) => formatDate(value, settings);

  function runConfirmed() {
    if (!confirm) return;
    const mutation = confirm.action === 'lock' ? lockMutation : unlockMutation;
    mutation.mutate({ id: confirm.year.id }, { onSuccess: () => { setConfirm(null); onRefresh(); } });
  }

  return (
    <section className="list-card" aria-label="Fiscal Years">
      <div className="list-card-toolbar">
        <label className="list-card-search">
          <IconSearch size={16} stroke={1.8} aria-hidden />
          <span className="sr-only">Filter Fiscal Years</span>
          <input
            type="search"
            value={filters.search}
            placeholder="Filter fiscal years and periods…"
            onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
          />
        </label>
        <select aria-label="Calendar Year" className="form-input list-card-select" value={filters.year} onChange={event => setFilters(current => ({ ...current, year: event.target.value }))}>
          <option value="">All Years</option>
          {calendarYears.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
        <select aria-label="Status" className="form-input list-card-select" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="open">Open</option>
          <option value="locked">Locked</option>
          <option value="closed">Closed</option>
        </select>
        <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={onNew}>New Fiscal Year</Button>
      </div>

      <div className="table-scroll">
        <table className="data-table data-table-caps">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Fiscal Year</th>
              <th style={{ width: 130 }}>Basis</th>
              <th>Timeline Window</th>
              <th className="num" style={{ width: 120 }}>Transactions</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 140 }}>Active Year</th>
              <th style={{ width: 170 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableMessageRow colSpan={7} title="Loading Fiscal Years…" loading />}
            {!loading && rows.length === 0 && (
              <TableMessageRow
                colSpan={7}
                title={years.length === 0 ? 'No Fiscal Years Yet' : 'No Fiscal Years Match'}
                description={years.length === 0 ? 'Create the first Fiscal Year to start posting.' : 'Change or clear the filters.'}
              />
            )}
            {!loading && rows.map(year => {
              const expanded = expandedId === year.id;
              const periodsId = `fiscal-periods-${year.id}`;
              return (
                <Fragment key={year.id}>
                  <tr className={expanded ? 'is-expanded' : undefined}>
                    <td><span className="code-chip">{year.fiscal_year}</span></td>
                    <td>{basisLabel(year.year_basis)}</td>
                    <td className="cell-stack">
                      <span className="timeline-line"><IconCalendar size={14} stroke={1.8} aria-hidden />{`${date(year.start_date)} – ${date(year.end_date)}`}</span>
                      <span className="timeline-line timeline-sub">
                        <IconClock size={14} stroke={1.8} aria-hidden />
                        {`${formatCount(year.number_of_periods, settings)} periods · Late entries ${formatCount(year.posting_cutoff_days, settings)} days`}
                      </span>
                    </td>
                    <td className="num">{formatCount(year.transaction_count, settings)}</td>
                    <td>
                      <span className={`status-pill status-${YEAR_STATUS_TONE[year.status] ?? 'neutral'}`}>
                        {year.status === 'open' && <IconCircleCheck size={14} stroke={2} aria-hidden />}{statusLabel(year.status)}
                      </span>
                      {year.is_locked && (
                        <span className="status-pill status-warning" style={{ marginLeft: 6 }}><IconLock size={13} stroke={2} aria-hidden />Locked</span>
                      )}
                    </td>
                    <td>
                      {year.is_active
                        ? <span className="status-pill status-success"><IconCircleCheck size={14} stroke={2} aria-hidden />Active Year</span>
                        : <span className="cell-muted">—</span>}
                    </td>
                    <td className="cell-actions">
                      <div className="text-actions">
                        <button type="button" className="text-action" aria-expanded={expanded} aria-controls={periodsId} onClick={() => setExpandedId(expanded ? null : year.id)}>
                          {expanded ? 'Hide Periods' : 'Periods'}
                        </button>
                        {year.status === 'open' && !year.is_locked && (
                          <button type="button" className="text-action text-action-danger" disabled={busy} onClick={() => setConfirm({ year, action: 'lock' })}>Lock</button>
                        )}
                        {year.is_locked && year.status !== 'closed' && (
                          <button type="button" className="text-action" disabled={busy} onClick={() => setConfirm({ year, action: 'unlock' })}>Unlock</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="row-detail">
                      <td colSpan={7} id={periodsId}>
                        <PeriodsTable fyId={year.id} fyStatus={year.status} settings={settings} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm?.action === 'lock'}
        title="Lock Fiscal Year?"
        message={`Locking ${confirm?.year.fiscal_year ?? ''} will stop new postings for the full fiscal year. Use this only after final review.`}
        confirmLabel="Yes, Lock Year"
        variant="danger"
        loading={busy}
        requiredText={confirm?.year.fiscal_year}
        requiredTextLabel="Fiscal Year"
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.action === 'unlock'}
        title="Unlock Fiscal Year?"
        message={`Unlocking ${confirm?.year.fiscal_year ?? ''} removes the year-level posting block only. It will not reopen closed periods or change any transactions.`}
        confirmLabel="Yes, Unlock Year"
        variant="warning"
        loading={busy}
        requiredText={confirm?.year.fiscal_year}
        requiredTextLabel="Fiscal Year"
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
