'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconFilePlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { trpc } from '@/lib/trpc/client';
import { formatMoney, formatNumber } from '@/lib/app-settings';

type DepositKind = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';
type MessageKind = 'success' | 'error';

interface ReceiptLine {
  id: number;
  receivedFromAccountId: string;
  description: string;
  depositKind: DepositKind;
  chequeNumber: string;
  chequeDate: string;
  chequeBankName: string;
  clearingDate: string;
  amount: string;
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

const today = () => new Date().toISOString().slice(0, 10);

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

function formatAmountInput(value: string, settings?: Parameters<typeof formatNumber>[1]) {
  const numericValue = amountValue(value);
  return numericValue > 0 ? formatNumber(numericValue, settings) : '';
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
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

function SummaryRow({ label, value, strong = false, formatMoneyValue = formatMoney }: { label: string; value: number; strong?: boolean; formatMoneyValue?: (value: number) => string }) {
  return (
    <div style={{ width: 112, minWidth: 0 }}>
      <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.66rem', fontWeight: 800, lineHeight: 1.1 }}>
        {label}
      </span>
      <span
        style={{
          display: 'block',
          marginTop: 4,
          minHeight: 32,
          padding: '6px 8px',
          border: `1px solid ${strong ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius)',
          background: strong ? 'var(--color-primary-light)' : 'var(--color-surface)',
          fontFamily: 'var(--font-mono)',
          fontSize: strong ? '0.82rem' : '0.78rem',
          fontWeight: strong ? 900 : 800,
          color: strong ? 'var(--color-heading)' : 'var(--color-amount)',
          textAlign: 'right',
          lineHeight: 1.2,
        }}
      >
        {formatMoneyValue(value)}
      </span>
    </div>
  );
}

const receiptLineColumns = [
  { label: 'No.', width: 32 },
  { label: 'Received From Account', width: 235 },
  { label: 'Description', width: 190 },
  { label: 'Deposit Type', width: 105 },
  { label: 'Cheque Number', width: 110, required: true },
  { label: 'Cheque Date', width: 96 },
  { label: 'Cheque Bank', width: 145 },
  { label: 'Clearing Date', width: 96 },
  { label: 'Amount', width: 110, right: true },
  { label: '', width: 30 },
] as const;

export default function BankReceiptVoucherPage() {
  const utils = trpc.useUtils();
  const { data: generalSettings } = trpc.settings.getGeneralSettings.useQuery();
  const [depositDate, setDepositDate] = useState(today());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [lines, setLines] = useState<ReceiptLine[]>(initialLines);
  const [nextLineId, setNextLineId] = useState(INITIAL_LINE_COUNT + 1);
  const [message, setMessage] = useState<{ kind: MessageKind; text: string } | null>(null);
  const isDepositDateValid = isValidDateInput(depositDate);
  const depositDateForQuery = isDepositDateValid ? dateInputToDate(depositDate) : dateInputToDate(today());

  const accountsQuery = trpc.accounts.list.useQuery({
    page: 1,
    limit: 200,
    is_active: true,
    is_posting: true,
  });
  const dateValidation = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: depositDateForQuery },
    { enabled: isDepositDateValid, retry: false },
  );
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

  const selectedBankAccount = accountOptions.find(option => option.value === bankAccountId);
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
  const balanceAfterDeposit = currentBalance + totalAmount;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const saving = createVoucher.isPending || postVoucher.isPending;
  const actionDisabled = saving || accountsQuery.isLoading || dateValidation.isFetching;
  const dateStatusMessage = !depositDate
    ? ''
    : !isDepositDateValid
      ? 'Deposit Date is not a valid date.'
      : dateValidation.error
        ? friendlyErrorMessage(dateValidation.error, 'Unable to check Deposit Date.')
        : dateValidation.data && !dateValidation.data.canPost
          ? dateValidation.data.reason ?? 'Deposit Date is outside the open fiscal period.'
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
        text: friendlyErrorMessage(dateValidation.error, 'Unable to check Deposit Date. Please refresh and try again.'),
      });
    }
  }, [dateValidation.error]);

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
    setDepositDate(today());
    setReferenceNumber('');
    setDescription('');
    setBankAccountId('');
    setLines(initialLines());
    setNextLineId(INITIAL_LINE_COUNT + 1);
    if (clearMessage) setMessage(null);
  }

  async function refreshVoucherData() {
    setMessage(null);
    try {
      const accountsResult = await accountsQuery.refetch();
      if (accountsResult.error) throw accountsResult.error;
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
    if (!depositDate) return 'Deposit Date is required.';
    if (!isDepositDateValid) return 'Deposit Date is not a valid date.';
    if (dateValidation.isFetching) return 'Deposit Date is still being checked. Please wait.';
    if (dateValidation.error) {
      return friendlyErrorMessage(dateValidation.error, 'Unable to check Deposit Date. Please refresh and try again.');
    }
    if (dateValidation.data && !dateValidation.data.canPost) {
      return dateValidation.data.reason ?? 'Deposit Date is outside the open fiscal period.';
    }
    if (accountsQuery.isLoading) return 'Accounts are still loading. Please wait.';
    if (accountsQuery.error) {
      return friendlyErrorMessage(accountsQuery.error, 'Unable to load accounts. Please refresh and try again.');
    }
    if (accountOptions.length === 0) return 'No active posting accounts were found. Please create accounts first.';
    if (!bankAccountId) return 'Bank Account is required.';
    if (!selectedBankAccount) return 'Selected Bank Account was not found. Please select it again.';
    if (enteredLines.length === 0) return 'Add at least one receipt line.';
    for (const [index, line] of enteredLines.entries()) {
      const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
      const rawAmount = cleanAmount(line.amount).trim();
      const amount = amountValue(line.amount);
      if (!line.receivedFromAccountId) return `Received From Account is required on line ${lineNumber}.`;
      if (!accountOptions.some(option => option.value === line.receivedFromAccountId)) {
        return `Received From Account was not found on line ${lineNumber}. Please select it again.`;
      }
      if (line.receivedFromAccountId === bankAccountId) return `Received From Account cannot be the selected Bank Account on line ${lineNumber}.`;
      if (!rawAmount || !validAmountPattern.test(rawAmount)) return `Amount must be a valid number on line ${lineNumber}.`;
      if (!Number.isFinite(amount) || amount <= 0) return `Amount must be greater than zero on line ${lineNumber}.`;
    }
    if (totalAmount <= 0) return 'Total Deposit must be greater than zero.';
    const chequeKeys = new Set<string>();
    for (const line of validLines) {
      const lineNumber = lines.findIndex(item => item.id === line.id) + 1;
      if (line.depositKind !== 'CHEQUE') continue;
      const chequeNumber = line.chequeNumber.trim();
      const chequeBankName = line.chequeBankName.trim();
      if (!chequeNumber) return `Cheque Number is required on line ${lineNumber}.`;
      if (!line.chequeDate) return `Cheque Date is required on line ${lineNumber}.`;
      if (!chequeBankName) return `Cheque Bank is required on line ${lineNumber}.`;
      if (line.clearingDate && line.clearingDate < line.chequeDate) {
        return `Clearing Date cannot be before Cheque Date on line ${lineNumber}.`;
      }
      const chequeKey = `${chequeBankName.toLowerCase()}::${chequeNumber.toLowerCase()}`;
      if (chequeKeys.has(chequeKey)) {
        return `Cheque Number ${chequeNumber} from ${chequeBankName} is already entered in this voucher.`;
      }
      chequeKeys.add(chequeKey);
    }
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
    if (!selectedBankAccount) {
      setMessage({ kind: 'error', text: 'Selected Bank Account was not found.' });
      return;
    }

    const creditLines = [];
    for (const [index, line] of validLines.entries()) {
      const account = accountOptions.find(option => option.value === line.receivedFromAccountId);
      if (!account) {
        const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
        setMessage({ kind: 'error', text: `Received From Account was not found on line ${lineNumber}. Please select it again.` });
        return;
      }
      const depositType = depositTypes.find(type => type.value === line.depositKind)?.label ?? 'Deposit';
      const lineDetails = [
        line.description,
        depositType,
        line.chequeNumber ? `Cheque ${line.chequeNumber}` : '',
        line.chequeDate ? `Cheque Date ${line.chequeDate}` : '',
      ].filter(Boolean).join(' | ');

      creditLines.push({
        account_id: line.receivedFromAccountId,
        account_code: account.code,
        account_name: account.name,
        dr_amount: 0,
        cr_amount: amountValue(line.amount),
        narration: lineDetails || description || 'Bank Receipt',
        line_no: index + 2,
      });
    }

    try {
      const voucher = await createVoucher.mutateAsync({
        voucher_type: 'BRV',
        voucher_date: depositDate,
        reference: referenceNumber || undefined,
        narration: description || 'Bank Receipt Voucher',
        lines: [
          {
            account_id: bankAccountId,
            account_code: selectedBankAccount.code,
            account_name: selectedBankAccount.name,
            dr_amount: totalAmount,
            cr_amount: 0,
            narration: description || 'Bank Receipt',
            line_no: 1,
          },
          ...creditLines,
        ],
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
        text: friendlyErrorMessage(err, 'Unable to save Bank Receipt Voucher.'),
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
                background: 'linear-gradient(135deg, #0f6bff, #14b8a6)',
              }}
            >
              <IconBuildingBank size={20} stroke={1.8} />
            </div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Bank Receipt Voucher</h1>
                <span style={badgeStyle('#15803d', '#dcfce7')}>BRV</span>
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

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 145px minmax(190px, 1fr) minmax(260px, 1.5fr) 145px 155px', gap: 8, alignItems: 'end' }}>
            <FieldLabel label="Receipt Number"><input className="form-input" value="Auto" disabled style={compactInputStyle} /></FieldLabel>
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
                options={accountOptions}
                onChange={setBankAccountId}
                placeholder={accountsQuery.isLoading ? 'Loading Accounts' : accountsQuery.error ? 'Accounts Not Loaded' : 'Search Bank Account'}
                disabled={accountsQuery.isLoading || accountsQuery.isError}
              />
            </FieldLabel>
            <FieldLabel label="Current Balance"><input className="form-input" value={money(currentBalance)} disabled style={compactNumericInputStyle} /></FieldLabel>
            <FieldLabel label="Balance After Deposit"><input className="form-input" value={money(balanceAfterDeposit)} disabled style={compactNumericInputStyle} /></FieldLabel>
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

          <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0 0 6px' }}>
              <h2 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-heading)' }}>Receipt Lines</h2>
              <button type="button" className="btn-secondary" onClick={addLine} style={compactButtonStyle}><IconFilePlus size={15} /> Add Line</button>
            </div>

            <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
              <colgroup>
                {receiptLineColumns.map(column => (
                  <col key={column.label || 'action'} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {receiptLineColumns.map(column => (
                    <th key={column.label || 'action'} style={tableHeadStyle('right' in column && Boolean(column.right))}>
                      {column.label}
                      {'required' in column && column.required && <span style={{ color: '#fecaca', marginLeft: 2 }}>*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const isCheque = line.depositKind === 'CHEQUE';
                  return (
                    <tr key={line.id}>
                      <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
                      <td style={tableCellStyle()}>
                        <SearchableSelect
                          value={line.receivedFromAccountId}
                          options={accountOptions}
                          onChange={value => updateLine(line.id, { receivedFromAccountId: value })}
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
                          value={line.depositKind}
                          options={depositTypes}
                          onChange={value => updateLine(line.id, { depositKind: (value as DepositKind) || 'CASH' })}
                          placeholder="Select Type"
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          value={line.chequeNumber}
                          disabled={!isCheque}
                          onChange={event => updateLine(line.id, { chequeNumber: event.currentTarget.value })}
                          placeholder={isCheque ? 'Cheque No. *' : 'Cheque No.'}
                          style={compactInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          type="date"
                          value={line.chequeDate}
                          disabled={!isCheque}
                          onChange={event => updateLine(line.id, { chequeDate: event.currentTarget.value })}
                          style={compactDateInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          value={line.chequeBankName}
                          disabled={!isCheque}
                          onChange={event => updateLine(line.id, { chequeBankName: event.currentTarget.value })}
                          placeholder="Cheque Bank"
                          style={compactInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          type="date"
                          value={line.clearingDate}
                          disabled={!isCheque}
                          onChange={event => updateLine(line.id, { clearingDate: event.currentTarget.value })}
                          style={compactDateInputStyle}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <input
                          className="form-input"
                          inputMode="decimal"
                          value={line.amount}
                          onChange={event => updateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                          onFocus={() => updateLine(line.id, { amount: cleanAmount(line.amount) })}
                          onBlur={() => updateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                          placeholder="0.00"
                          style={{ ...compactInputStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800 }}
                        />
                      </td>
                      <td style={tableCellStyle()}>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
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
              <SummaryRow label="Cash Deposit" value={cashTotal} formatMoneyValue={money} />
              <SummaryRow label="Cheque Deposit" value={chequeTotal} formatMoneyValue={money} />
              <SummaryRow label="Bank Transfer" value={transferTotal} formatMoneyValue={money} />
              <SummaryRow label="Other Deposit" value={otherTotal} formatMoneyValue={money} />
              <SummaryRow label="Total Deposit" value={totalAmount} strong formatMoneyValue={money} />
              <SummaryRow label="Difference" value={0} formatMoneyValue={money} />
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

const compactDateInputStyle: CSSProperties = {
  ...compactInputStyle,
  padding: '3px 2px 3px 5px',
  fontSize: '0.72rem',
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
