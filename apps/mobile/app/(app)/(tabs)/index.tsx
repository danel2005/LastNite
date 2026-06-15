/**
 * Home Tab — Hub screen
 *
 * Based on the Landing_Page UI design: hero identity card, live event
 * spotlight, upcoming events strip, quick-action buttons.
 */

import { useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { Event } from '@lastnite/shared'

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchMyEvents(): Promise<Event[]> {
  const res = await apiClient.get('/events')
  return (res.data as { events: Event[] }).events ?? []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function navigateToEvent(event: Event) {
  if (event.state === 'scheduled' || event.state === 'draft') {
    router.push(`/(app)/events/${event.id}/lobby` as never)
  } else {
    router.push(`/(app)/events/${event.id}/` as never)
  }
}

// ─── Live pulse dot ───────────────────────────────────────────────────────────

function LivePulse() {
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [scale])
  return (
    <View style={pulse.wrap}>
      <Animated.View style={[pulse.ring, { transform: [{ scale }] }]} />
      <View style={pulse.dot} />
    </View>
  )
}

const pulse = StyleSheet.create({
  wrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    opacity: 0.4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
})

// ─── EventSpotlightCard ───────────────────────────────────────────────────────

function EventSpotlightCard({ event }: { event: Event }) {
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'
  const isLive = event.state === 'live' || event.state === 'ending'

  return (
    <TouchableOpacity
      style={spotlight.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.88}
    >
      {/* Glow orb */}
      <View style={spotlight.glowOrb} />

      <View style={spotlight.content}>
        <View style={spotlight.topRow}>
          {isLive ? (
            <View style={spotlight.liveBadge}>
              <LivePulse />
              <Text style={spotlight.liveBadgeText}>LIVE</Text>
            </View>
          ) : (
            <View style={spotlight.upcomingBadge}>
              <Text style={spotlight.upcomingBadgeText}>UPCOMING</Text>
            </View>
          )}
          <Text style={spotlight.emoji}>{emoji}</Text>
        </View>

        <Text style={spotlight.title} numberOfLines={2}>{event.title}</Text>
        <Text style={spotlight.date}>{formatDate(event.startsAt)}</Text>

        <TouchableOpacity
          style={[spotlight.enterBtn, isLive && spotlight.enterBtnLive]}
          onPress={() => navigateToEvent(event)}
          activeOpacity={0.85}
        >
          <Text style={spotlight.enterBtnText}>
            {isLive ? 'Enter Event →' : 'View Lobby →'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const spotlight = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.glow,
  },
  glowOrb: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.07,
  },
  content: { gap: spacing.sm },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 110, 132, 0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 132, 0.3)',
  },
  liveBadgeText: { color: colors.error, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  upcomingBadge: {
    backgroundColor: 'rgba(204, 151, 255, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(204, 151, 255, 0.25)',
  },
  upcomingBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  emoji: { fontSize: 32 },
  title: { ...typography.heading2, color: colors.text, marginTop: spacing.xs },
  date: { ...typography.bodySmall, color: colors.textSecondary },
  enterBtn: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(204, 151, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(204, 151, 255, 0.4)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  enterBtnLive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  enterBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
})

// ─── EventMiniCard ────────────────────────────────────────────────────────────

function EventMiniCard({ event }: { event: Event }) {
  const emoji = TEMPLATE_EMOJI[event.template] ?? '🎉'
  const isCompleted = ['completed', 'archived', 'cancelled'].includes(event.state)

  return (
    <TouchableOpacity
      style={mini.card}
      onPress={() => navigateToEvent(event)}
      activeOpacity={0.8}
    >
      <View style={mini.iconBox}>
        <Text style={mini.emoji}>{emoji}</Text>
      </View>
      <View style={mini.body}>
        <Text style={mini.title} numberOfLines={1}>{event.title}</Text>
        <Text style={mini.sub}>{formatDate(event.startsAt)}</Text>
      </View>
      {isCompleted && (
        <View style={mini.recapBadge}>
          <Text style={mini.recapText}>Recap</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const mini = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  title: { ...typography.heading3, color: colors.text, fontSize: 16 },
  sub: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 13 },
  recapBadge: {
    backgroundColor: 'rgba(204, 151, 255, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  recapText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
})

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={sec.label}>{text}</Text>
}

const sec = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
})

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={empty.wrap}>
      <View style={empty.glowBg} />
      <Text style={empty.moon}>🌙</Text>
      <Text style={empty.title}>Your night starts here</Text>
      <Text style={empty.body}>
        Create an event or join one with an invite code. Missions, memories, reveal.
      </Text>
    </View>
  )
}

const empty = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  glowBg: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
    opacity: 0.04,
    top: 0,
  },
  moon: { fontSize: 64, marginBottom: spacing.sm },
  title: { ...typography.heading2, color: colors.text, textAlign: 'center' },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile)
  const { data: events, isLoading, isError, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: fetchMyEvents,
    refetchInterval: 30_000,
  })

  const now = Date.now()
  const activeEvents = events?.filter((e) =>
    ['live', 'ending'].includes(e.state) ||
    (['scheduled', 'draft'].includes(e.state) && new Date(e.endsAt).getTime() > now)
  ) ?? []
  const pastEvents = events?.filter((e) =>
    ['completed', 'archived', 'cancelled', 'processing'].includes(e.state) ||
    (['scheduled', 'draft'].includes(e.state) && new Date(e.endsAt).getTime() <= now)
  ) ?? []

  // Most relevant event to spotlight (live first, then upcoming)
  const spotlight = activeEvents.find((e) => ['live', 'ending'].includes(e.state))
    ?? activeEvents[0]
    ?? null

  // Remaining active events (exclude spotlight)
  const restActive = activeEvents.filter((e) => e.id !== spotlight?.id)

  const firstName = profile?.displayName?.split(' ')[0] ?? 'there'

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.greeting}>Hey {firstName} 👋</Text>
          <Text style={s.tagline}>Turn any night into a story.</Text>
        </View>
        <TouchableOpacity
          style={s.avatarBtn}
          onPress={() => router.push('/(app)/settings' as never)}
          activeOpacity={0.8}
        >
          <Text style={s.avatarText}>
            {(profile?.displayName?.[0] ?? '?').toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.joinBtn}
            onPress={() => router.push('/(app)/events/join' as never)}
            activeOpacity={0.85}
          >
            <Text style={s.joinBtnText}>Join Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.createBtn}
            onPress={() => router.push('/(app)/events/create' as never)}
            activeOpacity={0.85}
          >
            <Text style={s.createBtnText}>+ New Event</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : isError && !events ? (
          <View style={s.errorWrap}>
            <Text style={s.errorText}>Couldn't load events</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : events?.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Spotlight: top event card */}
            {spotlight && (
              <>
                <SectionLabel text={
                  ['live', 'ending'].includes(spotlight.state) ? '⚡ Happening Now' : '📅 Up Next'
                } />
                <EventSpotlightCard event={spotlight} />
              </>
            )}

            {/* Remaining active events */}
            {restActive.length > 0 && (
              <>
                <SectionLabel text="Upcoming" />
                {restActive
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                  .map((e) => <EventMiniCard key={e.id} event={e} />)
                }
              </>
            )}

            {/* Past events */}
            {pastEvents.length > 0 && (
              <>
                <SectionLabel text="Past Memories" />
                {pastEvents
                  .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                  .slice(0, 5)
                  .map((e) => <EventMiniCard key={e.id} event={e} />)
                }
              </>
            )}
          </>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tagline: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 151, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  joinBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  joinBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  createBtn: {
    flex: 2,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  createBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  errorWrap: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.primary },
})
