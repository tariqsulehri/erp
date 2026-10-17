'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useDefaultPostingDate } from '@/lib/api/fiscal-years';
import { AppHeader } from '@/components/shell/AppHeader';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { resolveRoute } from '@/components/shell/nav-config';

const COLLAPSED_KEY = 'erp-sidebar-collapsed';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const route = resolveRoute(pathname);
  const postingAvailability = useDefaultPostingDate('Posting Date', status === 'authenticated');
  const postingDisabled = status === 'authenticated' && postingAvailability.disabled;
  const postingReason = postingAvailability.statusMessage || 'Posting is not available.';

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1'); } catch { /* storage unavailable */ }
  }, []);

  // The mobile drawer closes whenever the page changes.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [drawerOpen]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  function setCollapsedAndRemember(value: boolean) {
    setCollapsed(value);
    try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  if (status === 'loading') {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)' }}>Loading Workspace…</p>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as { name?: string; email?: string; role?: string };

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      <AppSidebar
        activeHref={route?.item.href}
        activeGroupKey={route?.group?.key}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsedAndRemember(!collapsed)}
        onExpand={() => setCollapsedAndRemember(false)}
        postingDisabled={postingDisabled}
        postingReason={postingReason}
      />
      <button type="button" className="sidebar-backdrop" aria-label="Close Menu" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} />

      <div className="main-content">
        <AppHeader
          groupLabel={route?.group?.label}
          pageLabel={route?.item.label ?? 'Dashboard'}
          user={user}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
