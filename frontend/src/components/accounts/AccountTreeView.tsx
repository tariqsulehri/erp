'use client';

/**
 * AccountTreeView
 *
 * Professional Chart of Accounts hierarchy view.
 * Shows Main Category -> Group -> Sub-Group -> Posting Account with
 * compact analysis totals and clear branch indentation.
 */

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconListTree,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useAccountsHierarchy, type AccountTreeNode } from '@/lib/api/accounts';
import { getAccountLevel, getAccountLevelLabel } from '@/modules/accounts/account-code';

type TreeNode = AccountTreeNode;

type PostingFilter = 'all' | 'posting' | 'header';

interface AccountTreeViewProps {
  typeFilter?: string;
  postingFilter?: PostingFilter;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  Asset: { label: 'Assets', color: '#2563eb', bg: '#eff6ff' },
  Liability: { label: 'Liabilities', color: '#dc2626', bg: '#fef2f2' },
  Equity: { label: 'Equity', color: '#7c3aed', bg: '#f5f3ff' },
  Revenue: { label: 'Revenue', color: '#16a34a', bg: '#f0fdf4' },
  Expense: { label: 'Expenses', color: '#d97706', bg: '#fffbeb' },
};

const LEVEL_META: Record<number, { label: string; codeWidth: number; rowBg: string; weight: number }> = {
  1: { label: 'Main Category', codeWidth: 78, rowBg: 'var(--color-surface-alt)', weight: 800 },
  2: { label: 'Group', codeWidth: 92, rowBg: '#f8fafc', weight: 700 },
  3: { label: 'Sub-Group', codeWidth: 112, rowBg: 'var(--color-surface)', weight: 650 },
  4: { label: 'Posting Account', codeWidth: 132, rowBg: 'var(--color-surface)', weight: 550 },
};

function displayCode(code: string): string {
  const level = getAccountLevel(code);
  if (level === 1) return code.slice(0, 2);
  if (level === 2) return code.slice(0, 4);
  if (level === 3) return code.slice(0, 6);
  return code;
}

