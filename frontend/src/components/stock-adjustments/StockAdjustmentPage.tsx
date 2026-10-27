'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
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
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  type AdjustmentType,
  type StockAdjustmentPayload,
  type StockHolderKind,
  useCancelStockAdjustmentDraft,
  useCreateAndPostStockAdjustment,
  useCreateStockAdjustmentDraft,
  useInvalidateStockAdjustmentQueries,
  usePostStockAdjustmentDraft,
  useReverseStockAdjustment,
  useStockAdjustmentDetail,
  useStockAdjustmentsList,
  useStockAdjustmentSupportData,
  useUpdateAndPostStockAdjustment,
  useUpdateStockAdjustmentDraft,
} from '@/lib/api/stock-adjustments';
import { hasPermission } from '@/lib/auth/session-user';
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
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusChip } from '@/components/ui/StatusChip';
import { documentStatusLabel, DraftDocumentActions, ReverseDocumentAction, STOCK_DOCUMENT_STATUS_OPTIONS, type DraftActionMessage } from '@/components/documents';
import { adjustmentFormFromDetail } from './adjustment-drafts';

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
const holderKindOptions: Array<{ value: StockHolderKind; label: string }> = [
  { value: 'BRANCH', label: 'Branch' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
];
const adjustmentTypeOptions = [
  { value: 'Increase', label: 'Increase' },
  { value: 'Decrease', label: 'Decrease' },
];
type StatusFilter = 'Posted' | 'Draft' | 'Voided';

export default function StockAdjustmentPage() {
  const { data: session } = useSession();
  // Branch and Warehouse users can only adjust their own place; All Branches users choose Branch or Warehouse.
  const accessLevel = session?.user.accessLevel;
  const lockedKind: StockHolderKind | null = accessLevel === 'BRANCH' ? 'BRANCH' : accessLevel === 'WAREHOUSE' ? 'WAREHOUSE' : null;
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = useStockAdjustmentSupportData();
  const createDraft = useCreateStockAdjustmentDraft();
  const createAndPost = useCreateAndPostStockAdjustment();
  const updateDraft = useUpdateStockAdjustmentDraft();
  const updateAndPost = useUpdateAndPostStockAdjustment();
  const postDraft = usePostStockAdjustmentDraft();
  const cancelDraft = useCancelStockAdjustmentDraft();
  const invalidate = useInvalidateStockAdjustmentQueries();
  const canChangeDrafts = hasPermission(session?.user.role, 'stock_adjustments.edit');
  const canReverse = hasPermission(session?.user.role, 'stock.reverse');
  const reverseAdjustment = useReverseStockAdjustment();
  /** The saved Draft open in the form, or null for a new adjustment. */
  const [openDraft, setOpenDraft] = useState<{ id: string; adjustmentNumber: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Posted');
  const [actionMessage, setActionMessage] = useState<DraftActionMessage | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');
  const [adjustmentDate, setAdjustmentDate] = useState(today());
  const [holderKind, setHolderKind] = useState<StockHolderKind>('WAREHOUSE');
  const [branchId, setBranchId] = useState('');
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

  const postingDateGuard = usePostingDateGuard(adjustmentDate, 'Adjustment Date');
  const newAdjustmentGuard = usePostingDateGuard(today(), 'Adjustment Date');
  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
  const actionDisabled = saving || postingDateGuard.disabled;
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Adjustment Date...' : postingDateGuard.statusMessage;
  const newAdjustmentDisabledReason = newAdjustmentGuard.isChecking ? 'Checking Adjustment Date...' : newAdjustmentGuard.statusMessage;
  const listQuery = useStockAdjustmentsList({ page: 1, limit: 50, status: statusFilter });
  const detailQuery = useStockAdjustmentDetail(selectedAdjustmentId);

  const warehouses = useMemo(() => (supportQuery.data?.warehouses ?? []).map((warehouse: any) => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}`,
    searchText: `${warehouse.code} ${warehouse.name}`,
    isDefault: warehouse.is_default,
    useLocations: Boolean(warehouse.use_locations),
  })), [supportQuery.data?.warehouses]);
  const branches = useMemo(() => (supportQuery.data?.branches ?? []).map((branch: any) => ({
    value: branch.id,
    label: branch.city ? `${branch.code} - ${branch.name} (${branch.city})` : `${branch.code} - ${branch.name}`,
    searchText: `${branch.code} ${branch.name} ${branch.city ?? ''}`,
    isDefault: branch.is_default,
  })), [supportQuery.data?.branches]);
  const kind: StockHolderKind = lockedKind ?? holderKind;
  const holderId = kind === 'BRANCH' ? branchId : warehouseId;
  const selectedWarehouse = kind === 'WAREHOUSE' ? warehouses.find((warehouse: any) => warehouse.value === warehouseId) : undefined;
  const locations = useMemo(
    () => locationOptions(supportQuery.data?.locations ?? [], kind, holderId),
    [supportQuery.data?.locations, kind, holderId],
  );
  // Warehouses that use Locations need one; Branch shelves are optional when the Branch has any.
  const locationRequired = Boolean(selectedWarehouse?.useLocations);
  const locationEnabled = Boolean(holderId) && (locationRequired || (kind === 'BRANCH' && locations.length > 0));
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
    if (!branchId && branches.length > 0) setBranchId(branches.find((branch: any) => branch.isDefault)?.value ?? branches[0].value);
  }, [branchId, branches]);

  useEffect(() => {
    if (!locationEnabled) {
      setLocationId('');
      return;
    }
    if (locationId && locations.some((location: any) => location.value === locationId)) return;
    setLocationId(locationRequired ? locations.find((location: any) => location.isDefault)?.value ?? '' : '');
  }, [locationEnabled, locationId, locationRequired, locations]);

  useEffect(() => {
    if (!selectedItem || editingLineId) return;
    setLineUnitCost(selectedItem.averageCost);
  }, [editingLineId, lineItemId, selectedItem]);

  useEffect(() => {
    if (supportQuery.error) setMessage({ kind: 'error', text: friendlyErrorMessage(supportQuery.error, 'Could not load the Stock Adjustment setup. Please try again.') });
  }, [supportQuery.error]);

  function resetForm() {
    setAdjustmentDate(today());
    setWarehouseId(warehouses.find((warehouse: any) => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setBranchId(branches.find((branch: any) => branch.isDefault)?.value ?? branches[0]?.value ?? '');
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
    setOpenDraft(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = adjustmentFormFromDetail(detail);
    setAdjustmentDate(form.adjustmentDate);
    setHolderKind(form.holderKind);
    if (form.branchId) setBranchId(form.branchId);
    if (form.warehouseId) setWarehouseId(form.warehouseId);
    setLocationId(form.locationId);
    setReferenceNumber(form.referenceNumber);
    setReason(form.reason);
    setDescription(form.description);
    setLineType('Increase');
    setLineItemId('');
    setLineQuantity('');
    setLineUnitCost('');
    setLineDescription('');
    setEditingLineId(null);
    setLines(form.lines.map((line, index) => ({
      ...line,
      id: Date.now() + index,
      stockOnHand: items.find(item => item.value === line.itemId)?.stockOnHand ?? '0',
    })));
    setOpenDraft({ id: form.id, adjustmentNumber: form.adjustmentNumber });
    setSelectedAdjustmentId(null);
    setMessage(null);
    setViewMode('entry');
  }

  function openNewAdjustment() {
    if (newAdjustmentGuard.disabled) {
      setMessage({ kind: 'error', text: newAdjustmentDisabledReason || 'You cannot post on this Adjustment Date. Choose another date.' });
      return;
    }
    resetForm();
    setViewMode('entry');
  }

  function validateForm() {
    if (postingDateGuard.disabled) return dateStatusMessage || 'You cannot post on this Adjustment Date. Choose another date.';
    if (!holderId) return kind === 'BRANCH' ? 'Branch is required.' : 'Warehouse is required.';
    if (locationRequired && !locationId) return 'Location is required because this Warehouse uses Locations.';
    if (lines.length === 0) return 'Add at least one adjustment item.';
    const invalidLine = lines.find(line => numericValue(line.quantity) <= 0);
    if (invalidLine) return `Quantity must be more than zero for ${invalidLine.itemCode}.`;
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
      setMessage({ kind: 'error', text: 'Quantity must be more than zero.' });
      return;
    }
    if (lineType === 'Decrease' && numericValue(lineQuantity) > numericValue(selectedItem.stockOnHand)) {
      setMessage({ kind: 'error', text: `Not enough stock. Available Stock is ${formatNumber(selectedItem.stockOnHand, generalSettings)}.` });
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
      ...(kind === 'BRANCH' ? { branch_id: branchId } : { warehouse_id: warehouseId }),
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
      const result = openDraft
        ? postNow
          ? await updateAndPost.mutateAsync({ id: openDraft.id, input: buildPayload() })
          : await updateDraft.mutateAsync({ id: openDraft.id, input: buildPayload() })
        : postNow
          ? await createAndPost.mutateAsync(buildPayload())
          : await createDraft.mutateAsync(buildPayload());
      await invalidate();
      resetForm();
      setMessage({ kind: 'success', text: postNow ? `${result.adjustment_number} posted.` : `${result.adjustment_number} saved as Draft.` });
      if (postNow) setViewMode('list');
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not save Stock Adjustment. Please try again.') });
    }
  }

  if (viewMode === 'list') {
    const rows = listQuery.data?.data ?? [];
    return (
      <main className="page-shell">
        <PageHeader
          title="Stock Adjustments"
          help={(
            <>
              <p>This list shows posted stock adjustments. Use an adjustment to fix stock after a count, damage or loss.</p>
              <p>Select a row to see its items. Select New Adjustment to add or remove stock.</p>
              <p>Change the Status to Draft to find saved drafts. A Draft can be opened and changed, posted, or cancelled.</p>
              <p>A posted adjustment cannot be changed. A Manager can Reverse it: the stock and the ledger entry are undone on the Reversal Date.</p>
            </>
          )}
          description="Stock increases and decreases, with cost and reason."
          actions={(
            <>
              <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={() => listQuery.refetch()} loading={listQuery.isFetching && !listQuery.isLoading}>Refresh</Button>
              <Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newAdjustmentGuard.disabled} title={newAdjustmentDisabledReason} onClick={openNewAdjustment}>New Adjustment</Button>
            </>
          )}
        />
        {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}
        {actionMessage && <InlineAlert tone={actionMessage.tone} onDismiss={() => setActionMessage(null)}>{actionMessage.text}</InlineAlert>}
        <div className={`split-view${selectedAdjustmentId ? ' has-side' : ''}`}>
          <section className="panel">
            <div className="panel-header">
              <SegmentedControl<StatusFilter>
                label="Status"
                value={statusFilter}
                options={STOCK_DOCUMENT_STATUS_OPTIONS as Array<{ value: StatusFilter; label: string }>}
                onChange={value => { setStatusFilter(value); setSelectedAdjustmentId(null); }}
              />
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>Adjustment No.</th>
                    <th style={{ width: 110 }}>Date</th>
                    <th>Branch Or Warehouse</th>
                    <th>Reason</th>
                    <th className="num" style={{ width: 110 }}>Qty In</th>
                    <th className="num" style={{ width: 110 }}>Qty Out</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading && <TableMessageRow colSpan={8} title="Loading Stock Adjustments…" loading />}
                  {!listQuery.isLoading && rows.length === 0 && (
                    statusFilter === 'Posted'
                      ? <TableMessageRow colSpan={8} title="No Posted Stock Adjustments Yet" description="Record a stock count difference, damage, or opening fix with a new adjustment." action={<Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newAdjustmentGuard.disabled} onClick={openNewAdjustment}>New Adjustment</Button>} />
                      : <TableMessageRow colSpan={8} title={statusFilter === 'Draft' ? 'No Draft Stock Adjustments' : 'No Cancelled Or Reversed Stock Adjustments'} description="Choose another Status to see more adjustments." />
                  )}
                  {!listQuery.isLoading && rows.map((row: any) => (
                    <tr key={row.id} className={selectedAdjustmentId === row.id ? 'is-selected' : undefined} onClick={() => setSelectedAdjustmentId(row.id)} style={{ cursor: 'pointer' }}>
                      <td className="cell-strong">{row.adjustment_number}</td>
                      <td>{formatDate(row.adjustment_date, generalSettings)}</td>
                      <td>{holderText(row)}</td>
                      <td className={row.reason ? undefined : 'cell-muted'}>{row.reason || 'Not Set'}</td>
                      <td className="num">{formatNumber(row.total_quantity_in, generalSettings)}</td>
                      <td className="num">{formatNumber(row.total_quantity_out, generalSettings)}</td>
                      <td><StatusChip status={row.status} label={documentStatusLabel(row.status, row.posted_at)} /></td>
                      <td className="cell-actions">
                        <Button variant="ghost" size="sm" icon={<IconEye size={16} stroke={1.8} />} onClick={event => { event.stopPropagation(); setSelectedAdjustmentId(row.id); }} aria-label={`View Adjustment ${row.adjustment_number}`} title="View Adjustment" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selectedAdjustmentId && (
            <DetailPanel
              detail={detailQuery.data}
              loading={detailQuery.isFetching}
              settings={generalSettings}
              onClose={() => setSelectedAdjustmentId(null)}
              actions={detailQuery.data?.status === 'Posted' && canReverse ? (
                <ReverseDocumentAction
                  documentName="Stock Adjustment"
                  documentNumber={detailQuery.data.adjustment_number}
                  reverseEffect="Increases are taken back out and Decreases put back at the cost they were posted at, and a Reversal Voucher undoes the ledger entry."
                  onReverse={async (reversalDate, reason) => {
                    const result = await reverseAdjustment.mutateAsync({ id: detailQuery.data.id, reversalDate, reason });
                    await invalidate();
                    return result.adjustment_number;
                  }}
                  onMessage={setActionMessage}
                />
              ) : detailQuery.data?.status === 'Draft' && canChangeDrafts && (
                <DraftDocumentActions
                  documentName="Stock Adjustment"
                  documentNumber={detailQuery.data.adjustment_number}
                  postEffect="Stock and the Inventory account are updated."
                  onOpen={() => openSavedDraft(detailQuery.data)}
                  onPost={async () => {
                    const result = await postDraft.mutateAsync(detailQuery.data.id);
                    await invalidate();
                    return result.adjustment_number;
                  }}
                  onCancel={async reason => {
                    const result = await cancelDraft.mutateAsync({ id: detailQuery.data.id, reason });
                    await invalidate();
                    return result.adjustment_number;
                  }}
                  onMessage={setActionMessage}
                />
              )}
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title={openDraft ? `Stock Adjustment ${openDraft.adjustmentNumber}` : 'New Stock Adjustment'}
        help={(
          <>
            <p>Use this screen to add stock (Increase) or remove stock (Decrease) at a Branch or Warehouse.</p>
            <ul>
              <li>Choose the place, date and reason, then add one line for each item.</li>
              <li>Save Draft keeps the adjustment so you can finish it later. Find it in the list with Status Draft and select Open Draft.</li>
              <li>Process posts it and updates stock at once. If posting is refused, nothing is saved.</li>
            </ul>
            <p>You cannot remove more stock than is available. A posted adjustment cannot be changed.</p>
          </>
        )}
        description="Increase or decrease stock. Every change is recorded for checking later."
        actions={(
          <>
            <Button variant="ghost" onClick={() => setViewMode('list')}>Cancel</Button>
            <Button variant="secondary" onClick={() => saveAdjustment(false)} disabled={actionDisabled} title={dateStatusMessage}>Save Draft</Button>
            <Button
              variant="primary"
              icon={<IconCheck size={16} stroke={1.8} />}
              onClick={() => {
                const validationMessage = validateForm();
                if (validationMessage) setMessage({ kind: 'error', text: validationMessage });
                else setConfirmOpen(true);
              }}
              disabled={actionDisabled}
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
          <div className="form-grid" style={{ ['--form-cols' as string]: 5 }}>
            <DateField label="Adjustment Date" required value={adjustmentDate} onChange={setAdjustmentDate} />
            <FieldLabel label="Adjust Stock At" required>
              {lockedKind
                ? <input className="form-input" value={lockedKind === 'BRANCH' ? 'Branch' : 'Warehouse'} readOnly />
                : <SegmentedControl label="Adjust Stock At" value={holderKind} options={holderKindOptions} onChange={value => { setHolderKind(value); setLocationId(''); }} />}
            </FieldLabel>
            {kind === 'BRANCH' ? (
              <FieldLabel label="Branch" required>
                <SearchableSelect value={branchId} options={branches} onChange={value => { setBranchId(value); setLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Branches' : 'Search Branch'} disabled={Boolean(lockedKind) || supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
            ) : (
              <FieldLabel label="Warehouse" required>
                <SearchableSelect value={warehouseId} options={warehouses} onChange={value => { setWarehouseId(value); setLocationId(''); }} placeholder={supportQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={Boolean(lockedKind) || supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
            )}
            <FieldLabel label="Location" required={locationRequired}>
              <SearchableSelect value={locationId} options={locationRequired ? locations : [{ value: '', label: 'No Location', searchText: '' }, ...locations]} onChange={setLocationId} placeholder={locationEnabled ? 'Search Location' : 'Not Used'} disabled={!locationEnabled} />
            </FieldLabel>
            <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Optional" />
            <TextField label="Reason" value={reason} onChange={setReason} placeholder="Count Difference, Damage, Opening Fix" />
            <div className="span-all">
              <TextField label="Description" value={description} onChange={setDescription} placeholder="Short details for this adjustment" />
            </div>
          </div>
          {dateStatusMessage && <p className="form-error">{dateStatusMessage}</p>}
        </div>
      </section>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-header" style={{ alignItems: 'flex-end', paddingTop: 12, paddingBottom: 12, overflow: 'visible' }}>
          <div className="form-grid" style={{ flex: 1, ['--form-cols' as string]: 8 }}>
            <FieldLabel label="Type" required>
              <select className="form-input" value={lineType} onChange={event => setLineType(event.currentTarget.value as AdjustmentType)}>
                {adjustmentTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FieldLabel>
            <div className="span-2">
              <FieldLabel label="Item" required>
                <SearchableSelect value={lineItemId} options={items} onChange={setLineItemId} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
            </div>
            <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
            <NumericField label="Unit Cost" value={lineUnitCost} onChange={setLineUnitCost} decimalPlaces={4} disabled={lineType === 'Decrease'} />
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
                <th style={{ width: 100 }}>Type</th>
                <th>Item</th>
                <th className="num" style={{ width: 110 }}>Quantity</th>
                <th style={{ width: 80 }}>Unit</th>
                <th className="num" style={{ width: 120 }}>Unit Cost</th>
                <th className="num" style={{ width: 130 }}>Total Cost</th>
                <th>Description</th>
                <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <TableMessageRow colSpan={9} title="No Items Added" description="Choose a Type, Item, and Quantity above, then select Add Line." />}
              {lines.map((line, index) => (
                <tr key={line.id} className={editingLineId === line.id ? 'is-selected' : undefined}>
                  <td className="num cell-muted">{index + 1}</td>
                  <td><TypeBadge type={line.adjustmentType} /></td>
                  <td className="cell-strong">{line.itemCode} - {line.itemName}</td>
                  <td className="num">{formatNumber(line.quantity, generalSettings)}</td>
                  <td className={line.uomName ? undefined : 'cell-muted'}>{line.uomName || 'Not Set'}</td>
                  <td className="num">{formatMoney(numericValue(line.unitCost), generalSettings)}</td>
                  <td className="num">{formatMoney(numericValue(line.quantity) * numericValue(line.unitCost), generalSettings)}</td>
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
        <div className="panel-footer" style={{ justifyContent: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
          <Total label="Total Lines" value={String(lines.length)} />
          <Total label="Quantity In" value={formatNumber(totalQuantityIn, generalSettings)} />
          <Total label="Quantity Out" value={formatNumber(totalQuantityOut, generalSettings)} />
          <Total label="Cost In" value={formatMoney(totalCostIn, generalSettings)} />
          <Total label="Cost Out" value={formatMoney(totalCostOut, generalSettings)} />
        </div>
      </section>
      <ConfirmDialog open={confirmOpen} variant="primary" title="Process Stock Adjustment?" message="This posts the stock changes and updates stock balances. You cannot change a posted adjustment." confirmLabel="Process" onConfirm={() => saveAdjustment(true)} onCancel={() => setConfirmOpen(false)} />
    </main>
  );
}

function locationOptions(rows: any[], kind: StockHolderKind, holderId: string) {
  return rows
    .filter(location => (kind === 'BRANCH' ? location.branch_id : location.warehouse_id) === holderId)
    .map(location => ({ value: location.id, label: `${location.code} - ${location.name}`, searchText: `${location.code} ${location.name}`, isDefault: location.is_default }));
}

function DetailPanel({ detail, loading, settings, actions, onClose }: { detail: any; loading: boolean; settings: any; actions?: ReactNode; onClose: () => void }) {
  return (
    <aside className="panel side-panel" aria-label="Adjustment Detail">
      <div className="panel-header">
        <h2 className="panel-title">{detail?.adjustment_number ?? 'Adjustment Detail'}</h2>
        <span className="row-actions">
          {detail && <Button variant="ghost" size="sm" icon={<IconPrinter size={16} stroke={1.8} />} onClick={() => window.print()} aria-label="Print Adjustment" title="Print Adjustment" />}
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Detail" title="Close Detail" />
        </span>
      </div>
      <div className="panel-body">
        {loading && <p className="form-hint">Loading Adjustment Detail…</p>}
        {!loading && detail && (
          <>
            {actions}
            <dl className="detail-list">
              <InfoRow label="Date" value={formatDate(detail.adjustment_date, settings)} />
              <InfoRow label="Status" value={<StatusChip status={detail.status} label={documentStatusLabel(detail.status, detail.posted_at)} />} />
              {detail.status === 'Voided' && <InfoRow label={`${documentStatusLabel(detail.status, detail.posted_at)} Reason`} value={detail.void_reason || 'Not Set'} />}
              {detail.status === 'Voided' && <InfoRow label={`${documentStatusLabel(detail.status, detail.posted_at)} At`} value={detail.voided_at ? formatDate(detail.voided_at, settings) : 'Not Set'} />}
              <InfoRow label={detail.branch_id ? 'Branch' : 'Warehouse'} value={holderText(detail)} />
              <InfoRow label="Location" value={detail.location_code ? `${detail.location_code} - ${detail.location_name}` : 'Not Set'} />
              <InfoRow label="Reason" value={detail.reason || 'Not Set'} />
            </dl>
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead><tr><th className="num" style={{ width: 40 }}>No.</th><th style={{ width: 92 }}>Type</th><th>Item</th><th className="num" style={{ width: 80 }}>Qty</th><th className="num" style={{ width: 100 }}>Cost</th></tr></thead>
              <tbody>
                {(detail.lines ?? []).map((line: any, index: number) => (
                  <tr key={line.id}>
                    <td className="num cell-muted">{index + 1}</td>
                    <td><TypeBadge type={line.adjustment_type} /></td>
                    <td className="cell-strong">{line.item_code} - {line.item_name}</td>
                    <td className="num">{formatNumber(line.quantity, settings)}</td>
                    <td className="num">{formatMoney(line.total_cost, settings)}</td>
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

/** "Code - Name" of the Branch or Warehouse a list or detail row belongs to. */
function holderText(row: any) {
  return row.branch_id ? `${row.branch_code} - ${row.branch_name}` : `${row.warehouse_code} - ${row.warehouse_name}`;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{value}</dd></div>;
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
      {label} <strong style={{ color: 'var(--color-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </span>
  );
}

function TypeBadge({ type }: { type: AdjustmentType }) {
  return <Badge variant={type === 'Increase' ? 'success' : 'danger'}>{type}</Badge>;
}
