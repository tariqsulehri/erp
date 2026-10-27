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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
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
import { CashBankVoucherLineTable, type CashBankVoucherLine } from './CashBankVoucherLineTable';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { getBankAccountOptions, getCashAccountOptions, getVoucherLineAccountOptions, type VoucherAccountOption } from './VoucherAccountRules';
import { buildCashBankVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateCashBankVoucher } from './VoucherValidation';
import {
  amountValue,
  friendlyErrorMessage,
  today,
  type VoucherMessageKind,
} from './VoucherShared';

type VoucherKind = 'BPV' | 'CPV' | 'CRV';
type MessageKind = VoucherMessageKind;

type CashBankLine = CashBankVoucherLine;

interface VoucherConfig {
  voucherType: VoucherKind;
  title: string;
  documentLabel: string;
  dateLabel: string;
  primaryAccountLabel: string;
  primaryAccountPlaceholder: string;
  detailsPlaceholder: string;
  linesTitle: string;
  lineAccountLabel: string;
  totalLabel: string;
  successNoun: string;
  icon: 'bank' | 'cash';
  direction: 'payment' | 'receipt';
  primaryAccountKind: 'Bank' | 'Cash';
  showChequeFields: boolean;
}

const voucherConfigs: Record<VoucherKind, VoucherConfig> = {
  BPV: {
    voucherType: 'BPV',
    title: 'Bank Payment Voucher',
    documentLabel: 'Payment Number',
    dateLabel: 'Payment Date',
    primaryAccountLabel: 'Pay From Bank Account',
    primaryAccountPlaceholder: 'Search Bank Account',
    detailsPlaceholder: 'Short Description For This Bank Payment',
    linesTitle: 'Payment Lines',
    lineAccountLabel: 'Paid To Account',
    totalLabel: 'Total Payment',
    successNoun: 'Bank Payment Voucher',
    icon: 'bank',
    direction: 'payment',
    primaryAccountKind: 'Bank',
    showChequeFields: true,
  },
  CPV: {
    voucherType: 'CPV',
    title: 'Cash Payment Voucher',
    documentLabel: 'Payment Number',
    dateLabel: 'Payment Date',
    primaryAccountLabel: 'Pay From Cash Account',
    primaryAccountPlaceholder: 'Search Cash Account',
    detailsPlaceholder: 'Short Description For This Cash Payment',
    linesTitle: 'Payment Lines',
    lineAccountLabel: 'Paid To Account',
    totalLabel: 'Total Payment',
    successNoun: 'Cash Payment Voucher',
    icon: 'cash',
    direction: 'payment',
    primaryAccountKind: 'Cash',
    showChequeFields: false,
  },
  CRV: {
    voucherType: 'CRV',
    title: 'Cash Receipt Voucher',
    documentLabel: 'Receipt Number',
    dateLabel: 'Receipt Date',
    primaryAccountLabel: 'Receive Into Cash Account',
    primaryAccountPlaceholder: 'Search Cash Account',
    detailsPlaceholder: 'Short Description For This Cash Receipt',
    linesTitle: 'Receipt Lines',
    lineAccountLabel: 'Received From Account',
    totalLabel: 'Total Receipt',
    successNoun: 'Cash Receipt Voucher',
    icon: 'cash',
    direction: 'receipt',
    primaryAccountKind: 'Cash',
    showChequeFields: false,
  },
};

const INITIAL_LINE_COUNT = 12;
const blankLine = (id: number): CashBankLine => ({
  id,
  accountId: '',
  description: '',
  chequeDetails: '',
  chequeDate: '',
  clearingDate: '',
  amount: '',
});
const initialLines = () => Array.from({ length: INITIAL_LINE_COUNT }, (_, index) => blankLine(index + 1));

