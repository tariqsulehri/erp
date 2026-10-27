'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { useBankAccountsList } from '@/lib/api/bank-accounts';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, useUpdateVoucher, useVoucherDetail } from '@/lib/api/vouchers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect, type SelectOption as VoucherSelectOption } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import { IconSearch } from '@tabler/icons-react';
import { AccountSearchDialog } from '@/components/search/AccountSearchDialog';
import {
  AddLineButton,
  DocumentActions,
  DocumentFormPanel,
  DocumentHeader,
  DocumentMessage,
  DocumentPage,
  DocumentStatusBadges,
  DocumentSummary,
  LineShortcutHint,
  LinesPanel,
  SummaryAmount,
  useLineEntryKeyboard,
} from '@/components/documents';
import {
  BankReceiptVoucherLineTable,
  type BankReceiptVoucherLine,
} from './BankReceiptVoucherLineTable';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { getBankAccountOptions, getVoucherLineAccountOptions } from './VoucherAccountRules';
import { buildBankReceiptVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateBankReceiptVoucher } from './VoucherValidation';
import {
  amountValue,
  friendlyErrorMessage,
  today,
  type VoucherMessageKind,
} from './VoucherShared';

type MessageKind = VoucherMessageKind;

type ReceiptLine = BankReceiptVoucherLine;

type SelectOption = VoucherSelectOption;

const depositTypes: SelectOption[] = [
  { value: 'CASH', label: 'Cash Deposit', searchText: 'cash' },
  { value: 'CHEQUE', label: 'Cheque Deposit', searchText: 'cheque check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', searchText: 'online transfer bank' },
  { value: 'OTHER', label: 'Other Deposit', searchText: 'other' },
];

const INITIAL_LINE_COUNT = 1;
const initialLines = () => [blankLine(1)];

const blankLine = (id: number): ReceiptLine => ({
  id,
  receivedFromAccountId: '',
  description: '',
  depositKind: 'CASH',
  chequeNumber: '',
  chequeDate: '',
  chequeBankName: '',
  clearingDate: '',
  amount: '',
});

