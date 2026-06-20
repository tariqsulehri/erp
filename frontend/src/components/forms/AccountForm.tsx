'use client';

import { useState } from 'react';
import { Account } from '@/modules/accounts/account.entity';
import { getAccountLevelLabel } from '@/modules/accounts/account-code';

interface AccountFormProps {
  account?: Account;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
}

const ACCOUNT_TYPES = [
  { value: 'Asset',     label: 'Asset',             hint: 'Resources owned by the company' },
  { value: 'Liability', label: 'Liability',          hint: 'Obligations owed to others' },
  { value: 'Equity',    label: 'Equity',             hint: 'Owners\' stake in the company' },
  { value: 'Revenue',   label: 'Revenue',            hint: 'Income from business operations' },
  { value: 'COGS',      label: 'Cost of Goods Sold', hint: 'Direct costs of producing goods' },
  { value: 'OpEx',      label: 'Operating Expense',  hint: 'Day-to-day operating costs' },
  { value: 'Tax',       label: 'Tax',                hint: 'Tax-related accounts' },
  { value: 'Suspense',  label: 'Suspense',           hint: 'Temporary holding accounts' },
];

/**
 * CodeBreakdown — shows which hierarchy level the typed code represents.
 *
 * 10-digit system:
 *   MM00000000 → Main Category
 *   MMGG000000 → Group
 *   MMGGSS0000 → Sub-Group
 *   MMGGSSPPPP → Posting Account
 */
function CodeBreakdown({ code }: { code: string }) {
  if (code.length < 10) return null;
  const num = parseInt(code, 10);
  if (isNaN(num)) return null;

  const level = getAccountLevelLabel(code);
  const color = code.endsWith('0000') ? '#e0e7ff' : '#dcfce7';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <span style={{
        padding: '3px 12px', background: color, fontFamily: 'monospace',
        fontWeight: 700, borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', letterSpacing: 2,
      }}>{code}</span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
        → <strong style={{ color: 'var(--color-text)' }}>{level}</strong>
      </span>
    </div>
  );
}

export function AccountForm({ account, onSubmit, loading = false }: AccountFormProps) {
  const isEdit = !!account;
  const [formData, setFormData] = useState({
    code:           account?.code           || '',
    name:           account?.name           || '',
    description:    account?.description    || '',
    account_type:   account?.account_type   || 'Asset',
    normal_balance: account?.normal_balance || 'Debit',
    is_posting:     account?.is_posting     ?? true,
    is_system:      account?.is_system      ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 24 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </div>
      )}

      {/* Code + Name */}
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="code">
            Account Code <span className="form-required">*</span>
          </label>
          <input
            id="code" name="code" type="text" className="form-input"
            placeholder="e.g. 0101100001"
            value={formData.code}
            onChange={handleChange}
            maxLength={10} pattern="\d{10}"
            required disabled={isEdit || loading}
            style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.1em' }}
          />
          <CodeBreakdown code={formData.code} />
          <span className="form-hint">Exactly 10 digits. Format: 01 01 10 0001 = Main Category, Group, Sub-Group, Posting Account. Cannot be changed after creation.</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Account Name <span className="form-required">*</span>
          </label>
          <input
            id="name" name="name" type="text" className="form-input"
            placeholder="e.g. Petty Cash"
            value={formData.name}
            onChange={handleChange}
            maxLength={100} required disabled={loading}
          />
        </div>
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="form-label" htmlFor="description">Description</label>
        <textarea
          id="description" name="description" className="form-input"
          placeholder="Optional — describe the purpose of this account"
          value={formData.description}
          onChange={handleChange}
          maxLength={500} rows={3} disabled={loading}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      {/* Type + Balance */}
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="account_type">
            Account Type <span className="form-required">*</span>
          </label>
          <select
            id="account_type" name="account_type" className="form-select"
            value={formData.account_type}
            onChange={handleChange}
            disabled={isEdit || loading}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className="form-hint">
            {ACCOUNT_TYPES.find((t) => t.value === formData.account_type)?.hint}
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="normal_balance">
            Normal Balance <span className="form-required">*</span>
          </label>
          <select
            id="normal_balance" name="normal_balance" className="form-select"
            value={formData.normal_balance}
            onChange={handleChange}
            disabled={isEdit || loading}
          >
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
          </select>
          <span className="form-hint">
            {formData.normal_balance === 'Debit'
              ? 'Assets and Expenses normally carry a Debit balance.'
              : 'Liabilities, Equity and Revenue normally carry a Credit balance.'}
          </span>
        </div>
      </div>

      {/* Flags */}
      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>Account Options</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="form-checkbox-group" style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox" name="is_posting"
              checked={formData.is_posting}
              onChange={handleChange}
              disabled={loading}
            />
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Posting Account</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Allow journal entries on this account
              </div>
            </div>
          </label>

          <label className="form-checkbox-group" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
            <input type="checkbox" name="is_system" checked={formData.is_system} disabled />
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>System Account</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Reserved — cannot be modified
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 140 }}>
          {loading ? (
            <><span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />Saving...</>
          ) : isEdit ? 'Update Account' : 'Create Account'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => history.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
