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
    desc:  'Send stock from one place to another: Warehouse → Branch, Branch → Branch, and more.',
  },
  {
    href:  '/inventory/stock-received',
    icon:  'received',
    label: 'Stock Received',
    desc:  'See the stock that arrived at each Branch or Warehouse.',
  },
  {
    href:  '/inventory/stock-adjustments',
    icon:  'adjustments',
    label: 'Stock Adjustment',
    desc:  'Correct stock after a count, damage, or loss.',
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
        description="Products, stock movements, and the places that hold stock. Choose an area to open it."
        help={(
          <>
            <p>Inventory keeps your products and where their stock is.</p>
            <ul>
              <li>Products: the items you buy and sell.</li>
              <li>Stock Transfer: send stock between Warehouses and Branches.</li>
              <li>Stock Received: see what arrived at each place.</li>
              <li>Stock Adjustment: correct stock after a count.</li>
            </ul>
          </>
        )}
      />
      <InventoryCardGrid cards={CARDS} />
    </main>
  );
}
