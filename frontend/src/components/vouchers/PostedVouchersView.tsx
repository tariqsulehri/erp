'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  IconCircleCheck,
  IconCircleX,
  IconEye,
  IconFileInvoice,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { useCompanyProfile, useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { usePostVoucher, useVoucherDetail, useVouchersList } from '@/lib/api/vouchers';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { PostedVoucherPrintPreview } from './PostedVoucherPrintPreview';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import {
  badgeStyle,
  compactButtonStyle,
  detailMessageStyle,
  lineActionButtonStyle,
  messageStyle,
  purchaseDetailPanelStyle,
  purchaseListFooterStyle,
  statusBadgeStyle,
  tableCellStyle,
  tableHeadStyle,
  titleIconStyle,
  toolbarStyle,
} from '@/components/purchases/PurchaseVoucherStyles';

type VoucherType = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN' | 'PI';
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
  { value: 'CV', label: 'Contra Voucher' },
  { value: 'DN', label: 'Debit Note' },
  { value: 'CN', label: 'Credit Note' },
];

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

function statusBadge(status: string) {
  const colors = status === 'Posted' || status === 'Approved'
    ? ['#166534', '#dcfce7']
    : status === 'Voided' || status === 'Rejected'
      ? ['#991b1b', '#fee2e2']
      : status === 'Pending Approval'
        ? ['#92400e', '#fef3c7']
        : status === 'All'
          ? ['#1d4ed8', '#dbeafe']
          : ['#475569', '#f1f5f9'];
  return badgeStyle(colors[0], colors[1]);
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

export function PostedVouchersView({ initialStatus = 'Draft' }: { initialStatus?: VoucherLifecycleFilter }) {
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const postVoucher = usePostVoucher();
  const money = useMemo(() => (value: string | number) => formatMoney(value, generalSettings), [generalSettings]);
  const createDateGuard = usePostingDateGuard(defaultVoucherDate, 'Voucher Date', Boolean(defaultVoucherDate));
  const newVoucherDisabledReason = createDateGuard.isChecking ? 'Fiscal period is being checked.' : createDateGuard.statusMessage;
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
  const selectedVoucherCanPost = selectedVoucherIsDraft && selectedApprovalStatus === 'Approved';
  const selectedVoucherEditPath = selectedVoucher ? voucherEditPath(selectedVoucher) : null;
  const selectedVoucherLifecycle = selectedVoucher ? voucherLifecycleLabel(selectedVoucher) : null;
  const selectedVoucherNextStep = selectedVoucherLifecycle === 'Pending Approval'
    ? 'This voucher is waiting for approval. Approve it from Approvals, then return here to post it.'
    : selectedVoucherLifecycle === 'Draft'
      ? 'This voucher is still Draft. Edit it and save for approval before posting.'
      : selectedVoucherLifecycle === 'Rejected'
        ? 'This voucher was rejected. Edit it, correct it, and save for approval again.'
        : selectedVoucherLifecycle === 'Posted'
          ? 'This voucher is already posted.'
          : selectedVoucherLifecycle === 'Voided'
            ? 'This voucher is voided and cannot be posted.'
            : null;

  const rows = (listQuery.data?.data ?? []) as VoucherListRow[];
  const total = listQuery.data?.pagination?.total ?? 0;
  const pages = listQuery.data?.pagination?.pages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

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
      setMessage({ kind: 'error', text: 'Please select a voucher before printing.' });
      return;
    }
    setMessage(null);
    setPrintPreviewOpen(true);
  }

  function requestPostSelectedVoucher() {
    if (!selectedVoucher?.id || selectedVoucher.status !== 'Draft') {
      setMessage({ kind: 'error', text: 'Please select a Draft voucher before posting.' });
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
      setMessage({ kind: 'error', text: 'Please select a Draft voucher before posting.' });
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
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} posted successfully.` });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to post Voucher.') });
    }
  }

  if (printPreviewOpen && detailQuery.data) {
    return (
      <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, overflow: 'hidden' }}>
        <PostedVoucherPrintPreview
          voucher={detailQuery.data}
          company={company}
          generalSettings={generalSettings}
          money={money}
          onBack={() => setPrintPreviewOpen(false)}
          onError={text => setMessage({ kind: 'error', text })}
        />
      </main>
    );
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconFileInvoice size={20} stroke={1.8} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>{listTitle}</h1>
              <span style={statusBadge(voucherLifecycle)}>{voucherLifecycle}</span>
              <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={() => listQuery.refetch()} style={compactButtonStyle}>
              <IconRefresh size={15} /> Refresh
            </button>
            {newVoucherLinks.map(link => (
              newVoucherDisabled ? (
                <button
                  key={link.href}
                  type="button"
                  className="btn-secondary"
                  disabled
                  title={newVoucherDisabledReason}
                  style={compactButtonStyle}
                >
                  <IconFilePlus size={15} /> {link.label}
                </button>
              ) : (
                <Link key={link.href} href={link.href} className="btn-secondary" style={{ ...compactButtonStyle, textDecoration: 'none' }}>
                  <IconFilePlus size={15} /> {link.label}
                </Link>
              )
            ))}
          </div>
        </div>
      </section>

      {message && (
        <div style={messageStyle(message.kind)}>
          <IconFileInvoice size={18} />
          {message.text}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) 84px 76px 145px 112px 118px 118px 112px 112px auto', gap: 7, alignItems: 'end' }}>
          <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Voucher No., Reference, Description" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
          <button type="button" className="btn-secondary" onClick={applySearch} disabled={listQuery.isFetching} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            {listQuery.isFetching && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
            {listQuery.isFetching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" className="btn-secondary" onClick={clearSearch} disabled={listQuery.isFetching || (!search && !searchText)} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            Clear
          </button>
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
          <button type="button" className="btn-secondary" onClick={resetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            Clear Filters
          </button>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0, 1fr) 420px' : '1fr', gap: 8, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 130 }} />
                <col />
                <col style={{ width: 118 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 86 }} />
                <col style={{ width: 78 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Voucher Number', 'Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Status', 'Actions'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index === 5 || index === 6)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Loading Vouchers...
                    </td>
                  </tr>
                )}
                {listQuery.error && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>
                      {friendlyErrorMessage(listQuery.error, 'Unable to load Vouchers.')}
                    </td>
                  </tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      No vouchers found for the selected filters.
                    </td>
                  </tr>
                )}
                {rows.map(row => {
                  const active = selectedId === row.id;
                  const editPath = voucherEditPath(row);
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                      <td style={tableCellStyle()}><strong>{row.voucher_number}</strong></td>
                      <td style={tableCellStyle()}>{formatDate(row.voucher_date, generalSettings)}</td>
                      <td style={tableCellStyle()}>{voucherTypeLabel(row.voucher_type)}</td>
                      <td style={tableCellStyle()}>{row.reference || '-'}</td>
                      <td style={tableCellStyle()}>{row.narration || '-'}</td>
                      <td style={tableCellStyle(true)}>{money(row.total_debit)}</td>
                      <td style={tableCellStyle(true)}>{money(row.total_credit)}</td>
                      <td style={tableCellStyle()}><span style={statusBadge(voucherLifecycleLabel(row))}>{voucherLifecycleLabel(row)}</span></td>
                      <td style={tableCellStyle()}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Voucher" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                            <IconEye size={15} />
                          </button>
                          {editPath && (
                            <Link href={editPath} className="btn-ghost" onClick={event => event.stopPropagation()} title="Edit Draft Voucher" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28, textDecoration: 'none' }}>
                              <IconPencil size={15} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedId && (
            <aside style={purchaseDetailPanelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Voucher Detail</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  {detailQuery.data && (
                    <>
                      {selectedVoucherCanPost && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={requestPostSelectedVoucher}
                          disabled={postVoucher.isPending}
                          title="Post Voucher"
                          style={{ ...lineActionButtonStyle, width: 28, minWidth: 28, color: 'var(--color-success)' }}
                        >
                          {postVoucher.isPending ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <IconCircleCheck size={15} />}
                        </button>
                      )}
                      {selectedVoucherEditPath && (
                        <Link
                          href={selectedVoucherEditPath}
                          className="btn-ghost"
                          title="Edit Draft Voucher"
                          style={{ ...lineActionButtonStyle, width: 28, minWidth: 28, textDecoration: 'none' }}
                        >
                          <IconPencil size={15} />
                        </Link>
                      )}
                      <button type="button" className="btn-ghost" onClick={printDetail} title="Print Voucher" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                        <IconPrinter size={15} />
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} title="Close Detail" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                    <IconCircleX size={15} />
                  </button>
                </div>
              </div>

              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading voucher detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Voucher Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Voucher No.', detailQuery.data.voucher_number],
                      ['Date', formatDate(detailQuery.data.voucher_date, generalSettings)],
                      ['Type', voucherTypeLabel(detailQuery.data.voucher_type)],
                      ['Status', voucherLifecycleLabel(detailQuery.data)],
                      ['Reference', detailQuery.data.reference || '-'],
                      ['Posted At', detailQuery.data.posted_at ? formatDate(detailQuery.data.posted_at, generalSettings) : '-'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 7px', minWidth: 0 }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.62rem', fontWeight: 800 }}>{label}</div>
                        <div style={{ color: 'var(--color-text)', fontSize: '0.73rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 7px' }}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.62rem', fontWeight: 800 }}>Description</div>
                    <div style={{ color: 'var(--color-text)', fontSize: '0.73rem', fontWeight: 700 }}>{detailQuery.data.narration || '-'}</div>
                  </div>

                  <div style={{ minHeight: 0, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: 34 }} />
                        <col />
                        <col style={{ width: 82 }} />
                        <col style={{ width: 82 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {['No.', 'Account', 'Debit', 'Credit'].map((label, index) => (
                            <th key={label} style={tableHeadStyle(index >= 2)}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data.lines ?? []).map((line: any) => (
                          <tr key={line.id}>
                            <td style={tableCellStyle()}>{line.line_no}</td>
                            <td style={tableCellStyle()}>{line.account_code} - {line.account_name}</td>
                            <td style={tableCellStyle(true)}>{Number(line.dr_amount) > 0 ? money(line.dr_amount) : '-'}</td>
                            <td style={tableCellStyle(true)}>{Number(line.cr_amount) > 0 ? money(line.cr_amount) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    {[
                      ['Total Debit', detailQuery.data.total_debit],
                      ['Total Credit', detailQuery.data.total_credit],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--color-text-secondary)', fontSize: '0.76rem', fontWeight: 800 }}>
                        <span>{label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{money(String(value))}</span>
                      </div>
                    ))}
                  </div>

                  {selectedVoucherNextStep && (
                    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '7px 8px', display: 'grid', gap: 7 }}>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem', fontWeight: 800, lineHeight: 1.35 }}>
                        {selectedVoucherNextStep}
                      </div>
                      {selectedVoucherLifecycle === 'Pending Approval' && (
                        <Link
                          href="/approvals"
                          className="btn-secondary"
                          style={{ ...compactButtonStyle, justifyContent: 'center', minHeight: 32, textDecoration: 'none' }}
                        >
                          Open Approvals
                        </Link>
                      )}
                    </div>
                  )}

                  {selectedVoucherCanPost && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={requestPostSelectedVoucher}
                      disabled={postVoucher.isPending}
                      style={{ ...compactButtonStyle, justifyContent: 'center', minHeight: 34 }}
                    >
                      {postVoucher.isPending ? (
                        <>
                          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.35)' }} />
                          Posting...
                        </>
                      ) : (
                        <>
                          <IconCircleCheck size={15} />
                          Post Voucher
                        </>
                      )}
                    </button>
                  )}
                  {selectedVoucherEditPath && (
                    <Link
                      href={selectedVoucherEditPath}
                      className="btn-secondary"
                      style={{ ...compactButtonStyle, justifyContent: 'center', minHeight: 34, textDecoration: 'none' }}
                    >
                      <IconPencil size={15} />
                      Edit Draft Voucher
                    </Link>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        <PaginationBar
          page={page}
          totalPages={pages}
          totalRecords={total}
          pageSize={pageSize}
          recordLabel={total === 1 ? 'Voucher' : 'Vouchers'}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value); setPage(1); }}
        />
      </section>
      <ConfirmDialog
        open={postConfirmOpen}
        title="Post Voucher?"
        message={`Post ${selectedVoucher?.voucher_number ?? 'this voucher'}? Posted vouchers cannot be edited directly.`}
        confirmLabel="Yes, Post Voucher"
        cancelLabel="No"
        variant="warning"
        loading={postVoucher.isPending}
        onConfirm={postSelectedVoucher}
        onCancel={() => setPostConfirmOpen(false)}
      />
    </main>
  );
}
