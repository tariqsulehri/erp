'use client';

import Link from 'next/link';
import { IconHomeDollar, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { NAV_SECTIONS, type NavGroup, type NavLeaf, type NavSection } from './nav-config';

const ICON = { size: 18, stroke: 1.8 } as const;

export function AppSidebar({
  sections = NAV_SECTIONS,
  activeHref,
  activeGroupKey,
  collapsed,
  onToggleCollapsed,
  postingDisabled,
  postingReason,
}: {
  /** The menu to show; defaults to the full menu. */
  sections?: NavSection[];
  activeHref?: string;
  activeGroupKey?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  postingDisabled: boolean;
  postingReason: string;
}) {
  return (
    <aside className="sidebar" aria-label="Main Navigation">
      <Link href="/dashboard" className="sidebar-brand" title="ERP Finance">
        <span className="sidebar-brand-mark" aria-hidden><IconHomeDollar size={19} stroke={1.8} /></span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-title">ERP Finance</span>
          <span className="sidebar-brand-sub">Financial Module</span>
        </span>
      </Link>

      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            <div className="sidebar-section-divider" aria-hidden />
            {section.entries.map(entry => entry.type === 'link'
              ? <NavLink key={entry.item.href} item={entry.item} active={entry.item.href === activeHref} collapsed={collapsed} postingDisabled={postingDisabled} postingReason={postingReason} />
              : (
                <NavGroupLink key={entry.group.key} group={entry.group} active={entry.group.key === activeGroupKey} collapsed={collapsed} />
              ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item sidebar-collapse-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className="nav-item-icon">{collapsed ? <IconLayoutSidebarLeftExpand {...ICON} /> : <IconLayoutSidebarLeftCollapse {...ICON} />}</span>
          <span className="nav-item-label">Collapse Sidebar</span>
        </button>
      </div>
    </aside>
  );
}

/** A menu group is one link to its first page; its other pages are tabs on the page (ModuleTabs). */
function NavGroupLink({ group, active, collapsed }: { group: NavGroup; active: boolean; collapsed: boolean }) {
  const Icon = group.icon;
  const first = group.items[0];
  if (!first) return null;
  return (
    <Link
      href={first.href}
      className={`nav-item${active ? ' active' : ''}`}
      aria-current={active ? 'true' : undefined}
      title={collapsed ? group.label : `${group.label}: ${group.items.map(item => item.label).join(', ')}`}
    >
      <span className="nav-item-icon"><Icon {...ICON} /></span>
      <span className="nav-item-label">{group.label}</span>
      <span className="nav-item-count" aria-label={`${group.items.length} pages`}>{group.items.length}</span>
    </Link>
  );
}

function NavLink({ item, active, collapsed, postingDisabled, postingReason }: {
  item: NavLeaf;
  active: boolean;
  collapsed: boolean;
  postingDisabled: boolean;
  postingReason: string;
}) {
  const Icon = item.icon;
  const className = `nav-item${active ? ' active' : ''}`;
  const data = { 'data-module': item.moduleKey, 'data-feature': item.featureKey, 'data-permission': item.permissionKey };
  const content = (
    <>
      <span className="nav-item-icon"><Icon {...ICON} /></span>
      <span className="nav-item-label">{item.label}</span>
      {item.code && <span className="nav-item-code">{item.code}</span>}
    </>
  );

  if (item.requiresPosting && postingDisabled) {
    return (
      <button type="button" className={className} disabled aria-disabled="true" title={postingReason} {...data}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} {...data}>
      {content}
    </Link>
  );
}
