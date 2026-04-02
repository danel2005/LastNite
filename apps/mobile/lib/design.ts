// LastNite Design System
// Dark, amber-accented, visual-first, slightly chaotic energy

export const colors = {
  // Backgrounds
  bg: '#0A0A0A',
  bgCard: '#141414',
  bgElevated: '#1E1E1E',
  bgInput: '#1A1A1A',

  // Brand
  accent: '#F5A623', // amber/orange — the LastNite signature color
  accentDim: '#C47D0E',
  accentSubtle: 'rgba(245, 166, 35, 0.12)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9A9A9A',
  textTertiary: '#5A5A5A',

  // Status
  success: '#4CAF7D',
  error: '#FF5C5C',
  warning: '#F5A623',

  // Secret mission special color
  secret: '#8B5CF6', // purple — mysterious
  secretSubtle: 'rgba(139, 92, 246, 0.12)',

  // Borders
  border: '#2A2A2A',
  borderSubtle: '#1E1E1E',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const typography = {
  heading1: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5 },
  heading2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading3: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  mono: { fontSize: 14, fontFamily: 'Courier New' },
} as const

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const
