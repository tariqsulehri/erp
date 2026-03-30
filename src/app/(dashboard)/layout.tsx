'use client';

import type { ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS: Record<string, string> = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  accounts:  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  vouchers:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  bank:      'M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM8 9V7a4 4 0 018 0v2',
  reports:   'M18 20V10M12 20V4M6 20v-6',
  fiscal:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  logout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

const NAV = [
  { label: 'Overview',   section: true },
  { label: 'Dashboard',   href: '/dashboard',   icon: 'dashboard' },
  { label: 'Finance',    section: true },
  { label: 'Accounts',    href: '/accounts',    icon: 'accounts' },
  { label: 'Fiscal Year', href: '/fiscal-year', icon: 'fiscal' },
  { label: 'Vouchers',    href: '/vouchers',    icon: 'vouchers' },
  { label: 'Bank',        href: '/bank',        icon: 'bank' },
  { label: 'Reports',    section: true },
  { label: 'Reports',     href: '/reports',     icon: 'reports' },
  { label: 'System',     section: true },
  { label: 'Settings',    href: '/settings',    icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as { name?: string; email?: string; role?: string };
  const initials = (user.name || user.email || 'U').slice(0, 2).toUpperCase();
  const currentPage = NAV.find((n) => !n.section && n.href && pathname.startsWith(n.href))?.label ?? 'Dashboard';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="4" rx="1" fill="white" />
              <rect x="3" y="9" width="11" height="4" rx="1" fill="white" opacity="0.75" />
              <rect x="3" y="15" width="14" height="4" rx="1" fill="white" opacity="0.5" />
            </svg>
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
            const isActive = item.href ? pathname.startsWith(item.href) : false;
            return (
              <Link key={item.href} href={item.href!} className={`nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-item-icon">
                  <Icon d={ICONS[item.icon!]} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" style={{ color: '#f87171' }} onClick={() => signOut({ callbackUrl: '/login' })}>
            <span className="nav-item-icon"><Icon d={ICONS.logout} /></span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <nav className="breadcrumb">
              <span>ERP Finance</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{currentPage}</span>
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
