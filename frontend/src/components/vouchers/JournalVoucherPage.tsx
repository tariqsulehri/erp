'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  IconCalendarDollar,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconFileInvoice,
  IconFilePlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { trpc } from '@/lib/trpc/client';
import { formatMoney, formatNumber } from '@/lib/app-settings';

type MessageKind = 'success' | 'error';

interface JournalLine {
  id: number;
  accountId: string;
  description: string;
  projectId: string;
  costCenterId: string;
  debit: string;
  credit: string;
}

interface SelectOption {
  value: string;
  label: string;
  searchText?: string;
}

interface AccountOption extends SelectOption {
  code: string;
  name: string;
  openingBalance?: string | number | null;
}

interface VoucherLinePayload {
  account_id: string;
  account_code: string;
  account_name: string;
  dr_amount: number;
  cr_amount: number;
  narration?: string;
  line_no: number;
  project_id?: string;
  cost_center_id?: string;
}

const INITIAL_LINE_COUNT = 12;
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = (id: number): JournalLine => ({ id, accountId: '', description: '', projectId: '', costCenterId: '', debit: '', credit: '' });
const initialLines = () => Array.from({ length: INITIAL_LINE_COUNT }, (_, index) => blankLine(index + 1));
const cleanAmount = (value: string) => value.replace(/,/g, '');
const amountValue = (value: string) => Number(cleanAmount(value) || 0);
const validAmountPattern = /^\d+(\.\d{1,2})?$/;

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateInputToDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function friendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const message = error.message.trim();
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection failed. Please check the backend service and try again.';
  }
  if (message.includes('Company ID not set')) {
    return 'Company setup is incomplete. Please select or configure the company first.';
  }
  if (message.toLowerCase().includes('unauthorized')) {
    return 'Your session is not valid. Please sign in again.';
  }

  return message;
}

function sanitizeAmountInput(value: string) {
  const withoutCommas = cleanAmount(value).replace(/[^0-9.]/g, '');
  const [whole = '', ...decimalParts] = withoutCommas.split('.');
  const decimals = decimalParts.join('').slice(0, 2);
  return decimalParts.length > 0 ? `${whole}.${decimals}` : whole;
}

function formatAmountInput(value: string) {
  const numericValue = amountValue(value);
  return numericValue > 0 ? formatNumber(numericValue) : '';
}

