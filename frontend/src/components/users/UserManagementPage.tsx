'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { IconPencil, IconPlus, IconRefresh } from '@tabler/icons-react';
import { type UserRow, usersQueryKey, useCreateUser, useUpdateUser, useUsersList } from '@/lib/api/users';
import { canManageUsers, roleLabel, workplaceLabel } from '@/lib/auth/session-user';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { UserForm } from './UserForm';
import { buildUserPayload, EMPTY_USER_FORM, formFromUser, validateUserForm, type UserFormState } from './user-form-helpers';

type StatusFilter = 'All' | 'Active' | 'Inactive';
type Notice = { tone: 'success' | 'danger'; text: string } | null;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function UserManagementPage() {
  const { data: session } = useSession();
  const allowed = canManageUsers(session?.user.role);

  if (!allowed) {
    return (
      <main className="page-shell">
        <PageHeader title="Users" description="Create users and choose the Branch or Warehouse each one works in." help="This screen is for adding users and setting their access. Only Admin and Top Management can open it." />
        <InlineAlert tone="danger">Only Admin and Top Management users can manage users.</InlineAlert>
      </main>
    );
  }

  return <UserManagement canAssignAdmin={session?.user.role === 'admin'} />;
}

function UserManagement({ canAssignAdmin }: { canAssignAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [notice, setNotice] = useState<Notice>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [page, setPage] = useState(1);

  const usersQuery = useUsersList({ page, limit: 50, search: search.trim() || undefined, status });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const saving = createUser.isPending || updateUser.isPending;

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.pagination.total ?? 0;
  const isFiltered = Boolean(search) || status !== 'All';
  const listError = usersQuery.error ? friendlyErrorMessage(usersQuery.error, 'Could not load Users. Please try again.') : '';

  function refresh() {
    queryClient.invalidateQueries({ queryKey: usersQueryKey });
  }

  function applySearch() {
    setSearch(searchText.trim());
    setPage(1);
  }

  function openNew() {
    setEditId('');
    setForm(EMPTY_USER_FORM);
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(user: UserRow) {
    setEditId(user.id);
    setForm(formFromUser(user));
    setNotice(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId('');
    setForm(EMPTY_USER_FORM);
  }

  function saveUser(event?: FormEvent) {
    event?.preventDefault();
    const isNew = !editId;
    const validationMessage = validateUserForm(form, isNew);
    if (validationMessage) {
      setNotice({ tone: 'danger', text: validationMessage });
      return;
    }

    const payload = buildUserPayload(form, isNew);
    const onSuccess = (saved: UserRow) => {
      refresh();
      setNotice({ tone: 'success', text: `User ${saved.full_name} saved.` });
      if (isNew) closeForm();
    };
    const onError = (error: Error) => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Could not save User. Please try again.') });

    if (editId) updateUser.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createUser.mutate(payload, { onSuccess, onError });
  }

  if (showForm) {
    return (
      <UserForm
        editId={editId}
        form={form}
        setForm={setForm}
        notice={notice}
        saving={saving}
        canAssignAdmin={canAssignAdmin}
        onSave={saveUser}
        onBack={closeForm}
      />
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Users"
        description="People who can sign in. Each user works in one Branch or one Warehouse and sees only its data."
        help={(
          <>
            <p>Use this screen to add the people who can sign in, and to change their access.</p>
            <ul>
              <li>New User adds a person.</li>
              <li>The pencil, or a double-click on a row, opens a user to change details or reset the password.</li>
            </ul>
            <p>Only Admin and Top Management can manage users.</p>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={refresh} loading={usersQuery.isFetching && !usersQuery.isLoading}>Refresh</Button>
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New User</Button>
          </>
        )}
      />

      {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}
      {listError && <InlineAlert tone="danger">{listError}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField
              label="Search Users"
              value={searchText}
              onChange={setSearchText}
              onSubmit={applySearch}
              placeholder="Search by Name or Email, then press Enter"
            />
          </div>
          <SegmentedControl label="Status Filter" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          {(search || searchText) && (
            <Button variant="ghost" onClick={() => { setSearchText(''); setSearch(''); setPage(1); }}>Clear</Button>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Full Name</th>
                <th style={{ width: 240 }}>Email</th>
                <th style={{ width: 160 }}>Role</th>
                <th style={{ width: 220 }}>Works In</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading && <TableMessageRow colSpan={6} title="Loading Users…" loading />}
              {!usersQuery.isLoading && users.length === 0 && (
                isFiltered
                  ? <TableMessageRow colSpan={6} title="No Users Match" description="Change the search text or the status filter to see more Users." />
                  : <TableMessageRow colSpan={6} title="No Users Yet" description="Add a user and choose the Branch or Warehouse they work in." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New User</Button>} />
              )}
              {!usersQuery.isLoading && users.map(user => (
                <tr key={user.id} onDoubleClick={() => openEdit(user)}>
                  <td className="cell-strong">{user.full_name}</td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{workplaceLabel({ accessLevel: user.access_level ?? undefined, branch: user.branch, warehouse: user.warehouse })}</td>
                  <td><Badge variant={user.is_active ? 'success' : 'neutral'}>{user.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(user)} aria-label={`Edit User ${user.full_name}`} title="Edit User" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={usersQuery.data?.pagination.pages || 1}
          totalRecords={total}
          recordLabel={total === 1 ? 'User' : 'Users'}
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}
