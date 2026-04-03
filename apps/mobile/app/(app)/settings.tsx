/**
 * Settings Screen — Step 20
 *
 * User profile + mission opt-out preferences.
 * Preferences saved to GET/PUT /me/preferences.
 */

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Preferences {
  disablePublicSocial: boolean
  disableAlcoholRefs: boolean
  disableIntensityAbove: number | null
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.text}>{title}</Text>
}

const sh = StyleSheet.create({
  text: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
})

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <View style={trSt.row}>
      <View style={trSt.text}>
        <Text style={trSt.label}>{label}</Text>
        {description && <Text style={trSt.desc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgElevated, true: colors.accent }}
        thumbColor={value ? '#fff' : colors.textSecondary}
        disabled={disabled}
      />
    </View>
  )
}

const trSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  desc: { ...typography.bodySmall, color: colors.textSecondary },
})

// ─── Intensity selector ───────────────────────────────────────────────────────

const INTENSITY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'All missions' },
  { value: 2, label: 'Skip intensity 3+' },
  { value: 3, label: 'Skip intensity 4+' },
  { value: 4, label: 'Skip intensity 5 only' },
]

function IntensitySelector({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}) {
  return (
    <View style={isSt.container}>
      {INTENSITY_OPTIONS.map((opt) => {
        const selected = opt.value === value
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[isSt.option, selected && isSt.optionSelected]}
            onPress={() => !disabled && onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[isSt.optionText, selected && isSt.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const isSt = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  optionText: { ...typography.label, color: colors.textSecondary },
  optionTextSelected: { color: colors.accent },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile)
  const clearSession = useAuthStore((s) => s.clearSession)
  const qc = useQueryClient()

  const { data: prefsData, isLoading: prefsLoading } = useQuery<Preferences>({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/me/preferences')
      return res.data as Preferences
    },
  })

  const [localPrefs, setLocalPrefs] = useState<Preferences | null>(null)

  useEffect(() => {
    if (prefsData && !localPrefs) {
      setLocalPrefs(prefsData)
    }
  }, [prefsData]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async (prefs: Partial<Preferences>) => {
      await apiClient.put('/me/preferences', prefs)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] })
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save preferences.')
    },
  })

  function updatePref<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const updated = { ...localPrefs!, [key]: value }
    setLocalPrefs(updated)
    saveMutation.mutate({ [key]: value })
  }

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

  const saving = saveMutation.isPending
  const prefs = localPrefs ?? prefsData

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(profile?.displayName?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={s.displayName}>{profile?.displayName ?? 'Unknown'}</Text>
            <Text style={s.subtext}>Participant</Text>
          </View>
          {saving && <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 'auto' }} />}
        </View>

        {/* Mission opt-out preferences */}
        <SectionHeader title="MISSION PREFERENCES" />

        {prefsLoading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.loadingText}>Loading preferences...</Text>
          </View>
        ) : prefs ? (
          <>
            <ToggleRow
              label="Disable public/social missions"
              description="Skip missions that require public interaction or involve strangers"
              value={prefs.disablePublicSocial}
              onChange={(v) => updatePref('disablePublicSocial', v)}
              disabled={saving}
            />
            <ToggleRow
              label="Disable alcohol references"
              description="Skip missions that reference drinking or alcohol"
              value={prefs.disableAlcoholRefs}
              onChange={(v) => updatePref('disableAlcoholRefs', v)}
              disabled={saving}
            />

            <View style={s.intensitySection}>
              <Text style={s.intensityLabel}>Mission intensity limit</Text>
              <Text style={s.intensityDesc}>
                Skip missions above this intensity level (1 = easy, 5 = chaos)
              </Text>
              <IntensitySelector
                value={prefs.disableIntensityAbove}
                onChange={(v) => updatePref('disableIntensityAbove', v)}
                disabled={saving}
              />
            </View>
          </>
        ) : null}

        {/* Account */}
        <SectionHeader title="ACCOUNT" />

        <TouchableOpacity style={s.dangerButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={s.dangerText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
  avatarText: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  displayName: { ...typography.heading3, color: colors.text },
  subtext: { ...typography.bodySmall, color: colors.textSecondary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { ...typography.bodySmall, color: colors.textSecondary },
  intensitySection: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  intensityDesc: { ...typography.bodySmall, color: colors.textSecondary },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dangerText: { color: colors.error, fontSize: 16, fontWeight: '600' },
})
