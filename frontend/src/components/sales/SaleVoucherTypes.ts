import type { SelectOption } from '@/components/ui/SearchableSelect';
import type { PaymentType, PurchaseLine } from '@/components/purchases/PurchaseVoucherTypes';

export type SalePaymentType = PaymentType;
export type SaleMessageKind = 'success' | 'error';

export interface CustomerOption extends SelectOption {
  paymentTermsDays: number;
  accountCode?: string | null;
  creditLimit: number;
  currentBalance: number;
}

export interface SaleItemOption extends SelectOption {
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

export type SaleLine = PurchaseLine;

export interface SaleListRow {
  id: string;
  sale_number: string;
  sale_date: string;
  delivery_date?: string | null;
  due_date?: string | null;
  payment_type: SalePaymentType;
  status: 'Draft' | 'Posted' | 'Voided';
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  customer_reference_number?: string | null;
  delivery_note_number?: string | null;
  posted_at?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  location_id?: string | null;
  location_code?: string | null;
  location_name?: string | null;
  customer_id: string;
  customer_code?: string | null;
  customer_name: string;
  line_count: number;
}
