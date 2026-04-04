// LastNite Design System
// Vibrant nightlife palette — neon, party energy, dark-mode first

// ─── Color Tokens ─────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds — deep midnight purple-black
  bg:          '#0B0A1A',
  bgCard:      '#14122A',
  bgElevated:  '#1E1B3A',
  bgInput:     '#18163A',

  // Brand accent — hot magenta/fuchsia (the LastNite party color)
  accent:      '#C026D3',
  accentLight: '#E879F9',
  accentDim:   '#86198F',
  accentSubtle: 'rgba(192, 38, 211, 0.15)',

  // Secondary accent — electric indigo (secondary actions, links)
  indigo:      '#818CF8',
  indigoSubtle: 'rgba(129, 140, 248, 0.15)',

  // Text
  text:          '#F0F0FF',
  textSecondary: '#9B97C1',
  textTertiary:  '#504B74',

  // Status
  success: '#22C55E',
  error:   '#F43F5E',
  warning: '#FBBF24',

  // Live event indicator
  live: '#22C55E',

  // Secret missions — vivid purple
  secret:      '#A855F7',
  secretSubtle: 'rgba(168, 85, 247, 0.15)',

  // Borders
  border:       '#2A2650',
  borderSubtle: '#1C1A35',

  // Utility
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const

// ─── Gradient Pairs (for LinearGradient) ─────────────────────────────────────

export const gradients = {
  brand:    ['#C026D3', '#7C3AED'] as const, // magenta → violet
  night:    ['#0B0A1A', '#14122A'] as const, // subtle card depth
  live:     ['#16A34A', '#22C55E'] as const, // green pulse
  secret:   ['#7C3AED', '#A855F7'] as const, // purple mystery
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
  full: 9999,
} as const

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  heading1:  { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5 },
  heading2:  { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading3:  { fontSize: 20, fontWeight: '700' as const },
  body:      { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label:     { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  mono:      { fontSize: 14, fontFamily: 'Courier New' },
} as const

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: {
    shadowColor: '#C026D3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
} as const
