'use client';

import { useMemo, useState } from 'react';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { LinesTable } from '@/components/documents';
import { AccountOptionItem, AccountSearchDialog } from '@/components/search/AccountSearchDialog';
import styles from '@/components/documents/documents.module.css';
import { amountValue, cleanAmount, formatAmountInput, sanitizeAmountInput } from './VoucherShared';

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

function isEmptyLine(line: BankReceiptVoucherLine) {
  return !line.receivedFromAccountId && !line.description.trim() && !line.chequeNumber.trim() && !line.chequeDate
    && !line.chequeBankName.trim() && !line.clearingDate && amountValue(line.amount) <= 0;
}

/**
 * Bank Receipt lines. Ten columns of inputs cannot fit a 1280px screen, so this grid keeps a
 * minimum width and scrolls sideways inside its panel.
 */
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
  accountOptions: SelectOption[];
  depositTypes: SelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<BankReceiptVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
}) {
  const [accountSearchLineId, setAccountSearchLineId] = useState<number | null>(null);

  const accountDialogOptions = useMemo<AccountOptionItem[]>(() => {
    return accountOptions.map(opt => ({
      value: opt.value,
      label: opt.label,
      code: opt.searchText ? opt.searchText.split(' ')[0] : undefined,
      searchText: opt.searchText,
    }));
  }, [accountOptions]);

  return (
    <>
      <LinesTable editable minWidth={1180}>
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 230 }} />
        <col />
        <col style={{ width: 140 }} />
        <col style={{ width: 116 }} />
        <col style={{ width: 136 }} />
        <col style={{ width: 128 }} />
        <col style={{ width: 136 }} />
        <col style={{ width: 128 }} />
        <col style={{ width: 48 }} />
      </colgroup>
      <thead>
        <tr>
          <th className="num">No.</th>
          <th>Received From Account<span className="field-required" aria-hidden="true">*</span></th>
          <th>Description</th>
          <th>Deposit Type</th>
          <th>Cheque Number<span className="field-required" aria-hidden="true">*</span></th>
          <th>Cheque Date</th>
          <th>Cheque Bank</th>
          <th>Clearing Date</th>
          <th className="num">Amount<span className="field-required" aria-hidden="true">*</span></th>
          <th><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const isCheque = line.depositKind === 'CHEQUE';
          const lineNo = index + 1;
          return (
            <tr key={line.id} data-line-row data-line-empty={isEmptyLine(line) ? 'true' : undefined}>
                <td className="num cell-muted">{lineNo}</td>
                <td data-line-first>
                  <div className={styles.cellControlGroup}>
                    <div>
                      <SearchableSelect
                        value={line.receivedFromAccountId}
                        options={accountOptions}
                        onChange={value => onUpdateLine(line.id, { receivedFromAccountId: value })}
                        placeholder={accountsLoading ? 'Loading Accounts' : accountsError ? 'Accounts Not Loaded' : 'Search Account'}
                        disabled={accountsLoading || accountsError}
                        ariaLabel={`Received From Account, Line ${lineNo}`}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.cellSearchBtn}
                      onClick={() => setAccountSearchLineId(line.id)}
                      title="Advanced Chart of Accounts Search"
                      aria-label={`Search Account for Line ${lineNo}`}
                    >
                      <IconSearch size={15} stroke={1.8} aria-hidden />
                    </button>
                  </div>
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
              <td>
                <SearchableSelect
                  value={line.depositKind}
                  options={depositTypes}
                  onChange={value => onUpdateLine(line.id, { depositKind: (value as BankReceiptDepositKind) || 'CASH' })}
                  placeholder="Select Type"
                  ariaLabel={`Deposit Type, Line ${lineNo}`}
                />
              </td>
              <td>
                <input
                  className="form-input"
                  value={line.chequeNumber}
                  disabled={!isCheque}
                  onChange={event => onUpdateLine(line.id, { chequeNumber: event.currentTarget.value })}
                  placeholder={isCheque ? 'Cheque No. *' : 'Cheque No.'}
                  aria-label={`Cheque Number, Line ${lineNo}`}
                  aria-required={isCheque || undefined}
                />
              </td>
              <td>
                <input
                  className="form-input"
                  type="date"
                  value={line.chequeDate}
                  disabled={!isCheque}
                  onChange={event => onUpdateLine(line.id, { chequeDate: event.currentTarget.value })}
                  aria-label={`Cheque Date, Line ${lineNo}`}
                />
              </td>
              <td>
                <input
                  className="form-input"
                  value={line.chequeBankName}
                  disabled={!isCheque}
                  onChange={event => onUpdateLine(line.id, { chequeBankName: event.currentTarget.value })}
                  placeholder="Cheque Bank"
                  aria-label={`Cheque Bank, Line ${lineNo}`}
                />
              </td>
              <td>
                <input
                  className="form-input"
                  type="date"
                  value={line.clearingDate}
                  disabled={!isCheque}
                  onChange={event => onUpdateLine(line.id, { clearingDate: event.currentTarget.value })}
                  aria-label={`Clearing Date, Line ${lineNo}`}
                />
              </td>
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

      {/* Advanced Account Search Modal */}
      {accountSearchLineId !== null && (
        <AccountSearchDialog
          open={true}
          title={`Select Account for Line ${lines.findIndex(l => l.id === accountSearchLineId) + 1}`}
          options={accountDialogOptions}
          onSelect={selected => {
            onUpdateLine(accountSearchLineId, { receivedFromAccountId: selected.value });
            setAccountSearchLineId(null);
          }}
          onClose={() => setAccountSearchLineId(null)}
        />
      )}
    </>
  );
}
