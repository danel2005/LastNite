/**
 * Reveal Screen — Step 18
 *
 * THE EMOTIONAL CLIMAX of LastNite. Shows:
 *   - A dramatic "night is over" countdown (3-2-1) if coming from live state
 *   - Every mission as an expandable card with assignment timeline
 *   - Secret mission reveals with special animation
 *   - Awards screen with animated cards
 *   - Stats card
 *
 * API: GET /events/:id/reveal
 * Returns 202 { state: 'processing' } while computing — we poll until ready.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionAsset {
  id: string
  storageKey: string
  assetType: 'photo' | 'video'
  widthPx: number | null
  heightPx: number | null
  durationMs: number | null
  url: string | null
}

interface AssignmentEntry {
  assignmentId: string
  userId: string
  displayName: string
  assignedAt: string
  completedAt: string | null
  status: string
  isSecret: boolean
  submission: {
    id: string
    createdAt: string
    assets: SubmissionAsset[]
  } | null
}

interface RevealMission {
  missionInstanceId: string
  definitionId: string
  title: string
  description: string
  category: string
  mediaType: string
  intensity: number
  isFinale: boolean
  isCustom: boolean
  createdByUserId: string | null
  targetUserId: string | null
  assignmentTimeline: AssignmentEntry[]
}

interface Award {
  title: string
  emoji: string
  userId: string
  displayName: string
}

interface RevealStats {
  totalParticipants: number
  totalMissionsAssigned: number
  totalMissionsCompleted: number
  totalSubmissions: number
  participationRate: number
}

interface RevealData {
  eventId: string
  generatedAt: string
  missions: RevealMission[]
  awards: Award[]
  stats: RevealStats
}

type RevealResponse =
  | { state: 'processing'; message: string }
  | RevealData

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function intensityDots(n: number): string {
  return '●'.repeat(n) + '○'.repeat(5 - n)
}

// ─── Dramatic countdown overlay ───────────────────────────────────────────────

function DramaticCountdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3)
  const fade = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    function tick(current: number) {
      fade.setValue(0)
      scale.setValue(0.5)
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
            if (current <= 1) {
              onDone()
            } else {
              setCount(current - 1)
            }
          })
        }, 600)
      })
    }
    tick(count)
  }, [count])

  return (
    <View style={cSt.overlay}>
      <Text style={cSt.label}>The night is over.</Text>
      <Text style={cSt.label2}>Get ready for the reveal...</Text>
      <Animated.Text style={[cSt.number, { opacity: fade, transform: [{ scale }] }]}>
        {count}
      </Animated.Text>
    </View>
  )
}

const cSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: { ...typography.heading2, color: colors.textSecondary, textAlign: 'center' },
  label2: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  number: { fontSize: 120, fontWeight: '900', color: colors.accent, lineHeight: 130 },
})

// ─── Processing screen ────────────────────────────────────────────────────────

function ProcessingScreen() {
  return (
    <View style={pSt.root}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={pSt.title}>Computing the reveal...</Text>
      <Text style={pSt.sub}>This won't take long. Hang tight.</Text>
    </View>
  )
}

const pSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { ...typography.heading3, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary },
})

// ─── Mission card ─────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width

function MissionRevealCard({ mission }: { mission: RevealMission }) {
  const [expanded, setExpanded] = useState(false)
  const hasSecret = mission.assignmentTimeline.some((a) => a.isSecret)

  return (
    <View style={mSt.card}>
      {/* Header — tap to expand */}
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8} style={mSt.header}>
        <View style={mSt.headerLeft}>
          {/* Special badges */}
          {hasSecret && <Text style={mSt.secretBadge}>🔒 SECRET</Text>}
          {mission.isFinale && <Text style={mSt.finaleBadge}>⭐ FINALE</Text>}
          {mission.isCustom && <Text style={mSt.customBadge}>✏️ CUSTOM</Text>}
          <Text style={mSt.missionTitle}>{mission.title}</Text>
          <Text style={mSt.missionDesc} numberOfLines={expanded ? 0 : 2}>{mission.description}</Text>
          <View style={mSt.metaRow}>
            <Text style={mSt.metaText}>{intensityDots(mission.intensity)}</Text>
            <Text style={mSt.metaDot}>·</Text>
            <Text style={mSt.metaText}>{mission.category}</Text>
            <Text style={mSt.metaDot}>·</Text>
            <Text style={mSt.metaText}>
              {mission.assignmentTimeline.length} assigned,{' '}
              {mission.assignmentTimeline.filter((a) => a.status === 'completed').length} completed
            </Text>
          </View>
        </View>
        <Text style={mSt.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded: assignment timeline */}
      {expanded && (
        <View style={mSt.timeline}>
          {mission.assignmentTimeline.map((entry, idx) => (
            <AssignmentRow key={entry.assignmentId} entry={entry} position={idx + 1} />
          ))}
          {mission.assignmentTimeline.length === 0 && (
            <Text style={mSt.noAssignments}>No one was assigned this mission.</Text>
          )}
        </View>
      )}
    </View>
  )
}

