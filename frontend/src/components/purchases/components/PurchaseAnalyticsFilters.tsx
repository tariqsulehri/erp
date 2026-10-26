'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, SelectField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

interface PurchaseAnalyticsFiltersProps {
  supplierId: string;
  paymentType: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  onSupplierChange: (value: string) => void;
  onPaymentTypeChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onResetFilters: () => void;
}

export function PurchaseAnalyticsFilters({
  supplierId,
  paymentType,
  warehouseId,
  dateFrom,
  dateTo,
  suppliers,
  warehouses,
  onSupplierChange,
  onPaymentTypeChange,
  onWarehouseChange,
  onDateFromChange,
  onDateToChange,
  onResetFilters,
}: PurchaseAnalyticsFiltersProps) {
  return (
    <div className="filter-grid">
      <FieldLabel label="Supplier">
        <SearchableSelect value={supplierId} options={suppliers} onChange={onSupplierChange} placeholder="All Suppliers" />
      </FieldLabel>
      <SelectField
        label="Payment Type"
        value={paymentType}
        onChange={onPaymentTypeChange}
        options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]}
        placeholder="All Types"
      />
      <FieldLabel label="Warehouse">
        <SearchableSelect value={warehouseId} options={warehouses} onChange={onWarehouseChange} placeholder="All Warehouses" />
      </FieldLabel>
      <DateField label="Date From" value={dateFrom} onChange={onDateFromChange} />
      <DateField label="Date To" value={dateTo} onChange={onDateToChange} />
      <button type="button" className="btn-secondary" onClick={onResetFilters} style={{ flex: '0 0 auto', minWidth: 0 }}>
        Clear Filters
      </button>
    </div>
  );
}
