'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  IconCalendarDollar,
  IconFileInvoice,
} from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, useUpdateVoucher, useVoucherDetail } from '@/lib/api/vouchers';
import { FieldLabel, SearchableSelect, SummaryRow, type VoucherSelectOption } from './VoucherControls';
import { JournalVoucherLineTable, type JournalVoucherLine } from './JournalVoucherLineTable';
import { VoucherActionButtons, VoucherLineSection, VoucherMessageBanner, VoucherPageHeader, VoucherSummaryFooter } from './VoucherLayout';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { buildJournalVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateJournalVoucher } from './VoucherValidation';
import {
  amountValue,
  compactInputStyle,
  compactNumericInputStyle,
  friendlyErrorMessage,
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingVoucherId = searchParams.get('id');
  const { data: generalSettings } = useGeneralSettings();
  const { defaultVoucherDate } = useDefaultVoucherDate();
  const [voucherDate, setVoucherDate] = useState(defaultVoucherDate);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const postingDateGuard = usePostingDateGuard(voucherDate, 'Voucher Date');
  const dateValidation = postingDateGuard.dateValidation;
  const isVoucherDateValid = postingDateGuard.dateIsValid;

  const accountsQuery = useAccountsList({
    page: 1,
    limit: 200,
    is_active: true,
    is_posting: true,
  });
  const createVoucher = useCreateVoucher();
  const updateVoucher = useUpdateVoucher();
  const detailQuery = useVoucherDetail(editingVoucherId ?? undefined);

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
  const saving = createVoucher.isPending || updateVoucher.isPending;
  const actionDisabled = saving || accountsQuery.isLoading || postingDateGuard.disabled || detailQuery.isLoading;
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Voucher Date...' : postingDateGuard.statusMessage;

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

  useEffect(() => {
    setVoucherDate(currentDate => (currentDate === today() ? defaultVoucherDate : currentDate));
  }, [defaultVoucherDate]);

  useEffect(() => {
    const voucher = detailQuery.data;
    if (!voucher || !editingVoucherId) return;
    if (voucher.voucher_type !== 'JV') {
      setMessage({ kind: 'error', text: 'This is not a Journal Voucher. Please open it from the correct voucher screen.' });
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
    const journalLines = sortedLines.map((line: any, index: number): JournalLine => ({
      id: index + 1,
      accountId: line.account_id,
      description: line.narration || '',
      debit: String(line.dr_amount ?? ''),
      credit: String(line.cr_amount ?? ''),
    }));
    const paddedLines = [...journalLines];
    while (paddedLines.length < INITIAL_LINE_COUNT) {
      paddedLines.push(blankLine(paddedLines.length + 1));
    }

    setVoucherDate(String(voucher.voucher_date ?? '').slice(0, 10));
    setReferenceNumber(voucher.reference || '');
    setDescription(voucher.narration || '');
    setLines(paddedLines);
    setNextLineId(paddedLines.length + 1);
    setMessage(null);
  }, [detailQuery.data, editingVoucherId]);

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
    setVoucherDate(defaultVoucherDate);
    setReferenceNumber('');
    setDescription('');
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

  async function saveVoucher(submitForApproval: boolean) {
    setReviewOpen(false);
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
      updateVoucher,
      invalidateVoucherList: async () => undefined,
      editingVoucherId,
      createInput: {
        voucher_type: 'JV',
        voucher_date: voucherDate,
        reference: referenceNumber || undefined,
        narration: description.trim() || 'Journal Voucher',
        submit_for_approval: submitForApproval,
        lines: payloadResult.lines,
      },
      submitForApproval,
      resetForm,
      saveErrorFallback: 'Unable to save Journal Voucher.',
    });
    setMessage(result);
  }

  function reviewVoucher() {
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
    setReviewOpen(true);
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
        mode={editingVoucherId ? 'Edit' : 'Add'}
        actions={
          <VoucherActionButtons
            saving={saving}
            actionDisabled={actionDisabled}
            newDisabled={postingDateGuard.disabled}
            newDisabledReason={dateStatusMessage || 'Voucher Date is being checked.'}
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
        <div style={{ display: 'grid', gridTemplateColumns: '120px 145px minmax(190px, 1fr)', gap: 8, alignItems: 'end' }}>
          <FieldLabel label="Voucher Number"><input className="form-input" value={detailQuery.data?.voucher_number ?? 'Auto'} disabled style={compactInputStyle} /></FieldLabel>
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
          <FieldLabel label="Voucher Details">
            <input
              className="form-input"
              value={description}
              onChange={event => setDescription(event.currentTarget.value)}
              placeholder="Optional Description For This Journal Voucher"
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

      {reviewOpen && (
        <JournalVoucherReviewDialog
          voucherDate={voucherDate}
          referenceNumber={referenceNumber}
          description={description}
          lines={enteredLines}
          accountOptions={accountOptions}
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          generalSettings={generalSettings}
          saving={saving}
          onClose={() => setReviewOpen(false)}
          onPost={() => saveVoucher(true)}
        />
      )}
    </main>
  );
}

