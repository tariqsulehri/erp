'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCash,
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

type VoucherKind = 'BPV' | 'CPV' | 'CRV';
type MessageKind = 'success' | 'error';

interface CashBankLine {
  id: number;
  accountId: string;
  description: string;
  projectId: string;
  chequeDetails: string;
  chequeDate: string;
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

interface VoucherLinePayload {
  account_id: string;
  account_code: string;
  account_name: string;
  dr_amount: number;
  cr_amount: number;
  narration?: string;
  line_no: number;
  project_id?: string;
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
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = (id: number): CashBankLine => ({
  id,
  accountId: '',
  description: '',
  projectId: '',
  chequeDetails: '',
  chequeDate: '',
  clearingDate: '',
  amount: '',
});
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

function SummaryRow({ label, value, strong = false, danger = false, formatMoneyValue = formatMoney }: { label: string; value: number; strong?: boolean; danger?: boolean; formatMoneyValue?: (value: number) => string }) {
  return (
    <div style={{ width: 126, minWidth: 0 }}>
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
        {formatMoneyValue(value)}
      </span>
    </div>
  );
}

function getLineColumns(config: VoucherConfig) {
  if (config.showChequeFields) {
    return [
      { label: 'No.', width: 32 },
      { label: config.lineAccountLabel, width: 275 },
      { label: 'Description', width: 300 },
      { label: 'Cheque Details', width: 140 },
      { label: 'Cheque Date', width: 96 },
      { label: 'Clearing Date', width: 96 },
      { label: 'Project', width: 128 },
      { label: 'Amount', width: 112, right: true },
      { label: '', width: 30 },
    ] as const;
  }

  return [
    { label: 'No.', width: 32 },
    { label: config.lineAccountLabel, width: 410 },
    { label: 'Description', width: 390 },
    { label: 'Project', width: 250 },
    { label: 'Amount', width: 118, right: true },
    { label: '', width: 30 },
  ] as const;
}

export default function CashBankVoucherPage({ voucherType }: { voucherType: VoucherKind }) {
  const config = voucherConfigs[voucherType];
  const utils = trpc.useUtils();
  const { data: generalSettings } = trpc.settings.getGeneralSettings.useQuery();
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
  const lineColumns = useMemo(() => getLineColumns(config), [config]);
  const selectedPrimaryAccount = accountOptions.find(option => option.value === primaryAccountId);
  const enteredLines = lines.filter(line =>
    line.accountId ||
    line.description.trim() ||
    line.projectId ||
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

  useEffect(() => {
    if (projectsQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(projectsQuery.error, 'Unable to load projects. Please refresh and try again.'),
      });
    }
  }, [projectsQuery.error]);

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
      const projectsResult = await projectsQuery.refetch();
      if (projectsResult.error) throw projectsResult.error;
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
    if (!voucherDate) return `${config.dateLabel} is required.`;
    if (!isVoucherDateValid) return `${config.dateLabel} is not a valid date.`;
    if (dateValidation.isFetching) return `${config.dateLabel} is still being checked. Please wait.`;
    if (dateValidation.error) {
      return friendlyErrorMessage(dateValidation.error, `Unable to check ${config.dateLabel}. Please refresh and try again.`);
    }
    if (dateValidation.data && !dateValidation.data.canPost) {
      return dateValidation.data.reason ?? `${config.dateLabel} is outside the open fiscal period.`;
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
    if (!primaryAccountId) return `${config.primaryAccountLabel} is required.`;
    if (!selectedPrimaryAccount) return `${config.primaryAccountKind} Account was not found. Please select it again.`;
    if (!description.trim()) return 'Voucher Details is required.';
    if (enteredLines.length === 0) return `Add at least one ${config.direction === 'receipt' ? 'receipt' : 'payment'} line.`;

    const chequeKeys = new Set<string>();
    for (const [index, line] of enteredLines.entries()) {
      const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
      const rawAmount = cleanAmount(line.amount).trim();
      const amount = amountValue(line.amount);
      if (!line.accountId) return `${config.lineAccountLabel} is required on line ${lineNumber}.`;
      if (!accountOptions.some(option => option.value === line.accountId)) {
        return `${config.lineAccountLabel} was not found on line ${lineNumber}. Please select it again.`;
      }
      if (line.accountId === primaryAccountId) return `${config.lineAccountLabel} cannot be the selected ${config.primaryAccountKind} Account on line ${lineNumber}.`;
      if (line.projectId && !projectOptions.some(option => option.value === line.projectId)) {
        return `Project was not found on line ${lineNumber}. Please select it again.`;
      }
      if (!rawAmount || !validAmountPattern.test(rawAmount)) return `Amount must be a valid number on line ${lineNumber}.`;
      if (!Number.isFinite(amount) || amount <= 0) return `Amount must be greater than zero on line ${lineNumber}.`;

      if (config.showChequeFields) {
        if ((line.chequeDate || line.clearingDate) && !line.chequeDetails.trim()) {
          return `Cheque Details are required on line ${lineNumber}.`;
        }
        if (line.chequeDetails.trim() && !line.chequeDate) {
          return `Cheque Date is required on line ${lineNumber}.`;
        }
        if (line.clearingDate && line.chequeDate && line.clearingDate < line.chequeDate) {
          return `Clearing Date cannot be before Cheque Date on line ${lineNumber}.`;
        }
        if (line.chequeDetails.trim()) {
          const chequeKey = `${primaryAccountId.toLowerCase()}::${line.chequeDetails.trim().toLowerCase()}`;
          if (chequeKeys.has(chequeKey)) {
            return `Cheque Details ${line.chequeDetails.trim()} are already entered for this bank account.`;
          }
          chequeKeys.add(chequeKey);
        }
      }
    }

    if (totalAmount <= 0) return `${config.totalLabel} must be greater than zero.`;
    return null;
  }

