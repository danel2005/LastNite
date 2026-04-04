import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { Event } from '@lastnite/shared'

// The API returns Prisma-shaped participants with user.profile nested
interface ApiParticipant {
  id: string
  eventId: string
  userId: string
  isHost: boolean
  joinedAt: string
  removedAt: string | null
  user: { profile: { displayName: string; avatarUrl: string | null } | null }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchEvent(id: string): Promise<Event> {
  const res = await apiClient.get(`/events/${id}`)
  return (res.data as { event: Event }).event
}

async function fetchParticipants(id: string): Promise<ApiParticipant[]> {
  const res = await apiClient.get(`/events/${id}/participants`)
  return (res.data as { participants: ApiParticipant[] }).participants ?? []
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(targetMs: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, targetMs - now)
}

function pad(n: number) { return n.toString().padStart(2, '0') }

function CountdownDisplay({ startsAt }: { startsAt: string }) {
  const ms = useCountdown(new Date(startsAt).getTime())
  if (ms === 0) return <Text style={styles.countdown}>Starting now!</Text>

  const totalSec = Math.floor(ms / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60

  if (days > 0) {
    return (
      <View style={styles.countdownRow}>
        <View style={styles.countdownUnit}>
          <Text style={styles.countdown}>{days}</Text>
          <Text style={styles.countdownUnitLabel}>days</Text>
        </View>
        <Text style={styles.countdownColon}>:</Text>
        <View style={styles.countdownUnit}>
          <Text style={styles.countdown}>{pad(hours)}</Text>
          <Text style={styles.countdownUnitLabel}>hours</Text>
        </View>
        <Text style={styles.countdownColon}>:</Text>
        <View style={styles.countdownUnit}>
          <Text style={styles.countdown}>{pad(mins)}</Text>
          <Text style={styles.countdownUnitLabel}>min</Text>
        </View>
        <Text style={styles.countdownColon}>:</Text>
        <View style={styles.countdownUnit}>
          <Text style={styles.countdown}>{pad(secs)}</Text>
          <Text style={styles.countdownUnitLabel}>sec</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.countdownRow}>
      {hours > 0 && (
        <>
          <View style={styles.countdownUnit}>
            <Text style={styles.countdown}>{pad(hours)}</Text>
            <Text style={styles.countdownUnitLabel}>hours</Text>
          </View>
          <Text style={styles.countdownColon}>:</Text>
        </>
      )}
      <View style={styles.countdownUnit}>
        <Text style={styles.countdown}>{pad(mins)}</Text>
        <Text style={styles.countdownUnitLabel}>min</Text>
      </View>
      <Text style={styles.countdownColon}>:</Text>
      <View style={styles.countdownUnit}>
        <Text style={styles.countdown}>{pad(secs)}</Text>
        <Text style={styles.countdownUnitLabel}>sec</Text>
      </View>
    </View>
  )
}

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({ p }: { p: ApiParticipant }) {
  const displayName = p.user.profile?.displayName ?? 'Unknown'
  return (
    <View style={styles.participantRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {displayName[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <Text style={styles.participantName}>{displayName}</Text>
      {p.isHost && <Text style={styles.hostBadge}>HOST</Text>}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const userId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id!),
    refetchInterval: 10_000,
    enabled: !!id,
  })

  const { data: participants } = useQuery({
    queryKey: ['participants', id],
    queryFn: () => fetchParticipants(id!),
    refetchInterval: 10_000,
    enabled: !!id,
  })

  // If event goes live, redirect to the live event screen
  useEffect(() => {
    if (event?.state === 'live' || event?.state === 'ending') {
      router.replace(`/(app)/events/${id}/` as never)
    }
    if (event?.state === 'completed' || event?.state === 'archived') {
      router.replace(`/(app)/events/${id}/reveal` as never)
    }
  }, [event?.state])

  const isHost = participants?.some((p) => p.userId === userId && p.isHost) ?? false

  const startNowMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/events/${id}/start-now`)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['event', id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to start event.'
      Alert.alert('Error', msg)
    },
  })

  if (eventLoading || !event) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  const startsInMs = new Date(event.startsAt).getTime() - Date.now()

  return (
    <View style={styles.root}>
      <FlatList
        data={participants ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventState}>Waiting for event to start</Text>

            {/* Countdown */}
            <View style={styles.countdownCard}>
              <Text style={styles.countdownLabel}>Starts in</Text>
              <CountdownDisplay startsAt={event.startsAt} />
            </View>

            {/* Invite code */}
            <TouchableOpacity
              style={styles.inviteRow}
              onPress={() =>
                Share.share({
                  message: `Join "${event.title}" on LastNite — code: ${event.inviteCode}`,
                })
              }
            >
              <View>
                <Text style={styles.inviteLabel}>Invite code</Text>
                <Text style={styles.inviteCode}>{event.inviteCode}</Text>
              </View>
              <Text style={styles.inviteShare}>Share →</Text>
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>
              Participants ({participants?.length ?? 0})
            </Text>
          </View>
        }
        renderItem={({ item }) => <ParticipantRow p={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.footer}>
            {/* All participants can add missions before the event starts */}
            <TouchableOpacity
              style={styles.createMissionButton}
              onPress={() => router.push(`/(app)/events/${id}/create-mission`)}
            >
              <Text style={styles.createMissionText}>+ Add custom mission</Text>
            </TouchableOpacity>
            <Text style={styles.missionNote}>
              Anyone can add missions now. Editing is locked once the event starts.
            </Text>

            {isHost && startsInMs <= 0 && (
              <TouchableOpacity
                style={[styles.startButton, startNowMutation.isPending && styles.buttonDisabled]}
                onPress={() => startNowMutation.mutate()}
                disabled={startNowMutation.isPending}
              >
                {startNowMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.startText}>Start Event Now</Text>
                )}
              </TouchableOpacity>
            )}

            {!isHost && (
              <Text style={styles.waitingHint}>
                Waiting for the host to start the event...
              </Text>
            )}
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.md },
  eventTitle: { ...typography.heading1, color: colors.text, marginBottom: spacing.xs },
  eventState: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  countdownCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  countdownLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
  countdownRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  countdownUnit: { alignItems: 'center', minWidth: 52 },
  countdown: { fontSize: 48, fontWeight: '900', color: colors.accent, letterSpacing: -2 },
  countdownColon: { fontSize: 40, fontWeight: '900', color: colors.accent, marginBottom: 14, paddingHorizontal: 2 },
  countdownUnitLabel: { ...typography.label, color: colors.textSecondary, fontSize: 10, letterSpacing: 1, marginTop: 2 },
  inviteRow: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  inviteLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  inviteCode: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: 4, marginTop: 2 },
  inviteShare: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  sectionHeader: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  participantName: { ...typography.body, color: colors.text, flex: 1 },
  hostBadge: {
    ...typography.label,
    color: colors.accent,
    backgroundColor: colors.accentSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  separator: { height: 1, backgroundColor: colors.borderSubtle },
  footer: { marginTop: spacing.xl, gap: spacing.sm },
  createMissionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  createMissionText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  startText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  waitingHint: { ...typography.body, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md },
  missionNote: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', marginTop: 4 },
})
