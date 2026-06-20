'use client';

import type { ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import {
  IconAdjustmentsHorizontal,
  IconBuildingBank,
  IconCalendarStats,
  IconCategory2,
  IconChevronDown,
  IconCube,
  IconDashboard,
  IconFileAnalytics,
  IconFileInvoice,
  IconHomeDollar,
  IconLogout2,
  IconPackage,
  IconReceipt,
  IconRulerMeasure,
  IconScale,
  IconTruckDelivery,
  IconUsersGroup,
  IconWallet,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

const iconProps = { size: 18, stroke: 1.8 } as const;
const smallIconProps = { size: 15, stroke: 1.9 } as const;

type SidebarChild =
  | { label: string; section: true }
  | {
      label: string;
      href: string;
      icon: TablerIcon;
      color: string;
      code: string;
      moduleKey: string;
      featureKey: string;
      permissionKey: string;
    };

/* ── Voucher sub-menu items ──────────────────────────────────────────────── */
const VOUCHER_ITEMS = [
  { label: 'Bank Receipt',  href: '/vouchers/bank-receipt',  icon: IconBuildingBank, color: '#15803d', code: 'BRV', moduleKey: 'finance', featureKey: 'bank-receipt', permissionKey: 'finance.vouchers.bank_receipt.view' },
  { label: 'Bank Payment',  href: '/vouchers/bank-payment',  icon: IconBuildingBank, color: '#b91c1c', code: 'BPV', moduleKey: 'finance', featureKey: 'bank-payment', permissionKey: 'finance.vouchers.bank_payment.view' },
  { label: 'Cash Receipt',  href: '/vouchers/cash-receipt',  icon: IconWallet,       color: '#0891b2', code: 'CRV', moduleKey: 'finance', featureKey: 'cash-receipt', permissionKey: 'finance.vouchers.cash_receipt.view' },
  { label: 'Cash Payment',  href: '/vouchers/cash-payment',  icon: IconWallet,       color: '#d97706', code: 'CPV', moduleKey: 'finance', featureKey: 'cash-payment', permissionKey: 'finance.vouchers.cash_payment.view' },
  { label: 'Journal Entry', href: '/vouchers/journal',       icon: IconFileInvoice,  color: '#1d4ed8', code: 'JV',  moduleKey: 'finance', featureKey: 'journal-entry', permissionKey: 'finance.vouchers.journal_entry.view' },
] satisfies readonly SidebarChild[];

/* ── Inventory sub-menu items ────────────────────────────────────────────── */
const INVENTORY_ITEMS = [
  { label: 'Products',          href: '/inventory/products',   icon: IconPackage,     color: '#1d4ed8', code: 'PRD', moduleKey: 'inventory', featureKey: 'products', permissionKey: 'inventory.products.view' },
  { label: 'Categories',        href: '/inventory/categories', icon: IconCategory2,   color: '#0891b2', code: 'CAT', moduleKey: 'inventory', featureKey: 'categories', permissionKey: 'inventory.categories.view' },
  { label: 'Units of Measure',  href: '/inventory/uom',        icon: IconRulerMeasure,color: '#15803d', code: 'UOM', moduleKey: 'inventory', featureKey: 'units-of-measure', permissionKey: 'inventory.units_of_measure.view' },
] satisfies readonly SidebarChild[];

/* ── AR sub-menu items ───────────────────────────────────────────────────── */
const AR_ITEMS = [
  { label: 'Master Data', section: true },
  { label: 'Customers', href: '/ar/customers', icon: IconUsersGroup, color: '#1d4ed8', code: 'CUS', moduleKey: 'receivables', featureKey: 'customers', permissionKey: 'receivables.customers.view' },
] satisfies readonly SidebarChild[];

/* ── AP sub-menu items ───────────────────────────────────────────────────── */
const AP_ITEMS = [
  { label: 'Master Data', section: true },
  { label: 'Suppliers', href: '/ap/suppliers', icon: IconTruckDelivery, color: '#0891b2', code: 'SUP', moduleKey: 'payables', featureKey: 'suppliers', permissionKey: 'payables.suppliers.view' },
  { label: 'Transactions', section: true },
  { label: 'Purchase Voucher', href: '/ap/purchases', icon: IconFileInvoice, color: '#1d4ed8', code: 'PI', moduleKey: 'payables', featureKey: 'purchase-voucher', permissionKey: 'payables.purchase_voucher.view' },
] satisfies readonly SidebarChild[];

/* ── NAV definition ──────────────────────────────────────────────────────── */
const NAV = [
  { label: 'Overview',           section: true },
  { label: 'Dashboard',          href: '/dashboard',   icon: IconDashboard },
  { label: 'Finance',            section: true },
  { label: 'Accounts',           href: '/accounts',    icon: IconScale },
  { label: 'Fiscal Year',        href: '/fiscal-year', icon: IconCalendarStats },
  { label: 'Vouchers',           href: '/vouchers',    icon: IconReceipt,  hasChildren: true, childKey: 'vouchers' },
  { label: 'Bank',               href: '/bank',        icon: IconBuildingBank },
  { label: 'Inventory',          section: true },
  { label: 'Inventory',          href: '/inventory',   icon: IconCube, hasChildren: true, childKey: 'inventory' },
  { label: 'Receivables (AR)',   section: true },
  { label: 'Receivables',        href: '/ar',          icon: IconUsersGroup, hasChildren: true, childKey: 'ar' },
  { label: 'Payables (AP)',      section: true },
  { label: 'Payables',           href: '/ap',          icon: IconTruckDelivery, hasChildren: true, childKey: 'ap' },
  { label: 'Reports',            section: true },
  { label: 'Reports',            href: '/reports',     icon: IconFileAnalytics },
  { label: 'System',             section: true },
  { label: 'Settings',           href: '/settings',    icon: IconAdjustmentsHorizontal },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  /* Keep sub-menus open when on their routes */
  const isVoucherRoute   = pathname.startsWith('/vouchers');
  const isInventoryRoute = pathname.startsWith('/inventory');
  const isARRoute        = pathname.startsWith('/ar');
  const isAPRoute        = pathname.startsWith('/ap');
  const [vouchersOpen,  setVouchersOpen]  = useState(isVoucherRoute);
  const [inventoryOpen, setInventoryOpen] = useState(isInventoryRoute);
  const [arOpen,        setArOpen]        = useState(isARRoute);
  const [apOpen,        setApOpen]        = useState(isAPRoute);

  useEffect(() => { if (isVoucherRoute)   setVouchersOpen(true);  }, [isVoucherRoute]);
  useEffect(() => { if (isInventoryRoute) setInventoryOpen(true); }, [isInventoryRoute]);
  useEffect(() => { if (isARRoute)        setArOpen(true);        }, [isARRoute]);
  useEffect(() => { if (isAPRoute)        setApOpen(true);        }, [isAPRoute]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const user     = session.user as { name?: string; email?: string; role?: string };
  const initials = (user.name || user.email || 'U').slice(0, 2).toUpperCase();

  /* Breadcrumb: resolve friendly name */
  function currentPageLabel() {
    const vItem = VOUCHER_ITEMS.find(v => pathname.startsWith(v.href));
    if (vItem) return vItem.label;
    const iItem = INVENTORY_ITEMS.find(i => pathname.startsWith(i.href));
    if (iItem) return iItem.label;
    const arItem = AR_ITEMS.find(a => !('section' in a) && pathname.startsWith(a.href));
    if (arItem) return arItem.label;
    const apItem = AP_ITEMS.find(a => !('section' in a) && pathname.startsWith(a.href));
    if (apItem) return apItem.label;
    const nav = NAV.find(n => !n.section && n.href && pathname.startsWith(n.href));
    return nav?.label ?? 'Dashboard';
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <IconHomeDollar size={21} stroke={1.9} />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">ERP Finance</span>
            <span className="sidebar-logo-sub">Financial Module</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section-label">{item.label}</div>;
            }

            /* Collapsible sub-menu parents (Vouchers, Inventory, AR, AP) */
            if (item.hasChildren) {
              const childKey    = item.childKey!;
              const isVouchers  = childKey === 'vouchers';
              const isInventory = childKey === 'inventory';
              const isAR        = childKey === 'ar';
              const isAP        = childKey === 'ap';
              const subItems    = isVouchers  ? VOUCHER_ITEMS
                                : isInventory ? INVENTORY_ITEMS
                                : isAR        ? AR_ITEMS
                                :               AP_ITEMS;
              const isOpen      = isVouchers  ? vouchersOpen
                                : isInventory ? inventoryOpen
                                : isAR        ? arOpen
                                :               apOpen;
              const toggleOpen  = isVouchers  ? () => setVouchersOpen(o => !o)
                                : isInventory ? () => setInventoryOpen(o => !o)
                                : isAR        ? () => setArOpen(o => !o)
                                :               () => setApOpen(o => !o);
              const isParentActive = isVouchers  ? pathname.startsWith('/vouchers')
                                   : isInventory ? pathname.startsWith('/inventory')
                                   : isAR        ? pathname.startsWith('/ar')
                                   :               pathname.startsWith('/ap');

              return (
                <div key={childKey}>
                  {/* Parent row */}
                  <button
                    className={`nav-item${isParentActive ? ' active' : ''}`}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onClick={toggleOpen}
                  >
                    <span className="nav-item-icon">
                      <item.icon {...iconProps} />
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{
                      transition: 'transform 0.2s',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      opacity: 0.6, display: 'flex',
                    }}>
                      <IconChevronDown size={13} stroke={2} />
                    </span>
                  </button>

                  {/* Sub-menu */}
                  {isOpen && (
                    <div style={{
                      marginLeft: 14,
                      borderLeft: '2px solid var(--color-border)',
                      paddingLeft: 2,
                    }}>
                      {(subItems as readonly SidebarChild[]).map(sub => {
                        if ('section' in sub) {
                          return (
                            <div
                              key={sub.label}
                              style={{
                                padding: '7px 10px 3px',
                                color: 'var(--color-text-light)',
                                fontSize: '0.62rem',
                                fontWeight: 900,
                                letterSpacing: 0,
                              }}
                            >
                              {sub.label}
                            </div>
                          );
                        }
                        const subActive = pathname.startsWith(sub.href);
                        const SubIcon = sub.icon;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`nav-item nav-sub-item${subActive ? ' active' : ''}`}
                            data-module={sub.moduleKey}
                            data-feature={sub.featureKey}
                            data-permission={sub.permissionKey}
                            style={{
                              paddingLeft: 10,
                              fontSize: '0.8rem',
                              ...(subActive ? { color: sub.color } : {}),
                            }}
                          >
                            <span className="nav-item-icon" style={{ color: subActive ? sub.color : undefined }}>
                              <SubIcon {...smallIconProps} />
                            </span>
                            <span style={{ flex: 1 }}>{sub.label}</span>
                            <span style={{
                              fontFamily: 'monospace', fontWeight: 800,
                              fontSize: '0.6rem', opacity: 0.65,
                              color: subActive ? sub.color : 'var(--color-text-light)',
                              marginLeft: 2,
                            }}>
                              {sub.code}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            /* Regular nav item */
            const isActive = item.href ? pathname.startsWith(item.href) : false;
            const NavIcon = item.icon!;
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-item-icon">
                  <NavIcon {...iconProps} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item"
            style={{ color: '#f87171' }}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <span className="nav-item-icon"><IconLogout2 {...iconProps} /></span>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <nav className="breadcrumb">
              <span>ERP Finance</span>
              <span className="breadcrumb-sep">/</span>
              {isVoucherRoute && (
                <>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Vouchers</span>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
              {isInventoryRoute && (
                <>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Inventory</span>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
              {isARRoute && (
                <>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Receivables</span>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
              {isAPRoute && (
                <>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Payables</span>
                  <span className="breadcrumb-sep">/</span>
                </>
              )}
              <span className="breadcrumb-current">{currentPageLabel()}</span>
            </nav>
          </div>
          <div className="topbar-right">
            <ThemeSwitcher />
            <div className="topbar-user">
              <span className="topbar-user-name">{user.name || user.email}</span>
              <span className="topbar-user-role">{user.role ?? 'user'}</span>
            </div>
            <div className="topbar-avatar">{initials}</div>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
