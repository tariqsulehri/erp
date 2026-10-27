import type { ReactNode } from 'react';
import type { StatTone } from './StatTile';

/**
 * Larger summary card for the top of a setup screen: tinted icon chip, small caps label,
 * a bold headline value, and one muted line. The tone colours the chip and the left edge.
 */
export function SummaryCard({ icon, label, value, detail, tone = 'blue' }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className={`summary-card tone-${tone}`}>
      <span className="summary-card-icon" aria-hidden>{icon}</span>
      <div className="summary-card-text">
        <span className="summary-card-label">{label}</span>
        <strong className="summary-card-value">{value}</strong>
        {detail && <span className="summary-card-detail">{detail}</span>}
      </div>
    </div>
  );
}
