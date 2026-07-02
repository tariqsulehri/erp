'use client';

import { useMemo, useState } from 'react';
import {
  IconCircleX,
  IconClipboardCheck,
  IconEye,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
} from '@tabler/icons-react';
import { TextField, SelectField, fieldStyle } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { useApproveVoucher, useRejectVoucher, useVoucherDetail, useVouchersList } from '@/lib/api/vouchers';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import {
  badgeStyle,
  compactButtonStyle,
  detailMessageStyle,
  lineActionButtonStyle,
  messageStyle,
  purchaseDetailPanelStyle,
  statusBadgeStyle,
  tableCellStyle,
  tableHeadStyle,
  titleIconStyle,
  toolbarStyle,
} from '@/components/purchases/PurchaseVoucherStyles';

type VoucherType = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN' | 'PI' | 'PR' | 'SI' | 'SR' | 'SA';

interface ApprovalVoucherRow {
  id: string;
  voucher_number: string;
  voucher_type: VoucherType;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  status: 'Draft' | 'Posted' | 'Voided';
  approval_status: 'Pending' | 'Approved' | 'Rejected' | 'Not Required';
  total_debit: string;
  total_credit: string;
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

function voucherTypeLabel(type: string) {
  return voucherTypeOptions.find(option => option.value === type)?.label ?? type;
}

function pendingBadge() {
  return badgeStyle('#92400e', '#fef3c7');
}

export function ApprovalQueuePage() {
  const { data: generalSettings } = useGeneralSettings();
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

  function clearSearch() {
    updateFilter(() => {
      setSearchText('');
      setSearch('');
    });
  }

  async function approveSelectedVoucher() {
    if (!selectedVoucher?.id) {
      setMessage({ kind: 'error', text: 'Please select a voucher to approve.' });
      return;
    }
    setMessage(null);
    try {
      await approveVoucher.mutateAsync({ id: selectedVoucher.id });
      setMessage({ kind: 'success', text: `${selectedVoucher.voucher_number} approved successfully.` });
      setSelectedId(null);
      setRejectReason('');
      await listQuery.refetch();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to approve Voucher.') });
    }
  }

  async function rejectSelectedVoucher() {
    if (!selectedVoucher?.id) {
      setMessage({ kind: 'error', text: 'Please select a voucher to reject.' });
      return;
    }
    if (!rejectReason.trim()) {
      setMessage({ kind: 'error', text: 'Rejection Reason is required.' });
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
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to reject Voucher.') });
    }
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconClipboardCheck size={20} stroke={1.8} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Approvals</h1>
              <span style={pendingBadge()}>Pending</span>
              <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching} style={compactButtonStyle}>
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
      </section>

      {message && (
        <div style={messageStyle(message.kind)}>
          <IconClipboardCheck size={18} />
          {message.text}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 88px 76px 165px auto', gap: 7, alignItems: 'end' }}>
          <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Voucher No., Reference, Description" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
          <button type="button" className="btn-secondary" onClick={applySearch} disabled={listQuery.isFetching} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
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
          <button type="button" className="btn-secondary" onClick={() => updateFilter(() => setVoucherType(''))} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
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
                <col style={{ width: 58 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Voucher Number', 'Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Approval', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index === 5 || index === 6)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Loading Pending Approvals...
                    </td>
                  </tr>
                )}
                {listQuery.error && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>
                      {friendlyErrorMessage(listQuery.error, 'Unable to load Pending Approvals.')}
                    </td>
                  </tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      No vouchers are waiting for approval.
                    </td>
                  </tr>
                )}
                {rows.map(row => {
                  const active = selectedId === row.id;
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                      <td style={tableCellStyle()}><strong>{row.voucher_number}</strong></td>
                      <td style={tableCellStyle()}>{formatDate(row.voucher_date, generalSettings)}</td>
                      <td style={tableCellStyle()}>{voucherTypeLabel(row.voucher_type)}</td>
                      <td style={tableCellStyle()}>{row.reference || '-'}</td>
                      <td style={tableCellStyle()}>{row.narration || '-'}</td>
                      <td style={tableCellStyle(true)}>{money(row.total_debit)}</td>
                      <td style={tableCellStyle(true)}>{money(row.total_credit)}</td>
                      <td style={tableCellStyle()}><span style={pendingBadge()}>Pending</span></td>
                      <td style={tableCellStyle()}>
                        <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Approval" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                          <IconEye size={15} />
                        </button>
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
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Approval Detail</strong>
                <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} title="Close Detail" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                  <IconCircleX size={15} />
                </button>
              </div>

              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading approval detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Approval Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Voucher No.', detailQuery.data.voucher_number],
                      ['Date', formatDate(detailQuery.data.voucher_date, generalSettings)],
                      ['Type', voucherTypeLabel(detailQuery.data.voucher_type)],
                      ['Approval', detailQuery.data.approval_status || 'Pending'],
                      ['Reference', detailQuery.data.reference || '-'],
                      ['Status', detailQuery.data.status],
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

                  <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '7px', display: 'grid', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-heading)', fontSize: '0.74rem', fontWeight: 850 }}>Decision</span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={approveSelectedVoucher}
                        disabled={approvalBusy}
                        style={{ ...compactButtonStyle, minHeight: 28 }}
                      >
                        <IconThumbUp size={14} /> Approve
                      </button>
                    </div>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.64rem', fontWeight: 850 }}>Rejection Reason</span>
                      <textarea
                        className="form-input"
                        value={rejectReason}
                        onChange={event => setRejectReason(event.currentTarget.value)}
                        placeholder="Reason required only when rejecting"
                        disabled={approvalBusy}
                        rows={2}
                        style={{ ...fieldStyle(), resize: 'vertical', minHeight: 48, height: 'auto' }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={rejectSelectedVoucher}
                      disabled={approvalBusy || !rejectReason.trim()}
                      style={{ ...compactButtonStyle, justifyContent: 'center', minHeight: 30, color: 'var(--color-danger-text)' }}
                    >
                      <IconThumbDown size={14} />
                      Reject Voucher
                    </button>
                  </div>
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
          recordLabel={total === 1 ? 'Approval' : 'Approvals'}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value); setPage(1); }}
        />
      </section>
    </main>
  );
}
