import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { useAuthStore } from '@/stores/auth-store'

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile)
  const clearSession = useAuthStore((s) => s.clearSession)

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearSession()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.displayName?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.displayName}>{profile?.displayName ?? 'Unknown'}</Text>
          <Text style={styles.subtext}>Profile</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.dangerText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSubtle,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
  },
  displayName: {
    ...typography.heading3,
    color: colors.text,
  },
  subtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dangerText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
})