  function buildLineNarration(line: CashBankLine) {
    return [
      line.description.trim(),
      config.showChequeFields && line.chequeDetails.trim() ? `Cheque Details ${line.chequeDetails.trim()}` : '',
      config.showChequeFields && line.chequeDate ? `Cheque Date ${line.chequeDate}` : '',
      config.showChequeFields && line.clearingDate ? `Clearing Date ${line.clearingDate}` : '',
    ].filter(Boolean).join(' | ') || description.trim() || config.successNoun;
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

    const voucherLines: VoucherLinePayload[] = [];
    voucherLines.push({
      account_id: primaryAccountId,
      account_code: selectedPrimaryAccount.code,
      account_name: selectedPrimaryAccount.name,
      dr_amount: config.direction === 'receipt' ? totalAmount : 0,
      cr_amount: config.direction === 'payment' ? totalAmount : 0,
      narration: description.trim() || config.successNoun,
      line_no: 1,
    });

    for (const [index, line] of validLines.entries()) {
      const account = accountOptions.find(option => option.value === line.accountId);
      if (!account) {
        const lineNumber = lines.findIndex(item => item.id === line.id) + 1 || index + 1;
        setMessage({ kind: 'error', text: `${config.lineAccountLabel} was not found on line ${lineNumber}. Please select it again.` });
        return;
      }
      voucherLines.push({
        account_id: line.accountId,
        account_code: account.code,
        account_name: account.name,
        dr_amount: config.direction === 'payment' ? amountValue(line.amount) : 0,
        cr_amount: config.direction === 'receipt' ? amountValue(line.amount) : 0,
        narration: buildLineNarration(line),
        line_no: index + 2,
        project_id: line.projectId || undefined,
      });
    }

    try {
      const voucher = await createVoucher.mutateAsync({
        voucher_type: config.voucherType,
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
        text: friendlyErrorMessage(err, `Unable to save ${config.title}.`),
      });
    }
  }

  const HeaderIcon = config.icon === 'bank' ? IconBuildingBank : IconCash;

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
                background: config.accent,
              }}
            >
              <HeaderIcon size={20} stroke={1.8} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>{config.title}</h1>
              <span style={badgeStyle(config.badgeColor, config.badgeBackground)}>{config.voucherType}</span>
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

        <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0 0 6px' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-heading)' }}>{config.linesTitle}</h2>
            <button type="button" className="btn-secondary" onClick={addLine} style={compactButtonStyle}><IconFilePlus size={15} /> Add Line</button>
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
              <colgroup>
                {lineColumns.map(column => (
                  <col key={column.label || 'action'} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {lineColumns.map(column => (
                    <th key={column.label || 'action'} style={tableHeadStyle('right' in column && Boolean(column.right))}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
                    <td style={tableCellStyle()}>
                      <SearchableSelect
                        value={line.accountId}
                        options={accountOptions}
                        onChange={value => updateLine(line.id, { accountId: value })}
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
                    {config.showChequeFields && (
                      <>
                        <td style={tableCellStyle()}>
                          <input
                            className="form-input"
                            value={line.chequeDetails}
                            onChange={event => updateLine(line.id, { chequeDetails: event.currentTarget.value })}
                            placeholder="Cheque No."
                            style={compactInputStyle}
                          />
                        </td>
                        <td style={tableCellStyle()}>
                          <input
                            className="form-input"
                            type="date"
                            value={line.chequeDate}
                            onChange={event => updateLine(line.id, { chequeDate: event.currentTarget.value })}
                            style={compactDateInputStyle}
                          />
                        </td>
                        <td style={tableCellStyle()}>
                          <input
                            className="form-input"
                            type="date"
                            value={line.clearingDate}
                            onChange={event => updateLine(line.id, { clearingDate: event.currentTarget.value })}
                            style={compactDateInputStyle}
                          />
                        </td>
                      </>
                    )}
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
                      <input
                        className="form-input"
                        inputMode="decimal"
                        value={line.amount}
                        onChange={event => updateLine(line.id, { amount: sanitizeAmountInput(event.currentTarget.value) })}
                        onFocus={() => updateLine(line.id, { amount: cleanAmount(line.amount) })}
                        onBlur={() => updateLine(line.id, { amount: formatAmountInput(line.amount, generalSettings) })}
                        placeholder="0.00"
                        style={compactMoneyInputStyle}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={voucherSummaryFooterStyle}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
            Active Lines: <strong style={{ color: 'var(--color-text)' }}>{enteredLines.length}</strong>
          </span>
          <div style={voucherSummaryValuesStyle}>
            <SummaryRow label={config.totalLabel} value={totalAmount} strong={totalAmount > 0} formatMoneyValue={money} />
            <SummaryRow label={`${config.primaryAccountKind} Line`} value={totalAmount} formatMoneyValue={money} />
            <SummaryRow label="Difference" value={difference} danger={difference > 0} formatMoneyValue={money} />
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
