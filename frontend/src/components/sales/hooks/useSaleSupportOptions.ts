import { useMemo } from 'react';
import type { CustomerOption, LocationOption, SaleItemOption, WarehouseOption } from '../SaleVoucherTypes';

interface SaleSupportData {
  customers?: any[];
  items?: any[];
  warehouses?: any[];
  locations?: any[];
}

export function useSaleSupportOptions(supportData?: SaleSupportData) {
  const customers = useMemo<CustomerOption[]>(() => {
    return (supportData?.customers ?? []).map((customer: any) => ({
      value: customer.id,
      label: `${customer.code} - ${customer.name}`,
      searchText: `${customer.code} ${customer.name} ${customer.account_code ?? ''}`,
      paymentTermsDays: Number(customer.payment_terms_days ?? 0),
      accountCode: customer.account_code,
      creditLimit: Number(customer.credit_limit ?? 0),
      currentBalance: Number(customer.current_balance ?? 0),
    }));
  }, [supportData]);

  const items = useMemo<SaleItemOption[]>(() => {
    return (supportData?.items ?? []).map((item: any) => ({
      value: item.id,
      label: `${item.item_code} - ${item.item_name}`,
      searchText: `${item.item_code} ${item.item_name}`,
      itemCode: item.item_code,
      itemName: item.item_name,
      purchasePrice: String(item.sale_price ?? '0'),
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

  return { customers, items, warehouses, locations };
}