function spacedCode(code: string): string {
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)} ${code.slice(6, 10)}`;
}

function flattenNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap(node => [node, ...flattenNodes(node.children)]);
}

function countPosting(nodes: TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.isPosting ? 1 : 0) + countPosting(node.children), 0);
}

function countHeaders(nodes: TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.isPosting ? 0 : 1) + countHeaders(node.children), 0);
}

function nodeMatchesSearch(node: TreeNode, search: string): boolean {
  if (!search) return true;
  const clean = search.toLowerCase().replace(/\s+/g, '');
  return (
    node.code.includes(clean) ||
    spacedCode(node.code).replace(/\s+/g, '').includes(clean) ||
    node.name.toLowerCase().includes(search.toLowerCase())
  );
}

function filterTree(
  nodes: TreeNode[],
  search: string,
  typeFilter: string,
  postingFilter: PostingFilter,
): TreeNode[] {
  return nodes.flatMap(node => {
    const filteredChildren = filterTree(node.children, search, typeFilter, postingFilter);
    const typeMatches = !typeFilter || node.accountType === typeFilter;
    const postingMatches =
      postingFilter === 'all' ||
      (postingFilter === 'posting' && node.isPosting) ||
      (postingFilter === 'header' && !node.isPosting);
    const selfMatches = typeMatches && postingMatches && nodeMatchesSearch(node, search);

    if (selfMatches || filteredChildren.length > 0) {
      return [{ ...node, children: filteredChildren }];
    }

    return [];
  });
}

function collectOpenCodes(nodes: TreeNode[]): string[] {
  return nodes.flatMap(node => [
    node.code,
    ...collectOpenCodes(node.children),
  ]);
}

function AccountSummary({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      display: 'grid',
      gap: 2,
      padding: '10px 12px',
      border: '1px solid var(--color-border-subtle)',
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-sm)',
      minWidth: 118,
    }}>
      <span style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
        fontWeight: 650,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '1.15rem',
        color: 'var(--color-heading)',
        fontWeight: 800,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  openCodes: Set<string>;
  setOpenCodes: Dispatch<SetStateAction<Set<string>>>;
}

function TreeRow({ node, depth, openCodes, setOpenCodes }: TreeRowProps) {
  const level = getAccountLevel(node.code);
  const meta = LEVEL_META[level] ?? LEVEL_META[4];
  const type = TYPE_META[node.accountType] ?? { label: node.accountType, color: '#64748b', bg: '#f1f5f9' };
  const hasChildren = node.children.length > 0;
  const isOpen = openCodes.has(node.code);

  const toggle = () => {
    if (!hasChildren) return;
    setOpenCodes(prev => {
      const next = new Set(prev);
      if (next.has(node.code)) next.delete(node.code);
      else next.add(node.code);
      return next;
    });
  };

  return (
    <div>
      <div
        onClick={toggle}
        style={{
          display: 'grid',
          gridTemplateColumns: `${Math.max(38, depth * 26 + 38)}px 150px 1fr 128px 104px 92px`,
          minHeight: 44,
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: meta.rowBg,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
      >
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          position: 'relative',
        }}>
          {Array.from({ length: depth }).map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 24 + index * 26,
                top: 0,
                bottom: 0,
                borderLeft: '1px solid var(--color-border-subtle)',
              }}
            />
          ))}
          {depth > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 24 + (depth - 1) * 26,
                width: 18,
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            />
          )}
          <button
            type="button"
            aria-label={hasChildren ? (isOpen ? 'Collapse Account' : 'Expand Account') : 'No Child Accounts'}
            onClick={event => {
              event.stopPropagation();
              toggle();
            }}
            style={{
              marginLeft: depth * 26,
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--button-radius)',
              background: hasChildren ? 'var(--color-surface)' : 'transparent',
              color: hasChildren ? 'var(--color-text-muted)' : 'transparent',
              cursor: hasChildren ? 'pointer' : 'default',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {hasChildren ? (
              isOpen ? <IconChevronDown size={15} stroke={2.2} /> : <IconChevronRight size={15} stroke={2.2} />
            ) : (
              <span />
            )}
          </button>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}>
          {hasChildren ? (
            isOpen ? <IconFolderOpen size={18} color={type.color} stroke={2} /> : <IconFolder size={18} color={type.color} stroke={2} />
          ) : (
            <span style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${type.color}`, background: type.bg }} />
          )}
          <span style={{
            width: meta.codeWidth,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: type.color,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {displayCode(node.code)}
          </span>
        </div>

        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <div style={{
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: meta.weight,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name}
          </div>
          {level === 4 && (
            <div style={{
              color: 'var(--color-text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.68rem',
              marginTop: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {spacedCode(node.code)}
            </div>
          )}
        </div>

        <span style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 650,
        }}>
          {getAccountLevelLabel(node.code)}
        </span>

        <span style={{
          justifySelf: 'start',
          color: type.color,
          background: type.bg,
          border: `1px solid ${type.color}28`,
          borderRadius: 'var(--button-radius)',
          padding: '3px 9px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
        }}>
          {type.label}
        </span>

        <span style={{
          justifySelf: 'start',
          color: node.isPosting ? 'var(--color-success-text)' : 'var(--color-text-muted)',
          background: node.isPosting ? 'var(--color-success-bg)' : 'var(--color-surface-alt)',
          border: `1px solid ${node.isPosting ? 'var(--color-success-border)' : 'var(--color-border-subtle)'}`,
          borderRadius: 'var(--button-radius)',
          padding: '3px 9px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
        }}>
          {node.isPosting ? 'Posting' : `${node.children.length} ${node.children.length === 1 ? 'Child' : 'Children'}`}
        </span>
      </div>

      {isOpen && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          openCodes={openCodes}
          setOpenCodes={setOpenCodes}
        />
      ))}
    </div>
  );
}

