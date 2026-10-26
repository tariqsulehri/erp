'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Keyboard line entry for document screens.
 *
 * Mark-up the hook relies on (inside the element given to `linesRef`):
 * - `data-line-entry` on a line-entry row (Purchase, Sale, Returns), or `data-line-row` on each
 *   editable table row (vouchers). Add `data-line-empty="true"` to grid rows with nothing entered.
 * - `data-line-first` around the first field of a line (Item / Account) and `data-line-last` around
 *   the last field. Enter in the last field adds/updates the line (entry row) or moves to the next
 *   row, adding one at the end (grid), then focuses the first field.
 *
 * Screen-wide shortcuts while `enabled`: Ctrl+S / Cmd+S saves the draft, Alt+N starts a new line.
 * Nothing fires while a modal dialog is open or when the target action is disabled.
 */
export interface LineEntryKeyboardOptions {
  /** False while the screen is not the entry view (e.g. a list view of the same page). */
  enabled?: boolean;
  onSave?: () => void;
  saveDisabled?: boolean;
  /** Entry row: add or update the line. Return false when validation fails, so focus stays. */
  onCommitLine?: () => boolean | void;
  commitDisabled?: boolean;
  /** Alt+N on an entry row: clear the entry row (e.g. cancel a line edit). */
  onNewLine?: () => void;
  /** Grid: append a blank row (Alt+N when no empty row is left, or Enter on the last row). */
  onAddLine?: () => void;
  newLineDisabled?: boolean;
}

const FIELD_SELECTOR = 'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

function dialogIsOpen() {
  return typeof document !== 'undefined' && Boolean(document.querySelector('[aria-modal="true"]'));
}

function focusFirstField(scope: Element | null | undefined) {
  const field = scope?.querySelector('[data-line-first]')?.querySelector<HTMLElement>(FIELD_SELECTOR)
    ?? scope?.querySelector<HTMLElement>(FIELD_SELECTOR);
  field?.focus();
}

/** Runs after React has rendered the state change that the action caused. */
function afterRender(callback: () => void) {
  window.setTimeout(callback, 0);
}

export function useLineEntryKeyboard(options: LineEntryKeyboardOptions) {
  const linesRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const startNewLine = useCallback(() => {
    const current = optionsRef.current;
    const root = linesRef.current;
    if (!root || current.newLineDisabled) return;
    const entry = root.querySelector('[data-line-entry]');
    if (entry) {
      current.onNewLine?.();
      afterRender(() => focusFirstField(root.querySelector('[data-line-entry]')));
      return;
    }
    const emptyRow = root.querySelector('[data-line-row][data-line-empty="true"]');
    if (emptyRow) {
      focusFirstField(emptyRow);
      return;
    }
    if (!current.onAddLine) return;
    current.onAddLine();
    afterRender(() => {
      const rows = linesRef.current?.querySelectorAll('[data-line-row]');
      focusFirstField(rows?.[rows.length - 1]);
    });
  }, []);

  const enabled = options.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const current = optionsRef.current;
      const saveKey = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's';
      if (saveKey && current.onSave) {
        // Always block the browser "Save Page" dialog on a document screen.
        event.preventDefault();
        if (dialogIsOpen() || current.saveDisabled) return;
        current.onSave();
        return;
      }
      const newLineKey = event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyN';
      if (newLineKey) {
        if (dialogIsOpen() || current.newLineDisabled) return;
        event.preventDefault();
        startNewLine();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, startNewLine]);

  /** Attach to the lines panel: handles Enter in the last field of a line. */
  const onLinesKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.tagName !== 'INPUT' || !target.closest('[data-line-last]')) return;
    if (dialogIsOpen()) return;
    const current = optionsRef.current;

    const entry = target.closest('[data-line-entry]');
    if (entry) {
      event.preventDefault();
      if (current.commitDisabled || !current.onCommitLine) return;
      const result = current.onCommitLine();
      if (result !== false) afterRender(() => focusFirstField(linesRef.current?.querySelector('[data-line-entry]')));
      return;
    }

    const row = target.closest('[data-line-row]');
    if (!row) return;
    event.preventDefault();
    // Leave the amount field first so it formats on blur, as with Tab.
    target.blur();
    let next = row.nextElementSibling;
    while (next && !next.matches('[data-line-row]')) next = next.nextElementSibling;
    if (next) {
      focusFirstField(next);
      return;
    }
    if (current.newLineDisabled || !current.onAddLine) return;
    current.onAddLine();
    afterRender(() => {
      const rows = linesRef.current?.querySelectorAll('[data-line-row]');
      focusFirstField(rows?.[rows.length - 1]);
    });
  }, []);

  return { linesRef, onLinesKeyDown, startNewLine };
}

function subscribeNothing() {
  return () => undefined;
}

function detectMac() {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad/i.test(platform);
}

/** "Cmd" on Mac, "Ctrl" elsewhere (Ctrl during server render). */
export function useSaveShortcutLabel() {
  const isMac = useSyncExternalStore(subscribeNothing, detectMac, () => false);
  return isMac ? 'Cmd+S' : 'Ctrl+S';
}
