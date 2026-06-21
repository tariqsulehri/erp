'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react';
import { formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { compactButtonStyle } from '@/components/purchases/PurchaseVoucherStyles';
import { printPostedVoucherDocument } from './VoucherPrintHtml';

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

export function PostedVoucherPrintPreview({
  voucher,
  company,
  generalSettings,
  money,
  onBack,
  onError,
}: {
  voucher: any;
  company: any;
  generalSettings: any;
  money: (value: string | number) => string;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [printError, setPrintError] = useState('');
  const lines = voucher.lines ?? [];
  const title = voucherTypeLabel(voucher.voucher_type);

  function printVoucher() {
    try {
      setPrintError('');
      printPostedVoucherDocument({ voucher, company, generalSettings, money });
    } catch (error) {
      const message = friendlyErrorMessage(error, 'Unable to print Posted Voucher.');
      setPrintError(message);
      onError(message);
    }
  }

  return (
    <main style={{ ...screenStyle, gridTemplateRows: printError ? 'auto auto 1fr' : 'auto 1fr' }}>
      <section style={toolbarStyle}>
        <div>
          <strong style={{ color: 'var(--color-heading)', fontSize: '0.95rem' }}>Print Preview</strong>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>{voucher.voucher_number} | {title}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn-secondary" onClick={onBack} style={compactButtonStyle}>
            <IconArrowLeft size={15} /> Back To List
          </button>
          <button type="button" className="btn-primary" onClick={printVoucher} style={compactButtonStyle}>
            <IconPrinter size={15} /> Print
          </button>
        </div>
      </section>

      {printError && (
        <div style={errorStyle}>{printError}</div>
      )}

      <section style={paperWrapStyle}>
        <article style={paperStyle}>
          <header style={printHeaderStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>{company?.name ?? 'Company Name'}</h2>
              <div style={mutedStyle}>{[company?.address, company?.city, company?.country].filter(Boolean).join(', ') || 'Company Address'}</div>
              <div style={mutedStyle}>{[company?.phone, company?.email].filter(Boolean).join(' | ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, color: '#0f172a' }}>{title}</h1>
              <span style={statusStyle}>{voucher.status}</span>
            </div>
          </header>

          <div style={infoGridStyle}>
            {[
              ['Voucher Number', voucher.voucher_number],
              ['Voucher Date', formatDate(voucher.voucher_date, generalSettings)],
              ['Voucher Type', title],
              ['Posted At', voucher.posted_at ? formatDate(voucher.posted_at, generalSettings) : '-'],
              ['Reference', voucher.reference || '-'],
              ['Approval Status', voucher.approval_status || '-'],
              ['Total Debit', money(voucher.total_debit)],
              ['Total Credit', money(voucher.total_credit)],
            ].map(([label, value]) => (
              <div key={label} style={infoBoxStyle}>
                <div style={labelStyle}>{label}</div>
                <div style={{ ...valueStyle, textAlign: label.includes('Total') ? 'right' : 'left' }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={boxStyle}>
            <div style={boxTitleStyle}>Description</div>
            <div>{voucher.narration || '-'}</div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                {['No.', 'Account', 'Debit', 'Credit'].map((label, index) => (
                  <th key={label} style={thStyle(index >= 2)}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={4} style={tdStyle(false, true)}>No voucher lines found.</td>
                </tr>
              )}
              {lines.map((line: any) => (
                <tr key={line.id}>
                  <td style={tdStyle(false, true)}>{line.line_no}</td>
                  <td style={tdStyle()}>
                    <strong>{line.account_code} - {line.account_name}</strong>
                    {line.narration && <div style={mutedStyle}>{line.narration}</div>}
                  </td>
                  <td style={tdStyle(true)}>{Number(line.dr_amount) > 0 ? money(line.dr_amount) : '-'}</td>
                  <td style={tdStyle(true)}>{Number(line.cr_amount) > 0 ? money(line.cr_amount) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={footerGridStyle}>
            <div style={boxStyle}>
              <div style={boxTitleStyle}>Notes</div>
              <div>This is a system generated accounting voucher.</div>
            </div>
            <div style={totalsStyle}>
              <div style={totalRowStyle}><span>Total Debit</span><span>{money(voucher.total_debit)}</span></div>
              <div style={{ ...totalRowStyle, borderBottom: 0, background: '#f8fafc', fontWeight: 800 }}><span>Total Credit</span><span>{money(voucher.total_credit)}</span></div>
            </div>
          </div>

          <div style={signatureGridStyle}>
            <div style={signatureStyle}>Prepared By</div>
            <div style={signatureStyle}>Checked By</div>
            <div style={signatureStyle}>Approved By</div>
          </div>
        </article>
      </section>
    </main>
  );
}

const screenStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  display: 'grid',
  gap: 8,
  overflow: 'hidden',
};

const errorStyle: CSSProperties = {
  color: 'var(--color-danger-text)',
  fontSize: '0.74rem',
  fontWeight: 700,
};

const toolbarStyle: CSSProperties = {
  minHeight: 52,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
};

const paperWrapStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  justifyContent: 'center',
  padding: 16,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
};

const paperStyle: CSSProperties = {
  width: 794,
  minHeight: 1123,
  background: '#fff',
  color: '#0f172a',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.14)',
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

const mutedStyle: CSSProperties = { color: '#475569', fontSize: 10 };

const statusStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 9px',
  border: '1px solid #15803d',
  color: '#14532d',
  background: '#f0fdf4',
  fontWeight: 700,
  borderRadius: 3,
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  marginTop: 14,
};

const infoBoxStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '7px 8px',
  minHeight: 44,
};

const labelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 9,
  fontWeight: 700,
  marginBottom: 3,
};

const valueStyle: CSSProperties = {
  fontWeight: 700,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
  fontVariantNumeric: 'tabular-nums',
};

const boxStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: 10,
  minHeight: 76,
  marginTop: 12,
};

const boxTitleStyle: CSSProperties = {
  marginBottom: 6,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0,
  color: '#334155',
  fontWeight: 700,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 14,
};

function thStyle(right = false): CSSProperties {
  return {
    background: '#102033',
    color: '#fff',
    textAlign: right ? 'right' : 'left',
    padding: '7px 6px',
    border: '1px solid #102033',
    fontSize: 10,
  };
}

function tdStyle(right = false, center = false): CSSProperties {
  return {
    padding: 6,
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    textAlign: center ? 'center' : right ? 'right' : 'left',
    fontVariantNumeric: right ? 'tabular-nums' : undefined,
    whiteSpace: right ? 'nowrap' : undefined,
  };
}

const footerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 260px',
  gap: 18,
  marginTop: 12,
  alignItems: 'start',
};

const totalsStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
};

const totalRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '7px 9px',
  borderBottom: '1px solid #e2e8f0',
};

const signatureGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 24,
  marginTop: 42,
};

const signatureStyle: CSSProperties = {
  borderTop: '1px solid #334155',
  paddingTop: 6,
  textAlign: 'center',
  color: '#334155',
  fontWeight: 700,
};
