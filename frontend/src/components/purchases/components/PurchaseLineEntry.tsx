'use client';

import { IconCircleCheck, IconCircleX, IconFilePlus } from '@tabler/icons-react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { NumericField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  compactButtonStyle,
  addLineRowStyle,
} from '../PurchaseVoucherStyles';
import type { AddLineDraft, ItemOption } from '../PurchaseVoucherTypes';

interface PurchaseLineEntryProps {
  priceLabel?: string;
  lineDraft: AddLineDraft;
  selectedItem?: ItemOption;
  items: ItemOption[];
  lineTotal: number;
  editingLineId: number | null;
  loadingSupportData: boolean;
  supportDataHasError: boolean;
  money: (value: number) => string;
  onChange: (patch: Partial<AddLineDraft>) => void;
  onAddOrUpdate: () => void;
  onCancelEdit: () => void;
}

export function PurchaseLineEntry({
  priceLabel = 'Purchase Price',
  lineDraft,
  selectedItem,
  items,
  lineTotal,
  editingLineId,
  loadingSupportData,
  supportDataHasError,
  money,
  onChange,
  onAddOrUpdate,
  onCancelEdit,
}: PurchaseLineEntryProps) {
  return (
    <div style={addLineRowStyle}>
      <div style={{ width: 275 }}>
        <FieldLabel label="Item" required>
          <SearchableSelect value={lineDraft.itemId} options={items} onChange={value => onChange({ itemId: value })} placeholder={loadingSupportData ? 'Loading Items' : 'Search Item'} disabled={loadingSupportData || supportDataHasError} />
        </FieldLabel>
      </div>
      <div style={{ width: 82 }}><TextField label="UOM" value={selectedItem?.uomName ?? ''} disabled /></div>
      <div style={{ width: 92 }}>
        <NumericField label="Quantity" required decimalPlaces={4} value={lineDraft.quantity} onChange={value => onChange({ quantity: value })} />
      </div>
      <div style={{ width: 112 }}>
        <NumericField label={priceLabel} required value={lineDraft.purchasePrice} onChange={value => onChange({ purchasePrice: value })} />
      </div>
      <div style={{ width: 102 }}>
        <NumericField label="Discount" value={lineDraft.discountAmount} onChange={value => onChange({ discountAmount: value })} />
      </div>
      <div style={{ width: 102 }}>
        <NumericField label="Tax" value={lineDraft.taxAmount} onChange={value => onChange({ taxAmount: value })} />
      </div>
      <div style={{ width: 122 }}><NumericField label="Line Total" value={money(Math.max(0, lineTotal))} disabled /></div>
      <div style={{ flex: 1, minWidth: 150 }}>
        <TextField label="Line Description" value={lineDraft.description} onChange={value => onChange({ description: value })} placeholder="Optional" />
      </div>
      <div style={{ display: 'flex', gap: 6, alignSelf: 'end' }}>
        <button type="button" className="btn-primary" onClick={onAddOrUpdate} style={{ ...compactButtonStyle, minWidth: 92 }}>
          {editingLineId ? <IconCircleCheck size={15} /> : <IconFilePlus size={15} />} {editingLineId ? 'Update' : 'Add'}
        </button>
        {editingLineId && (
          <button type="button" className="btn-secondary" onClick={onCancelEdit} title="Cancel Line Edit" style={{ ...compactButtonStyle, minWidth: 34, padding: '5px 8px' }}>
            <IconCircleX size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
