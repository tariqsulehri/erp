'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { IconEye, IconPrinter, IconRefresh, IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { Drawer } from '@/components/ui/Drawer';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { DetailTotals } from '@/components/documents';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { useApproveVoucher, useRejectVoucher, useVoucherDetail, useVouchersList } from '@/lib/api/vouchers';
import { hasPermission } from '@/lib/auth/session-user';
import { friendlyErrorMessage } from '@/lib/erp-utils';

type VoucherType = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN' | 'PI' | 'PR' | 'SI' | 'SR' | 'SA';
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Not Required';
type VoucherStatus = 'Draft' | 'Posted' | 'Voided';
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface ApprovalVoucherRow {
  id: string;
  voucher_number: string;
  voucher_type: VoucherType;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  status: VoucherStatus;
  approval_status: ApprovalStatus;
  total_debit: string;
  total_credit: string;
}

interface ApprovalVoucherLine {
  id: string;
  line_no: number;
  account_code: string;
  account_name: string;
  dr_amount: string | number;
  cr_amount: string | number;
}

const voucherTypeOptions = [
  { value: 'BRV', label: 'Bank Receipt' },
  { value: 'BPV', label: 'Bank Payment' },
  { value: 'CRV', label: 'Cash Receipt' },
  { value: 'CPV', label: 'Cash Payment' },
  { value: 'JV', label: 'Journal Voucher' },
  { value: 'PI', label: 'Purchase Invoice' },
  { value: 'PR', label: 'Purchase Return' },
  { value: 'SI', label: 'Sale Invoice' },
  { value: 'SR', label: 'Sale Return' },
  { value: 'SA', label: 'Stock Adjustment' },
];

const APPROVAL_BADGE: Record<ApprovalStatus, BadgeVariant> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  'Not Required': 'neutral',
};

const STATUS_BADGE: Record<VoucherStatus, BadgeVariant> = {
  Draft: 'neutral',
  Posted: 'success',
  Voided: 'danger',
};

function voucherTypeLabel(type: string) {
  return voucherTypeOptions.find(option => option.value === type)?.label ?? type;
}

