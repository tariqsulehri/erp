import type { TransferPlace } from '@/lib/api/stock-transfers';

/** One saved line of a Draft transfer, before the source stock is known. */
export interface TransferDraftLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  description: string;
}

/** The entry form values for a saved Draft Stock Transfer, so it can be opened, changed and posted. */
export interface TransferDraftForm {
  id: string;
  transferNumber: string;
  transferDate: string;
  from: TransferPlace;
  to: TransferPlace;
  referenceNumber: string;
  description: string;
  lines: TransferDraftLine[];
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

/** One side of a transfer from its stored columns: a Branch or a Warehouse, with an optional shelf Location. */
function placeFrom(branchId: unknown, warehouseId: unknown, locationId: unknown): TransferPlace {
  return branchId
    ? { kind: 'BRANCH', id: String(branchId), locationId: text(locationId) }
    : { kind: 'WAREHOUSE', id: text(warehouseId), locationId: text(locationId) };
}

/** Maps the transfer detail from GET /stock-transfers/:id to the entry form. */
export function transferFormFromDetail(detail: Record<string, any>): TransferDraftForm {
  return {
    id: String(detail.id),
    transferNumber: String(detail.transfer_number),
    transferDate: typeof detail.transfer_date === 'string' ? detail.transfer_date.slice(0, 10) : '',
    from: placeFrom(detail.from_branch_id, detail.from_warehouse_id, detail.from_location_id),
    to: placeFrom(detail.to_branch_id, detail.to_warehouse_id, detail.to_location_id),
    referenceNumber: text(detail.reference_number),
    description: text(detail.description),
    lines: [...(detail.lines ?? [])]
      .sort((left, right) => Number(left.line_number) - Number(right.line_number))
      .map(line => ({
        itemId: String(line.item_id),
        itemCode: text(line.item_code),
        itemName: text(line.item_name),
        uomName: text(line.uom_name),
        // Plain number text, as the quantity field expects when typed.
        quantity: String(Number(line.quantity)),
        description: text(line.description),
      })),
  };
}
