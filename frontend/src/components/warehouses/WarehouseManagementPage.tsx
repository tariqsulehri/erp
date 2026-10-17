'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft, IconCheck, IconPencil, IconPlus, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { useGeneralSettings } from '@/lib/api/settings';
import { useBranchesList } from '@/lib/api/branches';
import {
  type WarehouseLocationPayload,
  type WarehouseLocationRow,
  type WarehousePayload,
  type WarehouseRow,
  type WarehouseStockRow,
  useCreateWarehouse,
  useCreateWarehouseLocation,
  useUpdateWarehouse,
  useUpdateWarehouseLocation,
  useWarehouseLocations,
  useWarehousesList,
  useWarehouseStockSummary,
  warehousesQueryKey,
} from '@/lib/api/warehouses';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

type ViewMode = 'list' | 'form';
type StatusFilter = 'All' | 'Active' | 'Inactive';
type Notice = { tone: 'success' | 'danger'; text: string } | null;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY_WAREHOUSE_FORM = {
  code: '',
  name: '',
  description: '',
  address: '',
  branch_id: '',
  is_default: false,
  use_locations: false,
  is_active: true,
};

const EMPTY_LOCATION_FORM = {
  code: '',
  name: '',
  description: '',
  is_default: false,
  is_active: true,
};

