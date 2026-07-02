'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  IconArrowsExchange,
  IconCheck,
  IconEye,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
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
import { DateField, NumericField, TextField, fieldStyle, numericFieldStyle } from '@/components/ui/FormFields';
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
    return (
      <main style={pageShellStyle}>
        <Toolbar title="Stock Transfers" subtitle="Posted warehouse to warehouse stock movements">
          <button className="btn-ghost" type="button" onClick={() => listQuery.refetch()}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-primary" type="button" disabled={newTransferGuard.disabled} title={newTransferDisabledReason} onClick={openNewTransfer}><IconFilePlus size={15} /> New Transfer</button>
        </Toolbar>
        {message && <MessageBanner message={message} />}
        <section style={workspaceStyle}>
          <div style={{ minWidth: 0, overflow: 'auto', border: '1px solid var(--color-border)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <HeaderCell width={150}>Transfer Number</HeaderCell>
                  <HeaderCell width={115}>Date</HeaderCell>
                  <HeaderCell>From Warehouse</HeaderCell>
                  <HeaderCell>To Warehouse</HeaderCell>
                  <HeaderCell width={120} right>Total Qty</HeaderCell>
                  <HeaderCell width={100}>Status</HeaderCell>
                  <HeaderCell width={70}>View</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {listQuery.isFetching && <EmptyRow colSpan={7} text="Loading Stock Transfers..." />}
                {!listQuery.isFetching && (listQuery.data?.data ?? []).length === 0 && <EmptyRow colSpan={7} text="No posted Stock Transfers found." />}
                {!listQuery.isFetching && (listQuery.data?.data ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td style={bodyCellStyle(true)}>{row.transfer_number}</td>
                    <td style={bodyCellStyle()}>{formatDate(row.transfer_date, generalSettings)}</td>
                    <td style={bodyCellStyle()}>{row.from_warehouse_code} - {row.from_warehouse_name}</td>
                    <td style={bodyCellStyle()}>{row.to_warehouse_code} - {row.to_warehouse_name}</td>
                    <td style={amountCellStyle}>{formatNumber(row.total_quantity, generalSettings)}</td>
                    <td style={bodyCellStyle()}><StatusBadge>{row.status}</StatusBadge></td>
                    <td style={bodyCellStyle()}><button className="btn-ghost" style={iconButtonStyle} onClick={() => setSelectedTransferId(row.id)}><IconEye size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DetailPanel detail={detailQuery.data} loading={detailQuery.isFetching} settings={generalSettings} />
        </section>
      </main>
    );
  }

  return (
    <main style={pageShellStyle}>
      <Toolbar title="New Stock Transfer" subtitle="Move stock from one Warehouse to another Warehouse">
        <button className="btn-ghost" type="button" onClick={() => setViewMode('list')}>Cancel</button>
        <button className="btn-ghost" type="button" onClick={() => saveTransfer(false)} disabled={actionDisabled} title={dateStatusMessage}>Save Draft</button>
        <button className="btn-primary" type="button" onClick={() => {
          const validationMessage = validateForm();
          if (validationMessage) setMessage({ kind: 'error', text: validationMessage });
          else setConfirmOpen(true);
        }} disabled={actionDisabled} title={dateStatusMessage}><IconCheck size={15} /> Process</button>
      </Toolbar>
      {message && <MessageBanner message={message} />}
      <section style={entryCardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '115px minmax(260px, 1fr) minmax(220px, 0.8fr) minmax(260px, 1fr) minmax(220px, 0.8fr) 180px', gap: 8, alignItems: 'end' }}>
          <DateField label="Transfer Date" required value={transferDate} onChange={setTransferDate} />
          <FieldLabel label="From Warehouse" required>
            <SearchableSelect value={fromWarehouseId} options={warehouses} onChange={value => { setFromWarehouseId(value); setFromLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
          </FieldLabel>
          <FieldLabel label="From Location" required={Boolean(selectedFromWarehouse?.useLocations)}>
            <SearchableSelect value={fromLocationId} options={fromLocations} onChange={setFromLocationId} placeholder={selectedFromWarehouse?.useLocations ? 'Search Location' : 'Optional Location'} disabled={!fromWarehouseId || !selectedFromWarehouse?.useLocations} />
          </FieldLabel>
          <FieldLabel label="To Warehouse" required>
            <SearchableSelect value={toWarehouseId} options={warehouses.filter((warehouse: any) => warehouse.value !== fromWarehouseId || fromLocationId)} onChange={value => { setToWarehouseId(value); setToLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
          </FieldLabel>
          <FieldLabel label="To Location" required={Boolean(selectedToWarehouse?.useLocations)}>
            <SearchableSelect value={toLocationId} options={toLocations} onChange={setToLocationId} placeholder={selectedToWarehouse?.useLocations ? 'Search Location' : 'Optional Location'} disabled={!toWarehouseId || !selectedToWarehouse?.useLocations} />
          </FieldLabel>
          <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Optional" />
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Voucher Details" value={description} onChange={setDescription} placeholder="Short details for this transfer" />
        </div>
        <div style={dateMessageStyle}>{dateStatusMessage}</div>
      </section>

      <section style={lineEntryStyle}>
        <FieldLabel label="Item" required>
          <SearchableSelect value={lineItemId} options={items} onChange={setLineItemId} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
        </FieldLabel>
        <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
        <TextField label="Line Description" value={lineDescription} onChange={setLineDescription} />
        <div style={{ ...lineActionGroupStyle, gridTemplateColumns: editingLineId ? 'minmax(110px, 1fr) 92px' : '1fr' }}>
          <button className="btn-primary" type="button" onClick={addLine} style={linePrimaryButtonStyle}>
            {editingLineId ? 'Update Line' : 'Add Line'}
          </button>
          {editingLineId && (
            <button className="btn-ghost" type="button" onClick={cancelLineEdit} title="Cancel Line Edit" style={lineCancelButtonStyle}>
              <IconX size={14} /> Cancel
            </button>
          )}
        </div>
      </section>

      <section style={{ ...workspaceStyle, gridTemplateColumns: '1fr 250px' }}>
        <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <HeaderCell width={45}>No.</HeaderCell>
                <HeaderCell>Item</HeaderCell>
                <HeaderCell width={110} right>Quantity</HeaderCell>
                <HeaderCell width={90}>UOM</HeaderCell>
                <HeaderCell>Description</HeaderCell>
                <HeaderCell width={90}>Actions</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={6} text="No transfer items added." />}
              {lines.map((line, index) => (
                <tr key={line.id} style={editingLineId === line.id ? { background: 'var(--color-primary-light)' } : undefined}>
                  <td style={bodyCellStyle(true)}>{index + 1}</td>
                  <td style={bodyCellStyle(true)}>{line.itemCode} - {line.itemName}</td>
                  <td style={amountCellStyle}>{formatNumber(line.quantity, generalSettings)}</td>
                  <td style={bodyCellStyle()}>{line.uomName || '-'}</td>
                  <td style={bodyCellStyle()}>{line.description || '-'}</td>
                  <td style={bodyCellStyle()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={iconButtonStyle} onClick={() => editLine(line)} title="Edit Line"><IconPencil size={14} /></button>
                      <button className="btn-ghost" style={iconButtonStyle} onClick={() => removeLine(line.id)} title="Delete Line"><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside style={summaryStyle}>
          <SummaryValue label="Total Items" value={String(lines.length)} />
          <SummaryValue label="Total Quantity" value={formatNumber(totalQuantity, generalSettings)} />
        </aside>
      </section>
      <ConfirmDialog open={confirmOpen} title="Process Stock Transfer?" message="This will post stock movements and update warehouse stock balances. Posted transfers cannot be edited directly." confirmLabel="Process" onConfirm={() => saveTransfer(true)} onCancel={() => setConfirmOpen(false)} />
    </main>
  );
}

function locationOptions(rows: any[], warehouseId: string) {
  return rows
    .filter(location => location.warehouse_id === warehouseId)
    .map(location => ({ value: location.id, label: `${location.code} - ${location.name}`, searchText: `${location.code} ${location.name}` }));
}

function Toolbar({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section style={toolbarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={titleIconStyle}><IconArrowsExchange size={20} /></div>
        <div><h1 style={titleStyle}>{title}</h1><p style={subtitleStyle}>{subtitle}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </section>
  );
}

function DetailPanel({ detail, loading, settings }: { detail: any; loading: boolean; settings: any }) {
  if (loading) return <aside style={detailStyle}>Loading Transfer Detail...</aside>;
  if (!detail) return <aside style={detailStyle}>Select a Stock Transfer to view detail.</aside>;
  return (
    <aside style={detailStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '0.92rem' }}>Transfer Detail</h2>
        <button className="btn-ghost" style={iconButtonStyle} onClick={() => window.print()}><IconPrinter size={14} /></button>
      </div>
      <div style={detailGridStyle}>
        <InfoBox label="Transfer No." value={detail.transfer_number} />
        <InfoBox label="Date" value={formatDate(detail.transfer_date, settings)} />
        <InfoBox label="From" value={`${detail.from_warehouse_code} - ${detail.from_warehouse_name}`} />
        <InfoBox label="To" value={`${detail.to_warehouse_code} - ${detail.to_warehouse_name}`} />
        <InfoBox label="Reference" value={detail.reference_number || '-'} />
        <InfoBox label="Status" value={detail.status} />
      </div>
      <table style={{ ...tableStyle, marginTop: 10 }}>
        <thead><tr><HeaderCell width={38}>No.</HeaderCell><HeaderCell>Item</HeaderCell><HeaderCell width={90} right>Qty</HeaderCell></tr></thead>
        <tbody>
          {(detail.lines ?? []).map((line: any, index: number) => (
            <tr key={line.id}><td style={bodyCellStyle()}>{index + 1}</td><td style={bodyCellStyle(true)}>{line.item_code} - {line.item_name}</td><td style={amountCellStyle}>{formatNumber(line.quantity, settings)}</td></tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid var(--color-border)', padding: 8 }}><div style={{ fontSize: '0.68rem', fontWeight: 850, color: 'var(--color-text-muted)' }}>{label}</div><div style={{ fontSize: '0.78rem', fontWeight: 850 }}>{value}</div></div>;
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: '0.7rem', fontWeight: 850, color: 'var(--color-text-muted)' }}>{label}</div><div style={{ ...numericFieldStyle('compact'), border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginTop: 4 }}>{value}</div></div>;
}

function MessageBanner({ message }: { message: { kind: 'success' | 'error'; text: string } }) {
  return <div style={{ color: message.kind === 'success' ? '#15803d' : 'var(--color-danger-text)', fontSize: '0.74rem', fontWeight: 750 }}>{message.text}</div>;
}

function HeaderCell({ children, width, right = false }: { children: ReactNode; width?: number; right?: boolean }) {
  return <th style={{ ...headerCellStyle, width, textAlign: right ? 'right' : 'left' }}>{children}</th>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} style={{ ...bodyCellStyle(), height: 70, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>{text}</td></tr>;
}

function StatusBadge({ children }: { children: ReactNode }) {
  return <span style={{ border: '1px solid rgba(22,163,74,0.24)', background: 'rgba(22,163,74,0.12)', color: '#15803d', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 850 }}>{children}</span>;
}

const pageShellStyle: CSSProperties = { height: '100%', minHeight: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' };
const toolbarStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 };
const titleIconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, #0f766e, #2563eb)' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)', fontWeight: 900 };
const subtitleStyle: CSSProperties = { margin: '3px 0 0', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 750 };
const entryCardStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, flexShrink: 0 };
const lineEntryStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, display: 'grid', gridTemplateColumns: 'minmax(360px,1fr) 130px minmax(260px,0.8fr) 220px', gap: 8, flexShrink: 0 };
const lineActionGroupStyle: CSSProperties = { display: 'grid', gap: 8, alignSelf: 'end' };
const linePrimaryButtonStyle: CSSProperties = { height: 28, minWidth: 110, whiteSpace: 'nowrap' };
const lineCancelButtonStyle: CSSProperties = { height: 28, padding: '4px 8px', whiteSpace: 'nowrap', justifyContent: 'center' };
const workspaceStyle: CSSProperties = { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 8, overflow: 'hidden' };
const detailStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, overflow: 'auto', minWidth: 0 };
const detailGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 };
const summaryStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const headerCellStyle: CSSProperties = { background: 'var(--color-table-header)', color: 'var(--color-table-header-text)', border: '1px solid var(--color-border)', padding: '7px 8px', fontSize: '0.74rem', fontWeight: 900 };
function bodyCellStyle(strong = false): CSSProperties {
  return { border: '1px solid var(--color-border-subtle)', padding: '7px 8px', fontSize: '0.76rem', color: 'var(--color-text)', fontWeight: strong ? 850 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
}
const amountCellStyle: CSSProperties = { ...bodyCellStyle(true), textAlign: 'right', fontFamily: 'var(--font-mono)' };
const iconButtonStyle: CSSProperties = { height: 26, width: 28, minWidth: 28, padding: 0 };
const dateMessageStyle: CSSProperties = { minHeight: 17, marginTop: 6, color: 'var(--color-danger-text)', fontSize: '0.72rem', fontWeight: 700 };
