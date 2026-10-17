'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import {
  type FiscalYearClosingIssue,
  type FiscalYearClosingIssueCheck,
  type FiscalYearClosingCheck,
  fiscalYearsQueryKey,
  useCloseFiscalYear,
  useCloseFiscalPeriod,
  useCreateFiscalYear,
  useFiscalPeriods,
  useFiscalYearClosingIssues,
  useFiscalYearPreCloseCheck,
  useFiscalYearsList,
  useLockFiscalPeriod,
  useLockFiscalYear,
  useUnlockFiscalYear,
  type CreateFiscalYearInput,
  type FiscalPeriodItem,
  type FiscalYearItem,
} from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateField, SelectField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { Tabs } from '@/components/ui/Tabs';

type FiscalYear   = FiscalYearItem;
type FiscalPeriod = FiscalPeriodItem;
type FiscalYearTab = 'years' | 'closing';
type ClosingIssueState = { check: FiscalYearClosingIssueCheck; title: string } | null;
type YearBasis = 'calendar' | 'july' | 'april';
type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const FISCAL_YEAR_TABS: Array<{ value: FiscalYearTab; label: string }> = [
  { value: 'years',   label: 'Fiscal Years' },
  { value: 'closing', label: 'Year Closing' },
];

const YEAR_BASIS_OPTIONS: Array<{ value: YearBasis; label: string }> = [
  { value: 'calendar', label: 'Calendar Year (Jan 1 – Dec 31)' },
  { value: 'july',     label: 'July Basis (Jul 1 – Jun 30)' },
  { value: 'april',    label: 'April Basis (Apr 1 – Mar 31)' },
];

const PERIOD_COUNT_OPTIONS = [
  { value: '12', label: '12 — Monthly' },
  { value: '4',  label: '4 — Quarterly' },
  { value: '13', label: '13 — 4-Week Periods' },
];

/* ── helpers ─────────────────────────────────────────────────────────── */
function fmt(d: string | Date, settings?: AppFormatSettingsSource | null) {
  return formatDate(d, settings);
}

/** "open" → "Open" for display; the stored value is unchanged. */
function statusLabel(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Not Set';
}

const YEAR_STATUS_TONE: Record<string, BadgeTone> = {
  open:     'success',
  closing:  'warning',
  closed:   'neutral',
  archived: 'neutral',
};

const PERIOD_STATUS_TONE: Record<string, BadgeTone> = {
  open:   'success',
  locked: 'warning',
  closed: 'neutral',
};

const CHECK_STATUS_TONE: Record<FiscalYearClosingCheck['status'], BadgeTone> = {
  Passed:  'success',
  Warning: 'warning',
  Failed:  'danger',
};

