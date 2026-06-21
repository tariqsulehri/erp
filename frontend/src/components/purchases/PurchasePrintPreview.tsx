'use client';

import type { CSSProperties } from 'react';
import { IconCircleX, IconDownload, IconPrinter } from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { openPurchaseInvoicePrintWindow } from './PurchasePrintHtml';
import type { PurchasePrintProps } from './PurchasePrintTypes';

interface PurchaseInvoicePrintPreviewProps extends PurchasePrintProps {
  onClose: () => void;
  onError: (message: string) => void;
}

export function PurchaseInvoicePrintPreview({
  invoice,
  company,
  generalSettings,
  money,
  onClose,
  onError,
}: PurchaseInvoicePrintPreviewProps) {
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
                <div>Location: <strong>{invoice.location_code ? `${invoice.location_code} - ${invoice.location_name}` : invoice.location_name || '-'}</strong></div>
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

const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
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
