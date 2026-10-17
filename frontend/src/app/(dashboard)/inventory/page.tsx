import { PageHeader } from '@/components/ui/PageHeader';
import InventoryCardGrid, { type InventoryCard } from './InventoryCardGrid';

export const metadata = { title: 'Inventory — ERP Finance' };

const CARDS: InventoryCard[] = [
  {
    href:  '/inventory/branches',
    icon:  'branches',
    label: 'Branches',
    desc:  'Business branches used for branch-wise sales, users, warehouses, and reports.',
  },
  {
    href:  '/inventory/products',
    icon:  'products',
    label: 'Products',
    desc:  'Your product list with SKUs, prices, stock levels, and sizes.',
  },
  {
    href:  '/inventory/warehouses',
    icon:  'warehouses',
    label: 'Warehouses',
    desc:  'Storage places, inside locations, the default warehouse, and stock by warehouse.',
  },
  {
    href:  '/inventory/stock-transfers',
    icon:  'transfers',
    label: 'Stock Transfer',
    desc:  'Move stock from one warehouse or branch store to another.',
  },
  {
    href:  '/inventory/categories',
    icon:  'categories',
    label: 'Categories',
    desc:  'Group products into categories and sub-categories with their own codes.',
  },
  {
    href:  '/inventory/uom',
    icon:  'units',
    label: 'Units Of Measure',
    desc:  'Units for quantity, weight, volume, length, and other measures.',
  },
];

export default function InventoryIndexPage() {
  return (
    <main className="page-shell" style={{ overflow: 'auto' }}>
      <PageHeader
        title="Inventory"
        description="Products, categories, units, warehouses, and stock movements. Choose an area to open it."
      />
      <InventoryCardGrid cards={CARDS} />
    </main>
  );
}
