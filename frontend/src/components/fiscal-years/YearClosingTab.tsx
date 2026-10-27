'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconExternalLink, IconLock, IconPlus, IconRefresh, IconX } from '@tabler/icons-react';
import {
  type FiscalYearClosingIssue,
  type FiscalYearClosingIssueCheck,
  type FiscalYearClosingCheck,
  fiscalYearsQueryKey,
  useCloseFiscalYear,
  useFiscalYearClosingIssues,
  useFiscalYearPreCloseCheck,
  type FiscalYearItem,
} from '@/lib/api/fiscal-years';
import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { YEAR_STATUS_TONE, statusLabel, type BadgeTone } from './fiscal-year-rules';

type FiscalYear = FiscalYearItem;
type ClosingIssueState = { check: FiscalYearClosingIssueCheck; title: string } | null;
const fmt = (value: string | Date, settings?: AppFormatSettingsSource | null) => formatDate(value, settings);

const CHECK_STATUS_TONE: Record<FiscalYearClosingCheck['status'], BadgeTone> = {
  Passed:  'success',
  Warning: 'warning',
  Failed:  'danger',
};

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
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
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
            <p className="dialog-message">These records must be posted or voided before you can close the year.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Details" title="Close Details" />
        </div>

        {issuesQuery.error && (
          <div style={{ padding: 16 }}>
            <InlineAlert tone="danger">{friendlyErrorMessage(issuesQuery.error, 'Could not load pending records. Please try again.')}</InlineAlert>
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

/** Pre-close checks, closing the current year, and opening the next one. */
export function YearClosingTab({
  fiscalYear,
  onRefresh,
  onNewYear,
  settings,
}: {
  fiscalYear?: FiscalYear;
  onRefresh: () => void;
  /** Opens the Create Fiscal Year dialog. */
  onNewYear: () => void;
  settings?: AppFormatSettingsSource | null;
}) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState('');
  // Success or failure comes from which callback ran, not from the wording of the message.
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
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
          setMessageIsSuccess(true);
          setMessage(result.message);
          setRemarks('');
          setConfirmCloseOpen(false);
          refreshAll();
        },
        onError: error => {
          setMessageIsSuccess(false);
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
            Run Closing Checks
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
                <InlineAlert tone="danger">{friendlyErrorMessage(preCloseQuery.error, 'Could not run the closing checks. Please try again.')}</InlineAlert>
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
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={onNewYear}>New Fiscal Year</Button>
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
        message={`Closing ${fiscalYear?.fiscal_year ?? 'this fiscal year'} closes all Periods and stops posting to this year. You cannot reopen it later in this system.`}
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

