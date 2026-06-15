/**
 * Camera Screen
 *
 * Handles photo and video capture for mission completion.
 * Supports flash toggle, camera flip, and gallery fallback.
 * On capture: navigates to preview screen with the media URI.
 *
 * Route params:
 *   assignmentId — the mission assignment being completed
 *   mediaType    — 'photo' | 'video' | 'any'
 *   eventId      — needed for upload in preview screen
 */

import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, borderRadius, typography } from '@/lib/design'

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = 'photo' | 'video' | 'any'

// ─── Duration display ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const { assignmentId, mediaType, eventId } = useLocalSearchParams<{
    assignmentId: string
    mediaType: MediaType
    eventId: string
  }>()

  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [flash, setFlash] = useState<FlashMode>('off')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const cameraRef = useRef<CameraView>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const MAX_VIDEO_SECONDS = 60

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  // ── Permission not yet determined ─────────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={s.centered}>
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permDesc}>
          LastNite needs camera access to capture your mission submissions.
        </Text>
        <TouchableOpacity style={s.permButton} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={s.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={s.backButtonText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function navigateToPreview(uri: string, type: 'photo' | 'video') {
    router.push(
      `/(app)/events/${eventId}/preview?assignmentId=${assignmentId}&mediaUri=${encodeURIComponent(uri)}&mediaType=${type}&eventId=${eventId}` as never,
    )
  }

  async function takePhoto() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      })
      if (photo?.uri) {
        navigateToPreview(photo.uri, 'photo')
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  async function startRecording() {
    if (!cameraRef.current || isRecording) return
    setIsRecording(true)
    setRecordingSeconds(0)
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        if (s + 1 >= MAX_VIDEO_SECONDS) {
          stopRecording()
        }
        return s + 1
      })
    }, 1000)
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_VIDEO_SECONDS })
      if (video?.uri) {
        navigateToPreview(video.uri, 'video')
      }
    } catch {
      // Recording stopped externally — this is expected
    } finally {
      setIsRecording(false)
      setRecordingSeconds(0)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  async function stopRecording() {
    if (!cameraRef.current || !isRecording) return
    cameraRef.current.stopRecording()
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  function handleCapturePress() {
    if (mediaType === 'video') {
      if (isRecording) {
        stopRecording()
      } else {
        startRecording()
      }
    } else {
      // photo or any → take photo
      takePhoto()
    }
  }

  async function openGallery() {
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes:
        mediaType === 'photo'
          ? ImagePicker.MediaTypeOptions.Images
          : mediaType === 'video'
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      allowsEditing: false,
    }
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions)
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      const type = asset.type === 'video' ? 'video' : 'photo'
      navigateToPreview(asset.uri, type)
    }
  }

  // ── Capture button label ──────────────────────────────────────────────────
  const isVideoMode = mediaType === 'video'
  const captureLabel = isVideoMode
    ? isRecording
      ? '⏹ Stop'
      : '● Record'
    : '📸 Capture'

  const flashLabel = flash === 'off' ? '⚡ Off' : flash === 'on' ? '⚡ On' : '⚡ Auto'

  function cycleFlash() {
    setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))
  }

  return (
    <View style={s.root}>
      {/* Camera viewfinder */}
      <CameraView
        ref={cameraRef}
        style={s.camera}
        facing={facing}
        flash={flash}
        mode={isVideoMode ? 'video' : 'picture'}
      >
        {/* Top controls overlay */}
        <View style={s.topOverlay}>
          <TouchableOpacity style={s.overlayBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.overlayBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={s.topMiddle}>
            {isRecording && (
              <View style={s.recordingIndicator}>
                <View style={s.recordingDot} />
                <Text style={s.recordingTime}>{formatDuration(recordingSeconds)}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.overlayBtn} onPress={cycleFlash} activeOpacity={0.8}>
            <Text style={s.overlayBtnText}>{flashLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls overlay */}
        <View style={s.bottomOverlay}>
          {/* Flip camera */}
          <TouchableOpacity
            style={s.sideBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            activeOpacity={0.8}
            disabled={isRecording}
          >
            <Text style={s.sideBtnText}>🔄</Text>
          </TouchableOpacity>

          {/* Main capture button */}
          <TouchableOpacity
            style={[
              s.captureBtn,
              isRecording && s.captureBtnRecording,
              capturing && s.captureBtnDisabled,
            ]}
            onPress={handleCapturePress}
            activeOpacity={0.85}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={s.captureBtnText}>{captureLabel}</Text>
            )}
          </TouchableOpacity>

          {/* Spacer to center capture button */}
          <View style={s.sideBtn} />
        </View>
      </CameraView>

      {/* Gallery fallback */}
      <TouchableOpacity style={s.galleryLink} onPress={openGallery} activeOpacity={0.8} disabled={isRecording}>
        <Text style={s.galleryLinkText}>Use gallery instead</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  permTitle: { ...typography.heading2, color: colors.text, textAlign: 'center' },
  permDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  permButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  permButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  backButton: { paddingVertical: spacing.sm },
  backButtonText: { color: colors.textSecondary, fontSize: 15 },
  // Overlay controls
  topOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  topMiddle: { flex: 1, alignItems: 'center' },
  overlayBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 52,
    alignItems: 'center',
  },
  overlayBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordingTime: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottomOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  sideBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnText: { fontSize: 28 },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureBtnRecording: {
    backgroundColor: colors.error,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: { color: colors.bg, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  galleryLink: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  galleryLinkText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
})
