import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import type { Event } from '@lastnite/shared'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchMyEvents(): Promise<Event[]> {
  const res = await apiClient.get('/events')
  return (res.data as { events: Event[] }).events ?? []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Draft',       color: colors.textTertiary },
  scheduled:  { label: 'Scheduled',   color: '#60A5FA' },
  live:       { label: '● LIVE',      color: '#4CAF7D' },
  ending:     { label: 'Ending',      color: colors.warning },
  processing: { label: 'Processing',  color: colors.warning },
  completed:  { label: 'Completed',   color: colors.textSecondary },
  archived:   { label: 'Archived',    color: colors.textTertiary },
  cancelled:  { label: 'Cancelled',   color: colors.error },
}

const TEMPLATE_EMOJI: Record<string, string> = {
  house_party:          '🏠',
  night_out:            '🌃',
  birthday:             '🎂',
  bachelor_bachelorette:'💍',
  trip:                 '✈️',
  festival:             '🎪',
  trek:                 '🥾',
  ski:                  '⛷️',
  wedding:              '💒',
  costume_party:        '🎭',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function navigateToEvent(event: Event) {
  if (event.state === 'scheduled' || event.state === 'draft') {
    router.push(`/(app)/events/${event.id}/lobby`)
  } else {
    router.push(`/(app)/events/${event.id}/`)
  }
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: Event }) {
  const stateInfo = STATE_LABELS[event.state] ?? { label: event.state, color: colors.textSecondary }
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardDate}>{formatDate(event.startsAt)}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.cardState, { color: stateInfo.color }]}>{stateInfo.label}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { data: events, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['events'],
    queryFn: fetchMyEvents,
    refetchInterval: 30_000,
  })

  const upcoming = events?.filter((e) => ['draft', 'scheduled', 'live', 'ending'].includes(e.state)) ?? []
  const past = events?.filter((e) => ['completed', 'archived', 'cancelled', 'processing'].includes(e.state)) ?? []

  return (
    <View style={styles.root}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => router.push('/(app)/events/join')}
          activeOpacity={0.8}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/(app)/events/create')}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>+ New Event</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load events.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...upcoming, ...past]}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            upcoming.length === 0 && past.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌙</Text>
                <Text style={styles.emptyTitle}>No events yet</Text>
                <Text style={styles.emptyBody}>
                  Create a new event or join one with an invite code.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            past.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>Past events</Text>
                {past.map((e) => <EventCard key={e.id} event={e} />)}
              </>
            ) : null
          }
          renderItem={({ item, index }) => {
            const showHeader = index === 0 && upcoming.length > 0
            return (
              <>
                {showHeader && <Text style={styles.sectionHeader}>Upcoming</Text>}
                <EventCard event={item} />
              </>
            )
          }}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  joinButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  joinButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  createButton: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  createButtonText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  cardLeft: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    ...typography.heading3,
    color: colors.text,
    fontSize: 17,
  },
  cardDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardState: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.text,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.heading3,
    color: colors.text,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
})
