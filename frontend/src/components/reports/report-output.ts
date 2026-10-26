import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { escapeHtml } from '@/lib/erp-utils';

/** How a column is shown: money and quantity are formatted from settings and right aligned. */
export type ReportColumnKind = 'text' | 'money' | 'quantity' | 'date';

export interface ReportColumn {
  label: string;
  kind?: ReportColumnKind;
}

export interface ReportRow {
  /** Raw values: numbers as plain decimal text (e.g. "1250.50"), dates as YYYY-MM-DD. */
  cells: Array<string | number | null | undefined>;
  /** Group and total rows are printed in bold. */
  style?: 'normal' | 'group' | 'total';
}

/** Everything a report needs for Print and Export, independent of how the screen shows it. */
export interface ReportDocument {
  title: string;
  /** Period or filters, for example "01 Jul 2026 to 31 Oct 2026 · Main Warehouse". */
  subtitle?: string;
  summary?: Array<{ label: string; value: string }>;
  columns: ReportColumn[];
  rows: ReportRow[];
  note?: string;
  /** File name for Export, without extension. */
  fileName: string;
}

export interface ReportCompany {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_registration_no?: string | null;
}

const html = escapeHtml;

function displayValue(value: ReportRow['cells'][number], kind: ReportColumnKind | undefined, settings?: AppFormatSettingsSource | null) {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'money') return formatMoney(value, settings);
  if (kind === 'quantity') return formatNumber(value, settings);
  if (kind === 'date') return formatDate(String(value), settings);
  return String(value);
}

export function buildReportPrintHtml(report: ReportDocument, company?: ReportCompany | null, settings?: AppFormatSettingsSource | null) {
  const companyName = company?.name || 'Company';
  const companyInfo = [company?.address, company?.city, company?.country].filter(Boolean).join(', ');
  const contactInfo = [company?.phone, company?.email, company?.tax_registration_no ? `Tax No. ${company.tax_registration_no}` : '']
    .filter(Boolean).join(' | ');
  const isNumeric = (column: ReportColumn) => column.kind === 'money' || column.kind === 'quantity';

  const head = report.columns
    .map(column => `<th class="${isNumeric(column) ? 'num' : ''}">${html(column.label)}</th>`)
    .join('');
  const body = report.rows.length
    ? report.rows.map(row => `<tr class="${row.style ?? 'normal'}">${row.cells.map((cell, index) => {
      const column = report.columns[index];
      return `<td class="${column && isNumeric(column) ? 'num' : ''}">${html(displayValue(cell, column?.kind, settings))}</td>`;
    }).join('')}</tr>`).join('')
    : `<tr><td colspan="${report.columns.length}" class="empty">No records for the selected filters.</td></tr>`;
  const summary = report.summary?.length
    ? `<div class="summary">${report.summary.map(item => `<div class="box"><div class="label">${html(item.label)}</div><div class="value">${html(item.value)}</div></div>`).join('')}</div>`
    : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${html(report.title)}</title>
  <style>
    @page { size: A4 ${report.columns.length > 7 ? 'landscape' : 'portrait'}; margin: 10mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #64748b; } }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 10px; background: #fff; }
    .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .top h1 { margin: 0 0 4px; font-size: 18px; }
    .top h2 { margin: 0 0 4px; font-size: 16px; text-align: right; }
    .muted { color: #475569; line-height: 1.4; }
    .right { text-align: right; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 10px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 8px; }
    .label { color: #64748b; font-size: 9px; font-weight: 700; }
    .value { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    thead { display: table-header-group; }
    th { background: #102033; color: #fff; text-align: left; padding: 5px; border: 1px solid #102033; font-size: 9px; }
    td { padding: 4px 5px; border: 1px solid #cbd5e1; vertical-align: top; }
    tr { page-break-inside: avoid; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr.group td { background: #f1f5f9; font-weight: 700; }
    tr.total td { background: #e2e8f0; font-weight: 800; border-top: 2px solid #0f172a; }
    .empty { text-align: center; color: #64748b; padding: 14px; }
    .note { margin-top: 8px; color: #334155; }
    .footer { display: flex; justify-content: space-between; margin-top: 10px; color: #64748b; font-size: 9px; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>${html(companyName)}</h1>
      <div class="muted">${html(companyInfo)}</div>
      <div class="muted">${html(contactInfo)}</div>
    </div>
    <div class="right">
      <h2>${html(report.title)}</h2>
      <div class="muted">${html(report.subtitle ?? '')}</div>
      <div class="muted">Printed On ${html(formatDate(new Date(), settings))}</div>
    </div>
  </div>
  ${summary}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${report.note ? `<div class="note">${html(report.note)}</div>` : ''}
  <div class="footer"><div>Posted transactions only unless stated.</div><div>System generated report.</div></div>
</body>
</html>`;
}

/** Opens the browser print dialog (Print or Save as PDF) for the report. */
export function printReport(report: ReportDocument, company?: ReportCompany | null, settings?: AppFormatSettingsSource | null) {
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const printDocument = frame.contentWindow?.document;
  if (!printDocument || !frame.contentWindow) {
    frame.remove();
    throw new Error('Unable to prepare the report for printing. Please try again.');
  }
  printDocument.open();
  printDocument.write(buildReportPrintHtml(report, company, settings));
  printDocument.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  // Leading = + - @ would run as a formula in Excel, so such text is quoted with an apostrophe.
  const safe = /^[=+@]/.test(text) || (/^-/.test(text) && Number.isNaN(Number(text))) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildReportCsv(report: ReportDocument) {
  const lines = [
    [report.title],
    ...(report.subtitle ? [[report.subtitle]] : []),
    [],
    report.columns.map(column => column.label),
    ...report.rows.map(row => row.cells),
  ];
  return lines.map(line => line.map(csvCell).join(',')).join('\r\n');
}

/** Downloads the report as a CSV file that opens in Excel (raw numbers, no currency symbols). */
export function downloadReportCsv(report: ReportDocument) {
  // The byte order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', buildReportCsv(report)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.fileName.replace(/[^A-Za-z0-9-_]+/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
