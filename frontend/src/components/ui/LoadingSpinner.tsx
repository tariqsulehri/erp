import type { ReactNode } from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'secondary' | 'white' | 'muted';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
  label?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

const SIZE_PX: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 36,
  xl: 48,
};

const BORDER_PX: Record<SpinnerSize, number> = {
  xs: 1.5,
  sm: 2,
  md: 2.5,
  lg: 3,
  xl: 4,
};

/**
 * Standard accessible spinning loader indicator.
 */
export function Spinner({
  size = 'md',
  color = 'primary',
  className = '',
  label = 'Loading…',
  'aria-hidden': ariaHidden,
}: SpinnerProps) {
  const px = SIZE_PX[size];
  const borderPx = BORDER_PX[size];
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  const topColor =
    color === 'white'
      ? 'var(--color-on-primary)'
      : color === 'secondary'
        ? 'var(--color-text-secondary)'
        : color === 'muted'
          ? 'var(--color-text-muted)'
          : 'var(--color-primary)';

  const trackColor =
    color === 'white'
      ? 'rgb(var(--accent-fg) / 0.2)'
      : 'var(--color-border-subtle)';

  return (
    <span
      className={`spinner ${className}`.trim()}
      style={{
        width: px,
        height: px,
        borderWidth: borderPx,
        borderStyle: 'solid',
        borderColor: trackColor,
        borderTopColor: topColor,
        display: 'inline-block',
        flexShrink: 0,
      }}
      role={isHidden ? undefined : 'status'}
      aria-label={isHidden ? undefined : label}
      aria-hidden={isHidden ? true : undefined}
    >
      {!isHidden && <span className="sr-only">{label}</span>}
    </span>
  );
}

interface LoadingStateProps {
  message?: string;
  description?: string;
  size?: SpinnerSize;
  minHeight?: number | string;
  inline?: boolean;
  action?: ReactNode;
  className?: string;
}

/**
 * Standard component for inline panels, cards, and section data-loading states.
 */
export function LoadingState({
  message = 'Loading…',
  description,
  size = 'lg',
  minHeight = 200,
  inline = false,
  action,
  className = '',
}: LoadingStateProps) {
  if (inline) {
    return (
      <div
        className={`loading-inline ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
        }}
        role="status"
      >
        <Spinner size={size === 'lg' || size === 'xl' ? 'sm' : size} />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`loading-container ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        minHeight,
        textAlign: 'center',
        gap: 12,
      }}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 380 }}>
        <div
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--color-heading)',
          }}
        >
          {message}
        </div>
        {description && (
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        )}
      </div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

interface LoadingScreenProps {
  message?: string;
  description?: string;
  fullScreen?: boolean;
}

/**
 * Standard full-screen or full-page loader used during route transitions and session verification.
 */
export function LoadingScreen({
  message = 'Loading Workspace…',
  description = 'Setting up secure environment and permissions',
  fullScreen = false,
}: LoadingScreenProps) {
  return (
    <div
      className="loading-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100vh' : '100%',
        height: fullScreen ? '100vh' : 'calc(100vh - var(--header-height, 56px))',
        width: '100%',
        backgroundColor: 'var(--color-bg)',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
      role="status"
      aria-live="polite"
    >
      <Spinner size="xl" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 600,
            color: 'var(--color-heading)',
            margin: 0,
          }}
        >
          {message}
        </h2>
        {description && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
