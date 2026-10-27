'use client';

import { useMemo, useState } from 'react';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { LinesTable } from '@/components/documents';
import styles from '@/components/documents/documents.module.css';
import { type AccountOptionItem, AccountSearchDialog } from '@/components/search/AccountSearchDialog';
import { ChequeSearchDialog } from '@/components/search/ChequeSearchDialog';
import { amountValue, cleanAmount, formatAmountInput, sanitizeAmountInput, today } from './VoucherShared';

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
  bankAccountId,
  bankAccountTitle,
  voucherDate,
  generalSettings,
  onUpdateLine,
  onRemoveLine,
  onAddLine,
}: {
  config: CashBankLineConfig;
  lines: CashBankVoucherLine[];
  accountOptions: SelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  bankAccountId?: string;
  bankAccountTitle?: string;
  voucherDate?: string;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<CashBankVoucherLine>) => void;
  onRemoveLine: (id: number) => void;
  onAddLine?: () => void;
}) {
  const cheque = config.showChequeFields;
  const [accountSearchLineId, setAccountSearchLineId] = useState<number | null>(null);
  const [chequeSearchLineId, setChequeSearchLineId] = useState<number | null>(null);

  // Map accountOptions to AccountOptionItem for the advanced search dialog
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
      <LinesTable editable>
        <colgroup>
          <col style={{ width: 44 }} />
          <col style={{ width: cheque ? '28%' : '44%' }} />
          <col style={cheque ? undefined : { width: '38%' }} />
          {cheque && (
            <>
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
            </>
          )}
          <col style={{ width: cheque ? 130 : 180 }} />
          <col style={{ width: 44 }} />
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
            const isLastLine = index === lines.length - 1;

            return (
              <tr key={line.id} data-line-row data-line-empty={isEmptyLine(line) ? 'true' : undefined}>
                <td className="num cell-muted" style={{ fontWeight: 600 }}>{lineNo}</td>

                {/* Account Selection with Integrated Search Icon */}
                <td data-line-first>
                  <div className={styles.cellControlGroup}>
                    <div>
                      <SearchableSelect
                        value={line.accountId}
                        options={accountOptions}
                        onChange={value => {
                          onUpdateLine(line.id, { accountId: value });
                          // Auto grow when first field on last row is filled
                          if (isLastLine && value && onAddLine) {
                            onAddLine();
                          }
                        }}
                        placeholder={accountsLoading ? 'Loading Accounts' : accountsError ? 'Accounts Not Loaded' : 'Search Account'}
                        disabled={accountsLoading || accountsError}
                        ariaLabel={`${config.lineAccountLabel}, Line ${lineNo}`}
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

                {/* Description */}
                <td>
                  <input
                    className="form-input"
                    value={line.description}
                    onChange={event => onUpdateLine(line.id, { description: event.currentTarget.value })}
                    placeholder="Narration / Reference"
                    aria-label={`Description, Line ${lineNo}`}
                  />
                </td>

                {/* Cheque Details with Integrated Search Icon */}
                {cheque && (
                  <>
                    <td>
                      <div className={styles.cellControlGroup}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            className="form-input"
                            value={line.chequeDetails}
                            onChange={event => onUpdateLine(line.id, { chequeDetails: event.currentTarget.value })}
                            placeholder="Cheque No."
                            aria-label={`Cheque Details, Line ${lineNo}`}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.cellSearchBtn}
                          onClick={() => setChequeSearchLineId(line.id)}
                          disabled={!bankAccountId}
                          title={!bankAccountId ? 'Select a Bank Account first' : 'Find Available Cheque from Register'}
                          aria-label={`Search Cheque for Line ${lineNo}`}
                        >
                          <IconSearch size={15} stroke={1.8} aria-hidden />
                        </button>
                      </div>
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

                {/* Amount */}
                <td data-line-last>
                  <input
                    className={`form-input ${styles.numInput}`}
                    inputMode="decimal"
                    value={line.amount}
                    onChange={event => onUpdateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                    onFocus={() => onUpdateLine(line.id, { amount: cleanAmount(line.amount) })}
                    onBlur={() => onUpdateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && isLastLine && onAddLine) {
                        event.preventDefault();
                        onAddLine();
                      }
                    }}
                    placeholder="0.00"
                    aria-label={`Amount, Line ${lineNo}`}
                  />
                </td>

                {/* Row Actions */}
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
            onUpdateLine(accountSearchLineId, { accountId: selected.value });
            setAccountSearchLineId(null);
          }}
          onClose={() => setAccountSearchLineId(null)}
        />
      )}

      {/* Available Cheques Search Modal */}
      {chequeSearchLineId !== null && bankAccountId && (
        <ChequeSearchDialog
          open={true}
          bankAccountId={bankAccountId}
          bankAccountTitle={bankAccountTitle}
          onSelect={chequeItem => {
            onUpdateLine(chequeSearchLineId, {
              chequeDetails: chequeItem.cheque_number,
              chequeDate: voucherDate || today(),
            });
            setChequeSearchLineId(null);
          }}
          onClose={() => setChequeSearchLineId(null)}
        />
      )}
    </>
  );
}
