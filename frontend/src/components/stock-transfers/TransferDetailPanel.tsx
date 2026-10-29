'use client';

import type { ReactNode } from 'react';
import { IconPencil, IconPrinter } from '@tabler/icons-react';
import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import type { TransferPlaceKind } from '@/lib/api/stock-transfers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  DetailFields,
  DetailLinesTable,
  DetailTotals,
  DetailNote,
  documentStatusLabel,
} from '@/components/documents';
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

/** Slide-over drawer with one transfer: date, places, reference, and the items moved. Follows the standard document details pattern. */
export function TransferDetailPanel({
  detail,
  loading,
  settings,
  actions,
  onOpenDraft,
  onClose,
}: {
  detail: any;
  loading: boolean;
  settings?: AppFormatSettingsSource | null;
  /** Action buttons rendered at the bottom of the drawer (Post, Cancel, Reverse). */
  actions?: ReactNode;
  /** Optional handler to open the draft form for editing. */
  onOpenDraft?: () => void;
  onClose: () => void;
}) {
  const totalQuantity = (detail?.lines ?? []).reduce(
    (acc: number, line: any) => acc + (Number(line.quantity) || 0),
    0
  );

  return (
    <Drawer
      open={true}
      title="Stock Transfer Details"
      size="lg"
      onClose={onClose}
      headerActions={
        detail && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {detail.status === 'Draft' && onOpenDraft && (
              <Button
                variant="ghost"
                size="sm"
                icon={<IconPencil size={16} stroke={1.8} />}
                onClick={onOpenDraft}
                aria-label="Edit Draft Transfer"
                title="Edit Draft Transfer"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<IconPrinter size={16} stroke={1.8} />}
              onClick={() => window.print()}
              aria-label="Print Stock Transfer"
              title="Print Stock Transfer"
            />
          </div>
        )
      }
    >
      {loading && <p className="form-hint">Loading Stock Transfer Details…</p>}
      {!loading && detail && (
        <>
          <DetailFields
            items={[
              ['Transfer No.', detail.transfer_number],
              ['Date', formatDate(detail.transfer_date, settings)],
              ['Type', 'Stock Transfer'],
              ['Status', <StatusChip key="status" status={detail.status} label={documentStatusLabel(detail.status, detail.posted_at)} />],
              ['From', <PlaceCell key="from" kind={detail.from_kind} code={detail.from_code ?? detail.from_warehouse_code} name={detail.from_name ?? detail.from_warehouse_name} location={detail.from_location_name} />],
              ['To', <PlaceCell key="to" kind={detail.to_kind} code={detail.to_code ?? detail.to_warehouse_code} name={detail.to_name ?? detail.to_warehouse_name} location={detail.to_location_name} />],
              ['Reference', detail.reference_number || 'Not Set'],
              ['Posted At', detail.posted_at ? formatDate(detail.posted_at, settings) : 'Not Set'],
              ...(detail.status === 'Voided'
                ? [
                  [`${documentStatusLabel(detail.status, detail.posted_at)} Reason`, detail.void_reason || 'Not Set'] as [string, ReactNode],
                  [`${documentStatusLabel(detail.status, detail.posted_at)} At`, detail.voided_at ? formatDate(detail.voided_at, settings) : 'Not Set'] as [string, ReactNode],
                ]
                : []),
              ['Description', detail.notes || detail.description || 'Not Set'],
            ]}
          />

          <DetailLinesTable>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 85 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num">No.</th>
                <th>Item Code</th>
                <th>Item Description</th>
                <th>UOM</th>
                <th className="num">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {(detail.lines ?? []).map((line: any, index: number) => (
                <tr key={line.id}>
                  <td className="num cell-muted">{index + 1}</td>
                  <td><span className="code-chip">{line.item_code}</span></td>
                  <td className="cell-strong">{line.item_name}</td>
                  <td>{line.uom_name || line.uom || '—'}</td>
                  <td className="num">{formatNumber(line.quantity, settings)}</td>
                </tr>
              ))}
            </tbody>
          </DetailLinesTable>

          <DetailTotals
            items={[
              ['Total Items', `${(detail.lines ?? []).length} ${(detail.lines ?? []).length === 1 ? 'Item' : 'Items'}`],
              ['Total Quantity', formatNumber(totalQuantity, settings)],
            ]}
          />

          <DetailNote>
            {detail.status === 'Draft' && 'This stock transfer is a Draft. Edit it and post it to move stock between locations.'}
            {detail.status === 'Posted' && 'This stock transfer is already posted. Stock has moved from the origin to destination.'}
            {detail.status === 'Voided' && 'This stock transfer has been reversed. Items were returned to the source place.'}
          </DetailNote>

          {actions}
        </>
      )}
    </Drawer>
  );
}
