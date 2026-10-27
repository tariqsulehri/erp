'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { useAccountsList } from '@/lib/api/accounts';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCreateVoucher, useUpdateVoucher, useVoucherDetail } from '@/lib/api/vouchers';
import { DateField, TextField } from '@/components/ui/FormFields';
import type { SelectOption as VoucherSelectOption } from '@/components/ui/SearchableSelect';
import {
  AddLineButton,
  DetailFields,
  DocumentActions,
  DocumentFormPanel,
  DocumentHeader,
  DocumentMessage,
  DocumentPage,
  DocumentReviewDialog,
  DocumentStatusBadges,
  DocumentSummary,
  LineShortcutHint,
  LinesPanel,
  LinesTable,
  SummaryAmount,
  useLineEntryKeyboard,
} from '@/components/documents';
import styles from '@/components/documents/documents.module.css';
import { JournalVoucherLineTable, type JournalVoucherLine } from './JournalVoucherLineTable';
import { useDefaultVoucherDate } from './VoucherFiscalDate';
import { buildJournalVoucherLines } from './VoucherPayload';
import { saveVoucherDocument } from './VoucherSaveFlow';
import { validateJournalVoucher } from './VoucherValidation';
import {
  amountValue,
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

const INITIAL_LINE_COUNT = 2;
const blankLine = (id: number): JournalLine => ({ id, accountId: '', description: '', debit: '', credit: '' });
const initialLines = () => [blankLine(1), blankLine(2)];

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
        text: friendlyErrorMessage(accountsQuery.error, 'Could not load accounts. Refresh the page and try again.'),
      });
    }
  }, [accountsQuery.error]);

  useEffect(() => {
    if (dateValidation.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(dateValidation.error, 'Could not check Voucher Date. Refresh the page and try again.'),
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
      setMessage({ kind: 'error', text: 'This is not a Journal Voucher. Open it from the right voucher screen.' });
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
    const journalLines = sortedLines.map((line: any, index: number): JournalLine => ({
      id: index + 1,
      accountId: line.account_id,
      description: line.narration || '',
      debit: String(line.dr_amount ?? ''),
      credit: String(line.cr_amount ?? ''),
    }));
    const loadedLines = journalLines.length >= 2 ? journalLines : [blankLine(1), blankLine(2)];

    setVoucherDate(String(voucher.voucher_date ?? '').slice(0, 10));
    setReferenceNumber(voucher.reference || '');
    setDescription(voucher.narration || '');
    setLines(loadedLines);
    setNextLineId(loadedLines.length + 1);
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
    setNextLineId(3);
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
        text: friendlyErrorMessage(error, 'Could not print Journal Voucher. Please try again.'),
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
      saveErrorFallback: 'Could not save Journal Voucher. Please try again.',
    });
    setMessage(result);
  }

  const lineKeyboard = useLineEntryKeyboard({
    onSave: () => saveVoucher(false),
    saveDisabled: actionDisabled,
    onAddLine: addLine,
  });

  /** Save For Approval: validate, then show the review dialog before saving. */
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
    <DocumentPage>
      <DocumentHeader
        title="Journal Voucher"
        help={(
          <>
            <p>Use this screen to record an entry between accounts when no cash or bank is involved.</p>
            <ul>
              <li>Each line has a Debit or a Credit amount, not both.</li>
              <li>Total Debit must equal Total Credit before you can save.</li>
              <li>Save Draft keeps the voucher. Save For Approval sends it to an approver.</li>
            </ul>
            <p>Posted vouchers cannot be changed. Use Reverse to correct them.</p>
          </>
        )}
        badges={<DocumentStatusBadges code="JV" mode={editingVoucherId ? 'Edit' : 'Add'} />}
        actions={(
          <DocumentActions
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
            onProcess={reviewVoucher}
          />
        )}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <DocumentFormPanel columns={6} statusMessage={dateStatusMessage}>
        <TextField label="Voucher Number" value={detailQuery.data?.voucher_number ?? 'Auto'} disabled />
        <DateField label="Voucher Date" required value={voucherDate} onChange={setVoucherDate} />
        <div className="span-4">
          <TextField label="Reference Number" value={referenceNumber} onChange={setReferenceNumber} placeholder="Reference, Note, or Document No." />
        </div>
        <div className="span-all">
          <TextField label="Voucher Details" value={description} onChange={setDescription} placeholder="Optional Description For This Journal Voucher" />
        </div>
      </DocumentFormPanel>

      <LinesPanel
        title="Journal Lines"
        hint={<LineShortcutHint mode="grid" />}
        actions={<AddLineButton onClick={addLine} />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        summary={(
          <DocumentSummary countLabel="Active Lines" count={activeLines.length}>
            <SummaryAmount label="Debit Total" value={money(totalDebit)} strong={isBalanced} />
            <SummaryAmount label="Credit Total" value={money(totalCredit)} strong={isBalanced} />
            {!isBalanced && outOfBalance > 0 && (
              <SummaryAmount label="Difference" value={money(outOfBalance)} danger />
            )}
          </DocumentSummary>
        )}
      >
        <JournalVoucherLineTable
          lines={lines}
          accountOptions={accountOptions}
          accountsLoading={accountsQuery.isLoading}
          accountsError={accountsQuery.isError}
          generalSettings={generalSettings}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onAddLine={addLine}
        />
      </LinesPanel>

      <JournalVoucherReviewDialog
        open={reviewOpen}
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
    </DocumentPage>
  );
}

function JournalVoucherReviewDialog({
  open,
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
  open: boolean;
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
  const accountName = (accountId: string) => accountOptions.find(account => account.value === accountId)?.label ?? 'Account Not Found';
  const amount = (value: string) => (amountValue(value) ? formatMoney(amountValue(value), generalSettings) : '');
  return (
    <DocumentReviewDialog
      open={open}
      title="Review Journal Voucher"
      description="Check the accounting entry, then save it for approval."
      confirmLabel="Save For Approval"
      saving={saving}
      onConfirm={onPost}
      onClose={onClose}
    >
      <DetailFields
        items={[
          ['Voucher Date', formatDate(voucherDate, generalSettings)],
          ['Reference Number', referenceNumber],
          ['Voucher Details', description],
        ]}
      />
      <div className={styles.reviewTable}>
        <LinesTable>
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: '34%' }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="num">No.</th>
              <th>Account</th>
              <th>Description</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td className="num cell-muted">{index + 1}</td>
                <td title={accountName(line.accountId)}>{accountName(line.accountId)}</td>
                <td>{line.description || description}</td>
                <td className="num">{amount(line.debit)}</td>
                <td className="num">{amount(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="num">Totals</td>
              <td className="num">{formatMoney(totalDebit, generalSettings)}</td>
              <td className="num">{formatMoney(totalCredit, generalSettings)}</td>
            </tr>
          </tfoot>
        </LinesTable>
      </div>
    </DocumentReviewDialog>
  );
}
