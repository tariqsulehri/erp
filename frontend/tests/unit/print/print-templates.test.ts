import { printPaletteCss } from '@/lib/print-palette';
import { buildReportPrintHtml } from '@/components/reports/report-output';
import { buildPostedVoucherPrintHtml } from '@/components/vouchers/VoucherPrintHtml';
import { buildPurchaseInvoicePrintHtml } from '@/components/purchases/PurchasePrintHtml';
import { buildChartOfAccountsPrintHtml } from '@/components/accounts/ChartOfAccountsPrintHtml';

const COLOUR_LITERAL = /(^|[^&\w])#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b|rgba?\(\s*[0-9]|hsla?\(\s*[0-9]|:\s*(white|black)\b/;

function styleBlock(html: string) {
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!match) throw new Error('No style block');
  return match[1];
}

function fontSizes(css: string) {
  return Array.from(css.matchAll(/font-size:\s*(\d+)px/g), m => Number(m[1]));
}

const company = { name: 'Test Company', address: '1 Main Road', city: 'Lahore', country: 'Pakistan', phone: '123', email: 'a@b.c' };
const money = (value: string | number) => Number(value).toFixed(2);

const templates: Array<[string, () => string]> = [
  ['report', () => buildReportPrintHtml({
    title: 'Trial Balance',
    subtitle: 'All Branches',
    summary: [{ label: 'Total Debit', value: '100.00' }],
    columns: [{ label: 'Account' }, { label: 'Debit', kind: 'money' }],
    rows: [{ cells: ['Cash', '100'] }, { cells: ['Total', '100'], style: 'total' }],
    fileName: 'trial-balance',
  }, company)],
  ['voucher', () => buildPostedVoucherPrintHtml({
    voucher: {
      voucher_type: 'JV', voucher_number: 'JV-1', voucher_date: '2026-10-01', status: 'Posted',
      total_debit: 100, total_credit: 100,
      lines: [{ line_no: 1, account_code: '0101010001', account_name: 'Cash', dr_amount: 100, cr_amount: 0 }],
    },
    company,
    generalSettings: null,
    money,
  })],
  ['purchase', () => buildPurchaseInvoicePrintHtml({
    invoice: {
      purchase_number: 'PI-1', purchase_date: '2026-10-01', status: 'Posted', payment_type: 'Credit',
      supplier_code: 'S1', supplier_name: 'Supplier',
      lines: [{ line_number: 1, item_code: 'I1', item_name: 'Item', quantity: 2, purchase_price: 5, discount_amount: 0, tax_amount: 0, line_total: 10 }],
    },
    company,
    generalSettings: null,
    money: (value: number) => value.toFixed(2),
    title: 'Purchase Invoice',
  } as Parameters<typeof buildPurchaseInvoicePrintHtml>[0])],
  ['chart of accounts', () => buildChartOfAccountsPrintHtml({
    accounts: [{
      code: '0101010001', name: 'Cash', account_type: 'Asset', is_posting: true, is_active: true, is_system: false,
      normal_balance: 'Debit', opening_balance: '0', current_balance: '10',
    }] as unknown as Parameters<typeof buildChartOfAccountsPrintHtml>[0]['accounts'],
    company,
  })],
];

describe('print templates', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--print-ink', '27 27 27');
  });

  it.each(templates)('%s template uses the print palette and no colour literals', (_name, build) => {
    const html = build();
    const css = styleBlock(html);
    expect(css).toContain(':root {');
    expect(css).toContain('--print-ink: 27 27 27;');
    expect(css).toContain('rgb(var(--print-');
    expect(html).not.toMatch(COLOUR_LITERAL);
    expect(Math.min(...fontSizes(css))).toBeGreaterThanOrEqual(10);
  });
});

describe('printPaletteCss', () => {
  it('copies the --print-* values set on the given element', () => {
    const element = document.createElement('div');
    element.style.setProperty('--print-ink', '1 2 3');
    element.style.setProperty('--print-paper', '250 250 250');
    document.body.appendChild(element);

    const css = printPaletteCss(element);

    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('--print-ink: 1 2 3;');
    expect(css).toContain('--print-paper: 250 250 250;');
    element.remove();
  });

  it('returns an empty block when there is no source element', () => {
    expect(printPaletteCss(null)).toBe(':root {  }');
  });
});
