import { useMemo, useState } from 'react';
import { cleanNumber, decimal, numericValue } from '@/lib/erp-utils';
import {
  calculatePurchaseLineTotal,
  calculatePurchaseTaxAmount,
  initialPurchaseLineDraft,
  validMoneyPattern,
  validQuantityPattern,
} from '../PurchaseVoucherHelpers';
import type { AddLineDraft, ItemOption, PurchaseLine } from '../PurchaseVoucherTypes';

interface UsePurchaseLineEditorOptions {
  items: ItemOption[];
  onDefaultWarehouseChange: (warehouseId: string) => void;
  onError: (message: string) => void;
  onClearMessage: () => void;
}

export function usePurchaseLineEditor({
  items,
  onDefaultWarehouseChange,
  onError,
  onClearMessage,
}: UsePurchaseLineEditorOptions) {
  const [lineDraft, setLineDraft] = useState<AddLineDraft>(initialPurchaseLineDraft);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [nextLineId, setNextLineId] = useState(1);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);

  const selectedItem = useMemo(
    () => items.find(item => item.value === lineDraft.itemId),
    [items, lineDraft.itemId],
  );

  const lineDraftTotal = useMemo(
    () => calculatePurchaseLineTotal(
      lineDraft.quantity,
      lineDraft.purchasePrice,
      lineDraft.discountAmount,
      lineDraft.taxAmount,
    ),
    [lineDraft.discountAmount, lineDraft.purchasePrice, lineDraft.quantity, lineDraft.taxAmount],
  );

  function resetLineEditor() {
    setLineDraft(initialPurchaseLineDraft());
    setLines([]);
    setNextLineId(1);
    setEditingLineId(null);
  }

  /** Replaces all lines, e.g. with the lines of a saved Draft that is opened for editing. */
  function loadLines(saved: PurchaseLine[]) {
    setLineDraft(initialPurchaseLineDraft());
    setLines(saved);
    setNextLineId(saved.reduce((max, line) => Math.max(max, line.id), 0) + 1);
    setEditingLineId(null);
  }

  function updateLineDraft(patch: Partial<AddLineDraft>) {
    setLineDraft(current => {
      const next = { ...current, ...patch };
      if (patch.itemId !== undefined) {
        const item = items.find(option => option.value === patch.itemId);
        next.purchasePrice = item && Number(item.purchasePrice) > 0 ? String(Number(item.purchasePrice).toFixed(2)) : '';
        next.taxAmount = item ? calculatePurchaseTaxAmount(next.quantity, next.purchasePrice, next.discountAmount, item.taxRate) : '';
        if (item?.defaultWarehouseId) onDefaultWarehouseChange(item.defaultWarehouseId);
      } else if (patch.quantity !== undefined || patch.purchasePrice !== undefined || patch.discountAmount !== undefined) {
        const item = items.find(option => option.value === next.itemId);
        if (item) next.taxAmount = calculatePurchaseTaxAmount(next.quantity, next.purchasePrice, next.discountAmount, item.taxRate);
      }
      return next;
    });
  }

  /** Adds or updates the line from the entry row. Returns false when the line is not valid. */
  function addItemLine(): boolean {
    onClearMessage();
    if (!lineDraft.itemId) {
      onError('Item is required.');
      return false;
    }
    if (!selectedItem) {
      onError('The selected Item is no longer available. Select it again.');
      return false;
    }
    if (!validQuantityPattern.test(cleanNumber(lineDraft.quantity)) || numericValue(lineDraft.quantity) <= 0) {
      onError('Quantity must be more than zero.');
      return false;
    }
    if (!validMoneyPattern.test(cleanNumber(lineDraft.purchasePrice)) || numericValue(lineDraft.purchasePrice) <= 0) {
      onError('Purchase Price must be more than zero.');
      return false;
    }
    if (lineDraft.discountAmount && !validMoneyPattern.test(cleanNumber(lineDraft.discountAmount))) {
      onError('Discount is not a correct amount. Enter a number.');
      return false;
    }
    if (lineDraft.taxAmount && !validMoneyPattern.test(cleanNumber(lineDraft.taxAmount))) {
      onError('Tax is not a correct amount. Enter a number.');
      return false;
    }

    const gross = decimal(lineDraft.quantity).times(decimal(lineDraft.purchasePrice));
    if (decimal(lineDraft.discountAmount).gt(gross)) {
      onError('Discount cannot be greater than item amount.');
      return false;
    }
    if (lineDraftTotal.lte(0)) {
      onError('Line Total must be more than zero.');
      return false;
    }

    const savedLine: PurchaseLine = {
      id: editingLineId ?? nextLineId,
      itemId: selectedItem.value,
      itemCode: selectedItem.itemCode,
      itemName: selectedItem.itemName,
      uomName: selectedItem.uomName || '',
      quantity: decimal(lineDraft.quantity).toFixed(4),
      purchasePrice: decimal(lineDraft.purchasePrice).toFixed(2),
      discountAmount: decimal(lineDraft.discountAmount).toFixed(2),
      taxAmount: decimal(lineDraft.taxAmount).toFixed(2),
      lineTotal: lineDraftTotal.toNumber(),
      description: lineDraft.description.trim(),
    };

    if (editingLineId) {
      setLines(current => current.map(line => line.id === editingLineId ? savedLine : line));
      setEditingLineId(null);
    } else {
      setLines(current => [...current, savedLine]);
      setNextLineId(value => value + 1);
    }
    setLineDraft(initialPurchaseLineDraft());
    return true;
  }

  function removeLine(id: number) {
    setLines(current => current.filter(line => line.id !== id));
    if (editingLineId === id) {
      setEditingLineId(null);
      setLineDraft(initialPurchaseLineDraft());
    }
  }

  function editLine(line: PurchaseLine) {
    onClearMessage();
    setEditingLineId(line.id);
    setLineDraft({
      itemId: line.itemId,
      quantity: line.quantity,
      purchasePrice: line.purchasePrice,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      description: line.description,
    });
  }

  function cancelLineEdit() {
    setEditingLineId(null);
    setLineDraft(initialPurchaseLineDraft());
  }

  function moveLine(id: number, direction: -1 | 1) {
    setLines(current => {
      const index = current.findIndex(line => line.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [line] = next.splice(index, 1);
      next.splice(nextIndex, 0, line);
      return next;
    });
  }

  return {
    lineDraft,
    lines,
    editingLineId,
    selectedItem,
    lineDraftTotal,
    updateLineDraft,
    addItemLine,
    removeLine,
    editLine,
    cancelLineEdit,
    moveLine,
    resetLineEditor,
    loadLines,
  };
}
