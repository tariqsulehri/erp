'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconLock, IconX } from '@tabler/icons-react';
import {
  fiscalYearsQueryKey,
  useCloseFiscalPeriod,
  useFiscalPeriods,
  useLockFiscalPeriod,
  type FiscalPeriodItem,
} from '@/lib/api/fiscal-years';
import { formatDate, type AppFormatSettingsSource } from '@/lib/app-settings';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { PERIOD_STATUS_TONE, statusLabel } from './fiscal-year-rules';

type FiscalPeriod = FiscalPeriodItem;
const fmt = (value: string | Date, settings?: AppFormatSettingsSource | null) => formatDate(value, settings);

/** The periods of one fiscal year, with Lock and Close actions. */
export function PeriodsTable({ fyId, fyStatus, settings }: { fyId: string; fyStatus: string; settings?: AppFormatSettingsSource | null }) {
  const queryClient = useQueryClient();
  const { data: periods, isLoading } = useFiscalPeriods(fyId);
  const lockPeriodMut = useLockFiscalPeriod();
  const closePeriodMut = useCloseFiscalPeriod();
  const periodActionBusy = lockPeriodMut.isPending || closePeriodMut.isPending;
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    requiredText: string;
    onConfirm: () => void;
  } | null>(null);

  function refreshPeriods() {
    queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th className="num" style={{ width: 56 }}>No.</th>
            <th>Period</th>
            <th style={{ width: 130 }}>Start Date</th>
            <th style={{ width: 130 }}>End Date</th>
            <th style={{ width: 110 }}>Status</th>
            <th className="num" style={{ width: 120 }}>Transactions</th>
            <th style={{ width: 120 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableMessageRow colSpan={7} title="Loading Periods…" loading />}
          {!isLoading && !periods?.length && (
            <TableMessageRow colSpan={7} title="No Periods Found" description="Periods are created with the Fiscal Year." />
          )}
          {!isLoading && periods?.map((p: FiscalPeriod) => {
            const busy = periodActionBusy;
            return (
              <tr key={p.id}>
                <td className="num cell-muted">{p.period_number}</td>
                <td className="cell-strong">{p.period_name}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.start_date, settings)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.end_date, settings)}</td>
                <td><Badge variant={PERIOD_STATUS_TONE[p.status] ?? 'neutral'}>{statusLabel(p.status)}</Badge></td>
                <td className="num">{p.transaction_count ?? 0}</td>
                <td className="cell-actions">
                  <div className="row-actions">
                    {p.status === 'open' && fyStatus !== 'closed' && (
                      <Button
                        size="sm"
                        icon={<IconLock size={16} stroke={1.8} />}
                        disabled={busy}
                        onClick={() => setConfirmAction({
                          title: 'Lock Fiscal Period?',
                          message: `Locking ${p.period_name} will stop new postings in this period. This action should be done only after review.`,
                          confirmLabel: 'Yes, Lock Period',
                          requiredText: 'LOCK',
                          onConfirm: () => lockPeriodMut.mutate(
                            { id: p.id },
                            {
                              onSuccess: () => {
                                refreshPeriods();
                                setConfirmAction(null);
                              },
                            },
                          ),
                        })}
                      >
                        Lock
                      </Button>
                    )}
                    {p.status === 'locked' && fyStatus !== 'closed' && (
                      <Button
                        size="sm"
                        icon={<IconX size={16} stroke={1.8} />}
                        disabled={busy}
                        onClick={() => setConfirmAction({
                          title: 'Close Fiscal Period?',
                          message: `Closing ${p.period_name} will mark the period closed for posting. Continue only after all checks are complete.`,
                          confirmLabel: 'Yes, Close Period',
                          requiredText: 'CLOSE',
                          onConfirm: () => closePeriodMut.mutate(
                            { id: p.id },
                            {
                              onSuccess: () => {
                                refreshPeriods();
                                setConfirmAction(null);
                              },
                            },
                          ),
                        })}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={confirmAction?.confirmLabel ?? 'Confirm'}
        variant="warning"
        loading={periodActionBusy}
        requiredText={confirmAction?.requiredText}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

