// Domovník design tokens — §7 "calm ledger aesthetic"
// Shared across all platforms: desktop (Tauri), mobile (Expo), and web.

// ---- Colors ----
export const colors = {
  ink: '#1b1a17',
  muted: '#6f6e66',
  paper: '#eceae3',
  surface: '#faf9f5',
  surface2: '#f3f1ea',
  line: '#dbd8cf',
  lineDark: '#c9c5b8',
  pine: '#2f4a3e',
  pineSoft: '#e2eae3',
  brick: '#a13520',
  brickSoft: '#f2e2dc',
  ochre: '#8a6420',
  ochreSoft: '#efe6d2',
  white: '#ffffff',
  black: '#000000',
} as const;

// Dark mode token derivatives
export const colorsDark = {
  ink: '#f0efe7',
  muted: '#99988e',
  paper: '#1e1c19',
  surface: '#2a2823',
  surface2: '#33312a',
  line: '#3d3a33',
  lineDark: '#504c45',
  pine: '#5a8f76',
  pineSoft: '#1e352c',
  brick: '#d04a30',
  brickSoft: '#3a1f1a',
  ochre: '#ba8a30',
  ochreSoft: '#3a2d15',
  white: '#000000',
  black: '#ffffff',
} as const;

// ---- Typography ----
export const fonts = {
  sans: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
  mono: "'IBM Plex Mono', 'SF Mono', 'Cascadia Code', monospace",
} as const;

export const fontSizes = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  md: '16px',
  lg: '18px',
  xl: '22px',
  '2xl': '26px',
  '3xl': '32px',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// ---- Spacing ----
export const spacing = {
  px: '1px',
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

// ---- Radii ----
export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
} as const;

// ---- Shadows ----
export const shadows = {
  sm: '0 1px 2px rgba(27, 26, 23, 0.04)',
  md: '0 4px 12px rgba(27, 26, 23, 0.06)',
  lg: '0 8px 24px rgba(27, 26, 23, 0.08)',
  none: 'none',
} as const;

// ---- Component-specific tokens ----
export const components = {
  kpiTile: {
    background: colors.surface,
    border: `1px solid ${colors.line}`,
    borderRadius: radii.lg,
    accentWidth: '4px',
    padding: `${spacing[5]} ${spacing[6]}`,
  },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.line}`,
    borderRadius: radii.lg,
    padding: spacing[6],
  },
  table: {
    headerBg: colors.surface2,
    headerFont: fonts.mono,
    headerSize: fontSizes.xs,
    headerWeight: fontWeights.bold,
    borderColor: colors.line,
    rowPadding: `${spacing[3]} ${spacing[5]}`,
  },
  pill: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    padding: '3px 10px',
    borderRadius: radii.full,
  },
  button: {
    primary: {
      backgroundColor: colors.pine,
      color: colors.white,
      borderRadius: radii.md,
      padding: `${spacing[2]} ${spacing[4]}`,
    },
  },
  sidebar: {
    width: '260px',
    background: colors.surface,
    borderRight: `1px solid ${colors.line}`,
  },
} as const;

// ---- Design token map (export everything together) ----
export const tokens = {
  colors,
  colorsDark,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
  radii,
  shadows,
  components,
} as const;