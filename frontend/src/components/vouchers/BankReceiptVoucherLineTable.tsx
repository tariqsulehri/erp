'use client';

import { IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { SearchableSelect, type VoucherSelectOption } from './VoucherControls';
import {
  cleanAmount,
  compactDateInputStyle,
  compactInputStyle,
  formatAmountInput,
  sanitizeAmountInput,
  tableCellStyle,
  tableHeadStyle,
} from './VoucherShared';

export type BankReceiptDepositKind = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';

export interface BankReceiptVoucherLine {
  id: number;
  receivedFromAccountId: string;
  description: string;
  depositKind: BankReceiptDepositKind;
  chequeNumber: string;
  chequeDate: string;
  chequeBankName: string;
  clearingDate: string;
  amount: string;
}

const receiptLineColumns = [
  { label: 'No.', width: 32 },
  { label: 'Received From Account', width: 235 },
  { label: 'Description', width: 190 },
  { label: 'Deposit Type', width: 105 },
  { label: 'Cheque Number', width: 110, required: true },
  { label: 'Cheque Date', width: 96 },
  { label: 'Cheque Bank', width: 145 },
  { label: 'Clearing Date', width: 96 },
  { label: 'Amount', width: 110, right: true },
  { label: '', width: 30 },
] as const;

export function BankReceiptVoucherLineTable({
  lines,
  accountOptions,
  depositTypes,
  accountsLoading,
  accountsError,
  generalSettings,
  onUpdateLine,
  onRemoveLine,
}: {
  lines: BankReceiptVoucherLine[];
  accountOptions: VoucherSelectOption[];
  depositTypes: VoucherSelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<BankReceiptVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
}) {
  return (
    <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
        <colgroup>
          {receiptLineColumns.map(column => (
            <col key={column.label || 'action'} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {receiptLineColumns.map(column => (
              <th key={column.label || 'action'} style={tableHeadStyle('right' in column && Boolean(column.right))}>
                {column.label}
                {'required' in column && column.required && <span style={{ color: '#fecaca', marginLeft: 2 }}>*</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const isCheque = line.depositKind === 'CHEQUE';
            return (
              <tr key={line.id}>
                <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
                <td style={tableCellStyle()}>
                  <SearchableSelect
                    value={line.receivedFromAccountId}
                    options={accountOptions}
                    onChange={value => onUpdateLine(line.id, { receivedFromAccountId: value })}
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
                  <SearchableSelect
                    value={line.depositKind}
                    options={depositTypes}
                    onChange={value => onUpdateLine(line.id, { depositKind: (value as BankReceiptDepositKind) || 'CASH' })}
                    placeholder="Select Type"
                  />
                </td>
                <td style={tableCellStyle()}>
                  <input
                    className="form-input"
                    value={line.chequeNumber}
                    disabled={!isCheque}
                    onChange={event => onUpdateLine(line.id, { chequeNumber: event.currentTarget.value })}
                    placeholder={isCheque ? 'Cheque No. *' : 'Cheque No.'}
                    style={compactInputStyle}
                  />
                </td>
                <td style={tableCellStyle()}>
                  <input
                    className="form-input"
                    type="date"
                    value={line.chequeDate}
                    disabled={!isCheque}
                    onChange={event => onUpdateLine(line.id, { chequeDate: event.currentTarget.value })}
                    style={compactDateInputStyle}
                  />
                </td>
                <td style={tableCellStyle()}>
                  <input
                    className="form-input"
                    value={line.chequeBankName}
                    disabled={!isCheque}
                    onChange={event => onUpdateLine(line.id, { chequeBankName: event.currentTarget.value })}
                    placeholder="Cheque Bank"
                    style={compactInputStyle}
                  />
                </td>
                <td style={tableCellStyle()}>
                  <input
                    className="form-input"
                    type="date"
                    value={line.clearingDate}
                    disabled={!isCheque}
                    onChange={event => onUpdateLine(line.id, { clearingDate: event.currentTarget.value })}
                    style={compactDateInputStyle}
                  />
                </td>
                <td style={tableCellStyle()}>
                  <input
                    className="form-input"
                    inputMode="decimal"
                    value={line.amount}
                    onChange={event => onUpdateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                    onFocus={() => onUpdateLine(line.id, { amount: cleanAmount(line.amount) })}
                    onBlur={() => onUpdateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                    placeholder="0.00"
                    style={{ ...compactInputStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
                  />
                </td>
                <td style={tableCellStyle()}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onRemoveLine(line.id)}
                    disabled={lines.length === 1}
                    title="Remove Line"
                    style={{ padding: 4, color: 'var(--color-danger)', minHeight: 28 }}
                  >
                    <IconTrash size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
