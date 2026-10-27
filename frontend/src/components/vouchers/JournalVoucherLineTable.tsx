'use client';

import { useMemo, useState } from 'react';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { LinesTable } from '@/components/documents';
import { AccountOptionItem, AccountSearchDialog } from '@/components/search/AccountSearchDialog';
import { amountValue, cleanAmount, formatAmountInput, sanitizeAmountInput } from './VoucherShared';
import styles from '@/components/documents/documents.module.css';

export interface JournalVoucherLine {
  id: number;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

function isEmptyLine(line: JournalVoucherLine) {
  return !line.accountId && !line.description.trim() && amountValue(line.debit) <= 0 && amountValue(line.credit) <= 0;
}

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
  accountOptions: SelectOption[];
  accountsLoading: boolean;
  accountsError: boolean;
  generalSettings?: AppFormatSettingsSource | null;
  onUpdateLine: (id: number, patch: Partial<JournalVoucherLine>) => void;
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
      <LinesTable editable>
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: '38%' }} />
          <col />
          <col style={{ width: 140 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 44 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="num">No.</th>
            <th>Account<span className="field-required" aria-hidden="true">*</span></th>
            <th>Description</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
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
                  <div className={styles.cellControlGroup}>
                    <div>
                      <SearchableSelect
                        value={line.accountId}
                        options={accountOptions}
                        onChange={value => onUpdateLine(line.id, { accountId: value })}
                        placeholder={accountsLoading ? 'Loading Accounts' : accountsError ? 'Accounts Not Loaded' : 'Search Account'}
                        disabled={accountsLoading || accountsError}
                        ariaLabel={`Account, Line ${lineNo}`}
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
              {/* Debit and Credit both end a line: a line has one or the other. */}
              <td data-line-last>
                <input
                  className={`form-input ${styles.numInput}`}
                  inputMode="decimal"
                  value={line.debit}
                  onChange={event => {
                    const value = sanitizeAmountInput(event.currentTarget.value);
                    onUpdateLine(line.id, { debit: value, credit: value ? '' : line.credit });
                  }}
                  onFocus={() => onUpdateLine(line.id, { debit: cleanAmount(line.debit) })}
                  onBlur={() => onUpdateLine(line.id, { debit: formatAmountInput(line.debit, generalSettings) })}
                  placeholder="0.00"
                  aria-label={`Debit, Line ${lineNo}`}
                />
              </td>
              <td data-line-last>
                <input
                  className={`form-input ${styles.numInput}`}
                  inputMode="decimal"
                  value={line.credit}
                  onChange={event => {
                    const value = sanitizeAmountInput(event.currentTarget.value);
                    onUpdateLine(line.id, { credit: value, debit: value ? '' : line.debit });
                  }}
                  onFocus={() => onUpdateLine(line.id, { credit: cleanAmount(line.credit) })}
                  onBlur={() => onUpdateLine(line.id, { credit: formatAmountInput(line.credit, generalSettings) })}
                  placeholder="0.00"
                  aria-label={`Credit, Line ${lineNo}`}
                />
              </td>
              <td className="cell-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<IconTrash size={16} stroke={1.8} aria-hidden />}
                  onClick={() => onRemoveLine(line.id)}
                  disabled={lines.length <= 2}
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
    </>
  );
}