/* ── Create Fiscal Year form ─────────────────────────────────────────── */
function CreateFYForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    fiscal_year:         '',
    year_basis:          'calendar' as YearBasis,
    start_date:          '',
    end_date:            '',
    number_of_periods:   12,
    posting_cutoff_days: 5,
  });
  const [error, setError] = useState('');

  const createMutation = useCreateFiscalYear();

  function createFiscalYear(payload: CreateFiscalYearInput) {
    createMutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
        onCreated();
      },
      onError: (error) => setError(error.message),
    });
  }

  // The backend owns fiscal-year overlap and period validation.

  /* Auto-fill dates when year_basis or fiscal_year changes */
  function applyBasis(basis: YearBasis, fy: string) {
    const year = parseInt(fy, 10);
    if (!year || year < 2000 || year > 2100) return;
    if (basis === 'calendar') {
      setForm(f => ({ ...f, start_date: `${year}-01-01`, end_date: `${year}-12-31` }));
    } else if (basis === 'july') {
      setForm(f => ({ ...f, start_date: `${year}-07-01`, end_date: `${year + 1}-06-30` }));
    } else if (basis === 'april') {
      setForm(f => ({ ...f, start_date: `${year}-04-01`, end_date: `${year + 1}-03-31` }));
    }
  }

  function handleBasis(basis: YearBasis) {
    setForm(f => ({ ...f, year_basis: basis }));
    applyBasis(basis, form.fiscal_year);
  }

  function handleFY(fy: string) {
    setForm(f => ({ ...f, fiscal_year: fy }));
    applyBasis(form.year_basis, fy);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.fiscal_year) return setError('Enter a Fiscal Year Name.');
    if (!form.start_date || !form.end_date) return setError('Enter a Start Date and an End Date.');
    createFiscalYear({
      fiscal_year:         form.fiscal_year,
      year_basis:          form.year_basis,
      start_date:          form.start_date,
      end_date:            form.end_date,
      number_of_periods:   form.number_of_periods,
      posting_cutoff_days: form.posting_cutoff_days,
    });
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      <div className="form-grid">
        <div>
          <TextField
            label="Fiscal Year Name"
            required
            value={form.fiscal_year}
            onChange={handleFY}
            placeholder="For example 2026 or 2026-2027"
          />
          <p className="form-hint">Shown on reports.</p>
        </div>

        <SelectField
          label="Year Basis"
          required
          value={form.year_basis}
          options={YEAR_BASIS_OPTIONS}
          onChange={value => handleBasis(value as YearBasis)}
        />

        <DateField
          label="Start Date"
          required
          value={form.start_date}
          onChange={value => setForm(f => ({ ...f, start_date: value }))}
        />

        <DateField
          label="End Date"
          required
          value={form.end_date}
          onChange={value => setForm(f => ({ ...f, end_date: value }))}
        />

        <SelectField
          label="Number Of Periods"
          value={String(form.number_of_periods)}
          options={PERIOD_COUNT_OPTIONS}
          onChange={value => setForm(f => ({ ...f, number_of_periods: parseInt(value) }))}
        />

        <div>
          <TextField
            label="Posting Cutoff Days"
            value={String(form.posting_cutoff_days)}
            onChange={value => setForm(f => ({ ...f, posting_cutoff_days: parseInt(value) || 0 }))}
            inputProps={{ type: 'number', min: 0, max: 60, inputMode: 'numeric' }}
            style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          />
          <p className="form-hint">Days after a period ends when late entries are still allowed.</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button type="submit" variant="primary" icon={<IconPlus size={16} stroke={1.8} />} loading={createMutation.isPending}>
          Create Fiscal Year
        </Button>
      </div>
    </form>
  );
}

