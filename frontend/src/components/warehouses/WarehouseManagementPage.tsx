'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconBuildingWarehouse,
  IconCheck,
  IconCircleX,
  IconEdit,
  IconMapPin,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
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
import { SelectField, TextField, fieldStyle, numericFieldStyle } from '@/components/ui/FormFields';

type ViewMode = 'list' | 'form';

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
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [page, setPage] = useState(1);
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

  const warehouseTitle = selectedWarehouseId ? 'Edit Warehouse' : 'New Warehouse';
  const savingWarehouse = createWarehouse.isPending || updateWarehouse.isPending;
  const savingLocation = createLocation.isPending || updateLocation.isPending;

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: warehousesQueryKey });
  }

  function openNewWarehouse() {
    setSelectedWarehouseId('');
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setLocationForm(EMPTY_LOCATION_FORM);
    setEditingLocationId('');
    setMessage('');
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
    setMessage('');
    setViewMode('form');
  }

  function closeForm() {
    setViewMode('list');
    setSelectedWarehouseId('');
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setLocationForm(EMPTY_LOCATION_FORM);
    setEditingLocationId('');
    setMessage('');
  }

  function validateWarehouse() {
    if (!warehouseForm.code.trim()) return 'Warehouse Code is required.';
    if (!warehouseForm.name.trim()) return 'Warehouse Name is required.';
    return '';
  }

  function saveWarehouse() {
    const validationMessage = validateWarehouse();
    if (validationMessage) {
      setMessage(validationMessage);
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

    setMessage('');
    if (selectedWarehouseId) {
      updateWarehouse.mutate(
        { id: selectedWarehouseId, data: payload },
        {
          onSuccess: () => {
            refreshAll();
            setMessage('Warehouse saved successfully.');
          },
          onError: error => setMessage(friendlyErrorMessage(error, 'Unable to save Warehouse.')),
        },
      );
      return;
    }

    createWarehouse.mutate(payload, {
      onSuccess: warehouse => {
        refreshAll();
        openEditWarehouse(warehouse);
        setMessage('Warehouse created successfully.');
      },
      onError: error => setMessage(friendlyErrorMessage(error, 'Unable to create Warehouse.')),
    });
  }

  function validateLocation() {
    if (!selectedWarehouseId) return 'Please save the Warehouse before adding Locations.';
    if (!locationForm.code.trim()) return 'Location Code is required.';
    if (!locationForm.name.trim()) return 'Location Name is required.';
    return '';
  }

  function saveLocation() {
    const validationMessage = validateLocation();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    const payload: WarehouseLocationPayload = {
      code: locationForm.code.trim().toUpperCase(),
      name: locationForm.name.trim(),
      description: locationForm.description.trim(),
      is_default: locationForm.is_default,
      is_active: locationForm.is_active,
    };

    setMessage('');
    const onSuccess = () => {
      refreshAll();
      setLocationForm(EMPTY_LOCATION_FORM);
      setEditingLocationId('');
      setMessage('Warehouse Location saved successfully.');
    };
    const onError = (error: Error) => setMessage(friendlyErrorMessage(error, 'Unable to save Warehouse Location.'));

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
    setMessage('');
  }

  function resetLocationForm() {
    setEditingLocationId('');
    setLocationForm(EMPTY_LOCATION_FORM);
  }

  const listError = friendlyErrorMessage(warehousesQuery.error, '');
  const formError = message || friendlyErrorMessage(locationsQuery.error, '') || friendlyErrorMessage(stockQuery.error, '');

  if (viewMode === 'form') {
    return (
      <main style={pageShellStyle}>
        <section style={toolbarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={titleIconStyle}><IconBuildingWarehouse size={20} stroke={1.8} /></div>
            <div>
              <h1 style={titleStyle}>{warehouseTitle}</h1>
              <p style={subtitleStyle}>{selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : 'Create a storage place for stock transactions'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-ghost" type="button" onClick={closeForm}><IconX size={15} /> Back To List</button>
            <button className="btn-primary" type="button" onClick={saveWarehouse} disabled={savingWarehouse}><IconCheck size={15} /> Save Warehouse</button>
          </div>
        </section>

        {formError && <div style={messageStyle(message.includes('successfully'))}>{formError}</div>}

        <section style={formGridStyle}>
          <div style={formCardStyle}>
            <SectionTitle icon={<IconBuildingWarehouse size={16} />} title="Warehouse Details" />
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 240px 140px 130px 90px', gap: 10, alignItems: 'end' }}>
              <TextField label="Warehouse Code" value={warehouseForm.code} required onChange={value => setWarehouseForm(form => ({ ...form, code: value.toUpperCase() }))} />
              <TextField label="Warehouse Name" value={warehouseForm.name} required onChange={value => setWarehouseForm(form => ({ ...form, name: value }))} />
              <SelectField
                label="Branch"
                value={warehouseForm.branch_id}
                placeholder="Select Branch"
                options={(branchesQuery.data?.data ?? []).map(branch => ({ value: branch.id, label: `${branch.code} - ${branch.name}` }))}
                onChange={value => setWarehouseForm(form => ({ ...form, branch_id: value }))}
              />
              <CheckField label="Default Warehouse" checked={warehouseForm.is_default} onChange={value => setWarehouseForm(form => ({ ...form, is_default: value }))} />
              <CheckField label="Use Locations" checked={warehouseForm.use_locations} onChange={value => setWarehouseForm(form => ({ ...form, use_locations: value }))} />
              <CheckField label="Active" checked={warehouseForm.is_active} onChange={value => setWarehouseForm(form => ({ ...form, is_active: value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <TextareaField label="Address" value={warehouseForm.address} onChange={value => setWarehouseForm(form => ({ ...form, address: value }))} />
              <TextareaField label="Description" value={warehouseForm.description} onChange={value => setWarehouseForm(form => ({ ...form, description: value }))} />
            </div>
          </div>

          <div style={formCardStyle}>
            <SectionTitle icon={<IconMapPin size={16} />} title="Warehouse Locations" />
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px 90px 92px', gap: 8, alignItems: 'end', marginBottom: 10 }}>
              <TextField label="Location Code" value={locationForm.code} required disabled={!selectedWarehouseId} onChange={value => setLocationForm(form => ({ ...form, code: value.toUpperCase() }))} />
              <TextField label="Location Name" value={locationForm.name} required disabled={!selectedWarehouseId} onChange={value => setLocationForm(form => ({ ...form, name: value }))} />
              <TextField label="Description" value={locationForm.description} disabled={!selectedWarehouseId} onChange={value => setLocationForm(form => ({ ...form, description: value }))} />
              <CheckField label="Default" checked={locationForm.is_default} disabled={!selectedWarehouseId} onChange={value => setLocationForm(form => ({ ...form, is_default: value }))} />
              <CheckField label="Active" checked={locationForm.is_active} disabled={!selectedWarehouseId} onChange={value => setLocationForm(form => ({ ...form, is_active: value }))} />
              <button className="btn-primary" type="button" onClick={saveLocation} disabled={!selectedWarehouseId || savingLocation} style={{ height: 28, padding: '4px 8px' }}>
                <IconCheck size={14} /> Save
              </button>
            </div>
            {editingLocationId && (
              <button className="btn-ghost" type="button" onClick={resetLocationForm} style={{ marginBottom: 8, height: 28, padding: '4px 8px' }}>
                <IconCircleX size={14} /> Clear Location Edit
              </button>
            )}
            <LocationsTable rows={locationsQuery.data ?? []} loading={locationsQuery.isFetching} onEdit={editLocation} />
          </div>

          <div style={{ ...formCardStyle, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <SectionTitle icon={<IconPackage size={16} />} title="Stock Summary" />
              <div style={{ width: 300 }}>
                <input className="form-input" value={stockSearch} placeholder="Search Item Or Location" onChange={event => setStockSearch(event.currentTarget.value)} style={fieldStyle('compact')} />
              </div>
            </div>
            <StockSummaryTable rows={stockQuery.data?.data ?? []} loading={stockQuery.isFetching} settings={generalSettings} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageShellStyle}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={titleIconStyle}><IconBuildingWarehouse size={20} stroke={1.8} /></div>
          <div>
            <h1 style={titleStyle}>Warehouse Management</h1>
            <p style={subtitleStyle}>Manage warehouses, locations, and warehouse-wise stock visibility</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-ghost" type="button" onClick={refreshAll}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-primary" type="button" onClick={openNewWarehouse}><IconPlus size={15} /> New Warehouse</button>
        </div>
      </section>

      {listError && <div style={messageStyle(false)}>{listError}</div>}

      <section style={filterBarStyle}>
        <div style={{ flex: 1 }}>
          <label className="form-label">Search</label>
          <div style={{ position: 'relative' }}>
            <IconSearch size={15} style={{ position: 'absolute', left: 9, top: 7, color: 'var(--color-text-muted)' }} />
            <input className="form-input" value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} placeholder="Warehouse Code, Name, Or Address" style={{ ...fieldStyle('compact'), paddingLeft: 30 }} />
          </div>
        </div>
        <div style={{ width: 180 }}>
          <SelectField
            label="Status"
            value={status}
            options={[{ value: 'All', label: 'All' }, { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
            onChange={value => { setStatus(value as 'All' | 'Active' | 'Inactive'); setPage(1); }}
          />
        </div>
      </section>

      <section style={listCardStyle}>
        <WarehouseTable
          rows={warehousesQuery.data?.data ?? []}
          loading={warehousesQuery.isFetching}
          onEdit={openEditWarehouse}
          settings={generalSettings}
        />
      </section>

      <footer style={paginationStyle}>
        <span>Showing {warehousesQuery.data?.data.length ?? 0} Of {warehousesQuery.data?.pagination.total ?? 0} Warehouses</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
          <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Page {page} Of {warehousesQuery.data?.pagination.pages || 1}</span>
          <button className="btn-ghost" disabled={page >= (warehousesQuery.data?.pagination.pages || 1)} onClick={() => setPage(current => current + 1)}>Next</button>
          <button className="btn-ghost" disabled={page >= (warehousesQuery.data?.pagination.pages || 1)} onClick={() => setPage(warehousesQuery.data?.pagination.pages || 1)}>Last</button>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-primary)', display: 'inline-flex' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--color-heading)', fontWeight: 850 }}>{title}</h2>
    </div>
  );
}

function CheckField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
      {label}
    </label>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="form-label">{label}</span>
      <textarea className="form-input" value={value} onChange={event => onChange(event.currentTarget.value)} rows={2} style={{ minHeight: 54, resize: 'vertical' }} />
    </label>
  );
}

function WarehouseTable({ rows, loading, onEdit, settings }: {
  rows: WarehouseRow[];
  loading: boolean;
  onEdit: (row: WarehouseRow) => void;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <HeaderCell width={110}>Code</HeaderCell>
          <HeaderCell>Warehouse Name</HeaderCell>
          <HeaderCell width={180}>Branch</HeaderCell>
          <HeaderCell>Address</HeaderCell>
          <HeaderCell width={110}>Default</HeaderCell>
          <HeaderCell width={120}>Locations</HeaderCell>
          <HeaderCell width={100}>Status</HeaderCell>
          <HeaderCell width={130} right>Stock On Hand</HeaderCell>
          <HeaderCell width={150} right>Stock Value</HeaderCell>
          <HeaderCell width={70}>Edit</HeaderCell>
        </tr>
      </thead>
      <tbody>
        {loading && <EmptyRow colSpan={10} text="Loading Warehouses..." />}
        {!loading && rows.length === 0 && <EmptyRow colSpan={10} text="No Warehouses Found." />}
        {!loading && rows.map(row => (
          <tr key={row.id}>
            <td style={bodyCellStyle(true)}>{row.code}</td>
            <td style={bodyCellStyle(true)}>{row.name}</td>
            <td style={bodyCellStyle()}>{row.branch ? `${row.branch.code} - ${row.branch.name}` : '-'}</td>
            <td style={bodyCellStyle()}>{row.address || '-'}</td>
            <td style={bodyCellStyle()}>{row.is_default ? <StatusBadge tone="blue">Default</StatusBadge> : '-'}</td>
            <td style={bodyCellStyle()}>{row.use_locations ? <StatusBadge tone="blue">Enabled</StatusBadge> : '-'}</td>
            <td style={bodyCellStyle()}><StatusBadge tone={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge></td>
            <td style={amountCellStyle}>{formatNumber(row.stock_on_hand ?? 0, settings)}</td>
            <td style={amountCellStyle}>{formatMoney(row.total_stock_value ?? 0, settings)}</td>
            <td style={bodyCellStyle()}>
              <button className="btn-ghost" type="button" onClick={() => onEdit(row)} title="Edit Warehouse" style={iconButtonStyle}><IconEdit size={14} /></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LocationsTable({ rows, loading, onEdit }: { rows: WarehouseLocationRow[]; loading: boolean; onEdit: (row: WarehouseLocationRow) => void }) {
  return (
    <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--color-border)' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <HeaderCell width={110}>Code</HeaderCell>
            <HeaderCell>Location Name</HeaderCell>
            <HeaderCell>Description</HeaderCell>
            <HeaderCell width={90}>Default</HeaderCell>
            <HeaderCell width={90}>Status</HeaderCell>
            <HeaderCell width={60}>Edit</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {loading && <EmptyRow colSpan={6} text="Loading Locations..." />}
          {!loading && rows.length === 0 && <EmptyRow colSpan={6} text="No Locations Added." />}
          {!loading && rows.map(row => (
            <tr key={row.id}>
              <td style={bodyCellStyle(true)}>{row.code}</td>
              <td style={bodyCellStyle(true)}>{row.name}</td>
              <td style={bodyCellStyle()}>{row.description || '-'}</td>
              <td style={bodyCellStyle()}>{row.is_default ? <StatusBadge tone="blue">Default</StatusBadge> : '-'}</td>
              <td style={bodyCellStyle()}><StatusBadge tone={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge></td>
              <td style={bodyCellStyle()}><button className="btn-ghost" type="button" onClick={() => onEdit(row)} style={iconButtonStyle}><IconEdit size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockSummaryTable({ rows, loading, settings }: { rows: WarehouseStockRow[]; loading: boolean; settings?: AppFormatSettingsSource | null }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <HeaderCell width={120}>Item Code</HeaderCell>
            <HeaderCell>Item Name</HeaderCell>
            <HeaderCell width={150}>Location</HeaderCell>
            <HeaderCell width={110} right>Stock On Hand</HeaderCell>
            <HeaderCell width={110} right>Reserved</HeaderCell>
            <HeaderCell width={110} right>Available</HeaderCell>
            <HeaderCell width={130} right>Average Cost</HeaderCell>
            <HeaderCell width={140} right>Stock Value</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {loading && <EmptyRow colSpan={8} text="Loading Stock Summary..." />}
          {!loading && rows.length === 0 && <EmptyRow colSpan={8} text="No Stock Found For This Warehouse." />}
          {!loading && rows.map(row => (
            <tr key={row.id}>
              <td style={bodyCellStyle(true)}>{row.sku || row.item_code}</td>
              <td style={bodyCellStyle()}>{row.item_name}</td>
              <td style={bodyCellStyle()}>{row.location_name ? `${row.location_code ?? ''} - ${row.location_name}` : '-'}</td>
              <td style={amountCellStyle}>{formatNumber(row.stock_on_hand, settings)}</td>
              <td style={amountCellStyle}>{formatNumber(row.reserved_stock, settings)}</td>
              <td style={amountCellStyle}>{formatNumber(row.available_stock, settings)}</td>
              <td style={amountCellStyle}>{formatMoney(row.average_cost, settings)}</td>
              <td style={amountCellStyle}>{formatMoney(row.total_stock_value, settings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({ children, width, right = false }: { children: ReactNode; width?: number; right?: boolean }) {
  return <th style={{ ...headerCellStyle, width, textAlign: right ? 'right' : 'left' }}>{children}</th>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} style={{ ...bodyCellStyle(), height: 70, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>{text}</td></tr>;
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: 'green' | 'gray' | 'blue' }) {
  const colors = {
    green: { bg: 'rgba(22, 163, 74, 0.12)', text: '#15803d', border: 'rgba(22, 163, 74, 0.24)' },
    gray: { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569', border: 'rgba(100, 116, 139, 0.24)' },
    blue: { bg: 'rgba(37, 99, 235, 0.12)', text: '#1d4ed8', border: 'rgba(37, 99, 235, 0.24)' },
  }[tone];
  return <span style={{ display: 'inline-flex', border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '0.68rem', fontWeight: 850 }}>{children}</span>;
}

const pageShellStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflow: 'hidden',
};

const toolbarStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  padding: '9px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
};

const titleIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  background: 'linear-gradient(135deg, #0f766e, #2563eb)',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)', fontWeight: 900 };
const subtitleStyle: CSSProperties = { margin: '3px 0 0', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 750 };

const filterBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  gap: 10,
  flexShrink: 0,
};

const listCardStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
};

const formGridStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  gap: 8,
  overflow: 'hidden',
};

const formCardStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  padding: 12,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const headerCellStyle: CSSProperties = {
  background: 'var(--color-table-header)',
  color: 'var(--color-table-header-text)',
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  fontSize: '0.74rem',
  fontWeight: 900,
};

function bodyCellStyle(strong = false): CSSProperties {
  return {
    border: '1px solid var(--color-border-subtle)',
    padding: '7px 8px',
    fontSize: '0.76rem',
    color: 'var(--color-text)',
    fontWeight: strong ? 850 : 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

const amountCellStyle: CSSProperties = {
  ...bodyCellStyle(true),
  ...numericFieldStyle('compact'),
  height: 'auto',
  minHeight: 0,
  borderRadius: 0,
  background: 'transparent',
  borderTop: '1px solid var(--color-border-subtle)',
  borderRight: '1px solid var(--color-border-subtle)',
  borderBottom: '1px solid var(--color-border-subtle)',
  borderLeft: '1px solid var(--color-border-subtle)',
};

const iconButtonStyle: CSSProperties = { height: 26, width: 28, minWidth: 28, padding: 0 };

const paginationStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  color: 'var(--color-text-muted)',
  fontSize: '0.74rem',
  fontWeight: 800,
  flexShrink: 0,
};

function messageStyle(success: boolean): CSSProperties {
  return {
    color: success ? '#15803d' : 'var(--color-danger-text)',
    fontSize: '0.74rem',
    fontWeight: 750,
    flexShrink: 0,
  };
}
