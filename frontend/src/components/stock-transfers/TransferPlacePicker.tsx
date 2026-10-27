'use client';

import type { ReactNode } from 'react';
import type { TransferPlace, TransferPlaceKind } from '@/lib/api/stock-transfers';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PLACE_KIND_LABELS, PLACE_KIND_OPTIONS, type PlaceOption } from './transfer-places';

/**
 * One side of a transfer (From or To): a Branch or Warehouse, plus an optional Location.
 * When `lockedLabel` is set the side is fixed to the user's own Branch / Warehouse and shown read-only.
 */
export function TransferPlacePicker({
  side,
  place,
  places,
  locations,
  loading,
  disabled,
  lockedLabel,
  hint,
  kindFixed = false,
  onChange,
}: {
  side: 'From' | 'To';
  place: TransferPlace;
  places: PlaceOption[];
  locations: Array<{ value: string; label: string; searchText: string }>;
  loading: boolean;
  disabled: boolean;
  lockedLabel?: string;
  hint?: ReactNode;
  /** The transfer direction already decides Branch or Warehouse, so the type switch is hidden. */
  kindFixed?: boolean;
  onChange: (place: TransferPlace) => void;
}) {
  const kindLabel = PLACE_KIND_LABELS[place.kind];
  const selected = places.find(option => option.value === place.id);
  const locationRequired = Boolean(selected?.useLocations);
  // Branch shelves are optional; the field shows only when the Branch has some.
  const showLocation = place.kind === 'WAREHOUSE' ? locationRequired : locations.length > 0;

  if (lockedLabel) {
    return (
      <div className="span-2">
        <FieldLabel label={`${side} ${kindLabel}`} required>
          <input className="form-input" value={lockedLabel} readOnly aria-readonly />
        </FieldLabel>
        <span className="form-hint" style={{ display: 'block' }}>You can send stock only from your own {kindLabel}.</span>
        {hint}
      </div>
    );
  }

  return (
    <div className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!kindFixed && (
        <FieldLabel label={`${side} Type`} required>
          <SegmentedControl<TransferPlaceKind>
            label={`${side} Type`}
            value={place.kind}
            options={PLACE_KIND_OPTIONS}
            onChange={kind => onChange({ kind, id: '', locationId: '' })}
          />
        </FieldLabel>
      )}
      <FieldLabel label={`${side} ${kindLabel}`} required>
        <SearchableSelect
          value={place.id}
          options={places}
          onChange={value => onChange({ ...place, id: value, locationId: '' })}
          placeholder={loading ? `Loading ${place.kind === 'BRANCH' ? 'Branches' : 'Warehouses'}` : `Search ${kindLabel}`}
          disabled={disabled}
        />
      </FieldLabel>
      {hint}
      {showLocation && (
        <FieldLabel label={`${side} Location`} required={locationRequired}>
          <SearchableSelect
            value={place.locationId ?? ''}
            options={locationRequired ? locations : [{ value: '', label: 'No Location', searchText: '' }, ...locations]}
            onChange={value => onChange({ ...place, locationId: value })}
            placeholder="Search Location"
            disabled={disabled || !place.id}
          />
        </FieldLabel>
      )}
    </div>
  );
}
