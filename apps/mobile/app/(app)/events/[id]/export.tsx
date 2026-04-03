/**
 * Export & Share Screen — Step 19
 *
 * Allows participants to export event media after the event completes.
 *
 * Export types:
 *   - photo_pack  — all event photos saved to camera roll
 *   - highlight_reel — ordered video clips, share sheet or save to camera roll
 *
 * Flow:
 *   1. User picks export type
 *   2. POST /events/:id/export  → get jobId
 *   3. Poll GET /export-jobs/:id until status = 'ready'
 *   4. GET /export-jobs/:id/download → get signed URLs
 *   5. Download each file via expo-file-system, save via expo-media-library
 *   6. Native share sheet (Share API) on completion
 *
 * Share app CTA at end (organic growth).
 */

import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportType = 'photo_pack' | 'highlight_reel'

interface PhotoPackDownload {
  type: 'photo_pack'
  photos: {
    assetId: string
    url: string | null
    mimeType: string
    submitterName: string
    missionTitle: string
  }[]
}

interface HighlightReelDownload {
  type: 'highlight_reel'
  clips: {
    order: number
    assetId: string
    url: string | null
    mimeType: string
    durationMs: number | null
    submitterName: string
  }[]
}

type DownloadPayload = PhotoPackDownload | HighlightReelDownload

type ExportPhase =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'polling'; jobId: string; exportType: ExportType }
  | { kind: 'downloading'; jobId: string; current: number; total: number; exportType: ExportType }
  | { kind: 'done'; exportType: ExportType; savedCount: number }
  | { kind: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollExportJob(jobId: string, signal: AbortSignal): Promise<void> {
  const MAX_POLLS = 60 // 2 minutes max (2s interval)
  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal.aborted) throw new Error('Cancelled')
    const res = await apiClient.get(`/export-jobs/${jobId}`)
    const status = (res.data as { status: string }).status
    if (status === 'ready') return
    if (status === 'failed') {
      throw new Error((res.data as { errorMessage?: string }).errorMessage ?? 'Export failed')
    }
    await sleep(2000)
  }
  throw new Error('Export timed out. Try again.')
}

async function downloadAndSave(
  urls: (string | null)[],
  mimeTypes: string[],
  onProgress: (current: number) => void,
  signal: AbortSignal,
): Promise<number> {
  let saved = 0

  for (let i = 0; i < urls.length; i++) {
    if (signal.aborted) break
    onProgress(i + 1)

    const url = urls[i]
    if (!url) continue

    const ext = mimeTypes[i]?.includes('video') ? 'mp4' : 'jpg'
    const localUri = `${FileSystem.cacheDirectory}lastnite_export_${Date.now()}_${i}.${ext}`

    try {
      const download = await FileSystem.downloadAsync(url, localUri, {
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      })
      if (download.status === 200) {
        await MediaLibrary.saveToLibraryAsync(download.uri)
        saved++
      }
    } catch {
      // Skip individual failures — continue with rest
    }
  }

  return saved
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  return (
    <View style={prSt.track}>
      <View style={[prSt.fill, { width: `${pct}%` }]} />
    </View>
  )
}

const prSt = StyleSheet.create({
  track: { height: 6, backgroundColor: colors.bgElevated, borderRadius: borderRadius.full, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: borderRadius.full },
})

// ─── Export option card ───────────────────────────────────────────────────────

