'use client';

/**
 * New Account page — guided wizard.
 *
 * Walks the user through:
 *   Step 1  Select Category  (X000)
 *   Step 2  Select Group     (XX00)
 *   Step 3  Select Sub-Group (XXX0)
 *   Step 4  Enter details — code auto-assigned, posts to accounts.create
 *
 * On success, shows a confirmation banner and offers to create another
 * account or navigate to the Chart of Accounts list.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AccountWizard } from '@/components/accounts/AccountWizard';
import type { Account } from '@/modules/accounts/account.entity';

export default function NewAccountPage() {
  const router = useRouter();
  const [created, setCreated] = useState<Account | null>(null);

  if (created) {
    return (
      <>
        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link
                href="/accounts"
                style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Chart of Accounts
              </Link>
            </div>
            <h1 className="page-title">Account Created</h1>
          </div>
        </div>

        {/* ── Success banner ───────────────────────────────────────── */}
        <div style={{
          padding: '24px', borderRadius: 'var(--radius)',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#16a34a', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>✓</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: '#15803d' }}>
                Account created successfully
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: '#16a34a', marginTop: 2 }}>
                <span style={{
                  fontFamily: 'monospace', fontWeight: 700,
                  background: '#dcfce7', padding: '1px 6px', borderRadius: 4,
                }}>{created.code}</span>
                {' — '}{created.name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={() => setCreated(null)}
            >
              Create Another Account
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/accounts')}
            >
              Go to Chart of Accounts
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link
              href="/accounts"
              style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Chart of Accounts
            </Link>
          </div>
          <h1 className="page-title">New Account</h1>
          <p className="page-subtitle">Follow the steps to place the account in the correct hierarchy</p>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

        {/* ── Wizard card ──────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Create Account</h2>
          </div>
          <div className="card-body" style={{ padding: '24px' }}>
            <AccountWizard onSuccess={setCreated} />
          </div>
        </div>

        {/* ── Reference sidebar ────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 'var(--font-size-sm)' }}>Code Structure</h3>
            </div>
            <div className="card-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { pos: 'X000', label: 'Category',        example: '1000 = Assets',             color: '#dbeafe' },
                  { pos: 'XX00', label: 'Group',           example: '1100 = Current Assets',     color: '#e0e7ff' },
                  { pos: 'XXX0', label: 'Sub-Group',       example: '1110 = Cash & Equivalents', color: '#f3e8ff' },
                  { pos: 'XXXX', label: 'Posting Account', example: '1111 = Cash in Hand',       color: '#dcfce7' },
                ].map((row) => (
                  <div key={row.pos} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      padding: '2px 8px', background: row.color,
                      borderRadius: 'var(--radius-sm)', fontFamily: 'monospace',
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      minWidth: 40, textAlign: 'center',
                    }}>{row.pos}</span>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{row.label}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{row.example}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 'var(--font-size-sm)' }}>How it works</h3>
            </div>
            <div className="card-body" style={{ padding: '16px' }}>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Select the Category (1000–5000)',
                  'Select or create a Group within the category',
                  'Select or create a Sub-Group within the group',
                  'Name your account — the code is assigned automatically',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
