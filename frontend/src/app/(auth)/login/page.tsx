'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { IconChartPie, IconDots, IconEye, IconEyeOff, IconLock } from '@tabler/icons-react';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { LoginIllustration } from '@/components/auth/LoginIllustration';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  // Shows why the user was signed out, e.g. an expired session or a password reset.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason) setError(reason);
    emailRef.current?.focus();
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
    <div className="login-page-split">
      {/* Left royal blue branding panel */}
      <aside className="login-brand-panel" aria-label="BizTrack">
        <div className="login-brand-top">
          <div className="login-brand-logo">
            <span className="brand-logo-icon" aria-hidden>
              <IconChartPie size={16} stroke={2.2} />
            </span>
            <span className="brand-logo-name">BizTrack</span>
          </div>

          <div className="login-hero-copy">
            <span className="login-eyebrow">Business Management Suite</span>
            <h1 className="login-headline">
              Run your business with clarity<span className="login-dot">.</span>
            </h1>
            <p className="login-tagline">Buy, sell, manage stock and grow. Your whole business in one place, always up to date.</p>
          </div>

          <div className="login-art-wrap">
            <LoginIllustration />
          </div>
        </div>

        <div className="login-brand-footer">
          <span>BizTrack — Business Management App</span>
        </div>
      </aside>

      {/* Right sign-in form panel */}
      <main className="login-form-panel">
        <div className="login-form-card">
          <header className="login-card-header">
            <h2 className="login-card-title">Welcome back</h2>
            <p className="login-card-subtitle">Sign in to continue</p>
          </header>

          {error && (
            <div style={{ marginBottom: 18 }}>
              <InlineAlert tone="danger">{error}</InlineAlert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form-body">
            {/* Username / Email field */}
            <div className="login-field-group">
              <label htmlFor="login-username" className="login-field-label">
                Email
              </label>
              <div className="login-input-wrap">
                <input
                  ref={emailRef}
                  id="login-username"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                />
                <span className="login-input-adornment" aria-hidden>
                  <IconDots size={16} stroke={1.8} />
                </span>
              </div>
            </div>

            {/* Password field */}
            <div className="login-field-group">
              <label htmlFor="login-password" className="login-field-label">
                Password
              </label>
              <div className="login-input-wrap has-lead">
                <span className="login-input-lead-icon" aria-hidden>
                  <IconLock size={16} stroke={1.8} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input with-lead"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff size={16} stroke={1.8} /> : <IconEye size={16} stroke={1.8} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit-button"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
