import Link from 'next/link';

export const metadata = { title: 'Inventory — ERP Finance' };

const CARDS = [
  {
    href:  '/inventory/products',
    icon:  (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    label:    'Products',
    desc:     'Manage your product catalog — SKUs, pricing, stock levels, dimensions and more.',
    color:    '#1d4ed8',
    bgColor:  'rgba(29,78,216,0.08)',
    badge:    'CRUD',
  },
  {
    href:  '/inventory/categories',
    icon:  (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
    label:    'Categories',
    desc:     'Organise products into hierarchical categories with custom codes and sort order.',
    color:    '#0891b2',
    bgColor:  'rgba(8,145,178,0.08)',
    badge:    'HIER',
  },
  {
    href:  '/inventory/uom',
    icon:  (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    label:    'Units of Measure',
    desc:     'Define quantity, weight, volume, length and other measurement units for products.',
    color:    '#15803d',
    bgColor:  'rgba(21,128,61,0.08)',
    badge:    'UOM',
  },
];

export default function InventoryIndexPage() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: '1.35rem', fontWeight: 700,
          color: 'var(--color-text)', margin: 0, lineHeight: 1.2,
        }}>
          Inventory Management
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Phase 2 · Product catalog, categories, units of measure and stock tracking
        </p>
      </div>

      {/* Module cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '20px 22px',
              background: 'var(--color-surface)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = card.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${card.color}22`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {/* Icon + badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                  width: 52, height: 52,
                  borderRadius: 10,
                  background: card.bgColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: card.color,
                  flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 800, fontFamily: 'monospace',
                  color: card.color, background: card.bgColor,
                  padding: '3px 7px', borderRadius: 4,
                  letterSpacing: '0.03em',
                }}>
                  {card.badge}
                </span>
              </div>

              <h2 style={{
                fontSize: '1rem', fontWeight: 700,
                color: 'var(--color-text)', margin: '0 0 6px',
              }}>
                {card.label}
              </h2>
              <p style={{
                margin: 0, fontSize: '0.82rem',
                color: 'var(--color-text-muted)', lineHeight: 1.5,
              }}>
                {card.desc}
              </p>

              <div style={{
                marginTop: 16, display: 'flex', alignItems: 'center',
                color: card.color, fontSize: '0.82rem', fontWeight: 600, gap: 4,
              }}>
                Open
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
