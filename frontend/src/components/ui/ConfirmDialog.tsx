'use client';

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
  onConfirm:     () => void;
  onCancel:      () => void;
}

const VARIANT_STYLE = {
  danger:  { btn: 'btn-danger',   icon: '⚠️', iconColor: '#dc2626', iconBg: '#fee2e2' },
  warning: { btn: 'btn-warning',  icon: '⚠️', iconColor: '#d97706', iconBg: '#fef3c7' },
  primary: { btn: 'btn-primary',  icon: 'ℹ️', iconColor: '#2563eb', iconBg: '#dbeafe' },
};

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  loading      = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const v = VARIANT_STYLE[variant];

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
              background: v.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              {v.icon}
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
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            background: '#f8fafc',
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
              disabled={loading}
              style={{
                background: variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : 'var(--color-primary)',
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
