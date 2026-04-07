/**
 * Live Event Dashboard
 *
 * The main screen during a live event. Redesigned to match the LastNite UI.
 * Shows:
 *   - Event title + LIVE badge + countdown
 *   - Mission card (current active mission or waiting state)
 *   - Participant activity strip
 *   - Feed CTA
 *   - Host controls (host only)
 *
 * Polls GET /events/:id/live every 30s (10s when mission is expiring).
 * Privacy invariant: never shows other users' mission assignments.
 */

import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'

// ─── API Types ────────────────────────────────────────────────────────────────

interface LiveMission {
  assignmentId: string
  status: string
  isSecret: boolean
  assignedAt: string
  expiresAt: string
  completedAt: string | null
  hasSubmission: boolean
  mission: {
    id: string
    title: string
    description: string
    mediaType: string
    intensity: number
    minDurationMs: number | null
    maxDurationMs: number | null
  }
}

interface ParticipantActivity {
  userId: string
  displayName: string
  isHost: boolean
  submissionCount: number
  isOnline: boolean
}

interface LiveEventData {
  event: {
    id: string
    title: string
    state: string
    startsAt: string
    endsAt: string
    timeRemainingMs: number
    missionIntervalMinutes: number
    template: string
  }
  myMissions: LiveMission[]
  participants: ParticipantActivity[]
  hostData: {
    completionRates: { userId: string; total: number; completed: number }[]
  } | null
  pollHint: { intervalMs: number }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchLiveEvent(id: string): Promise<LiveEventData> {
  const res = await apiClient.get(`/events/${id}/live`)
  return res.data as LiveEventData
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs)
  useEffect(() => {
    setRemaining(targetMs)
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetMs])
  return remaining
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ─── Live pulse dot ───────────────────────────────────────────────────────────

function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start()
  }, [scale])
  return (
    <View style={ld.wrap}>
      <Animated.View style={[ld.ring, { transform: [{ scale }] }]} />
      <View style={ld.dot} />
    </View>
  )
}

const ld = StyleSheet.create({
  wrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
    opacity: 0.35,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error },
})

// ─── Mission Card ─────────────────────────────────────────────────────────────

