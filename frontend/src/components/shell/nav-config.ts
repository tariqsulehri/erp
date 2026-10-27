import {
  IconAdjustmentsHorizontal,
  IconArrowsExchange,
  IconBuildingBank,
  IconBuildingCommunity,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendarStats,
  IconCategory2,
  IconChartBar,
  IconClipboardCheck,
  IconColorFilter,
  IconCube,
  IconDashboard,
  IconFileAnalytics,
  IconFileInvoice,
  IconLayersLinked,
  IconMap,
  IconMapPin,
  IconPackage,
  IconPackageImport,
  IconPalette,
  IconReceipt,
  IconRuler2,
  IconRulerMeasure,
  IconScale,
  IconTag,
  IconTruckDelivery,
  IconUserShield,
  IconUsersGroup,
  IconWallet,
  IconWorld,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import { hasPermission, type AccessLevel, type Permission } from '@/lib/auth/session-user';

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
  /** Shown only to users who can manage users (Admin and Top Management). */
  userManagersOnly?: boolean;
  /** Shown only to users with one of these access levels; omitted means everyone. */
  accessLevels?: AccessLevel[];
  /** Shown only to roles with this permission; omitted means every role. */
  permission?: Permission;
  /** Temporarily hidden from navigation menus and tab bars without removing the route. */
  hidden?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: TablerIcon;
  items: NavLeaf[];
  /** Shows the pages as numbered steps (in the page tabs), in the order they are set up. */
  numbered?: boolean;
}

export type NavEntry = { type: 'link'; item: NavLeaf } | { type: 'group'; group: NavGroup };

export interface NavSection {
  label: string;
  entries: NavEntry[];
}

