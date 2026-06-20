'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconFilePlus,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconListSearch,
  IconPencil,
  IconPrinter,
  IconRefresh,
  IconShoppingCart,
  IconTrash,
} from '@tabler/icons-react';
import Decimal from 'decimal.js';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import {
  addDays,
  cleanNumber,
  dateInputToDate,
  decimal,
  escapeHtml,
  formatAmountInput,
  friendlyErrorMessage,
  isValidDateInput,
  numericValue,
  sanitizeMoneyInput,
} from '@/lib/erp-utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { trpc } from '@/lib/trpc/client';
import { AnalyticsKpi, ChartMetricBadge, ChartTitle, InsightBox } from '@/components/analytics/AnalyticsWidgets';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { SummaryBox, SummaryInputBox } from '@/components/vouchers/SummaryBoxes';

type PaymentType = 'Cash' | 'Credit';
type MessageKind = 'success' | 'error';

interface SupplierOption extends SelectOption {
  paymentTermsDays: number;
  accountCode?: string | null;
}

interface ItemOption extends SelectOption {
  itemCode: string;
  itemName: string;
  purchasePrice: string;
  taxRate: string;
  uomName?: string | null;
  defaultWarehouseId?: string | null;
  stockOnHand: string;
}

interface WarehouseOption extends SelectOption {
  isDefault?: boolean;
}

interface PurchaseLine {
  id: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  purchasePrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: number;
  description: string;
}

interface PurchaseListRow {
  id: string;
  purchase_number: string;
  purchase_date: string;
  supplier_invoice_date?: string | null;
  due_date?: string | null;
  payment_type: PaymentType;
  status: 'Draft' | 'Posted' | 'Voided';
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  reference_number?: string | null;
  posted_at?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  supplier_id: string;
  supplier_code?: string | null;
  supplier_name: string;
  supplier_invoice_number?: string | null;
  line_count: number;
}

interface AddLineDraft {
  itemId: string;
  quantity: string;
  purchasePrice: string;
  discountAmount: string;
  taxAmount: string;
  description: string;
}

