import { formatDate, formatNumber } from '@/lib/app-settings';
import { escapeHtml } from '@/lib/erp-utils';
import type { PurchasePrintProps } from './PurchasePrintTypes';

const html = escapeHtml;

export function buildPurchaseInvoicePrintHtml({
  invoice,
  company,
  generalSettings,
  money,
  title,
}: PurchasePrintProps & { title: string }) {
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
        <div>Location: <span class="strong">${html(invoice.location_code ? `${invoice.location_code} - ${invoice.location_name}` : invoice.location_name || '-')}</span></div>
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

export function openPurchaseInvoicePrintWindow(
  invoice: any,
  company: any,
  generalSettings: PurchasePrintProps['generalSettings'],
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
