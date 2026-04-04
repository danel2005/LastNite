/**
 * Create Event Screen
 *
 * Multi-step flow (3 steps + confirmation):
 *   0 — Name + dates (with full date/time picker modal)
 *   1 — Template picker
 *   2 — Settings
 *   3 — Invite code / success
 *
 * All steps share a smooth animated progress bar.
 */

import { useState, useRef, useCallback } from 'react'
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
  Modal,
  Pressable,
  Animated,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import type { Event } from '@lastnite/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventForm {
  title:                    string
  startsAt:                 Date
  endsAt:                   Date
  template:                 string
  missionIntervalMinutes:   number
  missionIntensity:         number
  allowCustomMissions:      boolean
  allowPublicSocialMissions: boolean
  safeMode:                 boolean
}

type DateField = 'startsAt' | 'endsAt'

// ─── Template data ────────────────────────────────────────────────────────────

const TEMPLATES = [
  { key: 'house_party',           emoji: '🏠', label: 'House Party',           desc: 'Classic house party missions' },
  { key: 'night_out',             emoji: '🌃', label: 'Night Out',             desc: 'Bars, clubs, urban adventures' },
  { key: 'birthday',              emoji: '🎂', label: 'Birthday',              desc: 'Celebrate the birthday person' },
  { key: 'bachelor_bachelorette', emoji: '💍', label: 'Bachelor / Bachelorette', desc: 'Pre-wedding chaos and memories' },
  { key: 'trip',                  emoji: '✈️', label: 'Trip',                  desc: 'Travel and explore together' },
  { key: 'festival',              emoji: '🎪', label: 'Festival',              desc: 'Outdoor festivals and events' },
  { key: 'trek',                  emoji: '🥾', label: 'Trek',                  desc: 'Hiking and outdoor adventures' },
  { key: 'ski',                   emoji: '⛷️', label: 'Ski Trip',              desc: 'Slopes, après-ski, memories' },
  { key: 'wedding',               emoji: '💒', label: 'Wedding',               desc: 'Wedding day memories' },
  { key: 'costume_party',         emoji: '🎭', label: 'Costume Party',         desc: 'Best costume wins the night' },
] as const

// ─── Date helpers ─────────────────────────────────────────────────────────────

function roundUpToNextHour(d: Date): Date {
  const out = new Date(d)
  out.setMinutes(0, 0, 0)
  out.setHours(out.getHours() + 1)
  return out
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
})

// ─── Date/Time Picker Modal ───────────────────────────────────────────────────

interface DatePickerProps {
  visible:  boolean
  value:    Date
  label:    string
  minDate?: Date
  maxDate?: Date
  onConfirm: (d: Date) => void
  onClose:   () => void
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const MINS   = [0, 15, 30, 45]

function DateTimePicker({ visible, value, label, minDate, onConfirm, onClose }: DatePickerProps) {
  const [draft, setDraft] = useState(value)

  // Reset draft when modal opens
  const onShow = useCallback(() => setDraft(value), [value])

  const year  = draft.getFullYear()
  const month = draft.getMonth()
  const day   = draft.getDate()
  const hour  = draft.getHours()
  const min   = Math.round(draft.getMinutes() / 15) * 15 % 60

  function set(changes: Partial<{ year: number; month: number; day: number; hour: number; min: number }>) {
    const next = new Date(draft)
    if (changes.year  !== undefined) next.setFullYear(changes.year)
    if (changes.month !== undefined) next.setMonth(changes.month)
    if (changes.day   !== undefined) next.setDate(changes.day)
    if (changes.hour  !== undefined) next.setHours(changes.hour)
    if (changes.min   !== undefined) next.setMinutes(changes.min, 0, 0)
    setDraft(next)
  }

  // Days in selected month/year
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Future years only
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => thisYear + i)