const mSt = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  header: { padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerLeft: { flex: 1, gap: spacing.xs },
  secretBadge: { color: colors.secret, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  finaleBadge: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  customBadge: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  missionTitle: { ...typography.heading3, color: colors.text },
  missionDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  metaText: { ...typography.label, color: colors.textTertiary },
  metaDot: { color: colors.textTertiary, fontSize: 10 },
  chevron: { color: colors.textSecondary, fontSize: 14, paddingTop: 2 },
  timeline: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  noAssignments: { ...typography.bodySmall, color: colors.textTertiary, padding: spacing.md, textAlign: 'center' },
})

// ─── Assignment row ───────────────────────────────────────────────────────────

function AssignmentRow({ entry, position }: { entry: AssignmentEntry; position: number }) {
  const isCompleted = entry.status === 'completed'
  const hasPhoto = entry.submission?.assets.some((a) => a.assetType === 'photo' && a.url)
  const photoAsset = entry.submission?.assets.find((a) => a.assetType === 'photo' && a.url)
  const anyAsset = entry.submission?.assets.find((a) => a.url)

  return (
    <View style={aSt.row}>
      {/* Position badge + connector line */}
      <View style={aSt.leftCol}>
        <View style={[aSt.posBadge, isCompleted ? aSt.posBadgeDone : aSt.posBadgePending]}>
          <Text style={aSt.posText}>{position}</Text>
        </View>
        <View style={aSt.line} />
      </View>

      <View style={aSt.content}>
        {/* Secret mission reveal */}
        {entry.isSecret && (
          <View style={aSt.secretBanner}>
            <Text style={aSt.secretBannerText}>🔒 Secret mission revealed!</Text>
          </View>
        )}

        {/* Submitter info */}
        <View style={aSt.userRow}>
          <View style={aSt.avatar}>
            <Text style={aSt.avatarText}>{entry.displayName[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={aSt.userInfo}>
            <Text style={aSt.displayName}>{entry.displayName}</Text>
            <Text style={aSt.timestamp}>Assigned {formatTime(entry.assignedAt)}</Text>
          </View>
          <View style={[aSt.statusBadge, isCompleted ? aSt.statusDone : aSt.statusMissed]}>
            <Text style={[aSt.statusText, isCompleted ? aSt.statusDoneText : aSt.statusMissedText]}>
              {isCompleted ? '✓ Done' : '✗ Missed'}
            </Text>
          </View>
        </View>

        {/* Submission media */}
        {entry.submission && (hasPhoto || anyAsset) && (
          <View style={aSt.mediaContainer}>
            {hasPhoto ? (
              <Image
                source={{ uri: photoAsset!.url! }}
                style={aSt.mediaImage}
                resizeMode="cover"
              />
            ) : anyAsset ? (
              <View style={aSt.videoPlaceholder}>
                <Text style={aSt.videoIcon}>🎬</Text>
                <Text style={aSt.videoLabel}>Video submission</Text>
              </View>
            ) : null}
            {entry.completedAt && (
              <Text style={aSt.submittedAt}>Submitted {formatTime(entry.completedAt)}</Text>
            )}
          </View>
        )}

        {isCompleted && !entry.submission && (
          <Text style={aSt.noMedia}>Completed — no media submitted</Text>
        )}
      </View>
    </View>
  )
}

const aSt = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.sm },
  leftCol: { alignItems: 'center', width: 28 },
  posBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBadgeDone: { backgroundColor: colors.success },
  posBadgePending: { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border },
  posText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  line: { flex: 1, width: 2, backgroundColor: colors.borderSubtle, marginTop: 2 },
  content: { flex: 1, gap: spacing.sm },
  secretBanner: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.secret,
  },
  secretBannerText: { color: colors.secret, fontSize: 12, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1 },
  displayName: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  timestamp: { color: colors.textTertiary, fontSize: 11 },
  statusBadge: {
    borderRadius: borderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  statusDone: { backgroundColor: 'rgba(76,175,125,0.15)' },
  statusMissed: { backgroundColor: colors.bgElevated },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusDoneText: { color: colors.success },
  statusMissedText: { color: colors.textTertiary },
  mediaContainer: { gap: spacing.xs },
  mediaImage: {
    width: '100%',
    height: SCREEN_W * 0.5,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgElevated,
  },
  videoPlaceholder: {
    width: '100%',
    height: SCREEN_W * 0.4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  videoIcon: { fontSize: 32 },
  videoLabel: { ...typography.bodySmall, color: colors.textSecondary },
  submittedAt: { ...typography.label, color: colors.textTertiary },
  noMedia: { ...typography.bodySmall, color: colors.textTertiary, fontStyle: 'italic' },
})

// ─── Awards screen ────────────────────────────────────────────────────────────

