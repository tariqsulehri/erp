'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCash,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { useValidatePostingDate } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, usePostVoucher } from '@/lib/api/vouchers';
import { FieldLabel, SearchableSelect, SummaryRow, type VoucherSelectOption } from './VoucherControls';
import { CashBankVoucherLineTable, type CashBankVoucherLine } from './CashBankVoucherLineTable';
import { VoucherActionButtons, VoucherLineSection, VoucherMessageBanner, VoucherPageHeader, VoucherSummaryFooter } from './VoucherLayout';
import { buildCashBankVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateCashBankVoucher } from './VoucherValidation';
import {
  amountValue,
  compactInputStyle,
  compactNumericInputStyle,
  friendlyErrorMessage,
  isValidDateInput,
  today,
  type VoucherMessageKind,
} from './VoucherShared';

type VoucherKind = 'BPV' | 'CPV' | 'CRV';
type MessageKind = VoucherMessageKind;

type CashBankLine = CashBankVoucherLine;

type SelectOption = VoucherSelectOption;

interface AccountOption extends SelectOption {
  code: string;
  name: string;
  openingBalance?: string | number | null;
}

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
  balanceAfterLabel: string;
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
    balanceAfterLabel: 'Balance After Payment',
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
    balanceAfterLabel: 'Balance After Payment',
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
    balanceAfterLabel: 'Balance After Receipt',
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
  const { data: generalSettings } = useGeneralSettings();
  const [voucherDate, setVoucherDate] = useState(today());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [primaryAccountId, setPrimaryAccountId] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'Not Required' | 'Pending'>('Not Required');
  const [autoReverseDate, setAutoReverseDate] = useState('');
  const [lines, setLines] = useState<CashBankLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const isVoucherDateValid = isValidDateInput(voucherDate);

  const accountsQuery = useAccountsList({
    page: 1,
    limit: 500,
    is_active: true,
    is_posting: true,
  });
  const dateValidation = useValidatePostingDate(voucherDate, isVoucherDateValid);
  const createVoucher = useCreateVoucher();
  const postVoucher = usePostVoucher();

  const accountOptions = useMemo<AccountOption[]>(() => {
    return (accountsQuery.data?.data ?? []).map((account: any) => ({
      value: account.id,
      label: `${account.code} - ${account.name}`,
      searchText: `${account.code} ${account.name}`,
      code: account.code,
      name: account.name,
      openingBalance: account.opening_balance,
    }));
  }, [accountsQuery.data]);
  const selectedPrimaryAccount = accountOptions.find(option => option.value === primaryAccountId);
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
  const currentBalance = Number(selectedPrimaryAccount?.openingBalance ?? 0);
  const balanceAfterTransaction = config.direction === 'receipt'
    ? currentBalance + totalAmount
    : currentBalance - totalAmount;
  const difference = 0;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const saving = createVoucher.isPending || postVoucher.isPending;
  const actionDisabled = saving || accountsQuery.isLoading || dateValidation.isFetching;
  const dateStatusMessage = !voucherDate
    ? ''
    : !isVoucherDateValid
      ? `${config.dateLabel} is not a valid date.`
      : dateValidation.error
        ? friendlyErrorMessage(dateValidation.error, `Unable to check ${config.dateLabel}.`)
        : dateValidation.data && !dateValidation.data.canPost
          ? dateValidation.data.reason ?? `${config.dateLabel} is outside the open fiscal period.`
          : '';

  useEffect(() => {
    if (accountsQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(accountsQuery.error, 'Unable to load accounts. Please refresh and try again.'),
      });
    }
  }, [accountsQuery.error]);

  useEffect(() => {
    if (dateValidation.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(dateValidation.error, `Unable to check ${config.dateLabel}. Please refresh and try again.`),
      });
    }
  }, [config.dateLabel, dateValidation.error]);

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
    setVoucherDate(today());
    setReferenceNumber('');
    setDescription('');
    setPrimaryAccountId('');
    setApprovalStatus('Not Required');
    setAutoReverseDate('');
    setLines(initialLines());
    setNextLineId(INITIAL_LINE_COUNT + 1);
    if (clearMessage) setMessage(null);
  }

  async function refreshVoucherData() {
    setMessage(null);
    try {
      const accountsResult = await accountsQuery.refetch();
      if (accountsResult.error) throw accountsResult.error;
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
      autoReverseDate,
      accountsLoading: accountsQuery.isLoading,
      accountsError: accountsQuery.error,
      accountOptions,
      primaryAccountId,
      selectedPrimaryAccount,
      description,
      enteredLines,
      allLines: lines,
      totalAmount,
    });
  }

  async function saveVoucher(postAfterSave: boolean) {
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
      accountOptions,
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
      postVoucher,
      invalidateVoucherList: async () => undefined,
      createInput: {
        voucher_type: config.voucherType,
        voucher_date: voucherDate,
        reference: referenceNumber || undefined,
        narration: description.trim(),
        approval_status: approvalStatus,
        auto_reverse_date: autoReverseDate || undefined,
        lines: payloadResult.lines,
      },
      postAfterSave,
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
        actions={
          <VoucherActionButtons
            saving={saving}
            actionDisabled={actionDisabled}
            onNew={() => resetForm()}
            onRefresh={refreshVoucherData}
            onPrint={printVoucher}
            onCancel={() => resetForm()}
            onSaveDraft={() => saveVoucher(false)}
            onProcess={() => saveVoucher(true)}
          />
        }
      />

      <VoucherMessageBanner message={message} />

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 145px minmax(160px, 1fr) minmax(270px, 1.45fr) 145px 155px', gap: 8, alignItems: 'end' }}>
          <FieldLabel label={config.documentLabel}><input className="form-input" value="Auto" disabled style={compactInputStyle} /></FieldLabel>
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
              options={accountOptions}
              onChange={setPrimaryAccountId}
              placeholder={accountsQuery.isLoading ? 'Loading Accounts' : accountsQuery.error ? 'Accounts Not Loaded' : config.primaryAccountPlaceholder}
              disabled={accountsQuery.isLoading || accountsQuery.isError}
            />
          </FieldLabel>
          <FieldLabel label="Current Balance"><input className="form-input" value={money(currentBalance)} disabled style={compactNumericInputStyle} /></FieldLabel>
          <FieldLabel label={config.balanceAfterLabel}><input className="form-input" value={money(balanceAfterTransaction)} disabled style={compactNumericInputStyle} /></FieldLabel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '145px 145px 130px minmax(160px, 1fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Approval Status">
            <select
              className="form-input"
              value={approvalStatus}
              onChange={event => setApprovalStatus(event.currentTarget.value as 'Not Required' | 'Pending')}
              style={compactInputStyle}
            >
              <option value="Not Required">Not Required</option>
              <option value="Pending">Pending</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Auto Reverse Date">
            <input
              className="form-input"
              type="date"
              value={autoReverseDate}
              onChange={event => setAutoReverseDate(event.currentTarget.value)}
              style={compactInputStyle}
            />
          </FieldLabel>
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
            accountOptions={accountOptions}
            accountsLoading={accountsQuery.isLoading}
            accountsError={accountsQuery.isError}
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
