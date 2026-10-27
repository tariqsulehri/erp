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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DateField, NumericField, SelectField, TextareaField, TextField } from '@/components/ui/FormFields';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SearchField } from '@/components/ui/SearchField';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

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

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  Available: 'success',
  Reserved: 'info',
  Issued: 'warning',
  Cleared: 'success',
  Bounced: 'danger',
  Void: 'neutral',
  Cancelled: 'neutral',
  Stopped: 'danger',
  Active: 'success',
  Closed: 'neutral',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_BADGE[status] ?? 'neutral'}>{status}</Badge>;
}

/** Grid, not flex, so stacked panels keep their height and the tab body scrolls. */
const tabBodyStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignContent: 'start',
  gap: 12,
};

function maskAccountNumber(value?: string) {
  const clean = String(value ?? '').trim();
  if (clean.length <= 4) return clean || 'Not Set';
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

  const bankAccounts = useMemo(() => supportQuery.data?.bank_accounts ?? [], [supportQuery.data]);
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
    if (!form.bank_account_id) return 'Select a Bank Account.';
    if (!form.book_number.trim()) return 'Enter a Cheque Book Number.';
    if (!/^\d+$/.test(form.start_cheque_number.trim())) return 'Start Cheque Number must use digits only.';
    if (!/^\d+$/.test(form.end_cheque_number.trim())) return 'End Cheque Number must use digits only.';
    const start = BigInt(form.start_cheque_number.trim());
    const end = BigInt(form.end_cheque_number.trim());
    if (end < start) return 'End Cheque Number cannot be less than Start Cheque Number.';
    if (end - start + 1n > 1000n) return 'One Cheque Book can have at most 1000 cheques.';
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
      setMessage({ kind: 'success', text: result.message ?? 'Cheque Book created.' });
      setEntryOpen(false);
      setForm({ ...blankBookForm(), bank_account_id: selectedBankId });
      setBookPage(1);
      setChequePage(1);
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not create the Cheque Book. Please try again.') });
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
      setMessage({ kind: 'success', text: result.message ?? 'Cheque voided.' });
      setVoidTarget(null);
      setVoidForm({ reason: 'Torn', notes: '' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not void the Cheque. Please try again.') });
    }
  }

  async function submitIssue() {
    if (!issueTarget) return;
    if (!issueForm.payee_name.trim()) {
      setMessage({ kind: 'error', text: 'Enter a Payee Name.' });
      return;
    }
    if (numericValue(issueForm.amount) <= 0) {
      setMessage({ kind: 'error', text: 'Amount must be more than zero.' });
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
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not issue the Cheque. Please try again.') });
    }
  }

  const refreshing = bookQuery.isFetching || chequeQuery.isFetching;

  if (supportQuery.isLoading) {
    return (
      <section className="panel">
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="spinner" aria-hidden />
          <div className="empty-title">Loading Bank Accounts…</div>
        </div>
      </section>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <section className="panel">
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <div className="empty-title">No Active Bank Accounts</div>
          <div className="empty-desc">Add an active Bank Account on the Bank Accounts tab, then come back to create its cheque books.</div>
        </div>
      </section>
    );
  }

  return (
    <div style={tabBodyStyle}>
      {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}

      <section className="panel" style={{ overflow: 'visible' }}>
        <div className="filter-bar" style={{ borderBottom: 'none' }}>
          <div className="filter-grid" style={{ flex: '1 1 auto', minWidth: 0 }}>
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
            <Button icon={<IconRefresh size={16} stroke={1.8} />} loading={refreshing} onClick={() => { bookQuery.refetch(); chequeQuery.refetch(); }}>
              Refresh
            </Button>
            {!entryOpen && (
              <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => { setEntryOpen(true); setMessage(null); }}>
                New Cheque Book
              </Button>
            )}
          </div>
        </div>
      </section>

      {entryOpen && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">New Cheque Book</h2>
              <p className="page-head-desc">Enter the first and last cheque numbers. Every cheque in between is added.</p>
            </div>
            <div className="row-actions" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => setEntryOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" icon={<IconCheck size={16} stroke={1.8} />} onClick={generateBook} loading={saving}>
                {saving ? 'Creating…' : 'Create Cheques'}
              </Button>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="span-2">
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
              </div>
              <TextField label="Cheque Book Number" required value={form.book_number} onChange={value => patchForm({ book_number: value })} />
              <TextField label="Prefix" value={form.prefix ?? ''} onChange={value => patchForm({ prefix: value })} />
              <TextField label="Start Cheque Number" required value={form.start_cheque_number} onChange={value => patchForm({ start_cheque_number: value.replace(/\D/g, '') })} inputProps={{ inputMode: 'numeric' }} />
              <TextField label="End Cheque Number" required value={form.end_cheque_number} onChange={value => patchForm({ end_cheque_number: value.replace(/\D/g, '') })} inputProps={{ inputMode: 'numeric' }} />
              <TextField label="Suffix" value={form.suffix ?? ''} onChange={value => patchForm({ suffix: value })} />
              <DateField label="Issued Date" value={form.issued_date ?? ''} onChange={value => patchForm({ issued_date: value })} />
              <DateField label="Received Date" value={form.received_date ?? ''} onChange={value => patchForm({ received_date: value })} />
              <div className="span-all">
                <TextareaField label="Notes" rows={2} value={form.notes ?? ''} onChange={value => patchForm({ notes: value })} />
              </div>
            </div>
          </div>
        </section>
      )}

      {voidTarget && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Void Cheque {voidTarget.cheque_number}</h2>
              <p className="page-head-desc">{voidTarget.book_number} / {voidTarget.bank_name}. A voided cheque cannot be issued again.</p>
            </div>
            <div className="row-actions" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</Button>
              <Button variant="danger" icon={<IconBan size={16} stroke={1.8} />} onClick={submitVoid} loading={voiding}>
                {voiding ? 'Voiding…' : 'Void Cheque'}
              </Button>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <SelectField
                label="Void Reason"
                required
                value={voidForm.reason}
                options={voidReasons.map(reason => ({ value: reason, label: reason }))}
                onChange={value => setVoidForm(current => ({ ...current, reason: value as VoidReason }))}
              />
              <div className="span-3">
                <TextField label="Notes" value={voidForm.notes} onChange={value => setVoidForm(current => ({ ...current, notes: value }))} />
              </div>
            </div>
          </div>
        </section>
      )}

      {issueTarget && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Issue Cheque {issueTarget.cheque_number}</h2>
              <p className="page-head-desc">{issueTarget.book_number} / {issueTarget.bank_name}</p>
            </div>
            <div className="row-actions" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => setIssueTarget(null)} disabled={issuing}>Cancel</Button>
              <Button variant="primary" icon={<IconCreditCardPay size={16} stroke={1.8} />} onClick={submitIssue} loading={issuing}>
                {issuing ? 'Issuing…' : 'Mark Issued'}
              </Button>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <DateField label="Issue Date" required value={issueForm.issue_date} onChange={value => setIssueForm(current => ({ ...current, issue_date: value }))} />
              <TextField label="Payee Name" required value={issueForm.payee_name} onChange={value => setIssueForm(current => ({ ...current, payee_name: value }))} />
              <TextField label="Payment Reference" value={issueForm.payment_reference} onChange={value => setIssueForm(current => ({ ...current, payment_reference: value }))} />
              <NumericField label="Amount" required value={issueForm.amount} onChange={value => setIssueForm(current => ({ ...current, amount: value }))} />
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="panel-title">Cheque Books</h2>
            {selectedBank && <p className="page-head-desc">{bankLabel(selectedBank)}</p>}
          </div>
          {bookQuery.isFetching && !bookQuery.isLoading && <span className="filter-bar-end">Refreshing…</span>}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>Book Number</th>
                <th>Cheque Range</th>
                <th style={{ width: 120 }}>Issued Date</th>
                <th className="num" style={{ width: 90 }}>Total</th>
                <th className="num" style={{ width: 90 }}>Available</th>
                <th className="num" style={{ width: 90 }}>Issued</th>
                <th className="num" style={{ width: 90 }}>Void</th>
                <th style={{ width: 110 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookQuery.isLoading && <TableMessageRow colSpan={8} title="Loading Cheque Books…" loading />}
              {!bookQuery.isLoading && bookQuery.error && (
                <TableMessageRow colSpan={8} title="Cheque Books Could Not Be Loaded" description={friendlyErrorMessage(bookQuery.error, 'Cannot reach the server. Check your connection and try again.')} action={<Button onClick={() => bookQuery.refetch()}>Try Again</Button>} />
              )}
              {!bookQuery.isLoading && !bookQuery.error && books.length === 0 && (
                <TableMessageRow
                  colSpan={8}
                  title="No Cheque Books Yet"
                  description="Create a Cheque Book for this Bank Account to add its cheques."
                  action={!entryOpen ? <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => { setEntryOpen(true); setMessage(null); }}>New Cheque Book</Button> : undefined}
                />
              )}
              {!bookQuery.isLoading && books.map((book: any) => (
                <tr key={book.id}>
                  <td className="cell-strong">{book.book_number}</td>
                  <td>{book.start_cheque_number} to {book.end_cheque_number}</td>
                  <td className="cell-muted">{book.issued_date ? formatDate(book.issued_date, settings) : 'Not Set'}</td>
                  <td className="num">{book.total_cheques}</td>
                  <td className="num">{book.available_count}</td>
                  <td className="num">{book.issued_count}</td>
                  <td className="num">{book.void_count}</td>
                  <td><StatusBadge status={book.status} /></td>
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
          recordLabel="Cheque Books"
          onPageChange={setBookPage}
          onPageSizeChange={nextLimit => { setBookLimit(nextLimit); setBookPage(1); }}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Cheques</h2>
          <div className="filter-bar-end" style={{ flexWrap: 'wrap' }}>
            {chequeQuery.isFetching && !chequeQuery.isLoading && <span>Refreshing…</span>}
            <span>{selectedBank ? selectedBank.bank_name : 'Not Set'}</span>
            <span aria-hidden>·</span>
            <span>{totalCheques} Cheques</span>
            <span aria-hidden>·</span>
            <span>On This Page: {availableCount} Available, {issuedCount} Issued, {voidCount} Void</span>
          </div>
        </div>
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField
              label="Search Cheques"
              value={draftSearch}
              placeholder="Cheque Number, Book, Payee, Or Reference"
              onChange={setDraftSearch}
              onSubmit={applySearch}
            />
          </div>
          <select
            className="form-input"
            aria-label="Filter By Status"
            value={status}
            onChange={event => { setStatus(event.currentTarget.value as ChequeStatus | ''); setChequePage(1); }}
            style={{ width: 160 }}
          >
            {chequeStatuses.map(value => <option key={value || 'all'} value={value}>{value || 'All Statuses'}</option>)}
          </select>
          <Button icon={<IconSearch size={16} stroke={1.8} />} onClick={applySearch} disabled={chequeQuery.isFetching}>Search</Button>
          {(draftSearch || appliedSearch || status) && (
            <Button variant="ghost" icon={<IconX size={16} stroke={1.8} />} onClick={clearSearch}>Clear</Button>
          )}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Cheque Number</th>
                <th style={{ width: 130 }}>Book</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 120 }}>Issue Date</th>
                <th>Payee</th>
                <th className="num" style={{ width: 150 }}>Amount</th>
                <th style={{ width: 140 }}>Void Reason</th>
                <th style={{ width: 150 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {chequeQuery.isLoading && <TableMessageRow colSpan={8} title="Loading Cheques…" loading />}
              {!chequeQuery.isLoading && cheques.length === 0 && (
                <TableMessageRow colSpan={8} title="No Cheques Match" description="Change the search text or the Status filter to see more cheques." />
              )}
              {!chequeQuery.isLoading && cheques.map((cheque: any) => (
                <tr key={cheque.id} className={voidTarget?.id === cheque.id || issueTarget?.id === cheque.id ? 'is-selected' : undefined}>
                  <td className="cell-strong">{cheque.cheque_number}</td>
                  <td className="cell-muted">{cheque.book_number}</td>
                  <td><StatusBadge status={cheque.status} /></td>
                  <td className={cheque.issue_date ? undefined : 'cell-muted'}>{cheque.issue_date ? formatDate(cheque.issue_date, settings) : 'Not Set'}</td>
                  <td className={cheque.payee_name ? undefined : 'cell-muted'}>{cheque.payee_name || 'Not Set'}</td>
                  <td className={cheque.amount ? 'num' : 'num cell-muted'}>{cheque.amount ? formatMoney(cheque.amount, settings) : 'Not Set'}</td>
                  <td className={cheque.void_reason ? undefined : 'cell-muted'}>{cheque.void_reason || 'Not Set'}</td>
                  <td className="cell-actions">
                    {['Available', 'Reserved'].includes(cheque.status) && (
                      <div className="row-actions">
                        <Button variant="ghost" size="sm" icon={<IconCreditCardPay size={16} stroke={1.8} />} onClick={() => { setIssueTarget(cheque); setVoidTarget(null); }}>
                          Issue
                        </Button>
                        <Button variant="ghost" size="sm" icon={<IconBan size={16} stroke={1.8} />} onClick={() => { setVoidTarget(cheque); setIssueTarget(null); }}>
                          Void
                        </Button>
                      </div>
                    )}
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
          recordLabel="Cheques"
          onPageChange={setChequePage}
          onPageSizeChange={nextLimit => { setChequeLimit(nextLimit); setChequePage(1); }}
        />
      </section>
    </div>
  );
}
