'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  IconCheck,
  IconEye,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  type StockTransferPayload,
  useCreateAndPostStockTransfer,
  useCreateStockTransferDraft,
  useInvalidateStockTransferQueries,
  useStockTransferDetail,
  useStockTransfersList,
  useStockTransferSupportData,
} from '@/lib/api/stock-transfers';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface TransferLine {
  id: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  stockOnHand: string;
  description: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function StockTransferPage() {
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = useStockTransferSupportData();
  const createDraft = useCreateStockTransferDraft();
  const createAndPost = useCreateAndPostStockTransfer();
  const invalidate = useInvalidateStockTransferQueries();
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');
  const [transferDate, setTransferDate] = useState(today());
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [lineItemId, setLineItemId] = useState('');
  const [lineQuantity, setLineQuantity] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  const postingDateGuard = usePostingDateGuard(transferDate, 'Transfer Date');
  const newTransferGuard = usePostingDateGuard(today(), 'Transfer Date');
  const saving = createDraft.isPending || createAndPost.isPending;
  const actionDisabled = saving || postingDateGuard.disabled;
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Transfer Date...' : postingDateGuard.statusMessage;
  const newTransferDisabledReason = newTransferGuard.isChecking ? 'Checking Transfer Date...' : newTransferGuard.statusMessage;
  const listQuery = useStockTransfersList({ page: 1, limit: 50, status: 'Posted' });
  const detailQuery = useStockTransferDetail(selectedTransferId);

  const warehouses = useMemo(() => (supportQuery.data?.warehouses ?? []).map((warehouse: any) => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}${warehouse.branch_name ? ` (${warehouse.branch_name})` : ''}`,
    searchText: `${warehouse.code} ${warehouse.name} ${warehouse.branch_name ?? ''}`,
    isDefault: warehouse.is_default,
    useLocations: Boolean(warehouse.use_locations),
  })), [supportQuery.data?.warehouses]);
  const selectedFromWarehouse = warehouses.find((warehouse: any) => warehouse.value === fromWarehouseId);
  const selectedToWarehouse = warehouses.find((warehouse: any) => warehouse.value === toWarehouseId);
  const fromLocations = useMemo(() => locationOptions(supportQuery.data?.locations ?? [], fromWarehouseId), [supportQuery.data?.locations, fromWarehouseId]);
  const toLocations = useMemo(() => locationOptions(supportQuery.data?.locations ?? [], toWarehouseId), [supportQuery.data?.locations, toWarehouseId]);
  const items = useMemo(() => (supportQuery.data?.items ?? []).map((item: any) => ({
    value: item.id,
    label: `${item.item_code} - ${item.item_name}`,
    searchText: `${item.item_code} ${item.item_name}`,
    itemCode: item.item_code,
    itemName: item.item_name,
    uomName: item.uom_name ?? '',
    stockOnHand: item.stock_on_hand ?? '0',
  })), [supportQuery.data?.items]);
  const selectedItem = items.find(item => item.value === lineItemId);
  const totalQuantity = lines.reduce((sum, line) => sum + numericValue(line.quantity), 0);

  useEffect(() => {
    if (!fromWarehouseId && warehouses.length > 0) setFromWarehouseId(warehouses.find((warehouse: any) => warehouse.isDefault)?.value ?? warehouses[0].value);
  }, [fromWarehouseId, warehouses]);

  useEffect(() => {
    if (!toWarehouseId && warehouses.length > 1) {
      const secondWarehouse = warehouses.find((warehouse: any) => warehouse.value !== fromWarehouseId);
      setToWarehouseId(secondWarehouse?.value ?? '');
    }
  }, [fromWarehouseId, toWarehouseId, warehouses]);

  useEffect(() => {
    if (!selectedFromWarehouse?.useLocations) {
      setFromLocationId('');
      return;
    }
    if (fromLocationId && fromLocations.some((location: any) => location.value === fromLocationId)) return;
    setFromLocationId(fromLocations.find((location: any) => location.isDefault)?.value ?? '');
  }, [fromLocationId, fromLocations, selectedFromWarehouse?.useLocations]);

  useEffect(() => {
    if (!selectedToWarehouse?.useLocations) {
      setToLocationId('');
      return;
    }
    if (toLocationId && toLocations.some((location: any) => location.value === toLocationId)) return;
    setToLocationId(toLocations.find((location: any) => location.isDefault)?.value ?? '');
  }, [selectedToWarehouse?.useLocations, toLocationId, toLocations]);

  useEffect(() => {
    if (supportQuery.error) setMessage({ kind: 'error', text: friendlyErrorMessage(supportQuery.error, 'Unable to load Stock Transfer setup.') });
  }, [supportQuery.error]);

  function resetForm() {
    setTransferDate(today());
    setFromWarehouseId(warehouses.find((warehouse: any) => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setFromLocationId('');
    setToWarehouseId(warehouses.find((warehouse: any) => warehouse.value !== fromWarehouseId)?.value ?? '');
    setToLocationId('');
    setReferenceNumber('');
    setDescription('');
    setLineItemId('');
    setLineQuantity('');
    setLineDescription('');
    setLines([]);
    setEditingLineId(null);
    setMessage(null);
  }

  function openNewTransfer() {
    if (newTransferGuard.disabled) {
      setMessage({ kind: 'error', text: newTransferDisabledReason || 'Transfer Date cannot be used for posting.' });
      return;
    }
    resetForm();
    setViewMode('entry');
  }

  function validateForm() {
    if (postingDateGuard.disabled) return dateStatusMessage || 'Transfer Date cannot be used for posting.';
    if (!fromWarehouseId) return 'From Warehouse is required.';
    if (!toWarehouseId) return 'To Warehouse is required.';
    if (selectedFromWarehouse?.useLocations && !fromLocationId) return 'From Location is required because From Warehouse uses Locations.';
    if (selectedToWarehouse?.useLocations && !toLocationId) return 'To Location is required because To Warehouse uses Locations.';
    if (fromWarehouseId === toWarehouseId && fromLocationId === toLocationId) return 'From Warehouse and To Warehouse cannot be the same.';
    if (lines.length === 0) return 'Add at least one transfer item.';
    const invalidLine = lines.find(line => numericValue(line.quantity) <= 0);
    if (invalidLine) return `Quantity must be greater than zero for ${invalidLine.itemCode}.`;
    return '';
  }

  function addLine() {
    if (!selectedItem) {
      setMessage({ kind: 'error', text: 'Item is required.' });
      return;
    }
    if (numericValue(lineQuantity) <= 0) {
      setMessage({ kind: 'error', text: 'Quantity must be greater than zero.' });
      return;
    }
    const savedLine: TransferLine = {
      id: editingLineId ?? Date.now(),
      itemId: selectedItem.value,
      itemCode: selectedItem.itemCode,
      itemName: selectedItem.itemName,
      uomName: selectedItem.uomName,
      quantity: lineQuantity,
      stockOnHand: selectedItem.stockOnHand,
      description: lineDescription,
    };
    setLines(current => {
      const withoutDuplicateItem = current.filter(line => line.id === savedLine.id || line.itemId !== savedLine.itemId);
      if (editingLineId) return withoutDuplicateItem.map(line => line.id === editingLineId ? savedLine : line);
      return [...withoutDuplicateItem, savedLine];
    });
    setLineItemId('');
    setLineQuantity('');
    setLineDescription('');
    setEditingLineId(null);
    setMessage(null);
  }

  function editLine(line: TransferLine) {
    setEditingLineId(line.id);
    setLineItemId(line.itemId);
    setLineQuantity(line.quantity);
    setLineDescription(line.description);
    setMessage(null);
  }

  function cancelLineEdit() {
    setEditingLineId(null);
    setLineItemId('');
    setLineQuantity('');
    setLineDescription('');
  }

  function removeLine(id: number) {
    setLines(current => current.filter(item => item.id !== id));
    if (editingLineId === id) cancelLineEdit();
  }

  function buildPayload(): StockTransferPayload {
    return {
      transfer_date: transferDate,
      from_warehouse_id: fromWarehouseId,
      from_location_id: fromLocationId || undefined,
      to_warehouse_id: toWarehouseId,
      to_location_id: toLocationId || undefined,
      reference_number: referenceNumber.trim(),
      description: description.trim(),
      lines: lines.map(line => ({ item_id: line.itemId, quantity: numericValue(line.quantity), description: line.description })),
    };
  }

  async function saveTransfer(postNow: boolean) {
    setConfirmOpen(false);
    const validationMessage = validateForm();
    if (validationMessage) {
      setMessage({ kind: 'error', text: validationMessage });
      return;
    }
    try {
      const result = postNow
        ? await createAndPost.mutateAsync(buildPayload())
        : await createDraft.mutateAsync(buildPayload());
      await invalidate();
      resetForm();
      setMessage({ kind: 'success', text: postNow ? `${result.transfer_number} posted successfully.` : `${result.transfer_number} saved as Draft.` });
      if (postNow) setViewMode('list');
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Stock Transfer.') });
    }
  }

  if (viewMode === 'list') {
    const rows = listQuery.data?.data ?? [];
    return (
      <main className="page-shell">
        <PageHeader
          title="Stock Transfers"
          description="Posted stock movements between Warehouses and Locations."
          actions={(
            <>
              <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={() => listQuery.refetch()} loading={listQuery.isFetching && !listQuery.isLoading}>Refresh</Button>
              <Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newTransferGuard.disabled} title={newTransferDisabledReason} onClick={openNewTransfer}>New Transfer</Button>
            </>
          )}
        />
        {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}
        <div className={`split-view${selectedTransferId ? ' has-side' : ''}`}>
          <section className="panel">
            <div className="table-scroll">
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>Transfer No.</th>
                    <th style={{ width: 110 }}>Date</th>
                    <th>From Warehouse</th>
                    <th>To Warehouse</th>
                    <th className="num" style={{ width: 120 }}>Total Qty</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading && <TableMessageRow colSpan={7} title="Loading Stock Transfers…" loading />}
                  {!listQuery.isLoading && rows.length === 0 && (
                    <TableMessageRow colSpan={7} title="No Posted Stock Transfers Yet" description="Move stock between Warehouses with a new transfer." action={<Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newTransferGuard.disabled} onClick={openNewTransfer}>New Transfer</Button>} />
                  )}
                  {!listQuery.isLoading && rows.map((row: any) => (
                    <tr key={row.id} className={selectedTransferId === row.id ? 'is-selected' : undefined} onClick={() => setSelectedTransferId(row.id)} style={{ cursor: 'pointer' }}>
                      <td className="cell-strong">{row.transfer_number}</td>
                      <td>{formatDate(row.transfer_date, generalSettings)}</td>
                      <td>{row.from_warehouse_code} - {row.from_warehouse_name}</td>
                      <td>{row.to_warehouse_code} - {row.to_warehouse_name}</td>
                      <td className="num">{formatNumber(row.total_quantity, generalSettings)}</td>
                      <td><Badge variant="success">{row.status}</Badge></td>
                      <td className="cell-actions">
                        <Button variant="ghost" size="sm" icon={<IconEye size={16} stroke={1.8} />} onClick={event => { event.stopPropagation(); setSelectedTransferId(row.id); }} aria-label={`View Transfer ${row.transfer_number}`} title="View Transfer" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selectedTransferId && <DetailPanel detail={detailQuery.data} loading={detailQuery.isFetching} settings={generalSettings} onClose={() => setSelectedTransferId(null)} />}
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="New Stock Transfer"
        description="Move stock from one Warehouse or Location to another."
        actions={(
          <>
            <Button variant="ghost" onClick={() => setViewMode('list')}>Cancel</Button>
            <Button variant="secondary" onClick={() => saveTransfer(false)} disabled={actionDisabled} title={dateStatusMessage}>Save Draft</Button>
            <Button
              variant="primary"
              icon={<IconCheck size={16} stroke={1.8} />}
              onClick={() => {
                const validationMessage = validateForm();
                if (validationMessage) setMessage({ kind: 'error', text: validationMessage });
                else setConfirmOpen(true);
              }}
              disabled={actionDisabled}
              loading={saving}
              title={dateStatusMessage}
            >
              Process
            </Button>
          </>
        )}
      />
      {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}

      <section className="panel" style={{ flexShrink: 0, overflow: 'visible' }}>
        <div className="panel-body" style={{ overflow: 'visible' }}>
          <div className="form-grid" style={{ ['--form-cols' as string]: 6 }}>
            <DateField label="Transfer Date" required value={transferDate} onChange={setTransferDate} />
            <FieldLabel label="From Warehouse" required>
              <SearchableSelect value={fromWarehouseId} options={warehouses} onChange={value => { setFromWarehouseId(value); setFromLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
            </FieldLabel>
            <FieldLabel label="From Location" required={Boolean(selectedFromWarehouse?.useLocations)}>
              <SearchableSelect value={fromLocationId} options={fromLocations} onChange={setFromLocationId} placeholder={selectedFromWarehouse?.useLocations ? 'Search Location' : 'Not Used'} disabled={!fromWarehouseId || !selectedFromWarehouse?.useLocations} />
            </FieldLabel>
            <FieldLabel label="To Warehouse" required>
              <SearchableSelect value={toWarehouseId} options={warehouses.filter((warehouse: any) => warehouse.value !== fromWarehouseId || fromLocationId)} onChange={value => { setToWarehouseId(value); setToLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
            </FieldLabel>
            <FieldLabel label="To Location" required={Boolean(selectedToWarehouse?.useLocations)}>
              <SearchableSelect value={toLocationId} options={toLocations} onChange={setToLocationId} placeholder={selectedToWarehouse?.useLocations ? 'Search Location' : 'Not Used'} disabled={!toWarehouseId || !selectedToWarehouse?.useLocations} />
            </FieldLabel>
            <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Optional" />
            <div className="span-all">
              <TextField label="Description" value={description} onChange={setDescription} placeholder="Short details for this transfer" />
            </div>
          </div>
          {dateStatusMessage && <p className="form-error">{dateStatusMessage}</p>}
        </div>
      </section>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-header" style={{ alignItems: 'flex-end', paddingTop: 12, paddingBottom: 12, overflow: 'visible' }}>
          <div className="form-grid" style={{ flex: 1, ['--form-cols' as string]: 7 }}>
            <div className="span-3">
              <FieldLabel label="Item" required>
                <SearchableSelect value={lineItemId} options={items} onChange={setLineItemId} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
            </div>
            <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
            <div className="span-2">
              <TextField label="Line Description" value={lineDescription} onChange={setLineDescription} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: '100%', paddingTop: 20 }}>
              <Button variant="secondary" onClick={addLine} style={{ flex: 1 }}>{editingLineId ? 'Update Line' : 'Add Line'}</Button>
              {editingLineId && <Button variant="ghost" icon={<IconX size={16} stroke={1.8} />} onClick={cancelLineEdit} aria-label="Cancel Line Edit" title="Cancel Line Edit" />}
            </div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="num" style={{ width: 56 }}>No.</th>
                <th>Item</th>
                <th className="num" style={{ width: 130 }}>Quantity</th>
                <th style={{ width: 90 }}>UOM</th>
                <th>Description</th>
                <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <TableMessageRow colSpan={6} title="No Items Added" description="Choose an Item and Quantity above, then select Add Line." />}
              {lines.map((line, index) => (
                <tr key={line.id} className={editingLineId === line.id ? 'is-selected' : undefined}>
                  <td className="num cell-muted">{index + 1}</td>
                  <td className="cell-strong">{line.itemCode} - {line.itemName}</td>
                  <td className="num">{formatNumber(line.quantity, generalSettings)}</td>
                  <td className={line.uomName ? undefined : 'cell-muted'}>{line.uomName || 'Not Set'}</td>
                  <td className={line.description ? undefined : 'cell-muted'}>{line.description || 'Not Set'}</td>
                  <td className="cell-actions">
                    <span className="row-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => editLine(line)} aria-label={`Edit Line ${index + 1}`} title="Edit Line" />
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => removeLine(line.id)} aria-label={`Remove Line ${index + 1}`} title="Remove Line" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total Items <strong style={{ color: 'var(--color-heading)', fontWeight: 600 }}>{lines.length}</strong></span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Total Quantity <strong style={{ color: 'var(--color-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(totalQuantity, generalSettings)}</strong></span>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        variant="primary"
        title="Process Stock Transfer?"
        message="This posts the stock movements and updates Warehouse stock balances. A posted transfer cannot be edited."
        confirmLabel="Process"
        loading={saving}
        onConfirm={() => saveTransfer(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}

function locationOptions(rows: any[], warehouseId: string) {
  return rows
    .filter(location => location.warehouse_id === warehouseId)
    .map(location => ({ value: location.id, label: `${location.code} - ${location.name}`, searchText: `${location.code} ${location.name}` }));
}

function DetailPanel({ detail, loading, settings, onClose }: { detail: any; loading: boolean; settings: any; onClose: () => void }) {
  return (
    <aside className="panel side-panel" aria-label="Transfer Detail">
      <div className="panel-header">
        <h2 className="panel-title">{detail?.transfer_number ?? 'Transfer Detail'}</h2>
        <span className="row-actions">
          {detail && <Button variant="ghost" size="sm" icon={<IconPrinter size={16} stroke={1.8} />} onClick={() => window.print()} aria-label="Print Transfer" title="Print Transfer" />}
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Detail" title="Close Detail" />
        </span>
      </div>
      <div className="panel-body">
        {loading && <p className="form-hint">Loading Transfer Detail…</p>}
        {!loading && detail && (
          <>
            <dl className="detail-list">
              <InfoRow label="Date" value={formatDate(detail.transfer_date, settings)} />
              <InfoRow label="Status" value={<Badge variant="success">{detail.status}</Badge>} />
              <InfoRow label="From" value={`${detail.from_warehouse_code} - ${detail.from_warehouse_name}`} />
              <InfoRow label="To" value={`${detail.to_warehouse_code} - ${detail.to_warehouse_name}`} />
              <InfoRow label="Reference" value={detail.reference_number || 'Not Set'} />
            </dl>
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead><tr><th className="num" style={{ width: 44 }}>No.</th><th>Item</th><th className="num" style={{ width: 96 }}>Qty</th></tr></thead>
              <tbody>
                {(detail.lines ?? []).map((line: any, index: number) => (
                  <tr key={line.id}>
                    <td className="num cell-muted">{index + 1}</td>
                    <td className="cell-strong">{line.item_code} - {line.item_name}</td>
                    <td className="num">{formatNumber(line.quantity, settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{value}</dd></div>;
}