export function ApprovalQueuePage() {
  const { data: session } = useSession();
  const userCanApprove = hasPermission(session?.user.role, 'vouchers.approve');
  const { data: generalSettings } = useGeneralSettings();
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const approveVoucher = useApproveVoucher();
  const rejectVoucher = useRejectVoucher();
  const money = useMemo(() => (value: string | number) => formatMoney(value, generalSettings), [generalSettings]);

  const listQuery = useVouchersList({
    page,
    limit: pageSize,
    status: 'Draft',
    approval_status: 'Pending',
    voucher_type: voucherType || undefined,
    search: search || undefined,
  });
  const detailQuery = useVoucherDetail(selectedId ?? undefined);
  const selectedVoucher = detailQuery.data;
  const rows = (listQuery.data?.data ?? []) as ApprovalVoucherRow[];
  const total = listQuery.data?.pagination?.total ?? 0;
  const pages = listQuery.data?.pagination?.pages ?? Math.max(1, Math.ceil(total / pageSize));
  const approvalBusy = approveVoucher.isPending || rejectVoucher.isPending;

  function updateFilter(action: () => void) {
    setMessage(null);
    action();
    setPage(1);
    setSelectedId(null);
    setRejectReason('');
  }

  function applySearch() {
    updateFilter(() => setSearch(searchText.trim()));
  }

  async function approveSelectedVoucher() {
    setApproveConfirmOpen(false);
    if (!selectedVoucher?.id) {
      setMessage({ kind: 'error', text: 'Select a voucher to approve.' });
      return;
    }
    setMessage(null);
    try {
      await approveVoucher.mutateAsync({ id: selectedVoucher.id });
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} approved.` });
      setSelectedId(null);
      setRejectReason('');
      await listQuery.refetch();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not approve Voucher. Please try again.') });
    }
  }

  async function rejectSelectedVoucher() {
    if (!selectedVoucher?.id) {
      setMessage({ kind: 'error', text: 'Select a voucher to reject.' });
      return;
    }
    if (!rejectReason.trim()) {
      setMessage({ kind: 'error', text: 'Enter a Rejection Reason, then reject the voucher.' });
      return;
    }
    setMessage(null);
    try {
      await rejectVoucher.mutateAsync({ id: selectedVoucher.id, reason: rejectReason.trim() });
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} rejected.` });
      setSelectedId(null);
      setRejectReason('');
      await listQuery.refetch();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not reject Voucher. Please try again.') });
    }
  }

  const detail = detailQuery.data;
  // Maker-checker: the backend refuses approval by the person who created or sent the voucher.
  const isOwnVoucher = Boolean(session?.user.id && detail
    && (detail.created_by === session.user.id || detail.approval_requested_by === session.user.id));
  const approvalBlockedReason = !userCanApprove
    ? 'Your role cannot approve or reject vouchers.'
    : isOwnVoucher
      ? 'You created or sent this voucher for approval, so another approver must approve or reject it.'
      : null;
  const detailLines = (detail?.lines ?? []) as ApprovalVoucherLine[];
  const totalDebit = detailLines.reduce((acc, line) => acc + (Number(line.dr_amount) || 0), 0);
  const totalCredit = detailLines.reduce((acc, line) => acc + (Number(line.cr_amount) || 0), 0);
  const approvalStatus = (detail?.approval_status || 'Pending') as ApprovalStatus;
  const isFiltered = Boolean(search || voucherType);
  const refreshing = listQuery.isFetching && !listQuery.isLoading;

  function clearFilters() {
    updateFilter(() => {
      setSearchText('');
      setSearch('');
      setVoucherType('');
    });
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Approvals"
        description="Vouchers waiting for a decision. Select a voucher to check its lines, then approve it or reject it with a reason."
        help={(
          <>
            <p>This screen lists vouchers that are waiting for your approval.</p>
            <ul>
              <li>Select a voucher to see its lines on the right.</li>
              <li>Approve lets the voucher be posted to the ledger.</li>
              <li>Reject Voucher sends it back. You must enter a Rejection Reason first.</li>
            </ul>
            <p>You cannot approve a voucher that you created or sent for approval. Another approver must do it.</p>
          </>
        )}
        actions={<Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={() => listQuery.refetch()} loading={refreshing}>Refresh</Button>}
      />

      {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'} onDismiss={() => setMessage(null)}>{message.text}</InlineAlert>}
      {listQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(listQuery.error, 'Could not load Pending Approvals. Please try again.')}</InlineAlert>}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField
                label="Search Approvals"
                value={searchText}
                onChange={setSearchText}
                onSubmit={applySearch}
                placeholder="Search by Voucher No., Reference, or Description, then press Enter"
              />
            </div>
            <select
              className="form-input"
              aria-label="Filter By Voucher Type"
              value={voucherType}
              onChange={event => { const value = event.target.value; updateFilter(() => setVoucherType(value)); }}
              style={{ width: 180 }}
            >
              <option value="">All Types</option>
              {voucherTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {(isFiltered || searchText) && <Button variant="ghost" onClick={clearFilters}>Clear</Button>}
            <div className="filter-bar-end">
              <span>{total} Pending</span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Voucher Number</th>
                  <th style={{ width: 110 }}>Date</th>
                  <th style={{ width: 140 }}>Type</th>
                  <th style={{ width: 140 }}>Reference</th>
                  <th>Description</th>
                  <th className="num" style={{ width: 130 }}>Debit</th>
                  <th className="num" style={{ width: 130 }}>Credit</th>
                  <th style={{ width: 100 }}>Approval</th>
                  <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && <TableMessageRow colSpan={9} title="Loading Pending Approvals…" loading />}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  isFiltered
                    ? <TableMessageRow colSpan={9} title="No Approvals Match" description="Change the search text or the Voucher Type to see more vouchers." />
                    : <TableMessageRow colSpan={9} title="Nothing Waiting For Approval" description="Vouchers that need approval will show here. Select Refresh to check again." action={<Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={() => listQuery.refetch()}>Refresh</Button>} />
                )}
                {!listQuery.isLoading && rows.map(row => (
                  <tr key={row.id} className={selectedId === row.id ? 'is-selected' : undefined} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(row.id)}>
                    <td className="cell-strong">{row.voucher_number}</td>
                    <td>{formatDate(row.voucher_date, generalSettings)}</td>
                    <td>{voucherTypeLabel(row.voucher_type)}</td>
                    <td className={row.reference ? undefined : 'cell-muted'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reference || 'Not Set'}</td>
                    <td className={row.narration ? undefined : 'cell-muted'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.narration || 'Not Set'}</td>
                    <td className="num">{money(row.total_debit)}</td>
                    <td className="num">{money(row.total_credit)}</td>
                    <td><Badge variant={APPROVAL_BADGE[row.approval_status] ?? 'warning'}>{row.approval_status || 'Pending'}</Badge></td>
                    <td className="cell-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconEye size={16} stroke={1.8} />}
                        onClick={event => { event.stopPropagation(); setSelectedId(row.id); }}
                        aria-label={`View Voucher ${row.voucher_number}`}
                        title="View Voucher Details For Approval"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            totalPages={pages}
            totalRecords={total}
            pageSize={pageSize}
            recordLabel={total === 1 ? 'Approval' : 'Approvals'}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); }}
          />
        </section>

        {selectedId && (
          <Drawer
            open={true}
            title="Voucher Details"
            size="lg"
            onClose={() => setSelectedId(null)}
            headerActions={
              detail && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<IconPrinter size={16} stroke={1.8} />}
                  onClick={() => window.print()}
                  aria-label="Print Voucher"
                  title="Print Voucher"
                />
              )
            }
            footer={(
              <>
                <Button
                  variant="secondary"
                  icon={<IconThumbDown size={16} stroke={1.8} />}
                  onClick={rejectSelectedVoucher}
                  disabled={approvalBusy || !rejectReason.trim() || !detail || Boolean(approvalBlockedReason)}
                  loading={rejectVoucher.isPending}
                >
                  Reject Voucher
                </Button>
                <Button
                  variant="primary"
                  icon={<IconThumbUp size={16} stroke={1.8} />}
                  onClick={() => setApproveConfirmOpen(true)}
                  disabled={approvalBusy || !detail || Boolean(approvalBlockedReason)}
                  loading={approveVoucher.isPending}
                >
                  Approve
                </Button>
              </>
            )}
          >
            {detailQuery.isLoading && <p className="form-hint" style={{ margin: 0 }}>Loading Approval Detail…</p>}
            {detailQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(detailQuery.error, 'Could not load Approval Detail. Please try again.')}</InlineAlert>}
            {detail && approvalBlockedReason && <InlineAlert tone="info">{approvalBlockedReason}</InlineAlert>}
            {detail && (
              <>
                <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 16px' }}>
                  {[
                    { label: 'Voucher No.', value: detail.voucher_number },
                    { label: 'Date', value: formatDate(detail.voucher_date, generalSettings) },
                    { label: 'Type', value: voucherTypeLabel(detail.voucher_type) },
                    { label: 'Reference', value: detail.reference || '' },
                  ].map(item => (
                    <div key={item.label} className="detail-row">
                      <dt>{item.label}</dt>
                      <dd style={item.value ? undefined : { color: 'var(--color-text-muted)' }}>{item.value || 'Not Set'}</dd>
                    </div>
                  ))}
                  <div className="detail-row">
                    <dt>Approval</dt>
                    <dd><Badge variant={APPROVAL_BADGE[approvalStatus] ?? 'warning'}>{approvalStatus}</Badge></dd>
                  </div>
                  <div className="detail-row">
                    <dt>Status</dt>
                    <dd><Badge variant={STATUS_BADGE[detail.status as VoucherStatus] ?? 'neutral'}>{detail.status}</Badge></dd>
                  </div>
                  <div className="detail-row detail-row-full">
                    <dt>Description</dt>
                    <dd style={detail.narration ? undefined : { color: 'var(--color-text-muted)' }}>{detail.narration || 'Not Set'}</dd>
                  </div>
                </dl>

                <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius)', overflow: 'auto', flexShrink: 0 }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th className="num" style={{ width: 44 }}>No.</th>
                        <th>Account</th>
                        <th className="num" style={{ width: 120 }}>Debit</th>
                        <th className="num" style={{ width: 120 }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.length === 0 && <TableMessageRow colSpan={4} title="No Lines" description="This voucher has no lines to review." />}
                      {detailLines.map(line => (
                        <tr key={line.id}>
                          <td className="num cell-muted">{line.line_no}</td>
                          <td className="cell-stack">
                            <span className="code-chip">{line.account_code}</span>
                            <span className="cell-strong" style={{ marginLeft: 6 }}>{line.account_name}</span>
                          </td>
                          <td className="num">{Number(line.dr_amount) > 0 ? money(line.dr_amount) : ''}</td>
                          <td className="num">{Number(line.cr_amount) > 0 ? money(line.cr_amount) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <DetailTotals
                  items={[
                    ['Total Debit', money(totalDebit)],
                    ['Total Credit', money(totalCredit)],
                  ]}
                />

                <div>
                  <TextareaField
                    label="Rejection Reason"
                    value={rejectReason}
                    onChange={setRejectReason}
                    placeholder="Needed only when you reject this voucher"
                    disabled={approvalBusy}
                    rows={2}
                  />
                  <p className="form-hint">Approve needs no reason. To reject, enter a reason first.</p>
                </div>
              </>
            )}
          </Drawer>
        )}
      </div>
      <ConfirmDialog
        open={approveConfirmOpen}
        title="Approve Voucher?"
        message={`Approve ${detail?.voucher_number ?? 'this voucher'} for ${detail ? money(detail.total_debit) : ''}? After approval it can be posted to the ledger.`}
        confirmLabel="Yes, Approve"
        cancelLabel="No"
        variant="primary"
        loading={approveVoucher.isPending}
        onConfirm={approveSelectedVoucher}
        onCancel={() => setApproveConfirmOpen(false)}
      />
    </main>
  );
}
