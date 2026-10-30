import type { ReactNode } from 'react';

/** Plain-words help for each report, shown from the help button beside the page title. */
const viewSteps = <p>Choose the filters, then click View Report. Use Print or Export to save a copy.</p>;

export const reportHelp: Record<string, ReactNode> = {
  'purchase-summary': (
    <>
      <p>This report lists posted Purchase Vouchers with their totals.</p>
      <p>Filter by Supplier, Warehouse, dates, or amount. The totals row covers all matching records, not only this page.</p>
    </>
  ),
  'purchase-return-summary': (
    <>
      <p>This report lists posted Purchase Returns with their totals.</p>
      <p>Filter by Supplier, Warehouse, dates, or amount. The totals row covers all matching records, not only this page.</p>
    </>
  ),
  'sales-summary': (
    <>
      <p>This report lists posted Sale Vouchers with their totals.</p>
      <p>Filter by Customer, Branch, dates, or amount. The totals row covers all matching records, not only this page.</p>
    </>
  ),
  'sale-return-summary': (
    <>
      <p>This report lists posted Sale Returns with their totals.</p>
      <p>Filter by Customer, Branch, dates, or amount. The totals row covers all matching records, not only this page.</p>
    </>
  ),
  'stock-summary': (
    <>
      <p>This report shows the stock in one Warehouse right now.</p>
      <p>Available is Stock On Hand minus Reserved. To see stock on an earlier date, use Stock Valuation.</p>
    </>
  ),
  'stock-ledger': (
    <>
      <p>This report shows every stock movement for one Item, with a running balance.</p>
      {viewSteps}
      <p>The report starts with the Opening Balance on Date From.</p>
    </>
  ),
  'stock-valuation': (
    <>
      <p>This report shows the quantity and value of stock on one date.</p>
      {viewSteps}
      <p>The Stock Value Check compares stock value with the Inventory account balance. They should match.</p>
    </>
  ),
  ledger: (
    <>
      <p>This report shows all posted transactions of one Account, with a running balance.</p>
      {viewSteps}
      <p>Click a Voucher Number to open the voucher. Drafts are not included.</p>
    </>
  ),
  'cash-book': (
    <>
      <p>This report shows all posted cash received and paid for one Cash Account.</p>
      {viewSteps}
      <p>Drafts are not included.</p>
    </>
  ),
  'bank-book': (
    <>
      <p>This report shows all posted money received and paid for one Bank Account.</p>
      {viewSteps}
      <p>Drafts are not included.</p>
    </>
  ),
  'day-book': (
    <>
      <p>This report lists all posted vouchers between two dates, with their Debit and Credit lines.</p>
      {viewSteps}
      <p>Click a voucher number to open it. Totals cover the whole period.</p>
    </>
  ),
  'trial-balance': (
    <>
      <p>This report shows the opening, period, and closing balance of every Account.</p>
      {viewSteps}
      <p>Total Debit must equal total Credit. A Difference means something needs checking.</p>
    </>
  ),
  'balance-sheet': (
    <>
      <p>This report shows what the company owns (Assets) and owes (Liabilities), and its Equity, on one date.</p>
      {viewSteps}
      <p>Assets must equal Liabilities and Equity. The current year Profit or Loss is included in Equity.</p>
    </>
  ),
  'profit-and-loss': (
    <>
      <p>This report shows revenue and expenses between two dates, and the Profit or Loss.</p>
      {viewSteps}
      <p>Only posted transactions are included.</p>
    </>
  ),
  'customer-ledger': (
    <>
      <p>This report shows all posted transactions of one Customer, with a running balance.</p>
      {viewSteps}
      <p>A Debit balance means the Customer owes you money.</p>
    </>
  ),
  'supplier-ledger': (
    <>
      <p>This report shows all posted transactions of one Supplier, with a running balance.</p>
      {viewSteps}
      <p>A Credit balance means you owe the Supplier money.</p>
    </>
  ),
  'receivables-aging': (
    <>
      <p>This report shows how much each Customer owes you, grouped by how old the amounts are, in days.</p>
      <p>Choose the As Of Date, then click View Report. Click a Customer name to open their ledger.</p>
      <p>Payments are matched to the oldest open amounts first.</p>
    </>
  ),
  'payables-aging': (
    <>
      <p>This report shows how much you owe each Supplier, grouped by how old the amounts are, in days.</p>
      <p>Choose the As Of Date, then click View Report. Click a Supplier name to open their ledger.</p>
      <p>Payments are matched to the oldest open amounts first.</p>
    </>
  ),
  'sales-tax': (
    <>
      <p>This report shows the tax charged on sales (Output Tax) and the tax paid on purchases (Input Tax).</p>
      {viewSteps}
      <p>Net Tax Payable is Output Tax minus Input Tax. Returns are shown as negative amounts.</p>
    </>
  ),
  'audit-trail-summary': (
    <>
      <p>This report provides an immutable chronological audit trail of all enterprise ledger, document, and master-data operations.</p>
      <p>Filter by Operator, Event Action, Target Module, Four-Eyes verification status, and date range. Use Print or Export to produce an official audit report.</p>
    </>
  ),
  'audit-four-eyes': (
    <>
      <p>This report highlights maker-checker separation of duties and dual-control approvals across financial vouchers and sensitive mutations.</p>
      <p>Verify that posting operators differ from draft creators and inspect approver identities.</p>
    </>
  ),
  'audit-auth-activity': (
    <>
      <p>This report tracks operator authentication telemetry, logins, session creations, and credential activities across branches.</p>
      <p>Monitor security events and client IP address origins.</p>
    </>
  ),
  'audit-sensitive-ops': (
    <>
      <p>This report captures high-impact security operations including deletions, voids, cancellations, reversals, and password resets.</p>
      <p>All sensitive events record the originating actor and target document details.</p>
    </>
  ),
  'audit-module-mutations': (
    <>
      <p>This report tracks mutations across key business modules (Vouchers, Accounts, Products, Customers, Suppliers).</p>
      <p>Analyze target entity volatility and master-data adjustments.</p>
    </>
  ),
};
