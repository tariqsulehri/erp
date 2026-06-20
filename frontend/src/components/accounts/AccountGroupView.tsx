'use client';

/**
 * AccountGroupView
 *
 * Renders accounts grouped by their top-level category (X000 codes).
 * Each category is a collapsible panel showing KPI stats for that group,
 * and a sub-table listing accounts within it.
 *
 * Uses the flat accounts list already fetched by the parent page so no
 * additional API call is needed.
 */

import { useState } from 'react';
import type { Account } from '@/modules/accounts/account.entity';
import { getAccountLevel } from '@/modules/accounts/account-code';

interface AccountGroupViewProps {
  accounts: Account[];
}

/** Category metadata keyed by MM00000000 code */
const CATEGORY_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  '0100000000': { label: 'Assets',      color: '#2563eb', bg: '#eff6ff', icon: '🏦' },
  '0200000000': { label: 'Liabilities', color: '#dc2626', bg: '#fef2f2', icon: '📋' },
  '0300000000': { label: 'Equity',      color: '#7c3aed', bg: '#f5f3ff', icon: '📊' },
  '0400000000': { label: 'Revenue',     color: '#16a34a', bg: '#f0fdf4', icon: '💰' },
  '0500000000': { label: 'Expenses',    color: '#d97706', bg: '#fffbeb', icon: '💸' },
};

/** Returns the MM00000000 category code for any 10-digit account code */
function categoryOf(code: string): string {
  return `${code.slice(0, 2)}00000000`;
}

/** Returns the hierarchy level */
function levelOf(code: string): number {
  return getAccountLevel(code);
}

/** Indent per level for group rows */
const LEVEL_INDENT: Record<number, number> = { 1: 0, 2: 12, 3: 24, 4: 36 };

interface GroupPanelProps {
  catCode: string;
  accounts: Account[];
}

/** Collapsible panel for one top-level category */
function GroupPanel({ catCode, accounts }: GroupPanelProps) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[catCode] ?? { label: catCode, color: '#64748b', bg: '#f1f5f9', icon: '📁' };

  const posting   = accounts.filter(a => a.is_posting);
  const active    = accounts.filter(a => a.is_active);

  // Sort by code ascending
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div style={{
      border: `1px solid ${meta.color}30`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Panel header — click to toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px', cursor: 'pointer',
          background: meta.bg, borderBottom: open ? `1px solid ${meta.color}20` : 'none',
          userSelect: 'none',
        }}
      >
        {/* Icon + title */}
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem',
              color: meta.color, background: `${meta.color}15`,
              padding: '2px 8px', borderRadius: 4,
            }}>{catCode}</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* KPI pills */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Pill label="Total"   value={accounts.length}  color={meta.color} />
          <Pill label="Posting" value={posting.length}   color="#0891b2"   />
          <Pill label="Active"  value={active.length}    color="#16a34a"   />
        </div>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Account rows */}
      {open && (
        <div>
          {/* Sub-header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '130px 1fr 90px 80px 70px',
            padding: '6px 20px', gap: 8,
            background: '#f8fafc', borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)', fontWeight: 600,
            color: 'var(--color-text-muted)', letterSpacing: 0,
          }}>
            <span>Code</span>
            <span>Name</span>
            <span style={{ textAlign: 'center' }}>Type</span>
            <span style={{ textAlign: 'center' }}>Balance</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>

          {sorted.map((acct, i) => {
            const level = levelOf(acct.code);
            const indent = LEVEL_INDENT[level] ?? 0;
            const isLast = i === sorted.length - 1;

            return (
              <div
                key={acct.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 90px 80px 70px',
                  gap: 8,
                  padding: '8px 20px',
                  paddingLeft: 20 + indent,
                  borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  background: level === 1
                    ? `${meta.color}08`
                    : level === 2
                      ? `${meta.color}04`
                      : 'var(--color-surface)',
                  alignItems: 'center',
                }}
              >
                {/* Code */}
                <span style={{
                  fontFamily: 'monospace', fontWeight: level <= 2 ? 700 : 500,
                  fontSize: '0.8125rem', color: meta.color,
                }}>
                  {acct.code}
                </span>

                {/* Name */}
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: level <= 2 ? 600 : 400,
                  color: acct.is_active ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}>
                  {acct.name}
                  {acct.is_system && (
                    <span style={{
                      marginLeft: 6, fontSize: '0.625rem', fontWeight: 700,
                      color: '#92400e', background: '#fef3c7',
                      padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle',
                    }}>SYS</span>
                  )}
                </span>

                {/* Type */}
                <span style={{ textAlign: 'center' }}>
                  {acct.is_posting ? (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600,
                      color: '#0891b2', background: '#ecfeff',
                      padding: '2px 7px', borderRadius: 10, border: '1px solid #a5f3fc',
                    }}>Posting</span>
                  ) : (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600,
                      color: 'var(--color-text-muted)', background: '#f1f5f9',
                      padding: '2px 7px', borderRadius: 10,
                    }}>Header</span>
                  )}
                </span>

                {/* Normal balance */}
                <span style={{
                  textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600,
                  color: acct.normal_balance === 'Debit' ? '#2563eb' : '#dc2626',
                }}>
                  {acct.normal_balance}
                </span>

                {/* Active status */}
                <span style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: acct.is_active ? '#16a34a' : '#d1d5db',
                  }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small KPI pill used in the panel header */
function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 12px', background: 'white', borderRadius: 8,
      border: `1px solid ${color}30`, minWidth: 54,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', letterSpacing: 0 }}>{label}</span>
    </div>
  );
}

/** Group view root — builds category buckets from flat account list */
export function AccountGroupView({ accounts }: AccountGroupViewProps) {
  if (accounts.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}>
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>No accounts yet</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>Import a template or create accounts manually.</p>
      </div>
    );
  }

  // Bucket accounts by category (X000)
  const buckets = new Map<string, Account[]>();
  for (const acct of accounts) {
    const cat = categoryOf(acct.code);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(acct);
  }

  // Render in numeric order
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ padding: 16 }}>
      {sorted.map(([catCode, accts]) => (
        <GroupPanel key={catCode} catCode={catCode} accounts={accts} />
      ))}
    </div>
  );
}
