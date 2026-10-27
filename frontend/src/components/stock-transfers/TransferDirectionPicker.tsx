'use client';

import { IconArrowRight, IconBuildingStore, IconBuildingWarehouse } from '@tabler/icons-react';
import type { TransferPlaceKind } from '@/lib/api/stock-transfers';
import type { DirectionOption, TransferDirection } from './transfer-directions';

function PlaceIcon({ kind }: { kind: TransferPlaceKind }) {
  return kind === 'BRANCH'
    ? <IconBuildingStore size={18} stroke={1.8} aria-hidden />
    : <IconBuildingWarehouse size={18} stroke={1.8} aria-hidden />;
}

/** Choose where the stock goes, as one clear choice: four cards such as "Warehouse → Branch". */
export function TransferDirectionPicker({ value, options, onChange }: {
  value: TransferDirection;
  options: DirectionOption[];
  onChange: (direction: TransferDirection) => void;
}) {
  return (
    <fieldset className="direction-picker">
      <legend className="field-label">Transfer Direction<span className="field-required" aria-hidden="true">*</span></legend>
      <div className="direction-picker-grid" role="radiogroup" aria-label="Transfer Direction">
        {options.map(option => {
          const selected = option.value === value;
          return (
            <label key={option.value} className={`direction-card${selected ? ' is-selected' : ''}`}>
              <input type="radio" name="transfer-direction" value={option.value} checked={selected} onChange={() => onChange(option.value)} className="sr-only" />
              <span className="direction-card-route" aria-hidden>
                <PlaceIcon kind={option.from} />
                <IconArrowRight size={16} stroke={1.8} />
                <PlaceIcon kind={option.to} />
              </span>
              <span className="direction-card-label">{option.label}</span>
              <span className="direction-card-desc">{option.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