export default function WarehouseManagementPage() {
  const queryClient = useQueryClient();
  const { data: generalSettings } = useGeneralSettings();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE_FORM);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION_FORM);
  const [editingLocationId, setEditingLocationId] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [page, setPage] = useState(1);
  const [stockSearchText, setStockSearchText] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  const warehousesQuery = useWarehousesList({ page, limit: 50, search: search.trim() || undefined, status });
  const branchesQuery = useBranchesList({ page: 1, limit: 200, status: 'Active' });
  const locationsQuery = useWarehouseLocations(selectedWarehouseId || undefined);
  const stockQuery = useWarehouseStockSummary(selectedWarehouseId || undefined, { page: 1, limit: 100, search: stockSearch.trim() || undefined });
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const createLocation = useCreateWarehouseLocation();
  const updateLocation = useUpdateWarehouseLocation();

  const selectedWarehouse = useMemo(() => {
    return warehousesQuery.data?.data.find(row => row.id === selectedWarehouseId);
  }, [selectedWarehouseId, warehousesQuery.data?.data]);

  const branchOptions = useMemo(() => [
    { value: '', label: 'No Branch', searchText: '' },
    ...(branchesQuery.data?.data ?? []).map(branch => ({ value: branch.id, label: `${branch.code} - ${branch.name}`, searchText: `${branch.code} ${branch.name}` })),
  ], [branchesQuery.data?.data]);

  const savingWarehouse = createWarehouse.isPending || updateWarehouse.isPending;
  const savingLocation = createLocation.isPending || updateLocation.isPending;

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: warehousesQueryKey });
  }

  function applySearch() {
    setSearch(searchText.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchText('');
    setSearch('');
    setPage(1);
  }

  function applyStockSearch() {
    setStockSearch(stockSearchText.trim());
  }

  function clearStockSearch() {
    setStockSearchText('');
    setStockSearch('');
  }

  function openNewWarehouse() {
    setSelectedWarehouseId('');
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setLocationForm(EMPTY_LOCATION_FORM);
    setEditingLocationId('');
    setNotice(null);
    setViewMode('form');
  }

  function openEditWarehouse(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setWarehouseForm({
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description ?? '',
      address: warehouse.address ?? '',
      branch_id: warehouse.branch_id ?? '',
      is_default: warehouse.is_default,
      use_locations: warehouse.use_locations,
      is_active: warehouse.is_active,
    });
    setLocationForm(EMPTY_LOCATION_FORM);
    setEditingLocationId('');
    setNotice(null);
    setViewMode('form');
  }

  function closeForm() {
    setViewMode('list');
    setSelectedWarehouseId('');
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setLocationForm(EMPTY_LOCATION_FORM);
    setEditingLocationId('');
    setNotice(null);
  }

  function validateWarehouse() {
    if (!warehouseForm.code.trim()) return 'Enter a Warehouse Code.';
    if (!warehouseForm.name.trim()) return 'Enter a Warehouse Name.';
    return '';
  }

  function saveWarehouse() {
    const validationMessage = validateWarehouse();
    if (validationMessage) {
      setNotice({ tone: 'danger', text: validationMessage });
      return;
    }
    const payload: WarehousePayload = {
      code: warehouseForm.code.trim().toUpperCase(),
      name: warehouseForm.name.trim(),
      description: warehouseForm.description.trim(),
      address: warehouseForm.address.trim(),
      branch_id: warehouseForm.branch_id,
      is_default: warehouseForm.is_default,
      use_locations: warehouseForm.use_locations,
      is_active: warehouseForm.is_active,
    };

    setNotice(null);
    if (selectedWarehouseId) {
      updateWarehouse.mutate(
        { id: selectedWarehouseId, data: payload },
        {
          onSuccess: () => {
            refreshAll();
            setNotice({ tone: 'success', text: `Warehouse ${payload.code} saved.` });
          },
          onError: error => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Unable to save Warehouse.') }),
        },
      );
      return;
    }

    createWarehouse.mutate(payload, {
      onSuccess: warehouse => {
        refreshAll();
        openEditWarehouse(warehouse);
        setNotice({ tone: 'success', text: `Warehouse ${warehouse.code} created. You can now add its Locations.` });
      },
      onError: error => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Unable to create Warehouse.') }),
    });
  }

  function validateLocation() {
    if (!selectedWarehouseId) return 'Save the Warehouse first, then add its Locations.';
    if (!locationForm.code.trim()) return 'Enter a Location Code.';
    if (!locationForm.name.trim()) return 'Enter a Location Name.';
    return '';
  }

  function saveLocation() {
    const validationMessage = validateLocation();
    if (validationMessage) {
      setNotice({ tone: 'danger', text: validationMessage });
      return;
    }

    const payload: WarehouseLocationPayload = {
      code: locationForm.code.trim().toUpperCase(),
      name: locationForm.name.trim(),
      description: locationForm.description.trim(),
      is_default: locationForm.is_default,
      is_active: locationForm.is_active,
    };

    setNotice(null);
    const onSuccess = () => {
      refreshAll();
      setLocationForm(EMPTY_LOCATION_FORM);
      setEditingLocationId('');
      setNotice({ tone: 'success', text: `Location ${payload.code} saved.` });
    };
    const onError = (error: Error) => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Unable to save Warehouse Location.') });

    if (editingLocationId) {
      updateLocation.mutate({ id: editingLocationId, data: payload }, { onSuccess, onError });
    } else {
      createLocation.mutate({ warehouseId: selectedWarehouseId, data: payload }, { onSuccess, onError });
    }
  }

  function editLocation(location: WarehouseLocationRow) {
    setEditingLocationId(location.id);
    setLocationForm({
      code: location.code,
      name: location.name,
      description: location.description ?? '',
      is_default: location.is_default,
      is_active: location.is_active,
    });
    setNotice(null);
  }

  function resetLocationForm() {
    setEditingLocationId('');
    setLocationForm(EMPTY_LOCATION_FORM);
  }

  const listError = friendlyErrorMessage(warehousesQuery.error, '');
  const detailError = friendlyErrorMessage(locationsQuery.error, '') || friendlyErrorMessage(stockQuery.error, '');
  const isFiltered = Boolean(search) || status !== 'All';
  const total = warehousesQuery.data?.pagination.total ?? 0;
  const noWarehouse = !selectedWarehouseId;

  if (viewMode === 'form') {
    return (
      <main className="page-shell">
        <PageHeader
          title={selectedWarehouseId ? `Edit Warehouse ${warehouseForm.code}` : 'New Warehouse'}
          description={selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : 'A Warehouse is a place where stock is kept. Stock transactions always name a Warehouse.'}
          actions={(
            <>
              <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={closeForm}>Back To List</Button>
              <Button variant="primary" icon={<IconCheck size={16} stroke={1.8} />} onClick={saveWarehouse} loading={savingWarehouse}>Save Warehouse</Button>
            </>
          )}
        />

        {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}
        {detailError && <InlineAlert tone="danger">{detailError}</InlineAlert>}

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="panel" style={{ flexShrink: 0 }}>
            <div className="panel-body">
              <div className="form-section">
                <h2 className="form-section-title">Warehouse Details</h2>
                <div className="form-grid">
                  <TextField label="Warehouse Code" required value={warehouseForm.code} onChange={value => setWarehouseForm(form => ({ ...form, code: value.toUpperCase() }))} placeholder="WH-001" />
                  <div className="span-2">
                    <TextField label="Warehouse Name" required value={warehouseForm.name} onChange={value => setWarehouseForm(form => ({ ...form, name: value }))} placeholder="Main Warehouse" />
                  </div>
                  <FieldLabel label="Branch">
                    <SearchableSelect
                      value={warehouseForm.branch_id}
                      options={branchOptions}
                      onChange={value => setWarehouseForm(form => ({ ...form, branch_id: value }))}
                      placeholder={branchesQuery.isLoading ? 'Loading Branches' : 'Search Branch'}
                      disabled={branchesQuery.isLoading}
                    />
                  </FieldLabel>
                  <div className="span-2">
                    <TextareaField label="Address" value={warehouseForm.address} onChange={value => setWarehouseForm(form => ({ ...form, address: value }))} rows={2} />
                  </div>
                  <div className="span-2">
                    <TextareaField label="Description" value={warehouseForm.description} onChange={value => setWarehouseForm(form => ({ ...form, description: value }))} rows={2} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2 className="form-section-title">Settings</h2>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <CheckboxField label="Default Warehouse" checked={warehouseForm.is_default} onChange={value => setWarehouseForm(form => ({ ...form, is_default: value }))} />
                  <CheckboxField label="Use Locations" checked={warehouseForm.use_locations} onChange={value => setWarehouseForm(form => ({ ...form, use_locations: value }))} />
                  <CheckboxField label="Active" checked={warehouseForm.is_active} onChange={value => setWarehouseForm(form => ({ ...form, is_active: value }))} />
                </div>
                <p className="form-hint">The Default Warehouse is selected first on new stock transactions. Use Locations lets you track stock by shelf, rack, or bin inside this Warehouse.</p>
              </div>
            </div>
          </section>

          <section className="panel" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Warehouse Locations</h2>
            </div>
            <div className="panel-body">
              {noWarehouse && <p className="form-hint" style={{ marginTop: 0, marginBottom: 12 }}>Save the Warehouse first, then add its Locations.</p>}
              <div className="form-grid">
                <TextField label="Location Code" required value={locationForm.code} disabled={noWarehouse} onChange={value => setLocationForm(form => ({ ...form, code: value.toUpperCase() }))} placeholder="RACK-01" />
                <TextField label="Location Name" required value={locationForm.name} disabled={noWarehouse} onChange={value => setLocationForm(form => ({ ...form, name: value }))} />
                <div className="span-2">
                  <TextField label="Description" value={locationForm.description} disabled={noWarehouse} onChange={value => setLocationForm(form => ({ ...form, description: value }))} />
                </div>
                <div className="span-all" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <CheckboxField label="Default Location" checked={locationForm.is_default} disabled={noWarehouse} onChange={value => setLocationForm(form => ({ ...form, is_default: value }))} />
                  <CheckboxField label="Active" checked={locationForm.is_active} disabled={noWarehouse} onChange={value => setLocationForm(form => ({ ...form, is_active: value }))} />
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {editingLocationId && (
                      <Button variant="ghost" icon={<IconX size={16} stroke={1.8} />} onClick={resetLocationForm}>Cancel Edit</Button>
                    )}
                    <Button variant="secondary" icon={<IconCheck size={16} stroke={1.8} />} onClick={saveLocation} disabled={noWarehouse} loading={savingLocation}>
                      {editingLocationId ? 'Save Location Changes' : 'Add Location'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="table-scroll" style={{ maxHeight: 240, borderTop: '1px solid var(--color-border-subtle)' }}>
              <LocationsTable rows={locationsQuery.data ?? []} loading={locationsQuery.isLoading && !noWarehouse} noWarehouse={noWarehouse} editingId={editingLocationId} onEdit={editLocation} />
            </div>
          </section>

          <section className="panel" style={{ flexShrink: 0, minHeight: 280 }}>
            <div className="panel-header">
              <h2 className="panel-title">Stock Summary</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 280 }}>
                  <SearchField label="Search Stock" value={stockSearchText} onChange={setStockSearchText} onSubmit={applyStockSearch} placeholder="Search Item Or Location" />
                </div>
                <Button variant="secondary" size="sm" icon={<IconSearch size={16} stroke={1.8} />} onClick={applyStockSearch} disabled={noWarehouse} loading={stockQuery.isFetching && !stockQuery.isLoading}>Search</Button>
                {(stockSearch || stockSearchText) && <Button variant="ghost" size="sm" onClick={clearStockSearch}>Clear</Button>}
              </div>
            </div>
            <div className="table-scroll">
              <StockSummaryTable rows={stockQuery.data?.data ?? []} loading={stockQuery.isLoading && !noWarehouse} noWarehouse={noWarehouse} isFiltered={Boolean(stockSearch)} settings={generalSettings} />
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Warehouses"
        description="Places where stock is kept. Each Warehouse can belong to a Branch and can use Locations such as racks or bins."
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshAll} loading={warehousesQuery.isFetching && !warehousesQuery.isLoading}>Refresh</Button>
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNewWarehouse}>New Warehouse</Button>
          </>
        )}
      />

      {listError && <InlineAlert tone="danger">{listError}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField
              label="Search Warehouses"
              value={searchText}
              onChange={setSearchText}
              onSubmit={applySearch}
              placeholder="Search by Code, Name, or Address, then press Enter"
            />
          </div>
          <SegmentedControl label="Status Filter" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          {(search || searchText) && <Button variant="ghost" onClick={clearSearch}>Clear</Button>}
        </div>

        <div className="table-scroll">
          <WarehouseTable
            rows={warehousesQuery.data?.data ?? []}
            loading={warehousesQuery.isLoading}
            isFiltered={isFiltered}
            onEdit={openEditWarehouse}
            onNew={openNewWarehouse}
            settings={generalSettings}
          />
        </div>

        <PaginationBar
          page={page}
          totalPages={warehousesQuery.data?.pagination.pages || 1}
          totalRecords={total}
          recordLabel={total === 1 ? 'Warehouse' : 'Warehouses'}
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}

