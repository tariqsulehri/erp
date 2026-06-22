'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  IconAdjustmentsHorizontal,
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
  type AdjustmentType,
  type StockAdjustmentPayload,
  useCreateAndPostStockAdjustment,
  useCreateStockAdjustmentDraft,
  useInvalidateStockAdjustmentQueries,
  useStockAdjustmentDetail,
  useStockAdjustmentsList,
  useStockAdjustmentSupportData,
} from '@/lib/api/stock-adjustments';
import { useValidatePostingDate } from '@/lib/api/fiscal-years';
import { friendlyErrorMessage, isValidDateInput, numericValue } from '@/lib/erp-utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, TextField, numericFieldStyle } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface AdjustmentLine {
  id: number;
  adjustmentType: AdjustmentType;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  unitCost: string;
  stockOnHand: string;
  description: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const adjustmentTypeOptions = [
  { value: 'Increase', label: 'Increase' },
  { value: 'Decrease', label: 'Decrease' },
];

export default function StockAdjustmentPage() {
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = useStockAdjustmentSupportData();
  const createDraft = useCreateStockAdjustmentDraft();
  const createAndPost = useCreateAndPostStockAdjustment();
  const invalidate = useInvalidateStockAdjustmentQueries();
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');
  const [adjustmentDate, setAdjustmentDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [lineType, setLineType] = useState<AdjustmentType>('Increase');
  const [lineItemId, setLineItemId] = useState('');
  const [lineQuantity, setLineQuantity] = useState('');
  const [lineUnitCost, setLineUnitCost] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<string | null>(null);

  const isDateValid = isValidDateInput(adjustmentDate);
  const dateValidation = useValidatePostingDate(isDateValid ? adjustmentDate : today(), isDateValid);
  const saving = createDraft.isPending || createAndPost.isPending;
  const listQuery = useStockAdjustmentsList({ page: 1, limit: 50, status: 'Posted' });
  const detailQuery = useStockAdjustmentDetail(selectedAdjustmentId);

  const warehouses = useMemo(() => (supportQuery.data?.warehouses ?? []).map((warehouse: any) => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}${warehouse.branch_name ? ` (${warehouse.branch_name})` : ''}`,
    searchText: `${warehouse.code} ${warehouse.name} ${warehouse.branch_name ?? ''}`,
    isDefault: warehouse.is_default,
    useLocations: Boolean(warehouse.use_locations),
  })), [supportQuery.data?.warehouses]);
  const selectedWarehouse = warehouses.find((warehouse: any) => warehouse.value === warehouseId);
  const locations = useMemo(() => locationOptions(supportQuery.data?.locations ?? [], warehouseId), [supportQuery.data?.locations, warehouseId]);
  const items = useMemo(() => (supportQuery.data?.items ?? []).map((item: any) => ({
    value: item.id,
    label: `${item.item_code} - ${item.item_name}`,
    searchText: `${item.item_code} ${item.item_name}`,
    itemCode: item.item_code,
    itemName: item.item_name,
    uomName: item.uom_name ?? '',
    stockOnHand: item.stock_on_hand ?? '0',
    averageCost: item.average_cost ?? '0',
  })), [supportQuery.data?.items]);
  const selectedItem = items.find(item => item.value === lineItemId);
  const totalQuantityIn = lines.filter(line => line.adjustmentType === 'Increase').reduce((sum, line) => sum + numericValue(line.quantity), 0);
  const totalQuantityOut = lines.filter(line => line.adjustmentType === 'Decrease').reduce((sum, line) => sum + numericValue(line.quantity), 0);
  const totalCostIn = lines.filter(line => line.adjustmentType === 'Increase').reduce((sum, line) => sum + numericValue(line.quantity) * numericValue(line.unitCost), 0);
  const totalCostOut = lines.filter(line => line.adjustmentType === 'Decrease').reduce((sum, line) => sum + numericValue(line.quantity) * numericValue(line.unitCost), 0);

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(warehouses.find((warehouse: any) => warehouse.isDefault)?.value ?? warehouses[0].value);
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (!selectedWarehouse?.useLocations) {
      setLocationId('');
      return;
    }
    if (locationId && locations.some((location: any) => location.value === locationId)) return;
    setLocationId(locations.find((location: any) => location.isDefault)?.value ?? '');
  }, [locationId, locations, selectedWarehouse?.useLocations]);

  useEffect(() => {
    if (!selectedItem || editingLineId) return;
    setLineUnitCost(selectedItem.averageCost);
  }, [editingLineId, lineItemId, selectedItem]);

  useEffect(() => {
    if (supportQuery.error) setMessage({ kind: 'error', text: friendlyErrorMessage(supportQuery.error, 'Unable to load Stock Adjustment setup.') });
  }, [supportQuery.error]);

  function resetForm() {
    setAdjustmentDate(today());
    setWarehouseId(warehouses.find((warehouse: any) => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setLocationId('');
    setReferenceNumber('');
    setReason('');
    setDescription('');
    setLineType('Increase');
    setLineItemId('');
    setLineQuantity('');
    setLineUnitCost('');
    setLineDescription('');
    setLines([]);
    setEditingLineId(null);
    setMessage(null);
  }

  function validateForm() {
    if (!isDateValid) return 'Adjustment Date is not valid.';
    if (dateValidation.data && !dateValidation.data.canPost) return `Adjustment Date: ${dateValidation.data.reason}`;
    if (!warehouseId) return 'Warehouse is required.';
    if (selectedWarehouse?.useLocations && !locationId) return 'Location is required because Warehouse uses Locations.';
    if (lines.length === 0) return 'Add at least one adjustment item.';
    const invalidLine = lines.find(line => numericValue(line.quantity) <= 0);
    if (invalidLine) return `Quantity must be greater than zero for ${invalidLine.itemCode}.`;
    const negativeCostLine = lines.find(line => numericValue(line.unitCost) < 0);
    if (negativeCostLine) return `Unit Cost cannot be negative for ${negativeCostLine.itemCode}.`;
    const lowStockLine = lines.find(line => line.adjustmentType === 'Decrease' && numericValue(line.quantity) > numericValue(line.stockOnHand));
    if (lowStockLine) return `Available Stock is not enough for ${lowStockLine.itemCode}.`;
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
    if (lineType === 'Decrease' && numericValue(lineQuantity) > numericValue(selectedItem.stockOnHand)) {
      setMessage({ kind: 'error', text: `Available Stock is ${formatNumber(selectedItem.stockOnHand, generalSettings)}.` });
      return;
    }

    const savedLine: AdjustmentLine = {
      id: editingLineId ?? Date.now(),
      adjustmentType: lineType,
      itemId: selectedItem.value,
      itemCode: selectedItem.itemCode,
      itemName: selectedItem.itemName,
      uomName: selectedItem.uomName,
      quantity: lineQuantity,
      unitCost: lineUnitCost || selectedItem.averageCost || '0',
      stockOnHand: selectedItem.stockOnHand,
      description: lineDescription,
    };
    setLines(current => {
      const withoutDuplicateItemType = current.filter(line =>
        line.id === savedLine.id || !(line.itemId === savedLine.itemId && line.adjustmentType === savedLine.adjustmentType),
      );
      if (editingLineId) return withoutDuplicateItemType.map(line => line.id === editingLineId ? savedLine : line);
      return [...withoutDuplicateItemType, savedLine];
    });
    setLineItemId('');
    setLineQuantity('');
    setLineUnitCost('');
    setLineDescription('');
    setEditingLineId(null);
    setMessage(null);
  }

  function editLine(line: AdjustmentLine) {
    setEditingLineId(line.id);
    setLineType(line.adjustmentType);
    setLineItemId(line.itemId);
    setLineQuantity(line.quantity);
    setLineUnitCost(line.unitCost);
    setLineDescription(line.description);
    setMessage(null);
  }

  function cancelLineEdit() {
    setEditingLineId(null);
    setLineType('Increase');
    setLineItemId('');
    setLineQuantity('');
    setLineUnitCost('');
    setLineDescription('');
  }

  function removeLine(id: number) {
    setLines(current => current.filter(item => item.id !== id));
    if (editingLineId === id) cancelLineEdit();
  }

  function buildPayload(): StockAdjustmentPayload {
    return {
      adjustment_date: adjustmentDate,
      warehouse_id: warehouseId,
      location_id: locationId || undefined,
      reference_number: referenceNumber.trim(),
      reason: reason.trim(),
      description: description.trim(),
      lines: lines.map(line => ({
        adjustment_type: line.adjustmentType,
        item_id: line.itemId,
        quantity: numericValue(line.quantity),
        unit_cost: numericValue(line.unitCost),
        description: line.description,
      })),
    };
  }

  async function saveAdjustment(postNow: boolean) {
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
      setMessage({ kind: 'success', text: postNow ? `${result.adjustment_number} posted successfully.` : `${result.adjustment_number} saved as Draft.` });
      if (postNow) setViewMode('list');
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Stock Adjustment.') });
    }
  }

  if (viewMode === 'list') {
    return (
      <main style={pageShellStyle}>
        <Toolbar title="Stock Adjustments" subtitle="Posted inventory increases and decreases">
          <button className="btn-ghost" type="button" onClick={() => listQuery.refetch()}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-primary" type="button" onClick={() => { resetForm(); setViewMode('entry'); }}><IconFilePlus size={15} /> New Adjustment</button>
        </Toolbar>
        {message && <MessageBanner message={message} />}
        <section style={workspaceStyle}>
          <div style={{ minWidth: 0, overflow: 'auto', border: '1px solid var(--color-border)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <HeaderCell width={150}>Adjustment Number</HeaderCell>
                  <HeaderCell width={115}>Date</HeaderCell>
                  <HeaderCell>Warehouse</HeaderCell>
                  <HeaderCell>Reason</HeaderCell>
                  <HeaderCell width={110} right>Qty In</HeaderCell>
                  <HeaderCell width={110} right>Qty Out</HeaderCell>
                  <HeaderCell width={100}>Status</HeaderCell>
                  <HeaderCell width={70}>View</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {listQuery.isFetching && <EmptyRow colSpan={8} text="Loading Stock Adjustments..." />}
                {!listQuery.isFetching && (listQuery.data?.data ?? []).length === 0 && <EmptyRow colSpan={8} text="No posted Stock Adjustments found." />}
                {!listQuery.isFetching && (listQuery.data?.data ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td style={bodyCellStyle(true)}>{row.adjustment_number}</td>
                    <td style={bodyCellStyle()}>{formatDate(row.adjustment_date, generalSettings)}</td>
                    <td style={bodyCellStyle()}>{row.warehouse_code} - {row.warehouse_name}</td>
                    <td style={bodyCellStyle()}>{row.reason || '-'}</td>
                    <td style={amountCellStyle}>{formatNumber(row.total_quantity_in, generalSettings)}</td>
                    <td style={amountCellStyle}>{formatNumber(row.total_quantity_out, generalSettings)}</td>
                    <td style={bodyCellStyle()}><StatusBadge>{row.status}</StatusBadge></td>
                    <td style={bodyCellStyle()}><button className="btn-ghost" style={iconButtonStyle} onClick={() => setSelectedAdjustmentId(row.id)}><IconEye size={14} /></button></td>
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
      <Toolbar title="New Stock Adjustment" subtitle="Adjust stock quantity with an auditable posted movement">
        <button className="btn-ghost" type="button" onClick={() => setViewMode('list')}>Cancel</button>
        <button className="btn-ghost" type="button" onClick={() => saveAdjustment(false)} disabled={saving}>Save Draft</button>
        <button className="btn-primary" type="button" onClick={() => {
          const validationMessage = validateForm();
          if (validationMessage) setMessage({ kind: 'error', text: validationMessage });
          else setConfirmOpen(true);
        }} disabled={saving}><IconCheck size={15} /> Process</button>
      </Toolbar>
      {message && <MessageBanner message={message} />}
      <section style={entryCardStyle}>
        <div style={headerGridStyle}>
          <DateField label="Adjustment Date" required value={adjustmentDate} onChange={setAdjustmentDate} />
          <FieldLabel label="Warehouse" required>
            <SearchableSelect value={warehouseId} options={warehouses} onChange={value => { setWarehouseId(value); setLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={supportQuery.isLoading || supportQuery.isError} />
          </FieldLabel>
          <FieldLabel label="Location" required={Boolean(selectedWarehouse?.useLocations)}>
            <SearchableSelect value={locationId} options={locations} onChange={setLocationId} placeholder={selectedWarehouse?.useLocations ? 'Search Location' : 'Optional Location'} disabled={!warehouseId || !selectedWarehouse?.useLocations} />
          </FieldLabel>
          <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Optional" />
          <TextField label="Reason" value={reason} onChange={setReason} placeholder="Count Difference, Damage, Opening Fix" />
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="Voucher Details" value={description} onChange={setDescription} placeholder="Short details for this adjustment" />
        </div>
        <div style={dateMessageStyle}>{!adjustmentDate ? '' : !isDateValid ? 'Adjustment Date is not valid.' : dateValidation.data && !dateValidation.data.canPost ? `Adjustment Date: ${dateValidation.data.reason}` : ''}</div>
      </section>

      <section style={lineEntryStyle}>
        <FieldLabel label="Type" required>
          <select className="form-input" value={lineType} onChange={event => setLineType(event.currentTarget.value as AdjustmentType)} style={{ height: 28, minHeight: 28, padding: '3px 8px', fontSize: '0.76rem' }}>
            {adjustmentTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Item" required>
          <SearchableSelect value={lineItemId} options={items} onChange={setLineItemId} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
        </FieldLabel>
        <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
        <NumericField label="Unit Cost" value={lineUnitCost} onChange={setLineUnitCost} decimalPlaces={4} disabled={lineType === 'Decrease'} />
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

      <section style={{ ...workspaceStyle, gridTemplateColumns: '1fr 260px' }}>
        <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <HeaderCell width={45}>No.</HeaderCell>
                <HeaderCell width={90}>Type</HeaderCell>
                <HeaderCell>Item</HeaderCell>
                <HeaderCell width={100} right>Quantity</HeaderCell>
                <HeaderCell width={80}>UOM</HeaderCell>
                <HeaderCell width={110} right>Unit Cost</HeaderCell>
                <HeaderCell width={120} right>Total Cost</HeaderCell>
                <HeaderCell>Description</HeaderCell>
                <HeaderCell width={90}>Actions</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <EmptyRow colSpan={9} text="No adjustment items added." />}
              {lines.map((line, index) => (
                <tr key={line.id} style={editingLineId === line.id ? { background: 'var(--color-primary-light)' } : undefined}>
                  <td style={bodyCellStyle(true)}>{index + 1}</td>
                  <td style={bodyCellStyle()}><TypeBadge type={line.adjustmentType} /></td>
                  <td style={bodyCellStyle(true)}>{line.itemCode} - {line.itemName}</td>
                  <td style={amountCellStyle}>{formatNumber(line.quantity, generalSettings)}</td>
                  <td style={bodyCellStyle()}>{line.uomName || '-'}</td>
                  <td style={amountCellStyle}>{formatMoney(numericValue(line.unitCost), generalSettings)}</td>
                  <td style={amountCellStyle}>{formatMoney(numericValue(line.quantity) * numericValue(line.unitCost), generalSettings)}</td>
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
          <SummaryValue label="Total Lines" value={String(lines.length)} />
          <SummaryValue label="Quantity In" value={formatNumber(totalQuantityIn, generalSettings)} />
          <SummaryValue label="Quantity Out" value={formatNumber(totalQuantityOut, generalSettings)} />
          <SummaryValue label="Cost In" value={formatMoney(totalCostIn, generalSettings)} />
          <SummaryValue label="Cost Out" value={formatMoney(totalCostOut, generalSettings)} />
        </aside>
      </section>
      <ConfirmDialog open={confirmOpen} title="Process Stock Adjustment?" message="This will post stock movements and update stock balances. Posted adjustments cannot be edited directly." confirmLabel="Process" onConfirm={() => saveAdjustment(true)} onCancel={() => setConfirmOpen(false)} />
    </main>
  );
}

function locationOptions(rows: any[], warehouseId: string) {
  return rows
    .filter(location => location.warehouse_id === warehouseId)
    .map(location => ({ value: location.id, label: `${location.code} - ${location.name}`, searchText: `${location.code} ${location.name}`, isDefault: location.is_default }));
}

function Toolbar({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section style={toolbarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={titleIconStyle}><IconAdjustmentsHorizontal size={20} /></div>
        <div><h1 style={titleStyle}>{title}</h1><p style={subtitleStyle}>{subtitle}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </section>
  );
}

function DetailPanel({ detail, loading, settings }: { detail: any; loading: boolean; settings: any }) {
  if (loading) return <aside style={detailStyle}>Loading Adjustment Detail...</aside>;
  if (!detail) return <aside style={detailStyle}>Select a Stock Adjustment to view detail.</aside>;
  return (
    <aside style={detailStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '0.92rem' }}>Adjustment Detail</h2>
        <button className="btn-ghost" style={iconButtonStyle} onClick={() => window.print()}><IconPrinter size={14} /></button>
      </div>
      <div style={detailGridStyle}>
        <InfoBox label="Adjustment No." value={detail.adjustment_number} />
        <InfoBox label="Date" value={formatDate(detail.adjustment_date, settings)} />
        <InfoBox label="Warehouse" value={`${detail.warehouse_code} - ${detail.warehouse_name}`} />
        <InfoBox label="Location" value={detail.location_code ? `${detail.location_code} - ${detail.location_name}` : '-'} />
        <InfoBox label="Reason" value={detail.reason || '-'} />
        <InfoBox label="Status" value={detail.status} />
      </div>
      <table style={{ ...tableStyle, marginTop: 10 }}>
        <thead><tr><HeaderCell width={38}>No.</HeaderCell><HeaderCell width={82}>Type</HeaderCell><HeaderCell>Item</HeaderCell><HeaderCell width={90} right>Qty</HeaderCell><HeaderCell width={100} right>Cost</HeaderCell></tr></thead>
        <tbody>
          {(detail.lines ?? []).map((line: any, index: number) => (
            <tr key={line.id}>
              <td style={bodyCellStyle()}>{index + 1}</td>
              <td style={bodyCellStyle()}><TypeBadge type={line.adjustment_type} /></td>
              <td style={bodyCellStyle(true)}>{line.item_code} - {line.item_name}</td>
              <td style={amountCellStyle}>{formatNumber(line.quantity, settings)}</td>
              <td style={amountCellStyle}>{formatMoney(line.total_cost, settings)}</td>
            </tr>
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

function TypeBadge({ type }: { type: AdjustmentType }) {
  const increase = type === 'Increase';
  return <span style={{ border: `1px solid ${increase ? 'rgba(22,163,74,0.26)' : 'rgba(185,28,28,0.24)'}`, background: increase ? 'rgba(22,163,74,0.12)' : 'rgba(185,28,28,0.10)', color: increase ? '#15803d' : '#b91c1c', borderRadius: 'var(--radius-full)', padding: '2px 7px', fontSize: '0.67rem', fontWeight: 850 }}>{type}</span>;
}

const pageShellStyle: CSSProperties = { height: '100%', minHeight: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' };
const toolbarStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 };
const titleIconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, #b45309, #0f766e)' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)', fontWeight: 900 };
const subtitleStyle: CSSProperties = { margin: '3px 0 0', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 750 };
const entryCardStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, flexShrink: 0 };
const headerGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '115px minmax(260px, 1fr) minmax(220px, 0.8fr) 180px minmax(260px, 1fr)', gap: 8, alignItems: 'end' };
const lineEntryStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, display: 'grid', gridTemplateColumns: '110px minmax(320px,1fr) 120px 120px minmax(240px,0.8fr) 220px', gap: 8, flexShrink: 0 };
const lineActionGroupStyle: CSSProperties = { display: 'grid', gap: 8, alignSelf: 'end' };
const linePrimaryButtonStyle: CSSProperties = { height: 28, minWidth: 110, whiteSpace: 'nowrap' };
const lineCancelButtonStyle: CSSProperties = { height: 28, padding: '4px 8px', whiteSpace: 'nowrap', justifyContent: 'center' };
const workspaceStyle: CSSProperties = { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 8, overflow: 'hidden' };
const detailStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, overflow: 'auto', minWidth: 0 };
const detailGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 };
const summaryStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const headerCellStyle: CSSProperties = { background: 'var(--color-table-head-bg)', color: 'var(--color-table-head-text)', border: '1px solid var(--color-border)', padding: '7px 8px', fontSize: '0.74rem', fontWeight: 900 };
function bodyCellStyle(strong = false): CSSProperties {
  return { border: '1px solid var(--color-border-subtle)', padding: '7px 8px', fontSize: '0.76rem', color: 'var(--color-text)', fontWeight: strong ? 850 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
}
const amountCellStyle: CSSProperties = { ...bodyCellStyle(true), textAlign: 'right', fontFamily: 'var(--font-mono)' };
const iconButtonStyle: CSSProperties = { height: 26, width: 28, minWidth: 28, padding: 0 };
const dateMessageStyle: CSSProperties = { minHeight: 17, marginTop: 6, color: 'var(--color-danger-text)', fontSize: '0.72rem', fontWeight: 700 };