// Sales happen only at a Branch; purchases are received only at a Warehouse.
const SELLING_ACCESS: AccessLevel[] = ['ALL_BRANCHES', 'BRANCH'];
const PURCHASING_ACCESS: AccessLevel[] = ['ALL_BRANCHES', 'WAREHOUSE'];

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
          { label: 'Overview', href: '/vouchers/overview', icon: IconChartBar, moduleKey: 'finance', featureKey: 'vouchers-overview', permissionKey: 'finance.vouchers.posted.view' },
          { label: 'Voucher List', href: '/vouchers/posted', icon: IconFileAnalytics, moduleKey: 'finance', featureKey: 'posted-vouchers', permissionKey: 'finance.vouchers.posted.view' },
          { label: 'Bank Receipt', href: '/vouchers/bank-receipt', icon: IconBuildingBank, code: 'BRV', moduleKey: 'finance', featureKey: 'bank-receipt', permissionKey: 'finance.vouchers.bank_receipt.view', requiresPosting: true, permission: 'vouchers.edit' },
          { label: 'Bank Payment', href: '/vouchers/bank-payment', icon: IconBuildingBank, code: 'BPV', moduleKey: 'finance', featureKey: 'bank-payment', permissionKey: 'finance.vouchers.bank_payment.view', requiresPosting: true, permission: 'vouchers.edit' },
          { label: 'Cash Receipt', href: '/vouchers/cash-receipt', icon: IconWallet, code: 'CRV', moduleKey: 'finance', featureKey: 'cash-receipt', permissionKey: 'finance.vouchers.cash_receipt.view', requiresPosting: true, permission: 'vouchers.edit' },
          { label: 'Cash Payment', href: '/vouchers/cash-payment', icon: IconWallet, code: 'CPV', moduleKey: 'finance', featureKey: 'cash-payment', permissionKey: 'finance.vouchers.cash_payment.view', requiresPosting: true, permission: 'vouchers.edit' },
          { label: 'Journal Entry', href: '/vouchers/journal', icon: IconFileInvoice, code: 'JV', moduleKey: 'finance', featureKey: 'journal-entry', permissionKey: 'finance.vouchers.journal_entry.view', requiresPosting: true, permission: 'vouchers.edit' },
        ],
      }),
      leaf({ label: 'Bank', href: '/bank', icon: IconBuildingBank, moduleKey: 'finance', featureKey: 'bank', permissionKey: 'finance.bank.view' }),
      leaf({ label: 'Approvals', href: '/approvals', icon: IconClipboardCheck, moduleKey: 'finance', featureKey: 'approvals', permissionKey: 'finance.approvals.view', permission: 'vouchers.approve' }),
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
          { label: 'Overview', href: '/inventory/overview', icon: IconChartBar, moduleKey: 'inventory', featureKey: 'inventory-overview', permissionKey: 'inventory.stock_transfer.view' },
          { label: 'Stock Transfer', href: '/inventory/stock-transfers', icon: IconArrowsExchange, code: 'ST', moduleKey: 'inventory', featureKey: 'stock-transfer', permissionKey: 'inventory.stock_transfer.view', requiresPosting: true },
          { label: 'Stock Received', href: '/inventory/stock-received', icon: IconPackageImport, moduleKey: 'inventory', featureKey: 'stock-received', permissionKey: 'inventory.stock_received.view' },
          { label: 'Stock Adjustment', href: '/inventory/stock-adjustments', icon: IconAdjustmentsHorizontal, code: 'SA', moduleKey: 'inventory', featureKey: 'stock-adjustment', permissionKey: 'inventory.stock_adjustment.view', requiresPosting: true },
        ],
      }),
      group({
        key: 'ar',
        label: 'Receivables',
        icon: IconUsersGroup,
        items: [
          { label: 'Customers', href: '/ar/customers', icon: IconUsersGroup, moduleKey: 'receivables', featureKey: 'customers', permissionKey: 'receivables.customers.view' },
          { label: 'Sale Voucher', href: '/ar/sales', icon: IconFileInvoice, code: 'SI', moduleKey: 'receivables', featureKey: 'sale-voucher', permissionKey: 'receivables.sale_voucher.view', requiresPosting: true, accessLevels: SELLING_ACCESS },
          { label: 'Sale Return', href: '/ar/sale-returns', icon: IconFileInvoice, code: 'SR', moduleKey: 'receivables', featureKey: 'sale-return', permissionKey: 'receivables.sale_return.view', requiresPosting: true, accessLevels: SELLING_ACCESS },
        ],
      }),
      group({
        key: 'ap',
        label: 'Payables',
        icon: IconTruckDelivery,
        items: [
          { label: 'Suppliers', href: '/ap/suppliers', icon: IconTruckDelivery, moduleKey: 'payables', featureKey: 'suppliers', permissionKey: 'payables.suppliers.view' },
          { label: 'Purchase Voucher', href: '/ap/purchases', icon: IconFileInvoice, code: 'PI', moduleKey: 'payables', featureKey: 'purchase-voucher', permissionKey: 'payables.purchase_voucher.view', requiresPosting: true, accessLevels: PURCHASING_ACCESS },
          { label: 'Purchase Return', href: '/ap/purchase-returns', icon: IconFileInvoice, code: 'PR', moduleKey: 'payables', featureKey: 'purchase-return', permissionKey: 'payables.purchase_return.view', requiresPosting: true, accessLevels: PURCHASING_ACCESS },
        ],
      }),
    ],
  },
  {
    label: 'System',
    entries: [
      leaf({ label: 'Reports', href: '/reports', icon: IconFileAnalytics, moduleKey: 'system', featureKey: 'reports', permissionKey: 'system.reports.view' }),
      // Hidden from navigation for now (not removed)
      leaf({ label: 'Design System', href: '/design-system', icon: IconPalette, moduleKey: 'system', featureKey: 'design-system', permissionKey: 'system.design_system.view', userManagersOnly: true, hidden: true }),
      group({
        key: 'config-company',
        label: 'Company & Finance',
        icon: IconBuildingBank,
        numbered: true,
        items: [
          { label: 'General Settings', href: '/settings', icon: IconAdjustmentsHorizontal, moduleKey: 'config', featureKey: 'settings', permissionKey: 'config.settings.view' },
          { label: 'Fiscal Year', href: '/fiscal-year', icon: IconCalendarStats, moduleKey: 'config', featureKey: 'fiscal-year', permissionKey: 'config.fiscal_year.view' },
          { label: 'Chart of Accounts', href: '/accounts', icon: IconScale, moduleKey: 'config', featureKey: 'chart-of-accounts', permissionKey: 'config.chart_of_accounts.view' },
        ],
      }),
      group({
        key: 'config-facilities',
        label: 'Places & Facilities',
        icon: IconBuildingWarehouse,
        numbered: true,
        items: [
          { label: 'Branches', href: '/inventory/branches', icon: IconBuildingStore, moduleKey: 'config', featureKey: 'branches', permissionKey: 'config.branches.view' },
          { label: 'Warehouses', href: '/inventory/warehouses', icon: IconBuildingWarehouse, moduleKey: 'config', featureKey: 'warehouses', permissionKey: 'config.warehouses.view' },
          { label: 'States', href: '/settings/states', icon: IconMapPin, moduleKey: 'config', featureKey: 'states', permissionKey: 'config.states.view' },
          { label: 'Cities', href: '/settings/cities', icon: IconMap, moduleKey: 'config', featureKey: 'cities', permissionKey: 'config.cities.view' },
          { label: 'Areas', href: '/settings/areas', icon: IconBuildingCommunity, moduleKey: 'config', featureKey: 'areas', permissionKey: 'config.areas.view' },
        ],
      }),
      group({
        key: 'config-item-masters',
        label: 'Product Management',
        icon: IconPackage,
        numbered: true,
        items: [
          { label: 'Products', href: '/inventory/products', icon: IconPackage, moduleKey: 'system', featureKey: 'products', permissionKey: 'inventory.products.view' },
          { label: 'Categories', href: '/inventory/categories', icon: IconCategory2, moduleKey: 'config', featureKey: 'inventory-categories', permissionKey: 'config.inventory_categories.view' },
          { label: 'Brands', href: '/inventory/brands', icon: IconTag, moduleKey: 'config', featureKey: 'brands', permissionKey: 'config.brands.view' },
          { label: 'Product Types', href: '/inventory/product-types', icon: IconLayersLinked, moduleKey: 'config', featureKey: 'product-types', permissionKey: 'config.product_types.view' },
          { label: 'Sizes', href: '/inventory/sizes', icon: IconRuler2, moduleKey: 'config', featureKey: 'sizes', permissionKey: 'config.sizes.view' },
          { label: 'Colors', href: '/inventory/colors', icon: IconColorFilter, moduleKey: 'config', featureKey: 'colors', permissionKey: 'config.colors.view' },
          { label: 'Origins', href: '/inventory/origins', icon: IconWorld, moduleKey: 'config', featureKey: 'origins', permissionKey: 'config.origins.view' },
          { label: 'Units of Measure', href: '/inventory/uom', icon: IconRulerMeasure, moduleKey: 'config', featureKey: 'units-of-measure', permissionKey: 'config.units_of_measure.view' },
        ],
      }),
      leaf({
        label: 'Users',
        href: '/settings/users',
        icon: IconUserShield,
        moduleKey: 'config',
        featureKey: 'users',
        permissionKey: 'config.users.view',
        userManagersOnly: true,
      }),
    ],
  },
];

/**
 * The menu for this user: items limited to user managers are removed for everyone else, items
 * limited to some access levels (Branch / Warehouse / All Branches) are removed for the others, and
 * items that need a permission are removed for roles without it.
 */
export function navSectionsFor({ canManageUsers, accessLevel, role }: { canManageUsers: boolean; accessLevel?: AccessLevel; role?: string }): NavSection[] {
  const visible = (item: NavLeaf) =>
    !item.hidden
    && (canManageUsers || !item.userManagersOnly)
    && (!item.permission || hasPermission(role, item.permission))
    && (!item.accessLevels || !accessLevel || item.accessLevels.includes(accessLevel));
  return NAV_SECTIONS
    .map(section => ({
      ...section,
      entries: section.entries
        .map(entry => (entry.type === 'group'
          ? { ...entry, group: { ...entry.group, items: entry.group.items.filter(visible) } }
          : entry))
        .filter(entry => (entry.type === 'link' ? visible(entry.item) : entry.group.items.length > 0)),
    }))
    .filter(section => section.entries.length > 0);
}

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
