import { InlineAlert } from '@/components/ui/InlineAlert';

export interface PartyAccountOption { id: string; code: string; name: string; account_type: string }

export const PARTY_BUSINESS_TYPE_LABELS: Record<string, string> = {
  company: 'Company',
  individual: 'Individual',
  government: 'Government',
};

export type PartyStatusFilter = 'Active' | 'All';

export const PARTY_STATUS_OPTIONS: Array<{ value: PartyStatusFilter; label: string }> = [
  { value: 'Active', label: 'Active' },
  { value: 'All', label: 'All' },
];

/** Shows the linked Chart of Accounts posting account, or explains it will be created on save. */
export function LinkedAccountNotice({ isEdit, account }: { isEdit: boolean; account?: PartyAccountOption }) {
  if (account) {
    return (
      <div className="linked-account">
        <span className="linked-account-label">Linked Account</span>
        <span className="linked-account-value"><strong>{account.code}</strong> {account.name}</span>
      </div>
    );
  }
  return (
    <InlineAlert tone="info">
      {isEdit
        ? 'This party has no Linked Account yet. One is created in the Chart of Accounts when you save.'
        : 'A posting account is created in the Chart of Accounts and linked to this party when you save.'}
    </InlineAlert>
  );
}
