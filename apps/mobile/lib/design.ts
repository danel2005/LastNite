// LastNite Design System
// Warm night palette: deeper neutral surfaces with coral, mint, and electric blue accents.

// ─── Color Tokens ─────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg:                     '#08111f',
  bgCard:                 '#111c2e',
  bgElevated:             '#18263a',
  bgHighest:              '#203149',
  bgBright:               '#2b405c',
  bgInput:                '#101b2b',

  // Brand
  primary:                '#33d6c4',
  primaryDim:             '#13a89b',
  primaryContainer:       '#164f55',
  onPrimary:              '#03201f',

  accent:                 '#ff8a5b',
  accentDim:              '#ffb15f',
  accentSubtle:           'rgba(255, 138, 91, 0.16)',

  // Secondary
  secondary:              '#5da8ff',
  secondaryContainer:     '#173b68',

  // Text
  text:                   '#f4f7fb',
  textSecondary:          '#afbed1',
  textTertiary:           '#738299',

  // Status
  success:                '#22C55E',
  error:                  '#ff5f7a',
  warning:                '#ffd166',
  live:                   '#ff5f7a',

  // Secret missions
  secret:                 '#c084fc',
  secretSubtle:           'rgba(192, 132, 252, 0.15)',

  // Borders
  border:                 '#304258',
  borderSubtle:           '#1f3046',

  // Glass card (semi-transparent)
  glass:                  'rgba(17, 28, 46, 0.68)',

  // Utility
  overlay:                'rgba(0, 0, 0, 0.6)',
  transparent:            'transparent',
} as const

// ─── Gradient Pairs ───────────────────────────────────────────────────────────

export const gradients = {
  brand:    ['#33d6c4', '#ff8a5b'] as const,
  night:    ['#08111f', '#111c2e'] as const,
  live:     ['#16A34A', '#22C55E'] as const,
  secret:   ['#7C3AED', '#c084fc'] as const,
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
  heading1:  { fontSize: 36, fontWeight: '900' as const, letterSpacing: 0 },
  heading2:  { fontSize: 24, fontWeight: '800' as const, letterSpacing: 0 },
  heading3:  { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0 },
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
    shadowColor: '#33d6c4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  glowFuchsia: {
    shadowColor: '#ff8a5b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
} as const
