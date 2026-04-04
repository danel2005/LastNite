import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

// ─── Inline error helper ──────────────────────────────────────────────────────

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <Text style={fe.text}>{message}</Text>
}
const fe = StyleSheet.create({ text: { color: colors.error, fontSize: 13, marginTop: 4 } })

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SignupScreen() {
  const [phone, setPhone]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [loading, setLoading]         = useState(false)
  const [errors, setErrors]           = useState<{
    phone?: string; password?: string; confirm?: string; general?: string
  }>({})

  function validate(): boolean {
    const e: typeof errors = {}
    const cleaned = phone.replace(/\s/g, '').trim()
    if (!cleaned) e.phone = 'Phone number is required.'
    else if (!/^\+[1-9]\d{6,14}$/.test(cleaned))
      e.phone = 'Use E.164 format — e.g. +972501234567'
    if (!password) e.password = 'Password is required.'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (!confirmPassword) e.confirm = 'Please confirm your password.'
    else if (password !== confirmPassword) e.confirm = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSignup() {
    if (!validate()) return
    const cleaned = phone.replace(/\s/g, '').trim()
    setLoading(true)
    setErrors({})
    try {
      await apiClient.post('/auth/signup', { phone: cleaned, password })
      // Navigate to OTP verification — pass phone + context so verify knows this is signup
      router.push({
        pathname: '/(auth)/verify' as never,
        params: { phone: cleaned, mode: 'signup' },
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg?.toLowerCase().includes('already') || msg?.toLowerCase().includes('registered')) {
        setErrors({ phone: 'An account with this number already exists. Try signing in.' })
      } else if (msg?.toLowerCase().includes('phone')) {
        setErrors({ phone: msg })
      } else {
        setErrors({ general: msg ?? 'Failed to create account. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>LastNite</Text>
          <Text style={s.subtitle}>Create your account</Text>
        </View>

        {errors.general && (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        <View style={s.form}>
          <View>
            <Text style={s.label}>Phone number</Text>
            <TextInput
              style={[s.input, errors.phone ? s.inputError : null]}
              value={phone}
              onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: undefined })) }}
              placeholder="+972 50 123 4567"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoFocus
              returnKeyType="next"
              editable={!loading}
            />
            <FieldError message={errors.phone ?? null} />
            <Text style={s.hint}>
              We'll send a one-time code to verify your number.
            </Text>
          </View>

          <View>
            <Text style={s.label}>Password</Text>
            <TextInput
              style={[s.input, errors.password ? s.inputError : null]}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })) }}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              editable={!loading}
            />
            <FieldError message={errors.password ?? null} />
          </View>

          <View>
            <Text style={s.label}>Confirm password</Text>
            <TextInput
              style={[s.input, errors.confirm ? s.inputError : null]}
              value={confirmPassword}
              onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })) }}
              placeholder="Repeat your password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              editable={!loading}
            />
            <FieldError message={errors.confirm ?? null} />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>Continue →</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.xxl },
  logo: { fontSize: 40, fontWeight: '900', color: colors.accent, letterSpacing: -1 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  errorBanner: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: { color: colors.error, fontSize: 14 },
  form: { gap: spacing.md },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 17,
  },
  inputError: { borderColor: colors.error },
  hint: { ...typography.bodySmall, color: colors.textTertiary, marginTop: 5 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.body, color: colors.accent, fontWeight: '700' },
})
