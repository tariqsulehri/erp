'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  IconBuildingBank,
  IconCalendarDollar,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { useBankAccountsList } from '@/lib/api/bank-accounts';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, useUpdateVoucher, useVoucherDetail } from '@/lib/api/vouchers';
import { FieldLabel, SearchableSelect, SummaryRow, type VoucherSelectOption } from './VoucherControls';
import {
  BankReceiptVoucherLineTable,
  type BankReceiptDepositKind,
  type BankReceiptVoucherLine,
} from './BankReceiptVoucherLineTable';
import { VoucherActionButtons, VoucherLineSection, VoucherMessageBanner, VoucherPageHeader, VoucherSummaryFooter } from './VoucherLayout';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { getBankAccountOptions, getVoucherLineAccountOptions } from './VoucherAccountRules';
import { buildBankReceiptVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateBankReceiptVoucher } from './VoucherValidation';
import {
  amountValue,
  compactInputStyle,
  compactNumericInputStyle,
  friendlyErrorMessage,
  today,
  type VoucherMessageKind,
} from './VoucherShared';

type DepositKind = BankReceiptDepositKind;
type MessageKind = VoucherMessageKind;

type ReceiptLine = BankReceiptVoucherLine;

type SelectOption = VoucherSelectOption;

const depositTypes: SelectOption[] = [
  { value: 'CASH', label: 'Cash Deposit', searchText: 'cash' },
  { value: 'CHEQUE', label: 'Cheque Deposit', searchText: 'cheque check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', searchText: 'online transfer bank' },
  { value: 'OTHER', label: 'Other Deposit', searchText: 'other' },
];

