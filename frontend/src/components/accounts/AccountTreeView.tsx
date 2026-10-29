'use client';

/**
 * AccountTreeView
 *
 * Professional Chart of Accounts hierarchy view.
 * Shows Main Category -> Group -> Sub-Group -> Posting Account with
 * sleek visual hierarchy, smooth heading styling, expanded analysis totals,
 * and clear branch indentation.
 */

import { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { IconChevronDown, IconChevronRight, IconFoldDown, IconFoldUp } from '@tabler/icons-react';
import { useAccountsHierarchy, type AccountTreeNode } from '@/lib/api/accounts';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatCount } from '@/lib/app-settings';
import { getAccountLevel, getAccountLevelLabel } from '@/modules/accounts/account-code';
import { ACCOUNT_CATEGORY_META, accountTypeBadge } from '@/lib/ui/account-category-colors';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchField } from '@/components/ui/SearchField';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

type TreeNode = AccountTreeNode;

type PostingFilter = 'all' | 'posting' | 'header';

interface AccountTreeViewProps {
  typeFilter?: string;
  postingFilter?: PostingFilter;
  depthFilter?: number;
}

const TYPE_META = ACCOUNT_CATEGORY_META;

/** Category visual tokens mapped to design system variables. */
const CATEGORY_ACCENTS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  Asset: {
    border: 'var(--color-info-border)',
    bg: 'var(--color-info-bg)',
    text: 'var(--color-info-text)',
    dot: 'var(--color-info-text)',
  },
  Liability: {
    border: 'var(--color-danger-border)',
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger-text)',
    dot: 'var(--color-danger-text)',
  },
  Equity: {
    border: 'var(--color-neutral-border)',
    bg: 'var(--color-neutral-bg)',
    text: 'var(--color-neutral-text)',
    dot: 'var(--color-neutral-text)',
  },
  Revenue: {
    border: 'var(--color-success-border)',
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success-text)',
    dot: 'var(--color-success-text)',
  },
  Expense: {
    border: 'var(--color-warning-border)',
    bg: 'var(--color-warning-bg)',
    text: 'var(--color-warning-text)',
    dot: 'var(--color-warning-text)',
  },
};

/** Name weight per hierarchy level: headers read heavier than posting accounts. */
const LEVEL_WEIGHT: Record<number, number> = { 1: 700, 2: 600, 3: 500, 4: 400 };

