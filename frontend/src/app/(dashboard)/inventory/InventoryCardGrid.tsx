'use client';

import Link from 'next/link';
import {
  IconArrowsExchange,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCategory,
  IconAdjustmentsHorizontal,
  IconPackage,
  IconPackageImport,
  IconRuler2,
} from '@tabler/icons-react';

const ICONS = {
  branches: IconBuildingStore,
  products: IconPackage,
  warehouses: IconBuildingWarehouse,
  transfers: IconArrowsExchange,
  received: IconPackageImport,
  adjustments: IconAdjustmentsHorizontal,
  categories: IconCategory,
  units: IconRuler2,
} as const;

export type InventoryCardIcon = keyof typeof ICONS;

export type InventoryCard = {
  href: string;
  icon: InventoryCardIcon;
  label: string;
  desc: string;
  /** Optional quiet count shown on the right of the title. */
  count?: number;
};

export default function InventoryCardGrid({ cards }: { cards: InventoryCard[] }) {
  return (
    <div className="link-card-grid">
      {cards.map(card => {
        const Icon = ICONS[card.icon];
        return (
          <Link key={card.href} href={card.href} className="link-card">
            <span className="link-card-head">
              <Icon size={20} stroke={1.8} aria-hidden />
              <span className="link-card-title">{card.label}</span>
              {card.count !== undefined && <span className="link-card-count">{card.count}</span>}
            </span>
            <span className="link-card-desc">{card.desc}</span>
          </Link>
        );
      })}
    </div>
  );
}
