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
 * proper error categorisation (network, permission, upload, etc.)
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
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as FileSystem from 'expo-file-system'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadPhase = 'idle' | 'uploading' | 'success' | 'error' | 'offline'

interface UploadState {
  phase:    UploadPhase
  progress: number
  message:  string | null
}

const IDLE: UploadState    = { phase: 'idle',    progress: 0,   message: null }
const OFFLINE: UploadState = { phase: 'offline', progress: 0,   message: 'No internet connection. Connect and retry.' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function getMimeType(uri: string, mediaType: 'photo' | 'video'): string {
  const lower = uri.toLowerCase()
  if (mediaType === 'video') {
    if (lower.includes('.mov') || lower.includes('mov')) return 'video/quicktime'
    return 'video/mp4'
  }
  if (lower.includes('.png')) return 'image/png'
  return 'image/jpeg'
}

/**
 * Lightweight connectivity check using a HEAD request to a known endpoint.
 * Avoids false negatives from google being blocked.
 * Returns true if we can reach the network at all.
 */
async function checkConnectivity(): Promise<boolean> {
  // On web, assume connected (navigator.onLine is more reliable)
  if (Platform.OS === 'web') return navigator.onLine !== false

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    // Use Cloudflare's 1.1.1.1 which is extremely reliable and fast
    const res = await fetch('https://1.1.1.1/', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
    return res.ok || res.status < 500 // any response = we have connectivity
  } catch {
    // If that fails too, we're truly offline
    return false
  }
}

function categoriseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()

  if (lower.includes('cancelled') || lower.includes('cancel')) {
    return 'Upload cancelled.'
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
    return 'Network error. Check your connection and retry.'
  }
  if (lower.includes('403') || lower.includes('401')) {
    return 'Permission denied. Try rejoining the event.'
  }
  if (lower.includes('413') || lower.includes('too large')) {
    return 'File is too large. Try a shorter video or lower quality photo.'
  }
  if (lower.includes('status 4') || lower.includes('status 5')) {
    return `Upload failed (${msg}). Please retry.`
  }
  return 'Upload failed. Please retry.'
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
      onProgress(5 + attempt * 2)

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
      onProgress(20)

      // Step 2: Upload file to signed URL using expo-file-system
      // This handles large files better than fetch() and supports progress tracking
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, mediaUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      })

      if (signal.aborted) throw new Error('Cancelled')

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload responded with status ${uploadResult.status}`)
      }

      onProgress(85)

      // Step 3: Confirm submission
      await apiClient.post(`/events/${eventId}/submissions/${submissionId}/confirm`)
      onProgress(100)

      // Invalidate live event query so dashboard refreshes
      await queryClient.invalidateQueries({ queryKey: ['live', eventId] })
      return // success

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (signal.aborted) throw new Error('Cancelled')
      if (lastError.message === 'Cancelled') throw lastError

      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt - 1) * 1500
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
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: borderRadius.full },
})

// ─── Error Banner ─────────────────────────────────────────────────────────────

function StatusBanner({ state }: { state: UploadState }) {
  if (state.phase === 'offline') {
    return (
      <View style={[banner.base, banner.offline]}>
        <Text style={banner.icon}>📡</Text>
        <View>
          <Text style={banner.title}>No internet connection</Text>
          <Text style={banner.sub}>Connect to Wi-Fi or mobile data, then retry.</Text>
        </View>
      </View>
    )
  }
  if (state.phase === 'error') {
    return (
      <View style={[banner.base, banner.error]}>
        <Text style={banner.icon}>⚠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={banner.title}>Upload failed</Text>
          <Text style={banner.sub}>{state.message ?? 'Check your connection and retry.'}</Text>
        </View>
      </View>
    )
  }
  if (state.phase === 'success') {
    return (
      <View style={[banner.base, banner.success]}>
        <Text style={banner.icon}>✅</Text>
        <View>
          <Text style={[banner.title, { color: colors.success }]}>Submitted!</Text>
          <Text style={banner.sub}>Returning to event...</Text>
        </View>
      </View>
    )
  }
  return null
}

const banner = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  offline: { backgroundColor: colors.bgCard, borderColor: colors.border },
  error: {
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderColor: colors.error,
  },
  success: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: colors.success,
    alignItems: 'center',
  },
  icon: { fontSize: 20 },
  title: { ...typography.body, color: colors.text, fontWeight: '700' },
  sub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const { assignmentId, mediaUri, mediaType, eventId } = useLocalSearchParams<{
    assignmentId: string
    mediaUri:     string
    mediaType:    'photo' | 'video'
    eventId:      string
  }>()

  const decodedUri = decodeURIComponent(mediaUri ?? '')
  const [state, setState]               = useState<UploadState>(IDLE)
  const [abortController, setAbortCtrl] = useState<AbortController | null>(null)

  const startUpload = useCallback(async () => {
    // 1. Check connectivity before attempting upload
    const online = await checkConnectivity()
    if (!online) {
      setState(OFFLINE)
      return
    }

    const controller = new AbortController()
    setAbortCtrl(controller)
    setState({ phase: 'uploading', progress: 0, message: null })

    try {
      await uploadSubmission(
        eventId!,
        assignmentId!,
        decodedUri,
        mediaType ?? 'photo',
        (pct) => {
          if (!controller.signal.aborted) {
            setState({ phase: 'uploading', progress: pct, message: null })
          }
        },
        controller.signal,
      )
      setState({ phase: 'success', progress: 100, message: null })
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Cancelled') return

      // Distinguish between offline and other errors
      const stillOnline = await checkConnectivity()
      if (!stillOnline) {
        setState(OFFLINE)
      } else {
        setState({ phase: 'error', progress: 0, message: categoriseError(err) })
      }
    } finally {
      setAbortCtrl(null)
    }
  }, [eventId, assignmentId, decodedUri, mediaType])

  // Auto-navigate on success
  useEffect(() => {
    if (state.phase === 'success') {
      const timeout = setTimeout(() => {
        router.replace(`/(app)/events/${eventId}` as never)
      }, 1800)
      return () => clearTimeout(timeout)
    }
  }, [state.phase, eventId])

  const isUploading = state.phase === 'uploading'
  const isSuccess   = state.phase === 'success'
  const isIdle      = state.phase === 'idle'
  const canRetry    = state.phase === 'error' || state.phase === 'offline'

  return (
    <View style={s.root}>
      {/* Media preview */}
      <View style={s.previewContainer}>
        {mediaType === 'video' ? (
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
        <StatusBanner state={state} />

        {isUploading && (
          <View style={s.progressBlock}>
            <Text style={s.progressLabel}>
              Uploading... {Math.round(state.progress)}%
            </Text>
            <ProgressBar progress={state.progress} />
          </View>
        )}

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

            {(isIdle || canRetry) && (
              <TouchableOpacity style={s.useBtn} onPress={startUpload} activeOpacity={0.85}>
                <Text style={s.useBtnText}>
                  {canRetry ? 'Retry →' : 'Submit →'}
                </Text>
              </TouchableOpacity>
            )}

            {isUploading && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  if (abortController) abortController.abort()
                  setState(IDLE)
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
    minHeight: 160,
  },
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
  useBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
