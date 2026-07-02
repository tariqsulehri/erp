'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { compactButtonStyle, purchaseFilterGridStyle } from '../PurchaseVoucherStyles';
import type { SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

interface PostedPurchasesFiltersProps {
  search: string;
  supplierId: string;
  paymentType: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  searchApplied: boolean;
  loading?: boolean;
  onSupplierChange: (value: string) => void;
  onPaymentTypeChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onAmountFromChange: (value: string) => void;
  onAmountToChange: (value: string) => void;
  onResetFilters: () => void;
}

export function PostedPurchasesFilters({
  search,
  supplierId,
  paymentType,
  warehouseId,
  dateFrom,
  dateTo,
  amountFrom,
  amountTo,
  suppliers,
  warehouses,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  searchApplied,
  loading = false,
  onSupplierChange,
  onPaymentTypeChange,
  onWarehouseChange,
  onDateFromChange,
  onDateToChange,
  onAmountFromChange,
  onAmountToChange,
  onResetFilters,
}: PostedPurchasesFiltersProps) {
  return (
    <div style={{ ...purchaseFilterGridStyle, gridTemplateColumns: 'minmax(220px, 1.4fr) 84px 76px minmax(180px, 1fr) 120px minmax(150px, 1fr) 115px 115px 110px 110px 110px' }}>
      <TextField
        label="Search"
        value={search}
        onChange={onSearchChange}
        placeholder="Purchase No., Bill No., Supplier, Reference"
        inputProps={{ onKeyDown: event => { if (event.key === 'Enter') onSearchSubmit(); } }}
      />
      <button type="button" className="btn-secondary" onClick={onSearchSubmit} disabled={loading} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
        {loading && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
        {loading ? 'Searching...' : 'Search'}
      </button>
      <button type="button" className="btn-secondary" onClick={onSearchClear} disabled={loading || (!search && !searchApplied)} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
        Clear
      </button>
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
      <NumericField label="Amount From" value={amountFrom} onChange={onAmountFromChange} />
      <NumericField label="Amount To" value={amountTo} onChange={onAmountToChange} />
      <button type="button" className="btn-secondary" onClick={onResetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
        Clear Filters
      </button>
    </div>
  );
}
