'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { IconBuildingSkyscraper, IconBuildingStore, IconBuildingWarehouse, IconCheck, IconChevronDown, IconChevronRight, IconLogout2, IconMenu2, IconMoon, IconSparkles, IconSun } from '@tabler/icons-react';
import { THEMES, useTheme } from '@/lib/theme/theme-provider';
import { Button } from '@/components/ui/Button';
import type { Session } from 'next-auth';
import { roleLabel, workplaceLabel } from '@/lib/auth/session-user';

type HeaderUser = Session['user'];

export function AppHeader({ groupLabel, pageLabel, user, onOpenMenu }: {
  groupLabel?: string;
  pageLabel: string;
  user: HeaderUser;
  onOpenMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Button variant="ghost" className="topbar-menu-button" icon={<IconMenu2 size={20} stroke={1.8} />} onClick={onOpenMenu} aria-label="Open Menu" title="Open Menu" />
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {groupLabel && (
            <>
              <span className="breadcrumb-parent">{groupLabel}</span>
              <span className="breadcrumb-sep" aria-hidden><IconChevronRight size={14} stroke={1.8} /></span>
            </>
          )}
          <span className="breadcrumb-current" aria-current="page">{pageLabel}</span>
        </nav>
      </div>
      <div className="topbar-right">
        <WorkplaceChip user={user} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/** Where the signed-in user works. Branch and warehouse users only see data for this place. */
function WorkplaceChip({ user }: { user: HeaderUser }) {
  const Icon = user.accessLevel === 'BRANCH' ? IconBuildingStore : user.accessLevel === 'WAREHOUSE' ? IconBuildingWarehouse : IconBuildingSkyscraper;
  const kind = user.accessLevel === 'BRANCH' ? 'Branch' : user.accessLevel === 'WAREHOUSE' ? 'Warehouse' : 'Access';
  const label = workplaceLabel(user);
  return (
    <span className="workplace-chip" title={`${kind}: ${label}`}>
      <Icon size={16} stroke={1.8} aria-hidden />
      <span className="workplace-chip-text">{label}</span>
    </span>
  );
}

function UserMenu({ user }: { user: HeaderUser }) {
  const { theme, setTheme, vivid, setVivid } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const displayName = user.name || user.email || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div className="user-menu" ref={wrapRef}>
      <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className="user-menu-text">
          <span className="user-menu-name">{displayName}</span>
          <span className="user-menu-role">{roleLabel(user.role)}</span>
        </span>
        <span className="user-avatar" aria-hidden>{initials}</span>
        <IconChevronDown size={14} stroke={1.8} aria-hidden style={{ color: 'var(--color-text-muted)' }} />
      </button>
      {open && (
        <div className="user-menu-popover" role="menu" aria-label="User Menu">
          <div className="user-menu-section-label">Appearance</div>
          {THEMES.map(option => {
            const Icon = option.value === 'dark' ? IconMoon : IconSun;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option.value}
                className="user-menu-item"
                onClick={() => setTheme(option.value)}
              >
                <Icon size={16} stroke={1.8} aria-hidden />
                {option.label}
                {theme === option.value && <IconCheck size={16} stroke={1.8} className="user-menu-check" aria-hidden />}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={vivid}
            className="user-menu-item"
            title="Soft depth on cards and meters. Colours stay the same."
            onClick={() => setVivid(!vivid)}
          >
            <IconSparkles size={16} stroke={1.8} aria-hidden />
            Vivid Depth
            {vivid && <IconCheck size={16} stroke={1.8} className="user-menu-check" aria-hidden />}
          </button>
          <div className="user-menu-divider" />
          <button type="button" role="menuitem" className="user-menu-item is-danger" onClick={() => signOut({ callbackUrl: '/login' })}>
            <IconLogout2 size={16} stroke={1.8} aria-hidden />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
