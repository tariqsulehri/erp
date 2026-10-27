'use client';

import { useSession } from 'next-auth/react';
import { useGeneralSettings } from '@/lib/api/settings';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransferList } from './TransferList';

/**
 * Stock Received: posted transfers that delivered stock. A Branch or Warehouse user sees only what came to
 * their own place; an All Branches user sees every delivery. Filter by direction: Branch → Branch,
 * Warehouse → Branch, Warehouse → Warehouse, or Branch → Warehouse.
 */
export default function StockReceivedPage() {
  const { data: settings } = useGeneralSettings();
  const { data: session } = useSession();
  const user = session?.user;
  const place = user?.accessLevel === 'BRANCH' && user.branch
    ? `${user.branch.code} - ${user.branch.name}`
    : user?.accessLevel === 'WAREHOUSE' && user.warehouse
      ? `${user.warehouse.code} - ${user.warehouse.name}`
      : null;

  return (
    <main className="page-shell">
      <PageHeader
        title="Stock Received"
        description={place ? `Stock delivered to ${place}.` : 'Stock delivered to every Branch and Warehouse.'}
        help={(
          <>
            <p>This list shows stock that arrived at {place ? 'your place' : 'a Branch or Warehouse'} by a posted Stock Transfer.</p>
            <p>Use the direction buttons to see one kind of delivery, for example Warehouse → Branch.</p>
            <p>Select a row to see the items and quantities. To send stock, use the Stock Transfer tab.</p>
          </>
        )}
      />
      <TransferList
        incoming
        settings={settings}
        empty={{
          title: 'No Stock Received Yet',
          description: place ? `Nothing has been delivered to ${place} yet.` : 'No Branch or Warehouse has received stock yet.',
        }}
      />
    </main>
  );
}
