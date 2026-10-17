'use client';

import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  recordLabel?: string;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  totalRecords,
  pageSize,
  pageSizeOptions = [25, 50, 100, 200],
  recordLabel = 'Records',
  disabled = false,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const atStart = safePage <= 1;
  const atEnd = safePage >= safeTotalPages;

  return (
    <div style={paginationBarStyle}>
      <div style={paginationControlsStyle}>
        <span style={paginationInfoStyle}>
          Page {safePage} Of {safeTotalPages} · {totalRecords} {recordLabel}
        </span>
        {pageSize !== undefined && onPageSizeChange && (
          <select
            className="form-input"
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.currentTarget.value))}
            style={pageSizeSelectStyle}
            title="Page Size"
            disabled={disabled}
          >
            {pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        )}
        <IconPageButton label="First Page" disabled={disabled || atStart} onClick={() => onPageChange(1)}>
          <IconChevronsLeft size={17} stroke={1.8} />
        </IconPageButton>
        <IconPageButton label="Previous Page" disabled={disabled || atStart} onClick={() => onPageChange(safePage - 1)}>
          <IconChevronLeft size={17} stroke={1.8} />
        </IconPageButton>
        <IconPageButton label="Next Page" disabled={disabled || atEnd} onClick={() => onPageChange(safePage + 1)}>
          <IconChevronRight size={17} stroke={1.8} />
        </IconPageButton>
        <IconPageButton label="Last Page" disabled={disabled || atEnd} onClick={() => onPageChange(safeTotalPages)}>
          <IconChevronsRight size={17} stroke={1.8} />
        </IconPageButton>
      </div>
    </div>
  );
}

function IconPageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="btn-secondary"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={paginationButtonStyle}
    >
      {children}
    </button>
  );
}

const paginationBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: 44,
  minHeight: 44,
  maxHeight: 44,
  padding: '0 12px',
  borderTop: '1px solid var(--color-border-subtle)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 500,
  flexShrink: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
};

const paginationInfoStyle: CSSProperties = {
  display: 'block',
  minWidth: 0,
  flexShrink: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const paginationControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  flexWrap: 'nowrap',
  justifyContent: 'flex-end',
  minWidth: 0,
  width: '100%',
};

const pageSizeSelectStyle: CSSProperties = {
  width: 74,
  height: 'var(--control-h-sm)',
  minHeight: 'var(--control-h-sm)',
  padding: '0 8px',
  fontSize: 'var(--font-size-sm)',
};

const paginationButtonStyle: CSSProperties = {
  width: 'var(--control-h-sm)',
  minWidth: 'var(--control-h-sm)',
  height: 'var(--control-h-sm)',
  minHeight: 'var(--control-h-sm)',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-secondary)',
};
