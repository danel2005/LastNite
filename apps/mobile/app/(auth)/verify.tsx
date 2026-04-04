/**
 * Verify Screen
 *
 * Handles two modes:
 *   - mode="signup"  → verify phone after account creation, then sign in
 *   - mode="reset"   → verify phone for password reset, then go to reset-password
 *
 * Params: phone, mode ('signup' | 'reset')
 */

import { useState, useRef } from 'react'
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
import { router, useLocalSearchParams } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { User, Profile } from '@lastnite/shared'

type Mode = 'signup' | 'reset'

export default function VerifyScreen() {
  const { phone, mode = 'signup' } = useLocalSearchParams<{ phone: string; mode: Mode }>()
  const [otp, setOtp]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef                = useRef<TextInput>(null)
  const setSession              = useAuthStore((s) => s.setSession)

  const isReset  = mode === 'reset'
  const titleText  = isReset ? 'Reset your password' : 'Verify your number'
  const subtitleText = isReset
    ? 'Enter the code we sent to reset your password.'
    : 'Enter the code we sent to complete signup.'

  async function handleVerify() {
    if (otp.length < 6) {
      setError('The verification code is 6 digits.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (isReset) {
        // For reset: verify OTP, then navigate to reset-password with the session token
        const res = await apiClient.post('/auth/verify-reset', { phone, token: otp })
        const data = res.data as { resetToken: string }
        router.replace({
          pathname: '/(auth)/reset-password' as never,
          params: { phone, resetToken: data.resetToken },
        })
      } else {
        // For signup: verify OTP → returns session → log user in
        const res = await apiClient.post('/auth/verify-signup', { phone, token: otp })
        const data = res.data as {
          session: { accessToken: string }
          user: { id: string; phone: string | null; email: string | null }
          profile: Profile | null
        }
        const now = new Date().toISOString()
        const user: User = {
          id: data.user.id,
          phone: data.user.phone ?? null,
          email: data.user.email ?? null,
          createdAt: now,
          updatedAt: now,
        }
        await setSession(user, data.profile, data.session.accessToken)
        router.replace('/(auth)/profile-setup')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Invalid or expired code. Please try again.'
      setError(msg)
      setOtp('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) return
    setResending(true)
    setError(null)
    try {
      if (isReset) {
        await apiClient.post('/auth/forgot-password', { phone })
      } else {
        await apiClient.post('/auth/resend-signup-otp', { phone })
      }
    } catch {
      setError('Failed to resend code. Try again in a moment.')
    } finally {
      setResending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{titleText}</Text>
          <Text style={s.subtitle}>{subtitleText}</Text>
          <Text style={s.phone}>{phone}</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>Verification code</Text>
          <TextInput
            ref={inputRef}
            style={[s.input, error ? s.inputError : null]}
            value={otp}
            onChangeText={(v) => {
              setOtp(v.replace(/\D/g, '').slice(0, 6))
              setError(null)
            }}
            placeholder="000000"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
            editable={!loading}
          />
          {error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.button, (loading || otp.length < 6) && s.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || otp.length < 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>
                {isReset ? 'Verify & continue →' : 'Verify →'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={resending} style={s.resendRow}>
            {resending ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Text style={s.resendText}>Didn't get a code? Resend</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
            <Text style={s.backText}>← Go back</Text>
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
  phone: { ...typography.body, color: colors.accent, fontWeight: '700', marginTop: 4 },
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
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center', marginTop: 4 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  resendRow: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  resendText: { ...typography.bodySmall, color: colors.textSecondary, textDecorationLine: 'underline' },
  backRow: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { ...typography.bodySmall, color: colors.textTertiary },
})
