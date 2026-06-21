'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  IconCalendarDollar,
  IconFileInvoice,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { useValidatePostingDate } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, usePostVoucher } from '@/lib/api/vouchers';
import { FieldLabel, SearchableSelect, SummaryRow, type VoucherSelectOption } from './VoucherControls';
import { JournalVoucherLineTable, type JournalVoucherLine } from './JournalVoucherLineTable';
import { VoucherActionButtons, VoucherLineSection, VoucherMessageBanner, VoucherPageHeader, VoucherSummaryFooter } from './VoucherLayout';
import { buildJournalVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateJournalVoucher } from './VoucherValidation';
import {
  amountValue,
  compactInputStyle,
  compactNumericInputStyle,
  friendlyErrorMessage,
  isValidDateInput,
  today,
  type VoucherMessageKind,
} from './VoucherShared';

type MessageKind = VoucherMessageKind;

type JournalLine = JournalVoucherLine;

type SelectOption = VoucherSelectOption;

interface AccountOption extends SelectOption {
  code: string;
  name: string;
  openingBalance?: string | number | null;
}

const INITIAL_LINE_COUNT = 12;
const blankLine = (id: number): JournalLine => ({ id, accountId: '', description: '', debit: '', credit: '' });
const initialLines = () => Array.from({ length: INITIAL_LINE_COUNT }, (_, index) => blankLine(index + 1));

export default function JournalVoucherPage() {
  const { data: generalSettings } = useGeneralSettings();
  const [voucherDate, setVoucherDate] = useState(today());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'Not Required' | 'Pending'>('Not Required');
  const [autoReverseDate, setAutoReverseDate] = useState('');
  const [lines, setLines] = useState<JournalLine[]>(initialLines);
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
  const enteredLines = lines.filter(line =>
    line.accountId ||
    line.description.trim() ||
    amountValue(line.debit) > 0 ||
    amountValue(line.credit) > 0
  );
  const activeLines = enteredLines;
  const totalDebit = lines.reduce((sum, line) => sum + amountValue(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + amountValue(line.credit), 0);
  const outOfBalance = Math.abs(totalDebit - totalCredit);
  const isBalanced = outOfBalance < 0.001 && totalDebit > 0;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const saving = createVoucher.isPending || postVoucher.isPending;
  const actionDisabled = saving || accountsQuery.isLoading || dateValidation.isFetching;
  const dateStatusMessage = !voucherDate
    ? ''
    : !isVoucherDateValid
      ? 'Voucher Date is not a valid date.'
      : dateValidation.error
        ? friendlyErrorMessage(dateValidation.error, 'Unable to check Voucher Date.')
        : dateValidation.data && !dateValidation.data.canPost
          ? dateValidation.data.reason ?? 'Voucher Date is outside the open fiscal period.'
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
        text: friendlyErrorMessage(dateValidation.error, 'Unable to check Voucher Date. Please refresh and try again.'),
      });
    }
  }, [dateValidation.error]);

  function updateLine(id: number, patch: Partial<JournalLine>) {
    setLines(current => current.map(line => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines(current => [...current, blankLine(nextLineId)]);
    setNextLineId(value => value + 1);
  }

  function removeLine(id: number) {
    setLines(current => (current.length > 2 ? current.filter(line => line.id !== id) : current));
  }

  function resetForm(clearMessage = true) {
    setVoucherDate(today());
    setReferenceNumber('');
    setDescription('');
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
        text: friendlyErrorMessage(error, 'Unable to print Journal Voucher.'),
      });
    }
  }

  function validateForm() {
    return validateJournalVoucher({
      voucherDate,
      isVoucherDateValid,
      dateValidation,
      autoReverseDate,
      accountsLoading: accountsQuery.isLoading,
      accountsError: accountsQuery.error,
      accountOptions,
      description,
      enteredLines,
      allLines: lines,
      totalDebit,
      totalCredit,
      isBalanced,
      outOfBalanceText: formatMoney(outOfBalance, generalSettings),
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

    const payloadResult = buildJournalVoucherLines({
      accountOptions,
      enteredLines,
      allLines: lines,
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
        voucher_type: 'JV',
        voucher_date: voucherDate,
        reference: referenceNumber || undefined,
        narration: description.trim(),
        approval_status: approvalStatus,
        auto_reverse_date: autoReverseDate || undefined,
        lines: payloadResult.lines,
      },
      postAfterSave,
      resetForm,
      saveErrorFallback: 'Unable to save Journal Voucher.',
    });
    setMessage(result);
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <VoucherPageHeader
        title="Journal Voucher"
        badgeText="JV"
        badgeColor="#1d4ed8"
        badgeBackground="#dbeafe"
        accent="linear-gradient(135deg, #1d4ed8, #0891b2)"
        icon={<IconFileInvoice size={20} stroke={1.8} />}
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
        <div style={{ display: 'grid', gridTemplateColumns: '120px 145px minmax(190px, 1fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Voucher Number"><input className="form-input" value="Auto" disabled style={compactInputStyle} /></FieldLabel>
          <FieldLabel label="Voucher Date" required>
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
              placeholder="Short Description For This Journal Voucher"
              style={compactInputStyle}
            />
          </FieldLabel>
        </div>

        <VoucherLineSection title="Journal Lines" onAddLine={addLine}>
          <JournalVoucherLineTable
            lines={lines}
            accountOptions={accountOptions}
            accountsLoading={accountsQuery.isLoading}
            accountsError={accountsQuery.isError}
            generalSettings={generalSettings}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
          />
        </VoucherLineSection>

        <VoucherSummaryFooter activeLines={activeLines.length}>
          <SummaryRow label="Debit Total" value={totalDebit} strong={isBalanced} formatMoneyValue={money} />
          <SummaryRow label="Credit Total" value={totalCredit} strong={isBalanced} formatMoneyValue={money} />
          <SummaryRow label="Out Of Balance" value={outOfBalance} danger={!isBalanced && outOfBalance > 0} formatMoneyValue={money} />
        </VoucherSummaryFooter>
      </section>
    </main>
  );
}