/* ── Periods panel ──────────────────────────────────────────────────── */
function PeriodsPanel({ fyId, fyStatus, settings }: { fyId: string; fyStatus: string; settings?: AppFormatSettingsSource | null }) {
  const queryClient = useQueryClient();
  const { data: periods, isLoading } = useFiscalPeriods(fyId);
  const lockPeriodMut = useLockFiscalPeriod();
  const closePeriodMut = useCloseFiscalPeriod();
  const periodActionBusy = lockPeriodMut.isPending || closePeriodMut.isPending;
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    requiredText: string;
    onConfirm: () => void;
  } | null>(null);

  function refreshPeriods() {
    queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th className="num" style={{ width: 56 }}>No.</th>
            <th>Period</th>
            <th style={{ width: 130 }}>Start Date</th>
            <th style={{ width: 130 }}>End Date</th>
            <th style={{ width: 110 }}>Status</th>
            <th className="num" style={{ width: 120 }}>Transactions</th>
            <th style={{ width: 120 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableMessageRow colSpan={7} title="Loading Periods…" loading />}
          {!isLoading && !periods?.length && (
            <TableMessageRow colSpan={7} title="No Periods Found" description="Periods are created with the Fiscal Year." />
          )}
          {!isLoading && periods?.map((p: FiscalPeriod) => {
            const busy = periodActionBusy;
            return (
              <tr key={p.id}>
                <td className="num cell-muted">{p.period_number}</td>
                <td className="cell-strong">{p.period_name}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.start_date, settings)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.end_date, settings)}</td>
                <td><Badge variant={PERIOD_STATUS_TONE[p.status] ?? 'neutral'}>{statusLabel(p.status)}</Badge></td>
                <td className="num">{p.transaction_count ?? 0}</td>
                <td className="cell-actions">
                  <div className="row-actions">
                    {p.status === 'open' && fyStatus !== 'closed' && (
                      <Button
                        size="sm"
                        icon={<IconLock size={16} stroke={1.8} />}
                        disabled={busy}
                        onClick={() => setConfirmAction({
                          title: 'Lock Fiscal Period?',
                          message: `Locking ${p.period_name} will stop new postings in this period. This action should be done only after review.`,
                          confirmLabel: 'Yes, Lock Period',
                          requiredText: 'LOCK',
                          onConfirm: () => lockPeriodMut.mutate(
                            { id: p.id },
                            {
                              onSuccess: () => {
                                refreshPeriods();
                                setConfirmAction(null);
                              },
                            },
                          ),
                        })}
                      >
                        Lock
                      </Button>
                    )}
                    {p.status === 'locked' && fyStatus !== 'closed' && (
                      <Button
                        size="sm"
                        icon={<IconX size={16} stroke={1.8} />}
                        disabled={busy}
                        onClick={() => setConfirmAction({
                          title: 'Close Fiscal Period?',
                          message: `Closing ${p.period_name} will mark the period closed for posting. Continue only after all checks are complete.`,
                          confirmLabel: 'Yes, Close Period',
                          requiredText: 'CLOSE',
                          onConfirm: () => closePeriodMut.mutate(
                            { id: p.id },
                            {
                              onSuccess: () => {
                                refreshPeriods();
                                setConfirmAction(null);
                              },
                            },
                          ),
                        })}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={confirmAction?.confirmLabel ?? 'Confirm'}
        variant="warning"
        loading={periodActionBusy}
        requiredText={confirmAction?.requiredText}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

/* ── Fiscal Year panel ───────────────────────────────────────────────── */
function FYCard({ fy, onRefresh, settings }: { fy: FiscalYear; onRefresh: () => void; settings?: AppFormatSettingsSource | null }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const lockMut = useLockFiscalYear();
  const unlockMut = useUnlockFiscalYear();
  const periodsId = `fiscal-periods-${fy.id}`;

  return (
    <section className="panel" style={{ flexShrink: 0 }} aria-label={`Fiscal Year ${fy.fiscal_year}`}>
      <div className="panel-header" style={{ borderBottom: expanded ? undefined : 'none', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <h2 className="panel-title" style={{ fontVariantNumeric: 'tabular-nums' }}>{fy.fiscal_year}</h2>
          {fy.is_active && <Badge variant="info">Active</Badge>}
          <Badge variant={YEAR_STATUS_TONE[fy.status] ?? 'neutral'}>{statusLabel(fy.status)}</Badge>
          {fy.is_locked && <Badge variant="warning">Locked</Badge>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(fy.start_date, settings)} – {fmt(fy.end_date, settings)} · {fy.number_of_periods} Periods · {fy.transaction_count} Transactions
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {fy.status === 'open' && !fy.is_locked && (
              <Button size="sm" icon={<IconLock size={16} stroke={1.8} />} onClick={() => setConfirmLockOpen(true)} disabled={lockMut.isPending}>
                Lock Year
              </Button>
            )}
            {fy.is_locked && fy.status !== 'closed' && (
              <Button size="sm" icon={<IconLockOpen size={16} stroke={1.8} />} onClick={() => setConfirmUnlockOpen(true)} disabled={unlockMut.isPending}>
                Unlock Year
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={expanded ? <IconChevronDown size={16} stroke={1.8} /> : <IconChevronRight size={16} stroke={1.8} />}
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-controls={periodsId}
            >
              {expanded ? 'Hide Periods' : 'Show Periods'}
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div id={periodsId}>
          <PeriodsPanel fyId={fy.id} fyStatus={fy.status} settings={settings} />
        </div>
      )}

      <ConfirmDialog
        open={confirmLockOpen}
        title="Lock Fiscal Year?"
        message={`Locking ${fy.fiscal_year} will stop new postings for the full fiscal year. Use this only after final review.`}
        confirmLabel="Yes, Lock Year"
        variant="danger"
        loading={lockMut.isPending}
        requiredText={fy.fiscal_year}
        requiredTextLabel="Fiscal Year"
        onConfirm={() => lockMut.mutate(
          { id: fy.id },
          {
            onSuccess: () => {
              setConfirmLockOpen(false);
              onRefresh();
            },
          },
        )}
        onCancel={() => setConfirmLockOpen(false)}
      />
      <ConfirmDialog
        open={confirmUnlockOpen}
        title="Unlock Fiscal Year?"
        message={`Unlocking ${fy.fiscal_year} removes the year-level posting block only. It will not reopen closed periods or change any transactions. Posting remains allowed only in valid open periods.`}
        confirmLabel="Yes, Unlock Year"
        variant="warning"
        loading={unlockMut.isPending}
        requiredText={fy.fiscal_year}
        requiredTextLabel="Fiscal Year"
        onConfirm={() => unlockMut.mutate(
          { id: fy.id },
          {
            onSuccess: () => {
              setConfirmUnlockOpen(false);
              onRefresh();
            },
          },
        )}
        onCancel={() => setConfirmUnlockOpen(false)}
      />
    </section>
  );
}

function isDetailCheck(key: string): key is FiscalYearClosingIssueCheck {
  return key === 'draft_vouchers' || key === 'unposted_documents';
}

function ClosingCheckRow({
  check,
  onViewDetails,
}: {
  check: FiscalYearClosingCheck;
  onViewDetails: (check: FiscalYearClosingIssueCheck, title: string) => void;
}) {
  const issueCheck = isDetailCheck(check.key) ? check.key : null;
  const canViewDetails = check.count > 0 && issueCheck;
  return (
    <tr>
      <td className="cell-strong">{check.label}</td>
      <td><Badge variant={CHECK_STATUS_TONE[check.status] ?? 'danger'}>{check.status}</Badge></td>
      <td className="num">{check.count}</td>
      <td className={check.details?.length ? 'cell-stack' : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{check.message}</span>
          {canViewDetails ? (
            <Button size="sm" onClick={() => issueCheck && onViewDetails(issueCheck, check.label)}>
              View Details
            </Button>
          ) : null}
        </div>
        {check.details?.length ? (
          <span className="cell-sub" style={{ whiteSpace: 'normal', marginTop: 2 }}>
            {check.details.map((detail, index) => (
              <span key={`${check.key}-${detail.label}`}>
                {index > 0 && ' · '}
                {detail.label}: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{detail.count}</span>
                {detail.note ? ` (${detail.note})` : null}
              </span>
            ))}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function moneyText(value: string | null, settings?: AppFormatSettingsSource | null) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return value ?? 'Not Set';
  return formatNumber(numberValue, settings);
}

function ClosingIssuesPanel({
  fiscalYearId,
  issue,
  page,
  limit,
  settings,
  onClose,
  onPageChange,
}: {
  fiscalYearId?: string;
  issue: ClosingIssueState;
  page: number;
  limit: number;
  settings?: AppFormatSettingsSource | null;
  onClose: () => void;
  onPageChange: (page: number) => void;
}) {
  const issuesQuery = useFiscalYearClosingIssues(fiscalYearId, issue?.check ?? null, page, limit);

  useEffect(() => {
    if (!issue) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [issue, onClose]);

  if (!issue) return null;

  const rows = issuesQuery.data?.data ?? [];
  const pagination = issuesQuery.data?.pagination;

  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        className="dialog dialog-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`${issue.title} Details`}
        style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="panel-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="dialog-title" style={{ margin: 0 }}>{issue.title}</h2>
            <p className="dialog-message">Pending records that must be posted or voided before closing.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Details" title="Close Details" />
        </div>

        {issuesQuery.error && (
          <div style={{ padding: 16 }}>
            <InlineAlert tone="danger">{friendlyErrorMessage(issuesQuery.error, 'Unable to load pending records.')}</InlineAlert>
          </div>
        )}

        {!issuesQuery.error && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Document</th>
                    <th style={{ width: 120 }}>Date</th>
                    <th>Party Or Reference</th>
                    <th className="num" style={{ width: 130 }}>Amount</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 90 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {issuesQuery.isLoading && <TableMessageRow colSpan={7} title="Loading Records…" loading />}
                  {!issuesQuery.isLoading && rows.length === 0 && (
                    <TableMessageRow colSpan={7} title="No Pending Records" description="Nothing is blocking this check." />
                  )}
                  {!issuesQuery.isLoading && rows.map(row => (
                    <ClosingIssueRow key={`${row.module_name}-${row.id}`} row={row} settings={settings} />
                  ))}
                </tbody>
              </table>
            </div>

            {!issuesQuery.isLoading && (
              <PaginationBar
                page={pagination?.page ?? page}
                totalPages={pagination?.pages ?? 1}
                totalRecords={pagination?.total ?? 0}
                pageSize={pagination?.limit ?? limit}
                recordLabel="Records"
                disabled={issuesQuery.isFetching}
                onPageChange={onPageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClosingIssueRow({
  row,
  settings,
}: {
  row: FiscalYearClosingIssue;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <tr>
      <td className="cell-stack">
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--color-heading)' }}>{row.module_name}</span>
        <span className="cell-sub">{row.document_type}</span>
      </td>
      <td className="cell-strong">{row.document_number}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(row.document_date, settings)}</td>
      <td className={row.party_name ? undefined : 'cell-muted'}>{row.party_name || 'Not Set'}</td>
      <td className="num">{moneyText(row.amount, settings)}</td>
      <td><Badge variant="warning">{statusLabel(row.status)}</Badge></td>
      <td className="cell-actions">
        {row.source_path ? (
          <a href={row.source_path} className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            <IconExternalLink size={16} stroke={1.8} aria-hidden />
            Open
          </a>
        ) : (
          <span className="cell-muted">Not Set</span>
        )}
      </td>
    </tr>
  );
}

function YearClosingTab({
  fiscalYear,
  onRefresh,
  settings,
}: {
  fiscalYear?: FiscalYear;
  onRefresh: () => void;
  settings?: AppFormatSettingsSource | null;
}) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState('');
  const [activeIssue, setActiveIssue] = useState<ClosingIssueState>(null);
  const [issuePage, setIssuePage] = useState(1);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const issueLimit = 25;
  const preCloseQuery = useFiscalYearPreCloseCheck(fiscalYear?.id, Boolean(fiscalYear));
  const closeYear = useCloseFiscalYear();

  const canClose = Boolean(preCloseQuery.data?.can_close && fiscalYear && fiscalYear.status !== 'closed');
  const showNewYearForm = !fiscalYear || fiscalYear.status === 'closed';
  const messageIsSuccess = message.includes('successfully') || message.includes('closed');

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
    onRefresh();
  }

  function closeCurrentYear() {
    if (!fiscalYear) return;
    setMessage('');
    closeYear.mutate(
      { id: fiscalYear.id, remarks },
      {
        onSuccess: result => {
          setMessage(result.message);
          setRemarks('');
          setConfirmCloseOpen(false);
          refreshAll();
        },
        onError: error => {
          setMessage(error.message);
          setConfirmCloseOpen(false);
        },
      },
    );
  }

  function openIssuePanel(check: FiscalYearClosingIssueCheck, title: string) {
    setIssuePage(1);
    setActiveIssue({ check, title });
  }

  return (
    <>
      {message && <InlineAlert tone={messageIsSuccess ? 'success' : 'danger'}>{message}</InlineAlert>}

      <section className="panel" style={{ flexShrink: 0 }}>
        <div className="panel-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="panel-title">Close Current Fiscal Year</h2>
            <p className="page-head-desc">Run the final checks before locking the year and opening the next Fiscal Year.</p>
          </div>
          <Button
            icon={<IconRefresh size={16} stroke={1.8} />}
            onClick={() => preCloseQuery.refetch()}
            disabled={!fiscalYear}
            loading={preCloseQuery.isFetching}
          >
            Run Pre-Close Check
          </Button>
        </div>

        {!fiscalYear && (
          <div className="empty-state">
            <div className="empty-title">No Fiscal Year Found</div>
            <div className="empty-desc">Open a new Fiscal Year below to start posting transactions.</div>
          </div>
        )}

        {fiscalYear && (
          <>
            <div className="panel-body" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <dl className="form-grid" style={{ margin: 0 }}>
                <div>
                  <dt className="field-label">Fiscal Year</dt>
                  <dd style={{ margin: 0, fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>{fiscalYear.fiscal_year}</dd>
                </div>
                <div>
                  <dt className="field-label">Date Range</dt>
                  <dd style={{ margin: 0, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(fiscalYear.start_date, settings)} – {fmt(fiscalYear.end_date, settings)}
                  </dd>
                </div>
                <div>
                  <dt className="field-label">Status</dt>
                  <dd style={{ margin: 0 }}><Badge variant={YEAR_STATUS_TONE[fiscalYear.status] ?? 'neutral'}>{statusLabel(fiscalYear.status)}</Badge></dd>
                </div>
                <div>
                  <dt className="field-label">Locked</dt>
                  <dd style={{ margin: 0 }}>
                    <Badge variant={fiscalYear.is_locked ? 'warning' : 'neutral'}>{fiscalYear.is_locked ? 'Yes' : 'No'}</Badge>
                  </dd>
                </div>
              </dl>
            </div>

            {preCloseQuery.error && (
              <div style={{ padding: '12px 16px 0' }}>
                <InlineAlert tone="danger">{friendlyErrorMessage(preCloseQuery.error, 'Unable to run the closing checks.')}</InlineAlert>
              </div>
            )}

            {(preCloseQuery.isLoading || preCloseQuery.data) && (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '24%' }}>Check</th>
                      <th style={{ width: 110 }}>Result</th>
                      <th className="num" style={{ width: 90 }}>Count</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preCloseQuery.isLoading && <TableMessageRow colSpan={4} title="Loading Closing Checks…" loading />}
                    {preCloseQuery.data?.checks.map(check => (
                      <ClosingCheckRow key={check.key} check={check} onViewDetails={openIssuePanel} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel-footer" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <TextareaField
                  label="Closing Remarks"
                  rows={2}
                  value={remarks}
                  onChange={setRemarks}
                  placeholder="Final closing notes"
                />
              </div>
              <Button
                variant="primary"
                icon={<IconLock size={16} stroke={1.8} />}
                onClick={() => setConfirmCloseOpen(true)}
                disabled={!canClose}
                loading={closeYear.isPending}
              >
                Close Current Fiscal Year
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="panel" style={{ flexShrink: 0 }}>
        <div className="panel-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="panel-title">Open New Fiscal Year</h2>
            <p className="page-head-desc">Create the next year after the current year is closed.</p>
          </div>
        </div>
        {showNewYearForm ? (
          <div className="panel-body">
            <CreateFYForm onCreated={refreshAll} />
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-desc">Close the current Fiscal Year before opening a new Fiscal Year.</div>
          </div>
        )}
      </section>

      <ClosingIssuesPanel
        fiscalYearId={fiscalYear?.id}
        issue={activeIssue}
        page={issuePage}
        limit={issueLimit}
        settings={settings}
        onClose={() => setActiveIssue(null)}
        onPageChange={setIssuePage}
      />
      <ConfirmDialog
        open={confirmCloseOpen}
        title="Close Fiscal Year?"
        message={`Closing ${fiscalYear?.fiscal_year ?? 'this fiscal year'} will close all periods and lock the year for posting. This cannot currently be reopened from the application.`}
        confirmLabel="Yes, Close Fiscal Year"
        variant="danger"
        loading={closeYear.isPending}
        requiredText={fiscalYear?.fiscal_year}
        requiredTextLabel="Fiscal Year"
        onConfirm={closeCurrentYear}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function FiscalYearPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<FiscalYearTab>('years');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFiscalYearsList({ page: 1, limit: 50 });
  const { data: generalSettings } = useGeneralSettings();
  const years: FiscalYear[] = data?.data ?? [];
  const currentYear = years.find(fy => fy.is_active) ?? years.find(fy => fy.status !== 'closed') ?? years[0];
  const refreshFiscalYears = () => queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });

  return (
    <main className="page-shell">
      <PageHeader
        title="Fiscal Year"
        description="Accounting years, their periods, and the year-end closing steps."
        actions={activeTab === 'years' ? (
          showForm
            ? <Button icon={<IconX size={16} stroke={1.8} />} onClick={() => setShowForm(false)}>Cancel</Button>
            : <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setShowForm(true)}>New Fiscal Year</Button>
        ) : undefined}
      />

      {error && <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Unable to load Fiscal Years.')}</InlineAlert>}

      <Tabs label="Fiscal Year Sections" value={activeTab} onChange={setActiveTab} items={FISCAL_YEAR_TABS} />

      <div
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {activeTab === 'closing' && (
          <YearClosingTab fiscalYear={currentYear} onRefresh={refreshFiscalYears} settings={generalSettings} />
        )}

        {activeTab === 'years' && (
          <>
            {/* Create form */}
            {showForm && (
              <section className="panel" style={{ flexShrink: 0 }}>
                <div className="panel-header">
                  <h2 className="panel-title">Create New Fiscal Year</h2>
                </div>
                <div className="panel-body">
                  <CreateFYForm onCreated={() => setShowForm(false)} />
                </div>
              </section>
            )}

            {/* Loading */}
            {isLoading && (
              <section className="panel" style={{ flexShrink: 0 }}>
                <div className="empty-state">
                  <span className="spinner" aria-hidden />
                  <div className="empty-title">Loading Fiscal Years…</div>
                </div>
              </section>
            )}

            {/* Empty state */}
            {!isLoading && !error && years.length === 0 && (
              <section className="panel" style={{ flexShrink: 0 }}>
                <div className="empty-state">
                  <div className="empty-title">No Fiscal Years Yet</div>
                  <div className="empty-desc">Create your first Fiscal Year to start tracking accounting periods.</div>
                  <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setShowForm(true)}>
                    Create Fiscal Year
                  </Button>
                </div>
              </section>
            )}

            {/* Year panels */}
            {years.map(fy => (
              <FYCard key={fy.id} fy={fy} onRefresh={refreshFiscalYears} settings={generalSettings} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
