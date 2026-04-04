import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <Text style={{ color: colors.error, fontSize: 13, marginTop: 4 }}>{message}</Text>
}

export default function ForgotPasswordScreen() {
  const [phone, setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  function validate(): boolean {
    const cleaned = phone.replace(/\s/g, '').trim()
    if (!cleaned) { setPhoneError('Phone number is required.'); return false }
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      setPhoneError('Use E.164 format — e.g. +972501234567')
      return false
    }
    return true
  }

  async function handleRequestReset() {
    if (!validate()) return
    const cleaned = phone.replace(/\s/g, '').trim()
    setLoading(true)
    setGeneralError(null)
    try {
      await apiClient.post('/auth/forgot-password', { phone: cleaned })
      router.push({
        pathname: '/(auth)/verify' as never,
        params: { phone: cleaned, mode: 'reset' },
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg?.toLowerCase().includes('not found') || msg?.toLowerCase().includes('no account')) {
        setPhoneError('No account found for this number.')
      } else {
        setGeneralError(msg ?? 'Failed to send reset code. Please try again.')
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
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Reset password</Text>
          <Text style={s.subtitle}>
            Enter your phone number and we'll send you a verification code.
          </Text>
        </View>

        {generalError && (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>{generalError}</Text>
          </View>
        )}

        <View style={s.form}>
          <Text style={s.label}>Phone number</Text>
          <TextInput
            style={[s.input, phoneError ? s.inputError : null]}
            value={phone}
            onChangeText={(v) => { setPhone(v); setPhoneError(null) }}
            placeholder="+972 50 123 4567"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleRequestReset}
            editable={!loading}
          />
          <FieldError message={phoneError} />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleRequestReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>Send code →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
            <Text style={s.backText}>← Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  header: { marginBottom: spacing.xxl },
  title: { ...typography.heading2, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  errorBanner: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: { color: colors.error, fontSize: 14 },
  form: { gap: spacing.sm },
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backRow: { alignItems: 'center', paddingVertical: spacing.md },
  backText: { ...typography.bodySmall, color: colors.textTertiary },
})
