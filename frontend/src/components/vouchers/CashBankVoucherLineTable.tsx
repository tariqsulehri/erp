'use client';

import { IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { SearchableSelect, type VoucherSelectOption } from './VoucherControls';
import {
  cleanAmount,
  compactDateInputStyle,
  compactInputStyle,
  compactMoneyInputStyle,
  formatAmountInput,
  sanitizeAmountInput,
  tableCellStyle,
  tableHeadStyle,
} from './VoucherShared';

export interface CashBankVoucherLine {
  id: number;
  accountId: string;
  description: string;
  chequeDetails: string;
  chequeDate: string;
  clearingDate: string;
  amount: string;
}

interface CashBankLineConfig {
  lineAccountLabel: string;
  showChequeFields: boolean;
}

function getCashBankLineColumns(config: CashBankLineConfig) {
  if (config.showChequeFields) {
    return [
      { label: 'No.', width: 32 },
      { label: config.lineAccountLabel, width: 275 },
      { label: 'Description', width: 300 },
      { label: 'Cheque Details', width: 140 },
      { label: 'Cheque Date', width: 96 },
      { label: 'Clearing Date', width: 96 },
      { label: 'Amount', width: 112, right: true },
      { label: '', width: 30 },
    ] as const;
  }

  return [
    { label: 'No.', width: 32 },
    { label: config.lineAccountLabel, width: 520 },
    { label: 'Description', width: 520 },
    { label: 'Amount', width: 118, right: true },
    { label: '', width: 30 },
  ] as const;
}

export function CashBankVoucherLineTable({
  config,
  lines,
  accountOptions,
  accountsLoading,
  accountsError,
  generalSettings,
  onUpdateLine,
  onRemoveLine,
}: {
  config: CashBankLineConfig;
  lines: CashBankVoucherLine[];
  accountOptions: VoucherSelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<CashBankVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
}) {
  const lineColumns = getCashBankLineColumns(config);

  return (
    <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
        <colgroup>
          {lineColumns.map(column => (
            <col key={column.label || 'action'} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {lineColumns.map(column => (
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
              {config.showChequeFields && (
                <>
                  <td style={tableCellStyle()}>
                    <input
                      className="form-input"
                      value={line.chequeDetails}
                      onChange={event => onUpdateLine(line.id, { chequeDetails: event.currentTarget.value })}
                      placeholder="Cheque No."
                      style={compactInputStyle}
                    />
                  </td>
                  <td style={tableCellStyle()}>
                    <input
                      className="form-input"
                      type="date"
                      value={line.chequeDate}
                      onChange={event => onUpdateLine(line.id, { chequeDate: event.currentTarget.value })}
                      style={compactDateInputStyle}
                    />
                  </td>
                  <td style={tableCellStyle()}>
                    <input
                      className="form-input"
                      type="date"
                      value={line.clearingDate}
                      onChange={event => onUpdateLine(line.id, { clearingDate: event.currentTarget.value })}
                      style={compactDateInputStyle}
                    />
                  </td>
                </>
              )}
              <td style={tableCellStyle()}>
                <input
                  className="form-input"
                  inputMode="decimal"
                  value={line.amount}
                  onChange={event => onUpdateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                  onFocus={() => onUpdateLine(line.id, { amount: cleanAmount(line.amount) })}
                  onBlur={() => onUpdateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                  placeholder="0.00"
                  style={compactMoneyInputStyle}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
