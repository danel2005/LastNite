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
import { useAuthStore } from '@/stores/auth-store'
import type { Profile } from '@lastnite/shared'

export default function ProfileSetupScreen() {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const setProfile = useAuthStore((s) => s.setProfile)

  async function handleSave() {
    const name = displayName.trim()
    if (!name || name.length < 2) {
      Alert.alert('Choose a name', 'Your display name must be at least 2 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.put('/me', { displayName: name })
      const data = res.data as { profile: Profile }
      setProfile(data.profile)
      router.replace('/(app)/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save profile. Try again.'
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
          <Text style={styles.emoji}>👤</Text>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            This is how other participants will see you at the reveal.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Alex, BigDave, NightOwl"
            placeholderTextColor={colors.textTertiary}
            maxLength={50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            editable={!loading}
          />
          <Text style={styles.hint}>Max 50 characters. You can change this later in settings.</Text>

          <TouchableOpacity
            style={[styles.button, (loading || displayName.trim().length < 2) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading || displayName.trim().length < 2}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>Let's go →</Text>
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
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
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
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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
})