  function handleConfirm() {
    if (minDate && draft <= minDate) {
      Alert.alert('Invalid date', 'This date must be after the previous field.')
      return
    }
    onConfirm(draft)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={onShow}>
      <Pressable style={dp.backdrop} onPress={onClose}>
        <Pressable style={dp.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={dp.handle} />
          <Text style={dp.title}>{label}</Text>

          {/* Date row */}
          <Text style={dp.sectionLabel}>Date</Text>
          <View style={dp.row}>
            {/* Month */}
            <ScrollView style={dp.col} showsVerticalScrollIndicator={false}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[dp.item, month === i && dp.itemSelected]}
                  onPress={() => set({ month: i })}
                >
                  <Text style={[dp.itemText, month === i && dp.itemTextSelected]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Day */}
            <ScrollView style={dp.col} showsVerticalScrollIndicator={false}>
              {days.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[dp.item, day === d && dp.itemSelected]}
                  onPress={() => set({ day: d })}
                >
                  <Text style={[dp.itemText, day === d && dp.itemTextSelected]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Year */}
            <ScrollView style={dp.col} showsVerticalScrollIndicator={false}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[dp.item, year === y && dp.itemSelected]}
                  onPress={() => set({ year: y })}
                >
                  <Text style={[dp.itemText, year === y && dp.itemTextSelected]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time row */}
          <Text style={dp.sectionLabel}>Time</Text>
          <View style={dp.row}>
            <ScrollView style={dp.col} showsVerticalScrollIndicator={false}>
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[dp.item, hour === h && dp.itemSelected]}
                  onPress={() => set({ hour: h })}
                >
                  <Text style={[dp.itemText, hour === h && dp.itemTextSelected]}>
                    {h.toString().padStart(2, '0')}:00
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={dp.col}>
              {MINS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[dp.item, min === m && dp.itemSelected]}
                  onPress={() => set({ min: m })}
                >
                  <Text style={[dp.itemText, min === m && dp.itemTextSelected]}>
                    :{m.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View style={dp.summary}>
            <Text style={dp.summaryText}>{formatDate(draft)} · {formatTime(draft)}</Text>
          </View>

          <View style={dp.actions}>
            <TouchableOpacity style={dp.cancelBtn} onPress={onClose}>
              <Text style={dp.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.confirmBtn} onPress={handleConfirm}>
              <Text style={dp.confirmText}>Set date</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const dp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.heading3, color: colors.text, marginBottom: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm, height: 160, marginBottom: spacing.md },
  col: { flex: 1 },
  item: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  itemSelected: { backgroundColor: colors.accentSubtle },
  itemText: { color: colors.textSecondary, fontSize: 14 },
  itemTextSelected: { color: colors.accent, fontWeight: '700' },
  summary: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})

// ─── Date field button ────────────────────────────────────────────────────────

