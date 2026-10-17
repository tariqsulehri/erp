import {
  IconAdjustmentsHorizontal,
  IconArrowsExchange,
  IconBuildingBank,
  IconBuildingCommunity,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendarStats,
  IconCategory2,
  IconClipboardCheck,
  IconCube,
  IconDashboard,
  IconFileAnalytics,
  IconFileInvoice,
  IconMap,
  IconMapPin,
  IconPackage,
  IconReceipt,
  IconRulerMeasure,
  IconScale,
  IconTruckDelivery,
  IconUsersGroup,
  IconWallet,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

export interface NavLeaf {
  label: string;
  href: string;
  icon: TablerIcon;
  /** Short document code shown beside voucher-type items (JV, BRV…). */
  code?: string;
  moduleKey: string;
  featureKey: string;
  permissionKey: string;
  /** Disabled when no fiscal period is open for posting. */
  requiresPosting?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: TablerIcon;
  items: NavLeaf[];
}

export type NavEntry = { type: 'link'; item: NavLeaf } | { type: 'group'; group: NavGroup };

export interface NavSection {
  label: string;
  entries: NavEntry[];
}

const leaf = (item: NavLeaf): NavEntry => ({ type: 'link', item });
const group = (value: NavGroup): NavEntry => ({ type: 'group', group: value });

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    entries: [
      leaf({ label: 'Dashboard', href: '/dashboard', icon: IconDashboard, moduleKey: 'core', featureKey: 'dashboard', permissionKey: 'core.dashboard.view' }),
    ],
  },
  {
    label: 'Finance',
    entries: [
      group({
        key: 'vouchers',
        label: 'Vouchers',
        icon: IconReceipt,
        items: [
          { label: 'Voucher List', href: '/vouchers/posted', icon: IconFileAnalytics, moduleKey: 'finance', featureKey: 'posted-vouchers', permissionKey: 'finance.vouchers.posted.view' },
          { label: 'Bank Receipt', href: '/vouchers/bank-receipt', icon: IconBuildingBank, code: 'BRV', moduleKey: 'finance', featureKey: 'bank-receipt', permissionKey: 'finance.vouchers.bank_receipt.view', requiresPosting: true },
          { label: 'Bank Payment', href: '/vouchers/bank-payment', icon: IconBuildingBank, code: 'BPV', moduleKey: 'finance', featureKey: 'bank-payment', permissionKey: 'finance.vouchers.bank_payment.view', requiresPosting: true },
          { label: 'Cash Receipt', href: '/vouchers/cash-receipt', icon: IconWallet, code: 'CRV', moduleKey: 'finance', featureKey: 'cash-receipt', permissionKey: 'finance.vouchers.cash_receipt.view', requiresPosting: true },
          { label: 'Cash Payment', href: '/vouchers/cash-payment', icon: IconWallet, code: 'CPV', moduleKey: 'finance', featureKey: 'cash-payment', permissionKey: 'finance.vouchers.cash_payment.view', requiresPosting: true },
          { label: 'Journal Entry', href: '/vouchers/journal', icon: IconFileInvoice, code: 'JV', moduleKey: 'finance', featureKey: 'journal-entry', permissionKey: 'finance.vouchers.journal_entry.view', requiresPosting: true },
        ],
      }),
      leaf({ label: 'Bank', href: '/bank', icon: IconBuildingBank, moduleKey: 'finance', featureKey: 'bank', permissionKey: 'finance.bank.view' }),
      leaf({ label: 'Approvals', href: '/approvals', icon: IconClipboardCheck, moduleKey: 'finance', featureKey: 'approvals', permissionKey: 'finance.approvals.view' }),
    ],
  },
  {
    label: 'Operations',
    entries: [
      group({
        key: 'inventory',
        label: 'Inventory',
        icon: IconCube,
        items: [
          { label: 'Products', href: '/inventory/products', icon: IconPackage, moduleKey: 'inventory', featureKey: 'products', permissionKey: 'inventory.products.view' },
          { label: 'Stock Transfer', href: '/inventory/stock-transfers', icon: IconArrowsExchange, code: 'ST', moduleKey: 'inventory', featureKey: 'stock-transfer', permissionKey: 'inventory.stock_transfer.view', requiresPosting: true },
          { label: 'Stock Adjustment', href: '/inventory/stock-adjustments', icon: IconAdjustmentsHorizontal, code: 'SA', moduleKey: 'inventory', featureKey: 'stock-adjustment', permissionKey: 'inventory.stock_adjustment.view', requiresPosting: true },
        ],
      }),
      group({
        key: 'ar',
        label: 'Receivables',
        icon: IconUsersGroup,
        items: [
          { label: 'Customers', href: '/ar/customers', icon: IconUsersGroup, moduleKey: 'receivables', featureKey: 'customers', permissionKey: 'receivables.customers.view' },
          { label: 'Sale Voucher', href: '/ar/sales', icon: IconFileInvoice, code: 'SI', moduleKey: 'receivables', featureKey: 'sale-voucher', permissionKey: 'receivables.sale_voucher.view', requiresPosting: true },
          { label: 'Sale Return', href: '/ar/sale-returns', icon: IconFileInvoice, code: 'SR', moduleKey: 'receivables', featureKey: 'sale-return', permissionKey: 'receivables.sale_return.view', requiresPosting: true },
        ],
      }),
      group({
        key: 'ap',
        label: 'Payables',
        icon: IconTruckDelivery,
        items: [
          { label: 'Suppliers', href: '/ap/suppliers', icon: IconTruckDelivery, moduleKey: 'payables', featureKey: 'suppliers', permissionKey: 'payables.suppliers.view' },
          { label: 'Purchase Voucher', href: '/ap/purchases', icon: IconFileInvoice, code: 'PI', moduleKey: 'payables', featureKey: 'purchase-voucher', permissionKey: 'payables.purchase_voucher.view', requiresPosting: true },
          { label: 'Purchase Return', href: '/ap/purchase-returns', icon: IconFileInvoice, code: 'PR', moduleKey: 'payables', featureKey: 'purchase-return', permissionKey: 'payables.purchase_return.view', requiresPosting: true },
        ],
      }),
    ],
  },
  {
    label: 'System',
    entries: [
      leaf({ label: 'Reports', href: '/reports', icon: IconFileAnalytics, moduleKey: 'system', featureKey: 'reports', permissionKey: 'system.reports.view' }),
      group({
        key: 'config',
        label: 'Configuration',
        icon: IconAdjustmentsHorizontal,
        items: [
          { label: 'Chart of Accounts', href: '/accounts', icon: IconScale, moduleKey: 'config', featureKey: 'chart-of-accounts', permissionKey: 'config.chart_of_accounts.view' },
          { label: 'Fiscal Year', href: '/fiscal-year', icon: IconCalendarStats, moduleKey: 'config', featureKey: 'fiscal-year', permissionKey: 'config.fiscal_year.view' },
          { label: 'General Settings', href: '/settings', icon: IconAdjustmentsHorizontal, moduleKey: 'config', featureKey: 'settings', permissionKey: 'config.settings.view' },
          { label: 'Branches', href: '/inventory/branches', icon: IconBuildingStore, moduleKey: 'config', featureKey: 'branches', permissionKey: 'config.branches.view' },
          { label: 'Warehouses', href: '/inventory/warehouses', icon: IconBuildingWarehouse, moduleKey: 'config', featureKey: 'warehouses', permissionKey: 'config.warehouses.view' },
          { label: 'Categories', href: '/inventory/categories', icon: IconCategory2, moduleKey: 'config', featureKey: 'inventory-categories', permissionKey: 'config.inventory_categories.view' },
          { label: 'Units of Measure', href: '/inventory/uom', icon: IconRulerMeasure, moduleKey: 'config', featureKey: 'units-of-measure', permissionKey: 'config.units_of_measure.view' },
          { label: 'States', href: '/settings/states', icon: IconMapPin, moduleKey: 'config', featureKey: 'states', permissionKey: 'config.states.view' },
          { label: 'Cities', href: '/settings/cities', icon: IconMap, moduleKey: 'config', featureKey: 'cities', permissionKey: 'config.cities.view' },
          { label: 'Areas', href: '/settings/areas', icon: IconBuildingCommunity, moduleKey: 'config', featureKey: 'areas', permissionKey: 'config.areas.view' },
        ],
      }),
    ],
  },
];

interface ResolvedRoute {
  item: NavLeaf;
  group?: NavGroup;
}

const ALL_ROUTES: ResolvedRoute[] = NAV_SECTIONS.flatMap(section => section.entries.flatMap(entry =>
  entry.type === 'link' ? [{ item: entry.item }] : entry.group.items.map(item => ({ item, group: entry.group })),
));

function routeMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav item a route belongs to: the longest matching href, so /settings/areas selects Areas, not General Settings. */
export function resolveRoute(pathname: string): ResolvedRoute | undefined {
  return ALL_ROUTES
    .filter(route => routeMatches(pathname, route.item.href))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0];
}
