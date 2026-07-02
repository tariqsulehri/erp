'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { formatDate, type AppFormatSettingsSource } from '@/lib/app-settings';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PaginationBar } from '@/components/ui/PaginationBar';

type FiscalYear   = FiscalYearItem;
type FiscalPeriod = FiscalPeriodItem;
type FiscalYearTab = 'years' | 'closing';
type ClosingIssueState = { check: FiscalYearClosingIssueCheck; title: string } | null;

/* ── helpers ─────────────────────────────────────────────────────────── */
function fmt(d: string | Date, settings?: AppFormatSettingsSource | null) {
  return formatDate(d, settings);
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:     { bg: '#dcfce7', color: '#15803d' },
  closing:  { bg: '#fef3c7', color: '#92400e' },
  closed:   { bg: '#fee2e2', color: '#b91c1c' },
  archived: { bg: '#f1f5f9', color: '#64748b' },
};

const PERIOD_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:   { bg: '#dcfce7', color: '#15803d' },
  locked: { bg: '#fef3c7', color: '#92400e' },
  closed: { bg: '#fee2e2', color: '#b91c1c' },
};

/* ── Create Fiscal Year form ─────────────────────────────────────────── */
function CreateFYForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    fiscal_year:         '',
    year_basis:          'calendar' as 'calendar' | 'july' | 'april',
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
  function applyBasis(basis: typeof form.year_basis, fy: string) {
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

  function handleBasis(basis: typeof form.year_basis) {
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
    if (!form.fiscal_year) return setError('Fiscal year identifier is required');
    if (!form.start_date || !form.end_date) return setError('Start and end dates are required');
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
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Fiscal Year Name */}
        <div>
          <label style={labelStyle}>Fiscal Year Identifier *</label>
          <input
            className="form-input"
            placeholder="e.g. 2026 or 2026-2027"
            value={form.fiscal_year}
            onChange={e => handleFY(e.target.value)}
            required
          />
          <p style={hintStyle}>Human-readable label used in reports</p>
        </div>

        {/* Year Basis */}
        <div>
          <label style={labelStyle}>Year Basis *</label>
          <select
            className="form-input"
            value={form.year_basis}
            onChange={e => handleBasis(e.target.value as any)}
          >
            <option value="calendar">Calendar Year  (Jan 1 – Dec 31)</option>
            <option value="july">July Basis  (Jul 1 – Jun 30)</option>
            <option value="april">April Basis  (Apr 1 – Mar 31)</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label style={labelStyle}>Start Date *</label>
          <input
            type="date" className="form-input"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            required
          />
        </div>

        {/* End Date */}
        <div>
          <label style={labelStyle}>End Date *</label>
          <input
            type="date" className="form-input"
            value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            required
          />
        </div>

        {/* Number of Periods */}
        <div>
          <label style={labelStyle}>Number of Periods</label>
          <select
            className="form-input"
            value={form.number_of_periods}
            onChange={e => setForm(f => ({ ...f, number_of_periods: parseInt(e.target.value) }))}
          >
            <option value={12}>12 — Monthly</option>
            <option value={4}>4 — Quarterly</option>
            <option value={13}>13 — 4-week periods</option>
          </select>
        </div>

        {/* Posting Cutoff Days */}
        <div>
          <label style={labelStyle}>Posting Cutoff Days</label>
          <input
            type="number" className="form-input" min={0} max={60}
            value={form.posting_cutoff_days}
            onChange={e => setForm(f => ({ ...f, posting_cutoff_days: parseInt(e.target.value) || 0 }))}
          />
          <p style={hintStyle}>Days after period end to allow late entries</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 6,
          color: '#b91c1c', fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
            : 'Create Fiscal Year'}
        </button>
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

  if (isLoading) return <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>Loading periods…</div>;
  if (!periods?.length) return <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>No periods found.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
            {['#', 'Period', 'Start', 'End', 'Status', 'Transactions', 'Actions'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                color: 'var(--color-text-muted)', letterSpacing: 0,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p: FiscalPeriod, i: number) => {
            const ss = PERIOD_STATUS_STYLE[p.status] ?? PERIOD_STATUS_STYLE.open;
            const isLast = i === periods.length - 1;
            const busy = periodActionBusy;
            return (
              <tr key={p.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {p.period_number}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{p.period_name}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                  {fmt(p.start_date, settings)}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                  {fmt(p.end_date, settings)}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: ss.bg, color: ss.color,
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                  {p.transaction_count ?? 0}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.status === 'open' && fyStatus !== 'closed' && (
                      <button
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
                        style={actionBtnStyle('#92400e', '#fef3c7')}
                      >Lock</button>
                    )}
                    {p.status === 'locked' && fyStatus !== 'closed' && (
                      <button
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
                        style={actionBtnStyle('#b91c1c', '#fee2e2')}
                      >Close</button>
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

/* ── Fiscal Year card ────────────────────────────────────────────────── */
function FYCard({ fy, onRefresh, settings }: { fy: FiscalYear; onRefresh: () => void; settings?: AppFormatSettingsSource | null }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const lockMut = useLockFiscalYear();
  const unlockMut = useUnlockFiscalYear();

  const ss = STATUS_STYLE[fy.status] ?? STATUS_STYLE.open;

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${fy.is_active ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: fy.is_active ? '0 0 0 2px var(--color-primary)20' : 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px',
        background: fy.is_active ? 'var(--color-primary)05' : 'transparent',
        borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
      }}>
        {/* Year badge */}
        <div style={{
          fontWeight: 800, fontSize: '1.125rem', fontFamily: 'monospace',
          color: fy.is_active ? 'var(--color-primary)' : 'var(--color-text)',
          minWidth: 80,
        }}>
          {fy.fiscal_year}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          {fy.is_active && (
            <span style={{
              fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em',
              background: 'var(--color-primary)', color: 'white',
              padding: '2px 8px', borderRadius: 10,  }}>Active</span>
          )}
          <span style={{
            fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: ss.bg, color: ss.color,
          }}>{fy.status}</span>
          {fy.is_locked && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#f1f5f9', color: '#64748b',
            }}>🔒 Locked</span>
          )}
        </div>

        {/* Meta */}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>
          <div>{fmt(fy.start_date, settings)} — {fmt(fy.end_date, settings)}</div>
          <div>{fy.number_of_periods} periods · {fy.transaction_count} transactions</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fy.status === 'open' && !fy.is_locked && (
            <button
              onClick={() => setConfirmLockOpen(true)}
              disabled={lockMut.isPending}
              style={actionBtnStyle('#b91c1c', '#fee2e2')}
            >
              Lock Year
            </button>
          )}
          {fy.is_locked && fy.status !== 'closed' && (
            <button
              onClick={() => setConfirmUnlockOpen(true)}
              disabled={unlockMut.isPending}
              style={actionBtnStyle('#15803d', '#dcfce7')}
            >
              Unlock Year
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded ? 'Hide' : 'Periods'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Periods table */}
      {expanded && <PeriodsPanel fyId={fy.id} fyStatus={fy.status} settings={settings} />}
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
    </div>
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
  const tone = check.status === 'Passed'
    ? { bg: '#dcfce7', color: '#15803d' }
    : check.status === 'Warning'
      ? { bg: '#fef3c7', color: '#92400e' }
      : { bg: '#fee2e2', color: '#b91c1c' };
  const issueCheck = isDetailCheck(check.key) ? check.key : null;
  const canViewDetails = check.count > 0 && issueCheck;
  return (
    <tr>
      <td style={checkCellStyle}>
        <span style={{ fontWeight: 800, color: 'var(--color-heading)' }}>{check.label}</span>
      </td>
      <td style={checkCellStyle}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 10,
          background: tone.bg,
          color: tone.color,
          fontSize: '0.68rem',
          fontWeight: 850,
        }}>{check.status}</span>
      </td>
      <td style={{ ...checkCellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>{check.count}</td>
      <td style={checkCellStyle}>
        <div style={checkMessageLineStyle}>
          <span>{check.message}</span>
          {canViewDetails ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={checkDetailsButtonStyle}
              onClick={() => issueCheck && onViewDetails(issueCheck, check.label)}
            >
              View Details
            </button>
          ) : null}
        </div>
        {check.details?.length ? (
          <div style={checkDetailsStyle}>
            {check.details.map(detail => (
              <div key={`${check.key}-${detail.label}`} style={checkDetailItemStyle}>
                <span style={checkDetailLabelStyle}>{detail.label}</span>
                <span style={checkDetailCountStyle}>{detail.count}</span>
                {detail.note ? <span style={checkDetailNoteStyle}>{detail.note}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function moneyText(value: string | null) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return value ?? '-';
  return numberValue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (!issue) return null;

  const rows = issuesQuery.data?.data ?? [];
  const pagination = issuesQuery.data?.pagination;

  return (
    <div style={issueOverlayStyle} role="dialog" aria-modal="true" aria-label={`${issue.title} Details`}>
      <button type="button" aria-label="Close Details" style={issueBackdropStyle} onClick={onClose} />
      <aside style={issuePanelStyle}>
        <div style={issuePanelHeaderStyle}>
          <div>
            <h3 style={issuePanelTitleStyle}>{issue.title}</h3>
            <p style={issuePanelSubtitleStyle}>Pending records that must be posted or voided before closing.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        {issuesQuery.isLoading && (
          <div style={issueLoadingStyle}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Loading records...
          </div>
        )}

        {issuesQuery.error && <div style={errorBannerStyle}>{issuesQuery.error.message}</div>}

        {!issuesQuery.isLoading && !issuesQuery.error && (
          <>
            <div style={issueTableWrapStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    {['Module', 'Document', 'Date', 'Party / Reference', 'Amount', 'Status', 'Action'].map(header => (
                      <th key={header} style={header === 'Amount' ? { ...issueHeaderStyle, textAlign: 'right' } : issueHeaderStyle}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={issueEmptyCellStyle}>No pending records found for this check.</td>
                    </tr>
                  )}
                  {rows.map(row => (
                    <ClosingIssueRow key={`${row.module_name}-${row.id}`} row={row} settings={settings} />
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={pagination?.page ?? page}
              totalPages={pagination?.pages ?? 1}
              totalRecords={pagination?.total ?? 0}
              pageSize={pagination?.limit ?? limit}
              recordLabel="Records"
              disabled={issuesQuery.isFetching}
              onPageChange={onPageChange}
            />
          </>
        )}
      </aside>
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
      <td style={issueCellStyle}>
        <div style={{ fontWeight: 850, color: 'var(--color-heading)' }}>{row.module_name}</div>
        <div style={issueMutedTextStyle}>{row.document_type}</div>
      </td>
      <td style={issueCellStyle}>
        <span style={issueDocumentNumberStyle}>{row.document_number}</span>
      </td>
      <td style={issueCellStyle}>{fmt(row.document_date, settings)}</td>
      <td style={issueCellStyle}>{row.party_name || '-'}</td>
      <td style={{ ...issueCellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 850 }}>{moneyText(row.amount)}</td>
      <td style={issueCellStyle}>
        <span style={issueStatusStyle}>{row.status}</span>
      </td>
      <td style={issueCellStyle}>
        {row.source_path ? (
          <a href={row.source_path} className="btn btn-secondary" style={issueOpenLinkStyle}>Open</a>
        ) : (
          <span style={issueMutedTextStyle}>-</span>
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
    <main style={closingShellStyle}>
      <section style={closingPanelStyle}>
        <div style={closingHeaderStyle}>
          <div>
            <h2 style={closingTitleStyle}>Close Current Fiscal Year</h2>
            <p style={closingSubtitleStyle}>Run final checks before locking the year and opening the next Fiscal Year.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => preCloseQuery.refetch()} disabled={!fiscalYear || preCloseQuery.isFetching}>
            {preCloseQuery.isFetching ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : null}
            Run Pre-Close Check
          </button>
        </div>

        {!fiscalYear && (
          <div style={emptyClosingStyle}>No Fiscal Year found. Open a new Fiscal Year to start posting transactions.</div>
        )}

        {fiscalYear && (
          <>
            <div style={currentYearGridStyle}>
              <div>
                <span style={metaLabelStyle}>Fiscal Year</span>
                <strong style={metaValueStyle}>{fiscalYear.fiscal_year}</strong>
              </div>
              <div>
                <span style={metaLabelStyle}>Date Range</span>
                <strong style={metaValueStyle}>{fmt(fiscalYear.start_date, settings)} - {fmt(fiscalYear.end_date, settings)}</strong>
              </div>
              <div>
                <span style={metaLabelStyle}>Status</span>
                <strong style={metaValueStyle}>{fiscalYear.status}</strong>
              </div>
              <div>
                <span style={metaLabelStyle}>Locked</span>
                <strong style={metaValueStyle}>{fiscalYear.is_locked ? 'Yes' : 'No'}</strong>
              </div>
            </div>

            {preCloseQuery.isLoading && (
              <div style={loadingCheckStyle}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Loading closing checks...
              </div>
            )}

            {preCloseQuery.error && (
              <div style={errorBannerStyle}>{preCloseQuery.error.message}</div>
            )}

            {preCloseQuery.data && (
              <div style={checkTableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Check', 'Result', 'Count', 'Message'].map(header => (
                        <th key={header} style={header === 'Count' ? { ...checkHeaderStyle, textAlign: 'right' } : checkHeaderStyle}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preCloseQuery.data.checks.map(check => (
                      <ClosingCheckRow key={check.key} check={check} onViewDetails={openIssuePanel} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={closeActionStyle}>
              <label style={{ display: 'grid', gap: 5, flex: 1 }}>
                <span style={labelStyle}>Closing Remarks</span>
                <textarea className="form-input" rows={2} value={remarks} onChange={event => setRemarks(event.currentTarget.value)} placeholder="Final closing notes" />
              </label>
              <button className="btn btn-primary" type="button" onClick={() => setConfirmCloseOpen(true)} disabled={!canClose || closeYear.isPending}>
                {closeYear.isPending ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
                Close Current Fiscal Year
              </button>
            </div>
          </>
        )}

        {message && (
          <div style={message.includes('successfully') || message.includes('closed') ? successBannerStyle : errorBannerStyle}>{message}</div>
        )}
      </section>

      <section style={closingPanelStyle}>
        <div style={closingHeaderStyle}>
          <div>
            <h2 style={closingTitleStyle}>Open New Fiscal Year</h2>
            <p style={closingSubtitleStyle}>Create the next year after the current year is closed.</p>
          </div>
        </div>
        {showNewYearForm ? (
          <div style={{ padding: 14 }}>
            <CreateFYForm onCreated={refreshAll} />
          </div>
        ) : (
          <div style={emptyClosingStyle}>Close the current Fiscal Year before opening a new Fiscal Year.</div>
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
    </main>
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
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fiscal Year</h1>
          <p className="page-subtitle">Manage accounting years and period close procedures</p>
        </div>
        {activeTab === 'years' && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(f => !f)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
            </svg>
            {showForm ? 'Cancel' : 'New Fiscal Year'}
          </button>
        )}
      </div>

      <div style={tabBarStyle}>
        {[
          { id: 'years' as FiscalYearTab, label: 'Fiscal Years' },
          { id: 'closing' as FiscalYearTab, label: 'Year Closing' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? activeTabStyle : tabStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'closing' && (
        <YearClosingTab fiscalYear={currentYear} onRefresh={refreshFiscalYears} settings={generalSettings} />
      )}

      {activeTab === 'years' && (
        <>

      {/* Create form card */}
      {showForm && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-primary)40',
          borderRadius: 'var(--radius)', padding: 24, marginBottom: 24,
          boxShadow: '0 0 0 2px var(--color-primary)10',
        }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, color: 'var(--color-text)', fontSize: 'var(--font-size-base)' }}>
            Create New Fiscal Year
          </h3>
          <CreateFYForm onCreated={() => setShowForm(false)} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Loading fiscal years…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: 8, color: '#b91c1c', marginBottom: 16 }}>
          {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && years.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"
            style={{ marginBottom: 16 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
          </svg>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>No fiscal years yet</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
            Create your first fiscal year to start tracking accounting periods.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Create Fiscal Year
          </button>
        </div>
      )}

      {/* Year cards */}
      {years.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {years.map(fy => (
            <FYCard key={fy.id} fy={fy} onRefresh={refreshFiscalYears} settings={generalSettings} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

/* ── Shared micro-styles ─────────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--font-size-xs)',
  fontWeight: 700, color: 'var(--color-text-muted)',
  marginBottom: 6, letterSpacing: 0,
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4,
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '2px solid var(--color-border)',
  marginBottom: 16,
};
const tabStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '10px 18px',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 650,
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
  marginBottom: -2,
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: 'var(--color-primary)',
  fontWeight: 850,
  borderBottomColor: 'var(--color-primary)',
};
const closingShellStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};
const closingPanelStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-sm)',
};
const closingHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
  borderBottom: '1px solid var(--color-border)',
};
const closingTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-heading)',
  fontSize: '0.95rem',
  fontWeight: 900,
};
const closingSubtitleStyle: React.CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.74rem',
  fontWeight: 750,
};
const currentYearGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))',
  gap: 8,
  padding: 14,
  borderBottom: '1px solid var(--color-border-subtle)',
};
const metaLabelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--color-text-muted)',
  fontSize: '0.68rem',
  fontWeight: 850,
  marginBottom: 4,
};
const metaValueStyle: React.CSSProperties = {
  color: 'var(--color-heading)',
  fontSize: '0.82rem',
  fontWeight: 900,
};
const loadingCheckStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 16,
  color: 'var(--color-text-muted)',
  fontSize: '0.78rem',
  fontWeight: 800,
};
const checkTableWrapStyle: React.CSSProperties = {
  padding: 14,
  overflowX: 'auto',
};
const checkHeaderStyle: React.CSSProperties = {
  background: 'var(--color-table-header-bg)',
  color: 'var(--color-table-header-text)',
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};
const checkCellStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  color: 'var(--color-text)',
  fontSize: '0.75rem',
  verticalAlign: 'middle',
};
const checkMessageLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};
const checkDetailsButtonStyle: React.CSSProperties = {
  padding: '4px 9px',
  minHeight: 26,
  whiteSpace: 'nowrap',
  fontSize: '0.68rem',
  fontWeight: 850,
};
const checkDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 7,
};
const checkDetailItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt)',
  padding: '3px 7px',
  fontSize: '0.68rem',
  fontWeight: 800,
};
const checkDetailLabelStyle: React.CSSProperties = {
  color: 'var(--color-heading)',
};
const checkDetailCountStyle: React.CSSProperties = {
  minWidth: 18,
  borderRadius: 9,
  background: 'var(--color-primary)18',
  color: 'var(--color-primary)',
  padding: '1px 6px',
  textAlign: 'center',
  fontFamily: 'monospace',
};
const checkDetailNoteStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const issueOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
};
const issueBackdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: 'none',
  background: 'rgba(15, 23, 42, 0.28)',
  cursor: 'default',
};
const issuePanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 'min(980px, 94vw)',
  height: '100%',
  background: 'var(--color-surface)',
  borderLeft: '1px solid var(--color-border)',
  boxShadow: '-18px 0 42px rgba(15, 23, 42, 0.18)',
  display: 'flex',
  flexDirection: 'column',
};
const issuePanelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderBottom: '1px solid var(--color-border)',
  flexShrink: 0,
};
const issuePanelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-heading)',
  fontSize: '0.95rem',
  fontWeight: 900,
};
const issuePanelSubtitleStyle: React.CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.72rem',
  fontWeight: 750,
};
const issueLoadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 14,
  color: 'var(--color-text-muted)',
  fontSize: '0.76rem',
  fontWeight: 850,
};
const issueTableWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 10,
};
const issueHeaderStyle: React.CSSProperties = {
  background: 'var(--color-table-header-bg)',
  color: 'var(--color-table-header-text)',
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};
const issueCellStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  color: 'var(--color-text)',
  fontSize: '0.73rem',
  verticalAlign: 'middle',
};
const issueEmptyCellStyle: React.CSSProperties = {
  ...issueCellStyle,
  padding: 18,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontWeight: 850,
};
const issueMutedTextStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.68rem',
  fontWeight: 750,
};
const issueDocumentNumberStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontWeight: 900,
  color: 'var(--color-heading)',
};
const issueStatusStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '2px 8px',
  borderRadius: 10,
  background: '#fef3c7',
  color: '#92400e',
  fontSize: '0.67rem',
  fontWeight: 850,
};
const issueOpenLinkStyle: React.CSSProperties = {
  minHeight: 26,
  padding: '4px 9px',
  fontSize: '0.68rem',
  fontWeight: 850,
  textDecoration: 'none',
};
const closeActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  gap: 10,
  padding: '0 14px 14px',
};
const emptyClosingStyle: React.CSSProperties = {
  padding: 18,
  color: 'var(--color-text-muted)',
  fontSize: '0.78rem',
  fontWeight: 800,
};
const successBannerStyle: React.CSSProperties = {
  margin: 14,
  border: '1px solid var(--color-success-border)',
  background: 'var(--color-success-bg)',
  color: 'var(--color-success-text)',
  padding: '8px 10px',
  fontSize: '0.76rem',
  fontWeight: 850,
};
const errorBannerStyle: React.CSSProperties = {
  margin: 14,
  border: '1px solid var(--color-danger-border)',
  background: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  padding: '8px 10px',
  fontSize: '0.76rem',
  fontWeight: 850,
};
function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: '3px 12px', fontSize: '0.6875rem', fontWeight: 700,
    borderRadius: 4, border: `1px solid ${color}`,
    background: 'transparent', color, cursor: 'pointer',
  };
}
