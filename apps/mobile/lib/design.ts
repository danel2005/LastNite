// LastNite Design System
// Matches the UI design files: deep midnight purple + lavender/fuchsia brand palette

// ─── Color Tokens ─────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg:                     '#0d0c1c',
  bgCard:                 '#19172b',   // surface-container
  bgElevated:             '#1f1d33',   // surface-container-high
  bgHighest:              '#25233b',   // surface-container-highest
  bgBright:               '#2b2943',   // surface-bright
  bgInput:                '#19172b',

  // Brand — lavender primary + fuchsia accent
  primary:                '#cc97ff',   // lavender purple
  primaryDim:             '#9c48ea',
  primaryContainer:       '#c284ff',
  onPrimary:              '#47007c',

  accent:                 '#ec56fc',   // fuchsia/tertiary
  accentDim:              '#f060ff',
  accentSubtle:           'rgba(236, 86, 252, 0.15)',

  // Secondary — indigo/blue-violet
  secondary:              '#8a95ff',
  secondaryContainer:     '#2f3aa3',

  // Text
  text:                   '#e7e2fa',   // on-surface / on-background
  textSecondary:          '#aca8bf',   // on-surface-variant
  textTertiary:           '#767388',   // outline

  // Status
  success:                '#22C55E',
  error:                  '#ff6e84',
  warning:                '#FBBF24',
  live:                   '#ff6e84',

  // Secret missions
  secret:                 '#A855F7',
  secretSubtle:           'rgba(168, 85, 247, 0.15)',

  // Borders
  border:                 '#484659',   // outline-variant
  borderSubtle:           '#25233b',

  // Glass card (semi-transparent)
  glass:                  'rgba(31, 29, 51, 0.6)',

  // Utility
  overlay:                'rgba(0, 0, 0, 0.6)',
  transparent:            'transparent',
} as const

// ─── Gradient Pairs ───────────────────────────────────────────────────────────

export const gradients = {
  brand:    ['#cc97ff', '#ec56fc'] as const,  // signature lavender → fuchsia
  night:    ['#0d0c1c', '#19172b'] as const,
  live:     ['#16A34A', '#22C55E'] as const,
  secret:   ['#7C3AED', '#A855F7'] as const,
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 9999,
} as const

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  heading1:  { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1 },
  heading2:  { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading3:  { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  body:      { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label:     { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8 },
  mono:      { fontSize: 14, fontFamily: 'Courier New' },
} as const

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#cc97ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  glowFuchsia: {
    shadowColor: '#ec56fc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
} as const
