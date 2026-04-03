import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Share,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import type { Event } from '@lastnite/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventForm {
  title: string
  startsAt: Date
  endsAt: Date
  template: string
  missionIntervalMinutes: number
  missionIntensity: number
  allowCustomMissions: boolean
  allowPublicSocialMissions: boolean
  safeMode: boolean
}

// ─── Template data ────────────────────────────────────────────────────────────

const TEMPLATES = [
  { key: 'house_party',           emoji: '🏠', label: 'House Party',            desc: 'Classic house party missions' },
  { key: 'night_out',             emoji: '🌃', label: 'Night Out',              desc: 'Bars, clubs, urban adventures' },
  { key: 'birthday',              emoji: '🎂', label: 'Birthday',               desc: 'Celebrate the birthday person' },
  { key: 'bachelor_bachelorette', emoji: '💍', label: 'Bachelor/Bachelorette',  desc: 'Pre-wedding chaos and memories' },
  { key: 'trip',                  emoji: '✈️', label: 'Trip',                   desc: 'Travel and explore together' },
  { key: 'festival',              emoji: '🎪', label: 'Festival',               desc: 'Outdoor festivals and events' },
] as const

// ─── Date helpers ─────────────────────────────────────────────────────────────

function roundUpToNextHour(d: Date): Date {
  const out = new Date(d)
  out.setMinutes(0, 0, 0)
  out.setHours(out.getHours() + 1)
  return out
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000)
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Step dots ────────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[stepStyles.dot, i === current && stepStyles.dotActive]} />
      ))}
    </View>
  )
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 20 },
})

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const now = roundUpToNextHour(new Date())
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>({
    title: '',
    startsAt: now,
    endsAt: addHours(now, 4),
    template: 'house_party',
    missionIntervalMinutes: 30,
    missionIntensity: 3,
    allowCustomMissions: true,
    allowPublicSocialMissions: false,
    safeMode: false,
  })

  function update<K extends keyof EventForm>(key: K, val: EventForm[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function createEvent() {
    setLoading(true)
    try {
      const res = await apiClient.post('/events', {
        title: form.title,
        startsAt: form.startsAt.toISOString(),
        endsAt: form.endsAt.toISOString(),
        template: form.template,
        missionIntervalMinutes: form.missionIntervalMinutes,
        missionIntensity: form.missionIntensity,
        allowCustomMissions: form.allowCustomMissions,
        allowPublicSocialMissions: form.allowPublicSocialMissions,
        safeMode: form.safeMode,
      })
      const data = res.data as { event: Event }
      setCreatedEvent(data.event)
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      setStep(3)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create event.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 0: Title + Dates ──────────────────────────────────────────────────
  if (step === 0) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <StepDots current={0} total={3} />
        <Text style={s.stepTitle}>Name your event</Text>

        <Text style={s.label}>Event name</Text>
        <TextInput
          style={s.input}
          value={form.title}
          onChangeText={(v) => update('title', v)}
          placeholder="e.g. Sarah's 30th, Ibiza 2025"
          placeholderTextColor={colors.textTertiary}
          maxLength={100}
          autoFocus
        />

        <Text style={s.label}>Starts</Text>
        <View style={s.dateRow}>
          <Text style={s.dateText}>{formatDateTime(form.startsAt)}</Text>
          <View style={s.dateButtons}>
            <TouchableOpacity style={s.dateBtn} onPress={() => {
              const next = new Date(form.startsAt)
              next.setHours(next.getHours() - 1)
              if (next > new Date()) {
                update('startsAt', next)
              }
            }}>
              <Text style={s.dateBtnText}>-1h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateBtn} onPress={() => {
              const next = new Date(form.startsAt)
              next.setHours(next.getHours() + 1)
              update('startsAt', next)
              if (next >= form.endsAt) update('endsAt', addHours(next, 4))
            }}>
              <Text style={s.dateBtnText}>+1h</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.label}>Ends</Text>
        <View style={s.dateRow}>
          <Text style={s.dateText}>{formatDateTime(form.endsAt)}</Text>
          <View style={s.dateButtons}>
            <TouchableOpacity style={s.dateBtn} onPress={() => {
              const next = new Date(form.endsAt)
              next.setHours(next.getHours() - 1)
              if (next > form.startsAt) update('endsAt', next)
            }}>
              <Text style={s.dateBtnText}>-1h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateBtn} onPress={() => {
              const next = new Date(form.endsAt)
              next.setHours(next.getHours() + 1)
              update('endsAt', next)
            }}>
              <Text style={s.dateBtnText}>+1h</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[s.nextButton, !form.title.trim() && s.buttonDisabled]}
          onPress={() => setStep(1)}
          disabled={!form.title.trim()}
        >
          <Text style={s.nextText}>Next →</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Step 1: Template ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <StepDots current={1} total={3} />
        <Text style={s.stepTitle}>Pick a vibe</Text>

        <View style={s.templateGrid}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.templateCard, form.template === t.key && s.templateCardActive]}
              onPress={() => update('template', t.key)}
              activeOpacity={0.8}
            >
              <Text style={s.templateEmoji}>{t.emoji}</Text>
              <Text style={[s.templateLabel, form.template === t.key && s.templateLabelActive]}>
                {t.label}
              </Text>
              <Text style={s.templateDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.navRow}>
          <TouchableOpacity style={s.backButton} onPress={() => setStep(0)}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.nextButton} onPress={() => setStep(2)}>
            <Text style={s.nextText}>Next →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // ── Step 2: Settings ──────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <StepDots current={2} total={3} />
        <Text style={s.stepTitle}>Settings</Text>

        <Text style={s.label}>Mission frequency</Text>
        <View style={s.segmented}>
          {([15, 30, 45, 60] as const).map((min) => (
            <TouchableOpacity
              key={min}
              style={[s.seg, form.missionIntervalMinutes === min && s.segActive]}
              onPress={() => update('missionIntervalMinutes', min)}
            >
              <Text style={[s.segText, form.missionIntervalMinutes === min && s.segTextActive]}>
                {min}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Intensity (1=chill, 5=chaos)</Text>
        <View style={s.segmented}>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <TouchableOpacity
              key={n}
              style={[s.seg, form.missionIntensity === n && s.segActive]}
              onPress={() => update('missionIntensity', n)}
            >
              <Text style={[s.segText, form.missionIntensity === n && s.segTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleLabel}>Allow custom missions</Text>
            <Text style={s.toggleDesc}>Participants can create their own missions</Text>
          </View>
          <Switch
            value={form.allowCustomMissions}
            onValueChange={(v) => update('allowCustomMissions', v)}
            trackColor={{ true: colors.accent }}
          />
        </View>

        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleLabel}>Safe mode</Text>
            <Text style={s.toggleDesc}>Disable high-intensity and social missions</Text>
          </View>
          <Switch
            value={form.safeMode}
            onValueChange={(v) => update('safeMode', v)}
            trackColor={{ true: colors.accent }}
          />
        </View>

        <View style={s.navRow}>
          <TouchableOpacity style={s.backButton} onPress={() => setStep(1)}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.nextButton, loading && s.buttonDisabled]}
            onPress={createEvent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={s.nextText}>Create Event →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // ── Step 3: Invite ────────────────────────────────────────────────────────
  if (step === 3 && createdEvent) {
    const code = createdEvent.inviteCode
    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <Text style={s.successEmoji}>🎉</Text>
        <Text style={[s.stepTitle, { textAlign: 'center' }]}>{createdEvent.title}</Text>
        <Text style={s.subtitle}>Share the invite code with your crew.</Text>

        <View style={s.codeBox}>
          <Text style={s.codeText}>{code}</Text>
          <Text style={s.codeTip}>Tap & hold to select</Text>
        </View>

        <TouchableOpacity
          style={s.shareButton}
          onPress={() =>
            Share.share({
              message: `Join my LastNite event "${createdEvent.title}" with code: ${code}`,
            })
          }
        >
          <Text style={s.shareText}>Share invite →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.lobbyButton}
          onPress={() => router.replace(`/(app)/events/${createdEvent.id}/lobby`)}
        >
          <Text style={s.lobbyText}>Go to Lobby</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return null
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  stepTitle: { ...typography.heading2, color: colors.text, marginBottom: spacing.xl },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: 'center' },
  label: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.md },
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
  dateRow: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { ...typography.body, color: colors.text },
  dateButtons: { flexDirection: 'row', gap: spacing.xs },
  dateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dateBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  nextButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nextText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backText: { color: colors.textSecondary, fontSize: 15 },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  buttonDisabled: { opacity: 0.4 },
  templateGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  templateCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  templateEmoji: { fontSize: 28, marginBottom: spacing.xs },
  templateLabel: { ...typography.heading3, color: colors.text, marginBottom: 2 },
  templateLabelActive: { color: colors.accent },
  templateDesc: { ...typography.bodySmall, color: colors.textSecondary },
  segmented: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segTextActive: { color: colors.bg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { ...typography.body, color: colors.text },
  toggleDesc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  successEmoji: { fontSize: 56, textAlign: 'center', marginBottom: spacing.md, marginTop: spacing.xl },
  codeBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  codeText: { fontSize: 36, fontWeight: '900', color: colors.accent, letterSpacing: 8 },
  codeTip: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.sm },
  shareButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shareText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  lobbyButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  lobbyText: { color: colors.textSecondary, fontSize: 15 },
})
