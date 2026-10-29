'use client';

import { useState, type ReactNode } from 'react';
import { IconEye, IconSearch } from '@tabler/icons-react';
import { formatDate, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import {
  useCancelStockTransferDraft,
  useInvalidateStockTransferQueries,
  usePostStockTransferDraft,
  useReverseStockTransfer,
  useStockTransferDetail,
  useStockTransfersList,
} from '@/lib/api/stock-transfers';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { StatusChip } from '@/components/ui/StatusChip';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { documentStatusLabel, DraftDocumentActions, ReverseDocumentAction, type DraftActionMessage } from '@/components/documents';
import { TransferDetailPanel, PlaceCell } from './TransferDetailPanel';
import { TRANSFER_DIRECTIONS, type TransferDirection } from './transfer-directions';

type DirectionFilter = 'ALL' | TransferDirection;
type StatusFilter = 'ALL' | 'Posted' | 'Draft' | 'Voided';

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Directions' },
  ...TRANSFER_DIRECTIONS.map(option => ({
    value: option.value,
    label: option.label,
    searchText: `${option.label} ${option.description}`,
  })),
];

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'Posted', label: 'Posted' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Voided', label: 'Cancelled Or Reversed' },
];

/**
 * Transfers with a direction filter and a details panel.
 * Stock Transfer shows every transfer the user can see and, with `onOpenDraft`, a Status filter and the Draft
 * actions; Stock Received passes `incoming` to show only posted stock delivered to the user's own place.
 */