function JournalVoucherReviewDialog({
  voucherDate,
  referenceNumber,
  description,
  lines,
  accountOptions,
  totalDebit,
  totalCredit,
  generalSettings,
  saving,
  onClose,
  onPost,
}: {
  voucherDate: string;
  referenceNumber: string;
  description: string;
  lines: JournalLine[];
  accountOptions: AccountOption[];
  totalDebit: number;
  totalCredit: number;
  generalSettings: Parameters<typeof formatMoney>[1];
  saving: boolean;
  onClose: () => void;
  onPost: () => void;
}) {
  const accountName = (accountId: string) => accountOptions.find(account => account.value === accountId)?.label ?? 'Account not found';
  return (
    <div style={reviewOverlayStyle} role="dialog" aria-modal="true" aria-label="Review Journal Voucher">
      <button type="button" aria-label="Close Review" style={reviewBackdropStyle} onClick={onClose} />
      <section style={reviewDialogStyle}>
        <div style={reviewHeaderStyle}>
          <div>
            <h2 style={reviewTitleStyle}>Review Journal Voucher</h2>
            <p style={reviewSubtitleStyle}>Confirm the accounting entry before posting.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving} style={compactInputStyle}>Close</button>
        </div>

        <div style={reviewMetaGridStyle}>
          <ReviewMeta label="Voucher Date" value={voucherDate} />
          <ReviewMeta label="Reference Number" value={referenceNumber || '-'} />
          <ReviewMeta label="Voucher Details" value={description} wide />
        </div>

        <div style={reviewTableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['No.', 'Account', 'Description', 'Debit', 'Credit'].map(header => (
                  <th key={header} style={header === 'Debit' || header === 'Credit' ? { ...reviewHeadStyle, textAlign: 'right' } : reviewHeadStyle}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td style={reviewCellStyle}>{index + 1}</td>
                  <td style={reviewCellStyle}>{accountName(line.accountId)}</td>
                  <td style={reviewCellStyle}>{line.description || description}</td>
                  <td style={{ ...reviewCellStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 850 }}>{amountValue(line.debit) ? formatMoney(amountValue(line.debit), generalSettings) : '-'}</td>
                  <td style={{ ...reviewCellStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 850 }}>{amountValue(line.credit) ? formatMoney(amountValue(line.credit), generalSettings) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={reviewTotalCellStyle}>Totals</td>
                <td style={reviewTotalAmountStyle}>{formatMoney(totalDebit, generalSettings)}</td>
                <td style={reviewTotalAmountStyle}>{formatMoney(totalCredit, generalSettings)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={reviewFooterStyle}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving} style={compactInputStyle}>Back To Edit</button>
          <button type="button" className="btn-primary" onClick={onPost} disabled={saving} style={compactInputStyle}>
            {saving ? 'Saving...' : 'Save For Approval'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReviewMeta({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { ...reviewMetaItemStyle, gridColumn: '1 / -1' } : reviewMetaItemStyle}>
      <span style={reviewMetaLabelStyle}>{label}</span>
      <strong style={reviewMetaValueStyle}>{value}</strong>
    </div>
  );
}

const reviewOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
};
const reviewBackdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: 'none',
  background: 'rgba(15, 23, 42, 0.30)',
};
const reviewDialogStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(980px, 94vw)',
  maxHeight: '88vh',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  overflow: 'hidden',
};
const reviewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  padding: '12px 14px',
  borderBottom: '1px solid var(--color-border)',
};
const reviewTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-heading)',
  fontSize: '0.98rem',
  fontWeight: 900,
};
const reviewSubtitleStyle: React.CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.72rem',
  fontWeight: 750,
};
const reviewMetaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px minmax(180px, 1fr)',
  gap: 8,
  padding: 12,
  borderBottom: '1px solid var(--color-border-subtle)',
};
const reviewMetaItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 3,
};
const reviewMetaLabelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.66rem',
  fontWeight: 850,
};
const reviewMetaValueStyle: React.CSSProperties = {
  color: 'var(--color-heading)',
  fontSize: '0.78rem',
  fontWeight: 850,
};
const reviewTableWrapStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: 12,
};
const reviewHeadStyle: React.CSSProperties = {
  background: 'var(--color-table-head-bg)',
  color: 'var(--color-table-head-text)',
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 900,
};
const reviewCellStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  padding: '7px 8px',
  fontSize: '0.72rem',
  color: 'var(--color-text)',
};
const reviewTotalCellStyle: React.CSSProperties = {
  ...reviewCellStyle,
  textAlign: 'right',
  color: 'var(--color-heading)',
  fontWeight: 900,
  background: 'var(--color-surface-alt)',
};
const reviewTotalAmountStyle: React.CSSProperties = {
  ...reviewTotalCellStyle,
  fontFamily: 'var(--font-mono)',
};
const reviewFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: 12,
  borderTop: '1px solid var(--color-border)',
};
