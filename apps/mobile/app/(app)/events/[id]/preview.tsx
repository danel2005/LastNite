/**
 * Preview Screen
 *
 * Shows captured photo/video before upload.
 * Handles the full upload flow:
 *   1. POST /events/:id/submissions/init
 *   2. PUT to Supabase signed URL
 *   3. POST /events/:id/submissions/:id/confirm
 *
 * Has retry logic (3 attempts, exponential backoff) and
 * network loss detection.
 *
 * Route params: assignmentId, mediaUri, mediaType, eventId
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  AppState,
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as FileSystem from 'expo-file-system'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number }
  | { phase: 'success' }
  | { phase: 'error'; message: string; attempt: number }
  | { phase: 'offline' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function getMimeType(uri: string, mediaType: 'photo' | 'video'): string {
  const lower = uri.toLowerCase()
  if (mediaType === 'video') {
    if (lower.endsWith('.mov')) return 'video/quicktime'
    return 'video/mp4'
  }
  if (lower.endsWith('.png')) return 'image/png'
  return 'image/jpeg'
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return true
  } catch {
    return false
  }
}

// ─── Upload function with retry ───────────────────────────────────────────────

async function uploadSubmission(
  eventId: string,
  assignmentId: string,
  mediaUri: string,
  mediaType: 'photo' | 'video',
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const mimeType = getMimeType(mediaUri, mediaType)
  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new Error('Cancelled')

    try {
      onProgress(5)

      // Step 1: Init submission — get upload URL
      const initRes = await apiClient.post(`/events/${eventId}/submissions/init`, {
        assignmentId,
        mediaType,
        mimeType,
      })
      const { submissionId, uploadUrl } = initRes.data as {
        submissionId: string
        uploadUrl: string
      }

      if (signal.aborted) throw new Error('Cancelled')
      onProgress(15)

      // Step 2: Upload file to signed URL
      // expo-file-system uploadAsync gives us progress callbacks
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, mediaUri, {
        httpMethod: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      })

      if (signal.aborted) throw new Error('Cancelled')

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`)
      }

      onProgress(85)

      // Step 3: Confirm submission
      await apiClient.post(`/events/${eventId}/submissions/${submissionId}/confirm`)
      onProgress(100)

      // Invalidate live event query so dashboard refreshes
      await queryClient.invalidateQueries({ queryKey: ['live', eventId] })
      return // success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error')

      if (signal.aborted) throw new Error('Cancelled')

      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
        await sleep(backoffMs)
      }
    }
  }

  throw lastError ?? new Error('Upload failed after retries')
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${Math.min(100, progress)}%` }]} />
    </View>
  )
}

const pb = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const { assignmentId, mediaUri, mediaType, eventId } = useLocalSearchParams<{
    assignmentId: string
    mediaUri: string
    mediaType: 'photo' | 'video'
    eventId: string
  }>()

  const decodedUri = decodeURIComponent(mediaUri ?? '')
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' })
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Detect app going background (network loss hint)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && uploadState.phase === 'uploading') {
        // Keep uploading in background via foreground session — just note it
      }
    })
    return () => sub.remove()
  }, [uploadState.phase])

  const startUpload = useCallback(async () => {
    // Check connectivity first
    const online = await checkConnectivity()
    if (!online) {
      setUploadState({ phase: 'offline' })
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setUploadState({ phase: 'uploading', progress: 0 })

    try {
      await uploadSubmission(
        eventId!,
        assignmentId!,
        decodedUri,
        mediaType ?? 'photo',
        (pct) => {
          if (!controller.signal.aborted) {
            setUploadState({ phase: 'uploading', progress: pct })
          }
        },
        controller.signal,
      )
      setUploadState({ phase: 'success' })
    } catch (err) {
      if (controller.signal.aborted) return // user cancelled
      const msg = err instanceof Error ? err.message : 'Upload failed'

      // Check if it's an offline error
      const stillOnline = await checkConnectivity()
      if (!stillOnline) {
        setUploadState({ phase: 'offline' })
      } else {
        setUploadState({ phase: 'error', message: msg, attempt: 3 })
      }
    } finally {
      setAbortController(null)
    }
  }, [eventId, assignmentId, decodedUri, mediaType])

  // Auto-navigate on success
  useEffect(() => {
    if (uploadState.phase === 'success') {
      const timeout = setTimeout(() => {
        router.replace(`/(app)/events/${eventId}` as never)
      }, 1800)
      return () => clearTimeout(timeout)
    }
  }, [uploadState.phase, eventId])

  // ── Render ────────────────────────────────────────────────────────────────

  const isUploading = uploadState.phase === 'uploading'
  const isSuccess = uploadState.phase === 'success'
  const isIdle = uploadState.phase === 'idle'
  const isError = uploadState.phase === 'error'
  const isOffline = uploadState.phase === 'offline'

  return (
    <View style={s.root}>
      {/* Media preview */}
      <View style={s.previewContainer}>
        {mediaType === 'video' ? (
          // Video placeholder — show first frame indication
          <View style={s.videoPlaceholder}>
            <Text style={s.videoIcon}>🎬</Text>
            <Text style={s.videoLabel}>Video captured</Text>
            <Text style={s.videoSub}>Ready to submit</Text>
          </View>
        ) : (
          <Image
            source={{ uri: decodedUri }}
            style={s.previewImage}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Status + controls */}
      <View style={s.controls}>
        {isOffline && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineText}>📡 No internet connection</Text>
            <Text style={s.offlineSub}>Upload paused — waiting for connection</Text>
          </View>
        )}

        {isError && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>Upload failed</Text>
            <Text style={s.errorSub}>All retries exhausted. Check your connection.</Text>
          </View>
        )}

        {isSuccess && (
          <View style={s.successBanner}>
            <Text style={s.successEmoji}>✅</Text>
            <Text style={s.successText}>Submitted!</Text>
            <Text style={s.successSub}>Returning to event...</Text>
          </View>
        )}

        {isUploading && (
          <View style={s.progressBlock}>
            <Text style={s.progressLabel}>
              Uploading... {Math.round(uploadState.progress)}%
            </Text>
            <ProgressBar progress={uploadState.progress} />
          </View>
        )}

        {/* Buttons */}
        {!isSuccess && (
          <View style={s.buttonRow}>
            {/* Retake — go back to camera */}
            <TouchableOpacity
              style={[s.retakeBtn, isUploading && s.btnDisabled]}
              onPress={() => {
                if (abortController) abortController.abort()
                router.back()
              }}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <Text style={s.retakeBtnText}>← Retake</Text>
            </TouchableOpacity>

            {/* Use this / Retry */}
            {(isIdle || isError || isOffline) && (
              <TouchableOpacity
                style={s.useBtn}
                onPress={startUpload}
                activeOpacity={0.85}
              >
                <Text style={s.useBtnText}>
                  {isError || isOffline ? 'Retry →' : 'Use this →'}
                </Text>
              </TouchableOpacity>
            )}

            {isUploading && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  if (abortController) abortController.abort()
                  setUploadState({ phase: 'idle' })
                }}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  previewContainer: { flex: 1 },
  previewImage: { width: '100%', height: '100%' },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  videoIcon: { fontSize: 64 },
  videoLabel: { ...typography.heading3, color: colors.text },
  videoSub: { ...typography.body, color: colors.textSecondary },
  controls: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  offlineBanner: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  offlineText: { ...typography.body, color: colors.text, fontWeight: '700' },
  offlineSub: { ...typography.bodySmall, color: colors.textSecondary },
  errorBanner: {
    backgroundColor: 'rgba(255,92,92,0.12)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.xs,
  },
  errorText: { ...typography.body, color: colors.error, fontWeight: '700' },
  errorSub: { ...typography.bodySmall, color: colors.textSecondary },
  successBanner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  successEmoji: { fontSize: 48 },
  successText: { ...typography.heading2, color: colors.success },
  successSub: { ...typography.body, color: colors.textSecondary },
  progressBlock: { gap: spacing.sm },
  progressLabel: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  retakeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retakeBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  useBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  useBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.error, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
})