const INITIAL_LINE_COUNT = 10;
const initialLines = () => Array.from({ length: INITIAL_LINE_COUNT }, (_, index) => blankLine(index + 1));

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
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
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

  const allAccounts = accountsQuery.data?.data ?? [];
  const activeBankAccounts = bankAccountsQuery.data?.data ?? [];
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
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Deposit Date...' : postingDateGuard.statusMessage;

  useEffect(() => {
    if (accountsError) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(accountsError, 'Unable to load accounts. Please refresh and try again.'),
      });
    }
  }, [accountsError]);

  useEffect(() => {
    if (dateValidation.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(dateValidation.error, 'Unable to check Deposit Date. Please refresh and try again.'),
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
      setMessage({ kind: 'error', text: 'This is not a Bank Receipt Voucher. Please open it from the correct voucher screen.' });
      return;
    }
    if (voucher.status !== 'Draft') {
      setMessage({ kind: 'error', text: 'Only Draft vouchers can be edited.' });
      return;
    }
    if (voucher.approval_status === 'Pending' || voucher.approval_status === 'Approved') {
      setMessage({ kind: 'error', text: 'This voucher is in approval workflow and cannot be edited.' });
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
    const paddedLines = [...receiptLines];
    while (paddedLines.length < INITIAL_LINE_COUNT) {
      paddedLines.push(blankLine(paddedLines.length + 1));
    }

    setDepositDate(String(voucher.voucher_date ?? '').slice(0, 10));
    setReferenceNumber(voucher.reference || '');
    setDescription(voucher.narration || '');
    setBankAccountId(bankLine?.account_id || '');
    setLines(paddedLines);
    setNextLineId(paddedLines.length + 1);
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
    setNextLineId(INITIAL_LINE_COUNT + 1);
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
      setMessage({ kind: 'success', text: 'Voucher data refreshed successfully.' });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Unable to refresh voucher data. Please try again.'),
      });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Unable to print Bank Receipt Voucher.'),
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
      setMessage({ kind: 'error', text: 'Selected Bank Account was not found.' });
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
      saveErrorFallback: 'Unable to save Bank Receipt Voucher.',
    });
    setMessage(result);
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <VoucherPageHeader
        title="Bank Receipt Voucher"
        badgeText="BRV"
        badgeColor="#15803d"
        badgeBackground="#dcfce7"
        accent="linear-gradient(135deg, #15803d, #0f766e)"
        icon={<IconBuildingBank size={20} stroke={1.8} />}
        mode={editingVoucherId ? 'Edit' : 'Add'}
        actions={
          <VoucherActionButtons
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
            onProcess={() => saveVoucher(true)}
          />
        }
      />

      <VoucherMessageBanner message={message} />

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 145px minmax(190px, 1fr) minmax(260px, 1.5fr) 145px', gap: 8, alignItems: 'end' }}>
            <FieldLabel label="Receipt Number"><input className="form-input" value={detailQuery.data?.voucher_number ?? 'Auto'} disabled style={compactInputStyle} /></FieldLabel>
            <FieldLabel label="Deposit Date" required>
              <div style={{ position: 'relative' }}>
                <IconCalendarDollar size={15} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--color-text-muted)' }} />
                <input
                  className="form-input"
                  type="date"
                  value={depositDate}
                  onChange={event => setDepositDate(event.currentTarget.value)}
                  style={{ ...compactInputStyle, paddingLeft: 28 }}
                />
              </div>
            </FieldLabel>
            <FieldLabel label="Reference Number">
              <input
                className="form-input"
                value={referenceNumber}
                onChange={event => setReferenceNumber(event.currentTarget.value)}
                placeholder="Slip, Cheque, Note"
                style={compactInputStyle}
              />
            </FieldLabel>
            <FieldLabel label="Bank Account" required>
              <SearchableSelect
                value={bankAccountId}
                options={bankAccountOptions}
                onChange={setBankAccountId}
                placeholder={bankAccountsQuery.isLoading ? 'Loading Accounts' : bankAccountsQuery.error ? 'Accounts Not Loaded' : 'Search Bank Account'}
                disabled={bankAccountsQuery.isLoading || bankAccountsQuery.isError}
              />
            </FieldLabel>
            <FieldLabel label="Current Balance"><input className="form-input" value={money(currentBalance)} disabled style={compactNumericInputStyle} /></FieldLabel>
          </div>

          <div
            style={{
              minHeight: dateStatusMessage ? 16 : 0,
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-danger-text)',
              fontWeight: 500,
              fontSize: '0.66rem',
              lineHeight: 1.2,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {dateStatusMessage}
          </div>

          <div>
            <FieldLabel label="Voucher Details">
              <input
                className="form-input"
                value={description}
                onChange={event => setDescription(event.currentTarget.value)}
                placeholder="Short Description For This Bank Receipt"
                style={compactInputStyle}
              />
            </FieldLabel>
          </div>

          <VoucherLineSection title="Receipt Lines" onAddLine={addLine}>
            <BankReceiptVoucherLineTable
              lines={lines}
              accountOptions={lineAccountOptions}
              depositTypes={depositTypes}
              accountsLoading={accountsLoading}
              accountsError={Boolean(accountsError)}
              generalSettings={generalSettings}
              onUpdateLine={updateLine}
              onRemoveLine={removeLine}
            />
          </VoucherLineSection>

          <VoucherSummaryFooter activeLines={activeLines.length}>
            <SummaryRow label="Cash Deposit" value={cashTotal} width={112} formatMoneyValue={money} />
            <SummaryRow label="Cheque Deposit" value={chequeTotal} width={112} formatMoneyValue={money} />
            <SummaryRow label="Bank Transfer" value={transferTotal} width={112} formatMoneyValue={money} />
            <SummaryRow label="Other Deposit" value={otherTotal} width={112} formatMoneyValue={money} />
            <SummaryRow label="Total Deposit" value={totalAmount} strong width={112} formatMoneyValue={money} />
            <SummaryRow label="Difference" value={0} width={112} formatMoneyValue={money} />
          </VoucherSummaryFooter>
        </section>
    </main>
  );
}
