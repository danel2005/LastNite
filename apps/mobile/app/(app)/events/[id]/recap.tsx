/**
 * Recap Screen — Step 18
 *
 * Post-event recap with three views:
 *   - Timeline: chapters every ~30 min showing submission activity
 *   - By Participant: each person's contribution
 *   - Missions: submission counts per mission
 *
 * API: GET /events/:id/recap
 * Returns 202 while still computing — polls until ready.
 */

import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  chapterIndex: number
  startsAtOffset: number
  label: string
  submissionIds: string[]
}

interface MissionRecap {
  missionInstanceId: string
  title: string
  category: string
  submissionIds: string[]
}

interface ParticipantRecap {
  userId: string
  displayName: string
  submissionIds: string[]
}

interface RecapData {
  eventId: string
  generatedAt: string
  timeline: { chapters: Chapter[] } | null
  byMission: MissionRecap[] | null
  byParticipant: ParticipantRecap[] | null
  collage: { assets: unknown[] } | null
  highlight: { assets: unknown[] } | null
}

type RecapResponse =
  | { state: 'processing'; message: string }
  | RecapData

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width
const MAX_BAR_W = SCREEN_W - spacing.lg * 4 - 100

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'timeline' | 'participants' | 'missions'
const TABS: { key: Tab; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'participants', label: 'By Person' },
  { key: 'missions', label: 'Missions' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={tbSt.bar}>
      {TABS.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[tbSt.tab, active === t.key && tbSt.tabActive]}
          onPress={() => onChange(t.key)}
          activeOpacity={0.8}
        >
          <Text style={[tbSt.text, active === t.key && tbSt.textActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const tbSt = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: colors.bgElevated },
  text: { ...typography.label, color: colors.textSecondary },
  textActive: { color: colors.text },
})

// ─── Timeline view ────────────────────────────────────────────────────────────

function TimelineView({ chapters }: { chapters: Chapter[] }) {
  if (chapters.length === 0) {
    return (
      <View style={tiSt.empty}>
        <Text style={tiSt.emptyEmoji}>📭</Text>
        <Text style={tiSt.emptyText}>No submissions in timeline</Text>
      </View>
    )
  }

  const maxCount = Math.max(...chapters.map((c) => c.submissionIds.length), 1)

  return (
    <View style={tiSt.container}>
      <Text style={tiSt.sectionLabel}>Submission activity over time</Text>
      {chapters.map((chapter) => {
        const count = chapter.submissionIds.length
        const barW = Math.max(8, (count / maxCount) * MAX_BAR_W)
        return (
          <View key={chapter.chapterIndex} style={tiSt.row}>
            <Text style={tiSt.chapterLabel}>{chapter.label}</Text>
            <View style={tiSt.barTrack}>
              <View style={[tiSt.barFill, { width: barW }]} />
            </View>
            <Text style={tiSt.count}>{count}</Text>
          </View>
        )
      })}
      <Text style={tiSt.hint}>Numbers show submissions per 30-min window</Text>
    </View>
  )
}

const tiSt = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chapterLabel: { width: 80, ...typography.label, color: colors.textSecondary, textAlign: 'right' },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: borderRadius.sm },
  count: { width: 24, ...typography.label, color: colors.textSecondary, textAlign: 'right' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 36 },
  emptyText: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.label, color: colors.textTertiary, marginTop: spacing.xs },
})

// ─── By participant view ──────────────────────────────────────────────────────

function ParticipantsView({ participants }: { participants: ParticipantRecap[] }) {
  const sorted = [...participants].sort((a, b) => b.submissionIds.length - a.submissionIds.length)
  const maxCount = Math.max(...sorted.map((p) => p.submissionIds.length), 1)

  if (sorted.length === 0) {
    return (
      <View style={pvSt.empty}>
        <Text style={pvSt.emptyText}>No participant data available</Text>
      </View>
    )
  }

  return (
    <View style={pvSt.container}>
      <Text style={pvSt.sectionLabel}>Submissions per person</Text>
      {sorted.map((p, idx) => {
        const count = p.submissionIds.length
        const barW = Math.max(8, (count / maxCount) * MAX_BAR_W)
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
        return (
          <View key={p.userId} style={pvSt.row}>
            <View style={pvSt.avatarWrap}>
              <View style={pvSt.avatar}>
                <Text style={pvSt.avatarText}>{initials(p.displayName)}</Text>
              </View>
              {medal && <Text style={pvSt.medal}>{medal}</Text>}
            </View>
            <View style={pvSt.nameCol}>
              <Text style={pvSt.name} numberOfLines={1}>{p.displayName}</Text>
              <View style={pvSt.barTrack}>
                <View style={[pvSt.barFill, { width: barW }]} />
              </View>
            </View>
            <Text style={pvSt.count}>{count}</Text>
          </View>
        )
      })}
    </View>
  )
}

