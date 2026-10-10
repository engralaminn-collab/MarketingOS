// Design tokens for the Diagram Design system.
// Source: cathrynlavery/diagram-design (MIT), skills/diagram-design/references/style-guide.md
// Light/dark values follow the style guide's semantic-role tables. Every diagram draws from these
// roles, never from ad-hoc hex values. Coral/tangerine accent is reserved for 1–2 focal elements.

export type ThemeName = 'light' | 'dark';

export interface DiagramTokens {
  paper: string;
  paper2: string;
  ink: string;
  inkStrong: string;
  muted: string;
  soft: string;
  rule: string;
  ruleSolid: string;
  accent: string;
  accentTint: string;
  link: string;
  /** Fill for `backend` nodes (white on light paper, paper-2 on dark so it doesn't glare). */
  backendFill: string;
  series: [string, string, string, string, string];
}

export const TOKENS: Record<ThemeName, DiagramTokens> = {
  light: {
    paper: '#f5f5f5',
    paper2: '#ececec',
    ink: '#2d3142',
    inkStrong: '#111111',
    muted: '#4f5d75',
    soft: '#7a8399',
    rule: 'rgba(45,49,66,0.12)',
    ruleSolid: '#bfc0c0',
    accent: '#eb6c36',
    accentTint: 'rgba(235,108,54,0.08)',
    link: '#2e5aa8',
    backendFill: '#ffffff',
    series: ['#7c8f6f', '#5e7a9b', '#b8915a', '#9c6b50', '#6e6479'],
  },
  dark: {
    paper: '#2d3142',
    paper2: '#393e53',
    ink: '#f5f5f5',
    inkStrong: '#111111',
    muted: '#bfc0c0',
    soft: '#8e98ac',
    rule: 'rgba(245,245,245,0.12)',
    ruleSolid: 'rgba(191,192,192,0.25)',
    accent: '#f08a59',
    accentTint: 'rgba(240,138,89,0.10)',
    link: '#6a95d8',
    backendFill: '#393e53',
    series: ['#9caf8f', '#82a0c0', '#d3ad7a', '#b88670', '#8d8298'],
  },
};

/** Font stacks. Titles are Instrument Serif; node names Geist; technical text Geist Mono. */
export const FONTS = {
  title: "'Instrument Serif', 'Noto Serif', Georgia, serif",
  sans: "Geist, 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', Inter, system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Stroke / radius / grid tokens from the style guide. */
export const STROKE = { thin: 0.8, default: 1, strong: 1.2 } as const;
export const RADIUS = { sm: 4, md: 6, lg: 8 } as const;
