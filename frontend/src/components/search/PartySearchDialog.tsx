'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchField } from '@/components/ui/SearchField';

export interface PartyOptionItem {
  id: string;
  code?: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  accountId?: string;
}

export function PartySearchDialog({
  open,
  title = 'Search Parties',
  parties,
  onSelect,
  onClose,
}: {
  open: boolean;
  title?: string;
  parties: PartyOptionItem[];
  onSelect: (party: PartyOptionItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(p =>
      (p.code || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [parties, search]);

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SearchField
          value={search}
          onChange={setSearch}
          label="Filter Parties"
          placeholder="Filter by code, name, city, or phone number..."
        />

        <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 120, padding: '8px 12px' }}>Code</th>
                <th style={{ padding: '8px 12px' }}>Name</th>
                <th style={{ width: 120, padding: '8px 12px' }}>City</th>
                <th style={{ width: 140, padding: '8px 12px' }}>Phone</th>
                <th style={{ width: 80, textAlign: 'right', padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    No results found for "{search}".
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, padding: '8px 12px' }}>
                      {item.code || '—'}
                    </td>
                    <td style={{ fontWeight: 500, padding: '8px 12px' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                      {item.city || '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-muted)' }}>
                      {item.phone || '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Showing {filtered.length} entries. Double-click row to select.</span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