export function AccountTreeView({
  typeFilter = '',
  postingFilter = 'all',
}: AccountTreeViewProps) {
  const { data, isLoading, error } = useAccountsHierarchy();
  const [search, setSearch] = useState('');
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  const tree = useMemo(
    () => filterTree((data ?? []) as TreeNode[], search.trim(), typeFilter, postingFilter),
    [data, search, typeFilter, postingFilter],
  );

  const allVisible = useMemo(() => flattenNodes(tree), [tree]);
  const categoryCounts = useMemo(() => {
    return tree.map(node => ({
      code: displayCode(node.code),
      name: TYPE_META[node.accountType]?.label ?? node.name,
      color: TYPE_META[node.accountType]?.color ?? '#64748b',
      count: flattenNodes([node]).length,
    }));
  }, [tree]);

  useEffect(() => {
    const baseTree = (data ?? []) as TreeNode[];
    const nextCodes = search.trim()
      ? collectOpenCodes(tree)
      : baseTree.flatMap(node => [node.code, ...node.children.map(child => child.code)]);
    setOpenCodes(new Set(nextCodes));
  }, [data, search, tree]);

  if (isLoading) {
    return (
      <div className="loading-overlay" style={{ minHeight: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Building Account Tree...
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
        <IconListTree size={42} stroke={1.5} style={{ marginBottom: 12, opacity: 0.55 }} />
        <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>No Accounts Yet</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>Import a template or create accounts manually.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 1fr) auto',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--color-surface-alt)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ position: 'relative', width: 360, maxWidth: '100%' }}>
            <IconSearch
              size={16}
              stroke={2}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search Account Code Or Name"
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ paddingLeft: 34, paddingRight: 34, height: 36, fontSize: 'var(--font-size-sm)' }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear Search"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 22,
                  height: 22,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconX size={15} stroke={2} />
              </button>
            )}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setOpenCodes(new Set(collectOpenCodes(tree)))}>
            Expand All
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpenCodes(new Set())}>
            Collapse All
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <AccountSummary label="Visible" value={allVisible.length} />
          <AccountSummary label="Headers" value={countHeaders(tree)} />
          <AccountSummary label="Posting" value={countPosting(tree)} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 260px',
        minHeight: 420,
      }}>
        <div style={{ minWidth: 0, borderRight: '1px solid var(--color-border)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '38px 150px 1fr 128px 104px 92px',
            alignItems: 'center',
            minHeight: 38,
            paddingRight: 0,
            background: 'var(--color-table-head-bg)',
            color: 'var(--color-table-head-text)',
            borderBottom: '1px solid var(--color-table-head-bg)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 750,
          }}>
            <span />
            <span>Account Code</span>
            <span>Account Name</span>
            <span>Level</span>
            <span>Type</span>
            <span>Status</span>
          </div>

          {tree.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No Accounts Match The Selected Filters.
            </div>
          ) : (
            tree.map(node => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                openCodes={openCodes}
                setOpenCodes={setOpenCodes}
              />
            ))
          )}
        </div>

        <aside style={{
          background: 'var(--color-surface)',
          padding: 16,
        }}>
          <h3 style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 800,
            marginBottom: 10,
            color: 'var(--color-heading)',
          }}>
            Account Analysis
          </h3>

          <div style={{
            display: 'grid',
            gap: 9,
          }}>
            {categoryCounts.map(item => (
              <div
                key={item.code}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '9px 10px',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-alt)',
                }}
              >
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: item.color,
                  fontWeight: 800,
                  fontSize: '0.78rem',
                }}>
                  {item.code}
                </span>
                <span style={{
                  color: 'var(--color-text)',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-xs)',
                }}>
                  {item.name}
                </span>
                <span style={{
                  justifySelf: 'end',
                  minWidth: 28,
                  textAlign: 'right',
                  color: 'var(--color-heading)',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 16,
            padding: 12,
            border: '1px solid var(--color-info-border)',
            background: 'var(--color-info-bg)',
            color: 'var(--color-info-text)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            lineHeight: 1.55,
          }}>
            <strong>Account Code Format</strong>
            <div style={{ marginTop: 5 }}>
              01 = Main Category<br />
              0101 = Group<br />
              010110 = Sub-Group<br />
              0101100001 = Posting Account
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
