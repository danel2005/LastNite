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
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { User, Profile } from '@lastnite/shared'

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const setSession = useAuthStore((s) => s.setSession)

  async function handleVerify() {
    if (otp.length < 4) {
      Alert.alert('Enter the code', 'The verification code is 6 digits.')
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.post('/auth/verify-otp', { phone, token: otp })
      const data = res.data as { access_token: string; user: User & { createdAt?: string; updatedAt?: string }; profile: Profile | null }
      const now = new Date().toISOString()
      const user: User = { ...data.user, createdAt: data.user.createdAt ?? now, updatedAt: data.user.updatedAt ?? now }
      await setSession(user, data.profile, data.access_token)

      if (!data.profile?.displayName) {
        router.replace('/(auth)/profile-setup')
      } else {
        router.replace('/(app)/')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Invalid code. Try again.'
      Alert.alert('Invalid code', msg)
      setOtp('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) return
    setResending(true)
    try {
      await apiClient.post('/auth/request-otp', { phone })
      Alert.alert('Code sent!', `A new code was sent to ${phone}`)
    } catch {
      Alert.alert('Error', 'Failed to resend code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Check your texts</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{phone}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={otp}
            onChangeText={(v) => {
              setOtp(v.replace(/\D/g, '').slice(0, 6))
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

          <TouchableOpacity
            style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || otp.length < 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>Verify →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendRow}>
            {resending ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Text style={styles.resendText}>Didn't get a code? Resend</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>← Change number</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.heading2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  phone: {
    color: colors.accent,
    fontWeight: '700',
  },
  form: {
    gap: spacing.sm,
  },
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resendRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  resendText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  backRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
})
