'use client';

import { useMemo, useState } from 'react';
import { IconCheck, IconSearch } from '@tabler/icons-react';
import { useAvailableBankCheques } from '@/lib/api/bank-cheques';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchField } from '@/components/ui/SearchField';

export interface AvailableChequeItem {
  id: string;
  cheque_number: string;
  serial_number: number;
  book_number: string;
  bank_account_id: string;
}

export function ChequeSearchDialog({
  open,
  bankAccountId,
  bankAccountTitle,
  onSelect,
  onClose,
}: {
  open: boolean;
  bankAccountId: string;
  bankAccountTitle?: string;
  onSelect: (cheque: AvailableChequeItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: cheques, isLoading } = useAvailableBankCheques(bankAccountId, search, open);

  const availableList = useMemo(() => {
    return (cheques ?? []) as AvailableChequeItem[];
  }, [cheques]);

  return (
    <Modal open={open} title="Select Available Cheque" onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bankAccountTitle && (
          <div style={{ padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-xs)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Bank Account: </span>
            <strong style={{ color: 'var(--color-heading)' }}>{bankAccountTitle}</strong>
          </div>
        )}

        <SearchField
          value={search}
          onChange={setSearch}
          label="Filter Cheques"
          placeholder="Filter by Cheque Number or Book Number..."
        />

        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 12px' }}>Cheque Number</th>
                <th style={{ padding: '8px 12px' }}>Book No.</th>
                <th style={{ width: 90, padding: '8px 12px' }}>Status</th>
                <th style={{ width: 80, textAlign: 'right', padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Loading available cheques...
                  </td>
                </tr>
              ) : availableList.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    {!bankAccountId ? 'Please select a Bank Account first.' : 'No available cheques found for this bank account.'}
                  </td>
                </tr>
              ) : (
                availableList.map(item => (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, padding: '8px 12px' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                        {item.cheque_number}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                      {item.book_number}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge variant="success">Available</Badge>
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
          <span>{availableList.length} unissued cheques ready. Double-click row to select.</span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
