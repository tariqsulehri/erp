'use client';

import Link from 'next/link';
import { VOUCHER_META } from '@/components/vouchers/VoucherEntryPage';

const VOUCHER_CARDS = [
  { type: 'BRV', href: '/vouchers/bank-receipt' },
  { type: 'BPV', href: '/vouchers/bank-payment' },
  { type: 'CRV', href: '/vouchers/cash-receipt' },
  { type: 'CPV', href: '/vouchers/cash-payment' },
  { type: 'JV',  href: '/vouchers/journal' },
] as const;

export default function VouchersIndexPage() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 860 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-text)', margin: '0 0 6px' }}>
          Voucher Entry
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Select a voucher type to start recording transactions.
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {VOUCHER_CARDS.map(({ type, href }) => {
          const meta = VOUCHER_META[type];
          return (
            <Link
              key={type}
              href={href}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  padding: '20px 22px',
                  borderRadius: 'var(--radius)',
                  border: `1.5px solid var(--color-border)`,
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = meta.color;
                  el.style.boxShadow   = `0 0 0 3px ${meta.color}22`;
                  el.style.background  = `${meta.color}08`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = 'var(--color-border)';
                  el.style.boxShadow   = 'none';
                  el.style.background  = 'var(--color-surface)';
                }}
              >
                {/* Code badge */}
                <span style={{
                  fontFamily: 'monospace', fontWeight: 900, fontSize: '0.875rem',
                  color: meta.color, background: `${meta.color}18`,
                  padding: '3px 10px', borderRadius: 4,
                  border: `1px solid ${meta.color}30`,
                  alignSelf: 'flex-start',
                }}>
                  {type}
                </span>

                {/* Label & desc */}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', margin: '0 0 4px' }}>
                    {meta.label}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {meta.desc}
                  </p>
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', color: meta.color, opacity: 0.7 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
