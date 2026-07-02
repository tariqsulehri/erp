'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconBan, IconCheck, IconCreditCardPay, IconPlus, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { formatDate, formatMoney, type AppFormatSettingsSource } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import {
  type ChequeStatus,
  type CreateChequeBookPayload,
  type VoidReason,
  useBankChequeBooksList,
  useBankChequesList,
  useBankChequesSupportData,
  useCreateBankChequeBook,
  useInvalidateBankCheques,
  useIssueBankCheque,
  useVoidBankCheque,
} from '@/lib/api/bank-cheques';
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const chequeStatuses: Array<ChequeStatus | ''> = ['', 'Available', 'Reserved', 'Issued', 'Cleared', 'Bounced', 'Void', 'Cancelled', 'Stopped'];
const voidReasons: VoidReason[] = ['Torn', 'Text Not Clear', 'Writing Mistake', 'Cancelled', 'Printer Error', 'Other'];

const blankBookForm = (): CreateChequeBookPayload => ({
  bank_account_id: '',
  book_number: '',
  prefix: '',
  suffix: '',
  start_cheque_number: '',
  end_cheque_number: '',
  issued_date: new Date().toISOString().slice(0, 10),
  received_date: '',
  notes: '',
});

function InlineSpinner({ light = false, size = 14 }: { light?: boolean; size?: number }) {
  return (
    <div
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        ...(light ? { borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' } : {}),
      }}
    />
  );
}

function statusStyle(status: string): React.CSSProperties {
  const colorMap: Record<string, { bg: string; color: string; border: string }> = {
    Available: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: 'var(--color-success-border)' },
    Reserved: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    Issued: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    Cleared: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: 'var(--color-success-border)' },
    Bounced: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
    Void: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
    Cancelled: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
    Stopped: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  };
  const colors = colorMap[status] ?? colorMap.Available;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 21,
    padding: '0 8px',
    borderRadius: 'var(--radius-pill)',
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    color: colors.color,
    fontSize: '0.68rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}

function maskAccountNumber(value?: string) {
  const clean = String(value ?? '').trim();
  if (clean.length <= 4) return clean || '-';
  return `****-${clean.slice(-4)}`;
}

function bankLabel(account: any) {
  return `${account.code ? `${account.code} - ` : ''}${account.bank_name} / ${account.account_title} (${maskAccountNumber(account.account_number)})`;
}

