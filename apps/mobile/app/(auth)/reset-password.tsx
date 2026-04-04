/**
 * Reset Password Screen
 *
 * Called after the user has verified their OTP during a password-reset flow.
 * Receives { phone, resetToken } from verify screen.
 * POSTs to /auth/reset-password with the token + new password.
 */

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
import { router, useLocalSearchParams } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { User, Profile } from '@lastnite/shared'

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <Text style={{ color: colors.error, fontSize: 13, marginTop: 4 }}>{message}</Text>
}

export default function ResetPasswordScreen() {
  const { phone, resetToken } = useLocalSearchParams<{ phone: string; resetToken: string }>()
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [loading, setLoading]         = useState(false)
  const [errors, setErrors]           = useState<{ password?: string; confirm?: string; general?: string }>({})
  const setSession                    = useAuthStore((s) => s.setSession)

  function validate(): boolean {
    const e: typeof errors = {}
    if (!password) e.password = 'New password is required.'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (!confirmPassword) e.confirm = 'Please confirm your new password.'
    else if (password !== confirmPassword) e.confirm = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleReset() {
    if (!validate()) return
    setLoading(true)
    setErrors({})
    try {
      const res = await apiClient.post('/auth/reset-password', {
        phone,
        resetToken,
        password,
      })
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
      // Go straight to the app — password reset complete
      router.replace('/(app)/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErrors({ general: msg ?? 'Failed to reset password. The link may have expired.' })
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
          <Text style={s.title}>New password</Text>
          <Text style={s.subtitle}>Choose a strong password for your account.</Text>
        </View>

        {errors.general && (
          <View style={s.errorBanner}>
            <Text style={s.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        <View style={s.form}>
          <View>
            <Text style={s.label}>New password</Text>
            <TextInput
              style={[s.input, errors.password ? s.inputError : null]}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })) }}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              autoFocus
              returnKeyType="next"
              editable={!loading}
            />
            <FieldError message={errors.password ?? null} />
          </View>

          <View>
            <Text style={s.label}>Confirm new password</Text>
            <TextInput
              style={[s.input, errors.confirm ? s.inputError : null]}
              value={confirmPassword}
              onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })) }}
              placeholder="Repeat password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleReset}
              editable={!loading}
            />
            <FieldError message={errors.confirm ?? null} />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>Set new password →</Text>
            )}
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
  subtitle: { ...typography.body, color: colors.textSecondary },
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
