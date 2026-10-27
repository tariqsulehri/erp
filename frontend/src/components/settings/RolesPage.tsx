'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconCheck, IconShieldCheck, IconUsers, IconX } from '@tabler/icons-react';
import { useRoles } from '@/lib/api/roles';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { friendlyErrorMessage } from '@/lib/erp-utils';

export default function RolesPage() {
  const { data, isLoading, error } = useRoles();
  const [selectedRole, setSelectedRole] = useState<string>('admin');

  const roles = useMemo(() => data?.data ?? [], [data?.data]);
  const permissions = useMemo(() => data?.permission_definitions ?? [], [data?.permission_definitions]);

  const currentRole = useMemo(() => {
    return roles.find(r => r.role === selectedRole) || roles[0];
  }, [roles, selectedRole]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Access By Role"
        description="Review system roles, workplace access rules, and permission boundaries."
        help={(
          <>
            <p>Every user is assigned one Role and a Workplace Scope (All Branches, Branch, or Warehouse).</p>
            <p>Admin and Top Management always have All Branches access and can manage users.</p>
            <p>Accountants and Managers have operational posting and approval powers within their designated scope.</p>
          </>
        )}
        actions={(
          <Link href="/settings/users">
            <Button variant="secondary" icon={<IconUsers size={16} stroke={1.8} />}>Manage Users</Button>
          </Link>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {isLoading && (
          <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading Roles…
          </div>
        )}
        {!isLoading && error && (
          <div className="panel" style={{ padding: 24, color: 'var(--color-danger-text)' }}>
            {friendlyErrorMessage(error, 'Could not load Roles.')}
          </div>
        )}
        {!isLoading && roles.map(r => {
          const isSelected = r.role === (currentRole?.role ?? selectedRole);
          return (
            <button
              key={r.role}
              type="button"
              className={`panel${isSelected ? ' is-selected' : ''}`}
              onClick={() => setSelectedRole(r.role)}
              style={{
                padding: 16,
                textAlign: 'left',
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--color-primary)' : undefined,
                background: isSelected ? 'var(--color-primary-subtle, var(--color-surface))' : 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-heading)' }}>
                  {r.label}
                </span>
                <Badge variant={r.is_all_branches ? 'info' : 'neutral'}>
                  {r.access_level}
                </Badge>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                {r.description}
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                {r.permissions.length} active capabilities
              </div>
            </button>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconShieldCheck size={20} stroke={1.8} style={{ color: 'var(--color-primary)' }} />
              Permission Capabilities Matrix
            </h2>
            <p className="panel-description">Detailed breakdown of permissions across roles</p>
          </div>
          {currentRole && (
            <Badge variant="info">
              Focusing on: {currentRole.label}
            </Badge>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 260 }}>Capability / Action</th>
                {roles.map(r => (
                  <th
                    key={r.role}
                    style={{
                      textAlign: 'center',
                      backgroundColor: r.role === currentRole?.role ? 'var(--color-primary-subtle)' : undefined,
                    }}
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableMessageRow colSpan={roles.length + 1} title="Loading Permission Matrix…" loading />}
              {!isLoading && permissions.map(p => (
                <tr key={p.key}>
                  <td className="cell-strong" style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                    {p.key}
                  </td>
                  {roles.map(r => {
                    const hasAccess = p.allowed_roles.includes(r.role);
                    const isFocus = r.role === currentRole?.role;
                    return (
                      <td
                        key={r.role}
                        style={{
                          textAlign: 'center',
                          backgroundColor: isFocus ? 'var(--color-primary-subtle)' : undefined,
                        }}
                      >
                        {hasAccess ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-success-subtle, #e6f4ea)',
                              color: 'var(--color-success-text, #137333)',
                            }}
                            title={`Allowed for ${r.label}`}
                          >
                            <IconCheck size={14} stroke={2.5} />
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'transparent',
                              color: 'var(--color-border)',
                            }}
                            title={`Restricted for ${r.label}`}
                          >
                            <IconX size={14} stroke={1.8} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
