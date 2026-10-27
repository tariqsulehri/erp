'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react';

export type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; tone: ToastTone; message: string }

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

/** How long a toast stays (ms). Errors stay until closed. */
const TOAST_MS = 5000;

/**
 * Short messages in the corner after an action ("Voucher JV-2026-0012 posted."). Announced to screen readers.
 * Wrap the app once in <ToastProvider>; call `const toast = useToast(); toast('Saved.', 'success')`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(item => item.id !== id)), []);
  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts(current => [...current.slice(-3), { id, tone, message }]);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map(item => <Toast key={item.id} item={item} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (item.tone === 'error') return;
    const timer = window.setTimeout(() => onDismiss(item.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone, onDismiss]);
  const Icon = item.tone === 'success' ? IconCircleCheck : item.tone === 'error' ? IconAlertTriangle : IconInfoCircle;
  return (
    <div className={`toast toast-${item.tone}`}>
      <Icon size={18} stroke={1.9} aria-hidden />
      <span className="toast-text">{item.message}</span>
      <button type="button" className="help-dialog-close" title="Close" aria-label="Close Message" onClick={() => onDismiss(item.id)}><IconX size={14} stroke={1.9} aria-hidden /></button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
