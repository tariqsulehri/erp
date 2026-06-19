'use client';

import Link from 'next/link';
import { VOUCHER_META, TypeIcon } from '@/components/vouchers/VoucherEntryPage';

const SECTIONS = [
  {
    title: 'Cash & Bank Vouchers',
    desc:  'Day-to-day cash and bank movements',
    cards: [
      { type: 'BRV', href: '/vouchers/bank-receipt' },
      { type: 'BPV', href: '/vouchers/bank-payment' },
      { type: 'CRV', href: '/vouchers/cash-receipt' },
      { type: 'CPV', href: '/vouchers/cash-payment' },
    ],
  },
  {
    title: 'Journal & Adjustments',
    desc:  'General ledger and adjusting entries',
    cards: [
      { type: 'JV', href: '/vouchers/journal' },
    ],
  },
] as const;

export default function VouchersIndexPage() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 920 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 10px rgba(29,78,216,0.35)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 3H19a1 1 0 011 1v16a1 1 0 01-1 1H6.5A2.5 2.5 0 014 18.5v-13A2.5 2.5 0 016.5 3z" />
            <path d="M8 8h9M8 12h9M8 16h5" />
          </svg>
        </div>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-heading)', margin: 0, letterSpacing: '-0.02em' }}>
            Voucher Entry
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
            Select a voucher type to record a new transaction or review existing entries.
          </p>
        </div>
      </div>

      {/* ── Sections ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <h2 style={{
                fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-secondary)',
                letterSpacing: 0, margin: 0,
              }}>
                {section.title}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>— {section.desc}</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}>
              {section.cards.map(({ type, href }) => {
                const meta = VOUCHER_META[type];
                return (
                  <Link key={type} href={href} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: 'var(--radius-md)',
                        border: '1.5px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        boxShadow: 'var(--shadow-xs)',
                        cursor: 'pointer',
                        transition: 'transform var(--transition), box-shadow var(--transition), border-color var(--transition), background var(--transition)',
                        display: 'flex', flexDirection: 'column', gap: 12,
                        position: 'relative', overflow: 'hidden',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.borderColor = meta.color;
                        el.style.boxShadow   = `0 8px 20px ${meta.color}22, 0 0 0 1px ${meta.color}30`;
                        el.style.background  = `${meta.color}08`;
                        el.style.transform   = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.borderColor = 'var(--color-border)';
                        el.style.boxShadow   = 'var(--shadow-xs)';
                        el.style.background  = 'var(--color-surface)';
                        el.style.transform   = 'translateY(0)';
                      }}
                    >
                      {/* Top accent stripe */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: meta.color }} />

                      {/* Icon + code badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: `${meta.color}16`, color: meta.color,
                          border: `1px solid ${meta.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <TypeIcon type={type} size={18} />
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.75rem',
                          color: meta.color, background: `${meta.color}14`,
                          padding: '3px 9px', borderRadius: 5,
                          border: `1px solid ${meta.color}30`,
                        }}>
                          {type}
                        </span>
                      </div>

                      {/* Label & desc */}
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', margin: '0 0 4px' }}>
                          {meta.label}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.45 }}>
                          {meta.desc}
                        </p>
                      </div>

                      {/* Footer: action hint */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)', marginTop: 2,
                      }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color }}>
                          New / List entries
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
