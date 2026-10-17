'use client';

import {
  formatDate,
  formatMoney,
  formatNumber,
  type AppFormatSettingsSource,
} from '@/lib/app-settings';
import { Badge } from '@/components/ui/Badge';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Product types are categories, not statuses, so they all use the quiet neutral badge.
export const PRODUCT_TYPE_META: Record<string, { label: string; variant: BadgeVariant }> = {
  Finished:     { label: 'Finished Good', variant: 'neutral' },
  RawMaterial:  { label: 'Raw Material',  variant: 'neutral' },
  SemiFinished: { label: 'Semi-Finished', variant: 'neutral' },
  Service:      { label: 'Service',       variant: 'neutral' },
  Consumable:   { label: 'Consumable',    variant: 'neutral' },
};

export const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  Active:       { label: 'Active',       variant: 'success' },
  Inactive:     { label: 'Inactive',     variant: 'neutral' },
  Discontinued: { label: 'Discontinued', variant: 'danger' },
};

export const TAX_CATS   = ['Standard', 'Zero-Rated', 'Exempt'] as const;
export const PROD_TYPES = ['Finished', 'RawMaterial', 'SemiFinished', 'Service', 'Consumable'] as const;
export const STATUSES   = ['Active', 'Inactive', 'Discontinued'] as const;

export type PageMode = 'list' | 'form' | 'detail';
export type SelectOption = { value: string; label: string; searchText?: string };

export const STATUS_OPTIONS: SelectOption[] = STATUSES.map(status => ({ value: status, label: STATUS_META[status].label }));
export const PRODUCT_TYPE_OPTIONS: SelectOption[] = PROD_TYPES.map(type => ({ value: type, label: PRODUCT_TYPE_META[type].label }));
export const TAX_CATEGORY_OPTIONS: SelectOption[] = TAX_CATS.map(tax => ({ value: tax, label: tax }));
export const STOCK_FILTER_OPTIONS: SelectOption[] = [
  { value: 'need_order', label: 'Need To Order', searchText: 'order reorder minimum low stock' },
  { value: 'below_minimum', label: 'Below Minimum', searchText: 'minimum low stock' },
  { value: 'at_or_below_reorder', label: 'At Or Below Reorder Level', searchText: 'reorder level order' },
  { value: 'out_of_stock', label: 'Out Of Stock', searchText: 'zero stock out' },
];

export const fmtAmt = (n: string | number | undefined, settings?: AppFormatSettingsSource | null) => {
  const v = Number(n ?? 0);
  return formatNumber(v, settings);
};

export const fmtQty = (n: string | number | undefined, settings?: AppFormatSettingsSource | null) => {
  const v = Number(n ?? 0);
  const baseSettings = settings ?? {};
  return v % 1 === 0
    ? formatNumber(v, { ...baseSettings, decimal_places: 0 })
    : formatNumber(v, { ...baseSettings, decimal_places: 3 });
};

export const fmtDate = (d: string | Date, settings?: AppFormatSettingsSource | null) => formatDate(d, settings);

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Active;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  const m = PRODUCT_TYPE_META[type] ?? PRODUCT_TYPE_META.Finished;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/** Money text for a `.num` table cell. Formatting comes from settings. */
export function MoneyCell({ value, muted = false, settings }: { value?: string | number; muted?: boolean; settings?: AppFormatSettingsSource | null }) {
  const text = formatMoney(Number(value ?? 0), settings);
  return muted ? <span className="cell-muted">{text}</span> : <>{text}</>;
}

/** Stock on hand for a `.num` table cell, with a status badge when stock is low or out. */
export function StockIndicator({ onHand, minLevel, reorderLevel, settings }: { onHand: string; minLevel?: string; reorderLevel?: string; settings?: AppFormatSettingsSource | null }) {
  const qty = parseFloat(onHand) || 0;
  const min = minLevel ? parseFloat(minLevel) : null;
  const reorder = reorderLevel ? parseFloat(reorderLevel) : null;
  const isBelowMin = min !== null && qty < min;
  const isAtReorder = reorder !== null && qty <= reorder;
  const isOut = qty <= 0;
  const badge = isOut
    ? { label: 'Out Of Stock', variant: 'danger' as const }
    : isBelowMin
      ? { label: 'Below Minimum', variant: 'warning' as const }
      : isAtReorder
        ? { label: 'Reorder', variant: 'warning' as const }
        : null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      <span style={{ color: isOut ? 'var(--color-danger-text)' : badge ? 'var(--color-warning-text)' : undefined }}>
        {fmtQty(qty, settings)}
      </span>
    </span>
  );
}