export function TransferList({ incoming = false, settings, empty, onOpenDraft, canChangeDrafts = false, canReverse = false }: {
  incoming?: boolean;
  settings?: AppFormatSettingsSource | null;
  /** Shown when there are no transfers at all (no filter applied). */
  empty: { title: string; description: string; action?: ReactNode };
  /** Opens a saved Draft in the entry form; when set, the list also shows Drafts and Cancelled transfers. */
  onOpenDraft?: (detail: Record<string, any>) => void;
  /** True for roles that may save Stock Transfers: they see Open Draft, Post and Cancel Draft. */
  canChangeDrafts?: boolean;
  /** True for roles that may reverse posted transfers: they see Reverse on a posted transfer. */
  canReverse?: boolean;
}) {
  const reverseTransfer = useReverseStockTransfer();
  const postDraft = usePostStockTransferDraft();
  const cancelDraft = useCancelStockTransferDraft();
  const invalidate = useInvalidateStockTransferQueries();
  const [status, setStatus] = useState<StatusFilter>('Posted');
  const [actionMessage, setActionMessage] = useState<DraftActionMessage | null>(null);
  const [direction, setDirection] = useState<DirectionFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listQuery = useStockTransfersList({
    page: 1,
    limit: 100,
    status: onOpenDraft ? (status === 'ALL' ? undefined : status) : 'Posted',
    incoming: incoming || undefined,
    direction: direction === 'ALL' ? undefined : direction,
    search: search.trim() || undefined,
  });
  const detailQuery = useStockTransferDetail(selectedId);
  const rows: any[] = listQuery.data?.data ?? [];
  const filtered = direction !== 'ALL' || search.trim() !== '' || (onOpenDraft ? status !== 'Posted' : false);
  const detail = detailQuery.data;

  return (
    <>
    {actionMessage && <InlineAlert tone={actionMessage.tone} onDismiss={() => setActionMessage(null)}>{actionMessage.text}</InlineAlert>}
    <div className="transfer-list-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <section className="list-card" aria-label={incoming ? 'Stock Received' : 'Stock Transfers'}>
        <div className="list-card-toolbar">
          <label className="list-card-search">
            <IconSearch size={16} stroke={1.8} aria-hidden />
            <span className="sr-only">Search Transfers</span>
            <input type="search" value={search} placeholder="Search by Transfer No., reference, or note…" onChange={event => setSearch(event.target.value)} />
          </label>
          {onOpenDraft && (
            <div style={{ width: 200, minWidth: 170 }}>
              <SearchableSelect
                value={status}
                options={STATUS_FILTER_OPTIONS}
                placeholder="Search Status"
                hidePlaceholderOption
                onChange={value => {
                  setStatus((value || 'ALL') as StatusFilter);
                  setSelectedId(null);
                }}
                ariaLabel="Status"
              />
            </div>
          )}
          <div style={{ width: 240, minWidth: 200 }}>
            <SearchableSelect
              value={direction}
              options={DIRECTION_OPTIONS}
              placeholder="Search Direction"
              hidePlaceholderOption
              onChange={value => {
                setDirection((value || 'ALL') as DirectionFilter);
                setSelectedId(null);
              }}
              ariaLabel="Direction"
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table data-table-caps" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 150 }}>Transfer No.</th>
                <th style={{ width: 110 }}>Date</th>
                <th>From</th>
                <th>To</th>
                <th className="num" style={{ width: 120 }}>Total Quantity</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={7} title="Loading Transfers…" loading />}
              {listQuery.error && <TableMessageRow colSpan={7} title="Could Not Load Transfers" description="Refresh the page and try again." />}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                filtered
                  ? <TableMessageRow colSpan={7} title="No Transfers Match" description="Choose another Status or direction, or clear the search." />
                  : <TableMessageRow colSpan={7} title={empty.title} description={empty.description} action={empty.action} />
              )}
              {!listQuery.isLoading && rows.map(row => (
                <tr key={row.id} className={selectedId === row.id ? 'is-selected' : undefined} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer' }}>
                  <td className="cell-strong"><span className="code-chip">{row.transfer_number}</span></td>
                  <td>{formatDate(row.transfer_date, settings)}</td>
                  <td><PlaceCell kind={row.from_kind} code={row.from_code ?? row.from_warehouse_code} name={row.from_name ?? row.from_warehouse_name} /></td>
                  <td><PlaceCell kind={row.to_kind} code={row.to_code ?? row.to_warehouse_code} name={row.to_name ?? row.to_warehouse_name} /></td>
                  <td className="num">{formatNumber(row.total_quantity, settings)}</td>
                  <td><StatusChip status={row.status} label={documentStatusLabel(row.status, row.posted_at)} /></td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconEye size={16} stroke={1.8} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Transfer ${row.transfer_number}`} title="View Stock Transfer Details" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selectedId && (
        <TransferDetailPanel
          detail={detail}
          loading={detailQuery.isFetching}
          settings={settings}
          onOpenDraft={detail?.status === 'Draft' && canChangeDrafts && onOpenDraft ? () => onOpenDraft(detail) : undefined}
          onClose={() => setSelectedId(null)}
          actions={detail?.status === 'Posted' && canReverse && onOpenDraft ? (
            <ReverseDocumentAction
              documentName="Stock Transfer"
              documentNumber={detail.transfer_number}
              reverseEffect="The items go back from the To place to the From place at the cost they moved at."
              onReverse={async (reversalDate, reason) => {
                const result = await reverseTransfer.mutateAsync({ id: detail.id, reversalDate, reason });
                await invalidate();
                return result.transfer_number;
              }}
              onMessage={setActionMessage}
            />
          ) : detail?.status === 'Draft' && canChangeDrafts && onOpenDraft && (
            <DraftDocumentActions
              documentName="Stock Transfer"
              documentNumber={detail.transfer_number}
              postEffect="Stock moves out of the From place and into the To place."
              onOpen={() => onOpenDraft(detail)}
              onPost={async () => {
                const result = await postDraft.mutateAsync(detail.id);
                await invalidate();
                return result.transfer_number;
              }}
              onCancel={async reason => {
                const result = await cancelDraft.mutateAsync({ id: detail.id, reason });
                await invalidate();
                return result.transfer_number;
              }}
              onMessage={setActionMessage}
            />
          )}
        />
      )}
    </div>
    </>
  );
}
