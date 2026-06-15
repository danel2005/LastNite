import { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

interface AdminAssignment {
  id: string
  status: string
  isSecret: boolean
  assignedAt: string
  user: { profile: { displayName: string } | null }
  submission: { assets: unknown[] } | null
}

interface AdminMissionInstance {
  id: string
  isFinale: boolean
  definition: {
    title: string
    category: string
    mediaType: string
    intensity: number
    isSocial: boolean
    defaultIsSecret: boolean
  }
  assignments: AdminAssignment[]
}

interface AdminEvent {
  id: string
  title: string
  state: string
  template: string
  startsAt: string
  endsAt: string
  inviteCode: string
  host: { profile: { displayName: string } | null }
  participants: unknown[]
  missionInstances: AdminMissionInstance[]
}

async function fetchAdminEvents(): Promise<AdminEvent[]> {
  const res = await apiClient.get('/admin/events')
  return (res.data as { events: AdminEvent[] }).events
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminScreen() {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-events'],
    queryFn: fetchAdminEvents,
  })

  const events = data ?? []
  const selected = useMemo(
    () => events.find((event) => event.id === expandedEventId) ?? events[0],
    [events, expandedEventId],
  )

  if (isLoading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.title}>Admin unavailable</Text>
        <TouchableOpacity style={s.primaryButton} onPress={() => refetch()}>
          <Text style={s.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Admin Console</Text>
        <Text style={s.subtitle}>Events, missions, assignments, and submissions.</Text>

        {events.map((event) => {
          const active = selected?.id === event.id
          return (
            <TouchableOpacity
              key={event.id}
              style={[s.eventCard, active && s.eventCardActive]}
              onPress={() => setExpandedEventId(event.id)}
            >
              <View style={s.eventTop}>
                <Text style={s.eventTitle}>{event.title}</Text>
                <Text style={s.state}>{event.state}</Text>
              </View>
              <Text style={s.meta}>
                {formatDate(event.startsAt)} - {formatDate(event.endsAt)}
              </Text>
              <Text style={s.meta}>
                {event.participants.length} participants / {event.missionInstances.length} missions / code {event.inviteCode}
              </Text>
            </TouchableOpacity>
          )
        })}

        {selected && (
          <View style={s.detail}>
            <Text style={s.sectionTitle}>{selected.title}</Text>
            {selected.missionInstances.length === 0 ? (
              <Text style={s.empty}>No mission instances yet.</Text>
            ) : (
              selected.missionInstances.map((mission) => (
                <View key={mission.id} style={s.missionCard}>
                  <View style={s.eventTop}>
                    <Text style={s.missionTitle}>{mission.definition.title}</Text>
                    <Text style={s.pill}>{mission.definition.mediaType}</Text>
                  </View>
                  <Text style={s.meta}>
                    {mission.definition.category} / intensity {mission.definition.intensity}
                    {mission.definition.isSocial ? ' / social' : ''}
                    {mission.definition.defaultIsSecret ? ' / secret' : ''}
                  </Text>

                  {mission.assignments.length === 0 ? (
                    <Text style={s.emptySmall}>No assignments yet.</Text>
                  ) : (
                    mission.assignments.map((assignment) => (
                      <View key={assignment.id} style={s.assignmentRow}>
                        <Text style={s.assignmentName}>
                          {assignment.user.profile?.displayName ?? 'Unknown'}
                        </Text>
                        <Text style={s.assignmentMeta}>
                          {assignment.status}
                          {assignment.isSecret ? ' / secret' : ''}
                          {assignment.submission ? ` / ${assignment.submission.assets.length} assets` : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.heading2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  eventCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  eventCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  eventTitle: { ...typography.body, color: colors.text, fontWeight: '800', flex: 1 },
  state: { ...typography.label, color: colors.primary },
  meta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  detail: { marginTop: spacing.lg },
  sectionTitle: { ...typography.heading3, color: colors.text, marginBottom: spacing.md },
  missionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  missionTitle: { ...typography.body, color: colors.text, fontWeight: '800', flex: 1 },
  pill: {
    ...typography.label,
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  assignmentRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  assignmentName: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  assignmentMeta: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textSecondary },
  emptySmall: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.sm },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: { color: colors.bg, fontWeight: '800' },
})
