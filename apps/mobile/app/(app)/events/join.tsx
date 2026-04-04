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
import { queryClient } from '@/lib/query-client'
import type { Event } from '@lastnite/shared'

export default function JoinScreen() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    const cleaned = code.trim().replace(/\s/g, '')
    if (!cleaned || cleaned.length < 4) {
      Alert.alert('Enter a code', 'Enter the invite code you received.')
      return
    }

    setLoading(true)
    try {
      const res = await apiClient.post(`/invites/${cleaned}/join`)
      const data = res.data as { event: Event; participant: unknown }
      await queryClient.invalidateQueries({ queryKey: ['events'] })

      const event = data.event
      if (event.state === 'scheduled' || event.state === 'draft') {
        router.replace(`/(app)/events/${event.id}/lobby`)
      } else {
        router.replace(`/(app)/events/${event.id}/`)
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg =
        status === 404 ? 'Invalid invite code. Check and try again.' :
        status === 409 ? 'You\'re already in this event!' :
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to join event.'
      Alert.alert('Couldn\'t join', msg)
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
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>Enter invite code</Text>
        <Text style={styles.subtitle}>
          Ask the event host for the code, or scan the link they shared.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="xxxxxxxx"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, (loading || code.trim().length < 4) && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={loading || code.trim().length < 4}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>Join Event →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.cancelRow}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
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
    gap: spacing.sm,
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.sm },
  title: { ...typography.heading2, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.accent,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '900',
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  cancelRow: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...typography.body, color: colors.textTertiary },
})
