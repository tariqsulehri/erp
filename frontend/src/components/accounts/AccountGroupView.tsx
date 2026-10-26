'use client';

/**
 * AccountGroupView
 *
 * Renders accounts grouped by their top-level category (MM00000000 codes).
 * Each category is a collapsible section with its counts in the header line
 * and a table listing the accounts within it.
 *
 * Uses the flat accounts list already fetched by the parent page so no
 * additional API call is needed.
 */

import { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { AccountListItem } from '@/lib/api/accounts';
import { getAccountLevel } from '@/modules/accounts/account-code';
import { ACCOUNT_CATEGORY_META_BY_CODE } from '@/lib/ui/account-category-colors';
import { Badge } from '@/components/ui/Badge';

interface AccountGroupViewProps {
  accounts: AccountListItem[];
}

/** Category metadata keyed by MM00000000 code */
const CATEGORY_META = ACCOUNT_CATEGORY_META_BY_CODE;

/** Returns the MM00000000 category code for any 10-digit account code */
function categoryOf(code: string): string {
  return `${code.slice(0, 2)}00000000`;
}

/** Returns the hierarchy level */
function levelOf(code: string): number {
  return getAccountLevel(code);
}

/** Indent per level for the account name, in px */
const LEVEL_INDENT: Record<number, number> = { 1: 0, 2: 16, 3: 32, 4: 48 };

interface GroupPanelProps {
  catCode: string;
  accounts: AccountListItem[];
}

/** Collapsible section for one top-level category */
function GroupPanel({ catCode, accounts }: GroupPanelProps) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[catCode] ?? { label: catCode, badge: 'neutral' as const };

  const posting = accounts.filter(a => a.is_posting);
  const active  = accounts.filter(a => a.is_active);

  // Sort by code ascending
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  const bodyId = `account-group-${catCode}`;

  return (
    <section className="panel" style={{ flexShrink: 0 }}>
      <div className="panel-header" style={{ borderBottom: open ? undefined : 'none' }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          style={{ gap: 8, paddingLeft: 6, color: 'var(--color-heading)' }}
        >
          {open ? <IconChevronDown size={16} stroke={1.8} aria-hidden /> : <IconChevronRight size={16} stroke={1.8} aria-hidden />}
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{catCode}</span>
          <span className="panel-title">{meta.label}</span>
        </button>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'} · {posting.length} Posting · {active.length} Active
        </span>
      </div>

      {open && (
        <div id={bodyId} style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Account Code</th>
                <th>Account Name</th>
                <th style={{ width: 110 }}>Account Kind</th>
                <th style={{ width: 130 }}>Normal Balance</th>
                <th style={{ width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(acct => {
                const level = levelOf(acct.code);
                return (
                  <tr key={acct.id}>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: level <= 2 ? 500 : 400, color: 'var(--color-heading)' }}>
                      {acct.code}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        paddingLeft: LEVEL_INDENT[level] ?? 0,
                        fontWeight: level <= 2 ? 600 : 400,
                        color: acct.is_active ? 'var(--color-heading)' : 'var(--color-text-muted)',
                      }}>
                        {acct.name}
                        {acct.is_system && <Badge variant="info" title="System Account. It cannot be deactivated.">System</Badge>}
                      </span>
                    </td>
                    <td className="cell-muted">{acct.is_posting ? 'Posting' : 'Header'}</td>
                    <td className="cell-muted">{acct.normal_balance}</td>
                    <td>
                      <Badge variant={acct.is_active ? 'success' : 'neutral'}>{acct.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Group view root — builds category buckets from flat account list */
export function AccountGroupView({ accounts }: AccountGroupViewProps) {
  if (accounts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-title">No Accounts Yet</div>
        <div className="empty-desc">Import a template or create accounts with New Account. If filters are set, clear them to see more.</div>
      </div>
    );
  }

  // Bucket accounts by category (MM00000000)
  const buckets = new Map<string, AccountListItem[]>();
  for (const acct of accounts) {
    const cat = categoryOf(acct.code);
    const bucket = buckets.get(cat) ?? [];
    bucket.push(acct);
    buckets.set(cat, bucket);
  }

  // Render in numeric order
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map(([catCode, accts]) => (
        <GroupPanel key={catCode} catCode={catCode} accounts={accts} />
      ))}
    </div>
  );
}
