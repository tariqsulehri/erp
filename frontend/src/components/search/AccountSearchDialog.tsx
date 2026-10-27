'use client';

import { useMemo, useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchField } from '@/components/ui/SearchField';

export interface AccountOptionItem {
  value: string;
  label: string;
  code?: string;
  name?: string;
  type?: string;
  searchText?: string;
}

export function AccountSearchDialog({
  open,
  title = 'Advanced Account Search',
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  title?: string;
  options: AccountOptionItem[];
  onSelect: (option: AccountOptionItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter(opt => {
      // Category filter by code prefix or type
      if (categoryFilter !== 'ALL') {
        const c = opt.code || '';
        if (categoryFilter === 'ASSETS' && !c.startsWith('01')) return false;
        if (categoryFilter === 'LIABILITIES' && !c.startsWith('02')) return false;
        if (categoryFilter === 'EQUITY' && !c.startsWith('03')) return false;
        if (categoryFilter === 'REVENUE' && !c.startsWith('04')) return false;
        if (categoryFilter === 'EXPENSES' && !c.startsWith('05')) return false;
        if (categoryFilter === 'BANK_CASH' && !c.startsWith('0101')) return false;
      }

      if (!q) return true;
      const haystack = (opt.searchText || `${opt.code || ''} ${opt.name || ''} ${opt.label}`).toLowerCase();
      return haystack.includes(q);
    });
  }, [options, search, categoryFilter]);

  const categories = [
    { key: 'ALL', label: 'All Accounts' },
    { key: 'BANK_CASH', label: 'Cash & Bank' },
    { key: 'ASSETS', label: 'Assets' },
    { key: 'LIABILITIES', label: 'Liabilities' },
    { key: 'EQUITY', label: 'Equity' },
    { key: 'REVENUE', label: 'Revenue' },
    { key: 'EXPENSES', label: 'Expenses' },
  ];

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <SearchField
              value={search}
              onChange={setSearch}
              label="Search Chart Of Accounts"
              placeholder="Search by 10-digit Account Code (e.g. 0101100001) or Title..."
            />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Clear
            </Button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(c => {
            const active = categoryFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryFilter(c.key)}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: active ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                  color: active ? '#ffffff' : 'var(--color-text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Results Table */}
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 140, padding: '8px 12px' }}>Code</th>
                <th style={{ padding: '8px 12px' }}>Account Title</th>
                <th style={{ width: 120, padding: '8px 12px' }}>Type</th>
                <th style={{ width: 90, textAlign: 'right', padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)' }}>
                    No accounts match "{search}" in this category.
                  </td>
                </tr>
              ) : (
                filteredOptions.map(opt => {
                  const code = opt.code || (opt.label.includes('—') ? opt.label.split('—')[0].trim() : '');
                  const name = opt.name || (opt.label.includes('—') ? opt.label.split('—').slice(1).join('—').trim() : opt.label);
                  return (
                    <tr
                      key={opt.value}
                      style={{ cursor: 'pointer' }}
                      onDoubleClick={() => {
                        onSelect(opt);
                        onClose();
                      }}
                    >
                      <td style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, padding: '8px 12px' }}>
                        {code || opt.value}
                      </td>
                      <td style={{ fontWeight: 500, padding: '8px 12px' }}>
                        {name}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Badge variant="neutral">{opt.type || (code.startsWith('01') ? 'Asset' : code.startsWith('02') ? 'Liability' : code.startsWith('03') ? 'Equity' : code.startsWith('04') ? 'Revenue' : 'Expense')}</Badge>
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            onSelect(opt);
                            onClose();
                          }}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Showing {filteredOptions.length} accounts. Double-click row to select.</span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
