import type { AdjustmentType, StockHolderKind } from '@/lib/api/stock-adjustments';

/** One saved line of a Draft adjustment. */
export interface AdjustmentDraftLine {
  adjustmentType: AdjustmentType;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  unitCost: string;
  description: string;
}

/** The entry form values for a saved Draft Stock Adjustment, so it can be opened, changed and posted. */
export interface AdjustmentDraftForm {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  holderKind: StockHolderKind;
  branchId: string;
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  reason: string;
  description: string;
  lines: AdjustmentDraftLine[];
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

/** Maps the adjustment detail from GET /stock-adjustments/:id to the entry form. */
export function adjustmentFormFromDetail(detail: Record<string, any>): AdjustmentDraftForm {
  return {
    id: String(detail.id),
    adjustmentNumber: String(detail.adjustment_number),
    adjustmentDate: typeof detail.adjustment_date === 'string' ? detail.adjustment_date.slice(0, 10) : '',
    holderKind: detail.branch_id ? 'BRANCH' : 'WAREHOUSE',
    branchId: text(detail.branch_id),
    warehouseId: text(detail.warehouse_id),
    locationId: text(detail.location_id),
    referenceNumber: text(detail.reference_number),
    reason: text(detail.reason),
    description: text(detail.description),
    lines: [...(detail.lines ?? [])]
      .sort((left, right) => Number(left.line_number) - Number(right.line_number))
      .map(line => ({
        adjustmentType: line.adjustment_type === 'Decrease' ? 'Decrease' : 'Increase',
        itemId: String(line.item_id),
        itemCode: text(line.item_code),
        itemName: text(line.item_name),
        uomName: text(line.uom_name),
        quantity: String(Number(line.quantity)),
        unitCost: String(Number(line.unit_cost)),
        description: text(line.description),
      })),
  };
}
