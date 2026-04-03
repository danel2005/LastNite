/**
 * Event Feed Screen
 *
 * 2-column photo grid, fullscreen viewer modal, emoji reactions.
 * Mission labels are hidden ("???") during live events.
 *
 * Privacy invariant: shows submission media + submitter, never shows
 * mission assignment data of other users during a live event.
 *
 * API:
 *   GET /events/:id/feed?cursor=&limit=20
 *   POST /submissions/:id/reactions  { emoji }
 *   DELETE /submissions/:id/reactions/:reactionId
 */

import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography, shadows } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReactionEmoji = 'fire' | 'heart' | 'laugh' | 'wow'

interface Reaction {
  reactionId: string
  emoji: ReactionEmoji
  userId: string
  count: number
  myReactionId?: string
}

interface Submitter {
  userId: string
  displayName: string
}

interface SubmissionFeedItem {
  submissionId: string
  mediaType: 'photo' | 'video'
  thumbnailUrl: string
  mediaUrl: string
  submitter: Submitter
  submittedAt: string
  missionTitle: string | null  // null = hidden during live event
  reactions: Reaction[]
}

interface FeedPage {
  submissions: SubmissionFeedItem[]
  nextCursor: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width
const TILE_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2
const REACTION_EMOJIS: { key: ReactionEmoji; label: string }[] = [
  { key: 'fire', label: '🔥' },
  { key: 'heart', label: '❤️' },
  { key: 'laugh', label: '😂' },
  { key: 'wow', label: '😮' },
]

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchFeedPage(eventId: string, cursor?: string): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: '20' })
  if (cursor) params.set('cursor', cursor)
  const res = await apiClient.get(`/events/${eventId}/feed?${params.toString()}`)
  return res.data as FeedPage
}

// ─── Skeleton tile ────────────────────────────────────────────────────────────

function SkeletonTile() {
  return (
    <View style={[tileSt.tile, { backgroundColor: colors.bgCard }]} />
  )
}

// ─── Submission tile ──────────────────────────────────────────────────────────

