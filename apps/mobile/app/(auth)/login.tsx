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
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

export default function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestOTP() {
    const cleaned = phone.replace(/\s/g, '').trim()
    if (!cleaned || cleaned.length < 7) {
      Alert.alert('Enter your phone number', 'Include your country code (e.g. +1 555 123 4567)')
      return
    }

    setLoading(true)
    try {
      await apiClient.post('/auth/request-otp', { phone: cleaned })
      router.push({ pathname: '/(auth)/verify', params: { phone: cleaned } })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to send OTP. Check your number and try again.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>LastNite</Text>
          <Text style={styles.tagline}>The night remembers everything.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 123 4567"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleRequestOTP}
            editable={!loading}
          />
          <Text style={styles.hint}>We'll text you a one-time code to verify your number.</Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>Send code →</Text>
            )}
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
  logo: {
    ...typography.heading1,
    color: colors.accent,
    fontSize: 48,
    fontWeight: '900',
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
    fontSize: 18,
    letterSpacing: 1,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
