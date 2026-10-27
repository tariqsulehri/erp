'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { PostedListFilters } from '@/components/documents';
import { PURCHASE_STATUS_OPTIONS } from '../PurchaseVoucherHelpers';
import type { SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

interface PostedPurchasesFiltersProps {
  search: string;
  status: string;
  supplierId: string;
  paymentType: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  onStatusChange: (value: string) => void;
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
  status,
  supplierId,
  paymentType,
  warehouseId,
  dateFrom,
  dateTo,
  amountFrom,
  amountTo,
  suppliers,
  warehouses,
  onStatusChange,
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
    <PostedListFilters label="Purchase Filters">
      <TextField
        label="Search"
        value={search}
        onChange={onSearchChange}
        placeholder="Purchase No., Bill No., Supplier, Reference"
        inputProps={{ onKeyDown: event => { if (event.key === 'Enter') onSearchSubmit(); } }}
      />
      <Button variant="secondary" onClick={onSearchSubmit} loading={loading}>Search</Button>
      <Button variant="ghost" onClick={onSearchClear} disabled={loading || (!search && !searchApplied)}>Clear</Button>
      <SelectField
        label="Status"
        value={status}
        onChange={onStatusChange}
        options={PURCHASE_STATUS_OPTIONS}
        placeholder="All Statuses"
      />
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
      <Button variant="ghost" onClick={onResetFilters}>Clear Filters</Button>
    </PostedListFilters>
  );
}