function SubmissionTile({
  item,
  eventLive,
  onPress,
  onLongPress,
}: {
  item: SubmissionFeedItem
  eventLive: boolean
  onPress: () => void
  onLongPress: () => void
}) {
  return (
    <TouchableOpacity
      style={tileSt.tile}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.88}
    >
      <Image source={{ uri: item.thumbnailUrl || item.mediaUrl }} style={tileSt.image} />

      {/* Bottom overlay */}
      <View style={tileSt.overlay}>
        {/* Submitter avatar (bottom-left) */}
        <View style={tileSt.avatar}>
          <Text style={tileSt.avatarText}>
            {item.submitter.displayName[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        {/* Mission label */}
        <Text style={tileSt.missionLabel} numberOfLines={1}>
          {eventLive || !item.missionTitle ? '???' : item.missionTitle}
        </Text>
      </View>

      {/* Media type badge */}
      {item.mediaType === 'video' && (
        <View style={tileSt.videoBadge}>
          <Text style={tileSt.videoBadgeText}>🎥</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const tileSt = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  missionLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, flex: 1 },
  videoBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  videoBadgeText: { fontSize: 12 },
})

// ─── Reaction strip ───────────────────────────────────────────────────────────

function ReactionStrip({
  reactions,
  onReact,
  myUserId,
}: {
  reactions: Reaction[]
  onReact: (emoji: ReactionEmoji, existingReactionId?: string) => void
  myUserId?: string
}) {
  return (
    <View style={rxSt.strip}>
      {REACTION_EMOJIS.map(({ key, label }) => {
        const reaction = reactions.find((r) => r.emoji === key)
        const isMyReaction = !!reaction?.myReactionId
        const count = reaction?.count ?? 0
        return (
          <TouchableOpacity
            key={key}
            style={[rxSt.btn, isMyReaction && rxSt.btnActive]}
            onPress={() => onReact(key, reaction?.myReactionId)}
            activeOpacity={0.75}
          >
            <Text style={rxSt.emoji}>{label}</Text>
            {count > 0 && <Text style={[rxSt.count, isMyReaction && rxSt.countActive]}>{count}</Text>}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const rxSt = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  btn: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  emoji: { fontSize: 22 },
  count: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 1 },
  countActive: { color: colors.accent },
})

// ─── Fullscreen viewer modal ──────────────────────────────────────────────────

function FullscreenViewer({
  submission,
  eventLive,
  myUserId,
  onClose,
  onReact,
}: {
  submission: SubmissionFeedItem
  eventLive: boolean
  myUserId?: string
  onClose: () => void
  onReact: (submissionId: string, emoji: ReactionEmoji, existingReactionId?: string) => void
}) {
  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={fsSt.root}>
        {/* Close button */}
        <TouchableOpacity style={fsSt.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={fsSt.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Media */}
        {submission.mediaType === 'video' ? (
          <View style={fsSt.videoPlaceholder}>
            <Text style={fsSt.videoIcon}>🎬</Text>
            <Text style={fsSt.videoLabel}>Video</Text>
          </View>
        ) : (
          <Image
            source={{ uri: submission.mediaUrl || submission.thumbnailUrl }}
            style={fsSt.image}
            resizeMode="contain"
          />
        )}

        {/* Bottom gradient overlay */}
        <View style={fsSt.bottomOverlay}>
          {/* Submitter info */}
          <View style={fsSt.submitterRow}>
            <View style={fsSt.avatar}>
              <Text style={fsSt.avatarText}>
                {submission.submitter.displayName[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View>
              <Text style={fsSt.submitterName}>{submission.submitter.displayName}</Text>
              <Text style={fsSt.submittedAt}>
                {new Date(submission.submittedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {/* Mission label */}
          <Text style={fsSt.missionLabel}>
            {eventLive || !submission.missionTitle ? '🔒 Mission hidden' : `📋 ${submission.missionTitle}`}
          </Text>

          {/* Reactions */}
          <ReactionStrip
            reactions={submission.reactions}
            myUserId={myUserId}
            onReact={(emoji, existingId) => onReact(submission.submissionId, emoji, existingId)}
          />
        </View>
      </View>
    </Modal>
  )
}

const fsSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  image: { flex: 1, width: '100%' },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  videoIcon: { fontSize: 64 },
  videoLabel: { ...typography.heading3, color: colors.textSecondary },
  bottomOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  submitterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSubtle,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  submitterName: { ...typography.body, color: colors.text, fontWeight: '700' },
  submittedAt: { ...typography.bodySmall, color: colors.textSecondary },
  missionLabel: { ...typography.bodySmall, color: colors.textSecondary, fontStyle: 'italic' },
})

// ─── Report modal helper ──────────────────────────────────────────────────────

type ReportCategory = 'Inappropriate' | 'Harmful' | 'Spam'

function showReportSheet(submissionId: string) {
  const categories: ReportCategory[] = ['Inappropriate', 'Harmful', 'Spam']
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Report submission',
        options: [...categories, 'Cancel'],
        cancelButtonIndex: categories.length,
        destructiveButtonIndex: 0,
      },
      async (index) => {
        if (index < categories.length) {
          try {
            await apiClient.post(`/submissions/${submissionId}/report`, {
              category: categories[index],
            })
            Alert.alert('Reported', "Thanks for reporting. We'll review it.")
          } catch {
            Alert.alert('Error', 'Failed to submit report.')
          }
        }
      },
    )
  } else {
    // Android: simple alert-based picker
    Alert.alert('Report submission', 'Select a reason:', [
      ...categories.map((c) => ({
        text: c,
        onPress: async () => {
          try {
            await apiClient.post(`/submissions/${submissionId}/report`, { category: c })
            Alert.alert('Reported', "Thanks for reporting. We'll review it.")
          } catch {
            Alert.alert('Error', 'Failed to submit report.')
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const myUserId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  const [viewerSubmission, setViewerSubmission] = useState<SubmissionFeedItem | null>(null)

  // Fetch all submissions with cursor pagination
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<FeedPage>({
    queryKey: ['feed', id],
    queryFn: ({ pageParam }) => fetchFeedPage(id!, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: !!id,
  })

  // Flatten all pages into one submission list
  const allSubmissions: SubmissionFeedItem[] = data?.pages.flatMap((p) => p.submissions) ?? []
  const totalCount = allSubmissions.length

  // We need to know if the event is still live — use the live event query
  const { data: liveData } = useQuery<{ event: { state: string } }>({
    queryKey: ['live', id],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/live`)
      return res.data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
  const eventLive = (liveData?.event.state ?? 'live') === 'live'

  // ── Reactions mutation ────────────────────────────────────────────────────

  const reactMutation = useMutation({
    mutationFn: async ({
      submissionId,
      emoji,
      existingReactionId,
    }: {
      submissionId: string
      emoji: ReactionEmoji
      existingReactionId?: string
    }) => {
      if (existingReactionId) {
        await apiClient.delete(`/submissions/${submissionId}/reactions/${existingReactionId}`)
        return { removed: true, submissionId, emoji }
      } else {
        const res = await apiClient.post(`/submissions/${submissionId}/reactions`, { emoji })
        return { removed: false, submissionId, emoji, reactionId: (res.data as { reactionId: string }).reactionId }
      }
    },
    onMutate: async ({ submissionId, emoji, existingReactionId }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['feed', id] })
      const previous = qc.getQueryData(['feed', id])
      qc.setQueryData(['feed', id], (old: typeof data) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            submissions: page.submissions.map((sub) => {
              if (sub.submissionId !== submissionId) return sub
              const updated = sub.reactions.map((r) => {
                if (r.emoji === emoji) {
                  if (existingReactionId) {
                    return { ...r, count: Math.max(0, r.count - 1), myReactionId: undefined }
                  } else {
                    return { ...r, count: r.count + 1, myReactionId: 'optimistic' }
                  }
                }
                return r
              })
              // Add new reaction entry if none exists
              const hasEmoji = sub.reactions.some((r) => r.emoji === emoji)
              if (!hasEmoji && !existingReactionId) {
                updated.push({ reactionId: 'optimistic', emoji, userId: myUserId ?? '', count: 1, myReactionId: 'optimistic' })
              }
              return { ...sub, reactions: updated }
            }),
          })),
        }
      })
      // Also update viewer modal submission
      if (viewerSubmission?.submissionId === submissionId) {
        setViewerSubmission((prev) => {
          if (!prev) return prev
          const updated = prev.reactions.map((r) => {
            if (r.emoji === emoji) {
              if (existingReactionId) {
                return { ...r, count: Math.max(0, r.count - 1), myReactionId: undefined }
              } else {
                return { ...r, count: r.count + 1, myReactionId: 'optimistic' }
              }
            }
            return r
          })
          const hasEmoji = prev.reactions.some((r) => r.emoji === emoji)
          if (!hasEmoji && !existingReactionId) {
            updated.push({ reactionId: 'optimistic', emoji, userId: myUserId ?? '', count: 1, myReactionId: 'optimistic' })
          }
          return { ...prev, reactions: updated }
        })
      }
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['feed', id], ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['feed', id] })
    },
  })

  function handleReact(submissionId: string, emoji: ReactionEmoji, existingReactionId?: string) {
    reactMutation.mutate({ submissionId, emoji, existingReactionId })
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderTile({ item }: { item: SubmissionFeedItem }) {
    return (
      <SubmissionTile
        item={item}
        eventLive={eventLive}
        onPress={() => setViewerSubmission(item)}
        onLongPress={() => showReportSheet(item.submissionId)}
      />
    )
  }

  function renderFooter() {
    if (!hasNextPage) return null
    return (
      <View style={s.footerLoader}>
        {isFetchingNextPage ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}
      </View>
    )
  }

  function renderEmpty() {
    if (isLoading) {
      return (
        <View style={s.emptyContainer}>
          <View style={s.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </View>
        </View>
      )
    }
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyEmoji}>📷</Text>
        <Text style={s.emptyTitle}>Be the first to submit something!</Text>
        <Text style={s.emptySub}>Complete a mission to appear in the feed.</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.errorText}>Failed to load feed.</Text>
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.8}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Event Feed</Text>
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{totalCount}</Text>
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={allSubmissions}
        keyExtractor={(item) => item.submissionId}
        renderItem={renderTile}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={[s.grid, allSubmissions.length === 0 && s.gridEmpty]}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
      />

      {/* Fullscreen viewer */}
      {viewerSubmission && (
        <FullscreenViewer
          submission={viewerSubmission}
          eventLive={eventLive}
          myUserId={myUserId}
          onClose={() => setViewerSubmission(null)}
          onReact={handleReact}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body, color: colors.error },
  retryText: { ...typography.body, color: colors.accent },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingVertical: spacing.xs },
  backBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  headerTitle: { ...typography.heading3, color: colors.text },
  countBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countBadgeText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  grid: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  gridEmpty: { flex: 1 },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    minHeight: 300,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...typography.heading3, color: colors.text, textAlign: 'center' },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  footerLoader: { padding: spacing.lg, alignItems: 'center' },
})
