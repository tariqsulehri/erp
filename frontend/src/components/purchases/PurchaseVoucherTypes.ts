import type { SelectOption } from '@/components/ui/SearchableSelect';

export type PaymentType = 'Cash' | 'Credit';
export type PurchaseMessageKind = 'success' | 'error';

export interface SupplierOption extends SelectOption {
  paymentTermsDays: number;
  accountCode?: string | null;
}

export interface ItemOption extends SelectOption {
  itemCode: string;
  itemName: string;
  purchasePrice: string;
  taxRate: string;
  uomName?: string | null;
  defaultWarehouseId?: string | null;
  stockOnHand: string;
}

export interface WarehouseOption extends SelectOption {
  isDefault?: boolean;
  useLocations?: boolean;
}

export interface LocationOption extends SelectOption {
  warehouseId: string;
  isDefault?: boolean;
}

export interface PurchaseLine {
  id: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  purchasePrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: number;
  description: string;
}

export interface PurchaseListRow {
  id: string;
  purchase_number: string;
  purchase_date: string;
  supplier_invoice_date?: string | null;
  due_date?: string | null;
  payment_type: PaymentType;
  status: 'Draft' | 'Posted' | 'Voided';
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  reference_number?: string | null;
  posted_at?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  location_id?: string | null;
  location_code?: string | null;
  location_name?: string | null;
  supplier_id: string;
  supplier_code?: string | null;
  supplier_name: string;
  supplier_invoice_number?: string | null;
  line_count: number;
}

export interface AddLineDraft {
  itemId: string;
  quantity: string;
  purchasePrice: string;
  discountAmount: string;
  taxAmount: string;
  description: string;
}
