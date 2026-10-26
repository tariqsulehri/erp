import React from 'react';

interface TableSkeletonProps {
  columns: number;
  rowCount?: number;
  cellHeights?: number;
  ariaLabel?: string;
}

/**
 * Shimmer TableSkeleton renders realistic multi-row, multi-column skeleton rows
 * inside a table tbody to eliminate Cumulative Layout Shift (CLS).
 */
export function TableSkeleton({
  columns,
  rowCount = 5,
  cellHeights = 14,
  ariaLabel = 'Loading content…',
}: TableSkeletonProps) {
  // Varied widths for realistic column variance
  const widthProfiles = [
    ['40%', '85%', '60%', '70%', '50%', '65%', '45%', '30%'],
    ['50%', '75%', '55%', '80%', '45%', '70%', '55%', '30%'],
    ['35%', '90%', '65%', '60%', '60%', '60%', '40%', '30%'],
    ['45%', '70%', '50%', '75%', '55%', '80%', '50%', '30%'],
    ['30%', '80%', '70%', '65%', '40%', '75%', '45%', '30%'],
  ];

  return (
    <>
      <tr className="sr-only" aria-busy="true">
        <td colSpan={columns}>{ariaLabel}</td>
      </tr>
      {Array.from({ length: rowCount }).map((_, rowIndex) => {
        const widths = widthProfiles[rowIndex % widthProfiles.length];
        return (
          <tr key={rowIndex} aria-hidden="true" style={{ opacity: 1 - rowIndex * 0.08 }}>
            {Array.from({ length: columns }).map((_, colIndex) => {
              const width = widths[colIndex % widths.length] || '60%';
              return (
                <td key={colIndex} style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                  <div
                    className="skeleton"
                    style={{
                      height: cellHeights,
                      width,
                      minWidth: 24,
                    }}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
