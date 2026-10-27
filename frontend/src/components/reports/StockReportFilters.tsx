'use client';

import { useMemo, useState } from 'react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { SelectField } from '@/components/ui/FormFields';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { useStockAdjustmentSupportData } from '@/lib/api/stock-adjustments';
import { friendlyErrorMessage } from '@/lib/erp-utils';

export type StockPlaceType = 'ALL' | 'BRANCH' | 'WAREHOUSE';

/**
 * Items, Branches and Warehouses for the stock report pickers. The backend already limits Branch and
 * Warehouse users to their own place, so the lists only hold what the user may see.
 */
export function useStockReportOptions() {
  const supportQuery = useStockAdjustmentSupportData();
  const data = supportQuery.data;

  const items = useMemo<SelectOption[]>(() => (data?.items ?? []).map((item: any) => ({
    value: item.id,
    label: `${item.item_code} - ${item.item_name}`,
    searchText: `${item.item_code} ${item.item_name}`,
  })), [data?.items]);
  const branches = useMemo<SelectOption[]>(() => (data?.branches ?? []).map((branch: any) => ({
    value: branch.id,
    label: branch.city ? `${branch.code} - ${branch.name} (${branch.city})` : `${branch.code} - ${branch.name}`,
    searchText: `${branch.code} ${branch.name} ${branch.city ?? ''}`,
  })), [data?.branches]);
  const warehouses = useMemo<SelectOption[]>(() => (data?.warehouses ?? []).map((warehouse: any) => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}`,
    searchText: `${warehouse.code} ${warehouse.name}`,
  })), [data?.warehouses]);

  return {
    items,
    branches,
    warehouses,
    isLoading: supportQuery.isLoading,
    errorMessage: supportQuery.error ? friendlyErrorMessage(supportQuery.error, 'Could not load Items, Branches and Warehouses. Please try again.') : '',
  };
}

/** Place Type and the chosen Branch or Warehouse, turned into the `branch_id` / `warehouse_id` query filter. */
export function useStockPlaceFilter() {
  const [placeType, setPlaceType] = useState<StockPlaceType>('ALL');
  const [placeId, setPlaceId] = useState('');

  const query = useMemo(() => {
    if (placeType === 'BRANCH' && placeId) return { branch_id: placeId };
    if (placeType === 'WAREHOUSE' && placeId) return { warehouse_id: placeId };
    return {};
  }, [placeType, placeId]);

  function validate() {
    if (placeType === 'BRANCH' && !placeId) return 'Select a Branch, or set Place Type to All Places.';
    if (placeType === 'WAREHOUSE' && !placeId) return 'Select a Warehouse, or set Place Type to All Places.';
    return '';
  }

  return { placeType, setPlaceType, placeId, setPlaceId, query, validate };
}

/** Readable name of the chosen place, for report subtitles. */
export function placeFilterLabel(placeType: StockPlaceType, placeId: string, branches: SelectOption[], warehouses: SelectOption[]) {
  if (placeType === 'BRANCH') return branches.find(option => option.value === placeId)?.label ?? 'Branch';
  if (placeType === 'WAREHOUSE') return warehouses.find(option => option.value === placeId)?.label ?? 'Warehouse';
  return 'All Places';
}

interface StockPlaceFieldsProps {
  placeType: StockPlaceType;
  placeId: string;
  branches: SelectOption[];
  warehouses: SelectOption[];
  loading: boolean;
  onPlaceTypeChange: (value: StockPlaceType) => void;
  onPlaceIdChange: (value: string) => void;
}

/** Place Type (All Places / Branch / Warehouse) plus a searchable picker for the chosen Branch or Warehouse. */
export function StockPlaceFields({ placeType, placeId, branches, warehouses, loading, onPlaceTypeChange, onPlaceIdChange }: StockPlaceFieldsProps) {
  const placeTypeOptions = [
    { value: 'ALL', label: 'All Places' },
    { value: 'BRANCH', label: 'Branch', disabled: !loading && branches.length === 0 },
    { value: 'WAREHOUSE', label: 'Warehouse', disabled: !loading && warehouses.length === 0 },
  ];
  const placeOptions = placeType === 'BRANCH' ? branches : placeType === 'WAREHOUSE' ? warehouses : [];
  const placeLabel = placeType === 'WAREHOUSE' ? 'Warehouse' : 'Branch';

  return (
    <>
      <SelectField
        label="Place Type"
        value={placeType}
        options={placeTypeOptions}
        onChange={value => {
          onPlaceTypeChange(value as StockPlaceType);
          onPlaceIdChange('');
        }}
      />
      <FieldLabel label={placeType === 'ALL' ? 'Place' : placeLabel} required={placeType !== 'ALL'}>
        <SearchableSelect
          value={placeId}
          options={placeOptions}
          onChange={onPlaceIdChange}
          placeholder={placeType === 'ALL' ? 'All Places' : loading ? 'Loading…' : `Search ${placeLabel}`}
          disabled={placeType === 'ALL' || loading}
          ariaLabel={placeType === 'ALL' ? 'Place' : placeLabel}
        />
      </FieldLabel>
    </>
  );
}
