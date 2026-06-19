'use client';

import { useState, useRef, useEffect } from 'react';
import { IconCheck, IconChevronDown, IconPalette } from '@tabler/icons-react';
import { useTheme, THEMES, type ThemeConfig } from '@/lib/theme/theme-provider';

function ThemeSwatch({ t, active = false }: { t: ThemeConfig; active?: boolean }) {
  return (
    <span
      className="theme-swatch"
      style={{
        background: `linear-gradient(135deg, ${t.sidebar} 0 48%, ${t.bg} 48% 72%, ${t.accent} 72% 100%)`,
        boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${t.accent} 22%, transparent)` : undefined,
      }}
      aria-hidden
    >
      <span style={{ background: t.accent }} />
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
        <IconPalette size={15} stroke={2} />
        <span>Theme</span>
        <ThemeSwatch t={current} />
        <IconChevronDown
          size={13}
          stroke={2.2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="theme-switcher-dropdown">
          {/* Header */}
          <div className="theme-switcher-header">
            <div>
              <div className="theme-switcher-title">Appearance</div>
              <div className="theme-switcher-subtitle">Choose Workspace Theme</div>
            </div>
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
                <ThemeSwatch t={t} active={isActive} />

                <div className="theme-option-info">
                  <div className="theme-option-name">{t.label}</div>
                  <div className="theme-option-desc">{t.desc}</div>
                </div>

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
