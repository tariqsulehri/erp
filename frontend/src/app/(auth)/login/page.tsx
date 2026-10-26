'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { IconCheck, IconLogin } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { InlineAlert } from '@/components/ui/InlineAlert';

const FEATURES = [
  'Chart Of Accounts With A 10-Digit Code Structure',
  'Fiscal Years And Accounting Periods',
  'Journal Vouchers Posted To The General Ledger',
  'Trial Balance And Financial Statements',
  'Several Companies In One System',
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Shows why the user was signed out, e.g. an expired session or a password reset.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason) setError(reason);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/accounts',
      });
      if (result?.error) {
        // Wrong email or password comes back as CredentialsSignin; other problems carry the backend message.
        setError(result.error === 'CredentialsSignin' ? 'Email or Password is not correct. Please try again.' : result.error);
      } else if (result?.ok) {
        window.location.href = result.url || '/accounts';
      } else {
        window.location.href = '/accounts';
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left: product summary on the solid navy login panel */}
      <div className="login-left">
        <div style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <span className="sidebar-brand-mark" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="4" rx="1" fill="currentColor" />
                <rect x="3" y="9" width="11" height="4" rx="1" fill="currentColor" opacity="0.8" />
                <rect x="3" y="15" width="14" height="4" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
            </span>
            <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-sidebar-text-active)' }}>ERP Finance</span>
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-3xl)', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--color-sidebar-text-active)' }}>
            Complete Financial Control For Your Business
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 'var(--font-size-md)', lineHeight: 1.6, color: 'var(--color-sidebar-text)' }}>
            Multi-company ERP with double-entry accounting, real-time reporting, and IFRS and GAAP support.
          </p>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map(feature => (
              <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--font-size-md)', color: 'var(--color-sidebar-text)' }}>
                <IconCheck size={16} stroke={1.8} aria-hidden style={{ color: 'var(--color-sidebar-active)', flexShrink: 0 }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="login-right">
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--color-heading)' }}>Sign In To Your Account</h2>
        <p style={{ margin: '0 0 24px', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)' }}>Enter your email address and password to continue.</p>

        {error && <div style={{ marginBottom: 16 }}><InlineAlert tone="danger">{error}</InlineAlert></div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FieldLabel label="Email Address" htmlFor="email" required>
            <input
              id="email" type="email" className="form-input"
              placeholder="you@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus
              autoComplete="email"
            />
          </FieldLabel>
          <FieldLabel label="Password" htmlFor="password" required>
            <input
              id="password" type="password" className="form-input"
              placeholder="Enter your password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password"
            />
          </FieldLabel>

          <Button type="submit" variant="primary" size="lg" loading={loading} icon={<IconLogin size={16} stroke={1.8} />} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'Signing In…' : 'Sign In'}
          </Button>
        </form>

      </div>
    </div>
  );
}
