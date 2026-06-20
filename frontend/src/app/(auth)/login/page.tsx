'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        router.push('/accounts');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left — Branding */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-logo">
            <div className="login-logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="4" rx="1" fill="white" />
                <rect x="3" y="9" width="11" height="4" rx="1" fill="white" opacity="0.8" />
                <rect x="3" y="15" width="14" height="4" rx="1" fill="white" opacity="0.6" />
              </svg>
            </div>
            <span className="login-logo-text">ERP Finance</span>
          </div>

          <h1 className="login-tagline">Complete Financial Control for Your Business</h1>
          <p className="login-desc">
            Multi-company ERP with double-entry accounting, real-time reporting, and IFRS/GAAP compliance.
          </p>

          <div className="login-features">
            {[
              'Chart of Accounts with 10-digit hierarchy',
              'Fiscal Year & Period Management',
              'Journal Vouchers with GL posting',
              'Trial Balance & Financial Statements',
              'Multi-company with automatic scoping',
            ].map((f) => (
              <div key={f} className="login-feature">
                <div className="login-feature-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="login-right">
        <h2 className="login-form-title">Sign in to your account</h2>
        <p className="login-form-sub">Enter your credentials to continue</p>

        {error && (
          <div className="alert alert-danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email" type="email" className="form-input"
              placeholder="you@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password" type="password" className="form-input"
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? (
              <><span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />Signing in...</>
            ) : 'Sign in'}
          </button>
        </form>

        <div className="login-demo-hint" style={{ marginTop: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.8125rem' }}>Demo credentials</p>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>Email: <strong style={{ color: '#0f172a' }}>admin@example.com</strong></p>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>Password: <strong style={{ color: '#0f172a' }}>admin123</strong></p>
        </div>
      </div>
    </div>
  );
}
