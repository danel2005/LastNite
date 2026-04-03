/**
 * Live Event Dashboard
 *
 * The main screen during a live event. Shows:
 *   - Mission card (current active mission or waiting state)
 *   - Time remaining in event
 *   - Participant activity dots
 *   - Recent feed preview strip
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
} from 'react-native'
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

// ─── Mission Card ─────────────────────────────────────────────────────────────

function MissionCard({ mission, onComplete }: { mission: LiveMission | null; onComplete: (id: string) => void }) {
  const timeUntilExpiry = useCountdown(
    mission ? Math.max(0, new Date(mission.expiresAt).getTime() - Date.now()) : 0,
  )

  if (!mission) {
    return (
      <View style={[missionStyles.card, missionStyles.waitingCard]}>
        <Text style={missionStyles.waitingEmoji}>⌛</Text>
        <Text style={missionStyles.waitingTitle}>Waiting for your next mission...</Text>
        <Text style={missionStyles.waitingHint}>Missions arrive every {30} minutes</Text>
      </View>
    )
  }

  if (mission.hasSubmission || mission.status === 'completed') {
    return (
      <View style={[missionStyles.card, missionStyles.completedCard]}>
        <Text style={missionStyles.completedEmoji}>✅</Text>
        <Text style={missionStyles.completedTitle}>Mission complete!</Text>
        <Text style={missionStyles.completedMission} numberOfLines={2}>
          {mission.isSecret ? '🔒 Secret mission' : mission.mission.title}
        </Text>
        <Text style={missionStyles.waitingHint}>Next mission coming...</Text>
      </View>
    )
  }

  if (mission.status === 'expired') {
    return (
      <View style={[missionStyles.card, missionStyles.expiredCard]}>
        <Text style={missionStyles.completedEmoji}>💨</Text>
        <Text style={missionStyles.completedTitle}>Missed that one</Text>
        <Text style={missionStyles.waitingHint}>Next mission on its way</Text>
      </View>
    )
  }

  const isExpiringSoon = timeUntilExpiry < 3 * 60_000 // < 3min
  const isSecret = mission.isSecret

  return (
    <View style={[missionStyles.card, isSecret && missionStyles.secretCard]}>
      {isSecret && (
        <View style={missionStyles.secretBanner}>
          <Text style={missionStyles.secretBannerText}>🔒 Shhh... this is a secret mission!</Text>
        </View>
      )}

      <View style={missionStyles.cardHeader}>
        <Text style={missionStyles.mediaTypeTag}>
          {mission.mission.mediaType === 'photo' ? '📸 Photo' :
           mission.mission.mediaType === 'video' ? '🎥 Video' : '✨ Photo or Video'}
        </Text>
        <View style={[missionStyles.timerBadge, isExpiringSoon && missionStyles.timerBadgeUrgent]}>
          <Text style={[missionStyles.timerText, isExpiringSoon && missionStyles.timerTextUrgent]}>
            {formatTime(timeUntilExpiry)}
          </Text>
        </View>
      </View>

      <Text style={[missionStyles.missionTitle, isSecret && missionStyles.secretTitle]}>
        {isSecret ? '???' : mission.mission.title}
      </Text>

      {!isSecret && mission.mission.description !== mission.mission.title && (
        <Text style={missionStyles.missionDesc}>{mission.mission.description}</Text>
      )}

      <TouchableOpacity
        style={[missionStyles.completeBtn, isSecret && missionStyles.completeBtnSecret]}
        onPress={() => onComplete(mission.assignmentId)}
        activeOpacity={0.85}
      >
        <Text style={missionStyles.completeBtnText}>Complete Mission →</Text>
      </TouchableOpacity>
    </View>
  )
}

const missionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  secretCard: {
    borderColor: colors.secret,
    backgroundColor: colors.secretSubtle,
  },
  completedCard: {
    alignItems: 'center',
    borderColor: colors.success,
    paddingVertical: spacing.xl,
  },
  expiredCard: {
    alignItems: 'center',
    opacity: 0.6,
    paddingVertical: spacing.xl,
  },
  waitingEmoji: { fontSize: 40, marginBottom: spacing.sm },
  waitingTitle: { ...typography.heading3, color: colors.textSecondary, textAlign: 'center' },
  waitingHint: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
  completedEmoji: { fontSize: 40, marginBottom: spacing.sm },
  completedTitle: { ...typography.heading3, color: colors.success },
  completedMission: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  secretBanner: {
    backgroundColor: colors.secret,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  secretBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaTypeTag: {
    ...typography.label,
    color: colors.textSecondary,
  },
  timerBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  timerBadgeUrgent: { backgroundColor: colors.error },
  timerText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#FFFFFF' },
  missionTitle: { ...typography.heading2, color: colors.text },
  secretTitle: { color: colors.secret, fontSize: 28, textAlign: 'center', paddingVertical: spacing.md },
  missionDesc: { ...typography.body, color: colors.textSecondary },
  completeBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  completeBtnSecret: { backgroundColor: colors.secret },
  completeBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
})

// ─── Activity Dots ────────────────────────────────────────────────────────────

function ActivityDots({ participants, currentUserId }: { participants: ParticipantActivity[]; currentUserId: string | undefined }) {
  return (
    <View style={activityStyles.row}>
      {participants.map((p) => (
        <View key={p.userId} style={activityStyles.dot}>
          <View style={[
            activityStyles.avatar,
            p.isOnline && activityStyles.avatarOnline,
            p.userId === currentUserId && activityStyles.avatarSelf,
          ]}>
            <Text style={activityStyles.avatarText}>
              {p.displayName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          {p.submissionCount > 0 && (
            <Text style={activityStyles.count}>{p.submissionCount}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

const activityStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dot: { alignItems: 'center', gap: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarOnline: { borderColor: colors.success },
  avatarSelf: { borderColor: colors.accent },
  avatarText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  count: { ...typography.label, color: colors.accent, fontSize: 10 },
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
    <View style={hostStyles.panel}>
      <Text style={hostStyles.title}>Host View</Text>
      <Text style={hostStyles.stat}>Overall completion: {pct}% ({completed}/{total})</Text>
      <TouchableOpacity
        style={[hostStyles.triggerButton, triggerMutation.isPending && hostStyles.disabled]}
        onPress={() => triggerMutation.mutate()}
        disabled={triggerMutation.isPending}
      >
        {triggerMutation.isPending ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : (
          <Text style={hostStyles.triggerText}>⚡ Trigger group mission</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const hostStyles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentSubtle,
  },
  title: { ...typography.label, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1 },
  stat: { ...typography.body, color: colors.textSecondary },
  triggerButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  triggerText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LiveEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const userId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  const pollIntervalRef = useRef(30_000)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['live', id],
    queryFn: () => fetchLiveEvent(id!),
    enabled: !!id,
    refetchInterval: () => pollIntervalRef.current,
  })

  // Update poll interval based on server hint
  useEffect(() => {
    if (data?.pollHint?.intervalMs) {
      pollIntervalRef.current = data.pollHint.intervalMs
    }
  }, [data?.pollHint?.intervalMs])

  // Redirect if event state changes
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

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Failed to load event.</Text>
        <TouchableOpacity onPress={() => qc.invalidateQueries({ queryKey: ['live', id] })}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Pick the most relevant active mission (newest non-completed)
  const activeMission = data.myMissions.find(
    (m) => m.status === 'active' && !m.hasSubmission,
  ) ?? data.myMissions[0] ?? null

  function handleCompleteMission(assignmentId: string) {
    const mediaType = activeMission?.mission.mediaType ?? 'any'
    router.push(
      `/(app)/events/${id}/camera?assignmentId=${assignmentId}&mediaType=${mediaType}&eventId=${id}` as never,
    )
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Event title + time remaining */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <Text style={s.eventTitle} numberOfLines={1}>{data.event.title}</Text>
          <Text style={s.liveTag}>● LIVE</Text>
        </View>
        <View style={s.timerBlock}>
          <Text style={s.timerLabel}>ends in</Text>
          <Text style={s.timer}>{formatTime(eventTimeRemaining)}</Text>
        </View>
      </View>

      {/* Mission card */}
      <MissionCard mission={activeMission} onComplete={handleCompleteMission} />

      {/* My mission history (completed/expired ones) */}
      {data.myMissions.length > 1 && (
        <View style={s.missionHistory}>
          <Text style={s.sectionLabel}>My missions</Text>
          {data.myMissions.slice(1).map((m) => (
            <View key={m.assignmentId} style={s.historyItem}>
              <Text style={[s.historyStatus,
                m.status === 'completed' ? { color: colors.success } :
                m.status === 'expired' ? { color: colors.textTertiary } :
                { color: colors.accent }
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

      {/* Activity dots */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Participants ({data.participants.length})</Text>
        <ActivityDots participants={data.participants} currentUserId={userId} />
      </View>

      {/* Feed preview CTA */}
      <TouchableOpacity
        style={s.feedButton}
        onPress={() => router.push(`/(app)/events/${id}/feed` as never)}
        activeOpacity={0.8}
      >
        <Text style={s.feedButtonText}>View feed →</Text>
      </TouchableOpacity>

      {/* Custom mission button */}
      <TouchableOpacity
        style={s.customMissionButton}
        onPress={() => router.push(`/(app)/events/${id}/create-mission` as never)}
        activeOpacity={0.8}
      >
        <Text style={s.customMissionText}>+ Create custom mission</Text>
      </TouchableOpacity>

      {/* Host panel */}
      {data.hostData && <HostPanel data={data.hostData} eventId={id!} />}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.accent },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  topBarLeft: { flex: 1, gap: 3 },
  eventTitle: { ...typography.heading2, color: colors.text },
  liveTag: { ...typography.label, color: colors.success, fontWeight: '800' },
  timerBlock: { alignItems: 'flex-end' },
  timerLabel: { ...typography.label, color: colors.textTertiary, textTransform: 'uppercase' },
  timer: { fontSize: 26, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  missionHistory: { gap: spacing.xs },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  historyStatus: { width: 20, textAlign: 'center' },
  historyTitle: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  feedButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  feedButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  customMissionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  customMissionText: { color: colors.textSecondary, fontSize: 14 },
})