export default function BankReceiptVoucherPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingVoucherId = searchParams.get('id');
  const { data: generalSettings } = useGeneralSettings();
  const { defaultVoucherDate } = useDefaultVoucherDate();
  const [depositDate, setDepositDate] = useState(defaultVoucherDate);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [lines, setLines] = useState<ReceiptLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);
  const postingDateGuard = usePostingDateGuard(depositDate, 'Deposit Date');
  const dateValidation = postingDateGuard.dateValidation;
  const isDepositDateValid = postingDateGuard.dateIsValid;

  const accountsQuery = useAccountsList({
    page: 1,
    limit: 200,
    is_active: true,
    is_posting: true,
  });
  const bankAccountsQuery = useBankAccountsList({
    page: 1,
    limit: 200,
    is_active: true,
  });
  const createVoucher = useCreateVoucher();
  const updateVoucher = useUpdateVoucher();
  const detailQuery = useVoucherDetail(editingVoucherId ?? undefined);

  const allAccounts = useMemo(() => accountsQuery.data?.data ?? [], [accountsQuery.data]);
  const activeBankAccounts = useMemo(() => bankAccountsQuery.data?.data ?? [], [bankAccountsQuery.data]);
  const bankAccountOptions = useMemo(() => getBankAccountOptions(activeBankAccounts), [activeBankAccounts]);
  const lineAccountOptions = useMemo(() => getVoucherLineAccountOptions(allAccounts, activeBankAccounts), [allAccounts, activeBankAccounts]);
  const selectedBankAccount = bankAccountOptions.find(option => option.value === bankAccountId);
  const enteredLines = lines.filter(line =>
    line.receivedFromAccountId ||
    line.description.trim() ||
    line.chequeNumber.trim() ||
    line.chequeDate ||
    line.chequeBankName.trim() ||
    line.clearingDate ||
    amountValue(line.amount) > 0
  );
  const activeLines = enteredLines;
  const validLines = enteredLines.filter(line => line.receivedFromAccountId && amountValue(line.amount) > 0);
  const totalAmount = lines.reduce((sum, line) => sum + amountValue(line.amount), 0);
  const cashTotal = lines.filter(line => line.depositKind === 'CASH').reduce((sum, line) => sum + amountValue(line.amount), 0);
  const chequeTotal = lines.filter(line => line.depositKind === 'CHEQUE').reduce((sum, line) => sum + amountValue(line.amount), 0);
  const transferTotal = lines.filter(line => line.depositKind === 'BANK_TRANSFER').reduce((sum, line) => sum + amountValue(line.amount), 0);
  const otherTotal = lines.filter(line => line.depositKind === 'OTHER').reduce((sum, line) => sum + amountValue(line.amount), 0);
  const currentBalance = Number(selectedBankAccount?.openingBalance ?? 0);
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const saving = createVoucher.isPending || updateVoucher.isPending;
  const accountsLoading = accountsQuery.isLoading || bankAccountsQuery.isLoading;
  const accountsError = accountsQuery.error || bankAccountsQuery.error;
  const actionDisabled = saving || accountsLoading || postingDateGuard.disabled || detailQuery.isLoading;
  const lineKeyboard = useLineEntryKeyboard({
    onSave: () => saveVoucher(false),
    saveDisabled: actionDisabled,
    onAddLine: addLine,
  });
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Deposit Date...' : postingDateGuard.statusMessage;

  useEffect(() => {
    if (accountsError) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(accountsError, 'Could not load accounts. Refresh the page and try again.'),
      });
    }
  }, [accountsError]);

  useEffect(() => {
    if (dateValidation.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(dateValidation.error, 'Could not check Deposit Date. Refresh the page and try again.'),
      });
    }
  }, [dateValidation.error]);

  useEffect(() => {
    setDepositDate(currentDate => (currentDate === today() ? defaultVoucherDate : currentDate));
  }, [defaultVoucherDate]);

  useEffect(() => {
    const voucher = detailQuery.data;
    if (!voucher || !editingVoucherId) return;
    if (voucher.voucher_type !== 'BRV') {
      setMessage({ kind: 'error', text: 'This is not a Bank Receipt Voucher. Open it from the right voucher screen.' });
      return;
    }
    if (voucher.status !== 'Draft') {
      setMessage({ kind: 'error', text: 'Only Draft vouchers can be edited.' });
      return;
    }
    if (voucher.approval_status === 'Pending' || voucher.approval_status === 'Approved') {
      setMessage({ kind: 'error', text: 'This voucher is waiting for approval or is approved, so it cannot be edited.' });
      return;
    }

    const sortedLines = [...(voucher.lines ?? [])].sort((a: any, b: any) => Number(a.line_no) - Number(b.line_no));
    const bankLine = sortedLines[0];
    const receiptLines = sortedLines.slice(1).map((line: any, index: number): ReceiptLine => ({
      id: index + 1,
      receivedFromAccountId: line.account_id,
      description: line.narration || '',
      depositKind: 'CASH',
      chequeNumber: '',
      chequeDate: '',
      chequeBankName: '',
      clearingDate: '',
      amount: String(line.cr_amount ?? ''),
    }));
    const loadedLines = receiptLines.length > 0 ? receiptLines : [blankLine(1)];

    setDepositDate(String(voucher.voucher_date ?? '').slice(0, 10));
    setReferenceNumber(voucher.reference || '');
    setDescription(voucher.narration || '');
    setBankAccountId(bankLine?.account_id || '');
    setLines(loadedLines);
    setNextLineId(loadedLines.length + 1);
    setMessage(null);
  }, [detailQuery.data, editingVoucherId]);

  function updateLine(id: number, patch: Partial<ReceiptLine>) {
    setLines(current => current.map(line => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines(current => [...current, blankLine(nextLineId)]);
    setNextLineId(value => value + 1);
  }

  function removeLine(id: number) {
    setLines(current => (current.length > 1 ? current.filter(line => line.id !== id) : current));
  }

  function resetForm(clearMessage = true) {
    setDepositDate(defaultVoucherDate);
    setReferenceNumber('');
    setDescription('');
    setBankAccountId('');
    setLines(initialLines());
    setNextLineId(2);
    if (editingVoucherId) router.push(pathname);
    if (clearMessage) setMessage(null);
  }

  async function refreshVoucherData() {
    setMessage(null);
    try {
      const accountsResult = await accountsQuery.refetch();
      if (accountsResult.error) throw accountsResult.error;
      const bankAccountsResult = await bankAccountsQuery.refetch();
      if (bankAccountsResult.error) throw bankAccountsResult.error;
      if (isDepositDateValid) {
        const dateResult = await dateValidation.refetch();
        if (dateResult.error) throw dateResult.error;
      }
      setMessage({ kind: 'success', text: 'Voucher data refreshed.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Could not refresh voucher data. Please try again.'),
      });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Could not print Bank Receipt Voucher. Please try again.'),
      });
    }
  }

  function validateForm() {
    return validateBankReceiptVoucher({
      depositDate,
      isDepositDateValid,
      dateValidation,
      accountsLoading,
      accountsError,
      accountOptions: lineAccountOptions,
      bankAccountId,
      selectedBankAccount,
      enteredLines,
      validLines,
      allLines: lines,
      totalAmount,
    });
  }

  async function saveVoucher(submitForApproval: boolean) {
    setProcessConfirmOpen(false);
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Voucher is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }
    if (!selectedBankAccount) {
      setMessage({ kind: 'error', text: 'Bank Account was not found. Select it again.' });
      return;
    }

    const payloadResult = buildBankReceiptVoucherLines({
      bankAccountId,
      selectedBankAccount,
      accountOptions: lineAccountOptions,
      depositTypes,
      validLines,
      allLines: lines,
      totalAmount,
      description,
    });
    if (!payloadResult.ok) {
      setMessage({ kind: 'error', text: payloadResult.error });
      return;
    }

    const result = await saveVoucherDocument({
      createVoucher,
      updateVoucher,
      invalidateVoucherList: async () => undefined,
      editingVoucherId,
      createInput: {
        voucher_type: 'BRV',
        voucher_date: depositDate,
        reference: referenceNumber || undefined,
        narration: description || 'Bank Receipt Voucher',
        submit_for_approval: submitForApproval,
        lines: payloadResult.lines,
      },
      submitForApproval,
      resetForm,
      saveErrorFallback: 'Could not save Bank Receipt Voucher. Please try again.',
    });
    setMessage(result);
  }

  /** Save For Approval: validate first, then ask for confirmation. */
  function requestProcessConfirmation() {
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Voucher is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }
    setProcessConfirmOpen(true);
  }


  return (
    <DocumentPage>
      <DocumentHeader
        title="Bank Receipt Voucher"
        help={(
          <>
            <p>Use this screen to record money deposited into a Bank Account.</p>
            <ul>
              <li>Choose the Bank Account, then add one line for each amount received.</li>
              <li>For a cheque, enter the Cheque Number, Cheque Date and Cheque Bank.</li>
              <li>Save Draft keeps the voucher. Save For Approval sends it to an approver.</li>
            </ul>
            <p>Posted vouchers cannot be changed. Use Reverse to correct them.</p>
          </>
        )}
        badges={<DocumentStatusBadges code="BRV" mode={editingVoucherId ? 'Edit' : 'Add'} />}
        actions={(
          <DocumentActions
            saving={saving}
            actionDisabled={actionDisabled}
            newDisabled={postingDateGuard.disabled}
            newDisabledReason={dateStatusMessage || 'Deposit Date is being checked.'}
            onNew={() => resetForm()}
            onRefresh={refreshVoucherData}
            onPrint={printVoucher}
            onCancel={() => resetForm()}
            onSaveDraft={() => saveVoucher(false)}
            processLabel="Save For Approval"
            onProcess={requestProcessConfirmation}
          />
        )}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <DocumentFormPanel columns={6} statusMessage={dateStatusMessage}>
        <TextField label="Receipt Number" value={detailQuery.data?.voucher_number ?? 'Auto'} disabled />
        <DateField label="Deposit Date" required value={depositDate} onChange={setDepositDate} />
        <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Slip, Cheque, Note" />
        <div className="span-2">
          <FieldLabel label="Bank Account" required>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  value={bankAccountId}
                  options={bankAccountOptions}
                  onChange={setBankAccountId}
                  placeholder={bankAccountsQuery.isLoading ? 'Loading Accounts' : bankAccountsQuery.error ? 'Accounts Not Loaded' : 'Search Bank Account'}
                  disabled={bankAccountsQuery.isLoading || bankAccountsQuery.isError}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<IconSearch size={16} stroke={1.8} />}
                onClick={() => setBankSearchOpen(true)}
                title="Advanced Bank Account Lookup"
                aria-label="Search Bank Account"
              />
            </div>
          </FieldLabel>
        </div>
        <NumericField label="Current Balance" value={money(currentBalance)} disabled />
        <div className="span-all">
          <TextField label="Voucher Details" value={description} onChange={setDescription} placeholder="Short Description For This Bank Receipt" />
        </div>
      </DocumentFormPanel>

      <LinesPanel
        title="Receipt Lines"
        hint={<LineShortcutHint mode="grid" />}
        actions={<AddLineButton onClick={addLine} />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        summary={(
          <DocumentSummary countLabel="Active Lines" count={activeLines.length}>
            <SummaryAmount label="Cash Deposit" value={money(cashTotal)} />
            <SummaryAmount label="Cheque Deposit" value={money(chequeTotal)} />
            <SummaryAmount label="Bank Transfer" value={money(transferTotal)} />
            <SummaryAmount label="Other Deposit" value={money(otherTotal)} />
            <SummaryAmount label="Total Deposit" value={money(totalAmount)} strong />
            <SummaryAmount label="Difference" value={money(0)} />
          </DocumentSummary>
        )}
      >
        <BankReceiptVoucherLineTable
          lines={lines}
          accountOptions={lineAccountOptions}
          depositTypes={depositTypes}
          accountsLoading={accountsLoading}
          accountsError={Boolean(accountsError)}
          generalSettings={generalSettings}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onAddLine={addLine}
        />
      </LinesPanel>

      {/* Advanced Bank Account Search Modal */}
      {bankSearchOpen && (
        <AccountSearchDialog
          open={true}
          title="Select Deposit Bank Account"
          options={bankAccountOptions}
          onSelect={selected => {
            setBankAccountId(selected.value);
            setBankSearchOpen(false);
          }}
          onClose={() => setBankSearchOpen(false)}
        />
      )}

      <ConfirmDialog
        open={processConfirmOpen}
        title="Save Bank Receipt Voucher For Approval?"
        message={`This saves the Bank Receipt Voucher (${money(totalAmount)}) and sends it for approval. It is posted after approval.`}
        confirmLabel="Yes, Save For Approval"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => saveVoucher(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />
    </DocumentPage>
  );
}
