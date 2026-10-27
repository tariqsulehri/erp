'use client';

import type { ReactNode } from 'react';
import { IconPrinter, IconX } from '@tabler/icons-react';
import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import type { TransferPlaceKind } from '@/lib/api/stock-transfers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PLACE_KIND_LABELS, placeName } from './transfer-places';

/** A transfer side with its type, e.g. "MAIN - Main Warehouse" plus a Warehouse badge. */
export function PlaceCell({ kind, code, name, location }: { kind?: TransferPlaceKind; code?: string | null; name?: string | null; location?: string | null }) {
  const placeKind: TransferPlaceKind = kind === 'BRANCH' ? 'BRANCH' : 'WAREHOUSE';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', flexWrap: 'wrap' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeName(code, name)}{location ? ` / ${location}` : ''}</span>
      <Badge variant={placeKind === 'BRANCH' ? 'info' : 'neutral'}>{PLACE_KIND_LABELS[placeKind]}</Badge>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{value}</dd></div>;
}

/** Side panel with one transfer: date, places, reference, and the items moved. */
export function TransferDetailPanel({ detail, loading, settings, onClose }: {
  detail: any;
  loading: boolean;
  settings?: AppFormatSettingsSource | null;
  onClose: () => void;
}) {
  return (
    <aside className="panel side-panel" aria-label="Transfer Details">
      <div className="panel-header">
        <h2 className="panel-title">{detail?.transfer_number ?? 'Transfer Details'}</h2>
        <span className="row-actions">
          {detail && <Button variant="ghost" size="sm" icon={<IconPrinter size={16} stroke={1.8} />} onClick={() => window.print()} aria-label="Print Transfer" title="Print Transfer" />}
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Details" title="Close Details" />
        </span>
      </div>
      <div className="panel-body">
        {loading && <p className="form-hint">Loading transfer details…</p>}
        {!loading && detail && (
          <>
            <dl className="detail-list">
              <InfoRow label="Date" value={formatDate(detail.transfer_date, settings)} />
              <InfoRow label="Status" value={<Badge variant="success">{detail.status}</Badge>} />
              <InfoRow label="From" value={<PlaceCell kind={detail.from_kind} code={detail.from_code ?? detail.from_warehouse_code} name={detail.from_name ?? detail.from_warehouse_name} location={detail.from_location_name} />} />
              <InfoRow label="To" value={<PlaceCell kind={detail.to_kind} code={detail.to_code ?? detail.to_warehouse_code} name={detail.to_name ?? detail.to_warehouse_name} location={detail.to_location_name} />} />
              <InfoRow label="Reference" value={detail.reference_number || 'Not Set'} />
            </dl>
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead><tr><th className="num" style={{ width: 44 }}>No.</th><th>Item</th><th className="num" style={{ width: 96 }}>Quantity</th></tr></thead>
              <tbody>
                {(detail.lines ?? []).map((line: any, index: number) => (
                  <tr key={line.id}>
                    <td className="num cell-muted">{index + 1}</td>
                    <td className="cell-strong">{line.item_code} - {line.item_name}</td>
                    <td className="num">{formatNumber(line.quantity, settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </aside>
  );
}
