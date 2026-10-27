// ============================================================
// Theme Definitions
// Each theme controls: sidebar, accent colors, content bg, top bar.
// Preserves Calm Ledger defaults (light, dark) and adds rich modern palettes.
// ============================================================

export type Theme =
  | 'light'
  | 'dark'
  | 'indigo'
  | 'emerald'
  | 'ocean'
  | 'rose'
  | 'amber'
  | 'slate'
  | 'violet'
  | 'teal'
  | 'midnight';

export interface ThemeDefinition {
  id: Theme;
  name: string;
  emoji: string;
  desc?: string;
  preview: [string, string, string];
  isDark?: boolean;

  sidebar: string;
  sidebarActive?: string;
  sidebarBrand?: string;
  sidebarText?: string;
  sidebarTextMuted?: string;
  sidebarDivider?: string;
  sidebarIndicator?: string;
  sidebarFooter?: string;
  sidebarFooterBorder?: string;

  badge?: string;
  accent: string;
  accentHover?: string;
  accentActive?: string;
  contentBg: string;
  topbar: string;
  topbarBorder?: string;
  periodActive?: string;
  localeActive?: string;
}

export const THEME_DEFINITIONS: Record<Theme, ThemeDefinition> = {
  // ── Calm Ledger Core Themes (Preserved & Protected) ──
  light: {
    id: 'light',
    name: 'Light',
    emoji: '☀️',
    desc: 'Calm Ledger Classic Blue workspace for daytime use',
    preview: ['#ffffff', '#0755e9', '#f2f5f5'],
    isDark: false,

    sidebar: 'rgb(var(--surface))',
    sidebarActive: 'rgb(var(--accent-soft))',
    sidebarBrand: 'rgb(var(--accent))',
    sidebarText: 'rgb(var(--text-2))',
    sidebarTextMuted: 'rgb(var(--text-3))',
    sidebarDivider: 'rgb(var(--border))',
    sidebarIndicator: 'rgb(var(--accent))',
    sidebarFooter: 'rgba(0,0,0,0.02)',
    sidebarFooterBorder: 'rgb(var(--border))',

    badge: 'linear-gradient(135deg, #0755e9, #04338c)',
    accent: '#0755e9',
    accentHover: '#04338c',
    accentActive: 'bg-blue-600 text-white',
    contentBg: 'rgb(var(--bg))',
    topbar: 'rgb(var(--surface))',
    topbarBorder: 'rgb(var(--border))',
    periodActive: 'bg-white text-blue-700 shadow-sm',
    localeActive: 'bg-blue-600 text-white shadow-sm',
  },

  dark: {
    id: 'dark',
    name: 'Dark',
    emoji: '🌙',
    desc: 'Low-glare dark workspace for dim environments',
    preview: ['#09090b', '#6366f1', '#18181b'],
    isDark: true,

    sidebar: 'linear-gradient(180deg, #09090b 0%, #18181b 60%, #09090b 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.15))',
    sidebarBrand: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    sidebarText: '#a1a1aa',
    sidebarTextMuted: 'rgba(161,161,170,0.4)',
    sidebarDivider: 'rgba(161,161,170,0.15)',
    sidebarIndicator: 'linear-gradient(180deg, #818cf8, #a78bfa)',
    sidebarFooter: 'rgba(255,255,255,0.03)',
    sidebarFooterBorder: 'rgba(255,255,255,0.05)',

    badge: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentActive: 'bg-indigo-600 text-white',
    contentBg: '#18181b',
    topbar: 'rgba(24,24,27,0.95)',
    topbarBorder: 'rgba(63,63,70,0.8)',
    periodActive: 'bg-zinc-700 text-zinc-100 shadow-sm',
    localeActive: 'bg-indigo-600 text-white shadow-sm',
  },

  // ── Vibrant & Rich Accent Themes ──
  indigo: {
    id: 'indigo',
    name: 'Indigo',
    emoji: '💜',
    desc: 'Deep slate & vibrant royal indigo',
    preview: ['#0f172a', '#6366f1', '#f0f4ff'],

    sidebar: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.3))',
    sidebarBrand: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    sidebarText: '#a5b4fc',
    sidebarTextMuted: 'rgba(165,180,252,0.5)',
    sidebarDivider: 'rgba(99,102,241,0.4)',
    sidebarIndicator: 'linear-gradient(180deg, #818cf8, #a78bfa)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentActive: 'bg-indigo-600 text-white',
    contentBg: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-indigo-700 shadow-sm',
    localeActive: 'bg-indigo-600 text-white shadow-sm',
  },

  emerald: {
    id: 'emerald',
    name: 'Emerald',
    emoji: '💚',
    desc: 'Forest deep & refreshing mint emerald',
    preview: ['#064e3b', '#10b981', '#f0fdf4'],

    sidebar: 'linear-gradient(180deg, #022c22 0%, #064e3b 60%, #022c22 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(16,185,129,0.45), rgba(20,184,166,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #10b981, #14b8a6)',
    sidebarText: '#6ee7b7',
    sidebarTextMuted: 'rgba(110,231,183,0.5)',
    sidebarDivider: 'rgba(16,185,129,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #34d399, #2dd4bf)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #10b981, #14b8a6)',
    accent: '#10b981',
    accentHover: '#059669',
    accentActive: 'bg-emerald-600 text-white',
    contentBg: 'linear-gradient(135deg, #f0fdf4 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-emerald-700 shadow-sm',
    localeActive: 'bg-emerald-600 text-white shadow-sm',
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    desc: 'Midnight navy & pacific sky blue',
    preview: ['#0c1a2e', '#0ea5e9', '#f0f9ff'],

    sidebar: 'linear-gradient(180deg, #0c1a2e 0%, #0f4c81 55%, #0c1a2e 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(14,165,233,0.45), rgba(6,182,212,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    sidebarText: '#7dd3fc',
    sidebarTextMuted: 'rgba(125,211,252,0.5)',
    sidebarDivider: 'rgba(14,165,233,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #38bdf8, #67e8f9)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentActive: 'bg-sky-600 text-white',
    contentBg: 'linear-gradient(135deg, #f0f9ff 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-sky-700 shadow-sm',
    localeActive: 'bg-sky-600 text-white shadow-sm',
  },

  rose: {
    id: 'rose',
    name: 'Rose',
    emoji: '🌹',
    desc: 'Crimson night & radiant rose',
    preview: ['#1a0a0f', '#f43f5e', '#fff1f2'],

    sidebar: 'linear-gradient(180deg, #1a0a0f 0%, #4c0519 60%, #1a0a0f 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(244,63,94,0.45), rgba(251,113,133,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #f43f5e, #fb7185)',
    sidebarText: '#fda4af',
    sidebarTextMuted: 'rgba(253,164,175,0.5)',
    sidebarDivider: 'rgba(244,63,94,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #fb7185, #fda4af)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #f43f5e, #fb7185)',
    accent: '#f43f5e',
    accentHover: '#e11d48',
    accentActive: 'bg-rose-600 text-white',
    contentBg: 'linear-gradient(135deg, #fff1f2 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-rose-700 shadow-sm',
    localeActive: 'bg-rose-600 text-white shadow-sm',
  },

  amber: {
    id: 'amber',
    name: 'Amber',
    emoji: '🌅',
    desc: 'Warm espresso & sunlit golden amber',
    preview: ['#1c1007', '#f59e0b', '#fffbeb'],

    sidebar: 'linear-gradient(180deg, #1c1007 0%, #451a03 60%, #1c1007 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(245,158,11,0.45), rgba(251,191,36,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    sidebarText: '#fcd34d',
    sidebarTextMuted: 'rgba(252,211,77,0.5)',
    sidebarDivider: 'rgba(245,158,11,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #fbbf24, #fcd34d)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentActive: 'bg-amber-500 text-white',
    contentBg: 'linear-gradient(135deg, #fffbeb 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-amber-700 shadow-sm',
    localeActive: 'bg-amber-500 text-white shadow-sm',
  },

  // ── Executive Pro Palettes ──
  slate: {
    id: 'slate',
    name: 'Slate',
    emoji: '🏢',
    desc: 'Executive carbon & modern neutral slate',
    preview: ['#0f172a', '#64748b', '#f8fafc'],

    sidebar: 'linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(100,116,139,0.45), rgba(71,85,105,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #64748b, #94a3b8)',
    sidebarText: '#cbd5e1',
    sidebarTextMuted: 'rgba(203,213,225,0.5)',
    sidebarDivider: 'rgba(100,116,139,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #94a3b8, #cbd5e1)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #64748b, #94a3b8)',
    accent: '#64748b',
    accentHover: '#475569',
    accentActive: 'bg-slate-600 text-white',
    contentBg: 'linear-gradient(135deg, #f8fafc 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-slate-700 shadow-sm',
    localeActive: 'bg-slate-600 text-white shadow-sm',
  },

  violet: {
    id: 'violet',
    name: 'Violet',
    emoji: '👑',
    desc: 'Royal purple & deep amethyst radiance',
    preview: ['#1e112a', '#8b5cf6', '#faf5ff'],

    sidebar: 'linear-gradient(180deg, #1e112a 0%, #2e1065 60%, #1e112a 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(139,92,246,0.45), rgba(167,139,250,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    sidebarText: '#d8b4fe',
    sidebarTextMuted: 'rgba(216,180,254,0.5)',
    sidebarDivider: 'rgba(139,92,246,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #c084fc, #e9d5ff)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentActive: 'bg-violet-600 text-white',
    contentBg: 'linear-gradient(135deg, #faf5ff 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-violet-700 shadow-sm',
    localeActive: 'bg-violet-600 text-white shadow-sm',
  },

  teal: {
    id: 'teal',
    name: 'Teal',
    emoji: '🪸',
    desc: 'Glacier mist & deep turquoise',
    preview: ['#042f2e', '#14b8a6', '#f0fdfa'],

    sidebar: 'linear-gradient(180deg, #042f2e 0%, #115e59 60%, #042f2e 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(20,184,166,0.45), rgba(45,212,191,0.25))',
    sidebarBrand: 'linear-gradient(135deg, #14b8a6, #2dd4bf)',
    sidebarText: '#5eead4',
    sidebarTextMuted: 'rgba(94,234,212,0.5)',
    sidebarDivider: 'rgba(20,184,166,0.35)',
    sidebarIndicator: 'linear-gradient(180deg, #2dd4bf, #99f6e4)',
    sidebarFooter: 'rgba(255,255,255,0.04)',
    sidebarFooterBorder: 'rgba(255,255,255,0.06)',

    badge: 'linear-gradient(135deg, #14b8a6, #2dd4bf)',
    accent: '#14b8a6',
    accentHover: '#0d9488',
    accentActive: 'bg-teal-600 text-white',
    contentBg: 'linear-gradient(135deg, #f0fdfa 0%, #fafafa 100%)',
    topbar: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(226,232,240,0.6)',
    periodActive: 'bg-white text-teal-700 shadow-sm',
    localeActive: 'bg-teal-600 text-white shadow-sm',
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight OLED',
    emoji: '🌌',
    desc: 'Pure pitch black OLED with electric azure',
    preview: ['#000000', '#38bdf8', '#09090b'],
    isDark: true,

    sidebar: 'linear-gradient(180deg, #000000 0%, #09090b 60%, #000000 100%)',
    sidebarActive: 'linear-gradient(135deg, rgba(56,189,248,0.35), rgba(14,165,233,0.18))',
    sidebarBrand: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    sidebarText: '#94a3b8',
    sidebarTextMuted: 'rgba(148,163,184,0.45)',
    sidebarDivider: 'rgba(148,163,184,0.15)',
    sidebarIndicator: 'linear-gradient(180deg, #38bdf8, #818cf8)',
    sidebarFooter: 'rgba(255,255,255,0.02)',
    sidebarFooterBorder: 'rgba(255,255,255,0.05)',

    badge: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    accent: '#38bdf8',
    accentHover: '#0284c7',
    accentActive: 'bg-sky-500 text-slate-950',
    contentBg: '#09090b',
    topbar: 'rgba(9,9,11,0.95)',
    topbarBorder: 'rgba(39,39,42,0.8)',
    periodActive: 'bg-zinc-800 text-zinc-100 shadow-sm',
    localeActive: 'bg-sky-500 text-slate-950 shadow-sm',
  },
};