const pvSt = StyleSheet.create({
  container: { gap: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarWrap: { position: 'relative', width: 40, height: 40 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  medal: { position: 'absolute', top: -6, right: -6, fontSize: 14 },
  nameCol: { flex: 1, gap: spacing.xs },
  name: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  barTrack: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.accentDim, borderRadius: borderRadius.sm },
  count: { width: 28, ...typography.body, color: colors.accent, fontWeight: '700', textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textSecondary },
})

// ─── By mission view ──────────────────────────────────────────────────────────

function MissionsView({ missions }: { missions: MissionRecap[] }) {
  const sorted = [...missions].sort((a, b) => b.submissionIds.length - a.submissionIds.length)

  if (sorted.length === 0) {
    return (
      <View style={mvSt.empty}>
        <Text style={mvSt.emptyText}>No mission data available</Text>
      </View>
    )
  }

  return (
    <View style={mvSt.container}>
      <Text style={mvSt.sectionLabel}>Missions by completion</Text>
      {sorted.map((m) => (
        <View key={m.missionInstanceId} style={mvSt.row}>
          <View style={mvSt.info}>
            <Text style={mvSt.title} numberOfLines={2}>{m.title}</Text>
            <Text style={mvSt.category}>{m.category}</Text>
          </View>
          <View style={[mvSt.countBadge, m.submissionIds.length === 0 && mvSt.countBadgeZero]}>
            <Text style={mvSt.countText}>{m.submissionIds.length}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const mvSt = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1, gap: 2 },
  title: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  category: { ...typography.label, color: colors.textTertiary },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countBadgeZero: { backgroundColor: colors.bgElevated, borderColor: colors.border },
  countText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textSecondary },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('timeline')

  const { data, isLoading, isError, refetch } = useQuery<RecapResponse>({
    queryKey: ['recap', id],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/recap`)
      return res.data as RecapResponse
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return 3000
      if ('state' in d && d.state === 'processing') return 3000
      return false
    },
    staleTime: 0,
  })

  const isProcessing = data && 'state' in data && data.state === 'processing'
  const recapData = data && !('state' in data) ? (data as RecapData) : null

  if (isLoading || isProcessing) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.loadingText}>Loading recap...</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.errorText}>Failed to load recap.</Text>
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (!recapData) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.loadingText}>Generating recap...</Text>
      </View>
    )
  }

  const chapters = recapData.timeline?.chapters ?? []
  const participants = recapData.byParticipant ?? []
  const missions = recapData.byMission ?? []

  // Summary stats
  const totalSubs = participants.reduce((sum, p) => sum + p.submissionIds.length, 0)
  const topPerson = [...participants].sort((a, b) => b.submissionIds.length - a.submissionIds.length)[0]

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Event Recap</Text>
        <View style={s.headerStats}>
          <Text style={s.headerStat}>{totalSubs} submissions</Text>
          {topPerson && topPerson.submissionIds.length > 0 && (
            <Text style={s.headerStat}>MVP: {topPerson.displayName}</Text>
          )}
        </View>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'timeline' && <TimelineView chapters={chapters} />}
        {activeTab === 'participants' && <ParticipantsView participants={participants} />}
        {activeTab === 'missions' && <MissionsView missions={missions} />}

        {/* Bottom nav links */}
        <View style={s.bottomLinks}>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => router.push(`/(app)/events/${id}/reveal` as never)}
            activeOpacity={0.85}
          >
            <Text style={s.linkBtnText}>← Back to reveal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => router.push(`/(app)/events/${id}/feed` as never)}
            activeOpacity={0.85}
          >
            <Text style={s.linkBtnText}>View feed →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.accent },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  headerTitle: { ...typography.heading2, color: colors.text },
  headerStats: { flexDirection: 'row', gap: spacing.md },
  headerStat: { ...typography.bodySmall, color: colors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bottomLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  linkBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  linkBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
})
