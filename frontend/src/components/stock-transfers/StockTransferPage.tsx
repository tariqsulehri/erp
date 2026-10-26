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
import { formatDate, formatNumber } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  placeFields,
  type StockTransferPayload,
  type TransferPlace,
  type TransferPlaceKind,
  useCreateAndPostStockTransfer,
  useCreateStockTransferDraft,
  useInvalidateStockTransferQueries,
  useStockTransferDetail,
  useStockTransfersList,
  useStockTransferSupportData,
  useStockTransferSourceStock,
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
import { TransferPlacePicker } from './TransferPlacePicker';
import { emptyPlace, locationOptions, PLACE_KIND_LABELS, placeName, placeOptions, samePlace } from './transfer-places';

interface TransferLine {
  id: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomName: string;
  quantity: string;
  stockOnHand: string;
  availableStock: string;
  description: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function StockTransferPage() {
  const { data: generalSettings } = useGeneralSettings();
  const createDraft = useCreateStockTransferDraft();
  const createAndPost = useCreateAndPostStockTransfer();
  const invalidate = useInvalidateStockTransferQueries();
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');
  const { data: session } = useSession();
  // Branch and Warehouse users always send from their own place; All Branches users choose both sides.
  const lockedSource = useMemo<TransferPlace | null>(() => {
    const user = session?.user;
    if (user?.accessLevel === 'BRANCH' && user.branch) return { kind: 'BRANCH', id: user.branch.id, locationId: '' };
    if (user?.accessLevel === 'WAREHOUSE' && user.warehouse) return { kind: 'WAREHOUSE', id: user.warehouse.id, locationId: '' };
    return null;
  }, [session?.user]);
  const lockedSourceLabel = session?.user.accessLevel === 'BRANCH' && session.user.branch
    ? `${session.user.branch.code} - ${session.user.branch.name}`
    : session?.user.accessLevel === 'WAREHOUSE' && session.user.warehouse
      ? `${session.user.warehouse.code} - ${session.user.warehouse.name}`
      : undefined;
  const [transferDate, setTransferDate] = useState(today());
  const [from, setFrom] = useState<TransferPlace>(emptyPlace('WAREHOUSE'));
  const [to, setTo] = useState<TransferPlace>(emptyPlace('BRANCH'));
  const source = useMemo(() => (lockedSource ? { ...lockedSource, locationId: from.locationId } : from), [from, lockedSource]);
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

  const supportQuery = useStockTransferSupportData(source.id ? source : null);
  const sourceStockQuery = useStockTransferSourceStock(source.id ? source : null);

  const postingDateGuard = usePostingDateGuard(transferDate, 'Transfer Date');
  const newTransferGuard = usePostingDateGuard(today(), 'Transfer Date');
  const saving = createDraft.isPending || createAndPost.isPending;
  const actionDisabled = saving || postingDateGuard.disabled;
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Transfer Date...' : postingDateGuard.statusMessage;
  const newTransferDisabledReason = newTransferGuard.isChecking ? 'Checking Transfer Date...' : newTransferGuard.statusMessage;
  const listQuery = useStockTransfersList({ page: 1, limit: 50, status: 'Posted' });
  const detailQuery = useStockTransferDetail(selectedTransferId);

  const fromPlaces = useMemo(() => placeOptions(supportQuery.data, source.kind), [supportQuery.data, source.kind]);
  const toPlaces = useMemo(() => placeOptions(supportQuery.data, to.kind), [supportQuery.data, to.kind]);
  const fromLocations = useMemo(() => locationOptions(supportQuery.data, source), [supportQuery.data, source]);
  const toLocations = useMemo(() => locationOptions(supportQuery.data, to), [supportQuery.data, to]);
  const selectedFrom = fromPlaces.find(place => place.value === source.id);
  const selectedTo = toPlaces.find(place => place.value === to.id);
  const fromLabel = PLACE_KIND_LABELS[source.kind];
  const toLabel = PLACE_KIND_LABELS[to.kind];

  const sourceStockMap = useMemo(() => {
    const map: Record<string, { stockOnHand: number; availableStock: number }> = {};
    for (const row of sourceStockQuery.data ?? []) {
      map[row.item_id] = {
        stockOnHand: numericValue(row.stock_on_hand),
        availableStock: numericValue(row.available_stock),
      };
    }
    return map;
  }, [sourceStockQuery.data]);

  const items = useMemo(() => (supportQuery.data?.items ?? []).map((item: any) => {
    const sourceStock = sourceStockMap[item.id];
    const available = sourceStock !== undefined
      ? sourceStock.availableStock
      : numericValue(item.available_stock ?? item.stock_on_hand ?? '0');
    const onHand = sourceStock !== undefined
      ? sourceStock.stockOnHand
      : numericValue(item.stock_on_hand ?? '0');

    const stockLabel = available > 0
      ? `Avail: ${formatNumber(available, generalSettings)} ${item.uom_name ?? ''}`.trim()
      : 'Out of Stock';

    return {
      value: item.id,
      label: `${item.item_code} - ${item.item_name} · ${stockLabel}`,
      searchText: `${item.item_code} ${item.item_name}`,
      itemCode: item.item_code,
      itemName: item.item_name,
      uomName: item.uom_name ?? '',
      stockOnHand: String(onHand),
      availableStock: String(available),
    };
  }), [supportQuery.data?.items, sourceStockMap, generalSettings]);
  const selectedItem = items.find(item => item.value === lineItemId);
  const currentAvailableStock = selectedItem ? numericValue(selectedItem.availableStock) : 0;
  const totalQuantity = lines.reduce((sum, line) => sum + numericValue(line.quantity), 0);
  const sourceInStockCount = useMemo(() => {
    return (sourceStockQuery.data ?? []).filter((r: any) => numericValue(r.available_stock) > 0).length;
  }, [sourceStockQuery.data]);

  useEffect(() => {
    setLines(prevLines => {
      if (prevLines.length === 0) return prevLines;
      return prevLines.map(line => {
        const stock = sourceStockMap[line.itemId];
        if (!stock) return line;
        return {
          ...line,
          stockOnHand: String(stock.stockOnHand),
          availableStock: String(stock.availableStock),
        };
      });
    });
  }, [sourceStockMap]);

  // Pick the default Warehouse as the source for All Branches users.
  useEffect(() => {
    if (lockedSource || from.id || fromPlaces.length === 0) return;
    setFrom(current => ({ ...current, id: fromPlaces.find(place => place.isDefault)?.value ?? fromPlaces[0].value }));
  }, [from.id, fromPlaces, lockedSource]);

  // Location-controlled Warehouses start on their default Location.
  useEffect(() => {
    if (!selectedFrom?.useLocations || from.locationId) return;
    const defaultLocation = fromLocations.find(location => location.isDefault)?.value;
    if (defaultLocation) setFrom(current => ({ ...current, locationId: defaultLocation }));
  }, [from.locationId, fromLocations, selectedFrom?.useLocations]);

  useEffect(() => {
    if (!selectedTo?.useLocations || to.locationId) return;
    const defaultLocation = toLocations.find(location => location.isDefault)?.value;
    if (defaultLocation) setTo(current => ({ ...current, locationId: defaultLocation }));
  }, [to.locationId, toLocations, selectedTo?.useLocations]);

  useEffect(() => {
    if (supportQuery.error) setMessage({ kind: 'error', text: friendlyErrorMessage(supportQuery.error, 'Unable to load Stock Transfer setup.') });
  }, [supportQuery.error]);

  function resetForm() {
    setTransferDate(today());
    setFrom(emptyPlace('WAREHOUSE'));
    setTo(emptyPlace('BRANCH'));
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
    if (!source.id) return `From ${fromLabel} is required.`;
    if (!to.id) return `To ${toLabel} is required.`;
    if (selectedFrom?.useLocations && !source.locationId) return 'From Location is required because the From Warehouse uses Locations.';
    if (selectedTo?.useLocations && !to.locationId) return 'To Location is required because the To Warehouse uses Locations.';
    if (samePlace(source, to)) return 'From and To cannot be the same place.';
    if (lines.length === 0) return 'Add at least one transfer item.';
    const invalidLine = lines.find(line => numericValue(line.quantity) <= 0);
    if (invalidLine) return `Quantity must be greater than zero for ${invalidLine.itemCode}.`;
    const lineExceedingStock = lines.find(line => numericValue(line.quantity) > numericValue(line.availableStock));
    if (lineExceedingStock) {
      return `Quantity for ${lineExceedingStock.itemCode} exceeds available stock (${formatNumber(numericValue(lineExceedingStock.availableStock), generalSettings)} ${lineExceedingStock.uomName}) at the source ${fromLabel}.`;
    }
    return '';
  }

  function addLine() {
    if (!selectedItem) {
      setMessage({ kind: 'error', text: 'Item is required.' });
      return;
    }
    const qty = numericValue(lineQuantity);
    if (qty <= 0) {
      setMessage({ kind: 'error', text: 'Quantity must be greater than zero.' });
      return;
    }
    const available = numericValue(selectedItem.availableStock);
    if (qty > available) {
      setMessage({
        kind: 'error',
        text: `Transfer quantity (${formatNumber(qty, generalSettings)}) exceeds available stock (${formatNumber(available, generalSettings)} ${selectedItem.uomName}) at the source ${fromLabel}.`,
      });
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
      availableStock: selectedItem.availableStock,
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
      ...placeFields('from', source),
      ...placeFields('to', to),
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
          description="Posted stock movements between Warehouses and Branches."
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
                    <th>From</th>
                    <th>To</th>
                    <th className="num" style={{ width: 120 }}>Total Qty</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading && <TableMessageRow colSpan={7} title="Loading Stock Transfers…" loading />}
                  {!listQuery.isLoading && rows.length === 0 && (
                    <TableMessageRow colSpan={7} title="No Posted Stock Transfers Yet" description="Move stock from a Warehouse to a Branch, or between Warehouses and Branches." action={<Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newTransferGuard.disabled} onClick={openNewTransfer}>New Transfer</Button>} />
                  )}
                  {!listQuery.isLoading && rows.map((row: any) => (
                    <tr key={row.id} className={selectedTransferId === row.id ? 'is-selected' : undefined} onClick={() => setSelectedTransferId(row.id)} style={{ cursor: 'pointer' }}>
                      <td className="cell-strong">{row.transfer_number}</td>
                      <td>{formatDate(row.transfer_date, generalSettings)}</td>
                      <td><PlaceCell kind={row.from_kind} code={row.from_code ?? row.from_warehouse_code} name={row.from_name ?? row.from_warehouse_name} /></td>
                      <td><PlaceCell kind={row.to_kind} code={row.to_code ?? row.to_warehouse_code} name={row.to_name ?? row.to_warehouse_name} /></td>
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
        description="Move stock from a Warehouse or Branch to another Warehouse or Branch."
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
            <TransferPlacePicker
              side="From"
              place={source}
              places={fromPlaces}
              locations={fromLocations}
              loading={supportQuery.isLoading}
              disabled={supportQuery.isLoading || supportQuery.isError}
              lockedLabel={lockedSourceLabel}
              onChange={place => setFrom(place)}
              hint={source.id && sourceStockQuery.isSuccess ? (
                <span className="form-hint" style={{ display: 'block' }}>
                  {sourceInStockCount} {sourceInStockCount === 1 ? 'item' : 'items'} in stock
                </span>
              ) : undefined}
            />
            <TransferPlacePicker
              side="To"
              place={to}
              places={toPlaces.filter(place => to.kind !== source.kind || place.value !== source.id || selectedFrom?.useLocations)}
              locations={toLocations}
              loading={supportQuery.isLoading}
              disabled={supportQuery.isLoading || supportQuery.isError}
              onChange={place => setTo(place)}
            />
            <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Optional" />
            <div className="span-all">
              <TextField label="Description" value={description} onChange={setDescription} placeholder="Short details for this transfer" />
            </div>
          </div>
          {dateStatusMessage && <p className="form-error">{dateStatusMessage}</p>}
        </div>
      </section>

      <section className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-header" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12, overflow: 'visible' }}>
          <div className="form-grid" style={{ flex: 1, ['--form-cols' as string]: 7 }}>
            <div className="span-3">
              <FieldLabel label="Item" required>
                <SearchableSelect value={lineItemId} options={items} onChange={setLineItemId} placeholder={supportQuery.isLoading ? 'Loading Items' : 'Search Item'} disabled={supportQuery.isLoading || supportQuery.isError} />
              </FieldLabel>
              {selectedItem && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Source Available:</span>
                    <Badge variant={currentAvailableStock > 0 ? 'success' : 'danger'}>
                      {formatNumber(currentAvailableStock, generalSettings)} {selectedItem.uomName}
                    </Badge>
                  </span>
                  {currentAvailableStock > 0 && (
                    <button
                      type="button"
                      onClick={() => setLineQuantity(String(currentAvailableStock))}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-primary-600)',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Fill Max
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
              {selectedItem && numericValue(lineQuantity) > currentAvailableStock && (
                <p className="form-error" style={{ margin: '4px 0 0 0' }}>
                  Exceeds stock ({formatNumber(currentAvailableStock, generalSettings)})
                </p>
              )}
            </div>
            <div className="span-2">
              <TextField label="Line Description" value={lineDescription} onChange={setLineDescription} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', height: '100%', paddingTop: 20 }}>
              <Button
                variant="secondary"
                onClick={addLine}
                style={{ flex: 1 }}
                disabled={!selectedItem || currentAvailableStock <= 0}
              >
                {editingLineId ? 'Update Line' : 'Add Line'}
              </Button>
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
                <th className="num" style={{ width: 130 }}>Available Stock</th>
                <th className="num" style={{ width: 130 }}>Quantity</th>
                <th style={{ width: 90 }}>UOM</th>
                <th>Description</th>
                <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && <TableMessageRow colSpan={7} title="No Items Added" description="Choose an Item and Quantity above, then select Add Line." />}
              {lines.map((line, index) => {
                const exceedsStock = numericValue(line.quantity) > numericValue(line.availableStock);
                return (
                  <tr key={line.id} className={editingLineId === line.id ? 'is-selected' : undefined}>
                    <td className="num cell-muted">{index + 1}</td>
                    <td className="cell-strong">{line.itemCode} - {line.itemName}</td>
                    <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Badge variant={numericValue(line.availableStock) > 0 ? 'neutral' : 'danger'}>
                        {formatNumber(line.availableStock, generalSettings)}
                      </Badge>
                    </td>
                    <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: exceedsStock ? 'var(--color-danger)' : undefined, fontWeight: exceedsStock ? 600 : undefined }}>
                        {formatNumber(line.quantity, generalSettings)}
                      </span>
                      {exceedsStock && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-danger)' }}>
                          Exceeds Stock
                        </span>
                      )}
                    </td>
                    <td className={line.uomName ? undefined : 'cell-muted'}>{line.uomName || 'Not Set'}</td>
                    <td className={line.description ? undefined : 'cell-muted'}>{line.description || 'Not Set'}</td>
                    <td className="cell-actions">
                      <span className="row-actions">
                        <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => editLine(line)} aria-label={`Edit Line ${index + 1}`} title="Edit Line" />
                        <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => removeLine(line.id)} aria-label={`Remove Line ${index + 1}`} title="Remove Line" />
                      </span>
                    </td>
                  </tr>
                );
              })}
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
        message="This posts the stock movements and updates the stock of both places. A posted transfer cannot be edited."
        confirmLabel="Process"
        loading={saving}
        onConfirm={() => saveTransfer(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}

/** A transfer side with its type, e.g. "MAIN - Main Warehouse" plus a Warehouse badge. */
function PlaceCell({ kind, code, name, location }: { kind?: TransferPlaceKind; code?: string | null; name?: string | null; location?: string | null }) {
  const placeKind: TransferPlaceKind = kind === 'BRANCH' ? 'BRANCH' : 'WAREHOUSE';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', flexWrap: 'wrap' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeName(code, name)}{location ? ` / ${location}` : ''}</span>
      <Badge variant={placeKind === 'BRANCH' ? 'info' : 'neutral'}>{PLACE_KIND_LABELS[placeKind]}</Badge>
    </span>
  );
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
              <InfoRow label="From" value={<PlaceCell kind={detail.from_kind} code={detail.from_code ?? detail.from_warehouse_code} name={detail.from_name ?? detail.from_warehouse_name} location={detail.from_location_name} />} />
              <InfoRow label="To" value={<PlaceCell kind={detail.to_kind} code={detail.to_code ?? detail.to_warehouse_code} name={detail.to_name ?? detail.to_warehouse_name} location={detail.to_location_name} />} />
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
