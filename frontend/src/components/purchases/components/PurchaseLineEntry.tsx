'use client';

import { IconCircleCheck, IconFilePlus, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { NumericField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LineEntryRow, lineEntryFieldClass } from '@/components/documents';
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

/**
 * Line-entry row of the trade documents. Item is the first field and Line Description the last:
 * Enter in Line Description adds (or updates) the line — see useLineEntryKeyboard.
 */
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
  const actionLabel = editingLineId ? 'Update Line' : 'Add Line';
  return (
    <LineEntryRow label={editingLineId ? 'Edit Line' : 'New Line'}>
      <div className={lineEntryFieldClass.item} data-line-first>
        <FieldLabel label="Item" required>
          <SearchableSelect value={lineDraft.itemId} options={items} onChange={value => onChange({ itemId: value })} placeholder={loadingSupportData ? 'Loading Items' : 'Search Item'} disabled={loadingSupportData || supportDataHasError} />
        </FieldLabel>
      </div>
      <div className={lineEntryFieldClass.number}>
        <NumericField
          label="Quantity"
          required
          decimalPlaces={4}
          value={lineDraft.quantity}
          onChange={value => onChange({ quantity: value })}
          hint={selectedItem ? `UOM: ${selectedItem.uomName || 'Not Set'}` : undefined}
        />
      </div>
      <div className={lineEntryFieldClass.amount}>
        <NumericField label={priceLabel} required value={lineDraft.purchasePrice} onChange={value => onChange({ purchasePrice: value })} />
      </div>
      <div className={lineEntryFieldClass.number}>
        <NumericField label="Discount" value={lineDraft.discountAmount} onChange={value => onChange({ discountAmount: value })} />
      </div>
      <div className={lineEntryFieldClass.number}>
        <NumericField label="Tax" value={lineDraft.taxAmount} onChange={value => onChange({ taxAmount: value })} />
      </div>
      <div className={lineEntryFieldClass.amount}>
        <NumericField label="Line Total" value={money(Math.max(0, lineTotal))} disabled />
      </div>
      <div className={lineEntryFieldClass.text} data-line-last>
        <TextField label="Line Description" value={lineDraft.description} onChange={value => onChange({ description: value })} placeholder="Optional" />
      </div>
      <div className={lineEntryFieldClass.actions}>
        <Button
          variant="secondary"
          icon={editingLineId ? <IconCircleCheck size={16} stroke={1.8} aria-hidden /> : <IconFilePlus size={16} stroke={1.8} aria-hidden />}
          onClick={onAddOrUpdate}
          title={`${actionLabel} (Enter)`}
        >
          {editingLineId ? 'Update' : 'Add'}
        </Button>
        {editingLineId && (
          <Button variant="ghost" icon={<IconX size={16} stroke={1.8} aria-hidden />} onClick={onCancelEdit} aria-label="Cancel Line Edit" title="Cancel Line Edit (Alt+N)" />
        )}
      </div>
    </LineEntryRow>
  );
}
