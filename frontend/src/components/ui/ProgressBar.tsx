'use client';

import type { CSSProperties } from 'react';

export type ProgressTone = 'blue' | 'teal' | 'slate' | 'amber' | 'violet' | 'rose';

export interface ProgressBarProps {
  /** Value from 0 to 100, or a direct count when total is provided. */
  value?: number;
  /** Total value for computing percentage: (value / total) * 100. */
  total?: number;
  /** Direct percentage (0–100). */
  pct?: number;
  /** Standard track height in pixels. Defaults to standard 14px. */
  height?: number;
  /** Semantic color tone with pre-calibrated 3D gradients. */
  tone?: ProgressTone;
  /** Custom solid color or CSS variable. */
  color?: string;
  /** Custom dynamic CSS gradient string. */
  gradient?: string;
  /** Visual style: '3d' (specular glossy top rim + recessed track) or 'flat'. */
  variant?: '3d' | 'flat';
  /** Optional accessible ARIA label. */
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
}

function toneGradient(tone?: ProgressTone): string | undefined {
  switch (tone) {
    case 'blue':
      return 'linear-gradient(90deg, rgb(var(--chart-1)) 0%, rgb(var(--erp-blue-40)) 100%)';
    case 'teal':
      return 'linear-gradient(90deg, rgb(var(--chart-2)) 0%, rgb(var(--erp-blue-40)) 100%)';
    case 'slate':
      return 'linear-gradient(90deg, rgb(var(--chart-6)) 0%, rgb(var(--erp-dark-40)) 100%)';
    case 'amber':
      return 'linear-gradient(90deg, rgb(var(--chart-3)) 0%, rgb(var(--erp-orange-80)) 100%)';
    case 'violet':
      return 'linear-gradient(90deg, rgb(var(--chart-4)) 0%, rgb(var(--erp-blue-60)) 100%)';
    case 'rose':
      return 'linear-gradient(90deg, rgb(var(--danger)) 0%, rgb(var(--erp-orange-80)) 100%)';
    default:
      return undefined;
  }
}

/**
 * Standard horizontal bar graph / progress bar for ERP dashboards and analytics.
 * Enforces the standardized 14px track height with pill rounding (radius-full)
 * and 3D specular highlight.
 */
export function ProgressBar({
  value,
  total,
  pct: pctProp,
  height = 14,
  tone = 'blue',
  color,
  gradient,
  variant = '3d',
  ariaLabel,
  style,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(
    100,
    Math.max(
      0,
      pctProp !== undefined
        ? pctProp
        : total && total > 0 && value !== undefined
        ? (value / total) * 100
        : value ?? 0,
    ),
  );

  const resolvedBackground = gradient ?? toneGradient(tone) ?? color ?? 'rgb(var(--chart-1))';

  const is3d = variant === '3d';

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={`meter-bar-track ${is3d ? 'track-3d' : ''} ${className}`.trim()}
      style={{
        height,
        ...style,
      }}
    >
      <div
        className={`meter-bar-fill ${is3d ? 'fill-3d' : ''}`}
        style={{
          width: `${percentage}%`,
          background: resolvedBackground,
        }}
      />
    </div>
  );
}