function AwardsSection({ awards }: { awards: Award[] }) {
  if (awards.length === 0) return null
  return (
    <View style={awSt.section}>
      <Text style={awSt.heading}>🏆 Awards</Text>
      <View style={awSt.grid}>
        {awards.map((award, i) => (
          <View key={i} style={awSt.card}>
            <Text style={awSt.emoji}>{award.emoji}</Text>
            <Text style={awSt.title}>{award.title}</Text>
            <View style={awSt.winner}>
              <View style={awSt.winnerAvatar}>
                <Text style={awSt.winnerAvatarText}>{award.displayName[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <Text style={awSt.winnerName}>{award.displayName}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const awSt = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  heading: { ...typography.heading2, color: colors.accent, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: (SCREEN_W - spacing.lg * 2 - spacing.sm) / 2,
    flex: 1,
  },
  emoji: { fontSize: 36 },
  title: { ...typography.label, color: colors.accent, textAlign: 'center', letterSpacing: 0.5 },
  winner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  winnerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerAvatarText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  winnerName: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
})

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatsCard({ stats }: { stats: RevealStats }) {
  return (
    <View style={stSt.card}>
      <Text style={stSt.heading}>📊 By the numbers</Text>
      <View style={stSt.grid}>
        <StatItem label="Participants" value={String(stats.totalParticipants)} />
        <StatItem label="Submissions" value={String(stats.totalSubmissions)} />
        <StatItem label="Missions done" value={String(stats.totalMissionsCompleted)} />
        <StatItem label="Completion" value={`${stats.participationRate}%`} />
      </View>
    </View>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={stSt.item}>
      <Text style={stSt.value}>{value}</Text>
      <Text style={stSt.label}>{label}</Text>
    </View>
  )
}

const stSt = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  heading: { ...typography.heading3, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    flex: 1,
    minWidth: (SCREEN_W - spacing.lg * 2 - spacing.xl * 2 - spacing.sm) / 2,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  value: { ...typography.heading2, color: colors.accent },
  label: { ...typography.label, color: colors.textSecondary, textAlign: 'center' },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [showCountdown, setShowCountdown] = useState(false)
  const [revealReady, setRevealReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'missions' | 'awards'>('missions')

  // Poll reveal endpoint until ready
  const { data, isLoading, isError, refetch } = useQuery<RevealResponse>({
    queryKey: ['reveal', id],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/reveal`)
      return res.data as RevealResponse
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const d = query.state.data
      if (!d) return 3000
      if ('state' in d && d.state === 'processing') return 3000
      return false // done
    },
    staleTime: 0,
  })

  const isProcessing = data && 'state' in data && data.state === 'processing'
  const revealData = data && !('state' in data) ? (data as RevealData) : null

  // Once data arrives, show countdown on first load if not already revealed
  useEffect(() => {
    if (revealData && !revealReady) {
      setShowCountdown(true)
    }
  }, [!!revealData])

  const handleCountdownDone = useCallback(() => {
    setShowCountdown(false)
    setRevealReady(true)
  }, [])

  // ── Loading / processing ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={s.root}>
        <ProcessingScreen />
      </View>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.centered}>
          <Text style={s.errorText}>Failed to load reveal.</Text>
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (isProcessing || !revealData) {
    return (
      <View style={s.root}>
        <ProcessingScreen />
      </View>
    )
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  if (showCountdown) {
    return (
      <View style={s.root}>
        <DramaticCountdown onDone={handleCountdownDone} />
      </View>
    )
  }

  // ── Full reveal ───────────────────────────────────────────────────────────

  const { missions, awards, stats } = revealData

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Hero header */}
      <View style={s.hero}>
        <Text style={s.heroTitle}>THE REVEAL</Text>
        <Text style={s.heroSub}>Everything is now exposed 👀</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'missions' && s.tabActive]}
          onPress={() => setActiveTab('missions')}
          activeOpacity={0.8}
        >
          <Text style={[s.tabText, activeTab === 'missions' && s.tabTextActive]}>
            Missions ({missions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'awards' && s.tabActive]}
          onPress={() => setActiveTab('awards')}
          activeOpacity={0.8}
        >
          <Text style={[s.tabText, activeTab === 'awards' && s.tabTextActive]}>
            Awards & Stats
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'missions' ? (
          <>
            {missions.map((m) => (
              <MissionRevealCard key={m.missionInstanceId} mission={m} />
            ))}
            {missions.length === 0 && (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>🤷</Text>
                <Text style={s.emptyTitle}>No missions to reveal</Text>
                <Text style={s.emptySub}>Looks like no missions were assigned this time.</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <AwardsSection awards={awards} />
            <StatsCard stats={stats} />
          </>
        )}

        {/* Navigation to recap */}
        <TouchableOpacity
          style={s.recapBtn}
          onPress={() => router.push(`/(app)/events/${id}/recap` as never)}
          activeOpacity={0.85}
        >
          <Text style={s.recapBtnText}>View full recap →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.accent },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 4,
    textAlign: 'center',
  },
  heroSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: { backgroundColor: colors.bgElevated },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...typography.heading3, color: colors.text },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  recapBtn: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  recapBtnText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
})
