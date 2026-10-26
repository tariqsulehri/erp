'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PostedVouchersView } from '@/components/vouchers/PostedVouchersView';

const LIFECYCLE_FILTERS = ['All', 'Draft', 'Pending Approval', 'Approved', 'Posted', 'Rejected', 'Voided'] as const;
type LifecycleFilter = (typeof LIFECYCLE_FILTERS)[number];

/** Reports link here with ?voucher=<id> (and optionally ?status=Posted) to open one voucher directly. */
function PostedVouchersFromLink() {
  const params = useSearchParams();
  const status = params.get('status');
  const initialStatus: LifecycleFilter = LIFECYCLE_FILTERS.includes(status as LifecycleFilter) ? status as LifecycleFilter : 'All';
  return <PostedVouchersView initialStatus={initialStatus} initialVoucherId={params.get('voucher') ?? undefined} />;
}

export default function PostedVouchersPage() {
  return (
    <Suspense fallback={null}>
      <PostedVouchersFromLink />
    </Suspense>
  );
}
