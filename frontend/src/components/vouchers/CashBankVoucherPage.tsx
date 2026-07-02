'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCash,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { useBankAccountsList } from '@/lib/api/bank-accounts';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, useUpdateVoucher, useVoucherDetail } from '@/lib/api/vouchers';
import { FieldLabel, SearchableSelect, SummaryRow, type VoucherSelectOption } from './VoucherControls';
import { CashBankVoucherLineTable, type CashBankVoucherLine } from './CashBankVoucherLineTable';
import { VoucherActionButtons, VoucherLineSection, VoucherMessageBanner, VoucherPageHeader, VoucherSummaryFooter } from './VoucherLayout';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { getBankAccountOptions, getCashAccountOptions, getVoucherLineAccountOptions, type VoucherAccountOption } from './VoucherAccountRules';
import { buildCashBankVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateCashBankVoucher } from './VoucherValidation';
import {
  amountValue,
  compactInputStyle,
  compactNumericInputStyle,
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
  badgeColor: string;
  badgeBackground: string;
  accent: string;
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
    badgeColor: '#1d4ed8',
    badgeBackground: '#dbeafe',
    accent: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
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
    badgeColor: '#166534',
    badgeBackground: '#dcfce7',
    accent: 'linear-gradient(135deg, #15803d, #0f766e)',
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
    badgeColor: '#047857',
    badgeBackground: '#d1fae5',
    accent: 'linear-gradient(135deg, #047857, #0ea5e9)',
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

  const allAccounts = accountsQuery.data?.data ?? [];
  const activeBankAccounts = bankAccountsQuery.data?.data ?? [];
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
  const dateStatusMessage = postingDateGuard.isChecking ? `Checking ${config.dateLabel}...` : postingDateGuard.statusMessage;

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
        text: friendlyErrorMessage(dateValidation.error, `Unable to check ${config.dateLabel}. Please refresh and try again.`),
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
      setMessage({ kind: 'error', text: `This is not a ${config.title}. Please open it from the correct voucher screen.` });
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
        text: friendlyErrorMessage(error, `Unable to print ${config.title}.`),
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
      setMessage({ kind: 'error', text: `${config.primaryAccountKind} Account was not found.` });
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
      saveErrorFallback: `Unable to save ${config.title}.`,
    });
    setMessage(result);
  }

  const HeaderIcon = config.icon === 'bank' ? IconBuildingBank : IconCash;

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <VoucherPageHeader
        title={config.title}
        badgeText={config.voucherType}
        badgeColor={config.badgeColor}
        badgeBackground={config.badgeBackground}
        accent={config.accent}
        icon={<HeaderIcon size={20} stroke={1.8} />}
        mode={editingVoucherId ? 'Edit' : 'Add'}
        actions={
          <VoucherActionButtons
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
            onProcess={() => saveVoucher(true)}
          />
        }
      />

      <VoucherMessageBanner message={message} />

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 145px minmax(160px, 1fr) minmax(270px, 1.45fr) 145px', gap: 8, alignItems: 'end' }}>
          <FieldLabel label={config.documentLabel}><input className="form-input" value={detailQuery.data?.voucher_number ?? 'Auto'} disabled style={compactInputStyle} /></FieldLabel>
          <FieldLabel label={config.dateLabel} required>
            <div style={{ position: 'relative' }}>
              <IconCalendarDollar size={15} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--color-text-muted)' }} />
              <input
                className="form-input"
                type="date"
                value={voucherDate}
                onChange={event => setVoucherDate(event.currentTarget.value)}
                style={{ ...compactInputStyle, paddingLeft: 28 }}
              />
            </div>
          </FieldLabel>
          <FieldLabel label="Reference Number">
            <input
              className="form-input"
              value={referenceNumber}
              onChange={event => setReferenceNumber(event.currentTarget.value)}
              placeholder="Reference, Note, or Document No."
              style={compactInputStyle}
            />
          </FieldLabel>
          <FieldLabel label={config.primaryAccountLabel} required>
            <SearchableSelect
              value={primaryAccountId}
              options={primaryAccountOptions}
              onChange={setPrimaryAccountId}
              placeholder={primaryAccountsLoading ? 'Loading Accounts' : primaryAccountsError ? 'Accounts Not Loaded' : config.primaryAccountPlaceholder}
              disabled={primaryAccountsLoading || Boolean(primaryAccountsError)}
            />
          </FieldLabel>
          <FieldLabel label="Current Balance"><input className="form-input" value={money(currentBalance)} disabled style={compactNumericInputStyle} /></FieldLabel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '130px minmax(160px, 1fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Attachments">
            <input className="form-input" value="0 Files" disabled style={compactInputStyle} />
          </FieldLabel>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.68rem', lineHeight: 1.2, alignSelf: 'center' }}>
            Attachments and approval history will use the shared transaction workflow area.
          </div>
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
          <FieldLabel label="Voucher Details" required>
            <input
              className="form-input"
              value={description}
              onChange={event => setDescription(event.currentTarget.value)}
              placeholder={config.detailsPlaceholder}
              style={compactInputStyle}
            />
          </FieldLabel>
        </div>

        <VoucherLineSection title={config.linesTitle} onAddLine={addLine}>
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
        </VoucherLineSection>

        <VoucherSummaryFooter activeLines={enteredLines.length}>
          <SummaryRow label={config.totalLabel} value={totalAmount} strong={totalAmount > 0} width={126} formatMoneyValue={money} />
          <SummaryRow label={`${config.primaryAccountKind} Line`} value={totalAmount} width={126} formatMoneyValue={money} />
          <SummaryRow label="Difference" value={difference} danger={difference > 0} width={126} formatMoneyValue={money} />
        </VoucherSummaryFooter>
      </section>
    </main>
  );
}