function DateField({ label, value, onPress }: { label: string; value: Date; onPress: () => void }) {
  return (
    <TouchableOpacity style={df.row} onPress={onPress} activeOpacity={0.8}>
      <View>
        <Text style={df.label}>{label}</Text>
        <Text style={df.value}>{formatDateTime(value)}</Text>
      </View>
      <Text style={df.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const df = StyleSheet.create({
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 3 },
  chevron: { color: colors.textTertiary, fontSize: 22 },
})

// ─── Inline field error ───────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <Text style={{ color: colors.error, fontSize: 13, marginTop: 4 }}>{msg}</Text>
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3

export default function CreateEventScreen() {
  const now = roundUpToNextHour(new Date())
  const [step, setStep]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null)
  const [pickerField, setPickerField]   = useState<DateField | null>(null)
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})

  const [form, setForm] = useState<EventForm>({
    title:                    '',
    startsAt:                 now,
    endsAt:                   addHours(now, 4),
    template:                 'house_party',
    missionIntervalMinutes:   30,
    missionIntensity:         3,
    allowCustomMissions:      true,
    allowPublicSocialMissions: false,
    safeMode:                 false,
  })

  function update<K extends keyof EventForm>(key: K, val: EventForm[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setFieldErrors((e) => { const next = { ...e }; delete next[key as string]; return next })
  }

  function validateStep0(): boolean {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Event name is required.'
    if (form.endsAt <= form.startsAt) e.endsAt = 'End time must be after start time.'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  async function createEvent() {
    setLoading(true)
    setFieldErrors({})
    try {
      const res = await apiClient.post('/events', {
        title: form.title.trim(),
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
        'Failed to create event. Please try again.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Picker handlers ───────────────────────────────────────────────────────

  function handlePickerConfirm(d: Date) {
    if (pickerField === 'startsAt') {
      update('startsAt', d)
      // Ensure endsAt stays after startsAt
      if (d >= form.endsAt) {
        update('endsAt', addHours(d, 4))
      }
    } else if (pickerField === 'endsAt') {
      update('endsAt', d)
    }
    setPickerField(null)
  }

  // ── Step 0: Name + Dates ──────────────────────────────────────────────────
  if (step === 0) {
    return (
      <>
        <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <ProgressBar step={0} total={TOTAL_STEPS} />
          <Text style={s.stepLabel}>Step 1 of 3</Text>
          <Text style={s.stepTitle}>Name your event</Text>

          <Text style={s.label}>Event name</Text>
          <TextInput
            style={[s.input, fieldErrors.title ? s.inputError : null]}
            value={form.title}
            onChangeText={(v) => update('title', v)}
            placeholder='e.g. "Sarah\'s 30th" or "Ibiza 2025"'
            placeholderTextColor={colors.textTertiary}
            maxLength={100}
            autoFocus
            returnKeyType="done"
          />
          <FieldError msg={fieldErrors.title} />

          <Text style={[s.label, { marginTop: spacing.lg }]}>Event starts</Text>
          <DateField
            label="Starts"
            value={form.startsAt}
            onPress={() => setPickerField('startsAt')}
          />

          <Text style={[s.label, { marginTop: spacing.md }]}>Event ends</Text>
          <DateField
            label="Ends"
            value={form.endsAt}
            onPress={() => setPickerField('endsAt')}
          />
          <FieldError msg={fieldErrors.endsAt} />

          <TouchableOpacity
            style={[s.nextButton, !form.title.trim() && s.buttonDisabled]}
            onPress={() => { if (validateStep0()) setStep(1) }}
          >
            <Text style={s.nextText}>Next →</Text>
          </TouchableOpacity>
        </ScrollView>

        <DateTimePicker
          visible={pickerField === 'startsAt'}
          value={form.startsAt}
          label="When does it start?"
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerField(null)}
        />
        <DateTimePicker
          visible={pickerField === 'endsAt'}
          value={form.endsAt}
          label="When does it end?"
          minDate={form.startsAt}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerField(null)}
        />
      </>
    )
  }

  // ── Step 1: Template ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <ProgressBar step={1} total={TOTAL_STEPS} />
        <Text style={s.stepLabel}>Step 2 of 3</Text>
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
              <View style={s.templateTextBlock}>
                <Text style={[s.templateLabel, form.template === t.key && s.templateLabelActive]}>
                  {t.label}
                </Text>
                <Text style={s.templateDesc}>{t.desc}</Text>
              </View>
              {form.template === t.key && (
                <Text style={s.templateCheck}>✓</Text>
              )}
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
        <ProgressBar step={2} total={TOTAL_STEPS} />
        <Text style={s.stepLabel}>Step 3 of 3</Text>
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

        <Text style={s.label}>Intensity</Text>
        <Text style={s.sublabel}>1 = chill  ·  5 = maximum chaos</Text>
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

        <ToggleRow
          label="Allow custom missions"
          desc="Participants can create their own missions before the event starts"
          value={form.allowCustomMissions}
          onChange={(v) => update('allowCustomMissions', v)}
        />
        <ToggleRow
          label="Safe mode"
          desc="Disable high-intensity and social missions"
          value={form.safeMode}
          onChange={(v) => update('safeMode', v)}
        />

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
              <ActivityIndicator color="#fff" />
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
        <View style={s.successBlock}>
          <Text style={s.successEmoji}>🎉</Text>
          <Text style={s.successTitle}>{createdEvent.title}</Text>
          <Text style={s.successSub}>Your event is ready. Share the code with your crew.</Text>
        </View>

        <View style={s.codeBox}>
          <Text style={s.codeLabel}>Invite code</Text>
          <Text style={s.codeText}>{code}</Text>
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

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, desc, value, onChange,
}: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={tr.row}>
      <View style={tr.text}>
        <Text style={tr.label}>{label}</Text>
        <Text style={tr.desc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgElevated, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}

const tr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
  },
  text: { flex: 1 },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  desc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  stepLabel: { ...typography.label, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  stepTitle: { ...typography.heading2, color: colors.text, marginBottom: spacing.xl },

  label: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sublabel: { ...typography.bodySmall, color: colors.textTertiary, marginBottom: spacing.sm, marginTop: -spacing.xs },
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

  nextButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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

  // Template
  templateGrid: { gap: spacing.xs, marginBottom: spacing.lg },
  templateCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  templateCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  templateEmoji: { fontSize: 26 },
  templateTextBlock: { flex: 1 },
  templateLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  templateLabelActive: { color: colors.accent },
  templateDesc: { ...typography.bodySmall, color: colors.textSecondary },
  templateCheck: { color: colors.accent, fontSize: 18, fontWeight: '900' },

  // Segmented control
  segmented: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
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
  segTextActive: { color: '#fff' },

  // Success / invite
  successBlock: { alignItems: 'center', paddingVertical: spacing.xl },
  successEmoji: { fontSize: 56, marginBottom: spacing.md },
  successTitle: { ...typography.heading2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  successSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  codeBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentSubtle,
  },
  codeLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  codeText: { fontSize: 38, fontWeight: '900', color: colors.accent, letterSpacing: 8 },
  shareButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lobbyButton: { paddingVertical: spacing.md, alignItems: 'center' },
  lobbyText: { color: colors.textSecondary, fontSize: 15 },
})