/** Indent per tree depth, in px. Guide lines run under the parent's expand button. */
const INDENT = 20;
const COLUMN_COUNT = 5;

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
  depthFilter: number = 4,
): TreeNode[] {
  return nodes.flatMap(node => {
    const level = getAccountLevel(node.code);
    if (level > depthFilter) return [];

    const filteredChildren = filterTree(node.children, search, typeFilter, postingFilter, depthFilter);
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

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  openCodes: Set<string>;
  setOpenCodes: Dispatch<SetStateAction<Set<string>>>;
}

function TreeRow({ node, depth, openCodes, setOpenCodes }: TreeRowProps) {
  const level = getAccountLevel(node.code);
  const hasChildren = node.children.length > 0;
  const isOpen = openCodes.has(node.code);
  const categoryStyle = CATEGORY_ACCENTS[node.accountType] ?? CATEGORY_ACCENTS.Asset;

  const isMainCategory = level === 1;
  const isGroup = level === 2;
  const isSubGroup = level === 3;
  const isPosting = level === 4;

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
    <Fragment>
      <tr
        onClick={toggle}
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isOpen : undefined}
        style={{
          cursor: hasChildren ? 'pointer' : undefined,
          backgroundColor: isMainCategory ? 'var(--color-surface-subtle)' : undefined,
          borderTop: isMainCategory ? '1px solid var(--color-border-subtle)' : undefined,
          borderBottom: isMainCategory ? '1px solid var(--color-border-subtle)' : undefined,
        }}
      >
        {/* Code with indentation, guide lines, and smooth code pill */}
        <td style={{
          position: 'relative',
          paddingLeft: 8 + depth * INDENT,
          borderLeft: isMainCategory ? `3px solid ${categoryStyle.border}` : undefined,
        }}>
          {Array.from({ length: depth }).map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 8 + index * INDENT + 14,
                top: 0,
                bottom: 0,
                borderLeft: '1px solid var(--color-border-subtle)',
              }}
            />
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                icon={isOpen ? <IconChevronDown size={16} stroke={1.8} /> : <IconChevronRight size={16} stroke={1.8} />}
                onClick={event => {
                  event.stopPropagation();
                  toggle();
                }}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
                title={isOpen ? 'Collapse' : 'Expand'}
              />
            ) : (
              <span aria-hidden="true" style={{ display: 'inline-block', width: 'var(--control-h-sm)' }} />
            )}
            {isMainCategory ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 32,
                height: 22,
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--color-heading)',
                fontVariantNumeric: 'tabular-nums',
                boxShadow: 'var(--shadow-xs)',
              }}>
                {displayCode(node.code)}
              </span>
            ) : isGroup ? (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-heading)',
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--color-surface-subtle)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {displayCode(node.code)}
              </span>
            ) : isSubGroup ? (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {displayCode(node.code)}
              </span>
            ) : (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                color: 'var(--color-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {displayCode(node.code)}
              </span>
            )}
          </span>
        </td>

        <td className={isPosting ? 'cell-stack' : undefined}>
          <span style={{
            display: 'block',
            color: 'var(--color-heading)',
            fontWeight: LEVEL_WEIGHT[level] ?? 400,
            fontSize: isMainCategory ? 'var(--font-size-md)' : undefined,
            letterSpacing: isMainCategory ? '-0.01em' : undefined,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name}
          </span>
          {isPosting && (
            <span className="cell-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
              {spacedCode(node.code)}
            </span>
          )}
        </td>

        <td className="cell-muted">
          <span style={{ fontWeight: isMainCategory ? 600 : isGroup ? 500 : 400, color: isMainCategory ? 'var(--color-heading)' : undefined }}>
            {getAccountLevelLabel(node.code)}
          </span>
        </td>

        <td>
          <Badge variant={accountTypeBadge(node.accountType)}>
            {TYPE_META[node.accountType]?.label ?? node.accountType}
          </Badge>
        </td>

        <td>
          {isPosting ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: 'var(--color-success-text)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Posting
            </span>
          ) : isMainCategory ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-2xs)',
              fontWeight: 600,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
            }}>
              {node.children.length} {node.children.length === 1 ? 'Group' : 'Groups'}
            </span>
          ) : isGroup ? (
            <span className="cell-muted">
              {node.children.length} {node.children.length === 1 ? 'Sub-Group' : 'Sub-Groups'}
            </span>
          ) : (
            <span className="cell-muted">
              {node.children.length} {node.children.length === 1 ? 'Posting Account' : 'Posting Accounts'}
            </span>
          )}
        </td>
      </tr>

      {isOpen && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          openCodes={openCodes}
          setOpenCodes={setOpenCodes}
        />
      ))}
    </Fragment>
  );
}

const CODE_FORMAT_ROWS = [
  { code: '01',         label: 'Main Category',  desc: 'Level 1' },
  { code: '01 01',      label: 'Group',          desc: 'Level 2' },
  { code: '01 01 10',   label: 'Sub-Group',      desc: 'Level 3' },
  { code: '0101100001', label: 'Posting Account', desc: 'Level 4' },
];

/**
 * Renders the Tree table beside the enlarged accounts analysis column.
 */
