import { formatDate } from '@/lib/app-settings';
import { escapeHtml } from '@/lib/erp-utils';

const html = escapeHtml;

function voucherTypeLabel(type: string) {
  const labels: Record<string, string> = {
    BRV: 'Bank Receipt Voucher',
    BPV: 'Bank Payment Voucher',
    CRV: 'Cash Receipt Voucher',
    CPV: 'Cash Payment Voucher',
    JV: 'Journal Voucher',
    PI: 'Purchase Invoice Voucher',
    CV: 'Contra Voucher',
    DN: 'Debit Note',
    CN: 'Credit Note',
  };
  return labels[type] ?? type;
}

export function buildPostedVoucherPrintHtml({
  voucher,
  company,
  generalSettings,
  money,
}: {
  voucher: any;
  company: any;
  generalSettings: any;
  money: (value: string | number) => string;
}) {
  const lines = voucher.lines ?? [];
  const companyName = company?.name ?? 'Company Name';
  const companyInfo = [company?.address, company?.city, company?.country].filter(Boolean).join(', ');
  const contactInfo = [company?.phone, company?.email].filter(Boolean).join(' | ');
  const title = voucherTypeLabel(voucher.voucher_type);

  const lineRows = lines.map((line: any) => `
    <tr>
      <td class="center">${html(line.line_no)}</td>
      <td>
        <div class="strong">${html(line.account_code)} - ${html(line.account_name)}</div>
        ${line.narration ? `<div class="muted">${html(line.narration)}</div>` : ''}
      </td>
      <td class="number">${Number(line.dr_amount) > 0 ? html(money(line.dr_amount)) : '-'}</td>
      <td class="number">${Number(line.cr_amount) > 0 ? html(money(line.cr_amount)) : '-'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${html(title)} - ${html(voucher.voucher_number)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 11px; background: #fff; }
    .page { width: 100%; min-height: 100%; }
    .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .company { max-width: 60%; }
    .company h1 { margin: 0 0 5px; font-size: 20px; letter-spacing: 0; }
    .doc-title { text-align: right; min-width: 240px; }
    .doc-title h2 { margin: 0 0 8px; font-size: 19px; letter-spacing: 0; }
    .status { display: inline-block; padding: 4px 9px; border: 1px solid #15803d; color: #14532d; background: #f0fdf4; font-weight: 700; border-radius: 3px; }
    .muted { color: #475569; font-size: 10px; line-height: 1.4; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
    .info { border: 1px solid #cbd5e1; padding: 7px 8px; min-height: 44px; }
    .label { color: #64748b; font-size: 9px; font-weight: 700; margin-bottom: 3px; }
    .value { font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
    .box { border: 1px solid #cbd5e1; padding: 10px; min-height: 76px; margin-top: 12px; }
    .box-title { margin-bottom: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #334155; font-weight: 700; }
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
        <div class="status">${html(voucher.status)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info"><div class="label">Voucher Number</div><div class="value">${html(voucher.voucher_number)}</div></div>
      <div class="info"><div class="label">Voucher Date</div><div class="value">${html(formatDate(voucher.voucher_date, generalSettings))}</div></div>
      <div class="info"><div class="label">Voucher Type</div><div class="value">${html(title)}</div></div>
      <div class="info"><div class="label">Posted At</div><div class="value">${html(voucher.posted_at ? formatDate(voucher.posted_at, generalSettings) : '-')}</div></div>
      <div class="info"><div class="label">Reference</div><div class="value">${html(voucher.reference || '-')}</div></div>
      <div class="info"><div class="label">Approval Status</div><div class="value">${html(voucher.approval_status || '-')}</div></div>
      <div class="info"><div class="label">Total Debit</div><div class="value number">${html(money(voucher.total_debit))}</div></div>
      <div class="info"><div class="label">Total Credit</div><div class="value number">${html(money(voucher.total_credit))}</div></div>
    </div>

    <div class="box">
      <div class="box-title">Description</div>
      <div>${html(voucher.narration || '-')}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:42px" class="center">No.</th>
          <th>Account</th>
          <th style="width:120px" class="number">Debit</th>
          <th style="width:120px" class="number">Credit</th>
        </tr>
      </thead>
      <tbody>${lineRows || '<tr><td colspan="4" class="center">No voucher lines found.</td></tr>'}</tbody>
    </table>

    <div class="footer">
      <div class="notes">
        <div class="box-title">Notes</div>
        <div>This is a system generated accounting voucher.</div>
      </div>
      <div class="totals">
        <div class="total-row"><span>Total Debit</span><span>${html(money(voucher.total_debit))}</span></div>
        <div class="total-row"><span>Total Credit</span><span>${html(money(voucher.total_credit))}</span></div>
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

export function printPostedVoucherDocument({
  voucher,
  company,
  generalSettings,
  money,
}: {
  voucher: any;
  company: any;
  generalSettings: any;
  money: (value: string | number) => string;
}) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const printDocument = frame.contentWindow?.document;
  if (!printDocument || !frame.contentWindow) {
    frame.remove();
    throw new Error('Unable to prepare print document. Please try again.');
  }

  printDocument.open();
  printDocument.write(buildPostedVoucherPrintHtml({ voucher, company, generalSettings, money }));
  printDocument.close();

  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}
