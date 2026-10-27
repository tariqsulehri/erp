'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react';
import { TableMessageRow } from './TableMessageRow';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  /** Right-aligned, JetBrains Mono. */
  numeric?: boolean;
  sortable?: boolean;
  /** Value used for sorting; defaults to row[key]. */
  sortValue?: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => ReactNode;
  width?: number | string;
}

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

function compare(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === null || left === undefined || left === '') return 1;
  if (right === null || right === undefined || right === '') return -1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Compact table: sticky header, sortable columns (click the header), numbers right-aligned in mono,
 * an optional bold totals row, and plain loading and empty messages.
 */
export function DataTable<Row>({ columns, rows, rowKey, loading = false, empty = { title: 'No Records', description: '' }, totals, caption, onRowClick }: {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Cells for the totals row, by column key. */
  totals?: Partial<Record<string, ReactNode>>;
  /** Screen-reader name of the table. */
  caption?: string;
  onRowClick?: (row: Row) => void;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(item => item.key === sort.key);
    if (!column) return rows;
    const valueOf = column.sortValue ?? ((row: Row) => (row as Record<string, unknown>)[column.key] as string | number | undefined);
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => compare(valueOf(left), valueOf(right)) * factor);
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort(current => (current?.key !== key ? { key, direction: 'asc' } : current.direction === 'asc' ? { key, direction: 'desc' } : null));
  }

  return (
    <div className="table-scroll">
      <table className="data-table data-table-caps">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map(column => {
              const sorted = sort?.key === column.key ? sort.direction : null;
              return (
                <th
                  key={column.key}
                  className={column.numeric ? 'num' : undefined}
                  style={{ width: column.width }}
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : column.sortable ? 'none' : undefined}
                >
                  {column.sortable ? (
                    <button type="button" className="th-sort" onClick={() => toggleSort(column.key)} title={`Sort by ${column.header}`}>
                      {column.header}
                      {sorted === 'asc' ? <IconArrowUp size={14} stroke={2} aria-hidden /> : sorted === 'desc' ? <IconArrowDown size={14} stroke={2} aria-hidden /> : <IconArrowsSort size={14} stroke={1.8} aria-hidden />}
                    </button>
                  ) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && <TableMessageRow colSpan={columns.length} title="Loading…" loading />}
          {!loading && rows.length === 0 && <TableMessageRow colSpan={columns.length} title={empty.title} description={empty.description} action={empty.action} />}
          {!loading && sorted.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map(column => (
                <td key={column.key} className={column.numeric ? 'num' : undefined}>
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && !loading && rows.length > 0 && (
          <tfoot>
            <tr className="data-table-totals">
              {columns.map(column => <td key={column.key} className={column.numeric ? 'num' : undefined}>{totals[column.key] ?? ''}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
