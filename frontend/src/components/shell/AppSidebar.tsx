'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconChevronDown, IconHomeDollar, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { NAV_SECTIONS, type NavGroup, type NavLeaf, type NavSection } from './nav-config';

const ICON = { size: 18, stroke: 1.8 } as const;
const SUB_ICON = { size: 16, stroke: 1.8 } as const;

export function AppSidebar({
  sections = NAV_SECTIONS,
  activeHref,
  activeGroupKey,
  collapsed,
  onToggleCollapsed,
  onExpand,
  postingDisabled,
  postingReason,
}: {
  /** The menu to show; defaults to the full menu. */
  sections?: NavSection[];
  activeHref?: string;
  activeGroupKey?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Expands the rail so a group's pages can be shown. */
  onExpand: () => void;
  postingDisabled: boolean;
  postingReason: string;
}) {
  // One group open at a time; the group holding the current page opens on navigation.
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroupKey);
  useEffect(() => { if (activeGroupKey) setOpenGroup(activeGroupKey); }, [activeGroupKey]);

  function toggleGroup(key: string) {
    if (collapsed) {
      onExpand();
      setOpenGroup(key);
      return;
    }
    setOpenGroup(current => (current === key ? undefined : key));
  }

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
                <NavGroupBlock
                  key={entry.group.key}
                  group={entry.group}
                  open={openGroup === entry.group.key}
                  parentActive={entry.group.key === activeGroupKey}
                  activeHref={activeHref}
                  collapsed={collapsed}
                  onToggle={() => toggleGroup(entry.group.key)}
                  postingDisabled={postingDisabled}
                  postingReason={postingReason}
                />
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

function NavGroupBlock({ group, open, parentActive, activeHref, collapsed, onToggle, postingDisabled, postingReason }: {
  group: NavGroup;
  open: boolean;
  parentActive: boolean;
  activeHref?: string;
  collapsed: boolean;
  onToggle: () => void;
  postingDisabled: boolean;
  postingReason: string;
}) {
  const Icon = group.icon;
  const listId = `nav-group-${group.key}`;
  return (
    <div>
      <button
        type="button"
        className={`nav-item${parentActive ? (collapsed ? ' active' : ' is-parent-active') : ''}${open ? ' is-open' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        title={collapsed ? group.label : undefined}
      >
        <span className="nav-item-icon"><Icon {...ICON} /></span>
        <span className="nav-item-label">{group.label}</span>
        <span className={`nav-chevron${open ? ' open' : ''}`} aria-hidden><IconChevronDown size={14} stroke={1.8} /></span>
      </button>
      {open && (
        <div className={`nav-sub-list${group.numbered ? ' is-numbered' : ''}`} id={listId}>
          {group.items.map((item, index) => (
            <NavLink key={item.href} item={item} sub step={group.numbered ? index + 1 : undefined} active={item.href === activeHref} collapsed={collapsed} postingDisabled={postingDisabled} postingReason={postingReason} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active, sub = false, step, collapsed, postingDisabled, postingReason }: {
  item: NavLeaf;
  active: boolean;
  sub?: boolean;
  /** Setup step number shown before the icon. */
  step?: number;
  collapsed: boolean;
  postingDisabled: boolean;
  postingReason: string;
}) {
  const Icon = item.icon;
  const className = `nav-item${sub ? ' nav-sub-item' : ''}${active ? ' active' : ''}`;
  const data = { 'data-module': item.moduleKey, 'data-feature': item.featureKey, 'data-permission': item.permissionKey };
  const content = (
    <>
      {step !== undefined && <span className="nav-item-step" aria-label={`Step ${step}`}>{step}</span>}
      <span className="nav-item-icon"><Icon {...(sub ? SUB_ICON : ICON)} /></span>
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
