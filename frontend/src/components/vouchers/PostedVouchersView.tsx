'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowBackUp,
  IconCircleCheck,
  IconEye,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { useCompanyProfile, useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { usePostVoucher, useReverseVoucher, useVoucherDetail, useVouchersList } from '@/lib/api/vouchers';
import { hasPermission } from '@/lib/auth/session-user';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { PostedVoucherPrintPreview } from './PostedVoucherPrintPreview';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import {
  DetailActions,
  DetailFields,
  DetailLinesTable,
  DetailNote,
  DetailTotals,
  DocumentDetailPanel,
  DocumentHeader,
  DocumentMessage,
  DocumentPage,
  PostedListFilters,
  PostedListPanel,
  postedListRowClass,
} from '@/components/documents';

type VoucherType = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN' | 'PI' | 'PR' | 'SI' | 'SR' | 'SA' | 'RV' | 'CL';
type VoucherStatus = 'Draft' | 'Posted' | 'Voided';
type ApprovalStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
type VoucherLifecycleFilter = 'All' | 'Draft' | 'Pending Approval' | 'Approved' | 'Posted' | 'Rejected' | 'Voided';

interface VoucherListRow {
  id: string;
  voucher_number: string;
  voucher_type: VoucherType;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  status: 'Draft' | 'Posted' | 'Voided';
  approval_status: ApprovalStatus;
  total_debit: string;
  total_credit: string;
  posted_at: string | null;
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
  { value: 'CV', label: 'Contra Voucher' },
  { value: 'DN', label: 'Debit Note' },
  { value: 'CN', label: 'Credit Note' },
  { value: 'RV', label: 'Reversal Voucher' },
  { value: 'CL', label: 'Year-End Closing' },
];

// Manual voucher types that can be corrected with a Reversal Voucher from this screen.
const reversibleVoucherTypes = new Set(['BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN']);

const voucherLifecycleOptions: Array<{ value: VoucherLifecycleFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Posted', label: 'Posted' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Voided', label: 'Voided' },
];

const newVoucherLinks = [
  { href: '/vouchers/journal', label: 'Journal' },
  { href: '/vouchers/bank-receipt', label: 'Bank Receipt' },
  { href: '/vouchers/bank-payment', label: 'Bank Payment' },
  { href: '/vouchers/cash-receipt', label: 'Cash Receipt' },
  { href: '/vouchers/cash-payment', label: 'Cash Payment' },
];

function voucherTypeLabel(type: string) {
  return voucherTypeOptions.find(option => option.value === type)?.label ?? type;
}

type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

function statusTone(status: string): BadgeTone {
  if (status === 'Posted' || status === 'Approved') return 'success';
  if (status === 'Voided' || status === 'Rejected') return 'danger';
  if (status === 'Pending Approval') return 'warning';
  if (status === 'All') return 'info';
  return 'neutral';
}

function lifecycleFromInitialStatus(status: VoucherLifecycleFilter): VoucherLifecycleFilter {
  return status;
}

function voucherLifecycleLabel(voucher: { status: string; approval_status?: string | null }) {
  if (voucher.status === 'Voided') return 'Voided';
  if (voucher.status === 'Posted') return 'Posted';
  if (voucher.approval_status === 'Pending') return 'Pending Approval';
  if (voucher.approval_status === 'Approved') return 'Approved';
  if (voucher.approval_status === 'Rejected') return 'Rejected';
  return 'Draft';
}

function lifecycleQuery(lifecycle: VoucherLifecycleFilter): { status?: VoucherStatus; approval_status?: ApprovalStatus } {
  if (lifecycle === 'All') return {};
  if (lifecycle === 'Posted' || lifecycle === 'Voided') return { status: lifecycle };
  if (lifecycle === 'Pending Approval') return { status: 'Draft', approval_status: 'Pending' };
  if (lifecycle === 'Approved') return { status: 'Draft', approval_status: 'Approved' };
  if (lifecycle === 'Rejected') return { status: 'Draft', approval_status: 'Rejected' };
  return { status: 'Draft', approval_status: 'Not Required' };
}

function voucherEditPath(voucher: { id: string; voucher_type: string; status: string; approval_status?: string | null }) {
  if (voucher.status !== 'Draft') return null;
  if (voucher.approval_status === 'Pending' || voucher.approval_status === 'Approved') return null;

  const paths: Record<string, string> = {
    JV: '/vouchers/journal',
    BRV: '/vouchers/bank-receipt',
    BPV: '/vouchers/bank-payment',
    CRV: '/vouchers/cash-receipt',
    CPV: '/vouchers/cash-payment',
  };
  const path = paths[voucher.voucher_type];
  return path ? `${path}?id=${encodeURIComponent(voucher.id)}` : null;
}

