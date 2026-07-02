'use client';

import { useState } from 'react';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

/**
 * ConfirmDialog — reusable modal for destructive action confirmation.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     title="Deactivate Account"
 *     message="This account will no longer appear in transaction dropdowns."
 *     confirmLabel="Deactivate"
 *     variant="danger"
 *     loading={isPending}
 *     onConfirm={handleDeactivate}
 *     onCancel={() => setOpen(false)}
 *   />
 */

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  message:       string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      'danger' | 'warning' | 'primary';
  loading?:      boolean;
  requiredText?: string;
  requiredTextLabel?: string;
  onConfirm:     () => void;
  onCancel:      () => void;
}

const VARIANT_STYLE = {
  danger:  { Icon: IconAlertTriangle, color: 'var(--color-danger)', background: 'rgba(220, 38, 38, 0.12)' },
  warning: { Icon: IconAlertTriangle, color: 'var(--color-warning, #d97706)', background: 'rgba(217, 119, 6, 0.14)' },
  primary: { Icon: IconInfoCircle, color: 'var(--color-primary)', background: 'var(--color-primary-soft, rgba(37, 99, 235, 0.12))' },
};

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  loading      = false,
  requiredText,
  requiredTextLabel = 'Confirmation Text',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');
  if (!open) return null;

  const v = VARIANT_STYLE[variant];
  const Icon = v.Icon;
  const canConfirm = !requiredText || typedText.trim() === requiredText;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          animation: 'fadeIn 0.15s ease',
        }}
      >
        {/* Dialog */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 420,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            animation: 'scaleIn 0.15s ease',
          }}
        >
          {/* Body */}
          <div style={{ padding: '24px 24px 20px', display: 'flex', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: v.background,
              color: v.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} stroke={1.9} />
            </div>
            <div>
              <h3 style={{
                margin: '0 0 8px', fontSize: 'var(--font-size-base)',
                fontWeight: 700, color: 'var(--color-text)',
              }}>
                {title}
              </h3>
              <p style={{
                margin: 0, fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)', lineHeight: 1.6,
              }}>
                {message}
              </p>
              {requiredText ? (
                <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {requiredTextLabel}: type <span style={{ fontFamily: 'var(--font-mono)', color: v.color }}>{requiredText}</span>
                  </span>
                  <input
                    className="form-input"
                    value={typedText}
                    onChange={event => setTypedText(event.currentTarget.value)}
                    disabled={loading}
                    autoFocus
                    style={{ height: 32, minHeight: 32, fontSize: '0.78rem' }}
                  />
                </label>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            background: 'var(--color-surface-muted, var(--color-panel))',
          }}>
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </button>
            <button
              className={`btn ${variant === 'danger' ? '' : ''}`}
              onClick={onConfirm}
              disabled={loading || !canConfirm}
              style={{
                background: variant === 'danger' ? 'var(--color-danger)' : variant === 'warning' ? 'var(--color-warning, #d97706)' : 'var(--color-primary)',
                color: 'white', border: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {loading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />}
              {loading ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 }               to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  );
}