export interface ThemeOption {
  value: Theme;
  label: string;
  desc: string;
  emoji: string;
  preview: [string, string, string];
  isDark?: boolean;
}

/** Array list of themes for navigation, segmented controls, and dropdowns. */
export const THEMES_LIST: ThemeOption[] = [
  { value: 'light', label: 'Light', desc: 'Calm Ledger Classic Blue workspace', emoji: '☀️', preview: ['#ffffff', '#0755e9', '#f2f5f5'] },
  { value: 'dark', label: 'Dark', desc: 'Low-glare workspace for dim rooms', emoji: '🌙', preview: ['#09090b', '#6366f1', '#18181b'], isDark: true },
  { value: 'indigo', label: 'Indigo', desc: 'Deep slate & vibrant royal indigo', emoji: '💜', preview: ['#0f172a', '#6366f1', '#f0f4ff'] },
  { value: 'emerald', label: 'Emerald', desc: 'Forest deep & refreshing mint emerald', emoji: '💚', preview: ['#064e3b', '#10b981', '#f0fdf4'] },
  { value: 'ocean', label: 'Ocean', desc: 'Midnight navy & pacific sky blue', emoji: '🌊', preview: ['#0c1a2e', '#0ea5e9', '#f0f9ff'] },
  { value: 'rose', label: 'Rose', desc: 'Crimson night & radiant rose', emoji: '🌹', preview: ['#1a0a0f', '#f43f5e', '#fff1f2'] },
  { value: 'amber', label: 'Amber', desc: 'Warm espresso & sunlit golden amber', emoji: '🌅', preview: ['#1c1007', '#f59e0b', '#fffbeb'] },
  { value: 'slate', label: 'Slate', desc: 'Executive carbon & modern neutral slate', emoji: '🏢', preview: ['#0f172a', '#64748b', '#f8fafc'] },
  { value: 'violet', label: 'Violet', desc: 'Royal purple & deep amethyst radiance', emoji: '👑', preview: ['#1e112a', '#8b5cf6', '#faf5ff'] },
  { value: 'teal', label: 'Teal', desc: 'Glacier mist & deep turquoise', emoji: '🪸', preview: ['#042f2e', '#14b8a6', '#f0fdfa'] },
  { value: 'midnight', label: 'Midnight OLED', desc: 'Pure pitch black OLED with electric azure', emoji: '🌌', preview: ['#000000', '#38bdf8', '#09090b'], isDark: true },
];

/**
 * THEMES provides dual access:
 * 1. Array methods (e.g. THEMES.map, Array.isArray(THEMES)) for UI components
 * 2. Keyed access (e.g. THEMES.indigo, THEMES[id]) matching the user's object format
 */
export type ThemesCollection = ThemeOption[] & Record<Theme, ThemeDefinition>;

function createThemesCollection(): ThemesCollection {
  const arr = [...THEMES_LIST] as unknown as ThemesCollection;
  for (const key of Object.keys(THEME_DEFINITIONS) as Theme[]) {
    arr[key] = THEME_DEFINITIONS[key];
  }
  return arr;
}

export const THEMES = createThemesCollection();
export const THEME_IDS: Theme[] = Object.keys(THEME_DEFINITIONS) as Theme[];
export const DEFAULT_THEME: Theme = 'light';