export function PostedVouchersView({ initialStatus = 'Draft', initialVoucherId }: { initialStatus?: VoucherLifecycleFilter; initialVoucherId?: string }) {
  const { data: session } = useSession();
  const userCanPost = hasPermission(session?.user.role, 'vouchers.post');
  const userCanReverse = hasPermission(session?.user.role, 'vouchers.reverse');
  const { data: generalSettings } = useGeneralSettings();
  const { data: company } = useCompanyProfile();
  const { defaultVoucherDate } = useDefaultVoucherDate();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [voucherLifecycle, setVoucherLifecycle] = useState<VoucherLifecycleFilter>(lifecycleFromInitialStatus(initialStatus));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(initialVoucherId ?? null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [reverseFormOpen, setReverseFormOpen] = useState(false);
  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const postVoucher = usePostVoucher();
  const reverseVoucher = useReverseVoucher();
  const money = useMemo(() => (value: string | number) => formatMoney(value, generalSettings), [generalSettings]);
  const createDateGuard = usePostingDateGuard(defaultVoucherDate, 'Voucher Date', Boolean(defaultVoucherDate));
  const newVoucherDisabledReason = createDateGuard.isChecking ? 'The Fiscal Year Period is being checked.' : createDateGuard.statusMessage;
  const newVoucherDisabled = createDateGuard.disabled;
  const listTitle = voucherLifecycle === 'All' ? 'Voucher List' : `${voucherLifecycle} Voucher List`;
  const listStatusQuery = lifecycleQuery(voucherLifecycle);

  const listQuery = useVouchersList({
    page,
    limit: pageSize,
    status: listStatusQuery.status,
    approval_status: listStatusQuery.approval_status,
    voucher_type: voucherType || undefined,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = useVoucherDetail(selectedId ?? undefined);
  const selectedVoucher = detailQuery.data;
  const selectedVoucherIsDraft = selectedVoucher?.status === 'Draft';
  const selectedApprovalStatus = (selectedVoucher?.approval_status ?? 'Not Required') as ApprovalStatus;
  const selectedVoucherCanPost = userCanPost && selectedVoucherIsDraft && selectedApprovalStatus === 'Approved';
  const selectedVoucherEditPath = selectedVoucher ? voucherEditPath(selectedVoucher) : null;
  const selectedVoucherLifecycle = selectedVoucher ? voucherLifecycleLabel(selectedVoucher) : null;
  const selectedVoucherCanReverse = userCanReverse
    && selectedVoucher?.status === 'Posted'
    && reversibleVoucherTypes.has(selectedVoucher.voucher_type)
    && !selectedVoucher.reversed_by_voucher_id
    && !selectedVoucher.reversal_of_voucher_id;
  const selectedVoucherNextStep = selectedVoucherLifecycle === 'Pending Approval'
    ? 'This voucher is waiting for approval. Approve it from Approvals, then return here to post it.'
    : selectedVoucherLifecycle === 'Draft'
      ? 'This voucher is a Draft. Edit it and save it for approval before posting.'
      : selectedVoucherLifecycle === 'Rejected'
        ? 'This voucher was rejected. Edit it, correct it, and save for approval again.'
        : selectedVoucherLifecycle === 'Posted'
          ? selectedVoucher?.reversed_by_voucher_id
            ? 'This voucher is posted and was reversed by a Reversal Voucher.'
            : selectedVoucher?.reversal_of_voucher_id
              ? `This is a Reversal Voucher for ${selectedVoucher.reference ?? 'another voucher'}.`
              : selectedVoucherCanReverse
                ? 'This voucher is posted. To correct it, reverse it and enter a new voucher.'
                : 'This voucher is already posted.'
          : selectedVoucherLifecycle === 'Voided'
            ? 'This voucher is voided and cannot be posted.'
            : null;

  useEffect(() => {
    setReverseFormOpen(false);
  }, [selectedId]);

  const rows = (listQuery.data?.data ?? []) as VoucherListRow[];
  const total = listQuery.data?.pagination?.total ?? 0;
  const pages = listQuery.data?.pagination?.pages ?? Math.max(1, Math.ceil(total / pageSize));

  function resetFilters() {
    setSearchText('');
    setSearch('');
    setVoucherType('');
    setVoucherLifecycle(lifecycleFromInitialStatus(initialStatus));
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setPage(1);
    setSelectedId(null);
    setPrintPreviewOpen(false);
    setMessage(null);
  }

  function updateFilter(action: () => void) {
    setMessage(null);
    action();
    setPage(1);
    setSelectedId(null);
    setPrintPreviewOpen(false);
  }

  function applySearch() {
    updateFilter(() => setSearch(searchText.trim()));
  }

  function clearSearch() {
    updateFilter(() => {
      setSearchText('');
      setSearch('');
    });
  }

  function printDetail() {
    if (!detailQuery.data) {
      setMessage({ kind: 'error', text: 'Select a voucher first, then print it.' });
      return;
    }
    setMessage(null);
    setPrintPreviewOpen(true);
  }

  function requestPostSelectedVoucher() {
    if (!selectedVoucher?.id || selectedVoucher.status !== 'Draft') {
      setMessage({ kind: 'error', text: 'Select a Draft voucher first, then post it.' });
      return;
    }
    if (!selectedVoucherCanPost) {
      setMessage({ kind: 'error', text: 'Approve this voucher before posting.' });
      return;
    }
    setPostConfirmOpen(true);
  }

  async function postSelectedVoucher() {
    if (!selectedVoucher?.id || selectedVoucher.status !== 'Draft') {
      setPostConfirmOpen(false);
      setMessage({ kind: 'error', text: 'Select a Draft voucher first, then post it.' });
      return;
    }
    if (!selectedVoucherCanPost) {
      setPostConfirmOpen(false);
      setMessage({ kind: 'error', text: 'Approve this voucher before posting.' });
      return;
    }
    setPostConfirmOpen(false);
    setMessage(null);
    try {
      await postVoucher.mutateAsync({ id: selectedVoucher.id });
      await Promise.all([listQuery.refetch(), detailQuery.refetch()]);
      setVoucherLifecycle('Posted');
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} posted.` });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not post Voucher. Please try again.') });
    }
  }

  function openReverseForm() {
    setMessage(null);
    setReversalDate(defaultVoucherDate || '');
    setReversalReason('');
    setReverseFormOpen(true);
  }

  function requestReverseSelectedVoucher() {
    if (!selectedVoucherCanReverse) {
      setMessage({ kind: 'error', text: 'You can reverse only Posted vouchers entered by hand that are not reversed yet.' });
      return;
    }
    if (!reversalDate) {
      setMessage({ kind: 'error', text: 'Reversal Date is required.' });
      return;
    }
    if (!reversalReason.trim()) {
      setMessage({ kind: 'error', text: 'Reversal Reason is required.' });
      return;
    }
    setMessage(null);
    setReverseConfirmOpen(true);
  }

  async function reverseSelectedVoucher() {
    setReverseConfirmOpen(false);
    if (!selectedVoucher?.id) return;
    try {
      const reversal = await reverseVoucher.mutateAsync({
        id: selectedVoucher.id,
        reversal_date: reversalDate,
        reason: reversalReason.trim(),
      });
      setReverseFormOpen(false);
      await Promise.all([listQuery.refetch(), detailQuery.refetch()]);
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} reversed by ${reversal?.voucher_number ?? 'a Reversal Voucher'}.` });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not reverse Voucher. Please try again.') });
    }
  }

  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;

  if (printPreviewOpen && detailQuery.data) {
    return (
      <div className="page-shell">
        <PostedVoucherPrintPreview
          voucher={detailQuery.data}
          company={company}
          generalSettings={generalSettings}
          money={money}
          onBack={() => setPrintPreviewOpen(false)}
          onError={text => setMessage({ kind: 'error', text })}
        />
      </div>
    );
  }

  return (
    <DocumentPage>
      <DocumentHeader
        title={listTitle}
        help={(
          <>
            <p>Use this screen to find vouchers and see their details.</p>
            <ul>
              <li>Use the filters to find vouchers by type, status, date or amount.</li>
              <li>Select a voucher to see its lines. You can edit a Draft, post an Approved voucher, or reverse a Posted one.</li>
              <li>A voucher must be approved before you can post it.</li>
            </ul>
            <p>Posted vouchers cannot be changed. Use Reverse to correct them.</p>
          </>
        )}
        badges={(
          <>
            <Badge variant={statusTone(voucherLifecycle)}>{voucherLifecycle}</Badge>
            <Badge variant="neutral">{total} Record{total === 1 ? '' : 's'}</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={() => listQuery.refetch()}>Refresh</Button>
            {newVoucherLinks.map(link => (
              newVoucherDisabled ? (
                <Button key={link.href} variant="secondary" icon={<IconFilePlus {...iconProps} />} disabled title={newVoucherDisabledReason}>
                  {link.label}
                </Button>
              ) : (
                <Link key={link.href} href={link.href} className="btn-secondary" title={`New ${link.label} Voucher`}>
                  <IconFilePlus {...iconProps} /> {link.label}
                </Link>
              )
            ))}
          </>
        )}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <PostedListPanel
        filters={(
          <PostedListFilters label="Voucher Filters">
            <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Voucher No., Reference, Description" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
            <Button variant="secondary" onClick={applySearch} loading={listQuery.isFetching}>Search</Button>
            <Button variant="ghost" onClick={clearSearch} disabled={listQuery.isFetching || (!search && !searchText)}>Clear</Button>
            <SelectField
              label="Voucher Type"
              value={voucherType}
              onChange={value => updateFilter(() => setVoucherType(value))}
              options={voucherTypeOptions}
              placeholder="All Types"
            />
            <SelectField
              label="Status"
              value={voucherLifecycle}
              onChange={value => updateFilter(() => setVoucherLifecycle(value as VoucherLifecycleFilter))}
              options={voucherLifecycleOptions}
            />
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} />
            <NumericField label="Amount From" value={amountFrom} onChange={value => updateFilter(() => setAmountFrom(value))} />
            <NumericField label="Amount To" value={amountTo} onChange={value => updateFilter(() => setAmountTo(value))} />
            <Button variant="ghost" onClick={resetFilters}>Clear Filters</Button>
          </PostedListFilters>
        )}
        table={(
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 900 }}>
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 128 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 76 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Voucher &amp; Type</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={8} title="Loading Vouchers…" loading />}
              {listQuery.error && (
                <TableMessageRow colSpan={8} title="Could Not Load Vouchers" description={friendlyErrorMessage(listQuery.error, 'Could not load Vouchers. Please try again.')} />
              )}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                <TableMessageRow colSpan={8} title="No Vouchers Found" description="Change or clear the filters to see more vouchers." />
              )}
              {rows.map(row => {
                const editPath = voucherEditPath(row);
                const lifecycle = voucherLifecycleLabel(row);
                return (
                  <tr key={row.id} className={`${postedListRowClass}${selectedId === row.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                    <td className="cell-strong" style={{ whiteSpace: 'nowrap' }}>
                      <span>{row.voucher_number}</span>
                      <span className="cell-muted" style={{ fontWeight: 400, marginLeft: 6 }}>· {voucherTypeLabel(row.voucher_type)}</span>
                    </td>
                    <td>{formatDate(row.voucher_date, generalSettings)}</td>
                    <td className={row.reference ? undefined : 'cell-muted'}>{row.reference || 'Not Set'}</td>
                    <td className={row.narration ? undefined : 'cell-muted'} title={row.narration ?? undefined}>{row.narration || 'Not Set'}</td>
                    <td className="num">{money(row.total_debit)}</td>
                    <td className="num">{money(row.total_credit)}</td>
                    <td><Badge variant={statusTone(lifecycle)}>{lifecycle}</Badge></td>
                    <td className="cell-actions">
                      <span className="row-actions">
                        <Button variant="ghost" size="sm" icon={<IconEye {...iconProps} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Voucher ${row.voucher_number}`} title="View Voucher" />
                        {editPath && (
                          <Link href={editPath} className="btn-ghost btn-sm btn-icon" onClick={event => event.stopPropagation()} aria-label={`Edit Draft Voucher ${row.voucher_number}`} title="Edit Draft Voucher">
                            <IconPencil {...iconProps} />
                          </Link>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        detail={selectedId && (
          <DocumentDetailPanel
            title="Voucher Details"
            loading={detailQuery.isLoading}
            loadingText="Loading Voucher Details…"
            error={detailQuery.error ? friendlyErrorMessage(detailQuery.error, 'Could not load Voucher Details. Please try again.') : undefined}
            onClose={() => setSelectedId(null)}
            actions={selectedVoucher && (
              <>
                {selectedVoucherEditPath && (
                  <Link href={selectedVoucherEditPath} className="btn-ghost btn-sm btn-icon" aria-label="Edit Draft Voucher" title="Edit Draft Voucher">
                    <IconPencil {...iconProps} />
                  </Link>
                )}
                <Button variant="ghost" size="sm" icon={<IconPrinter {...iconProps} />} onClick={printDetail} aria-label="Print Voucher" title="Print Voucher" />
              </>
            )}
          >
            {selectedVoucher && (
              <>
                <DetailFields
                  items={[
                    ['Voucher No.', selectedVoucher.voucher_number],
                    ['Date', formatDate(selectedVoucher.voucher_date, generalSettings)],
                    ['Type', voucherTypeLabel(selectedVoucher.voucher_type)],
                    ['Status', <Badge key="status" variant={statusTone(voucherLifecycleLabel(selectedVoucher))}>{voucherLifecycleLabel(selectedVoucher)}</Badge>],
                    ['Reference', selectedVoucher.reference],
                    ['Posted At', selectedVoucher.posted_at ? formatDate(selectedVoucher.posted_at, generalSettings) : ''],
                    ['Description', selectedVoucher.narration],
                  ]}
                />
                <DetailLinesTable>
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col />
                    <col style={{ width: 96 }} />
                    <col style={{ width: 96 }} />
                  </colgroup>
                  <thead>
                    <tr><th className="num">No.</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr>
                  </thead>
                  <tbody>
                    {(selectedVoucher.lines ?? []).map((line: any) => (
                      <tr key={line.id}>
                        <td className="num cell-muted">{line.line_no}</td>
                        <td title={`${line.account_code} - ${line.account_name}`}>{line.account_code} - {line.account_name}</td>
                        <td className="num">{Number(line.dr_amount) > 0 ? money(line.dr_amount) : ''}</td>
                        <td className="num">{Number(line.cr_amount) > 0 ? money(line.cr_amount) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </DetailLinesTable>
                <DetailTotals
                  items={[
                    ['Total Debit', money(String(selectedVoucher.total_debit))],
                    ['Total Credit', money(String(selectedVoucher.total_credit))],
                  ]}
                />

                {selectedVoucherNextStep && (
                  <DetailNote>
                    <span>{selectedVoucherNextStep}</span>
                    {selectedVoucherLifecycle === 'Pending Approval' && (
                      <Link href="/approvals" className="btn-secondary">Open Approvals</Link>
                    )}
                  </DetailNote>
                )}

                <DetailActions>
                  {selectedVoucherCanPost && (
                    <Button variant="primary" icon={<IconCircleCheck {...iconProps} />} onClick={requestPostSelectedVoucher} loading={postVoucher.isPending}>
                      Post Voucher
                    </Button>
                  )}
                  {selectedVoucherEditPath && (
                    <Link href={selectedVoucherEditPath} className="btn-secondary">
                      <IconPencil {...iconProps} /> Edit Draft Voucher
                    </Link>
                  )}
                  {selectedVoucherCanReverse && !reverseFormOpen && (
                    <Button variant="secondary" icon={<IconArrowBackUp {...iconProps} />} onClick={openReverseForm}>
                      Reverse Voucher
                    </Button>
                  )}
                  {selectedVoucherCanReverse && reverseFormOpen && (
                    <DetailNote>
                      <DateField label="Reversal Date" value={reversalDate} onChange={setReversalDate} required />
                      <TextField label="Reversal Reason" value={reversalReason} onChange={setReversalReason} required placeholder="Why is this voucher reversed?" />
                      <span className="row-actions">
                        <Button variant="primary" onClick={requestReverseSelectedVoucher} loading={reverseVoucher.isPending}>Reverse Voucher</Button>
                        <Button variant="ghost" onClick={() => setReverseFormOpen(false)} disabled={reverseVoucher.isPending}>Cancel</Button>
                      </span>
                    </DetailNote>
                  )}
                </DetailActions>
              </>
            )}
          </DocumentDetailPanel>
        )}
        pagination={(
          <PaginationBar
            page={page}
            totalPages={pages}
            totalRecords={total}
            pageSize={pageSize}
            recordLabel={total === 1 ? 'Voucher' : 'Vouchers'}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); }}
          />
        )}
      />
      <ConfirmDialog
        open={postConfirmOpen}
        title="Post Voucher?"
        message={`Post ${selectedVoucher?.voucher_number ?? 'this voucher'}? Posted vouchers cannot be changed. Use Reverse to correct them.`}
        confirmLabel="Yes, Post Voucher"
        cancelLabel="No"
        variant="warning"
        loading={postVoucher.isPending}
        onConfirm={postSelectedVoucher}
        onCancel={() => setPostConfirmOpen(false)}
      />
      <ConfirmDialog
        open={reverseConfirmOpen}
        title="Reverse Voucher?"
        message={`Post a Reversal Voucher dated ${reversalDate ? formatDate(reversalDate, generalSettings) : 'Not Set'} to cancel ${selectedVoucher?.voucher_number ?? 'this voucher'}? Both vouchers stay in the Ledger. You cannot undo this.`}
        confirmLabel="Yes, Reverse Voucher"
        cancelLabel="No"
        variant="warning"
        loading={reverseVoucher.isPending}
        onConfirm={reverseSelectedVoucher}
        onCancel={() => setReverseConfirmOpen(false)}
      />
    </DocumentPage>
  );
}
