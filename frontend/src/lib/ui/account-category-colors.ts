export type AccountCategoryType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

/** Badge variants that exist for account categories (see `.badge-asset` … in globals.css). */
export type AccountCategoryBadge = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'neutral';

interface AccountCategoryMeta {
  label: string;
  badge: AccountCategoryBadge;
}

/**
 * Single source of truth for account-category labels and their Badge variant, keyed by type name.
 * Colors come from the design tokens through the Badge classes, never from hex values here.
 */
export const ACCOUNT_CATEGORY_META: Record<string, AccountCategoryMeta> = {
  Asset:     { label: 'Assets',      badge: 'asset' },
  Liability: { label: 'Liabilities', badge: 'liability' },
  Equity:    { label: 'Equity',      badge: 'equity' },
  Revenue:   { label: 'Revenue',     badge: 'revenue' },
  Expense:   { label: 'Expenses',    badge: 'expense' },
};

/** Same metadata keyed by the MM00000000 category code used in account codes. */
export const ACCOUNT_CATEGORY_META_BY_CODE: Record<string, AccountCategoryMeta> = {
  '0100000000': ACCOUNT_CATEGORY_META.Asset,
  '0200000000': ACCOUNT_CATEGORY_META.Liability,
  '0300000000': ACCOUNT_CATEGORY_META.Equity,
  '0400000000': ACCOUNT_CATEGORY_META.Revenue,
  '0500000000': ACCOUNT_CATEGORY_META.Expense,
};

/** Badge variant for an account type name; unknown types fall back to neutral. */
export function accountTypeBadge(type: string): AccountCategoryBadge {
  return ACCOUNT_CATEGORY_META[type]?.badge ?? 'neutral';
}
