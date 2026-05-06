export type ThemeVariableName = `--${string}`;
export type ThemeVariables = Record<ThemeVariableName, string>;

export interface GlobalTheme {
  name: string;
  variables: ThemeVariables;
}

export const skyTableTheme: GlobalTheme = {
  name: 'mono-table',
  variables: {
    '--ink': '#050505',
    '--ink-soft': '#444444',
    '--paper': '#FFFFFF',
    '--sky-blue': '#111111',
    '--sky-surface': '#FFFFFF',
    '--sky-wash': '#FFFFFF',
    '--sun-wash': '#FFFFFF',
    '--sun': '#FFFFFF',
    '--orange': '#111111',

    '--confetti-sky': 'var(--sky-blue)',
    '--confetti-lagoon': '#111111',
    '--confetti-lime': 'var(--sky-blue)',
    '--confetti-lime-bright': 'var(--sky-surface)',
    '--confetti-sun': 'var(--sun)',
    '--confetti-peach': 'var(--orange)',
    '--confetti-coral': 'var(--orange)',
    '--confetti-plum': '#111111',

    '--background': '#FFFFFF',
    '--page-glow-cool': 'transparent',
    '--page-glow-warm': 'transparent',
    '--page-background': '#FFFFFF',
    '--wash-warm': 'var(--sun-wash)',
    '--wash-fresh': 'var(--sky-wash)',
    '--wash-rose': '#FFFFFF',
    '--foreground': 'var(--ink)',
    '--card': 'rgba(255, 255, 255, 0.96)',
    '--card-foreground': 'var(--ink)',
    '--popover': 'rgba(255, 255, 255, 0.98)',
    '--popover-foreground': 'var(--ink)',
    '--primary': 'var(--sky-blue)',
    '--primary-foreground': 'var(--ink)',
    '--secondary': 'var(--sky-surface)',
    '--secondary-foreground': 'var(--ink)',
    '--muted': 'rgba(0, 0, 0, 0.045)',
    '--muted-foreground': 'var(--ink-soft)',
    '--accent': 'var(--sun)',
    '--accent-foreground': 'var(--ink)',
    '--destructive': '#111111',
    '--destructive-foreground': '#FFFFFF',
    '--border': 'rgba(0, 0, 0, 0.14)',
    '--input': 'rgba(255, 255, 255, 0.98)',
    '--ring': 'var(--sun)',
    '--radius': '0.5rem',

    '--mint': 'var(--sky-blue)',
    '--cyan': 'var(--sky-blue)',
    '--teal': '#111111',
    '--navy': 'var(--ink)',
    '--peach': 'var(--orange)',
    '--coral': 'var(--orange)',
    '--plum': '#111111',
    '--text-soft': 'var(--ink-soft)',

    '--surface': '#FFFFFF',
    '--surface-strong': '#FFFFFF',
    '--surface-glass': 'rgba(255, 255, 255, 0.86)',
    '--surface-soft': 'rgba(255, 255, 255, 0.78)',
    '--surface-cool': 'var(--sky-wash)',
    '--surface-fresh': '#FFFFFF',
    '--surface-warm': 'var(--sun-wash)',
    '--surface-tint': 'var(--sky-surface)',
    '--surface-danger': 'rgba(0, 0, 0, 0.08)',
    '--surface-success': '#FFFFFF',
    '--surface-overlay': 'rgba(0, 0, 0, 0.62)',
    '--surface-disabled': 'rgba(0, 0, 0, 0.08)',

    '--table-felt': '#FFFFFF',
    '--table-felt-strong': '#FFFFFF',
    '--table-rail': 'rgba(0, 0, 0, 0.16)',
    '--table-slot': '#FFFFFF',
    '--table-slot-glow': 'rgba(0, 0, 0, 0.1)',
    '--seat-surface': '#FFFFFF',
    '--seat-border': 'rgba(0, 0, 0, 0.28)',
    '--seat-active': '#FFFFFF',
    '--panel-stage-a': '#FFFFFF',
    '--panel-stage-b': '#FFFFFF',
    '--panel-stage-c': '#F1F1F1',
    '--panel-shell': 'rgba(255, 255, 255, 0.84)',
    '--panel-shell-strong': 'rgba(255, 255, 255, 0.94)',
    '--panel-control': 'transparent',
    '--panel-hand': '#EDEDED',
    '--panel-hand-well': '#EDEDED',
    '--panel-player': '#F4F4F4',
    '--panel-player-metric': '#FFFFFF',
    '--panel-metric-bullet': '#FFFFFF',
    '--panel-metric-hand': '#E9E9E9',

    '--chip-shadow': '0 4px 10px rgba(0, 0, 0, 0.08)',
    '--card-shadow': '0 8px 16px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.9) inset',
    '--card-selected-shadow': '0 14px 24px rgba(0, 0, 0, 0.22)',
    '--table-shadow': 'inset 0 0 0 1px rgba(0, 0, 0, 0.24)',
    '--well-shadow': 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)',
    '--metric-shine': 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
    '--card-border': 'rgba(0, 0, 0, 0.18)',
    '--card-border-selected': 'rgba(0, 0, 0, 0.44)',
    '--card-line': 'var(--card-border)',
    '--line': 'rgba(0, 0, 0, 0.18)',
    '--line-strong': 'rgba(0, 0, 0, 0.44)',
    '--line-bright': 'rgba(0, 0, 0, 0.34)',
    '--line-warm': 'rgba(0, 0, 0, 0.34)',
    '--ring-cyan': 'rgba(0, 0, 0, 0.34)',
    '--ring-sun': 'rgba(0, 0, 0, 0.44)',
    '--shadow-soft': '0 18px 44px rgba(0, 0, 0, 0.14)',
    '--shadow-card': '0 10px 22px rgba(0, 0, 0, 0.1)',
    '--shadow-pop': '0 12px 26px rgba(0, 0, 0, 0.18)',
    '--card-face': '#FFFFFF',
    '--card-spades': '#111111',
    '--card-hearts': '#D94861',
    '--card-diamonds': '#2563EB',
    '--card-clubs': '#168A4A',
    '--card-joker-red': 'var(--card-hearts)',
    '--card-joker-black': 'var(--card-spades)',
    '--card-red': 'var(--card-hearts)',
    '--card-black': 'var(--card-spades)'
  }
};

export const defaultTheme = skyTableTheme;

export function createThemeVariables(overrides: Partial<ThemeVariables> = {}): ThemeVariables {
  const sanitizedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => typeof value === 'string')
  ) as ThemeVariables;

  return {
    ...defaultTheme.variables,
    ...sanitizedOverrides
  };
}

export function themeToCssVariables(theme: GlobalTheme | ThemeVariables = defaultTheme): ThemeVariables {
  return 'variables' in theme ? theme.variables : theme;
}

export function applyGlobalTheme(theme: GlobalTheme | ThemeVariables = defaultTheme, target?: HTMLElement): void {
  if (typeof document === 'undefined' && !target) return;

  const nextTarget = target || document.documentElement;
  const variables = themeToCssVariables(theme);
  Object.entries(variables).forEach(([name, value]) => {
    nextTarget.style.setProperty(name, value);
  });
}