function ExportOption({
  emoji,
  title,
  desc,
  onPress,
  disabled,
}: {
  emoji: string
  title: string
  desc: string
  onPress: () => void
  disabled: boolean
}) {
  return (
    <TouchableOpacity
      style={[eoSt.card, disabled && eoSt.cardDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={eoSt.emoji}>{emoji}</Text>
      <View style={eoSt.text}>
        <Text style={eoSt.title}>{title}</Text>
        <Text style={eoSt.desc}>{desc}</Text>
      </View>
      <Text style={eoSt.arrow}>→</Text>
    </TouchableOpacity>
  )
}

const eoSt = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisabled: { opacity: 0.4 },
  emoji: { fontSize: 32 },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, color: colors.text, fontWeight: '700' },
  desc: { ...typography.bodySmall, color: colors.textSecondary },
  arrow: { color: colors.textSecondary, fontSize: 18 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [phase, setPhase] = useState<ExportPhase>({ kind: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions()

  const startExport = useCallback(
    async (exportType: ExportType) => {
      // Request media library permission first
      let perm = mediaPermission
      if (!perm?.granted) {
        perm = await requestMediaPermission()
        if (!perm?.granted) {
          Alert.alert(
            'Permission required',
            'LastNite needs access to your photo library to save media.',
            [{ text: 'OK' }],
          )
          return
        }
      }

      const controller = new AbortController()
      abortRef.current = controller

      try {
        // Step 1: Create export job
        setPhase({ kind: 'creating' })
        const createRes = await apiClient.post(`/events/${id}/export`, { type: exportType })
        const { jobId } = createRes.data as { jobId: string }

        if (controller.signal.aborted) return

        // Step 2: Poll until ready
        setPhase({ kind: 'polling', jobId, exportType })
        await pollExportJob(jobId, controller.signal)

        if (controller.signal.aborted) return

        // Step 3: Fetch download payload
        const dlRes = await apiClient.get(`/export-jobs/${jobId}/download`)
        const payload = dlRes.data as DownloadPayload

        const urls: (string | null)[] = []
        const mimeTypes: string[] = []

        if (payload.type === 'photo_pack') {
          payload.photos.forEach((p) => {
            urls.push(p.url)
            mimeTypes.push(p.mimeType)
          })
        } else {
          payload.clips.forEach((c) => {
            urls.push(c.url)
            mimeTypes.push(c.mimeType)
          })
        }

        if (urls.length === 0) {
          setPhase({ kind: 'done', exportType, savedCount: 0 })
          return
        }

        // Step 4: Download + save
        setPhase({ kind: 'downloading', jobId, exportType, current: 0, total: urls.length })

        const saved = await downloadAndSave(
          urls,
          mimeTypes,
          (current) => {
            if (!controller.signal.aborted) {
              setPhase({ kind: 'downloading', jobId, exportType, current, total: urls.length })
            }
          },
          controller.signal,
        )

        if (controller.signal.aborted) return
        setPhase({ kind: 'done', exportType, savedCount: saved })
      } catch (err) {
        if (controller.signal.aborted) return
        const msg = err instanceof Error ? err.message : 'Export failed'
        setPhase({ kind: 'error', message: msg })
      } finally {
        abortRef.current = null
      }
    },
    [id, mediaPermission, requestMediaPermission],
  )

  function handleCancel() {
    abortRef.current?.abort()
    setPhase({ kind: 'idle' })
  }

  async function handleShareApp() {
    try {
      await Share.share({
        message: Platform.OS === 'ios'
          ? 'Check out LastNite — a secret mission game for your nights out! 🎯🔥'
          : 'Check out LastNite — a secret mission game for your nights out! 🎯🔥',
        title: 'LastNite',
      })
    } catch {
      // User dismissed share sheet — fine
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isBusy = phase.kind !== 'idle' && phase.kind !== 'done' && phase.kind !== 'error'

  if (phase.kind === 'creating') {
    return (
      <View style={s.statusRoot}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.statusTitle}>Starting export...</Text>
      </View>
    )
  }

  if (phase.kind === 'polling') {
    return (
      <View style={s.statusRoot}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.statusTitle}>
          {phase.exportType === 'photo_pack' ? '📸 Preparing photos...' : '🎬 Preparing reel...'}
        </Text>
        <Text style={s.statusSub}>This may take a moment.</Text>
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase.kind === 'downloading') {
    return (
      <View style={s.statusRoot}>
        <Text style={s.statusTitle}>
          {phase.exportType === 'photo_pack' ? '📸 Saving photos...' : '🎬 Saving videos...'}
        </Text>
        <Text style={s.statusSub}>
          {phase.current} / {phase.total}
        </Text>
        <View style={s.progressWrap}>
          <ProgressBar current={phase.current} total={phase.total} />
        </View>
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase.kind === 'done') {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <View style={s.doneRoot}>
          <Text style={s.doneEmoji}>{phase.exportType === 'photo_pack' ? '📸' : '🎬'}</Text>
          <Text style={s.doneTitle}>Saved to camera roll!</Text>
          <Text style={s.doneSub}>{phase.savedCount} file{phase.savedCount !== 1 ? 's' : ''} saved</Text>

          <TouchableOpacity style={s.actionBtn} onPress={() => setPhase({ kind: 'idle' })} activeOpacity={0.85}>
            <Text style={s.actionBtnText}>← Export more</Text>
          </TouchableOpacity>

          {/* Share app CTA */}
          <View style={s.shareAppCard}>
            <Text style={s.shareAppEmoji}>🎉</Text>
            <View style={s.shareAppText}>
              <Text style={s.shareAppTitle}>Love LastNite?</Text>
              <Text style={s.shareAppSub}>Share it with friends for your next event</Text>
            </View>
            <TouchableOpacity style={s.shareAppBtn} onPress={handleShareApp} activeOpacity={0.8}>
              <Text style={s.shareAppBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (phase.kind === 'error') {
    return (
      <SafeAreaView style={s.root} edges={['bottom']}>
        <View style={s.statusRoot}>
          <Text style={s.errorEmoji}>⚠️</Text>
          <Text style={s.errorTitle}>Export failed</Text>
          <Text style={s.errorSub}>{phase.message}</Text>
          <TouchableOpacity style={s.actionBtn} onPress={() => setPhase({ kind: 'idle' })} activeOpacity={0.85}>
            <Text style={s.actionBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Idle: export options ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollableOptions
        id={id!}
        isBusy={isBusy}
        onExport={startExport}
        onShareApp={handleShareApp}
      />
    </SafeAreaView>
  )
}

// ─── Options list (extracted for clarity) ────────────────────────────────────

function ScrollableOptions({
  id,
  isBusy,
  onExport,
  onShareApp,
}: {
  id: string
  isBusy: boolean
  onExport: (type: ExportType) => void
  onShareApp: () => void
}) {
  return (
    <View style={opSt.root}>
      <View style={opSt.header}>
        <Text style={opSt.title}>Export & Share</Text>
        <Text style={opSt.sub}>Save your night to your camera roll and share with friends.</Text>
      </View>

      <View style={opSt.options}>
        <ExportOption
          emoji="📸"
          title="Save All Photos"
          desc="Download all event photos to your camera roll"
          onPress={() => onExport('photo_pack')}
          disabled={isBusy}
        />
        <ExportOption
          emoji="🎬"
          title="Export Highlight Reel"
          desc="Save the best video clips to your camera roll"
          onPress={() => onExport('highlight_reel')}
          disabled={isBusy}
        />
      </View>

      <View style={opSt.note}>
        <Text style={opSt.noteText}>
          💡 After saving, open your camera roll to share to Instagram, TikTok, or wherever.
        </Text>
      </View>

      {/* Share app CTA */}
      <TouchableOpacity style={opSt.shareCard} onPress={onShareApp} activeOpacity={0.8}>
        <Text style={opSt.shareEmoji}>🎉</Text>
        <View style={opSt.shareText}>
          <Text style={opSt.shareTitle}>Share LastNite</Text>
          <Text style={opSt.shareSub}>Tell friends about the app</Text>
        </View>
        <Text style={opSt.shareArrow}>↗</Text>
      </TouchableOpacity>

      {/* Back to recap */}
      <TouchableOpacity
        style={opSt.backLink}
        onPress={() => router.push(`/(app)/events/${id}/recap` as never)}
        activeOpacity={0.8}
      >
        <Text style={opSt.backLinkText}>← Back to recap</Text>
      </TouchableOpacity>
    </View>
  )
}

const opSt = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.xl },
  title: { ...typography.heading2, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary },
  options: { gap: spacing.sm, marginBottom: spacing.lg },
  note: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xl,
  },
  noteText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  shareEmoji: { fontSize: 28 },
  shareText: { flex: 1 },
  shareTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  shareSub: { ...typography.bodySmall, color: colors.textSecondary },
  shareArrow: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  backLink: { alignItems: 'center', paddingVertical: spacing.md },
  backLinkText: { color: colors.textSecondary, fontSize: 14 },
})

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statusRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  statusTitle: { ...typography.heading3, color: colors.text, textAlign: 'center' },
  statusSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  progressWrap: { width: '100%', paddingHorizontal: spacing.lg },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  cancelBtnText: { color: colors.error, fontSize: 15, fontWeight: '600' },
  doneRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: { ...typography.heading2, color: colors.success, textAlign: 'center' },
  doneSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  actionBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  shareAppCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    marginTop: spacing.xl,
  },
  shareAppEmoji: { fontSize: 28 },
  shareAppText: { flex: 1 },
  shareAppTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  shareAppSub: { ...typography.bodySmall, color: colors.textSecondary },
  shareAppBtn: {
    backgroundColor: colors.accentSubtle,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  shareAppBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  errorEmoji: { fontSize: 48 },
  errorTitle: { ...typography.heading3, color: colors.error, textAlign: 'center' },
  errorSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
})
