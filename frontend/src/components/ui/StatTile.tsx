import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconArrowDownRight, IconArrowUpRight, IconChevronRight } from '@tabler/icons-react';
import { HelpButton } from './HelpButton';

export type StatTone = 'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'slate';

export interface StatTileProps {
  label: string;
  /** Main figure, already formatted. */
  value: ReactNode;
  /** Muted text after the figure, e.g. "/ 41" or "/ 67.8% target". */
  suffix?: string;
  /** Tabler icon, 15–16px; it takes the tone colour. */
  icon?: ReactNode;
  /** Colour identity: the wash, the edge, the icon and the figure. Pick it from the meaning (good, attention, problem). */
  tone?: StatTone;
  /** Plain-language explanation shown in a help window from the ⓘ button. */
  help?: ReactNode;
  /** One or two short lines under the figure. */
  detail?: ReactNode;
  /** Thin progress bar, 0–100. */
  progress?: number;
  /** Part-to-whole bar instead of a single progress value. */
  parts?: Array<{ name: string; value: number; color: string }>;
  /** Percent change against a named period; null hides it. */
  change?: { percent: number | null; text: string } | null;
  /** Makes the whole tile a link to the report behind the figure. */
  href?: string;
  linkLabel?: string;
}

/**
 * Compact summary tile used on every dashboard and analytics screen.
 * Layout: icon + label (+ help) / figure + suffix / optional bar / one or two detail lines.
 */
export function StatTile({ label, value, suffix, icon, tone = 'blue', help, detail, progress, parts, change, href, linkLabel }: StatTileProps) {
  const partsTotal = parts?.reduce((sum, part) => sum + Math.max(part.value, 0), 0) ?? 0;
  const bar = progress !== undefined
    ? (
      <div className="stat-tile-bar" role="img" aria-label={`${Math.round(progress)}%`}>
        <span style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
      </div>
    )
    : parts && partsTotal > 0
      ? (
        <div className="stat-tile-bar stat-tile-bar-parts" role="img" aria-label={parts.map(part => `${part.name} ${Math.round(part.value / partsTotal * 100)}%`).join(', ')}>
          {parts.filter(part => part.value > 0).map(part => (
            <span key={part.name} title={`${part.name}: ${Math.round(part.value / partsTotal * 100)}%`} style={{ width: `${part.value / partsTotal * 100}%`, background: part.color }} />
          ))}
        </div>
      )
      : null;

  const body = (
    <>
      <div className="stat-tile-head">
        {icon && <span className="stat-tile-icon" aria-hidden>{icon}</span>}
        <span className="stat-tile-label" title={label}>{label}</span>
        {href && <IconChevronRight className="stat-tile-go" size={14} stroke={2} aria-hidden />}
        {help && <span className="stat-tile-help"><HelpButton title={label} size="sm">{help}</HelpButton></span>}
      </div>
      <div className="stat-tile-figure">
        <span className="stat-tile-value">{value}</span>
        {suffix && <span className="stat-tile-suffix">{suffix}</span>}
      </div>
      {bar}
      {(detail || (change && change.percent !== null)) && (
        <div className="stat-tile-detail">
          {change && change.percent !== null && (
            <span className="stat-tile-change">
              {change.percent >= 0 ? <IconArrowUpRight size={13} stroke={2.2} aria-hidden /> : <IconArrowDownRight size={13} stroke={2.2} aria-hidden />}
              {`${Math.abs(change.percent).toFixed(1)}%`}
              <span className="stat-tile-change-text">{change.text}</span>
            </span>
          )}
          {detail}
        </div>
      )}
    </>
  );

  const className = `stat-tile tone-${tone}${href ? ' stat-tile-link' : ''}`;
  if (href) {
    return (
      <Link href={href} className={className} title={linkLabel ?? 'View Report'}>
        {body}
        <span className="sr-only">{linkLabel ?? 'View Report'}</span>
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

/** Grid for StatTiles: as many 220px+ columns as fit (five on a wide screen). */
export function StatGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="stat-grid" role="group" aria-label={label}>{children}</div>;
}
