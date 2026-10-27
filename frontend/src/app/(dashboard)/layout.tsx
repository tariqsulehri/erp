'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useDefaultPostingDate } from '@/lib/api/fiscal-years';
import { AppHeader } from '@/components/shell/AppHeader';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { ModuleTabs } from '@/components/shell/ModuleTabs';
import { navSectionsFor, resolveRoute } from '@/components/shell/nav-config';
import { canManageUsers } from '@/lib/auth/session-user';
import { LoadingScreen } from '@/components/ui/LoadingSpinner';

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
    return <LoadingScreen message="Loading Workspace…" description="Verifying credentials and access permissions" fullScreen />;
  }

  if (!session) return null;

  const user = session.user;
  const sections = navSectionsFor({ canManageUsers: canManageUsers(user.role), accessLevel: user.accessLevel, role: user.role });
  // The current page's group as this user sees it (pages they cannot open are left out of the tabs).
  const visibleGroup = route?.group
    ? sections.flatMap(section => section.entries).find(entry => entry.type === 'group' && entry.group.key === route.group?.key)
    : undefined;
  const tabGroup = visibleGroup?.type === 'group' && visibleGroup.group.items.length > 1 ? visibleGroup.group : undefined;

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      <AppSidebar
        sections={sections}
        activeHref={route?.item.href}
        activeGroupKey={route?.group?.key}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsedAndRemember(!collapsed)}
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
        <main className="page">
          {tabGroup && <ModuleTabs group={tabGroup} activeHref={route?.item.href} postingDisabled={postingDisabled} postingReason={postingReason} />}
          {children}
        </main>
      </div>
    </div>
  );
}
