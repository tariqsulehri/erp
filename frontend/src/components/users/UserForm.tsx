'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { IconArrowLeft, IconCheck, IconKey } from '@tabler/icons-react';
import { useBranchesList } from '@/lib/api/branches';
import { useResetUserPassword } from '@/lib/api/users';
import { useWarehousesList } from '@/lib/api/warehouses';
import { ACCESS_LEVEL_LABELS, ROLE_LABELS, type UserRole } from '@/lib/auth/session-user';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, SelectField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { accessLevelsForRole, PASSWORD_MIN_LENGTH, withRole, type UserFormState } from './user-form-helpers';

type Notice = { tone: 'success' | 'danger'; text: string } | null;

export function UserForm({ editId, form, setForm, notice, saving, canAssignAdmin, onSave, onBack }: {
  editId: string;
  form: UserFormState;
  setForm: (updater: (current: UserFormState) => UserFormState) => void;
  notice: Notice;
  saving: boolean;
  /** Only Admin users can give the Admin role. */
  canAssignAdmin: boolean;
  onSave: (event?: FormEvent) => void;
  onBack: () => void;
}) {
  const isNew = !editId;
  const branchesQuery = useBranchesList({ limit: 200, status: 'Active' });
  const warehousesQuery = useWarehousesList({ limit: 200, status: 'Active' });

  const roleOptions = useMemo(() => (Object.keys(ROLE_LABELS) as UserRole[])
    .filter(role => canAssignAdmin || role !== 'admin' || form.role === 'admin')
    .map(role => ({ value: role, label: ROLE_LABELS[role] })), [canAssignAdmin, form.role]);

  const accessLevelOptions = accessLevelsForRole(form.role).map(level => ({ value: level, label: ACCESS_LEVEL_LABELS[level] }));

  const branchOptions = useMemo(() => (branchesQuery.data?.data ?? []).map(branch => ({
    value: branch.id,
    label: branch.city ? `${branch.code} - ${branch.name} (${branch.city})` : `${branch.code} - ${branch.name}`,
    searchText: `${branch.code} ${branch.name} ${branch.city ?? ''}`,
  })), [branchesQuery.data]);

  const warehouseOptions = useMemo(() => (warehousesQuery.data?.data ?? []).map(warehouse => ({
    value: warehouse.id,
    label: `${warehouse.code} - ${warehouse.name}`,
    searchText: `${warehouse.code} ${warehouse.name}`,
  })), [warehousesQuery.data]);

  function setField<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  return (
    <form className="page-shell" onSubmit={onSave} noValidate>
      <PageHeader
        title={isNew ? 'New User' : `Edit User ${form.full_name}`}
        description="Each user works in one Branch or one Warehouse and sees only its data. Admin and Top Management see all Branches."
        help={(
          <>
            <p>Enter the user details and click Save User. The user signs in with the Email and Password.</p>
            <p>Choose a Role, then the Branch or Warehouse where the user works. The user sees only the data of that place.</p>
            <p>Clear Active to stop a user from signing in. Use Reset Password to give a user a new password.</p>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={onBack}>Back To List</Button>
            <Button variant="primary" type="submit" icon={<IconCheck size={16} stroke={1.8} />} loading={saving}>Save User</Button>
          </>
        )}
      />

      {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}

      <section className="panel" style={{ overflow: 'auto' }}>
        <div className="panel-body">
          <div className="form-section">
            <h2 className="form-section-title">User Details</h2>
            <div className="form-grid">
              <div className="span-2">
                <TextField label="Full Name" required value={form.full_name} onChange={value => setField('full_name', value)} placeholder="Ali Raza" />
              </div>
              <div className="span-2">
                <TextField label="Email" required value={form.email} onChange={value => setField('email', value)} inputProps={{ type: 'email', autoComplete: 'off' }} placeholder="name@company.com" hint="The user signs in with this email." />
              </div>
              {isNew && (
                <div className="span-2">
                  <TextField label="Password" required value={form.password} onChange={value => setField('password', value)} inputProps={{ type: 'password', autoComplete: 'new-password' }} hint={`At least ${PASSWORD_MIN_LENGTH} characters. Share it with the user privately.`} />
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Role And Access</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px 20px', alignItems: 'start' }}>
              <SelectField label="Role" required value={form.role} options={roleOptions} placeholder="Select Role" disabled={form.is_system} onChange={value => setForm(current => withRole(current, value as UserRole | ''))} />
              <SelectField label="Access Level" required value={form.access_level} options={accessLevelOptions} placeholder={form.role ? 'Select Access Level' : 'Select a Role First'} disabled={form.is_system || accessLevelOptions.length <= 1} onChange={value => setField('access_level', value as UserFormState['access_level'])} />
              {form.access_level === 'BRANCH' && (
                <FieldLabel label="Branch" required>
                  <SearchableSelect value={form.branch_id} options={branchOptions} onChange={value => setField('branch_id', value)} placeholder={branchesQuery.isLoading ? 'Loading Branches' : 'Search Branch'} disabled={branchesQuery.isLoading} />
                </FieldLabel>
              )}
              {form.access_level === 'WAREHOUSE' && (
                <FieldLabel label="Warehouse" required>
                  <SearchableSelect value={form.warehouse_id} options={warehouseOptions} onChange={value => setField('warehouse_id', value)} placeholder={warehousesQuery.isLoading ? 'Loading Warehouses' : 'Search Warehouse'} disabled={warehousesQuery.isLoading} />
                </FieldLabel>
              )}
            </div>
            {form.is_system ? (
              <p className="form-hint" style={{ color: 'var(--color-primary)', marginTop: 8 }}>
                System Super-Admin has permanent All Branches administrative access and cannot be demoted.
              </p>
            ) : (
              <p className="form-hint" style={{ marginTop: 8 }}>
                Branch users see and sell only their Branch stock. Warehouse users see only their Warehouse stock.
                Admin and Top Management always have All Branches access.
              </p>
            )}
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Settings</h2>
            <CheckboxField label="Active" checked={form.is_active} disabled={form.is_system} onChange={value => setField('is_active', value)} />
            <p className="form-hint">
              {form.is_system
                ? 'System Super-Admin account is permanent and cannot be deactivated or deleted.'
                : 'Inactive users cannot sign in. Making a user Inactive signs them out on their next action.'}
            </p>
          </div>

          {!isNew && <ResetPasswordSection userId={editId} />}
        </div>
      </section>
    </form>
  );
}

function ResetPasswordSection({ userId }: { userId: string }) {
  const resetPassword = useResetUserPassword();
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  function reset() {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setNotice({ tone: 'danger', text: `New Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      return;
    }
    resetPassword.mutate({ id: userId, newPassword }, {
      onSuccess: result => { setNotice({ tone: 'success', text: result.message }); setNewPassword(''); },
      onError: error => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Could not reset Password. Please try again.') }),
    });
  }

  return (
    <div className="form-section">
      <h2 className="form-section-title">Reset Password</h2>
      {notice && <div style={{ marginBottom: 12 }}><InlineAlert tone={notice.tone}>{notice.text}</InlineAlert></div>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 640 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            inputProps={{ type: 'password', autoComplete: 'new-password' }}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. The user is signed out everywhere.`}
          />
        </div>
        <div style={{ paddingTop: 26, flexShrink: 0 }}>
          <Button variant="secondary" icon={<IconKey size={16} stroke={1.8} />} onClick={reset} loading={resetPassword.isPending}>
            Reset Password
          </Button>
        </div>
      </div>
    </div>
  );
}
