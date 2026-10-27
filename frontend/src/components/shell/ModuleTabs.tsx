'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { NavGroup } from './nav-config';

/**
 * The pages of one menu group as tabs across the top of the page (Inventory: Products, Stock Transfer,
 * Stock Received, Stock Adjustment). The sidebar shows only the group; the tabs switch between its pages.
 * Setup groups show their pages as numbered steps.
 */
export function ModuleTabs({ group, activeHref, postingDisabled, postingReason }: {
  group: NavGroup;
  activeHref?: string;
  postingDisabled: boolean;
  postingReason: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the current tab in view when the group has more tabs than fit.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeHref]);

  return (
    <nav className="module-tabs" aria-label={`${group.label} Pages`}>
      <div className="module-tabs-list" ref={listRef}>
        {group.items.map((item, index) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          const content = (
            <>
              {group.numbered && <span className="module-tab-step" aria-label={`Step ${index + 1}`}>{index + 1}</span>}
              <Icon size={16} stroke={1.8} aria-hidden />
              <span>{item.label}</span>
            </>
          );
          if (item.requiresPosting && postingDisabled && !active) {
            return (
              <span key={item.href} className="module-tab is-disabled" aria-disabled="true" title={postingReason}>
                {content}
              </span>
            );
          }
          return (
            <Link key={item.href} href={item.href} className={`module-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} title={item.label}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