export function ChequeBooksTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const supportQuery = useBankChequesSupportData();
  const createBook = useCreateBankChequeBook();
  const voidCheque = useVoidBankCheque();
  const issueCheque = useIssueBankCheque();
  const invalidateBankCheques = useInvalidateBankCheques();

  const [entryOpen, setEntryOpen] = useState(false);
  const [form, setForm] = useState<CreateChequeBookPayload>(blankBookForm);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [bookLimit, setBookLimit] = useState(50);
  const [chequePage, setChequePage] = useState(1);
  const [chequeLimit, setChequeLimit] = useState(50);
  const [draftSearch, setDraftSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<ChequeStatus | ''>('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidForm, setVoidForm] = useState<{ reason: VoidReason; notes: string }>({ reason: 'Torn', notes: '' });
  const [issueTarget, setIssueTarget] = useState<any | null>(null);
  const [issueForm, setIssueForm] = useState({ issue_date: new Date().toISOString().slice(0, 10), payee_name: '', payment_reference: '', amount: '' });

  const bankAccounts = supportQuery.data?.bank_accounts ?? [];
  const bankOptions = useMemo(() => bankAccounts.map((account: any) => ({
    value: account.id,
    label: bankLabel(account),
    searchText: `${account.code ?? ''} ${account.bank_name ?? ''} ${account.account_title ?? ''} ${account.account_number ?? ''}`,
  })), [bankAccounts]);

  useEffect(() => {
    if (!selectedBankId && bankAccounts[0]?.id) {
      setSelectedBankId(bankAccounts[0].id);
      setForm(current => ({ ...current, bank_account_id: bankAccounts[0].id }));
    }
  }, [bankAccounts, selectedBankId]);

  const selectedBank = bankAccounts.find((account: any) => account.id === selectedBankId);
  const bookQuery = useBankChequeBooksList({ page: bookPage, limit: bookLimit, bank_account_id: selectedBankId }, Boolean(selectedBankId));
  const chequeQuery = useBankChequesList({
    page: chequePage,
    limit: chequeLimit,
    bank_account_id: selectedBankId,
    status,
    search: appliedSearch,
  }, Boolean(selectedBankId));

  const books = bookQuery.data?.data ?? [];
  const cheques = chequeQuery.data?.data ?? [];
  const totalCheques = chequeQuery.data?.total ?? 0;
  const availableCount = cheques.filter((cheque: any) => cheque.status === 'Available').length;
  const issuedCount = cheques.filter((cheque: any) => cheque.status === 'Issued').length;
  const voidCount = cheques.filter((cheque: any) => cheque.status === 'Void').length;
  const saving = createBook.isPending;
  const voiding = voidCheque.isPending;
  const issuing = issueCheque.isPending;

  function patchForm(patch: Partial<CreateChequeBookPayload>) {
    setForm(current => ({ ...current, ...patch }));
  }

  function validateBookForm() {
    if (!form.bank_account_id) return 'Bank Account is required.';
    if (!form.book_number.trim()) return 'Cheque Book Number is required.';
    if (!/^\d+$/.test(form.start_cheque_number.trim())) return 'Start Cheque Number must use digits only.';
    if (!/^\d+$/.test(form.end_cheque_number.trim())) return 'End Cheque Number must use digits only.';
    const start = BigInt(form.start_cheque_number.trim());
    const end = BigInt(form.end_cheque_number.trim());
    if (end < start) return 'End Cheque Number must be greater than or equal to Start Cheque Number.';
    if (end - start + 1n > 1000n) return 'One Cheque Book can generate a maximum of 1000 cheques.';
    return '';
  }

  async function generateBook() {
    const validationMessage = validateBookForm();
    if (validationMessage) {
      setMessage({ kind: 'error', text: validationMessage });
      return;
    }

    try {
      const result = await createBook.mutateAsync({
        ...form,
        bank_account_id: form.bank_account_id || selectedBankId,
        book_number: form.book_number.trim(),
        prefix: form.prefix?.trim(),
        suffix: form.suffix?.trim(),
        start_cheque_number: form.start_cheque_number.trim(),
        end_cheque_number: form.end_cheque_number.trim(),
      });
      await invalidateBankCheques();
      setMessage({ kind: 'success', text: result.message ?? 'Cheque Book generated successfully.' });
      setEntryOpen(false);
      setForm({ ...blankBookForm(), bank_account_id: selectedBankId });
      setBookPage(1);
      setChequePage(1);
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to generate Cheque Book.') });
    }
  }

  function applySearch() {
    setAppliedSearch(draftSearch.trim());
    setChequePage(1);
  }

  function clearSearch() {
    setDraftSearch('');
    setAppliedSearch('');
    setStatus('');
    setChequePage(1);
  }

  async function submitVoid() {
    if (!voidTarget) return;
    try {
      const result = await voidCheque.mutateAsync({ id: voidTarget.id, input: voidForm });
      await invalidateBankCheques();
      setMessage({ kind: 'success', text: result.message ?? 'Cheque voided successfully.' });
      setVoidTarget(null);
      setVoidForm({ reason: 'Torn', notes: '' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to void Cheque.') });
    }
  }

  async function submitIssue() {
    if (!issueTarget) return;
    if (!issueForm.payee_name.trim()) {
      setMessage({ kind: 'error', text: 'Payee Name is required.' });
      return;
    }
    if (numericValue(issueForm.amount) <= 0) {
      setMessage({ kind: 'error', text: 'Amount must be greater than zero.' });
      return;
    }
    try {
      const result = await issueCheque.mutateAsync({
        id: issueTarget.id,
        input: {
          issue_date: issueForm.issue_date,
          payee_name: issueForm.payee_name.trim(),
          payment_reference: issueForm.payment_reference.trim(),
          amount: numericValue(issueForm.amount),
        },
      });
      await invalidateBankCheques();
      setMessage({ kind: 'success', text: result.message ?? 'Cheque marked as Issued.' });
      setIssueTarget(null);
      setIssueForm({ issue_date: new Date().toISOString().slice(0, 10), payee_name: '', payment_reference: '', amount: '' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to issue Cheque.') });
    }
  }

  if (supportQuery.isLoading) {
    return (
      <div style={emptyStateStyle}>
        <InlineSpinner size={18} />
        <span>Loading Bank Accounts...</span>
      </div>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <strong style={{ color: 'var(--color-heading)' }}>No Active Bank Accounts Found</strong>
      </div>
    );
  }

  return (
    <main style={pageShellStyle}>
      {message && (
        <div style={message.kind === 'success' ? successMessageStyle : errorMessageStyle}>
          {message.text}
        </div>
      )}

      <section style={toolbarStyle}>
        <FieldLabel label="Bank Account" required>
          <SearchableSelect
            value={selectedBankId}
            options={bankOptions}
            onChange={value => {
              setSelectedBankId(value);
              setForm(current => ({ ...current, bank_account_id: value }));
              setBookPage(1);
              setChequePage(1);
              setVoidTarget(null);
              setIssueTarget(null);
            }}
            placeholder="Select Bank Account"
          />
        </FieldLabel>
        <div style={toolbarActionsStyle}>
          <button className="btn btn-secondary" type="button" onClick={() => { bookQuery.refetch(); chequeQuery.refetch(); }} disabled={bookQuery.isFetching || chequeQuery.isFetching}>
            {(bookQuery.isFetching || chequeQuery.isFetching) ? <InlineSpinner size={13} /> : <IconRefresh size={15} />}
            Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={() => { setEntryOpen(true); setMessage(null); }}>
            <IconPlus size={15} />
            New Cheque Book
          </button>
        </div>
      </section>

      <div style={summaryGridStyle}>
        {[
          { label: 'Selected Bank', value: selectedBank ? selectedBank.bank_name : '-', color: 'var(--color-heading)' },
          { label: 'Total Cheques', value: totalCheques, color: '#2563eb' },
          { label: 'Available On Page', value: availableCount, color: '#15803d' },
          { label: 'Issued On Page', value: issuedCount, color: '#92400e' },
          { label: 'Void On Page', value: voidCount, color: '#475569' },
        ].map(tile => (
          <div key={tile.label} style={summaryTileStyle}>
            <span style={summaryLabelStyle}>{tile.label}</span>
            <strong style={{ ...summaryValueStyle, color: tile.color }}>{tile.value}</strong>
          </div>
        ))}
      </div>

      {entryOpen && (
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>New Cheque Book</h2>
              <p style={panelSubtitleStyle}>Create cheque leaves from start and end numbers</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => setEntryOpen(false)} disabled={saving}>
              <IconX size={15} />
              Cancel
            </button>
          </div>
          <div style={formGridStyle}>
            <FieldLabel label="Bank Account" required>
              <SearchableSelect
                value={form.bank_account_id || selectedBankId}
                options={bankOptions}
                onChange={value => {
                  setSelectedBankId(value);
                  patchForm({ bank_account_id: value });
                }}
                placeholder="Select Bank Account"
              />
            </FieldLabel>
            <TextField label="Cheque Book Number" required value={form.book_number} onChange={value => patchForm({ book_number: value })} />
            <TextField label="Prefix" value={form.prefix ?? ''} onChange={value => patchForm({ prefix: value })} />
            <TextField label="Start Cheque Number" required value={form.start_cheque_number} onChange={value => patchForm({ start_cheque_number: value.replace(/\D/g, '') })} />
            <TextField label="End Cheque Number" required value={form.end_cheque_number} onChange={value => patchForm({ end_cheque_number: value.replace(/\D/g, '') })} />
            <TextField label="Suffix" value={form.suffix ?? ''} onChange={value => patchForm({ suffix: value })} />
            <DateField label="Issued Date" value={form.issued_date ?? ''} onChange={value => patchForm({ issued_date: value })} />
            <DateField label="Received Date" value={form.received_date ?? ''} onChange={value => patchForm({ received_date: value })} />
          </div>
          <div style={notesFieldStyle}>
            <FieldLabel label="Notes">
              <textarea className="form-input" rows={2} value={form.notes ?? ''} onChange={event => patchForm({ notes: event.currentTarget.value })} />
            </FieldLabel>
          </div>
          <div style={formActionStyle}>
            <button className="btn btn-primary" type="button" onClick={generateBook} disabled={saving}>
              {saving ? <InlineSpinner light /> : <IconCheck size={15} />}
              {saving ? 'Generating...' : 'Generate Cheques'}
            </button>
          </div>
        </section>
      )}

      {(voidTarget || issueTarget) && (
        <section style={panelStyle}>
          {voidTarget && (
            <>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Void Cheque {voidTarget.cheque_number}</h2>
                  <p style={panelSubtitleStyle}>{voidTarget.book_number} / {voidTarget.bank_name}</p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => setVoidTarget(null)} disabled={voiding}>
                  <IconX size={15} />
                  Cancel
                </button>
              </div>
              <div style={formGridStyle}>
                <FieldLabel label="Void Reason" required>
                  <select className="form-input" value={voidForm.reason} onChange={event => setVoidForm(current => ({ ...current, reason: event.currentTarget.value as VoidReason }))}>
                    {voidReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                  </select>
                </FieldLabel>
                <TextField label="Notes" value={voidForm.notes} onChange={value => setVoidForm(current => ({ ...current, notes: value }))} />
              </div>
              <div style={formActionStyle}>
                <button className="btn btn-danger" type="button" onClick={submitVoid} disabled={voiding}>
                  {voiding ? <InlineSpinner light /> : <IconBan size={15} />}
                  {voiding ? 'Voiding...' : 'Void Cheque'}
                </button>
              </div>
            </>
          )}

          {issueTarget && (
            <>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Issue Cheque {issueTarget.cheque_number}</h2>
                  <p style={panelSubtitleStyle}>{issueTarget.book_number} / {issueTarget.bank_name}</p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => setIssueTarget(null)} disabled={issuing}>
                  <IconX size={15} />
                  Cancel
                </button>
              </div>
              <div style={formGridStyle}>
                <DateField label="Issue Date" required value={issueForm.issue_date} onChange={value => setIssueForm(current => ({ ...current, issue_date: value }))} />
                <TextField label="Payee Name" required value={issueForm.payee_name} onChange={value => setIssueForm(current => ({ ...current, payee_name: value }))} />
                <TextField label="Payment Reference" value={issueForm.payment_reference} onChange={value => setIssueForm(current => ({ ...current, payment_reference: value }))} />
                <NumericField label="Amount" required value={issueForm.amount} onChange={value => setIssueForm(current => ({ ...current, amount: value }))} />
              </div>
              <div style={formActionStyle}>
                <button className="btn btn-primary" type="button" onClick={submitIssue} disabled={issuing}>
                  {issuing ? <InlineSpinner light /> : <IconCreditCardPay size={15} />}
                  {issuing ? 'Issuing...' : 'Mark Issued'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={panelTitleStyle}>Cheque Books</h2>
            <p style={panelSubtitleStyle}>{selectedBank ? bankLabel(selectedBank) : ''}</p>
          </div>
          {bookQuery.isFetching && <span style={fetchingStyle}><InlineSpinner size={12} /> Loading Books...</span>}
        </div>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Book Number', 'Range', 'Issued Date', 'Total', 'Available', 'Issued', 'Void', 'Status'].map(header => (
                  <th key={header} style={header === 'Total' || header === 'Available' || header === 'Issued' || header === 'Void' ? moneyThStyle : thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookQuery.isLoading && <EmptyRow columns={8} text="Loading Cheque Books..." />}
              {!bookQuery.isLoading && books.length === 0 && <EmptyRow columns={8} text="No Cheque Books found for selected bank." />}
              {!bookQuery.isLoading && books.map((book: any) => (
                <tr key={book.id}>
                  <td style={strongTdStyle}>{book.book_number}</td>
                  <td style={tdStyle}>{book.start_cheque_number} - {book.end_cheque_number}</td>
                  <td style={tdStyle}>{book.issued_date ? formatDate(book.issued_date, settings) : '-'}</td>
                  <td style={moneyTdStyle}>{book.total_cheques}</td>
                  <td style={moneyTdStyle}>{book.available_count}</td>
                  <td style={moneyTdStyle}>{book.issued_count}</td>
                  <td style={moneyTdStyle}>{book.void_count}</td>
                  <td style={tdStyle}><span style={statusStyle(book.status)}>{book.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={bookPage}
          totalPages={bookQuery.data?.totalPages ?? 1}
          totalRecords={bookQuery.data?.total ?? 0}
          pageSize={bookLimit}
          onPageChange={setBookPage}
          onPageSizeChange={nextLimit => { setBookLimit(nextLimit); setBookPage(1); }}
        />
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={panelTitleStyle}>Cheques</h2>
            <p style={panelSubtitleStyle}>Select a Bank Account to load its Cheques</p>
          </div>
          {chequeQuery.isFetching && <span style={fetchingStyle}><InlineSpinner size={12} /> Loading Cheques...</span>}
        </div>
        <div style={filterGridStyle}>
          <TextField
            label="Search"
            value={draftSearch}
            placeholder="Cheque Number, Book, Payee, Reference"
            onChange={setDraftSearch}
            inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }}
          />
          <FieldLabel label="Status">
            <select className="form-input" value={status} onChange={event => { setStatus(event.currentTarget.value as ChequeStatus | ''); setChequePage(1); }}>
              {chequeStatuses.map(value => <option key={value || 'all'} value={value}>{value || 'All Statuses'}</option>)}
            </select>
          </FieldLabel>
          <div style={filterActionsStyle}>
            <button className="btn btn-secondary" type="button" onClick={clearSearch}>
              <IconX size={15} />
              Clear
            </button>
            <button className="btn btn-primary" type="button" onClick={applySearch} disabled={chequeQuery.isFetching}>
              {chequeQuery.isFetching ? <InlineSpinner light size={13} /> : <IconSearch size={15} />}
              Search
            </button>
          </div>
        </div>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Cheque Number', 'Book', 'Status', 'Issue Date', 'Payee', 'Amount', 'Void Reason', 'Actions'].map(header => (
                  <th key={header} style={header === 'Amount' ? moneyThStyle : thStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chequeQuery.isLoading && <EmptyRow columns={8} text="Loading Cheques..." />}
              {!chequeQuery.isLoading && cheques.length === 0 && <EmptyRow columns={8} text="No Cheques found for selected filters." />}
              {!chequeQuery.isLoading && cheques.map((cheque: any) => (
                <tr key={cheque.id}>
                  <td style={strongTdStyle}>{cheque.cheque_number}</td>
                  <td style={tdStyle}>{cheque.book_number}</td>
                  <td style={tdStyle}><span style={statusStyle(cheque.status)}>{cheque.status}</span></td>
                  <td style={tdStyle}>{cheque.issue_date ? formatDate(cheque.issue_date, settings) : '-'}</td>
                  <td style={tdStyle}>{cheque.payee_name || '-'}</td>
                  <td style={moneyTdStyle}>{cheque.amount ? formatMoney(cheque.amount, settings) : '-'}</td>
                  <td style={tdStyle}>{cheque.void_reason || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      {['Available', 'Reserved'].includes(cheque.status) && (
                        <>
                          <button className="btn-secondary" type="button" style={miniButtonStyle} onClick={() => { setIssueTarget(cheque); setVoidTarget(null); }}>
                            Issue
                          </button>
                          <button className="btn-secondary" type="button" style={miniDangerButtonStyle} onClick={() => { setVoidTarget(cheque); setIssueTarget(null); }}>
                            Void
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={chequePage}
          totalPages={chequeQuery.data?.totalPages ?? 1}
          totalRecords={chequeQuery.data?.total ?? 0}
          pageSize={chequeLimit}
          onPageChange={setChequePage}
          onPageSizeChange={nextLimit => { setChequeLimit(nextLimit); setChequePage(1); }}
        />
      </section>
    </main>
  );
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return (
    <tr>
      <td colSpan={columns} style={emptyTdStyle}>{text}</td>
    </tr>
  );
}

const pageShellStyle: React.CSSProperties = {
  minHeight: 0,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const toolbarStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  padding: '9px 12px',
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1fr) auto',
  gap: 10,
  alignItems: 'end',
  flexShrink: 0,
};

const toolbarActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'flex-end',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))',
  gap: 8,
  flexShrink: 0,
};

const summaryTileStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt)',
  padding: '10px 12px',
  display: 'grid',
  gap: 5,
  minWidth: 0,
};

const summaryLabelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.7rem',
  fontWeight: 850,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: '0.98rem',
  fontWeight: 900,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
  flexShrink: 0,
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-heading)',
  fontSize: '0.9rem',
  fontWeight: 900,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.72rem',
  fontWeight: 750,
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))',
  gap: 10,
  padding: 12,
  alignItems: 'end',
};

const notesFieldStyle: React.CSSProperties = {
  padding: '0 12px 12px',
};

const formActionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '0 12px 12px',
};

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 1fr) 180px auto',
  gap: 10,
  alignItems: 'end',
  padding: 12,
  borderBottom: '1px solid var(--color-border-subtle)',
};

const filterActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 7,
  justifyContent: 'flex-end',
};

const tableWrapStyle: React.CSSProperties = {
  overflow: 'auto',
  background: 'var(--color-surface)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.75rem',
};

const thStyle: React.CSSProperties = {
  background: 'var(--color-table-header-bg)',
  color: 'var(--color-table-header-text)',
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  textAlign: 'left',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const moneyThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  color: 'var(--color-text)',
  verticalAlign: 'middle',
};

const strongTdStyle: React.CSSProperties = {
  ...tdStyle,
  fontWeight: 900,
  color: 'var(--color-heading)',
  fontFamily: 'var(--font-mono)',
};

const moneyTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 850,
};

const emptyTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontWeight: 800,
  padding: 26,
};

const miniButtonStyle: React.CSSProperties = {
  minHeight: 24,
  padding: '3px 9px',
  fontSize: '0.68rem',
  fontWeight: 850,
};

const miniDangerButtonStyle: React.CSSProperties = {
  ...miniButtonStyle,
  color: 'var(--color-danger-text)',
  borderColor: 'var(--color-danger-border)',
};

const fetchingStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--color-text-muted)',
  fontSize: '0.72rem',
  fontWeight: 800,
};

const successMessageStyle: React.CSSProperties = {
  border: '1px solid var(--color-success-border)',
  background: 'var(--color-success-bg)',
  color: 'var(--color-success-text)',
  padding: '8px 10px',
  fontSize: '0.76rem',
  fontWeight: 850,
};

const errorMessageStyle: React.CSSProperties = {
  border: '1px solid var(--color-danger-border)',
  background: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  padding: '8px 10px',
  fontSize: '0.76rem',
  fontWeight: 850,
};

const emptyStateStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  padding: 28,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
};
