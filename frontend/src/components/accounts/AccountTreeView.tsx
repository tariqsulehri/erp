'use client';

/**
 * AccountTreeView
 *
 * Professional Chart of Accounts hierarchy view.
 * Shows Main Category -> Group -> Sub-Group -> Posting Account with
 * compact analysis totals and clear branch indentation.
 */

import { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { IconChevronDown, IconChevronRight, IconFoldDown, IconFoldUp } from '@tabler/icons-react';
import { useAccountsHierarchy, type AccountTreeNode } from '@/lib/api/accounts';
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
}

const TYPE_META = ACCOUNT_CATEGORY_META;

/** Name weight per hierarchy level: headers read heavier than posting accounts. */
const LEVEL_WEIGHT: Record<number, number> = { 1: 600, 2: 600, 3: 500, 4: 400 };

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
        style={{ cursor: hasChildren ? 'pointer' : undefined }}
      >
        {/* Code with indentation, 1px guide lines and the expand button */}
        <td style={{ position: 'relative', paddingLeft: 8 + depth * INDENT }}>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
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
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: level === 4 ? 400 : 500,
              color: 'var(--color-heading)',
            }}>
              {displayCode(node.code)}
            </span>
          </span>
        </td>

        <td className={level === 4 ? 'cell-stack' : undefined}>
          <span style={{
            display: 'block',
            color: 'var(--color-heading)',
            fontWeight: LEVEL_WEIGHT[level] ?? 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name}
          </span>
          {level === 4 && (
            <span className="cell-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {spacedCode(node.code)}
            </span>
          )}
        </td>

        <td className="cell-muted">{getAccountLevelLabel(node.code)}</td>

        <td>
          <Badge variant={accountTypeBadge(node.accountType)}>
            {TYPE_META[node.accountType]?.label ?? node.accountType}
          </Badge>
        </td>

        <td className="cell-muted">
          {node.isPosting ? 'Posting' : `${node.children.length} ${node.children.length === 1 ? 'Child' : 'Children'}`}
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
  { code: '01',         label: 'Main Category' },
  { code: '0101',       label: 'Group' },
  { code: '010110',     label: 'Sub-Group' },
  { code: '0101100001', label: 'Posting Account' },
];

/**
 * Renders as a fragment (tree filter bar, then the tree table beside the analysis column)
 * so it fills the parent `.panel`.
 */
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
        <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Unable to load the Account Tree.')}</InlineAlert>
      </div>
    );
  }

  const hasAccounts = Boolean(data && data.length > 0);

  return (
    <>
      <div className="filter-bar">
        <div className="filter-bar-grow" style={{ maxWidth: 360 }}>
          <SearchField label="Search Account Tree" value={search} onChange={setSearch} placeholder="Search by Account Code Or Name" />
        </div>
        <Button size="sm" icon={<IconFoldDown size={16} stroke={1.8} />} onClick={() => setOpenCodes(new Set(collectOpenCodes(tree)))} disabled={!hasAccounts}>
          Expand All
        </Button>
        <Button size="sm" icon={<IconFoldUp size={16} stroke={1.8} />} onClick={() => setOpenCodes(new Set())} disabled={!hasAccounts}>
          Collapse All
        </Button>
        <div className="filter-bar-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {isLoading ? 'Loading…' : `${allVisible.length.toLocaleString()} Visible · ${countHeaders(tree).toLocaleString()} Headers · ${countPosting(tree).toLocaleString()} Posting`}
        </div>
      </div>

      <div className="layout-main-aside" style={{ flex: 1, minHeight: 0, gap: 0, ['--aside-width' as string]: '260px' }}>
        <div className="table-scroll" style={{ borderRight: '1px solid var(--color-border-subtle)' }}>
          <table className="data-table" role="treegrid" aria-label="Chart Of Accounts Tree">
            <thead>
              <tr>
                <th style={{ width: 230 }}>Account Code</th>
                <th>Account Name</th>
                <th style={{ width: 140 }}>Level</th>
                <th style={{ width: 120 }}>Type</th>
                <th style={{ width: 110 }}>Account Kind</th>
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

        <aside aria-label="Account Analysis" style={{ padding: 16, overflow: 'auto', minHeight: 0 }}>
          <h3 className="form-section-title">Account Analysis</h3>
          {categoryCounts.length === 0 ? (
            <p className="form-hint" style={{ marginTop: 0 }}>No accounts to count.</p>
          ) : (
            <dl className="detail-list">
              {categoryCounts.map(item => (
                <div key={item.code} className="detail-row" style={{ gridTemplateColumns: '28px minmax(0, 1fr) auto' }}>
                  <dt style={{ fontVariantNumeric: 'tabular-nums' }}>{item.code}</dt>
                  <dd>{item.name}</dd>
                  <dd style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-heading)' }}>
                    {item.count.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div style={{ marginTop: 20 }}>
            <h3 className="form-section-title">Account Code Format</h3>
            <dl className="detail-list">
              {CODE_FORMAT_ROWS.map(row => (
                <div key={row.code} className="detail-row" style={{ gridTemplateColumns: '92px minmax(0, 1fr)' }}>
                  <dt style={{ fontVariantNumeric: 'tabular-nums' }}>{row.code}</dt>
                  <dd>{row.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
