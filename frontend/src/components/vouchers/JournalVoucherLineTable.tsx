'use client';

import { IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { SearchableSelect, type VoucherSelectOption } from './VoucherControls';
import {
  cleanAmount,
  compactInputStyle,
  compactMoneyInputStyle,
  formatAmountInput,
  sanitizeAmountInput,
  tableCellStyle,
  tableHeadStyle,
} from './VoucherShared';

export interface JournalVoucherLine {
  id: number;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

const journalLineColumns = [
  { label: 'No.', width: 32 },
  { label: 'Account', width: 430 },
  { label: 'Description', width: 475 },
  { label: 'Debit', width: 112, right: true },
  { label: 'Credit', width: 112, right: true },
  { label: '', width: 30 },
] as const;

export function JournalVoucherLineTable({
  lines,
  accountOptions,
  accountsLoading,
  accountsError,
  generalSettings,
  onUpdateLine,
  onRemoveLine,
}: {
  lines: JournalVoucherLine[];
  accountOptions: VoucherSelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<JournalVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
}) {
  return (
    <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
        <colgroup>
          {journalLineColumns.map(column => (
            <col key={column.label || 'action'} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {journalLineColumns.map(column => (
              <th key={column.label || 'action'} style={tableHeadStyle('right' in column && Boolean(column.right))}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id}>
              <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
              <td style={tableCellStyle()}>
                <SearchableSelect
                  value={line.accountId}
                  options={accountOptions}
                  onChange={value => onUpdateLine(line.id, { accountId: value })}
                  placeholder={accountsLoading ? 'Loading Accounts' : accountsError ? 'Accounts Not Loaded' : 'Search Account'}
                  disabled={accountsLoading || accountsError}
                />
              </td>
              <td style={tableCellStyle()}>
                <input
                  className="form-input"
                  value={line.description}
                  onChange={event => onUpdateLine(line.id, { description: event.currentTarget.value })}
                  placeholder="Description"
                  style={compactInputStyle}
                />
              </td>
              <td style={tableCellStyle()}>
                <input
                  className="form-input"
                  inputMode="decimal"
                  value={line.debit}
                  onChange={event => {
                    const value = sanitizeAmountInput(event.currentTarget.value);
                    onUpdateLine(line.id, { debit: value, credit: value ? '' : line.credit });
                  }}
                  onFocus={() => onUpdateLine(line.id, { debit: cleanAmount(line.debit) })}
                  onBlur={() => onUpdateLine(line.id, { debit: formatAmountInput(line.debit, generalSettings) })}
                  placeholder="0.00"
                  style={compactMoneyInputStyle}
                />
              </td>
              <td style={tableCellStyle()}>
                <input
                  className="form-input"
                  inputMode="decimal"
                  value={line.credit}
                  onChange={event => {
                    const value = sanitizeAmountInput(event.currentTarget.value);
                    onUpdateLine(line.id, { credit: value, debit: value ? '' : line.debit });
                  }}
                  onFocus={() => onUpdateLine(line.id, { credit: cleanAmount(line.credit) })}
                  onBlur={() => onUpdateLine(line.id, { credit: formatAmountInput(line.credit, generalSettings) })}
                  placeholder="0.00"
                  style={compactMoneyInputStyle}
                />
              </td>
              <td style={tableCellStyle()}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onRemoveLine(line.id)}
                  disabled={lines.length <= 2}
                  title="Remove Line"
                  style={{ padding: 4, color: 'var(--color-danger)', minHeight: 28 }}
                >
                  <IconTrash size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
