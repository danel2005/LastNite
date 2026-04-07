/**
 * Events Tab — matching the Events_Page UI design.
 *
 * Sections:
 *   1. Live Now — featured full-width spotlight card for the live event
 *   2. Upcoming — grid cards for scheduled events
 *   3. Past Memories — horizontal scroll of completed events (greyed, hover reveals)
 */

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import type { Event } from '@lastnite/shared'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchMyEvents(): Promise<Event[]> {
  const res = await apiClient.get('/events')
  return (res.data as { events: Event[] }).events ?? []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEMPLATE_EMOJI: Record<string, string> = {
  house_party:           '🏠',
  night_out:             '🌃',
  birthday:              '🎂',
  bachelor_bachelorette: '💍',
  trip:                  '✈️',
  festival:              '🎪',
  trek:                  '🥾',
  ski:                   '⛷️',
  wedding:               '💒',
  costume_party:         '🎭',
}

const TEMPLATE_VIBE: Record<string, string> = {
  house_party:           'House Party',
  night_out:             'Night Out',
  birthday:              'Birthday',
  bachelor_bachelorette: 'Bachelor/ette',
  trip:                  'Trip',
  festival:              'Festival',
  trek:                  'Trek',
  ski:                   'Ski Trip',
  wedding:               'Wedding',
  costume_party:         'Costume Party',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function navigateToEvent(event: Event) {
  if (event.state === 'scheduled' || event.state === 'draft') {
    router.push(`/(app)/events/${event.id}/lobby` as never)
  } else {
    router.push(`/(app)/events/${event.id}/` as never)
  }
}

// ─── LiveSpotlight card ────────────────────────────────────────────────────────

function LiveSpotlightCard({ event }: { event: Event }) {
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'
  const vibe = TEMPLATE_VIBE[event.template] ?? 'Event'

  return (
    <TouchableOpacity
      style={live.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.88}
    >
      {/* Background glow */}
      <View style={live.glowTop} />
      <View style={live.glowBottom} />

      {/* Big emoji hero */}
      <View style={live.heroEmoji}>
        <Text style={live.heroEmojiText}>{emoji}</Text>
      </View>

      {/* Overlay content */}
      <View style={live.overlay}>
        <View style={live.topRow}>
          <View style={live.livePill}>
            <View style={live.liveDot} />
            <Text style={live.livePillText}>LIVE</Text>
          </View>
          <View style={live.vibePill}>
            <Text style={live.vibePillText}>{vibe}</Text>
          </View>
        </View>

        <View style={live.body}>
          <Text style={live.title} numberOfLines={2}>{event.title}</Text>
          <TouchableOpacity
            style={live.joinBtn}
            onPress={() => navigateToEvent(event)}
            activeOpacity={0.85}
          >
            <Text style={live.joinBtnText}>Enter Event →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const live = StyleSheet.create({
  card: {
    height: 340,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.glowFuchsia,
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primary,
    opacity: 0.12,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accent,
    opacity: 0.1,
  },
  heroEmoji: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(204, 151, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmojiText: { fontSize: 64 },
  overlay: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', gap: spacing.sm },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 110, 132, 0.18)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 132, 0.35)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.error },
  livePillText: { color: colors.error, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  vibePill: {
    backgroundColor: 'rgba(204, 151, 255, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(204, 151, 255, 0.25)',
  },
  vibePillText: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  body: { gap: spacing.md },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    maxWidth: '70%',
  },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
    ...shadows.glow,
  },
  joinBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
})

// ─── Upcoming card ─────────────────────────────────────────────────────────────

function UpcomingCard({ event }: { event: Event }) {
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'
  const vibe = TEMPLATE_VIBE[event.template] ?? 'Event'

  return (
    <TouchableOpacity
      style={upcoming.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.85}
    >
      {/* Emoji hero box */}
      <View style={upcoming.emojiBox}>
        <Text style={upcoming.emojiText}>{emoji}</Text>
        <View style={upcoming.glowOrb} />
      </View>

      {/* Card body */}
      <View style={upcoming.body}>
        <View style={upcoming.vibePill}>
          <Text style={upcoming.vibePillText}>{vibe.toUpperCase()}</Text>
        </View>
        <Text style={upcoming.title} numberOfLines={2}>{event.title}</Text>
        <View style={upcoming.dateRow}>
          <Text style={upcoming.dateNum}>
            {new Date(event.startsAt).getDate()}
          </Text>
          <Text style={upcoming.dateMon}>
            {new Date(event.startsAt).toLocaleString('default', { month: 'short' }).toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const CARD_W = (SCREEN_W - spacing.lg * 2 - spacing.md) / 2

const upcoming = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  emojiBox: {
    height: 120,
    backgroundColor: colors.bgHighest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emojiText: { fontSize: 56 },
  glowOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  body: { padding: spacing.md, gap: spacing.xs },
  vibePill: {
    backgroundColor: 'rgba(204, 151, 255, 0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  vibePillText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { ...typography.heading3, color: colors.text, fontSize: 15, lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: spacing.xs },
  dateNum: { color: colors.primary, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  dateMon: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingBottom: 2 },
})

// ─── Past memory card (horizontal scroll) ────────────────────────────────────

function PastCard({ event }: { event: Event }) {
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'

  return (
    <TouchableOpacity
      style={past.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.85}
    >
      <View style={past.emojiBox}>
        <Text style={past.emojiText}>{emoji}</Text>
      </View>
      <View style={past.endedPill}>
        <Text style={past.endedText}>ENDED</Text>
      </View>
      <View style={past.bottom}>
        <Text style={past.title} numberOfLines={1}>{event.title}</Text>
        <Text style={past.date}>{formatDate(event.startsAt)}</Text>
      </View>
    </TouchableOpacity>
  )
}

const past = StyleSheet.create({
  card: {
    width: 200,
    height: 240,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  emojiBox: {
    flex: 1,
    backgroundColor: colors.bgHighest,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  emojiText: { fontSize: 64 },
  endedPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(37, 35, 59, 0.85)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  endedText: { color: colors.textTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  bottom: {
    padding: spacing.md,
    gap: 3,
    backgroundColor: colors.bgElevated,
  },
  title: { ...typography.heading3, color: colors.text, fontSize: 14 },
  date: { ...typography.bodySmall, color: colors.textTertiary, fontSize: 12 },
})

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sec.row}>
      <Text style={sec.label}>{text}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={sec.action}>{action} →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const sec = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  action: { color: colors.primary, fontSize: 13, fontWeight: '700' },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const now = Date.now()
  const { data: events, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['events'],
    queryFn: fetchMyEvents,
    refetchInterval: 30_000,
  })

  const liveEvents = events?.filter((e) => ['live', 'ending'].includes(e.state)) ?? []
  const upcomingEvents = events?.filter((e) =>
    ['scheduled', 'draft'].includes(e.state) && new Date(e.endsAt).getTime() > now
  ) ?? []
  const pastEvents = events?.filter((e) =>
    ['completed', 'archived', 'cancelled', 'processing'].includes(e.state) ||
    (['scheduled', 'draft'].includes(e.state) && new Date(e.endsAt).getTime() <= now)
  ) ?? []

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Events</Text>
        <TouchableOpacity
          style={s.newBtn}
          onPress={() => router.push('/(app)/events/create' as never)}
          activeOpacity={0.85}
        >
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : isError && !events ? (
          <View style={s.errorWrap}>
            <Text style={s.errorText}>Couldn't load events</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Live Now */}
            {liveEvents.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeaderRow}>
                  <SectionLabel text="Live Now" />
                  <View style={s.liveIndicator}>
                    <View style={s.liveDot} />
                    <Text style={s.liveIndicatorText}>LIVE</Text>
                  </View>
                </View>
                {liveEvents.map((e) => (
                  <LiveSpotlightCard key={e.id} event={e} />
                ))}
              </View>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <View style={s.section}>
                <SectionLabel text="Upcoming" />
                <View style={s.grid}>
                  {upcomingEvents
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                    .map((e) => <UpcomingCard key={e.id} event={e} />)
                  }
                </View>
              </View>
            )}

            {/* Past Memories */}
            {pastEvents.length > 0 && (
              <View style={s.section}>
                <SectionLabel text="Past Memories" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.pastScroll}
                >
                  {pastEvents
                    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                    .map((e) => <PastCard key={e.id} event={e} />)
                  }
                </ScrollView>
              </View>
            )}

            {/* Empty state */}
            {events?.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>🎟</Text>
                <Text style={s.emptyTitle}>No events yet</Text>
                <Text style={s.emptyBody}>Create a new event or join one with an invite code.</Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push('/(app)/events/create' as never)}
                  activeOpacity={0.85}
                >
                  <Text style={s.emptyBtnText}>+ Create Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  newBtnText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 110, 132, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 132, 0.3)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.error },
  liveIndicatorText: { color: colors.error, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pastScroll: { gap: spacing.md, paddingRight: spacing.lg },
  errorWrap: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.primary },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.sm },
  emptyTitle: { ...typography.heading2, color: colors.text },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  emptyBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
})
