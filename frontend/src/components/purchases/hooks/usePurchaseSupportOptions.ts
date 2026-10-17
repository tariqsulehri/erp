import { useMemo } from 'react';
import type { ItemOption, LocationOption, SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

interface PurchaseSupportData {
  suppliers?: any[];
  items?: any[];
  warehouses?: any[];
  locations?: any[];
}

export function usePurchaseSupportOptions(supportData?: PurchaseSupportData) {
  const suppliers = useMemo<SupplierOption[]>(() => {
    return (supportData?.suppliers ?? []).map((supplier: any) => ({
      value: supplier.id,
      label: `${supplier.code} - ${supplier.name}`,
      searchText: `${supplier.code} ${supplier.name} ${supplier.account_code ?? ''}`,
      paymentTermsDays: Number(supplier.payment_terms_days ?? 0),
      accountCode: supplier.account_code,
    }));
  }, [supportData]);

  const items = useMemo<ItemOption[]>(() => {
    return (supportData?.items ?? []).map((item: any) => ({
      value: item.id,
      label: `${item.item_code} - ${item.item_name}`,
      searchText: `${item.item_code} ${item.item_name}`,
      itemCode: item.item_code,
      itemName: item.item_name,
      purchasePrice: String(item.purchase_price ?? '0'),
      taxRate: String(item.tax_rate ?? '0'),
      uomName: item.uom_name,
      defaultWarehouseId: item.default_warehouse_id,
      stockOnHand: String(item.stock_on_hand ?? '0'),
    }));
  }, [supportData]);

  const warehouses = useMemo<WarehouseOption[]>(() => {
    return (supportData?.warehouses ?? []).map((warehouse: any) => ({
      value: warehouse.id,
      label: `${warehouse.code} - ${warehouse.name}`,
      searchText: `${warehouse.code} ${warehouse.name}`,
      isDefault: Boolean(warehouse.is_default),
      useLocations: Boolean(warehouse.use_locations),
    }));
  }, [supportData]);

  const locations = useMemo<LocationOption[]>(() => {
    return (supportData?.locations ?? []).map((location: any) => ({
      value: location.id,
      label: `${location.code} - ${location.name}`,
      searchText: `${location.code} ${location.name}`,
      warehouseId: location.warehouse_id,
      isDefault: Boolean(location.is_default),
    }));
  }, [supportData]);

  return { suppliers, items, warehouses, locations };
}