function MissionCard({
  mission,
  onComplete,
}: {
  mission: LiveMission | null
  onComplete: (id: string) => void
}) {
  const timeUntilExpiry = useCountdown(
    mission ? Math.max(0, new Date(mission.expiresAt).getTime() - Date.now()) : 0,
  )

  if (!mission) {
    return (
      <View style={mc.card}>
        <View style={mc.glowOrb} />
        <Text style={mc.waitEmoji}>⌛</Text>
        <Text style={mc.waitTitle}>Waiting for your next mission...</Text>
        <Text style={mc.waitHint}>Missions arrive on a timer</Text>
      </View>
    )
  }

  if (mission.hasSubmission || mission.status === 'completed') {
    return (
      <View style={[mc.card, mc.completedCard]}>
        <View style={[mc.glowOrb, mc.glowGreen]} />
        <Text style={mc.waitEmoji}>✅</Text>
        <Text style={[mc.waitTitle, { color: colors.success }]}>Mission complete!</Text>
        <Text style={mc.completedName} numberOfLines={2}>
          {mission.isSecret ? '🔒 Secret mission' : mission.mission.title}
        </Text>
        <Text style={mc.waitHint}>Next mission incoming...</Text>
      </View>
    )
  }

  if (mission.status === 'expired') {
    return (
      <View style={[mc.card, { opacity: 0.6 }]}>
        <Text style={mc.waitEmoji}>💨</Text>
        <Text style={mc.waitTitle}>Missed that one</Text>
        <Text style={mc.waitHint}>Next mission on its way</Text>
      </View>
    )
  }

  const isExpiringSoon = timeUntilExpiry < 3 * 60_000
  const isSecret = mission.isSecret

  return (
    <View style={[mc.card, isSecret && mc.secretCard]}>
      <View style={[mc.glowOrb, isSecret && mc.glowSecret]} />

      {isSecret && (
        <View style={mc.secretBanner}>
          <Text style={mc.secretBannerText}>🔒 Shhh... Secret Mission</Text>
        </View>
      )}

      <View style={mc.headerRow}>
        <View style={mc.mediaTag}>
          <Text style={mc.mediaTagText}>
            {mission.mission.mediaType === 'photo' ? '📸 Photo' :
             mission.mission.mediaType === 'video' ? '🎥 Video' : '✨ Any'}
          </Text>
        </View>
        <View style={[mc.timerBadge, isExpiringSoon && mc.timerBadgeUrgent]}>
          <Text style={[mc.timerText, isExpiringSoon && mc.timerTextUrgent]}>
            {formatTime(timeUntilExpiry)}
          </Text>
        </View>
      </View>

      <Text style={[mc.title, isSecret && mc.secretTitle]}>
        {isSecret ? '???' : mission.mission.title}
      </Text>

      {!isSecret && mission.mission.description !== mission.mission.title && (
        <Text style={mc.desc}>{mission.mission.description}</Text>
      )}

      {!isSecret && mission.mission.intensity > 0 && (
        <View style={mc.intensityRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              style={[mc.intensityDot, i < mission.mission.intensity && mc.intensityDotFilled]}
            />
          ))}
          <Text style={mc.intensityLabel}>intensity</Text>
        </View>
      )}

      <TouchableOpacity
        style={[mc.btn, isSecret && mc.btnSecret]}
        onPress={() => onComplete(mission.assignmentId)}
        activeOpacity={0.85}
      >
        <Text style={mc.btnText}>Complete Mission →</Text>
      </TouchableOpacity>
    </View>
  )
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  glowOrb: {
    position: 'absolute',
    right: -50,
    bottom: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  glowGreen: { backgroundColor: colors.success },
  glowSecret: { backgroundColor: colors.secret },
  completedCard: { borderColor: colors.success },
  secretCard: { borderColor: colors.secret, backgroundColor: 'rgba(168, 85, 247, 0.08)' },
  waitEmoji: { fontSize: 44, textAlign: 'center', marginTop: spacing.md },
  waitTitle: { ...typography.heading3, color: colors.textSecondary, textAlign: 'center' },
  waitHint: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
  completedName: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  secretBanner: {
    backgroundColor: colors.secret,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  secretBannerText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mediaTag: {
    backgroundColor: colors.bgHighest,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  mediaTagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  timerBadge: {
    backgroundColor: colors.bgHighest,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerBadgeUrgent: { backgroundColor: colors.error, borderColor: colors.error },
  timerText: { color: colors.textSecondary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#fff' },
  title: { ...typography.heading2, color: colors.text, lineHeight: 30 },
  secretTitle: { color: colors.secret, textAlign: 'center', fontSize: 32 },
  desc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  intensityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgHighest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityDotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  intensityLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '600', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    ...shadows.glow,
  },
  btnSecret: { backgroundColor: colors.secret, shadowColor: colors.secret },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
})

// ─── Participant strip ────────────────────────────────────────────────────────

function ParticipantStrip({
  participants,
  currentUserId,
}: {
  participants: ParticipantActivity[]
  currentUserId: string | undefined
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ps.row}>
      {participants.map((p) => (
        <View key={p.userId} style={ps.item}>
          <View style={[
            ps.avatar,
            p.isOnline && ps.avatarOnline,
            p.userId === currentUserId && ps.avatarSelf,
          ]}>
            <Text style={ps.avatarText}>{p.displayName[0]?.toUpperCase() ?? '?'}</Text>
            {p.submissionCount > 0 && (
              <View style={ps.badge}>
                <Text style={ps.badgeText}>{p.submissionCount}</Text>
              </View>
            )}
          </View>
          <Text style={ps.name} numberOfLines={1}>{p.displayName.split(' ')[0]}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const ps = StyleSheet.create({
  row: { gap: spacing.md, paddingRight: spacing.lg },
  item: { alignItems: 'center', gap: 5, width: 48 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgHighest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarOnline: { borderColor: colors.success },
  avatarSelf: { borderColor: colors.primary },
  avatarText: { color: colors.textSecondary, fontSize: 16, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: colors.bg, fontSize: 9, fontWeight: '900' },
  name: { color: colors.textTertiary, fontSize: 10, fontWeight: '600', textAlign: 'center' },
})

// ─── Host Panel ───────────────────────────────────────────────────────────────

function HostPanel({ data, eventId }: { data: LiveEventData['hostData']; eventId: string }) {
  const qc = useQueryClient()
  const triggerMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/events/${eventId}/missions/trigger`)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['live', eventId] })
      Alert.alert('Done!', 'Group mission triggered for all participants.')
    },
    onError: () => Alert.alert('Error', 'Failed to trigger group mission.'),
  })

  if (!data) return null

  const rates = data.completionRates
  const total = rates.reduce((sum, r) => sum + r.total, 0)
  const completed = rates.reduce((sum, r) => sum + r.completed, 0)
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <View style={hp.panel}>
      <View style={hp.headerRow}>
        <Text style={hp.title}>HOST</Text>
        <Text style={hp.stat}>{pct}% complete ({completed}/{total})</Text>
      </View>
      <View style={hp.progressTrack}>
        <View style={[hp.progressFill, { width: `${pct}%` as any }]} />
      </View>
      <TouchableOpacity
        style={[hp.btn, triggerMutation.isPending && hp.btnDisabled]}
        onPress={() => triggerMutation.mutate()}
        disabled={triggerMutation.isPending}
      >
        {triggerMutation.isPending ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : (
          <Text style={hp.btnText}>⚡ Trigger Group Mission</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const hp = StyleSheet.create({
  panel: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(204, 151, 255, 0.25)',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  stat: { color: colors.textSecondary, fontSize: 13 },
  progressTrack: { height: 4, backgroundColor: colors.bgHighest, borderRadius: borderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: borderRadius.full },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  btnText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LiveEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const userId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  const pollIntervalRef = useRef(30_000)

  const { data, isLoading, isError, isPending } = useQuery({
    queryKey: ['live', id],
    queryFn: () => fetchLiveEvent(id!),
    enabled: !!id,
    refetchInterval: () => pollIntervalRef.current,
  })

  useEffect(() => {
    if (data?.pollHint?.intervalMs) {
      pollIntervalRef.current = data.pollHint.intervalMs
    }
  }, [data?.pollHint?.intervalMs])

  useEffect(() => {
    const state = data?.event.state
    if (state === 'completed' || state === 'archived') {
      router.replace(`/(app)/events/${id}/reveal` as never)
    }
    if (state === 'scheduled' || state === 'draft') {
      router.replace(`/(app)/events/${id}/lobby` as never)
    }
  }, [data?.event.state])

  const eventTimeRemaining = useCountdown(data?.event.timeRemainingMs ?? 0)

  if (isLoading || isPending) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (isError && !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.centered}>
          <Text style={s.errorText}>Failed to load event.</Text>
          <TouchableOpacity
            onPress={() => qc.invalidateQueries({ queryKey: ['live', id] })}
            style={s.retryBtn}
          >
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const activeMission =
    data.myMissions.find((m) => m.status === 'active' && !m.hasSubmission) ??
    data.myMissions[0] ??
    null

  function handleCompleteMission(assignmentId: string) {
    const mediaType = activeMission?.mission.mediaType ?? 'any'
    router.push(
      `/(app)/events/${id}/camera?assignmentId=${assignmentId}&mediaType=${mediaType}&eventId=${id}` as never,
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {isError && data && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>📡 Reconnecting...</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.eventTitle} numberOfLines={1}>{data.event.title}</Text>
          <View style={s.liveRow}>
            <LiveDot />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={s.timerBlock}>
          <Text style={s.timerLabel}>ends in</Text>
          <Text style={s.timer}>{formatTime(eventTimeRemaining)}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <MissionCard mission={activeMission} onComplete={handleCompleteMission} />

        {data.myMissions.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>My missions</Text>
            {data.myMissions.slice(1).map((m) => (
              <View key={m.assignmentId} style={s.historyRow}>
                <Text style={[
                  s.historyIcon,
                  m.status === 'completed' ? { color: colors.success } :
                  m.status === 'expired' ? { color: colors.textTertiary } :
                  { color: colors.primary },
                ]}>
                  {m.status === 'completed' ? '✅' : m.status === 'expired' ? '💨' : '•'}
                </Text>
                <Text style={s.historyTitle} numberOfLines={1}>
                  {m.isSecret ? '🔒 Secret mission' : m.mission.title}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Participants ({data.participants.length})</Text>
          <ParticipantStrip participants={data.participants} currentUserId={userId} />
        </View>

        <TouchableOpacity
          style={s.feedBtn}
          onPress={() => router.push(`/(app)/events/${id}/feed` as never)}
          activeOpacity={0.8}
        >
          <Text style={s.feedBtnText}>View Feed ✨</Text>
        </TouchableOpacity>

        <View style={s.lockedBanner}>
          <Text style={s.lockedText}>🔒 Mission creation locked during live event</Text>
        </View>

        {data.hostData && <HostPanel data={data.hostData} eventId={id!} />}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.error },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  retryText: { color: colors.primary, fontSize: 15 },
  offlineBanner: {
    backgroundColor: colors.bgHighest,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offlineText: { ...typography.label, color: colors.textSecondary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 22, fontWeight: '400' },
  topCenter: { flex: 1, alignItems: 'center', gap: 2 },
  eventTitle: { ...typography.heading3, color: colors.text, fontSize: 17, textAlign: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveText: { color: colors.error, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  timerBlock: { alignItems: 'flex-end' },
  timerLabel: { color: colors.textTertiary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  timer: { fontSize: 22, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  historyIcon: { width: 22, textAlign: 'center', fontSize: 14 },
  historyTitle: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  feedBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
  },
  feedBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lockedBanner: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  lockedText: { color: colors.textTertiary, fontSize: 12 },
})