export default function CashBankVoucherPage({ voucherType }: { voucherType: VoucherKind }) {
  const config = voucherConfigs[voucherType];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingVoucherId = searchParams.get('id');
  const { data: generalSettings } = useGeneralSettings();
  const { defaultVoucherDate } = useDefaultVoucherDate();
  const [voucherDate, setVoucherDate] = useState(defaultVoucherDate);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [primaryAccountId, setPrimaryAccountId] = useState('');
  const [lines, setLines] = useState<CashBankLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);
  const postingDateGuard = usePostingDateGuard(voucherDate, config.dateLabel);
  const dateValidation = postingDateGuard.dateValidation;
  const isVoucherDateValid = postingDateGuard.dateIsValid;

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
  const cashAccountOptions = useMemo(() => getCashAccountOptions(allAccounts), [allAccounts]);
  const bankAccountOptions = useMemo(() => getBankAccountOptions(activeBankAccounts), [activeBankAccounts]);
  const lineAccountOptions = useMemo(() => getVoucherLineAccountOptions(allAccounts, activeBankAccounts), [allAccounts, activeBankAccounts]);
  const primaryAccountOptions: VoucherAccountOption[] = config.primaryAccountKind === 'Bank' ? bankAccountOptions : cashAccountOptions;
  const selectedPrimaryAccount = primaryAccountOptions.find(option => option.value === primaryAccountId);
  const enteredLines = lines.filter(line =>
    line.accountId ||
    line.description.trim() ||
    line.chequeDetails.trim() ||
    line.chequeDate ||
    line.clearingDate ||
    amountValue(line.amount) > 0
  );
  const validLines = enteredLines.filter(line => line.accountId && amountValue(line.amount) > 0);
  const totalAmount = lines.reduce((sum, line) => sum + amountValue(line.amount), 0);
  const currentBalance = Number(selectedPrimaryAccount?.currentBalance ?? selectedPrimaryAccount?.openingBalance ?? 0);
  const difference = 0;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const saving = createVoucher.isPending || updateVoucher.isPending;
  const accountsLoading = accountsQuery.isLoading || bankAccountsQuery.isLoading;
  const accountsError = accountsQuery.error || bankAccountsQuery.error;
  const primaryAccountsLoading = config.primaryAccountKind === 'Bank' ? bankAccountsQuery.isLoading : accountsQuery.isLoading;
  const primaryAccountsError = config.primaryAccountKind === 'Bank' ? bankAccountsQuery.error : accountsError;
  const actionDisabled = saving || accountsLoading || postingDateGuard.disabled || detailQuery.isLoading;
  const lineKeyboard = useLineEntryKeyboard({
    onSave: () => saveVoucher(false),
    saveDisabled: actionDisabled,
    onAddLine: addLine,
  });
  const dateStatusMessage = postingDateGuard.isChecking ? `Checking ${config.dateLabel}...` : postingDateGuard.statusMessage;

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
        text: friendlyErrorMessage(dateValidation.error, `Could not check ${config.dateLabel}. Refresh the page and try again.`),
      });
    }
  }, [config.dateLabel, dateValidation.error]);

  useEffect(() => {
    setVoucherDate(currentDate => (currentDate === today() ? defaultVoucherDate : currentDate));
  }, [defaultVoucherDate]);

  useEffect(() => {
    const voucher = detailQuery.data;
    if (!voucher || !editingVoucherId) return;
    if (voucher.voucher_type !== config.voucherType) {
      setMessage({ kind: 'error', text: `This is not a ${config.title}. Open it from the right voucher screen.` });
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
    const primaryLine = sortedLines[0];
    const detailLines = sortedLines.slice(1).map((line: any, index: number): CashBankLine => ({
      id: index + 1,
      accountId: line.account_id,
      description: line.narration || '',
      chequeDetails: '',
      chequeDate: '',
      clearingDate: '',
      amount: config.direction === 'payment' ? String(line.dr_amount ?? '') : String(line.cr_amount ?? ''),
    }));
    const paddedLines = [...detailLines];
    while (paddedLines.length < INITIAL_LINE_COUNT) {
      paddedLines.push(blankLine(paddedLines.length + 1));
    }

    setVoucherDate(String(voucher.voucher_date ?? '').slice(0, 10));
    setReferenceNumber(voucher.reference || '');
    setDescription(voucher.narration || '');
    setPrimaryAccountId(primaryLine?.account_id || '');
    setLines(paddedLines);
    setNextLineId(paddedLines.length + 1);
    setMessage(null);
  }, [config.direction, config.title, config.voucherType, detailQuery.data, editingVoucherId]);

  function updateLine(id: number, patch: Partial<CashBankLine>) {
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
    setVoucherDate(defaultVoucherDate);
    setReferenceNumber('');
    setDescription('');
    setPrimaryAccountId('');
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
      if (isVoucherDateValid) {
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
        text: friendlyErrorMessage(error, `Could not print ${config.title}. Please try again.`),
      });
    }
  }

  function validateForm() {
    return validateCashBankVoucher({
      config,
      voucherDate,
      isVoucherDateValid,
      dateValidation,
      accountsLoading,
      accountsError,
      accountOptions: lineAccountOptions,
      primaryAccountId,
      selectedPrimaryAccount,
      description,
      enteredLines,
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
    if (!selectedPrimaryAccount) {
      setMessage({ kind: 'error', text: `${config.primaryAccountKind} Account was not found. Select it again.` });
      return;
    }

    const payloadResult = buildCashBankVoucherLines({
      config,
      primaryAccountId,
      selectedPrimaryAccount,
      accountOptions: lineAccountOptions,
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
        voucher_type: config.voucherType,
        voucher_date: voucherDate,
        reference: referenceNumber || undefined,
        narration: description.trim(),
        submit_for_approval: submitForApproval,
        lines: payloadResult.lines,
      },
      submitForApproval,
      resetForm,
      saveErrorFallback: `Could not save ${config.title}. Please try again.`,
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
        title={config.title}
        help={config.direction === 'payment' ? (
          <>
            <p>Use this screen to record money paid out of a {config.primaryAccountKind} Account.</p>
            <ul>
              <li>Choose the {config.primaryAccountKind} Account, then add one line for each account you paid.</li>
              <li>Save Draft keeps the voucher so you can change it later.</li>
              <li>Save For Approval sends it to an approver. It is posted after approval.</li>
            </ul>
            <p>Posted vouchers cannot be changed. Use Reverse to correct them.</p>
          </>
        ) : (
          <>
            <p>Use this screen to record money received into a {config.primaryAccountKind} Account.</p>
            <ul>
              <li>Choose the {config.primaryAccountKind} Account, then add one line for each account that paid you.</li>
              <li>Save Draft keeps the voucher so you can change it later.</li>
              <li>Save For Approval sends it to an approver. It is posted after approval.</li>
            </ul>
            <p>Posted vouchers cannot be changed. Use Reverse to correct them.</p>
          </>
        )}
        badges={<DocumentStatusBadges code={config.voucherType} mode={editingVoucherId ? 'Edit' : 'Add'} />}
        actions={(
          <DocumentActions
            saving={saving}
            actionDisabled={actionDisabled}
            newDisabled={postingDateGuard.disabled}
            newDisabledReason={dateStatusMessage || `${config.dateLabel} is being checked.`}
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
        <TextField label={config.documentLabel} value={detailQuery.data?.voucher_number ?? 'Auto'} disabled />
        <DateField label={config.dateLabel} required value={voucherDate} onChange={setVoucherDate} />
        <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Reference, Note, or Document No." />
        <div className="span-2">
          <FieldLabel label={config.primaryAccountLabel} required>
            <SearchableSelect
              value={primaryAccountId}
              options={primaryAccountOptions}
              onChange={setPrimaryAccountId}
              placeholder={primaryAccountsLoading ? 'Loading Accounts' : primaryAccountsError ? 'Accounts Not Loaded' : config.primaryAccountPlaceholder}
              disabled={primaryAccountsLoading || Boolean(primaryAccountsError)}
            />
          </FieldLabel>
        </div>
        <NumericField label="Current Balance" value={money(currentBalance)} disabled />
        <div className="span-3">
          <TextField label="Voucher Details" required value={description} onChange={setDescription} placeholder={config.detailsPlaceholder} />
        </div>
        <TextField label="Attachments" value="0 Files" disabled hint="Attachments and approval history will be added here later." />
      </DocumentFormPanel>

      <LinesPanel
        title={config.linesTitle}
        hint={<LineShortcutHint mode="grid" />}
        actions={<AddLineButton onClick={addLine} />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        summary={(
          <DocumentSummary countLabel="Active Lines" count={enteredLines.length}>
            <SummaryAmount label={config.totalLabel} value={money(totalAmount)} strong={totalAmount > 0} />
            <SummaryAmount label={`${config.primaryAccountKind} Line`} value={money(totalAmount)} />
            <SummaryAmount label="Difference" value={money(difference)} danger={difference > 0} />
          </DocumentSummary>
        )}
      >
        <CashBankVoucherLineTable
          config={config}
          lines={lines}
          accountOptions={lineAccountOptions}
          accountsLoading={accountsLoading}
          accountsError={Boolean(accountsError)}
          generalSettings={generalSettings}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
        />
      </LinesPanel>

      <ConfirmDialog
        open={processConfirmOpen}
        title={`Save ${config.title} For Approval?`}
        message={`This saves the ${config.title} (${money(totalAmount)}) and sends it for approval. It is posted after approval.`}
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