function WarehouseTable({ rows, loading, isFiltered, onEdit, onNew, settings }: {
  rows: WarehouseRow[];
  loading: boolean;
  isFiltered: boolean;
  onEdit: (row: WarehouseRow) => void;
  onNew: () => void;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
      <thead>
        <tr>
          <th style={{ width: 110 }}>Code</th>
          <th>Warehouse Name</th>
          <th style={{ width: 190 }}>Branch</th>
          <th>Address</th>
          <th style={{ width: 110 }}>Locations</th>
          <th style={{ width: 100 }}>Status</th>
          <th className="num" style={{ width: 130 }}>Stock On Hand</th>
          <th className="num" style={{ width: 150 }}>Stock Value</th>
          <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {loading && <TableMessageRow colSpan={9} title="Loading Warehouses…" loading />}
        {!loading && rows.length === 0 && (
          isFiltered
            ? <TableMessageRow colSpan={9} title="No Warehouses Match" description="Change the search text or the status filter to see more Warehouses." />
            : <TableMessageRow colSpan={9} title="No Warehouses Yet" description="Add your first Warehouse so stock can be received and issued." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={onNew}>New Warehouse</Button>} />
        )}
        {!loading && rows.map(row => (
          <tr key={row.id} onDoubleClick={() => onEdit(row)}>
            <td className="cell-strong">{row.code}</td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                {row.is_default && <Badge variant="info">Default</Badge>}
              </span>
            </td>
            <td className={row.branch ? undefined : 'cell-muted'}>{row.branch ? `${row.branch.code} - ${row.branch.name}` : 'Not Set'}</td>
            <td className={row.address ? undefined : 'cell-muted'}>{row.address || 'Not Set'}</td>
            <td className={row.use_locations ? undefined : 'cell-muted'}>{row.use_locations ? <Badge variant="info">Enabled</Badge> : 'Not Used'}</td>
            <td><Badge variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge></td>
            <td className="num">{formatNumber(row.stock_on_hand ?? 0, settings)}</td>
            <td className="num">{formatMoney(row.total_stock_value ?? 0, settings)}</td>
            <td className="cell-actions">
              <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => onEdit(row)} aria-label={`Edit Warehouse ${row.code}`} title="Edit Warehouse" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LocationsTable({ rows, loading, noWarehouse, editingId, onEdit }: {
  rows: WarehouseLocationRow[];
  loading: boolean;
  noWarehouse: boolean;
  editingId: string;
  onEdit: (row: WarehouseLocationRow) => void;
}) {
  return (
    <table className="data-table" style={{ tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ width: 130 }}>Code</th>
          <th>Location Name</th>
          <th>Description</th>
          <th style={{ width: 100 }}>Status</th>
          <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {loading && <TableMessageRow colSpan={5} title="Loading Locations…" loading />}
        {!loading && rows.length === 0 && (
          noWarehouse
            ? <TableMessageRow colSpan={5} title="No Locations Yet" description="Save the Warehouse first, then add its Locations here." />
            : <TableMessageRow colSpan={5} title="No Locations Yet" description="Enter a Location Code and Name above, then choose Add Location." />
        )}
        {!loading && rows.map(row => (
          <tr key={row.id} className={editingId === row.id ? 'is-selected' : undefined} onDoubleClick={() => onEdit(row)}>
            <td className="cell-strong">{row.code}</td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                {row.is_default && <Badge variant="info">Default</Badge>}
              </span>
            </td>
            <td className={row.description ? undefined : 'cell-muted'}>{row.description || 'Not Set'}</td>
            <td><Badge variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge></td>
            <td className="cell-actions">
              <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => onEdit(row)} aria-label={`Edit Location ${row.code}`} title="Edit Location" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StockSummaryTable({ rows, loading, noWarehouse, isFiltered, settings }: {
  rows: WarehouseStockRow[];
  loading: boolean;
  noWarehouse: boolean;
  isFiltered: boolean;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1000 }}>
      <thead>
        <tr>
          <th style={{ width: 130 }}>Item Code</th>
          <th>Item Name</th>
          <th style={{ width: 170 }}>Location</th>
          <th className="num" style={{ width: 120 }}>Stock On Hand</th>
          <th className="num" style={{ width: 110 }}>Reserved</th>
          <th className="num" style={{ width: 110 }}>Available</th>
          <th className="num" style={{ width: 130 }}>Average Cost</th>
          <th className="num" style={{ width: 140 }}>Stock Value</th>
        </tr>
      </thead>
      <tbody>
        {loading && <TableMessageRow colSpan={8} title="Loading Stock Summary…" loading />}
        {!loading && rows.length === 0 && (
          noWarehouse
            ? <TableMessageRow colSpan={8} title="No Stock Yet" description="Save the Warehouse first. Stock appears here after it is received into this Warehouse." />
            : isFiltered
              ? <TableMessageRow colSpan={8} title="No Stock Matches" description="Change or clear the search text to see all stock in this Warehouse." />
              : <TableMessageRow colSpan={8} title="No Stock In This Warehouse" description="Stock appears here after a purchase, transfer, or adjustment is posted to this Warehouse." />
        )}
        {!loading && rows.map(row => (
          <tr key={row.id}>
            <td className="cell-strong">{row.sku || row.item_code}</td>
            <td>{row.item_name}</td>
            <td className={row.location_name ? undefined : 'cell-muted'}>{row.location_name ? `${row.location_code ?? ''} - ${row.location_name}` : 'Not Set'}</td>
            <td className="num">{formatNumber(row.stock_on_hand, settings)}</td>
            <td className="num">{formatNumber(row.reserved_stock, settings)}</td>
            <td className="num">{formatNumber(row.available_stock, settings)}</td>
            <td className="num">{formatMoney(row.average_cost, settings)}</td>
            <td className="num">{formatMoney(row.total_stock_value, settings)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
