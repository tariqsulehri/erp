'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconBuildingStore, IconCheck, IconEdit, IconPlus, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { type BranchPayload, type BranchRow, branchesQueryKey, useBranchesList, useCreateBranch, useUpdateBranch } from '@/lib/api/branches';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { SelectField, TextField, fieldStyle } from '@/components/ui/FormFields';

const EMPTY_FORM = {
  code: '',
  name: '',
  manager_name: '',
  city: '',
  phone: '',
  email: '',
  address: '',
  description: '',
  is_default: false,
  is_active: true,
};

export default function BranchManagementPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [page, setPage] = useState(1);

  const branchesQuery = useBranchesList({ page, limit: 50, search: search.trim() || undefined, status });
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const saving = createBranch.isPending || updateBranch.isPending;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: branchesQueryKey });
  }

  function openNew() {
    setEditId('');
    setForm(EMPTY_FORM);
    setMessage('');
    setShowForm(true);
  }

  function openEdit(branch: BranchRow) {
    setEditId(branch.id);
    setForm({
      code: branch.code,
      name: branch.name,
      manager_name: branch.manager_name ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      address: branch.address ?? '',
      description: branch.description ?? '',
      is_default: branch.is_default,
      is_active: branch.is_active,
    });
    setMessage('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId('');
    setForm(EMPTY_FORM);
    setMessage('');
  }

  function validate() {
    if (!form.code.trim()) return 'Branch Code is required.';
    if (!form.name.trim()) return 'Branch Name is required.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email is not valid.';
    return '';
  }

  function saveBranch() {
    const validationMessage = validate();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    const payload: BranchPayload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      manager_name: form.manager_name.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      is_default: form.is_default,
      is_active: form.is_active,
    };

    const onSuccess = () => {
      refresh();
      setMessage('Branch saved successfully.');
      if (!editId) closeForm();
    };
    const onError = (error: Error) => setMessage(friendlyErrorMessage(error, 'Unable to save Branch.'));

    if (editId) updateBranch.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createBranch.mutate(payload, { onSuccess, onError });
  }

  const errorMessage = message || friendlyErrorMessage(branchesQuery.error, '');

  if (showForm) {
    return (
      <main style={pageShellStyle}>
        <section style={toolbarStyle}>
          <TitleBlock title={editId ? 'Edit Branch' : 'New Branch'} subtitle="Branch owns one or more Warehouses for branch-wise sales and stock" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" type="button" onClick={closeForm}><IconX size={15} /> Back To List</button>
            <button className="btn-primary" type="button" onClick={saveBranch} disabled={saving}><IconCheck size={15} /> Save Branch</button>
          </div>
        </section>

        {errorMessage && <div style={messageStyle(message.includes('successfully'))}>{errorMessage}</div>}

        <section style={formCardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 220px 150px 120px', gap: 10, alignItems: 'end' }}>
            <TextField label="Branch Code" value={form.code} required onChange={value => setForm(current => ({ ...current, code: value.toUpperCase() }))} />
            <TextField label="Branch Name" value={form.name} required onChange={value => setForm(current => ({ ...current, name: value }))} />
            <TextField label="Manager Name" value={form.manager_name} onChange={value => setForm(current => ({ ...current, manager_name: value }))} />
            <CheckField label="Default Branch" checked={form.is_default} onChange={value => setForm(current => ({ ...current, is_default: value }))} />
            <CheckField label="Active" checked={form.is_active} onChange={value => setForm(current => ({ ...current, is_active: value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr', gap: 10, marginTop: 10 }}>
            <TextField label="City" value={form.city} onChange={value => setForm(current => ({ ...current, city: value }))} />
            <TextField label="Phone" value={form.phone} onChange={value => setForm(current => ({ ...current, phone: value }))} />
            <TextField label="Email" value={form.email} onChange={value => setForm(current => ({ ...current, email: value }))} inputProps={{ type: 'email' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <TextareaField label="Address" value={form.address} onChange={value => setForm(current => ({ ...current, address: value }))} />
            <TextareaField label="Description" value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageShellStyle}>
      <section style={toolbarStyle}>
        <TitleBlock title="Branch Management" subtitle="Manage business branches and connect warehouses for branch-wise stock" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" type="button" onClick={refresh}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-primary" type="button" onClick={openNew}><IconPlus size={15} /> New Branch</button>
        </div>
      </section>

      {errorMessage && <div style={messageStyle(false)}>{errorMessage}</div>}

      <section style={filterBarStyle}>
        <div style={{ flex: 1 }}>
          <label className="form-label">Search</label>
          <div style={{ position: 'relative' }}>
            <IconSearch size={15} style={{ position: 'absolute', left: 9, top: 7, color: 'var(--color-text-muted)' }} />
            <input className="form-input" value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} placeholder="Branch Code, Name, City, Or Manager" style={{ ...fieldStyle('compact'), paddingLeft: 30 }} />
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
        <table style={tableStyle}>
          <thead>
            <tr>
              <HeaderCell width={120}>Code</HeaderCell>
              <HeaderCell>Branch Name</HeaderCell>
              <HeaderCell width={160}>City</HeaderCell>
              <HeaderCell width={180}>Manager</HeaderCell>
              <HeaderCell width={130}>Warehouses</HeaderCell>
              <HeaderCell width={110}>Default</HeaderCell>
              <HeaderCell width={100}>Status</HeaderCell>
              <HeaderCell width={70}>Edit</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {branchesQuery.isFetching && <EmptyRow colSpan={8} text="Loading Branches..." />}
            {!branchesQuery.isFetching && (branchesQuery.data?.data ?? []).length === 0 && <EmptyRow colSpan={8} text="No Branches Found." />}
            {!branchesQuery.isFetching && (branchesQuery.data?.data ?? []).map(branch => (
              <tr key={branch.id}>
                <td style={bodyCellStyle(true)}>{branch.code}</td>
                <td style={bodyCellStyle(true)}>{branch.name}</td>
                <td style={bodyCellStyle()}>{branch.city || '-'}</td>
                <td style={bodyCellStyle()}>{branch.manager_name || '-'}</td>
                <td style={bodyCellStyle(true)}>{branch.active_warehouse_count ?? 0}</td>
                <td style={bodyCellStyle()}>{branch.is_default ? <StatusBadge tone="blue">Default</StatusBadge> : '-'}</td>
                <td style={bodyCellStyle()}><StatusBadge tone={branch.is_active ? 'green' : 'gray'}>{branch.is_active ? 'Active' : 'Inactive'}</StatusBadge></td>
                <td style={bodyCellStyle()}><button className="btn-ghost" type="button" onClick={() => openEdit(branch)} style={iconButtonStyle}><IconEdit size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer style={paginationStyle}>
        <span>Showing {branchesQuery.data?.data.length ?? 0} Of {branchesQuery.data?.pagination.total ?? 0} Branches</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
          <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Page {page} Of {branchesQuery.data?.pagination.pages || 1}</span>
          <button className="btn-ghost" disabled={page >= (branchesQuery.data?.pagination.pages || 1)} onClick={() => setPage(current => current + 1)}>Next</button>
          <button className="btn-ghost" disabled={page >= (branchesQuery.data?.pagination.pages || 1)} onClick={() => setPage(branchesQuery.data?.pagination.pages || 1)}>Last</button>
        </div>
      </footer>
    </main>
  );
}

function TitleBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={titleIconStyle}><IconBuildingStore size={20} stroke={1.8} /></div>
      <div>
        <h1 style={titleStyle}>{title}</h1>
        <p style={subtitleStyle}>{subtitle}</p>
      </div>
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
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

function HeaderCell({ children, width }: { children: ReactNode; width?: number }) {
  return <th style={{ ...headerCellStyle, width }}>{children}</th>;
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

const pageShellStyle: CSSProperties = { height: '100%', minHeight: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' };
const toolbarStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 };
const titleIconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg, #1d4ed8, #0f766e)' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)', fontWeight: 900 };
const subtitleStyle: CSSProperties = { margin: '3px 0 0', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 750 };
const filterBarStyle: CSSProperties = { display: 'flex', alignItems: 'end', gap: 10, flexShrink: 0 };
const listCardStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', flex: 1, minHeight: 0, overflow: 'auto' };
const formCardStyle: CSSProperties = { border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 12 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const headerCellStyle: CSSProperties = { background: 'var(--color-table-header)', color: 'var(--color-table-header-text)', border: '1px solid var(--color-border)', padding: '7px 8px', fontSize: '0.74rem', fontWeight: 900, textAlign: 'left' };
function bodyCellStyle(strong = false): CSSProperties {
  return { border: '1px solid var(--color-border-subtle)', padding: '7px 8px', fontSize: '0.76rem', color: 'var(--color-text)', fontWeight: strong ? 850 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
}
const iconButtonStyle: CSSProperties = { height: 26, width: 28, minWidth: 28, padding: 0 };
const paginationStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.74rem', fontWeight: 800, flexShrink: 0 };
function messageStyle(success: boolean): CSSProperties {
  return { color: success ? '#15803d' : 'var(--color-danger-text)', fontSize: '0.74rem', fontWeight: 750, flexShrink: 0 };
}
