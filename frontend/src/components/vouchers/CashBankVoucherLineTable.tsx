'use client';

import { IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { LinesTable } from '@/components/documents';
import styles from '@/components/documents/documents.module.css';
import { amountValue, cleanAmount, formatAmountInput, sanitizeAmountInput } from './VoucherShared';

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

function isEmptyLine(line: CashBankVoucherLine) {
  return !line.accountId && !line.description.trim() && !line.chequeDetails.trim() && !line.chequeDate && !line.clearingDate && amountValue(line.amount) <= 0;
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
  accountOptions: SelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<CashBankVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
}) {
  const cheque = config.showChequeFields;
  return (
    <LinesTable editable>
      <colgroup>
        <col style={{ width: 52 }} />
        <col style={{ width: cheque ? '26%' : '42%' }} />
        <col />
        {cheque && (
          <>
            <col style={{ width: 112 }} />
            <col style={{ width: 136 }} />
            <col style={{ width: 136 }} />
          </>
        )}
        <col style={{ width: cheque ? 124 : 150 }} />
        <col style={{ width: 48 }} />
      </colgroup>
      <thead>
        <tr>
          <th className="num">No.</th>
          <th>{config.lineAccountLabel}<span className="field-required" aria-hidden="true">*</span></th>
          <th>Description</th>
          {cheque && (
            <>
              <th>Cheque Details</th>
              <th>Cheque Date</th>
              <th>Clearing Date</th>
            </>
          )}
          <th className="num">Amount<span className="field-required" aria-hidden="true">*</span></th>
          <th><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const lineNo = index + 1;
          return (
            <tr key={line.id} data-line-row data-line-empty={isEmptyLine(line) ? 'true' : undefined}>
              <td className="num cell-muted">{lineNo}</td>
              <td data-line-first>
                <SearchableSelect
                  value={line.accountId}
                  options={accountOptions}
                  onChange={value => onUpdateLine(line.id, { accountId: value })}
                  placeholder={accountsLoading ? 'Loading Accounts' : accountsError ? 'Accounts Not Loaded' : 'Search Account'}
                  disabled={accountsLoading || accountsError}
                  ariaLabel={`${config.lineAccountLabel}, Line ${lineNo}`}
                />
              </td>
              <td>
                <input
                  className="form-input"
                  value={line.description}
                  onChange={event => onUpdateLine(line.id, { description: event.currentTarget.value })}
                  placeholder="Description"
                  aria-label={`Description, Line ${lineNo}`}
                />
              </td>
              {cheque && (
                <>
                  <td>
                    <input
                      className="form-input"
                      value={line.chequeDetails}
                      onChange={event => onUpdateLine(line.id, { chequeDetails: event.currentTarget.value })}
                      placeholder="Cheque No."
                      aria-label={`Cheque Details, Line ${lineNo}`}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="date"
                      value={line.chequeDate}
                      onChange={event => onUpdateLine(line.id, { chequeDate: event.currentTarget.value })}
                      aria-label={`Cheque Date, Line ${lineNo}`}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="date"
                      value={line.clearingDate}
                      onChange={event => onUpdateLine(line.id, { clearingDate: event.currentTarget.value })}
                      aria-label={`Clearing Date, Line ${lineNo}`}
                    />
                  </td>
                </>
              )}
              <td data-line-last>
                <input
                  className={`form-input ${styles.numInput}`}
                  inputMode="decimal"
                  value={line.amount}
                  onChange={event => onUpdateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                  onFocus={() => onUpdateLine(line.id, { amount: cleanAmount(line.amount) })}
                  onBlur={() => onUpdateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                  placeholder="0.00"
                  aria-label={`Amount, Line ${lineNo}`}
                />
              </td>
              <td className="cell-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<IconTrash size={16} stroke={1.8} aria-hidden />}
                  onClick={() => onRemoveLine(line.id)}
                  disabled={lines.length === 1}
                  aria-label={`Remove Line ${lineNo}`}
                  title="Remove Line"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </LinesTable>
  );
}
