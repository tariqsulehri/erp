'use client';

import { useState, useRef, useEffect } from 'react';
import { IconCheck, IconChevronDown, IconPalette } from '@tabler/icons-react';
import { useTheme, THEMES, type ThemeConfig } from '@/lib/theme/theme-provider';

/** Mini two-tone preview rectangle (sidebar strip + page bg) */
function ThemePreview({ t, size = 'sm' }: { t: ThemeConfig; size?: 'sm' | 'lg' }) {
  const w = size === 'lg' ? 48 : 28;
  const h = size === 'lg' ? 30 : 18;
  const sideW = size === 'lg' ? 14 : 8;

  return (
    <span style={{
      display: 'flex', flexShrink: 0,
      width: w, height: h,
      borderRadius: size === 'lg' ? 6 : 4,
      overflow: 'hidden',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      border: '1.5px solid rgba(0,0,0,0.12)',
    }}>
      {/* Sidebar strip */}
      <span style={{ width: sideW, background: t.sidebar, display: 'block', flexShrink: 0 }} />
      {/* Page bg */}
      <span style={{ flex: 1, background: t.bg, display: 'block' }} />
    </span>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  const current = THEMES.find(t => t.value === theme)!;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="theme-switcher-btn"
        title="Switch theme"
      >
        <ThemePreview t={current} size="sm" />
        <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{current.label}</span>
        <IconChevronDown
          size={14}
          stroke={2.2}
          style={{ opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="theme-switcher-dropdown">
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 8px 10px', marginBottom: 4,
            borderBottom: '1px solid var(--color-border)',
          }}>
            <IconPalette size={15} stroke={2.1} color="var(--color-primary)" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: 0, color: 'var(--color-text-muted)' }}>
              Appearance
            </span>
          </div>

          {/* Theme options */}
          {THEMES.map(t => {
            const isActive = theme === t.value;
            return (
              <button
                key={t.value}
                onClick={() => { setTheme(t.value); setOpen(false); }}
                className={`theme-option${isActive ? ' active' : ''}`}
              >
                <ThemePreview t={t} size="lg" />

                <div className="theme-option-info">
                  <div className="theme-option-name">{t.label}</div>
                  <div className="theme-option-desc">{t.desc}</div>
                </div>

                {/* Accent dot */}
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: t.accent, flexShrink: 0,
                  boxShadow: isActive ? `0 0 0 3px ${t.accent}40` : 'none',
                  border: isActive ? `2px solid ${t.accent}` : '2px solid transparent',
                  transition: 'box-shadow 200ms',
                }} />

                {isActive && (
                  <IconCheck size={15} stroke={2.4} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
