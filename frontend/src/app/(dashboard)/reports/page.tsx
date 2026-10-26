'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportsWorkspace } from '@/components/reports/ReportsWorkspace';

/** Reads ?report=&account=&from=&to= so other screens can open a report directly. */
function ReportsFromLink() {
  const params = useSearchParams();
  return (
    <ReportsWorkspace
      link={{ report: params.get('report'), account: params.get('account'), from: params.get('from'), to: params.get('to') }}
    />
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsFromLink />
    </Suspense>
  );
}
