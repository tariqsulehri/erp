'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconCheck,
  IconFilePlus,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/app-settings';
import { hasPermission } from '@/lib/auth/session-user';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  placeFields,
  type StockTransferPayload,
  type TransferPlace,
  useCreateAndPostStockTransfer,
  useCreateStockTransferDraft,
  useInvalidateStockTransferQueries,
  useStockTransferSupportData,
  useStockTransferSourceStock,
  useUpdateAndPostStockTransfer,
  useUpdateStockTransferDraft,
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
import { TransferDirectionPicker } from './TransferDirectionPicker';
import { TransferList } from './TransferList';
import { TransferPlacePicker } from './TransferPlacePicker';
import { directionOf, directionOption, directionsFor, type TransferDirection } from './transfer-directions';
import { emptyPlace, locationOptions, PLACE_KIND_LABELS, placeOptions, samePlace } from './transfer-places';
import { transferFormFromDetail } from './transfer-drafts';

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
  const updateDraft = useUpdateStockTransferDraft();
  const updateAndPost = useUpdateAndPostStockTransfer();
  const invalidate = useInvalidateStockTransferQueries();
  /** The saved Draft open in the form, or null for a new transfer. */
  const [openDraft, setOpenDraft] = useState<{ id: string; transferNumber: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'entry'>('list');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        setViewMode('entry');
      }
    }
  }, []);
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

  const supportQuery = useStockTransferSupportData(source.id ? source : null);
  const sourceStockQuery = useStockTransferSourceStock(source.id ? source : null);

  const postingDateGuard = usePostingDateGuard(transferDate, 'Transfer Date');
  const newTransferGuard = usePostingDateGuard(today(), 'Transfer Date');
  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
  const actionDisabled = saving || postingDateGuard.disabled;
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking the Transfer Date…' : postingDateGuard.statusMessage;
  const newTransferDisabledReason = newTransferGuard.isChecking ? 'Checking the Transfer Date…' : newTransferGuard.statusMessage;
  // The direction (e.g. Warehouse → Branch) sets the kind of place on each side.
  const directionChoices = directionsFor(lockedSource?.kind);
  const direction = directionOf(source.kind, to.kind);

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
    if (supportQuery.error) setMessage({ kind: 'error', text: friendlyErrorMessage(supportQuery.error, 'Could not load the Stock Transfer setup. Refresh the page and try again.') });
  }, [supportQuery.error]);

  function chooseDirection(value: TransferDirection) {
    const option = directionOption(value);
    if (!lockedSource) setFrom(emptyPlace(option.from));
    setTo(emptyPlace(option.to));
  }

  function resetForm() {
    const start = directionChoices[0];
    setTransferDate(today());
    setFrom(emptyPlace(start.from));
    setTo(emptyPlace(start.to));
    setReferenceNumber('');
    setDescription('');
    setLineItemId('');
    setLineQuantity('');
    setLineDescription('');
    setLines([]);
    setEditingLineId(null);
    setMessage(null);
    setOpenDraft(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = transferFormFromDetail(detail);
    setTransferDate(form.transferDate);
    setFrom(form.from);
    setTo(form.to);
    setReferenceNumber(form.referenceNumber);
    setDescription(form.description);
    setLineItemId('');
    setLineQuantity('');
    setLineDescription('');
    setEditingLineId(null);
    // Stock figures are filled in from the From place's stock as soon as it is loaded.
    setLines(form.lines.map((line, index) => {
      const stock = sourceStockMap[line.itemId];
      return {
        ...line,
        id: Date.now() + index,
        stockOnHand: String(stock?.stockOnHand ?? 0),
        availableStock: String(stock?.availableStock ?? 0),
      };
    }));
    setOpenDraft({ id: form.id, transferNumber: form.transferNumber });
    setMessage(null);
    setViewMode('entry');
  }

  function openNewTransfer() {
    if (newTransferGuard.disabled) {
      setMessage({ kind: 'error', text: newTransferDisabledReason || 'You cannot post on this Transfer Date. Choose another date.' });
      return;
    }
    resetForm();
    setViewMode('entry');
  }

  function validateForm() {
    if (postingDateGuard.disabled) return dateStatusMessage || 'You cannot post on this Transfer Date. Choose another date.';
    if (!source.id) return `Select the From ${fromLabel}.`;
    if (!to.id) return `Select the To ${toLabel}.`;
    if (selectedFrom?.useLocations && !source.locationId) return 'Select the From Location. This Warehouse keeps stock by Location.';
    if (selectedTo?.useLocations && !to.locationId) return 'Select the To Location. This Warehouse keeps stock by Location.';
    if (samePlace(source, to)) return 'From and To must be different places.';
    if (lines.length === 0) return 'Add at least one item to transfer.';
    const invalidLine = lines.find(line => numericValue(line.quantity) <= 0);
    if (invalidLine) return `Enter a Quantity more than zero for ${invalidLine.itemCode}.`;
    const lineExceedingStock = lines.find(line => numericValue(line.quantity) > numericValue(line.availableStock));
    if (lineExceedingStock) {
      return `Not enough stock of ${lineExceedingStock.itemCode} at the From ${fromLabel}. Available: ${formatNumber(numericValue(lineExceedingStock.availableStock), generalSettings)} ${lineExceedingStock.uomName}.`;
    }
    return '';
  }

  function addLine() {
    if (!selectedItem) {
      setMessage({ kind: 'error', text: 'Select an Item.' });
      return;
    }
    const qty = numericValue(lineQuantity);
    if (qty <= 0) {
      setMessage({ kind: 'error', text: 'Enter a Quantity more than zero.' });
      return;
    }
    const available = numericValue(selectedItem.availableStock);
    if (qty > available) {
      setMessage({
        kind: 'error',
        text: `Not enough stock. You entered ${formatNumber(qty, generalSettings)}, but only ${formatNumber(available, generalSettings)} ${selectedItem.uomName} is available at the From ${fromLabel}.`,
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
      const result = openDraft
        ? postNow
          ? await updateAndPost.mutateAsync({ id: openDraft.id, input: buildPayload() })
          : await updateDraft.mutateAsync({ id: openDraft.id, input: buildPayload() })
        : postNow
          ? await createAndPost.mutateAsync(buildPayload())
          : await createDraft.mutateAsync(buildPayload());
      await invalidate();
      resetForm();
      setMessage({ kind: 'success', text: postNow ? `${result.transfer_number} posted.` : `${result.transfer_number} saved as Draft.` });
      if (postNow) setViewMode('list');
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not save the Stock Transfer. Please try again.') });
    }
  }

  if (viewMode === 'list') {
    return (
      <main className="page-shell">
        <PageHeader
          title="Stock Transfers"
          description="Stock moved between Warehouses and Branches."
          help={(
            <>
              <p>A Stock Transfer moves stock from one place to another: Warehouse → Branch, Branch → Branch, Warehouse → Warehouse, or Branch → Warehouse.</p>
              <p>Posting takes the stock out of the From place and adds it to the To place at the same cost. Your total stock value does not change.</p>
              <p>Change the Status to Draft to find saved drafts. A Draft can be opened and changed, posted, or cancelled.</p>
              <p>A posted transfer cannot be changed. To undo it, make a new transfer the other way.</p>
            </>
          )}
          actions={<Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newTransferGuard.disabled} title={newTransferDisabledReason || 'New Transfer'} onClick={openNewTransfer}>New Transfer</Button>}
        />
        {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}
        <TransferList
          settings={generalSettings}
          onOpenDraft={openSavedDraft}
          canChangeDrafts={hasPermission(session?.user.role, 'stock_transfers.edit')}
          empty={{
            title: 'No Posted Stock Transfers Yet',
            description: 'Move stock from a Warehouse to a Branch, or between any two places.',
            action: <Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newTransferGuard.disabled} title="New Transfer" onClick={openNewTransfer}>New Transfer</Button>,
          }}
        />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title={openDraft ? `Stock Transfer ${openDraft.transferNumber}` : 'New Stock Transfer'}
        description="Choose the direction, the two places, and the items to move."
        help={(
          <>
            <p>1. Choose the direction, for example Warehouse → Branch.</p>
            <p>2. Choose the From place and the To place. Some Warehouses also need a Location (shelf).</p>
            <p>3. Add each item and its quantity. You cannot move more than the From place has.</p>
            <p>Save Draft keeps it for later. Process posts it and moves the stock now. If posting is refused, nothing is saved.</p>
          </>
        )}
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
            <div className="span-all">
              <TransferDirectionPicker value={direction} options={directionChoices} onChange={chooseDirection} />
            </div>
            <DateField label="Transfer Date" required value={transferDate} onChange={setTransferDate} />
            <TransferPlacePicker
              side="From"
              place={source}
              places={fromPlaces}
              locations={fromLocations}
              loading={supportQuery.isLoading}
              disabled={supportQuery.isLoading || supportQuery.isError}
              lockedLabel={lockedSourceLabel}
              kindFixed
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
              kindFixed
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
                    <span style={{ color: 'var(--color-text-muted)' }}>Available At From Place:</span>
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
                        color: 'var(--color-primary-text)',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Use All Available
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <NumericField label="Quantity" required value={lineQuantity} onChange={setLineQuantity} decimalPlaces={4} />
              {selectedItem && numericValue(lineQuantity) > currentAvailableStock && (
                <p className="form-error" style={{ margin: '4px 0 0 0' }}>
                  More than available ({formatNumber(currentAvailableStock, generalSettings)})
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
                <th style={{ width: 90 }}>Unit</th>
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
                        <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                          More Than Stock
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
        message="This moves the stock now and updates both places. You cannot change a posted transfer."
        confirmLabel="Process"
        loading={saving}
        onConfirm={() => saveTransfer(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
