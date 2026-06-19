'use client';

/**
 * AccountTreeView
 *
 * Renders the Chart of Accounts as a collapsible tree.
 * Features:
 *  - Colour-coded by account type
 *  - Auto-expands categories and groups on load
 *  - Global Expand All / Collapse All buttons
 *  - Inline search to filter by code or name (keeps parent context visible)
 *  - Child count badge on each parent node
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';

interface TreeNode {
  id:          string;
  code:        string;
  name:        string;
  accountType: string;
  isPosting:   boolean;
  children:    TreeNode[];
}

const TYPE_ACCENT: Record<string, string> = {
  Asset: '#2563eb', Liability: '#dc2626', Equity: '#7c3aed',
  Revenue: '#16a34a', Expense: '#d97706',
};

const TYPE_LABEL: Record<string, string> = {
  Asset: 'Asset', Liability: 'Liability', Equity: 'Equity',
  Revenue: 'Revenue', Expense: 'Expense',
};

function codeLevel(code: string): number {
  const n = parseInt(code, 10);
  if (n % 1000 === 0) return 1;
  if (n % 100  === 0) return 2;
  if (n % 10   === 0) return 3;
  return 4;
}

const LEVEL_STYLE: Record<number, { indent: number; fontWeight: number; fontSize: string }> = {
  1: { indent: 0,  fontWeight: 700, fontSize: '0.9375rem' },
  2: { indent: 20, fontWeight: 600, fontSize: '0.875rem'  },
  3: { indent: 40, fontWeight: 500, fontSize: '0.8125rem' },
  4: { indent: 60, fontWeight: 400, fontSize: '0.8125rem' },
};

/** Count all descendants (not just direct children) */
function totalDescendants(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return node.children.reduce((sum, c) => sum + 1 + totalDescendants(c), 0);
}

/** Check if node or any descendant matches search */
function nodeMatches(node: TreeNode, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (node.code.includes(q) || node.name.toLowerCase().includes(lower)) return true;
  return node.children.some(c => nodeMatches(c, q));
}

/* ── Single tree row ──────────────────────────────────────────────────── */
interface TreeNodeRowProps {
  node:        TreeNode;
  depth:       number;
  accentColor: string;
  expandAll:   number; // positive = expand, negative = collapse, 0 = initial
  search:      string;
}

