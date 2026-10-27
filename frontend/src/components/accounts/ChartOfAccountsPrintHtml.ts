import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { escapeHtml } from '@/lib/erp-utils';
import { printPaletteCss } from '@/lib/print-palette';
import type { AccountListItem } from '@/lib/api/accounts';
import { getAccountLevel, getAccountLevelLabel } from '@/modules/accounts/account-code';

const html = escapeHtml;

const ACCOUNT_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

function groupedAccounts(accounts: AccountListItem[]) {
  return ACCOUNT_TYPE_ORDER.map(accountType => ({
    accountType,
    accounts: accounts
      .filter(account => account.account_type === accountType)
      .sort((a, b) => a.code.localeCompare(b.code)),
  })).filter(group => group.accounts.length > 0);
}

function formatBalance(value: string | null | undefined, settings?: AppFormatSettingsSource | null) {
  return formatNumber(Number(value ?? 0), settings);
}

function accountRows(accounts: AccountListItem[], settings?: AppFormatSettingsSource | null) {
  return groupedAccounts(accounts).map(group => {
    const rows = group.accounts.map(account => {
      const level = getAccountLevel(account.code);
      const indent = Math.max(0, level - 1) * 14;
      const levelLabel = getAccountLevelLabel(account.code);
      const rowClass = account.is_posting ? 'posting-row' : `header-row level-${level}`;
      const status = account.is_active ? 'Active' : 'Inactive';

      return `
        <tr class="${rowClass}">
          <td class="code">${html(account.code)}</td>
          <td>
            <div class="account-name" style="padding-left:${indent}px">${html(account.name)}</div>
            ${account.description ? `<div class="description" style="padding-left:${indent}px">${html(account.description)}</div>` : ''}
          </td>
          <td>${html(levelLabel)}</td>
          <td><span class="badge ${account.is_posting ? 'badge-posting' : 'badge-header'}">${account.is_posting ? 'Posting' : 'Header'}</span></td>
          <td>${html(account.normal_balance)}</td>
          <td class="number">${html(formatBalance(account.opening_balance, settings))}</td>
          <td class="number">${html(formatBalance(account.current_balance, settings))}</td>
          <td><span class="badge ${account.is_active ? 'badge-active' : 'badge-inactive'}">${html(status)}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <tr class="group-row">
        <td colspan="8">${html(group.accountType)}</td>
      </tr>
      ${rows}
    `;
  }).join('');
}

export function buildChartOfAccountsPrintHtml({
  accounts,
  company,
  generalSettings,
}: {
  accounts: AccountListItem[];
  company: any;
  generalSettings?: AppFormatSettingsSource | null;
}) {
  const companyName = company?.name ?? 'Company Name';
  const companyInfo = [company?.address, company?.city, company?.country].filter(Boolean).join(', ');
  const contactInfo = [company?.phone, company?.email].filter(Boolean).join(' | ');
  const activeCount = accounts.filter(account => account.is_active).length;
  const headerCount = accounts.filter(account => !account.is_posting).length;
  const postingCount = accounts.filter(account => account.is_posting).length;
  const systemCount = accounts.filter(account => account.is_system).length;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chart of Accounts</title>
  <style>
    ${printPaletteCss()}
    /* Printed text is at least 10px: paper is read close up. Colours come from the --print-* tokens. */
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: rgb(var(--print-ink)); font-family: Arial, sans-serif; font-size: 10px; background: rgb(var(--print-paper)); }
    .page { width: 100%; min-height: 100%; }
    .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid rgb(var(--print-ink)); padding-bottom: 10px; }
    .company { max-width: 58%; }
    .company h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0; }
    .muted { color: rgb(var(--print-muted)); font-size: 10px; line-height: 1.35; }
    .doc-title { text-align: right; min-width: 260px; }
    .doc-title h2 { margin: 0 0 6px; font-size: 19px; letter-spacing: 0; }
    .report-meta { color: rgb(var(--print-muted)); line-height: 1.45; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 12px; }
    .summary-box { border: 1px solid rgb(var(--print-rule)); padding: 8px 9px; min-height: 42px; }
    .summary-label { color: rgb(var(--print-faint)); font-size: 10px; font-weight: 700; margin-bottom: 3px; }
    .summary-value { font-size: 14px; font-weight: 800; }
    .note { margin-top: 10px; padding: 8px 10px; border: 1px solid rgb(var(--print-accent) / 0.35); background: rgb(var(--print-accent-soft)); color: rgb(var(--print-accent)); font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: rgb(var(--print-head-bg)); color: rgb(var(--print-head-fg)); text-align: left; padding: 6px 5px; border: 1px solid rgb(var(--print-head-bg)); font-size: 10px; }
    td { padding: 5px; border: 1px solid rgb(var(--print-rule)); vertical-align: top; page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
    .group-row td { background: rgb(var(--print-accent-soft)); color: rgb(var(--print-accent)); font-size: 11px; font-weight: 800; border-color: rgb(var(--print-accent) / 0.45); }
    .header-row td { background: rgb(var(--print-band) / 0.5); font-weight: 700; }
    .level-1 td { background: rgb(var(--print-rule) / 0.55); color: rgb(var(--print-ink)); }
    .level-2 td { background: rgb(var(--print-band)); }
    .level-3 td { background: rgb(var(--print-band) / 0.5); }
    .posting-row td { background: rgb(var(--print-paper)); }
    .account-name { font-weight: 700; line-height: 1.25; }
    .description { margin-top: 2px; color: rgb(var(--print-faint)); font-weight: 400; font-size: 10px; line-height: 1.25; }
    .code { font-family: "Courier New", monospace; font-weight: 700; white-space: nowrap; }
    .number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .badge { display: inline-block; min-width: 50px; padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 800; text-align: center; border: 1px solid transparent; }
    .badge-posting { color: rgb(var(--print-ink)); background: rgb(var(--print-band)); border-color: rgb(var(--print-rule-strong)); }
    .badge-header { color: rgb(var(--print-accent)); background: rgb(var(--print-accent-soft)); border-color: rgb(var(--print-accent) / 0.45); }
    .badge-active { color: rgb(var(--print-ink)); background: rgb(var(--print-band)); border-color: rgb(var(--print-rule-strong)); }
    .badge-inactive { color: rgb(var(--print-negative)); background: rgb(var(--print-negative) / 0.08); border-color: rgb(var(--print-negative) / 0.4); }
    .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; color: rgb(var(--print-faint)); font-size: 10px; }
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
        <h2>Chart of Accounts</h2>
        <div class="report-meta">Formatted Account List</div>
        <div class="report-meta">Printed On ${html(formatDate(new Date(), generalSettings))}</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-box"><div class="summary-label">Total Accounts</div><div class="summary-value">${html(formatNumber(accounts.length, { ...(generalSettings ?? {}), decimal_places: 0 }))}</div></div>
      <div class="summary-box"><div class="summary-label">Header Accounts</div><div class="summary-value">${html(formatNumber(headerCount, { ...(generalSettings ?? {}), decimal_places: 0 }))}</div></div>
      <div class="summary-box"><div class="summary-label">Posting Accounts</div><div class="summary-value">${html(formatNumber(postingCount, { ...(generalSettings ?? {}), decimal_places: 0 }))}</div></div>
      <div class="summary-box"><div class="summary-label">Active Accounts</div><div class="summary-value">${html(formatNumber(activeCount, { ...(generalSettings ?? {}), decimal_places: 0 }))}</div></div>
      <div class="summary-box"><div class="summary-label">System Accounts</div><div class="summary-value">${html(formatNumber(systemCount, { ...(generalSettings ?? {}), decimal_places: 0 }))}</div></div>
    </div>

    <div class="note">
      Header accounts organize the hierarchy. Posting accounts are the accounts used in vouchers and accounting transactions.
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:82px">Code</th>
          <th>Account Name</th>
          <th style="width:92px">Level</th>
          <th style="width:72px">Kind</th>
          <th style="width:74px">Balance</th>
          <th style="width:100px" class="number">Opening</th>
          <th style="width:100px" class="number">Current</th>
          <th style="width:64px">Status</th>
        </tr>
      </thead>
      <tbody>
        ${accountRows(accounts, generalSettings) || '<tr><td colspan="8" style="text-align:center">No accounts found.</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      <div>10-digit format: MM GG SS PPPP</div>
      <div>This is a system generated Chart of Accounts report.</div>
    </div>
  </div>
</body>
</html>`;
}

export function printChartOfAccountsReport({
  accounts,
  company,
  generalSettings,
}: {
  accounts: AccountListItem[];
  company: any;
  generalSettings?: AppFormatSettingsSource | null;
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
    throw new Error('Unable to prepare PDF report. Please try again.');
  }

  printDocument.open();
  printDocument.write(buildChartOfAccountsPrintHtml({ accounts, company, generalSettings }));
  printDocument.close();

  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}
