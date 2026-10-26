import type { StockTransferSupportData, TransferPlace, TransferPlaceKind } from '@/lib/api/stock-transfers';

export interface PlaceOption {
  value: string;
  label: string;
  searchText: string;
  isDefault: boolean;
  /** Warehouses that use Locations must have one; Branch Locations are optional. */
  useLocations: boolean;
}

export const PLACE_KIND_LABELS: Record<TransferPlaceKind, string> = {
  BRANCH: 'Branch',
  WAREHOUSE: 'Warehouse',
};

export const PLACE_KIND_OPTIONS: Array<{ value: TransferPlaceKind; label: string }> = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'BRANCH', label: 'Branch' },
];

export function placeOptions(support: StockTransferSupportData | undefined, kind: TransferPlaceKind): PlaceOption[] {
  if (kind === 'BRANCH') {
    return (support?.branches ?? []).map((branch: any) => ({
      value: branch.id,
      label: branch.city ? `${branch.code} - ${branch.name} (${branch.city})` : `${branch.code} - ${branch.name}`,
      searchText: `${branch.code} ${branch.name} ${branch.city ?? ''}`,
      isDefault: Boolean(branch.is_default),
      useLocations: false,
    }));
  }
  return (support?.warehouses ?? []).map((warehouse: any) => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}`,
    searchText: `${warehouse.code} ${warehouse.name}`,
    isDefault: Boolean(warehouse.is_default),
    useLocations: Boolean(warehouse.use_locations),
  }));
}

export function locationOptions(support: StockTransferSupportData | undefined, place: TransferPlace) {
  const ownerKey = place.kind === 'BRANCH' ? 'branch_id' : 'warehouse_id';
  return (support?.locations ?? [])
    .filter((location: any) => place.id && location[ownerKey] === place.id)
    .map((location: any) => ({
      value: location.id,
      label: `${location.code} - ${location.name}`,
      searchText: `${location.code} ${location.name}`,
      isDefault: Boolean(location.is_default),
    }));
}

export function samePlace(a: TransferPlace, b: TransferPlace) {
  return a.kind === b.kind && a.id === b.id && (a.locationId || '') === (b.locationId || '');
}

export function emptyPlace(kind: TransferPlaceKind): TransferPlace {
  return { kind, id: '', locationId: '' };
}

/** "Code - Name" for list / detail rows, using the combined fields the backend returns. */
export function placeName(code?: string | null, name?: string | null) {
  if (!code && !name) return 'Not Set';
  return [code, name].filter(Boolean).join(' - ');
}