function TreeNodeRow({ node, depth, accentColor, expandAll, search }: TreeNodeRowProps) {
  const level      = codeLevel(node.code);
  const style      = LEVEL_STYLE[level] ?? LEVEL_STYLE[4];
  const hasChildren = node.children.length > 0;

  const [open, setOpen] = useState(level <= 2);

  /* Respond to global expand/collapse */
  useEffect(() => {
    if (expandAll > 0) setOpen(true);
    if (expandAll < 0) setOpen(false);
  }, [expandAll]);

  /* Auto-expand if search matches a descendant */
  useEffect(() => {
    if (search && node.children.some(c => nodeMatches(c, search))) {
      setOpen(true);
    }
  }, [search]);

  /* Hide entire subtree if nothing matches search */
  if (search && !nodeMatches(node, search)) return null;

  const matched = search && (
    node.code.includes(search) || node.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div
        onClick={() => hasChildren && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 16px', paddingLeft: 16 + style.indent,
          borderBottom: '1px solid var(--color-border)',
          cursor: hasChildren ? 'pointer' : 'default',
          background: matched
            ? '#fefce8'
            : level === 1
              ? 'var(--color-bg)'
              : level === 2
                ? '#f8fafc'
                : 'var(--color-surface)',
          borderLeft: level === 1 ? `3px solid ${accentColor}` : '3px solid transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!matched) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = matched
            ? '#fefce8'
            : level === 1 ? 'var(--color-bg)' : level === 2 ? '#f8fafc' : 'var(--color-surface)';
        }}
      >
        {/* Chevron */}
        <span style={{ width: 16, flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 10 }}>
          {hasChildren ? (open ? '▼' : '▶') : ''}
        </span>

        {/* Code badge */}
        <span style={{
          fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
          color: accentColor, background: `${accentColor}15`,
          padding: '1px 6px', borderRadius: 4, flexShrink: 0,
          minWidth: 48, textAlign: 'center',
        }}>
          {node.code}
        </span>

        {/* Name */}
        <span style={{
          flex: 1, fontWeight: style.fontWeight, fontSize: style.fontSize,
          color: 'var(--color-text)',
        }}>
          {node.name}
        </span>

        {/* Right badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {level === 1 && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600,
              color: accentColor, background: `${accentColor}15`,
              padding: '2px 8px', borderRadius: 10,
            }}>
              {TYPE_LABEL[node.accountType] ?? node.accountType}
            </span>
          )}
          {node.isPosting && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600,
              color: '#0891b2', background: '#ecfeff',
              padding: '2px 8px', borderRadius: 10, border: '1px solid #a5f3fc',
            }}>
              Posting
            </span>
          )}
          {hasChildren && (
            <span style={{
              fontSize: '0.6875rem', color: 'var(--color-text-muted)',
              background: '#f1f5f9', padding: '1px 6px', borderRadius: 8,
              minWidth: 24, textAlign: 'center',
            }}>
              {totalDescendants(node)}
            </span>
          )}
        </div>
      </div>

      {open && hasChildren && node.children.map(child => (
        <TreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          accentColor={accentColor}
          expandAll={expandAll}
          search={search}
        />
      ))}
    </div>
  );
}

/* ── Root component ───────────────────────────────────────────────────── */
export function AccountTreeView() {
  const { data, isLoading, error } = trpc.accounts.getHierarchy.useQuery();

  /* expandAll: 0 = default, >0 = expand all triggered, <0 = collapse all triggered */
  const [expandAll, setExpandAll] = useState(0);
  const [search,    setSearch]    = useState('');

  if (isLoading) {
    return (
      <div className="loading-overlay" style={{ minHeight: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Building account tree…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger" style={{ margin: 16 }}>{error.message}</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ marginBottom: 12, opacity: 0.4 }}>
          <path d="M3 7h4v4H3zM10 3h4v4h-4zM17 11h4v4h-4zM5 11v4M12 7v4M19 15v4M5 15h12"/>
        </svg>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>No accounts yet</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>Import a template or create accounts manually.</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Tree toolbar ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', background: '#f8fafc',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" className="form-input"
            placeholder="Search code or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, height: 32, fontSize: 'var(--font-size-xs)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1,
              }}
            >✕</button>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandAll(v => v + 1)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="7 13 12 8 17 13"/><polyline points="7 19 12 14 17 19"/>
            </svg>
            Expand All
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandAll(v => v - 1)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="7 11 12 16 17 11"/><polyline points="7 5 12 10 17 5"/>
            </svg>
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Column headers ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 16px', background: '#f8fafc',
        borderBottom: '2px solid var(--color-border)',
        fontSize: 'var(--font-size-xs)', fontWeight: 600,
        color: 'var(--color-text-muted)', letterSpacing: 0,
      }}>
        <span style={{ width: 16 }} />
        <span style={{ minWidth: 48 }}>Code</span>
        <span style={{ flex: 1, paddingLeft: 8 }}>Account Name</span>
        <span>Type / Count</span>
      </div>

      {/* ── Root nodes ────────────────────────────────────── */}
      {(data as TreeNode[]).map(root => (
        <TreeNodeRow
          key={root.id}
          node={root}
          depth={0}
          accentColor={TYPE_ACCENT[root.accountType] ?? '#64748b'}
          expandAll={expandAll}
          search={search.trim()}
        />
      ))}

      {/* ── Summary footer ────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', background: '#f8fafc',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 20,
        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
      }}>
        <span>{data.length} top-level categories</span>
        <span>{(data as TreeNode[]).reduce((s, r) => s + 1 + totalDescendants(r), 0)} total accounts</span>
      </div>
    </div>
  );
}