function SearchableSelect({
  value,
  options,
  onChange,
  onFocus,
  placeholder,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const visibleValue = open ? query : selected?.label ?? '';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="form-input"
        value={visibleValue}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          onFocus?.();
          setOpen(true);
          setQuery('');
        }}
        onChange={event => {
          setQuery(event.currentTarget.value);
          setOpen(true);
        }}
        style={{ height: 28, minHeight: 28, padding: '3px 24px 3px 8px' }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: `translateY(-50%) ${open ? 'rotate(180deg)' : 'rotate(0deg)'}`,
          color: 'var(--color-text-muted)',
          pointerEvents: 'none',
          fontSize: 10,
        }}
      >
        ▼
      </span>
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            zIndex: 80,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 230,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border-focus)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)',
            padding: 4,
          }}
        >
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('');
              setOpen(false);
              setQuery('');
            }}
            style={dropdownButton(value === '')}
          >
            {placeholder}
          </button>
          {filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
              style={dropdownButton(option.value === value)}
            >
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              No Record Found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function dropdownButton(selected: boolean): CSSProperties {
  return {
    width: '100%',
    display: 'block',
    padding: '7px 9px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: selected ? 'var(--color-primary-light)' : 'transparent',
    color: selected ? 'var(--color-primary-text)' : 'var(--color-text)',
    textAlign: 'left',
    fontSize: '0.8rem',
    fontWeight: selected ? 700 : 500,
    cursor: 'pointer',
  };
}

function FieldLabel({ label, required = false, children }: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          marginBottom: 2,
          color: 'var(--color-text-secondary)',
          fontSize: '0.67rem',
          fontWeight: 800,
          lineHeight: 1.15,
        }}
      >
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value, strong = false, danger = false }: { label: string; value: number; strong?: boolean; danger?: boolean }) {
  return (
    <div style={{ width: 124, minWidth: 0 }}>
      <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.66rem', fontWeight: 800, lineHeight: 1.1 }}>
        {label}
      </span>
      <span
        style={{
          display: 'block',
          marginTop: 4,
          minHeight: 32,
          padding: '6px 8px',
          border: `1px solid ${danger ? 'var(--color-danger-border)' : strong ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius)',
          background: danger ? 'var(--color-danger-bg)' : strong ? 'var(--color-primary-light)' : 'var(--color-surface)',
          fontFamily: 'var(--font-mono)',
          fontSize: strong ? '0.82rem' : '0.78rem',
          fontWeight: strong ? 900 : 800,
          color: danger ? 'var(--color-danger-text)' : strong ? 'var(--color-heading)' : 'var(--color-amount)',
          textAlign: 'right',
          lineHeight: 1.2,
        }}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}

const journalLineColumns = [
  { label: 'No.', width: 32 },
  { label: 'Account', width: 310 },
  { label: 'Description', width: 300 },
  { label: 'Project', width: 135 },
  { label: 'Cost Center', width: 145 },
  { label: 'Debit', width: 112, right: true },
  { label: 'Credit', width: 112, right: true },
  { label: '', width: 30 },
] as const;

export default function JournalVoucherPage() {
  const utils = trpc.useUtils();
  const [voucherDate, setVoucherDate] = useState(today());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'Not Required' | 'Pending'>('Not Required');
  const [autoReverseDate, setAutoReverseDate] = useState('');
  const [lines, setLines] = useState<JournalLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const isVoucherDateValid = isValidDateInput(voucherDate);
  const voucherDateForQuery = isVoucherDateValid ? dateInputToDate(voucherDate) : dateInputToDate(today());

  const accountsQuery = trpc.accounts.list.useQuery({
    page: 1,
    limit: 500,
    is_active: true,
    is_posting: true,
  });
  const dateValidation = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: voucherDateForQuery },
    { enabled: isVoucherDateValid, retry: false },
  );
  const projectsQuery = trpc.transactionSupport.projects.useQuery({ search: '' });
  const costCentersQuery = trpc.transactionSupport.costCenters.useQuery({ search: '' });
  const createVoucher = trpc.vouchers.create.useMutation();
  const postVoucher = trpc.vouchers.post.useMutation();

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
  const projectOptions = useMemo<SelectOption[]>(() => {
    return (projectsQuery.data ?? []).map((project: any) => ({
      value: project.id,
      label: `${project.code} - ${project.name}`,
      searchText: `${project.code} ${project.name}`,
    }));
  }, [projectsQuery.data]);
  const costCenterOptions = useMemo<SelectOption[]>(() => {
    return (costCentersQuery.data ?? []).map((costCenter: any) => ({
      value: costCenter.id,
      label: `${costCenter.code} - ${costCenter.name}`,
      searchText: `${costCenter.code} ${costCenter.name}`,
    }));
  }, [costCentersQuery.data]);

  const enteredLines = lines.filter(line =>
    line.accountId ||
    line.description.trim() ||
    line.projectId ||
    line.costCenterId ||
    amountValue(line.debit) > 0 ||
    amountValue(line.credit) > 0
  );
  const activeLines = enteredLines;
  const totalDebit = lines.reduce((sum, line) => sum + amountValue(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + amountValue(line.credit), 0);
  const outOfBalance = Math.abs(totalDebit - totalCredit);
  const isBalanced = outOfBalance < 0.001 && totalDebit > 0;
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

  useEffect(() => {
    if (projectsQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(projectsQuery.error, 'Unable to load projects. Please refresh and try again.'),
      });
    }
  }, [projectsQuery.error]);

  useEffect(() => {
    if (costCentersQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(costCentersQuery.error, 'Unable to load cost centers. Please refresh and try again.'),
      });
    }
  }, [costCentersQuery.error]);

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
      const [projectsResult, costCentersResult] = await Promise.all([
        projectsQuery.refetch(),
        costCentersQuery.refetch(),
      ]);
      if (projectsResult.error) throw projectsResult.error;
      if (costCentersResult.error) throw costCentersResult.error;
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

  function validateAmount(rawAmount: string, lineNumber: number, label: string) {
    const cleaned = cleanAmount(rawAmount).trim();
    if (!cleaned) return null;
    if (!validAmountPattern.test(cleaned)) return `${label} must be a valid number on line ${lineNumber}.`;
    if (amountValue(cleaned) <= 0) return `${label} must be greater than zero on line ${lineNumber}.`;
    return null;
  }

  function validateForm() {
    if (!voucherDate) return 'Voucher Date is required.';
    if (!isVoucherDateValid) return 'Voucher Date is not a valid date.';
    if (dateValidation.isFetching) return 'Voucher Date is still being checked. Please wait.';
    if (dateValidation.error) {
      return friendlyErrorMessage(dateValidation.error, 'Unable to check Voucher Date. Please refresh and try again.');
    }
    if (dateValidation.data && !dateValidation.data.canPost) {
      return dateValidation.data.reason ?? 'Voucher Date is outside the open fiscal period.';
    }
    if (autoReverseDate) {
      if (!isValidDateInput(autoReverseDate)) return 'Auto Reverse Date is not a valid date.';
      if (autoReverseDate <= voucherDate) return 'Auto Reverse Date must be after Voucher Date.';
    }
    if (accountsQuery.isLoading) return 'Accounts are still loading. Please wait.';
    if (accountsQuery.error) {
      return friendlyErrorMessage(accountsQuery.error, 'Unable to load accounts. Please refresh and try again.');
    }
    if (accountOptions.length === 0) return 'No active posting accounts were found. Please create accounts first.';
    if (!description.trim()) return 'Voucher Details is required.';
    if (enteredLines.length < 2) return 'Add at least two journal lines.';

    for (const [index, line] of enteredLines.entries()) {
      const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
      const debit = amountValue(line.debit);
      const credit = amountValue(line.credit);
      if (!line.accountId) return `Account is required on line ${lineNumber}.`;
      if (!accountOptions.some(option => option.value === line.accountId)) {
        return `Account was not found on line ${lineNumber}. Please select it again.`;
      }
      if (line.projectId && !projectOptions.some(option => option.value === line.projectId)) {
        return `Project was not found on line ${lineNumber}. Please select it again.`;
      }
      if (line.costCenterId && !costCenterOptions.some(option => option.value === line.costCenterId)) {
        return `Cost Center was not found on line ${lineNumber}. Please select it again.`;
      }
      if (debit <= 0 && credit <= 0) return `Debit or Credit amount is required on line ${lineNumber}.`;
      if (debit > 0 && credit > 0) return `Line ${lineNumber} cannot have both Debit and Credit amounts.`;
      const debitError = validateAmount(line.debit, lineNumber, 'Debit');
      if (debitError) return debitError;
      const creditError = validateAmount(line.credit, lineNumber, 'Credit');
      if (creditError) return creditError;
    }

    if (totalDebit <= 0) return 'Total Debit must be greater than zero.';
    if (totalCredit <= 0) return 'Total Credit must be greater than zero.';
    if (!isBalanced) return `Journal Voucher is out of balance by ${formatMoney(outOfBalance)}.`;
    return null;
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

    const voucherLines: VoucherLinePayload[] = [];
    for (const [index, line] of enteredLines.entries()) {
      const account = accountOptions.find(option => option.value === line.accountId);
      if (!account) {
        const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
        setMessage({ kind: 'error', text: `Account was not found on line ${lineNumber}. Please select it again.` });
        return;
      }
      voucherLines.push({
        account_id: line.accountId,
        account_code: account.code,
        account_name: account.name,
        dr_amount: amountValue(line.debit),
        cr_amount: amountValue(line.credit),
        narration: line.description.trim() || description.trim(),
        line_no: index + 1,
        project_id: line.projectId || undefined,
        cost_center_id: line.costCenterId || undefined,
      });
    }

    try {
      const voucher = await createVoucher.mutateAsync({
        voucher_type: 'JV',
        voucher_date: voucherDate,
        reference: referenceNumber || undefined,
        narration: description.trim(),
        approval_status: approvalStatus,
        auto_reverse_date: autoReverseDate || undefined,
        lines: voucherLines,
      });

      let successText = `${voucher.voucher_number} saved as Draft.`;
      if (postAfterSave) {
        try {
          await postVoucher.mutateAsync({ id: voucher.id });
          successText = `${voucher.voucher_number} saved and posted successfully.`;
        } catch (postError) {
          resetForm(false);
          setMessage({
            kind: 'error',
            text: `${voucher.voucher_number} was saved as Draft, but could not be posted. ${friendlyErrorMessage(postError, 'Please review the voucher and try Process again.')}`,
          });
          return;
        }
      }

      let refreshWarning = '';
      try {
        await utils.vouchers.list.invalidate();
      } catch (refreshError) {
        refreshWarning = ` ${friendlyErrorMessage(refreshError, 'The voucher list could not refresh automatically.')}`;
      }
      resetForm(false);
      setMessage({ kind: 'success', text: `${successText}${refreshWarning}` });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(err, 'Unable to save Journal Voucher.'),
      });
    }
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--color-workspace-shadow)',
          padding: '8px 10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: 'linear-gradient(135deg, #334155, #2563eb)',
              }}
            >
              <IconFileInvoice size={20} stroke={1.8} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Journal Voucher</h1>
              <span style={badgeStyle('#1d4ed8', '#dbeafe')}>JV</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: 22,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>Status</span>
                Draft
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => resetForm()} style={compactButtonStyle}><IconFilePlus size={15} /> New</button>
            <button className="btn-secondary" type="button" disabled={saving} onClick={refreshVoucherData} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" disabled={saving} onClick={printVoucher} style={compactButtonStyle}><IconPrinter size={15} /> Print</button>
            <button type="button" className="btn-secondary" onClick={() => resetForm()} style={compactButtonStyle}>
              <IconCircleX size={15} /> Cancel
            </button>
            <button type="button" className="btn-secondary" disabled={actionDisabled} onClick={() => saveVoucher(false)} style={compactButtonStyle}>
              <IconDeviceFloppy size={15} /> Save Draft
            </button>
            <button type="button" className="btn-primary" disabled={actionDisabled} onClick={() => saveVoucher(true)} style={compactButtonStyle}>
              <IconCircleCheck size={15} /> Process
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div
          style={{
            flexShrink: 0,
            borderRadius: 'var(--radius)',
            padding: '7px 10px',
            border: `1px solid ${message.kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            background: message.kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: message.kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.78rem',
          }}
        >
          {message.kind === 'success' ? <IconCircleCheck size={18} /> : <IconReceipt size={18} />}
          {message.text}
        </div>
      )}

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

        <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0 0 6px' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-heading)' }}>Journal Lines</h2>
            <button type="button" className="btn-secondary" onClick={addLine} style={compactButtonStyle}><IconFilePlus size={15} /> Add Line</button>
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
              <colgroup>
                {journalLineColumns.map(column => (
                  <col key={column.label || 'action'} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {journalLineColumns.map(column => (
                    <th key={column.label || 'action'} style={tableHeadStyle('right' in column && Boolean(column.right))}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  return (
                    <tr key={line.id}>
                      <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
                      <td style={tableCellStyle()}>
                        <SearchableSelect
                          value={line.accountId}
                          options={accountOptions}
                          onChange={value => {
                            updateLine(line.id, { accountId: value });
                          }}
                          placeholder={accountsQuery.isLoading ? 'Loading Accounts' : accountsQuery.error ? 'Accounts Not Loaded' : 'Search Account'}
                          disabled={accountsQuery.isLoading || accountsQuery.isError}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          value={line.description}
                          onChange={event => updateLine(line.id, { description: event.currentTarget.value })}
                          placeholder="Description"
                          style={compactInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <SearchableSelect
                          value={line.projectId}
                          options={projectOptions}
                          onChange={value => updateLine(line.id, { projectId: value })}
                          placeholder={projectsQuery.isLoading ? 'Loading Projects' : projectsQuery.error ? 'Projects Not Loaded' : 'Search Project'}
                          disabled={projectsQuery.isLoading || projectsQuery.isError}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <SearchableSelect
                          value={line.costCenterId}
                          options={costCenterOptions}
                          onChange={value => updateLine(line.id, { costCenterId: value })}
                          placeholder={costCentersQuery.isLoading ? 'Loading Cost Centers' : costCentersQuery.error ? 'Cost Centers Not Loaded' : 'Search Cost Center'}
                          disabled={costCentersQuery.isLoading || costCentersQuery.isError}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          inputMode="decimal"
                          value={line.debit}
                          onChange={event => {
                            const value = sanitizeAmountInput(event.currentTarget.value);
                            updateLine(line.id, { debit: value, credit: value ? '' : line.credit });
                          }}
                          onFocus={() => updateLine(line.id, { debit: cleanAmount(line.debit) })}
                          onBlur={() => updateLine(line.id, { debit: formatAmountInput(line.debit) })}
                          placeholder="0.00"
                          style={compactMoneyInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          inputMode="decimal"
                          value={line.credit}
                          onChange={event => {
                            const value = sanitizeAmountInput(event.currentTarget.value);
                            updateLine(line.id, { credit: value, debit: value ? '' : line.debit });
                          }}
                          onFocus={() => updateLine(line.id, { credit: cleanAmount(line.credit) })}
                          onBlur={() => updateLine(line.id, { credit: formatAmountInput(line.credit) })}
                          placeholder="0.00"
                          style={compactMoneyInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          title="Remove Line"
                          style={{ padding: 4, color: 'var(--color-danger)', minHeight: 28 }}
                        >
                          <IconTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={voucherSummaryFooterStyle}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
            Active Lines: <strong style={{ color: 'var(--color-text)' }}>{activeLines.length}</strong>
          </span>
          <div style={voucherSummaryValuesStyle}>
            <SummaryRow label="Debit Total" value={totalDebit} strong={isBalanced} />
            <SummaryRow label="Credit Total" value={totalCredit} strong={isBalanced} />
            <SummaryRow label="Out Of Balance" value={outOfBalance} danger={!isBalanced && outOfBalance > 0} />
          </div>
        </div>
      </section>
    </main>
  );
}

function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    color,
    background,
    fontSize: '0.68rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}

function tableHeadStyle(right = false): CSSProperties {
  return {
    height: 30,
    padding: '5px 7px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    border: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
  };
}

function tableCellStyle(width?: number): CSSProperties {
  return {
    width,
    padding: 4,
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-surface)',
    verticalAlign: 'middle',
  };
}

const compactInputStyle: CSSProperties = {
  height: 28,
  minHeight: 28,
  padding: '3px 8px',
  fontSize: '0.76rem',
};

const compactNumericInputStyle: CSSProperties = {
  ...compactInputStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
};

const compactMoneyInputStyle: CSSProperties = {
  ...compactNumericInputStyle,
  fontWeight: 800,
};

const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
};

const voucherSummaryFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 12,
  alignItems: 'center',
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 10,
  minHeight: 66,
  overflow: 'hidden',
};

const voucherSummaryValuesStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  overflow: 'hidden',
};