interface PurchaseAnalyticsRow {
  month_key: string;
  month_label: string;
  purchase_count: number;
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  cash_amount: string;
  credit_amount: string;
  average_invoice_amount: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const validMoneyPattern = /^\d+(\.\d{1,2})?$/;
const validQuantityPattern = /^\d+(\.\d{1,4})?$/;

const initialDraft = (): AddLineDraft => ({
  itemId: '',
  quantity: '',
  purchasePrice: '',
  discountAmount: '',
  taxAmount: '',
  description: '',
});

function calculateLineTotal(quantity: string, price: string, discount: string, tax: string) {
  return decimal(quantity).times(decimal(price)).minus(decimal(discount)).plus(decimal(tax));
}

function calculateTaxAmount(quantity: string, price: string, discount: string, taxRate: string) {
  const taxableAmount = decimal(quantity).times(decimal(price)).minus(decimal(discount));
  if (taxableAmount.lte(0)) return '';
  const tax = taxableAmount.times(decimal(taxRate)).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return tax.gt(0) ? tax.toFixed(2) : '';
}

const html = escapeHtml;

function buildPurchaseInvoicePrintHtml({
  invoice,
  company,
  generalSettings,
  money,
  title,
}: {
  invoice: any;
  company: any;
  generalSettings: Parameters<typeof formatNumber>[1];
  money: (value: number) => string;
  title: string;
}) {
  const lines = invoice.lines ?? [];
  const companyName = company?.name ?? 'Company Name';
  const companyInfo = [company?.address, company?.city, company?.country].filter(Boolean).join(', ');
  const contactInfo = [company?.phone, company?.email].filter(Boolean).join(' | ');
  const invoiceDate = formatDate(invoice.purchase_date, generalSettings);
  const postedAt = invoice.posted_at ? formatDate(invoice.posted_at, generalSettings) : '-';
  const billDate = invoice.supplier_invoice_date ? formatDate(invoice.supplier_invoice_date, generalSettings) : '-';
  const dueDate = invoice.due_date ? formatDate(invoice.due_date, generalSettings) : '-';

  const lineRows = lines.map((line: any) => `
    <tr>
      <td class="center">${html(line.line_number)}</td>
      <td>
        <div class="strong">${html(line.item_code)} - ${html(line.item_name)}</div>
        ${line.description ? `<div class="muted">${html(line.description)}</div>` : ''}
      </td>
      <td>${html(line.uom_name ?? '-')}</td>
      <td class="number">${html(formatNumber(Number(line.quantity), generalSettings))}</td>
      <td class="number">${html(money(Number(line.purchase_price)))}</td>
      <td class="number">${html(money(Number(line.discount_amount)))}</td>
      <td class="number">${html(money(Number(line.tax_amount)))}</td>
      <td class="number strong">${html(money(Number(line.line_total)))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${html(title)} - ${html(invoice.purchase_number)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 11px; background: #fff; }
    .page { width: 100%; min-height: 100%; }
    .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .company { max-width: 60%; }
    .company h1 { margin: 0 0 5px; font-size: 20px; letter-spacing: 0; }
    .muted { color: #475569; font-size: 10px; line-height: 1.4; }
    .doc-title { text-align: right; min-width: 220px; }
    .doc-title h2 { margin: 0 0 8px; font-size: 19px; letter-spacing: 0; }
    .status { display: inline-block; padding: 4px 9px; border: 1px solid #15803d; color: #14532d; background: #f0fdf4; font-weight: 700; border-radius: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .box { border: 1px solid #cbd5e1; padding: 10px; min-height: 84px; }
    .box-title { margin-bottom: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #334155; font-weight: 700; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .info { border: 1px solid #cbd5e1; padding: 7px 8px; min-height: 44px; }
    .label { color: #64748b; font-size: 9px; font-weight: 700; margin-bottom: 3px; }
    .value { font-weight: 700; line-height: 1.25; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #102033; color: #fff; text-align: left; padding: 7px 6px; border: 1px solid #102033; font-size: 10px; }
    td { padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }
    .center { text-align: center; }
    .number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .strong { font-weight: 700; }
    .footer { display: grid; grid-template-columns: 1fr 260px; gap: 18px; margin-top: 12px; align-items: start; }
    .notes { border: 1px solid #cbd5e1; padding: 10px; min-height: 92px; }
    .totals { border: 1px solid #cbd5e1; }
    .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 7px 9px; border-bottom: 1px solid #e2e8f0; }
    .total-row:last-child { border-bottom: none; background: #f8fafc; font-size: 13px; font-weight: 800; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 42px; }
    .signature { border-top: 1px solid #334155; padding-top: 6px; text-align: center; color: #334155; font-weight: 700; }
    .print-meta { margin-top: 14px; color: #64748b; font-size: 9px; text-align: right; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="company">
        <h1>${html(companyName)}</h1>
        <div class="muted">${html(companyInfo || 'Company Address')}</div>
        <div class="muted">${html(contactInfo || '')}</div>
      </div>
      <div class="doc-title">
        <h2>${html(title)}</h2>
        <div class="status">${html(invoice.status)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info"><div class="label">Purchase Number</div><div class="value">${html(invoice.purchase_number)}</div></div>
      <div class="info"><div class="label">Purchase Date</div><div class="value">${html(invoiceDate)}</div></div>
      <div class="info"><div class="label">Payment Type</div><div class="value">${html(invoice.payment_type)}</div></div>
      <div class="info"><div class="label">Posted At</div><div class="value">${html(postedAt)}</div></div>
      <div class="info"><div class="label">Supplier Bill No.</div><div class="value">${html(invoice.supplier_invoice_number || '-')}</div></div>
      <div class="info"><div class="label">Supplier Bill Date</div><div class="value">${html(billDate)}</div></div>
      <div class="info"><div class="label">Due Date</div><div class="value">${html(dueDate)}</div></div>
      <div class="info"><div class="label">Reference Number</div><div class="value">${html(invoice.reference_number || '-')}</div></div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="box-title">Supplier</div>
        <div class="strong">${html(invoice.supplier_code)} - ${html(invoice.supplier_name)}</div>
      </div>
      <div class="box">
        <div class="box-title">Accounting</div>
        <div>Voucher No.: <span class="strong">${html(invoice.accounting_voucher_number || '-')}</span></div>
        <div>Warehouse: <span class="strong">${html(invoice.warehouse_code ? `${invoice.warehouse_code} - ${invoice.warehouse_name}` : invoice.warehouse_name || '-')}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:34px" class="center">No.</th>
          <th>Item</th>
          <th style="width:64px">UOM</th>
          <th style="width:78px" class="number">Quantity</th>
          <th style="width:90px" class="number">Price</th>
          <th style="width:82px" class="number">Discount</th>
          <th style="width:82px" class="number">Tax</th>
          <th style="width:98px" class="number">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows || '<tr><td colspan="8" class="center">No line items found.</td></tr>'}</tbody>
    </table>

    <div class="footer">
      <div class="notes">
        <div class="box-title">Description</div>
        <div>${html(invoice.description || '-')}</div>
      </div>
      <div class="totals">
        <div class="total-row"><span>Gross Amount</span><span>${html(money(Number(invoice.gross_amount)))}</span></div>
        <div class="total-row"><span>Discount</span><span>${html(money(Number(invoice.discount_amount)))}</span></div>
        <div class="total-row"><span>Tax</span><span>${html(money(Number(invoice.tax_amount)))}</span></div>
        <div class="total-row"><span>Freight</span><span>${html(money(Number(invoice.freight_amount)))}</span></div>
        <div class="total-row"><span>Net Amount</span><span>${html(money(Number(invoice.net_amount)))}</span></div>
      </div>
    </div>

    <div class="signatures">
      <div class="signature">Prepared By</div>
      <div class="signature">Checked By</div>
      <div class="signature">Approved By</div>
    </div>
    <div class="print-meta">Printed On ${html(formatDate(new Date(), generalSettings))}</div>
  </div>
</body>
</html>`;
}

function openPurchaseInvoicePrintWindow(
  invoice: any,
  company: any,
  generalSettings: Parameters<typeof formatNumber>[1],
  money: (value: number) => string,
  title = 'Purchase Invoice',
) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=720');
  if (!printWindow) {
    throw new Error('Print preview was blocked by the browser. Please allow pop-ups for this site and try again.');
  }
  printWindow.document.open();
  printWindow.document.write(buildPurchaseInvoicePrintHtml({ invoice, company, generalSettings, money, title }));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function PurchaseInvoicePrintPreview({
  invoice,
  company,
  generalSettings,
  money,
  onClose,
  onError,
}: {
  invoice: any;
  company: any;
  generalSettings: Parameters<typeof formatNumber>[1];
  money: (value: number) => string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  function print(title = 'Purchase Invoice') {
    try {
      openPurchaseInvoicePrintWindow(invoice, company, generalSettings, money, title);
    } catch (error) {
      onError(friendlyErrorMessage(error, 'Unable to open print preview.'));
    }
  }

  const lineItems = invoice.lines ?? [];

  return (
    <div style={printPreviewOverlayStyle}>
      <div style={printPreviewShellStyle}>
        <div className="no-print" style={printPreviewToolbarStyle}>
          <div>
            <strong style={{ color: 'var(--color-heading)' }}>Print Preview</strong>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>{invoice.purchase_number}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn-secondary" onClick={() => print('Purchase Invoice')} style={compactButtonStyle}><IconPrinter size={15} /> Print</button>
            <button type="button" className="btn-primary" onClick={() => print('Purchase Invoice PDF')} style={compactButtonStyle}><IconDownload size={15} /> Download PDF</button>
            <button type="button" className="btn-secondary" onClick={onClose} style={compactButtonStyle}><IconCircleX size={15} /> Close</button>
          </div>
        </div>

        <div style={printPreviewPaperWrapStyle}>
          <div style={printPreviewPaperStyle}>
            <div style={printHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>{company?.name ?? 'Company Name'}</h2>
                <div style={printMutedStyle}>{[company?.address, company?.city, company?.country].filter(Boolean).join(', ') || 'Company Address'}</div>
                <div style={printMutedStyle}>{[company?.phone, company?.email].filter(Boolean).join(' | ')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 24, color: '#0f172a' }}>Purchase Invoice</h1>
                <span style={printStatusStyle}>{invoice.status}</span>
              </div>
            </div>

            <div style={printInfoGridStyle}>
              {[
                ['Purchase Number', invoice.purchase_number],
                ['Purchase Date', formatDate(invoice.purchase_date, generalSettings)],
                ['Payment Type', invoice.payment_type],
                ['Posted At', invoice.posted_at ? formatDate(invoice.posted_at, generalSettings) : '-'],
                ['Supplier Bill No.', invoice.supplier_invoice_number || '-'],
                ['Supplier Bill Date', invoice.supplier_invoice_date ? formatDate(invoice.supplier_invoice_date, generalSettings) : '-'],
                ['Due Date', invoice.due_date ? formatDate(invoice.due_date, generalSettings) : '-'],
                ['Reference Number', invoice.reference_number || '-'],
              ].map(([label, value]) => (
                <div key={label} style={printInfoBoxStyle}>
                  <div style={printLabelStyle}>{label}</div>
                  <div style={printValueStyle}>{value}</div>
                </div>
              ))}
            </div>

            <div style={printPartyGridStyle}>
              <div style={printBoxStyle}>
                <div style={printBoxTitleStyle}>Supplier</div>
                <strong>{invoice.supplier_code} - {invoice.supplier_name}</strong>
              </div>
              <div style={printBoxStyle}>
                <div style={printBoxTitleStyle}>Accounting</div>
                <div>Voucher No.: <strong>{invoice.accounting_voucher_number || '-'}</strong></div>
                <div>Warehouse: <strong>{invoice.warehouse_name || '-'}</strong></div>
              </div>
            </div>

            <table style={printTableStyle}>
              <thead>
                <tr>
                  {['No.', 'Item', 'UOM', 'Quantity', 'Price', 'Discount', 'Tax', 'Amount'].map((label, index) => (
                    <th key={label} style={printThStyle(index >= 3)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line: any) => (
                  <tr key={line.id}>
                    <td style={printTdStyle(false, true)}>{line.line_number}</td>
                    <td style={printTdStyle()}>
                      <strong>{line.item_code} - {line.item_name}</strong>
                      {line.description && <div style={printMutedStyle}>{line.description}</div>}
                    </td>
                    <td style={printTdStyle()}>{line.uom_name || '-'}</td>
                    <td style={printTdStyle(true)}>{formatNumber(Number(line.quantity), generalSettings)}</td>
                    <td style={printTdStyle(true)}>{money(Number(line.purchase_price))}</td>
                    <td style={printTdStyle(true)}>{money(Number(line.discount_amount))}</td>
                    <td style={printTdStyle(true)}>{money(Number(line.tax_amount))}</td>
                    <td style={printTdStyle(true)}><strong>{money(Number(line.line_total))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={printFooterGridStyle}>
              <div style={printBoxStyle}>
                <div style={printBoxTitleStyle}>Description</div>
                <div>{invoice.description || '-'}</div>
              </div>
              <div style={printTotalsStyle}>
                {[
                  ['Gross Amount', Number(invoice.gross_amount)],
                  ['Discount', Number(invoice.discount_amount)],
                  ['Tax', Number(invoice.tax_amount)],
                  ['Freight', Number(invoice.freight_amount)],
                  ['Net Amount', Number(invoice.net_amount)],
                ].map(([label, value], index) => (
                  <div key={String(label)} style={{ ...printTotalRowStyle, fontWeight: index === 4 ? 800 : 600, background: index === 4 ? '#f8fafc' : '#fff' }}>
                    <span>{label}</span>
                    <span>{money(Number(value))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={printSignatureGridStyle}>
              <div style={printSignatureStyle}>Prepared By</div>
              <div style={printSignatureStyle}>Checked By</div>
              <div style={printSignatureStyle}>Approved By</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseAnalyticsView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onPostedPurchases,
}: {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewPurchase: () => void;
  onPostedPurchases: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const analyticsQuery = trpc.purchases.analytics.useQuery({
    supplier_id: supplierId || undefined,
    payment_type: paymentType as PaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }, { retry: false });

  const summary = analyticsQuery.data?.summary;
  const monthlyRows = (analyticsQuery.data?.monthlyPurchases ?? []) as PurchaseAnalyticsRow[];
  const monthlyChartData = monthlyRows.map(row => ({
    month: row.month_label,
    purchases: Number(row.purchase_count ?? 0),
    grossAmount: Number(row.gross_amount ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    cashAmount: Number(row.cash_amount ?? 0),
    creditAmount: Number(row.credit_amount ?? 0),
    averageInvoice: Number(row.average_invoice_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    freightAmount: Number(row.freight_amount ?? 0),
  }));
  const supplierChartData = (analyticsQuery.data?.supplierSummary ?? []).map((row: any) => ({
    name: row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));
  const warehouseChartData = (analyticsQuery.data?.warehouseSummary ?? []).map((row: any) => ({
    name: row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));
  const paymentChartData = (analyticsQuery.data?.paymentTypeSummary ?? []).map((row: any) => ({
    name: row.payment_type,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));
  const totalNetAmount = Number(summary?.net_amount ?? 0);
  const totalPurchases = Number(summary?.purchase_count ?? 0);
  const averageInvoice = Number(summary?.average_invoice_amount ?? 0);
  const taxFreightTotal = Number(summary?.tax_amount ?? 0) + Number(summary?.freight_amount ?? 0);
  const grossAmount = Number(summary?.gross_amount ?? 0);
  const discountAmount = Number(summary?.discount_amount ?? 0);
  const cashTotal = paymentChartData.find((row: { name: string; amount: number }) => row.name === 'Cash')?.amount ?? 0;
  const creditTotal = paymentChartData.find((row: { name: string; amount: number }) => row.name === 'Credit')?.amount ?? 0;
  const creditShare = totalNetAmount > 0 ? creditTotal / totalNetAmount * 100 : 0;
  const averageMonthlyPurchase = monthlyChartData.length > 0
    ? monthlyChartData.reduce((sum, row) => sum + row.netAmount, 0) / monthlyChartData.length
    : 0;
  const peakMonth = monthlyChartData.reduce<typeof monthlyChartData[number] | null>(
    (best, row) => (!best || row.netAmount > best.netAmount ? row : best),
    null,
  );
  const topSupplier = supplierChartData[0];
  const topWarehouse = warehouseChartData[0];
  const chartEmpty = !analyticsQuery.isLoading && monthlyChartData.length === 0;

  function resetFilters() {
    setSupplierId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom(`${currentYear}-01-01`);
    setDateTo(`${currentYear}-12-31`);
  }

  const moneyAxis = (value: number) => {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) return `${formatNumber(value / 1_000_000, generalSettings)}M`;
    if (absolute >= 1_000) return `${formatNumber(value / 1_000, generalSettings)}K`;
    return formatNumber(value, generalSettings);
  };

  const chartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={chartTooltipStyle}>
        <strong style={{ display: 'block', marginBottom: 6, color: 'var(--color-heading)' }}>{label}</strong>
        {payload.map((entry: any) => {
          const isCount = entry.dataKey === 'purchases';
          return (
            <div key={`${entry.dataKey}-${entry.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: entry.color, fontSize: '0.72rem', fontWeight: 800 }}>
              <span>{entry.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{isCount ? formatNumber(Number(entry.value), generalSettings) : money(Number(entry.value))}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const chartAxisStyle = { fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 700 };
  const smallChartAxisStyle = { fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 700 };

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconChartBar size={20} stroke={1.8} /></div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Purchase Analytics</h1>
                <span style={badgeStyle('#1d4ed8', '#dbeafe')}>Decision View</span>
                <span style={statusBadgeStyle}>{dateFrom ? formatDate(dateFrom, generalSettings) : 'Start'} To {dateTo ? formatDate(dateTo, generalSettings) : 'Today'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => analyticsQuery.refetch()} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" onClick={onPostedPurchases} style={compactButtonStyle}><IconListSearch size={15} /> Posted Purchases</button>
            <button className="btn-primary" type="button" onClick={onNewPurchase} style={compactButtonStyle}><IconFilePlus size={15} /> New Purchase</button>
          </div>
        </div>
      </section>

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 9, overflow: 'hidden' }}>
        <div style={analyticsFilterGridStyle}>
          <FieldLabel label="Supplier">
            <SearchableSelect value={supplierId} options={suppliers} onChange={setSupplierId} placeholder="All Suppliers" />
          </FieldLabel>
          <FieldLabel label="Payment Type">
            <select className="form-input" value={paymentType} onChange={event => setPaymentType(event.currentTarget.value)} style={compactInputStyle}>
              <option value="">All Types</option>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Warehouse">
            <SearchableSelect value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder="All Warehouses" />
          </FieldLabel>
          <FieldLabel label="Date From">
            <input className="form-input" type="date" value={dateFrom} onChange={event => setDateFrom(event.currentTarget.value)} style={compactDateInputStyle} />
          </FieldLabel>
          <FieldLabel label="Date To">
            <input className="form-input" type="date" value={dateTo} onChange={event => setDateTo(event.currentTarget.value)} style={compactDateInputStyle} />
          </FieldLabel>
          <button type="button" className="btn-secondary" onClick={resetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            Clear Filters
          </button>
        </div>

        {analyticsQuery.error && (
          <div style={messageStyle('error')}>
            <IconFileInvoice size={18} />
            {friendlyErrorMessage(analyticsQuery.error, 'Unable to load Purchase Analytics.')}
          </div>
        )}

        <div style={{ minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateRows: 'auto auto auto', gap: 10, paddingRight: 2 }}>
          <div style={analyticsKpiGridStyle}>
            <AnalyticsKpi label="Net Purchases" value={money(totalNetAmount)} detail={`Gross ${money(grossAmount)}`} accent="#2563eb" tone="blue" />
            <AnalyticsKpi label="Purchase Count" value={formatNumber(totalPurchases, generalSettings)} detail={`Average ${money(averageInvoice)}`} accent="#0f766e" tone="teal" />
            <AnalyticsKpi label="Credit Exposure" value={money(creditTotal)} detail={`${formatNumber(creditShare, generalSettings)}% Of Purchases`} accent="#7c3aed" tone="violet" />
            <AnalyticsKpi label="Tax And Freight" value={money(taxFreightTotal)} detail={`Discount ${money(discountAmount)}`} accent="#c2410c" tone="orange" />
          </div>

          {analyticsQuery.isLoading && (
            <div style={analyticsEmptyStyle}>Loading Purchase Analytics...</div>
          )}

          {chartEmpty && (
            <div style={analyticsEmptyStyle}>No purchase analytics found for the selected filters.</div>
          )}

          {!analyticsQuery.isLoading && !chartEmpty && (
            <>
              <div style={analyticsInsightGridStyle}>
                <InsightBox label="Peak Purchase Month" value={peakMonth ? peakMonth.month : 'No Data'} detail={peakMonth ? money(peakMonth.netAmount) : money(0)} />
                <InsightBox label="Top Supplier" value={topSupplier?.name ?? 'No Data'} detail={topSupplier ? money(topSupplier.amount) : money(0)} />
                <InsightBox label="Top Warehouse" value={topWarehouse?.name ?? 'No Data'} detail={topWarehouse ? money(topWarehouse.amount) : money(0)} />
                <InsightBox label="Cash Paid" value={money(cashTotal)} detail={`Credit ${money(creditTotal)}`} />
              </div>

              <div style={analyticsMainGridStyle}>
                <div style={analyticsPanelStyle}>
                  <ChartTitle
                    title="Month Wise Purchase Trend"
                    subtitle="Gross purchase, net purchase, and average invoice value"
                    right={<ChartMetricBadge label="Monthly Average" value={money(averageMonthlyPurchase)} />}
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 18, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="purchaseNetGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                      <XAxis dataKey="month" tick={chartAxisStyle} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={moneyAxis} tick={chartAxisStyle} axisLine={false} tickLine={false} />
                      <Tooltip content={chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <ReferenceLine y={averageMonthlyPurchase} stroke="#64748b" strokeDasharray="5 5" ifOverflow="extendDomain" />
                      <Bar dataKey="grossAmount" name="Gross Amount" fill="#bfdbfe" radius={[6, 6, 0, 0]} maxBarSize={34} />
                      <Area type="monotone" dataKey="netAmount" name="Net Amount" stroke="#2563eb" strokeWidth={3} fill="url(#purchaseNetGradient)" />
                      <Line type="monotone" dataKey="averageInvoice" name="Average Invoice" stroke="#f97316" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div style={analyticsPanelStyle}>
                  <ChartTitle
                    title="Cash Vs Credit Purchases"
                    subtitle="Monthly payment-type mix and purchase count"
                    right={<ChartMetricBadge label="Credit Share" value={`${formatNumber(creditShare, generalSettings)}%`} />}
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 18, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cashAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.95} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="creditAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.95} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                      <XAxis dataKey="month" tick={chartAxisStyle} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="amount" tickFormatter={moneyAxis} tick={chartAxisStyle} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="count" orientation="right" tickFormatter={value => formatNumber(Number(value), generalSettings)} tick={chartAxisStyle} axisLine={false} tickLine={false} />
                      <Tooltip content={chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar yAxisId="amount" dataKey="cashAmount" name="Cash Purchases" stackId="payment" fill="url(#cashAmount)" radius={[0, 0, 4, 4]} maxBarSize={38} />
                      <Bar yAxisId="amount" dataKey="creditAmount" name="Credit Purchases" stackId="payment" fill="url(#creditAmount)" radius={[4, 4, 0, 0]} maxBarSize={38} />
                      <Line yAxisId="count" type="monotone" dataKey="purchases" name="Purchase Count" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={analyticsSmallGridStyle}>
                <div style={analyticsPanelStyle}>
                  <ChartTitle
                    title="Top Suppliers"
                    subtitle="Highest purchase value and invoice count"
                    right={<ChartMetricBadge label="Top" value={topSupplier ? money(topSupplier.amount) : money(0)} />}
                  />
                  <ResponsiveContainer width="100%" height={235}>
                    <BarChart data={supplierChartData} layout="vertical" margin={{ top: 4, right: 18, left: 18, bottom: 4 }}>
                      <defs>
                        <linearGradient id="supplierBar" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.95} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} strokeDasharray="4 6" />
                      <XAxis type="number" tickFormatter={moneyAxis} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={132} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
                      <Tooltip content={chartTooltip} />
                      <Bar dataKey="amount" name="Net Amount" fill="url(#supplierBar)" radius={[0, 6, 6, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={analyticsPanelStyle}>
                  <ChartTitle
                    title="Warehouse Purchase Share"
                    subtitle="Where purchases are received"
                    right={<ChartMetricBadge label="Warehouses" value={formatNumber(warehouseChartData.length, generalSettings)} />}
                  />
                  <div style={{ position: 'relative', height: 235 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={chartTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                        <Pie data={warehouseChartData} dataKey="amount" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={4} stroke="var(--color-surface)" strokeWidth={3}>
                          {warehouseChartData.map((entry: any, index: number) => (
                            <Cell key={entry.name} fill={analyticsColors[index % analyticsColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={donutCenterStyle}>
                      <span>Received</span>
                      <strong>{money(totalNetAmount)}</strong>
                    </div>
                  </div>
                </div>

                <div style={analyticsPanelStyle}>
                  <ChartTitle
                    title="Tax And Freight Impact"
                    subtitle="Monthly add-on cost view"
                    right={<ChartMetricBadge label="Total" value={money(taxFreightTotal)} />}
                  />
                  <ResponsiveContainer width="100%" height={235}>
                    <BarChart data={monthlyChartData} margin={{ top: 4, right: 18, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="taxBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fb923c" stopOpacity={0.98} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.75} />
                        </linearGradient>
                        <linearGradient id="freightBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.98} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.75} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                      <XAxis dataKey="month" tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={moneyAxis} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
                      <Tooltip content={chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar dataKey="taxAmount" name="Tax" fill="url(#taxBar)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="freightAmount" name="Freight" fill="url(#freightBar)" radius={[5, 5, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function PostedPurchasesView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onAnalytics,
}: {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewPurchase: () => void;
  onAnalytics: () => void;
}) {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printPreviewInvoice, setPrintPreviewInvoice] = useState<any | null>(null);
  const [printError, setPrintError] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const { data: company } = trpc.settings.getCompany.useQuery();

  const listQuery = trpc.purchases.list.useQuery({
    page,
    limit: pageSize,
    status: 'Posted',
    search: debouncedSearch || undefined,
    supplier_id: supplierId || undefined,
    payment_type: paymentType as PaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  }, { placeholderData: previous => previous, retry: false });

  const detailQuery = trpc.purchases.getById.useQuery(
    { id: selectedId ?? '' },
    { enabled: Boolean(selectedId), retry: false },
  );

  const rows = (listQuery.data?.data ?? []) as PurchaseListRow[];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

  function resetFilters() {
    setPrintError('');
    setSearch('');
    setSupplierId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setPage(1);
    setSelectedId(null);
  }

  function updateFilter(action: () => void) {
    setPrintError('');
    action();
    setPage(1);
    setSelectedId(null);
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconListSearch size={20} stroke={1.8} /></div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Posted Purchases</h1>
                <span style={badgeStyle('#166534', '#dcfce7')}>Posted Only</span>
                <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => { setPrintError(''); listQuery.refetch(); }} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" onClick={onAnalytics} style={compactButtonStyle}><IconChartBar size={15} /> Analytics</button>
            <button className="btn-primary" type="button" onClick={onNewPurchase} style={compactButtonStyle}><IconFilePlus size={15} /> New Purchase</button>
          </div>
        </div>
      </section>

      {printError && (
        <div style={messageStyle('error')}>
          <IconFileInvoice size={18} />
          {printError}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={purchaseFilterGridStyle}>
          <FieldLabel label="Search">
            <input
              className="form-input"
              value={search}
              onChange={event => updateFilter(() => setSearch(event.currentTarget.value))}
              placeholder="Purchase No., Bill No., Supplier, Reference"
              style={compactInputStyle}
            />
          </FieldLabel>
          <FieldLabel label="Supplier">
            <SearchableSelect value={supplierId} options={suppliers} onChange={value => updateFilter(() => setSupplierId(value))} placeholder="All Suppliers" />
          </FieldLabel>
          <FieldLabel label="Payment Type">
            <select className="form-input" value={paymentType} onChange={event => updateFilter(() => setPaymentType(event.currentTarget.value))} style={compactInputStyle}>
              <option value="">All Types</option>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Warehouse">
            <SearchableSelect value={warehouseId} options={warehouses} onChange={value => updateFilter(() => setWarehouseId(value))} placeholder="All Warehouses" />
          </FieldLabel>
          <FieldLabel label="Date From">
            <input className="form-input" type="date" value={dateFrom} onChange={event => updateFilter(() => setDateFrom(event.currentTarget.value))} style={compactDateInputStyle} />
          </FieldLabel>
          <FieldLabel label="Date To">
            <input className="form-input" type="date" value={dateTo} onChange={event => updateFilter(() => setDateTo(event.currentTarget.value))} style={compactDateInputStyle} />
          </FieldLabel>
          <FieldLabel label="Amount From">
            <input className="form-input" inputMode="decimal" value={amountFrom} onChange={event => updateFilter(() => setAmountFrom(sanitizeMoneyInput(event.currentTarget.value)))} style={compactNumericInputStyle} />
          </FieldLabel>
          <FieldLabel label="Amount To">
            <input className="form-input" inputMode="decimal" value={amountTo} onChange={event => updateFilter(() => setAmountTo(sanitizeMoneyInput(event.currentTarget.value)))} style={compactNumericInputStyle} />
          </FieldLabel>
          <button type="button" className="btn-secondary" onClick={resetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            Clear Filters
          </button>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0, 1fr) 390px' : '1fr', gap: 8, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', fontSize: '0.74rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 116 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 62 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Purchase No.', 'Date', 'Supplier', 'Supplier Bill No.', 'Type', 'Warehouse', 'Gross', 'Discount', 'Tax', 'Freight', 'Net Amount', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index >= 6 && index <= 10)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Loading Posted Purchases...
                    </td>
                  </tr>
                )}
                {listQuery.error && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>
                      {friendlyErrorMessage(listQuery.error, 'Unable to load Posted Purchases.')}
                    </td>
                  </tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      No posted purchases found for the selected filters.
                    </td>
                  </tr>
                )}
                {rows.map(row => {
                  const active = selectedId === row.id;
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                      <td style={tableCellStyle()}><strong>{row.purchase_number}</strong></td>
                      <td style={tableCellStyle()}>{formatDate(row.purchase_date, generalSettings)}</td>
                      <td style={tableCellStyle()}>{row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name}</td>
                      <td style={tableCellStyle()}>{row.supplier_invoice_number || '—'}</td>
                      <td style={tableCellStyle()}>{row.payment_type}</td>
                      <td style={tableCellStyle()}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || '—'}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.gross_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.discount_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.tax_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.freight_amount))}</td>
                      <td style={tableCellStyle(true)}><strong>{money(Number(row.net_amount))}</strong></td>
                      <td style={tableCellStyle()}>
                        <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Purchase" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
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
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Purchase Detail</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  {detailQuery.data && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setPrintError('');
                        setPrintPreviewInvoice(detailQuery.data);
                      }}
                      title="Print Preview"
                      style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}
                    >
                      <IconPrinter size={15} />
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                    <IconCircleX size={15} />
                  </button>
                </div>
              </div>
              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading purchase detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Purchase Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Purchase No.', detailQuery.data.purchase_number],
                      ['Date', formatDate(detailQuery.data.purchase_date, generalSettings)],
                      ['Supplier', `${detailQuery.data.supplier_code} - ${detailQuery.data.supplier_name}`],
                      ['Payment Type', detailQuery.data.payment_type],
                      ['Supplier Bill No.', detailQuery.data.supplier_invoice_number || '—'],
                      ['Reference', detailQuery.data.reference_number || '—'],
                      ['Voucher No.', detailQuery.data.accounting_voucher_number || '—'],
                      ['Posted At', detailQuery.data.posted_at ? formatDate(detailQuery.data.posted_at, generalSettings) : '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 7px', minWidth: 0 }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.62rem', fontWeight: 800 }}>{label}</div>
                        <div style={{ color: 'var(--color-text)', fontSize: '0.73rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ minHeight: 0, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: 32 }} />
                        <col />
                        <col style={{ width: 66 }} />
                        <col style={{ width: 88 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {['No.', 'Item', 'Qty', 'Amount'].map((label, index) => (
                            <th key={label} style={tableHeadStyle(index >= 2)}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data.lines ?? []).map((line: any) => (
                          <tr key={line.id}>
                            <td style={tableCellStyle()}>{line.line_number}</td>
                            <td style={tableCellStyle()}>{line.item_code} - {line.item_name}</td>
                            <td style={tableCellStyle(true)}>{formatNumber(Number(line.quantity), generalSettings)}</td>
                            <td style={tableCellStyle(true)}>{money(Number(line.line_total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    {[
                      ['Gross Amount', Number(detailQuery.data.gross_amount)],
                      ['Discount', Number(detailQuery.data.discount_amount)],
                      ['Tax', Number(detailQuery.data.tax_amount)],
                      ['Freight', Number(detailQuery.data.freight_amount)],
                      ['Net Amount', Number(detailQuery.data.net_amount)],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.74rem' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</span>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-amount)' }}>{money(Number(value))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        <div style={purchaseListFooterStyle}>
          <span>
            Showing {formatNumber(fromRecord, generalSettings)}-{formatNumber(toRecord, generalSettings)} Of {formatNumber(total, generalSettings)}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Page {formatNumber(page, generalSettings)} Of {formatNumber(pages, generalSettings)}</span>
            <select
              className="form-input"
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.currentTarget.value));
                setPage(1);
                setSelectedId(null);
              }}
              style={{ ...compactInputStyle, width: 76 }}
              title="Page Size"
            >
              {[25, 50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(1)} title="First Page" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}><IconChevronsLeft size={15} /></button>
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} title="Previous Page" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}><IconChevronLeft size={15} /></button>
            <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))} title="Next Page" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}><IconChevronRight size={15} /></button>
            <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage(pages)} title="Last Page" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}><IconChevronsRight size={15} /></button>
          </div>
        </div>
      </section>

      {printPreviewInvoice && (
        <PurchaseInvoicePrintPreview
          invoice={printPreviewInvoice}
          company={company}
          generalSettings={generalSettings}
          money={money}
          onClose={() => setPrintPreviewInvoice(null)}
          onError={setPrintError}
        />
      )}
    </main>
  );
}

export default function PurchaseVoucherPage() {
  const utils = trpc.useUtils();
  const { data: generalSettings } = trpc.settings.getGeneralSettings.useQuery();
  const supportQuery = trpc.purchases.supportData.useQuery(undefined, { retry: false });
  const createDraft = trpc.purchases.createDraft.useMutation();
  const createAndPost = trpc.purchases.createAndPost.useMutation();

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('posted');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('Cash');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [lineDraft, setLineDraft] = useState<AddLineDraft>(initialDraft);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [nextLineId, setNextLineId] = useState(1);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);

  const saving = createDraft.isPending || createAndPost.isPending;
  const isPurchaseDateValid = isValidDateInput(purchaseDate);
  const dateValidation = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: isPurchaseDateValid ? dateInputToDate(purchaseDate) : dateInputToDate(today()) },
    { enabled: isPurchaseDateValid, retry: false },
  );
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);

  const suppliers = useMemo<SupplierOption[]>(() => {
    return (supportQuery.data?.suppliers ?? []).map((supplier: any) => ({
      value: supplier.id,
      label: `${supplier.code} - ${supplier.name}`,
      searchText: `${supplier.code} ${supplier.name} ${supplier.account_code ?? ''}`,
      paymentTermsDays: Number(supplier.payment_terms_days ?? 0),
      accountCode: supplier.account_code,
    }));
  }, [supportQuery.data]);

  const items = useMemo<ItemOption[]>(() => {
    return (supportQuery.data?.items ?? []).map((item: any) => ({
      value: item.id,
      label: `${item.item_code} - ${item.item_name}`,
      searchText: `${item.item_code} ${item.item_name}`,
      itemCode: item.item_code,
      itemName: item.item_name,
      purchasePrice: String(item.purchase_price ?? '0'),
      taxRate: String(item.tax_rate ?? '0'),
      uomName: item.uom_name,
      defaultWarehouseId: item.default_warehouse_id,
      stockOnHand: String(item.stock_on_hand ?? '0'),
    }));
  }, [supportQuery.data]);

  const warehouses = useMemo<WarehouseOption[]>(() => {
    return (supportQuery.data?.warehouses ?? []).map((warehouse: any) => ({
      value: warehouse.id,
      label: `${warehouse.code} - ${warehouse.name}`,
      searchText: `${warehouse.code} ${warehouse.name}`,
      isDefault: Boolean(warehouse.is_default),
    }));
  }, [supportQuery.data]);

  const selectedSupplier = suppliers.find(supplier => supplier.value === supplierId);
  const selectedItem = items.find(item => item.value === lineDraft.itemId);
  const lineDraftTotal = calculateLineTotal(
    lineDraft.quantity,
    lineDraft.purchasePrice,
    lineDraft.discountAmount,
    lineDraft.taxAmount,
  );

  const grossAmount = lines.reduce((sum, line) => sum + numericValue(line.quantity) * numericValue(line.purchasePrice), 0);
  const discountAmount = lines.reduce((sum, line) => sum + numericValue(line.discountAmount), 0);
  const taxAmount = lines.reduce((sum, line) => sum + numericValue(line.taxAmount), 0);
  const freight = numericValue(freightAmount);
  const netAmount = grossAmount - discountAmount + taxAmount + freight;
  const balanceDue = paymentType === 'Cash' ? 0 : netAmount;
  const generatedVoucherDetails = selectedSupplier
    ? [
        `Purchase from ${selectedSupplier.label.split(' - ').slice(1).join(' - ') || selectedSupplier.label}`,
        supplierInvoiceNumber ? `Bill ${supplierInvoiceNumber}` : '',
        lines.length > 0 ? `${lines.length} item${lines.length === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' | ')
    : 'Purchase details will be generated after selecting Supplier.';

  const dateStatusMessage = !purchaseDate
    ? ''
    : !isPurchaseDateValid
      ? 'Purchase Date is not a valid date.'
      : dateValidation.data && !dateValidation.data.canPost
        ? `Purchase Date: ${dateValidation.data.reason}`
      : '';

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0].value);
    }
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (!supplierId || !selectedSupplier || paymentType !== 'Credit' || !isPurchaseDateValid) return;
    setDueDate(addDays(purchaseDate, selectedSupplier.paymentTermsDays));
  }, [supplierId, selectedSupplier, paymentType, purchaseDate, isPurchaseDateValid]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Unable to load purchase setup. Please refresh and try again.'),
      });
    }
  }, [supportQuery.error]);

  function resetForm(clearMessage = true) {
    setPurchaseDate(today());
    setSupplierId('');
    setPaymentType('Cash');
    setSupplierInvoiceNumber('');
    setSupplierInvoiceDate(today());
    setDueDate(today());
    setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setReferenceNumber('');
    setFreightAmount('');
    setLineDraft(initialDraft());
    setLines([]);
    setNextLineId(1);
    setEditingLineId(null);
    if (clearMessage) setMessage(null);
  }

  function updateLineDraft(patch: Partial<AddLineDraft>) {
    setLineDraft(current => {
      const next = { ...current, ...patch };
      if (patch.itemId !== undefined) {
        const item = items.find(option => option.value === patch.itemId);
        next.purchasePrice = item && Number(item.purchasePrice) > 0 ? String(Number(item.purchasePrice).toFixed(2)) : '';
        next.taxAmount = item ? calculateTaxAmount(next.quantity, next.purchasePrice, next.discountAmount, item.taxRate) : '';
        if (item?.defaultWarehouseId) setWarehouseId(item.defaultWarehouseId);
      } else if (patch.quantity !== undefined || patch.purchasePrice !== undefined || patch.discountAmount !== undefined) {
        const item = items.find(option => option.value === next.itemId);
        if (item) next.taxAmount = calculateTaxAmount(next.quantity, next.purchasePrice, next.discountAmount, item.taxRate);
      }
      return next;
    });
  }

  function addItemLine() {
    setMessage(null);
    if (!lineDraft.itemId) {
      setMessage({ kind: 'error', text: 'Item is required.' });
      return;
    }
    if (!selectedItem) {
      setMessage({ kind: 'error', text: 'Selected Item was not found. Please select it again.' });
      return;
    }
    if (!validQuantityPattern.test(cleanNumber(lineDraft.quantity)) || numericValue(lineDraft.quantity) <= 0) {
      setMessage({ kind: 'error', text: 'Quantity must be greater than zero.' });
      return;
    }
    if (!validMoneyPattern.test(cleanNumber(lineDraft.purchasePrice)) || numericValue(lineDraft.purchasePrice) <= 0) {
      setMessage({ kind: 'error', text: 'Purchase Price must be greater than zero.' });
      return;
    }
    if (lineDraft.discountAmount && !validMoneyPattern.test(cleanNumber(lineDraft.discountAmount))) {
      setMessage({ kind: 'error', text: 'Discount must be a valid amount.' });
      return;
    }
    if (lineDraft.taxAmount && !validMoneyPattern.test(cleanNumber(lineDraft.taxAmount))) {
      setMessage({ kind: 'error', text: 'Tax must be a valid amount.' });
      return;
    }
    const gross = decimal(lineDraft.quantity).times(decimal(lineDraft.purchasePrice));
    if (decimal(lineDraft.discountAmount).gt(gross)) {
      setMessage({ kind: 'error', text: 'Discount cannot be greater than item amount.' });
      return;
    }
    if (lineDraftTotal.lte(0)) {
      setMessage({ kind: 'error', text: 'Line Total must be greater than zero.' });
      return;
    }

    const savedLine: PurchaseLine = {
      id: editingLineId ?? nextLineId,
      itemId: selectedItem.value,
      itemCode: selectedItem.itemCode,
      itemName: selectedItem.itemName,
      uomName: selectedItem.uomName || '',
      quantity: decimal(lineDraft.quantity).toFixed(4),
      purchasePrice: decimal(lineDraft.purchasePrice).toFixed(2),
      discountAmount: decimal(lineDraft.discountAmount).toFixed(2),
      taxAmount: decimal(lineDraft.taxAmount).toFixed(2),
      lineTotal: lineDraftTotal.toNumber(),
      description: lineDraft.description.trim(),
    };

    if (editingLineId) {
      setLines(current => current.map(line => line.id === editingLineId ? savedLine : line));
      setEditingLineId(null);
    } else {
      setLines(current => [...current, savedLine]);
      setNextLineId(value => value + 1);
    }
    setLineDraft(initialDraft());
  }

  function removeLine(id: number) {
    setLines(current => current.filter(line => line.id !== id));
    if (editingLineId === id) {
      setEditingLineId(null);
      setLineDraft(initialDraft());
    }
  }

  function editLine(line: PurchaseLine) {
    setMessage(null);
    setEditingLineId(line.id);
    setLineDraft({
      itemId: line.itemId,
      quantity: line.quantity,
      purchasePrice: line.purchasePrice,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      description: line.description,
    });
  }

  function cancelLineEdit() {
    setEditingLineId(null);
    setLineDraft(initialDraft());
  }

  function moveLine(id: number, direction: -1 | 1) {
    setLines(current => {
      const index = current.findIndex(line => line.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [line] = next.splice(index, 1);
      next.splice(nextIndex, 0, line);
      return next;
    });
  }

  function validateForm() {
    if (!purchaseDate) return 'Purchase Date is required.';
    if (!isPurchaseDateValid) return 'Purchase Date is not a valid date.';
    if (dateValidation.data && !dateValidation.data.canPost) return `Purchase Date: ${dateValidation.data.reason}`;
    if (!supplierId) return 'Supplier is required.';
    if (!selectedSupplier) return 'Selected Supplier was not found. Please select it again.';
    if (!selectedSupplier.accountCode) return 'Selected Supplier does not have a Linked Account.';
    if (!warehouseId) return 'Warehouse is required.';
    if (paymentType === 'Credit' && !dueDate) return 'Due Date is required for Credit purchase.';
    if (paymentType === 'Credit' && dueDate < purchaseDate) return 'Due Date cannot be before Purchase Date.';
    if (supplierInvoiceDate && supplierInvoiceDate > purchaseDate) return 'Supplier Invoice Date cannot be after Purchase Date.';
    if (lines.length === 0) return 'Add at least one purchase item.';
    if (freightAmount && !validMoneyPattern.test(cleanNumber(freightAmount))) return 'Freight must be a valid amount.';
    if (netAmount <= 0) return 'Net Amount must be greater than zero.';
    return null;
  }

  async function refreshData() {
    setMessage(null);
    try {
      const result = await supportQuery.refetch();
      if (result.error) throw result.error;
      setMessage({ kind: 'success', text: 'Purchase data refreshed successfully.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to refresh purchase data.') });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to print Purchase Voucher.') });
    }
  }

  async function savePurchase(postNow: boolean) {
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Purchase Voucher is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }

    const payload = {
      purchase_date: purchaseDate,
      supplier_id: supplierId,
      supplier_invoice_number: supplierInvoiceNumber || undefined,
      supplier_invoice_date: supplierInvoiceDate || undefined,
      payment_type: paymentType,
      due_date: paymentType === 'Credit' ? dueDate : undefined,
      warehouse_id: warehouseId,
      reference_number: referenceNumber || undefined,
      description: generatedVoucherDetails,
      freight_amount: freight,
      lines: lines.map(line => ({
        item_id: line.itemId,
        warehouse_id: warehouseId,
        quantity: numericValue(line.quantity),
        purchase_price: numericValue(line.purchasePrice),
        discount_amount: numericValue(line.discountAmount),
        tax_amount: numericValue(line.taxAmount),
        description: line.description || undefined,
      })),
    };

    try {
      const purchase = postNow
        ? await createAndPost.mutateAsync(payload)
        : await createDraft.mutateAsync(payload);
      await Promise.all([
        utils.purchases.list.invalidate(),
        utils.purchases.supportData.invalidate(),
      ]);
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${purchase.purchase_number} saved and posted successfully.`
          : `${purchase.purchase_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Unable to save Purchase Voucher.'),
      });
    }
  }

  const actionDisabled = saving || supportQuery.isLoading || supportQuery.isError;

  if (viewMode === 'posted') {
    return (
      <PostedPurchasesView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewPurchase={() => {
          resetForm();
          setViewMode('entry');
        }}
        onAnalytics={() => setViewMode('analytics')}
      />
    );
  }

  if (viewMode === 'analytics') {
    return (
      <PurchaseAnalyticsView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewPurchase={() => {
          resetForm();
          setViewMode('entry');
        }}
        onPostedPurchases={() => setViewMode('posted')}
      />
    );
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconShoppingCart size={20} stroke={1.8} /></div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Purchase Voucher</h1>
                <span style={badgeStyle('#1d4ed8', '#dbeafe')}>PI</span>
                <span style={statusBadgeStyle}><span style={{ color: 'var(--color-text-muted)' }}>Status</span> Draft</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => resetForm()} style={compactButtonStyle}><IconFilePlus size={15} /> New</button>
            <button className="btn-secondary" type="button" onClick={() => setViewMode('posted')} style={compactButtonStyle}><IconListSearch size={15} /> Posted Purchases</button>
            <button className="btn-secondary" type="button" onClick={() => setViewMode('analytics')} style={compactButtonStyle}><IconChartBar size={15} /> Analytics</button>
            <button className="btn-secondary" type="button" disabled={saving} onClick={refreshData} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" disabled={saving} onClick={printVoucher} style={compactButtonStyle}><IconPrinter size={15} /> Print</button>
            <button className="btn-secondary" type="button" onClick={() => resetForm()} style={compactButtonStyle}><IconCircleX size={15} /> Cancel</button>
            <button className="btn-secondary" type="button" disabled={actionDisabled} onClick={() => savePurchase(false)} style={compactButtonStyle}><IconDeviceFloppy size={15} /> Save Draft</button>
            <button className="btn-primary" type="button" disabled={actionDisabled} onClick={() => savePurchase(true)} style={compactButtonStyle}><IconCircleCheck size={15} /> Process</button>
          </div>
        </div>
      </section>

      {message && (
        <div style={messageStyle(message.kind)}>
          {message.kind === 'success' ? <IconCircleCheck size={18} /> : <IconFileInvoice size={18} />}
          {message.text}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 7, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 120px 145px 150px minmax(260px, 1fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Purchase Number"><input className="form-input" value="Auto" disabled style={compactInputStyle} /></FieldLabel>
          <FieldLabel label="Purchase Date" required>
            <input className="form-input" type="date" value={purchaseDate} onChange={event => setPurchaseDate(event.currentTarget.value)} style={compactDateInputStyle} />
          </FieldLabel>
          <FieldLabel label="Payment Type" required>
            <select className="form-input" value={paymentType} onChange={event => setPaymentType(event.currentTarget.value as PaymentType)} style={compactInputStyle}>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Bill Date">
            <input className="form-input" type="date" value={supplierInvoiceDate} onChange={event => setSupplierInvoiceDate(event.currentTarget.value)} style={compactDateInputStyle} />
          </FieldLabel>
          <FieldLabel label="Supplier Bill No.">
            <input className="form-input" value={supplierInvoiceNumber} onChange={event => setSupplierInvoiceNumber(event.currentTarget.value)} placeholder="Bill No." style={compactInputStyle} />
          </FieldLabel>
          <FieldLabel label="Supplier" required>
            <SearchableSelect value={supplierId} options={suppliers} onChange={setSupplierId} placeholder={supportQuery.isLoading ? 'Loading Suppliers' : 'Search Supplier'} disabled={supportQuery.isLoading || supportQuery.isError} />
          </FieldLabel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 0.9fr) minmax(190px, 0.7fr) 145px minmax(360px, 1.8fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Warehouse" required>
            <SearchableSelect value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
          </FieldLabel>
          <FieldLabel label="Reference Number">
            <input className="form-input" value={referenceNumber} onChange={event => setReferenceNumber(event.currentTarget.value)} placeholder="Optional Reference" style={compactInputStyle} />
          </FieldLabel>
          <FieldLabel label={paymentType === 'Credit' ? 'Due Date' : 'Balance Due'}>
            {paymentType === 'Credit' ? (
              <input className="form-input" type="date" value={dueDate} onChange={event => setDueDate(event.currentTarget.value)} style={compactDateInputStyle} />
            ) : (
              <input className="form-input" value={money(0)} disabled style={compactNumericInputStyle} />
            )}
          </FieldLabel>
          <FieldLabel label="Voucher Details">
            <input className="form-input" value={generatedVoucherDetails} disabled style={compactInputStyle} />
          </FieldLabel>
        </div>

        <div style={dateMessageStyle}>{dateStatusMessage}</div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'visible' }}>
          <div style={addLineRowStyle}>
            <div style={{ width: 275 }}>
              <FieldLabel label="Item" required>
                <SearchableSelect value={lineDraft.itemId} options={items} onChange={value => updateLineDraft({ itemId: value })} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
            </div>
            <div style={{ width: 82 }}><FieldLabel label="UOM"><input className="form-input" value={selectedItem?.uomName ?? ''} disabled style={compactInputStyle} /></FieldLabel></div>
            <div style={{ width: 92 }}>
              <FieldLabel label="Quantity" required>
                <input className="form-input" inputMode="decimal" value={lineDraft.quantity} onChange={event => updateLineDraft({ quantity: sanitizeMoneyInput(event.currentTarget.value, 4) })} style={compactNumericInputStyle} />
              </FieldLabel>
            </div>
            <div style={{ width: 112 }}>
              <FieldLabel label="Purchase Price" required>
                <input className="form-input" inputMode="decimal" value={lineDraft.purchasePrice} onChange={event => updateLineDraft({ purchasePrice: sanitizeMoneyInput(event.currentTarget.value) })} style={compactNumericInputStyle} />
              </FieldLabel>
            </div>
            <div style={{ width: 102 }}>
              <FieldLabel label="Discount">
                <input className="form-input" inputMode="decimal" value={lineDraft.discountAmount} onChange={event => updateLineDraft({ discountAmount: sanitizeMoneyInput(event.currentTarget.value) })} style={compactNumericInputStyle} />
              </FieldLabel>
            </div>
            <div style={{ width: 102 }}>
              <FieldLabel label="Tax">
                <input className="form-input" inputMode="decimal" value={lineDraft.taxAmount} onChange={event => updateLineDraft({ taxAmount: sanitizeMoneyInput(event.currentTarget.value) })} style={compactNumericInputStyle} />
              </FieldLabel>
            </div>
            <div style={{ width: 122 }}><FieldLabel label="Line Total"><input className="form-input" value={money(Math.max(0, lineDraftTotal.toNumber()))} disabled style={compactNumericInputStyle} /></FieldLabel></div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <FieldLabel label="Line Description">
                <input className="form-input" value={lineDraft.description} onChange={event => updateLineDraft({ description: event.currentTarget.value })} placeholder="Optional" style={compactInputStyle} />
              </FieldLabel>
            </div>
            <div style={{ display: 'flex', gap: 6, alignSelf: 'end' }}>
              <button type="button" className="btn-primary" onClick={addItemLine} style={{ ...compactButtonStyle, minWidth: 92 }}>
                {editingLineId ? <IconCircleCheck size={15} /> : <IconFilePlus size={15} />} {editingLineId ? 'Update' : 'Add'}
              </button>
              {editingLineId && (
                <button type="button" className="btn-secondary" onClick={cancelLineEdit} title="Cancel Line Edit" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}>
                  <IconCircleX size={15} />
                </button>
              )}
            </div>
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 34 }} />
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 112 }} />
                <col style={{ width: 102 }} />
                <col style={{ width: 102 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr>
                  {['No.', 'Item Code', 'Item Name', 'UOM', 'Quantity', 'Purchase Price', 'Discount', 'Tax', 'Amount', 'Actions'].map((label, index) => (
                    <th key={label || 'delete'} style={tableHeadStyle(index >= 4 && index <= 8)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Add items using the entry row above.
                    </td>
                  </tr>
                ) : lines.map((line, index) => (
                  <tr key={line.id}>
                    <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
                    <td style={tableCellStyle()}>{line.itemCode}</td>
                    <td style={tableCellStyle()}>{line.itemName}</td>
                    <td style={tableCellStyle()}>{line.uomName}</td>
                    <td style={tableCellStyle(true)}>{formatNumber(Number(line.quantity), generalSettings)}</td>
                    <td style={tableCellStyle(true)}>{money(Number(line.purchasePrice))}</td>
                    <td style={tableCellStyle(true)}>{money(Number(line.discountAmount))}</td>
                    <td style={tableCellStyle(true)}>{money(Number(line.taxAmount))}</td>
                    <td style={tableCellStyle(true)}><strong>{money(line.lineTotal)}</strong></td>
                    <td style={tableCellStyle()}>
                      <div style={lineActionGroupStyle}>
                        <button type="button" className="btn-ghost" onClick={() => moveLine(line.id, -1)} disabled={index === 0} title="Move Line Up" style={lineActionButtonStyle}>
                          <IconArrowUp size={14} />
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => moveLine(line.id, 1)} disabled={index === lines.length - 1} title="Move Line Down" style={lineActionButtonStyle}>
                          <IconArrowDown size={14} />
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => editLine(line)} title="Edit Line" style={lineActionButtonStyle}>
                          <IconPencil size={14} />
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => removeLine(line.id)} title="Remove Line" style={{ ...lineActionButtonStyle, color: 'var(--color-danger)' }}>
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={summaryFooterStyle}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
            Total Items: <strong style={{ color: 'var(--color-text)' }}>{lines.length}</strong>
          </span>
          <div style={summaryValuesStyle}>
            <SummaryBox label="Gross Amount" value={grossAmount} money={money} />
            <SummaryBox label="Discount" value={discountAmount} money={money} />
            <SummaryBox label="Tax" value={taxAmount} money={money} />
            <SummaryInputBox
              label="Freight"
              value={freightAmount}
              onChange={setFreightAmount}
              onFocus={() => setFreightAmount(cleanNumber(freightAmount))}
              onBlur={() => setFreightAmount(formatAmountInput(freightAmount, generalSettings))}
            />
            <SummaryBox label="Net Amount" value={netAmount} strong money={money} />
            <SummaryBox label="Balance Due" value={balanceDue} money={money} />
          </div>
        </div>
      </section>
    </main>
  );
}

function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    color,
    background,
    fontSize: '0.68rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}

function tableHeadStyle(right = false): CSSProperties {
  return {
    height: 30,
    padding: '5px 7px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    border: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
  };
}

function tableCellStyle(right = false): CSSProperties {
  return {
    padding: 4,
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-surface)',
    verticalAlign: 'middle',
    textAlign: right ? 'right' : 'left',
    fontFamily: right ? 'var(--font-mono)' : undefined,
    fontWeight: right ? 800 : undefined,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

const compactInputStyle: CSSProperties = {
  height: 28,
  minHeight: 28,
  padding: '3px 8px',
  fontSize: '0.76rem',
};

const compactNumericInputStyle: CSSProperties = {
  ...compactInputStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
};

const compactDateInputStyle: CSSProperties = {
  ...compactInputStyle,
  padding: '3px 2px 3px 5px',
  fontSize: '0.72rem',
};

const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
};

const toolbarStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--color-workspace-shadow)',
  padding: '8px 10px',
  flexShrink: 0,
};

const titleIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 'var(--radius)',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
  background: 'linear-gradient(135deg, #0f6bff, #14b8a6)',
};

const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 22,
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt)',
  color: 'var(--color-text-secondary)',
  fontSize: '0.68rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

function messageStyle(kind: MessageKind): CSSProperties {
  return {
    flexShrink: 0,
    borderRadius: 'var(--radius)',
    padding: '7px 10px',
    border: `1px solid ${kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
    background: kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    color: kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.78rem',
  };
}

const dateMessageStyle: CSSProperties = {
  minHeight: 16,
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-danger-text)',
  fontWeight: 500,
  fontSize: '0.66rem',
  lineHeight: 1.2,
  padding: 0,
  overflow: 'hidden',
};

const addLineRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'end',
  padding: '0 0 8px',
  minWidth: 0,
  position: 'relative',
  zIndex: 5,
  overflow: 'visible',
};

const summaryFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 12,
  alignItems: 'center',
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 10,
  minHeight: 66,
  overflow: 'hidden',
};

const summaryValuesStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  overflow: 'hidden',
};

const analyticsColors = ['#2563eb', '#0f766e', '#7c3aed', '#f97316', '#0891b2', '#be123c', '#65a30d', '#9333ea'];

const analyticsFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(230px, 1.5fr) 120px minmax(210px, 1.35fr) 118px 118px auto',
  gap: 8,
  alignItems: 'end',
  overflow: 'visible',
  position: 'relative',
  zIndex: 6,
};

const analyticsKpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
  gap: 9,
};

const analyticsInsightGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))',
  gap: 9,
};

const analyticsMainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: 10,
};

const analyticsSmallGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
  gap: 10,
};

const analyticsPanelStyle: CSSProperties = {
  minHeight: 0,
  padding: 12,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.92), var(--color-surface-alt))',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
};

const analyticsEmptyStyle: CSSProperties = {
  minHeight: 150,
  display: 'grid',
  placeItems: 'center',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-muted)',
  fontSize: '0.8rem',
  fontWeight: 800,
  background: 'var(--color-surface-alt)',
};

const chartTooltipStyle: CSSProperties = {
  minWidth: 190,
  padding: '9px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)',
};

const donutCenterStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '47%',
  transform: 'translate(-50%, -50%)',
  display: 'grid',
  gap: 2,
  textAlign: 'center',
  pointerEvents: 'none',
  color: 'var(--color-text-muted)',
  fontSize: '0.62rem',
  fontWeight: 900,
};

const purchaseFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.6fr) minmax(210px, 1.35fr) 112px minmax(190px, 1.2fr) 118px 118px 112px 112px auto',
  gap: 7,
  alignItems: 'end',
  overflow: 'visible',
  position: 'relative',
  zIndex: 6,
};

const purchaseDetailPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gap: 8,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  padding: 8,
};

const detailMessageStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  color: 'var(--color-text-muted)',
  fontSize: '0.76rem',
  fontWeight: 700,
  minHeight: 120,
};

const purchaseListFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minHeight: 34,
  color: 'var(--color-text-muted)',
  fontSize: '0.74rem',
  fontWeight: 700,
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 6,
};

const printPreviewOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(15, 23, 42, 0.58)',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
};

const printPreviewShellStyle: CSSProperties = {
  width: 'min(1120px, 96vw)',
  height: 'min(92vh, 880px)',
  background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  overflow: 'hidden',
};

const printPreviewToolbarStyle: CSSProperties = {
  minHeight: 54,
  padding: '10px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  background: 'var(--color-surface)',
  borderBottom: '1px solid var(--color-border)',
};

const printPreviewPaperWrapStyle: CSSProperties = {
  overflow: 'auto',
  padding: 18,
  display: 'flex',
  justifyContent: 'center',
};

const printPreviewPaperStyle: CSSProperties = {
  width: 794,
  minHeight: 1123,
  background: '#fff',
  color: '#0f172a',
  boxShadow: '0 18px 46px rgba(15, 23, 42, 0.20)',
  padding: 44,
  fontSize: 11,
  lineHeight: 1.4,
};

const printHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  borderBottom: '2px solid #0f172a',
  paddingBottom: 12,
};

const printMutedStyle: CSSProperties = {
  color: '#475569',
  fontSize: 10,
};

const printStatusStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 9px',
  border: '1px solid #15803d',
  color: '#14532d',
  background: '#f0fdf4',
  fontWeight: 800,
  borderRadius: 3,
};

const printInfoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  marginTop: 14,
};

const printInfoBoxStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '7px 8px',
  minHeight: 44,
};

const printLabelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 9,
  fontWeight: 800,
  marginBottom: 3,
};

const printValueStyle: CSSProperties = {
  fontWeight: 800,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const printPartyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginTop: 14,
};

const printBoxStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: 10,
  minHeight: 80,
};

const printBoxTitleStyle: CSSProperties = {
  marginBottom: 6,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#334155',
  fontWeight: 800,
};

const printTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 14,
};

function printThStyle(right = false): CSSProperties {
  return {
    background: '#102033',
    color: '#fff',
    textAlign: right ? 'right' : 'left',
    padding: '7px 6px',
    border: '1px solid #102033',
    fontSize: 10,
  };
}

function printTdStyle(right = false, center = false): CSSProperties {
  return {
    padding: 6,
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    textAlign: center ? 'center' : right ? 'right' : 'left',
    fontVariantNumeric: right ? 'tabular-nums' : undefined,
    whiteSpace: right ? 'nowrap' : undefined,
  };
}

const printFooterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 260px',
  gap: 18,
  marginTop: 12,
  alignItems: 'start',
};

const printTotalsStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
};

const printTotalRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '7px 9px',
  borderBottom: '1px solid #e2e8f0',
};

const printSignatureGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 24,
  marginTop: 42,
};

const printSignatureStyle: CSSProperties = {
  borderTop: '1px solid #334155',
  paddingTop: 6,
  textAlign: 'center',
  color: '#334155',
  fontWeight: 800,
};

const lineActionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
};

const lineActionButtonStyle: CSSProperties = {
  width: 20,
  minWidth: 20,
  minHeight: 24,
  padding: 2,
  color: 'var(--color-text-secondary)',
};