export function AccountTreeView({
  typeFilter = '',
  postingFilter = 'all',
  depthFilter = 4,
}: AccountTreeViewProps) {
  const { data, isLoading, error } = useAccountsHierarchy();
  const { data: settings } = useGeneralSettings();
  const [search, setSearch] = useState('');
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  const tree = useMemo(
    () => filterTree((data ?? []) as TreeNode[], search.trim(), typeFilter, postingFilter, depthFilter),
    [data, search, typeFilter, postingFilter, depthFilter],
  );

  const allVisible = useMemo(() => flattenNodes(tree), [tree]);
  const totalVisible = allVisible.length;
  const headerCount = countHeaders(tree);
  const postingCount = countPosting(tree);

  const categoryCounts = useMemo(() => {
    return tree.map(node => ({
      code: displayCode(node.code),
      name: TYPE_META[node.accountType]?.label ?? node.name,
      type: node.accountType,
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

  if (error) {
    return (
      <div className="panel-body">
        <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Could not load the Account Tree. Please try again.')}</InlineAlert>
      </div>
    );
  }

  const hasAccounts = Boolean(data && data.length > 0);

  return (
    <>
      <div className="filter-bar">
        <div className="filter-bar-grow" style={{ maxWidth: 380 }}>
          <SearchField label="Search Account Tree" value={search} onChange={setSearch} placeholder="Search by Account Code Or Name" />
        </div>
        <Button size="sm" icon={<IconFoldDown size={16} stroke={1.8} />} onClick={() => setOpenCodes(new Set(collectOpenCodes(tree)))} disabled={!hasAccounts}>
          Expand All
        </Button>
        <Button size="sm" icon={<IconFoldUp size={16} stroke={1.8} />} onClick={() => setOpenCodes(new Set())} disabled={!hasAccounts}>
          Collapse All
        </Button>
        <div className="filter-bar-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {isLoading ? 'Loading…' : `${formatCount(totalVisible, settings)} Visible · ${formatCount(headerCount, settings)} Headers · ${formatCount(postingCount, settings)} Posting`}
        </div>
      </div>

      <div className="layout-main-aside" style={{ flex: 1, minHeight: 0, gap: 0, ['--aside-width' as string]: '360px' }}>
        <div className="table-scroll" style={{ borderRight: '1px solid var(--color-border-subtle)' }}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- ARIA treegrid on a table is the standard tree-table pattern */}
          <table className="data-table" role="treegrid" aria-label="Chart Of Accounts Tree">
            <thead>
              <tr>
                <th style={{ width: 240 }}>Account Code</th>
                <th>Account Name</th>
                <th style={{ width: 140 }}>Level</th>
                <th style={{ width: 120 }}>Type</th>
                <th style={{ width: 120 }}>Account Kind</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableMessageRow colSpan={COLUMN_COUNT} title="Building Account Tree…" loading />}
              {!isLoading && !hasAccounts && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="No Accounts Yet" description="Import a template or create accounts with New Account." />
              )}
              {!isLoading && hasAccounts && tree.length === 0 && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="No Accounts Match" description="Change the search text or clear the filters to see more accounts." />
              )}
              {!isLoading && tree.map(node => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  openCodes={openCodes}
                  setOpenCodes={setOpenCodes}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Enlarged Right-Side Summary Section (360px) */}
        <aside
          aria-label="Accounts Summary"
          style={{
            width: 'var(--aside-width, 360px)',
            minWidth: 'var(--aside-width, 360px)',
            padding: 20,
            overflowY: 'auto',
            minHeight: 0,
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Section 1: Account Structure Overview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 className="form-section-title" style={{ margin: 0, fontSize: 'var(--font-size-md)' }}>
                Account Analysis
              </h3>
              <span style={{
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-muted)',
              }}>
                {formatCount(totalVisible, settings)} Total
              </span>
            </div>

            {/* 2-Column KPI Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Headers
                </span>
                <span style={{ display: 'block', fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                  {formatCount(headerCount, settings)}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Structural (L1–L3)
                </span>
              </div>

              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Posting
                </span>
                <span style={{ display: 'block', fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-success-text)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                  {formatCount(postingCount, settings)}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Ledger (L4)
                </span>
              </div>
            </div>

            {/* Category breakdown with visual progress distribution */}
            {categoryCounts.length === 0 ? (
              <p className="form-hint" style={{ marginTop: 0 }}>No accounts to count.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {categoryCounts.map(item => {
                  const type = item.type;
                  const accent = CATEGORY_ACCENTS[type] ?? CATEGORY_ACCENTS.Asset;
                  const pct = totalVisible > 0 ? Math.round((item.count / totalVisible) * 100) : 0;

                  return (
                    <div
                      key={item.code}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: accent.dot,
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            color: 'var(--color-heading)',
                            minWidth: 20,
                          }}>
                            {item.code}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-heading)' }}>
                            {item.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-heading)',
                          }}>
                            {formatCount(item.count, settings)}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            minWidth: 32,
                            textAlign: 'right',
                          }}>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Visual progress bar track */}
                      <div style={{
                        width: '100%',
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'var(--color-surface-subtle)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: accent.border,
                          borderRadius: 2,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Account Code Structure Guide */}
          <div style={{
            padding: 14,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <h4 className="form-section-title" style={{ margin: '0 0 10px', fontSize: 'var(--font-size-sm)' }}>
              Account Code Format
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CODE_FORMAT_ROWS.map(row => (
                <div key={row.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-heading)',
                  }}>
                    {row.code}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-heading)', fontWeight: 500 }}>
                      {row.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      ({row.desc})
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{
              margin: '12px 0 0',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              lineHeight: 1.4,
              borderTop: '1px solid var(--color-border-subtle)',
              paddingTop: 8,
            }}>
              10-digit structure (MM GG SS PPPP). Financial vouchers and ledger reports post strictly to Level 4 Posting Accounts.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
