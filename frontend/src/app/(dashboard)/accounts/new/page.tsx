'use client';

/**
 * New Account page — guided wizard.
 *
 * Walks the user through:
 *   Step 1  Select Category  (X000)
 *   Step 2  Select Group     (XX00)
 *   Step 3  Select Sub-Group (XXX0)
 *   Step 4  Enter details — code auto-assigned, posts to accounts.create
 *
 * On success, shows a confirmation and offers to create another
 * account or navigate to the Chart of Accounts list.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import { AccountWizard } from '@/components/accounts/AccountWizard';
import type { AccountListItem } from '@/lib/api/accounts';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';

const CODE_STRUCTURE = [
  { part: 'MM',   label: 'Main Category',   example: '0100000000', exampleName: 'Assets' },
  { part: 'GG',   label: 'Group',           example: '0101000000', exampleName: 'Current Assets' },
  { part: 'SS',   label: 'Sub-Group',       example: '0101100000', exampleName: 'Cash And Bank' },
  { part: 'PPPP', label: 'Posting Account', example: '0101100001', exampleName: 'Cash In Hand' },
];

const HOW_IT_WORKS = [
  'Select the Main Category, such as Assets or Expenses.',
  'Select or create a Group within the category.',
  'Select or create a Sub-Group within the group.',
  'Name your account. The code is assigned automatically.',
];

export default function NewAccountPage() {
  const router = useRouter();
  const [created, setCreated] = useState<AccountListItem | null>(null);
  const backToList = () => router.push('/accounts');

  if (created) {
    return (
      <main className="page-shell">
        <PageHeader
          title="Account Created"
          description="The new account is ready to use on vouchers."
        help={(
          <>
            <p>Use this screen to add a new account to the Chart Of Accounts.</p>
            <ul>
              <li>Pick the Main Category. Then pick or create the Group and the Sub-Group.</li>
              <li>Enter the account name. The system gives the 10-digit code.</li>
            </ul>
            <p>Only Posting Accounts can be used on vouchers.</p>
          </>
        )}
          actions={(
            <>
              <Button icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={backToList}>Back To Chart Of Accounts</Button>
              <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setCreated(null)}>Create Another Account</Button>
            </>
          )}
        />
        <InlineAlert tone="success">
          Account <span style={{ fontVariantNumeric: 'tabular-nums' }}>{created.code}</span> — {created.name} was created.
        </InlineAlert>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="New Account"
        description="Follow the steps to put the account in the right group."
        help={(
          <>
            <p>Use this screen to add a new account to the Chart Of Accounts.</p>
            <ul>
              <li>Pick the Main Category. Then pick or create the Group and the Sub-Group.</li>
              <li>Enter the account name. The system gives the 10-digit code.</li>
            </ul>
            <p>Only Posting Accounts can be used on vouchers.</p>
          </>
        )}
        actions={<Button icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={backToList}>Back To Chart Of Accounts</Button>}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 12, alignItems: 'start' }}>
        {/* ── Wizard ───────────────────────────────────────────────── */}
        <section className="panel" style={{ maxHeight: '100%' }}>
          <div className="panel-header">
            <h2 className="panel-title">Create Account</h2>
          </div>
          <div className="panel-body">
            <AccountWizard onSuccess={setCreated} />
          </div>
        </section>

        {/* ── Reference column ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '100%', overflow: 'auto' }}>
          <section className="panel" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Code Structure</h2>
            </div>
            <div className="panel-body">
              <dl className="detail-list" style={{ margin: 0, gap: 10 }}>
                {CODE_STRUCTURE.map(row => (
                  <div key={row.part} className="detail-row" style={{ gridTemplateColumns: '44px minmax(0, 1fr)' }}>
                    <dt style={{ fontVariantNumeric: 'tabular-nums' }}>{row.part}</dt>
                    <dd>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--color-heading)' }}>{row.label}</span>
                      <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.example}</span> = {row.exampleName}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="panel" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">How It Works</h2>
            </div>
            <div className="panel-body">
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {HOW_IT_WORKS.map(step => (
                  <li key={step} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
