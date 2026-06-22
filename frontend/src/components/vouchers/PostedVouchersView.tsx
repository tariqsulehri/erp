'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  IconCircleX,
  IconEye,
  IconFileInvoice,
  IconFilePlus,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { DateField, NumericField, SelectField, TextField, fieldStyle } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { useCompanyProfile, useGeneralSettings } from '@/lib/api/settings';
import { useVoucherDetail, useVouchersList } from '@/lib/api/vouchers';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { PostedVoucherPrintPreview } from './PostedVoucherPrintPreview';
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

interface VoucherListRow {
  id: string;
  voucher_number: string;
  voucher_type: VoucherType;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  status: 'Draft' | 'Posted' | 'Voided';
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
  const colors = status === 'Posted'
    ? ['#166534', '#dcfce7']
    : status === 'Voided'
      ? ['#991b1b', '#fee2e2']
      : ['#475569', '#f1f5f9'];
  return badgeStyle(colors[0], colors[1]);
}

export function PostedVouchersView() {
  const { data: generalSettings } = useGeneralSettings();
  const { data: company } = useCompanyProfile();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [message, setMessage] = useState('');
  const money = useMemo(() => (value: string | number) => formatMoney(value, generalSettings), [generalSettings]);

  const listQuery = useVouchersList({
    page,
    limit: pageSize,
    status: 'Posted',
    voucher_type: voucherType || undefined,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = useVoucherDetail(selectedId ?? undefined);

  const rows = (listQuery.data?.data ?? []) as VoucherListRow[];
  const total = listQuery.data?.pagination?.total ?? 0;
  const pages = listQuery.data?.pagination?.pages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

  function resetFilters() {
    setSearchText('');
    setSearch('');
    setVoucherType('');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setPage(1);
    setSelectedId(null);
    setPrintPreviewOpen(false);
    setMessage('');
  }

  function updateFilter(action: () => void) {
    setMessage('');
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
      setMessage('Please select a voucher before printing.');
      return;
    }
    setMessage('');
    setPrintPreviewOpen(true);
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
          onError={setMessage}
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
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Posted Vouchers</h1>
              <span style={badgeStyle('#166534', '#dcfce7')}>Posted Only</span>
              <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={() => listQuery.refetch()} style={compactButtonStyle}>
              <IconRefresh size={15} /> Refresh
            </button>
            {newVoucherLinks.map(link => (
              <Link key={link.href} href={link.href} className="btn-secondary" style={{ ...compactButtonStyle, textDecoration: 'none' }}>
                <IconFilePlus size={15} /> {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {message && (
        <div style={messageStyle('error')}>
          <IconFileInvoice size={18} />
          {message}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) 84px 76px 145px 118px 118px 112px 112px auto', gap: 7, alignItems: 'end' }}>
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
                <col style={{ width: 58 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Voucher Number', 'Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Status', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index === 5 || index === 6)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Loading Posted Vouchers...
                    </td>
                  </tr>
                )}
                {listQuery.error && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>
                      {friendlyErrorMessage(listQuery.error, 'Unable to load Posted Vouchers.')}
                    </td>
                  </tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      No posted vouchers found for the selected filters.
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
                      <td style={tableCellStyle()}><span style={statusBadge(row.status)}>{row.status}</span></td>
                      <td style={tableCellStyle()}>
                        <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Voucher" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
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
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Voucher Detail</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  {detailQuery.data && (
                    <button type="button" className="btn-ghost" onClick={printDetail} title="Print Voucher" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                      <IconPrinter size={15} />
                    </button>
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
                      ['Status', detailQuery.data.status],
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
          recordLabel={total === 1 ? 'Posted Voucher' : 'Posted Vouchers'}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value); setPage(1); }}
        />
      </section>
    </main>
  );
}
