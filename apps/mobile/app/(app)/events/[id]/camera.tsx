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
 *
 * Bug fixes vs previous version:
 *   - Video recording now uses proper async pattern with stopRecording
 *   - Better error messages (permission vs capture vs device errors)
 *   - Flash state reflected properly in CameraView mode prop
 *   - Gallery picker respects mediaType correctly
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, borderRadius } from '@/lib/design'

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = 'photo' | 'video' | 'any'
type CameraFacing = 'back' | 'front'
type FlashMode = 'off' | 'on' | 'auto'

// ─── Duration display ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Permission screen ────────────────────────────────────────────────────────

function PermissionScreen({
  title, message, onAllow, onBack,
}: { title: string; message: string; onAllow: () => void; onBack: () => void }) {
  return (
    <View style={p.root}>
      <Text style={p.emoji}>📷</Text>
      <Text style={p.title}>{title}</Text>
      <Text style={p.desc}>{message}</Text>
      <TouchableOpacity style={p.allowBtn} onPress={onAllow} activeOpacity={0.8}>
        <Text style={p.allowText}>Allow Access</Text>
      </TouchableOpacity>
      <TouchableOpacity style={p.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={p.backText}>← Go back</Text>
      </TouchableOpacity>
    </View>
  )
}

const p = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  allowBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  allowText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { paddingVertical: spacing.sm },
  backText: { color: colors.textSecondary, fontSize: 15 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const { assignmentId, mediaType, eventId } = useLocalSearchParams<{
    assignmentId: string
    mediaType:    MediaType
    eventId:      string
  }>()

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [micPermission, requestMicPermission]       = useMicrophonePermissions()
  const [facing, setFacing]       = useState<CameraFacing>('back')
  const [flash, setFlash]         = useState<FlashMode>('off')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs]   = useState(0)
  const [capturing, setCapturing]     = useState(false)

  const cameraRef    = useRef<CameraView>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false) // track recording state for the timer closure

  const MAX_VIDEO_SECONDS = 60
  const isVideoMode = mediaType === 'video'
  // For 'any' mode, show photo capture button (user can also use gallery for video)
  const captureIsVideo = isVideoMode

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Permissions ───────────────────────────────────────────────────────────

  if (!cameraPermission) {
    return (
      <View style={cs.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!cameraPermission.granted) {
    return (
      <PermissionScreen
        title="Camera access needed"
        message="LastNite needs camera access to capture your mission submissions."
        onAllow={requestCameraPermission}
        onBack={() => router.back()}
      />
    )
  }

  if (captureIsVideo && !micPermission?.granted) {
    return (
      <PermissionScreen
        title="Microphone access needed"
        message="LastNite needs microphone access to record video with sound."
        onAllow={async () => {
          await requestMicPermission()
        }}
        onBack={() => router.back()}
      />
    )
  }

  // ── Navigate to preview ───────────────────────────────────────────────────

  function goToPreview(uri: string, type: 'photo' | 'video') {
    router.push(
      `/(app)/events/${eventId}/preview?assignmentId=${assignmentId}&mediaUri=${encodeURIComponent(uri)}&mediaType=${type}&eventId=${eventId}` as never,
    )
  }

  // ── Photo capture ─────────────────────────────────────────────────────────

  async function takePhoto() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
        exif: false,
      })
      if (photo?.uri) goToPreview(photo.uri, 'photo')
      else Alert.alert('Capture failed', 'Could not capture photo. Please try again.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.toLowerCase().includes('permission')) {
        Alert.alert('Permission denied', 'Camera permission was revoked. Please re-enable it in Settings.')
      } else {
        Alert.alert('Capture failed', 'Could not take photo. Please try again.')
      }
    } finally {
      setCapturing(false)
    }
  }

  // ── Video recording ───────────────────────────────────────────────────────

  async function startRecording() {
    if (!cameraRef.current || isRecording) return
    setIsRecording(true)
    setRecordSecs(0)
    recordingRef.current = true

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        const next = s + 1
        if (next >= MAX_VIDEO_SECONDS) {
          stopRecording()
        }
        return next
      })
    }, 1000)

    try {
      // recordAsync resolves when recording stops
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
      })
      if (video?.uri) {
        goToPreview(video.uri, 'video')
      } else {
        Alert.alert('Recording error', 'No video was recorded. Please try again.')
      }
    } catch (err: unknown) {
      // Recording can throw when stopRecording() is called — that's expected
      const msg = err instanceof Error ? err.message : ''
      // Only show alert for unexpected errors
      if (!msg.toLowerCase().includes('stop') && !msg.toLowerCase().includes('abort') && recordingRef.current) {
        Alert.alert('Recording failed', 'Could not record video. Check that the app has microphone access in Settings.')
      }
    } finally {
      recordingRef.current = false
      setIsRecording(false)
      setRecordSecs(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  function stopRecording() {
    if (!cameraRef.current || !recordingRef.current) return
    recordingRef.current = false
    cameraRef.current.stopRecording()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function handleCapturePress() {
    if (captureIsVideo) {
      isRecording ? stopRecording() : startRecording()
    } else {
      takePhoto()
    }
  }

  // ── Gallery fallback ──────────────────────────────────────────────────────

  async function openGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access in Settings to use gallery.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        mediaType === 'photo'   ? ImagePicker.MediaTypeOptions.Images
        : mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos
        :                         ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: false,
      videoMaxDuration: 120,
    })

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      const type = asset.type === 'video' ? 'video' : 'photo'
      goToPreview(asset.uri, type)
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  const flashLabel = flash === 'off' ? '⚡ Off' : flash === 'on' ? '⚡ On' : '⚡ Auto'

  function cycleFlash() {
    setFlash((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off')
  }

  const captureLabel = captureIsVideo
    ? isRecording ? '⏹ Stop' : '● Record'
    : '📸'

  return (
    <View style={cs.root}>
      <CameraView
        ref={cameraRef}
        style={cs.camera}
        facing={facing}
        flash={flash}
        mode={captureIsVideo ? 'video' : 'picture'}
        videoQuality="720p"
      >
        {/* Top controls */}
        <View style={cs.topOverlay}>
          <TouchableOpacity style={cs.overlayBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={cs.overlayBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={cs.topMiddle}>
            {isRecording && (
              <View style={cs.recIndicator}>
                <View style={cs.recDot} />
                <Text style={cs.recTime}>{formatDuration(recordSecs)}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={cs.overlayBtn} onPress={cycleFlash} activeOpacity={0.8}>
            <Text style={cs.overlayBtnText}>{flashLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={cs.bottomOverlay}>
          {/* Flip */}
          <TouchableOpacity
            style={cs.sideBtn}
            onPress={() => setFacing((f) => f === 'back' ? 'front' : 'back')}
            activeOpacity={0.8}
            disabled={isRecording}
          >
            <Text style={cs.sideBtnText}>🔄</Text>
          </TouchableOpacity>

          {/* Capture */}
          <TouchableOpacity
            style={[
              cs.captureBtn,
              isRecording && cs.captureBtnRec,
              (capturing || (captureIsVideo && isRecording && recordSecs === 0)) && cs.captureBtnDisabled,
            ]}
            onPress={handleCapturePress}
            activeOpacity={0.85}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={cs.captureBtnText}>{captureLabel}</Text>
            )}
          </TouchableOpacity>

          {/* Spacer */}
          <View style={cs.sideBtn} />
        </View>
      </CameraView>

      {/* Gallery fallback */}
      <TouchableOpacity
        style={cs.galleryLink}
        onPress={openGallery}
        activeOpacity={0.8}
        disabled={isRecording}
      >
        <Text style={cs.galleryLinkText}>Use gallery instead</Text>
      </TouchableOpacity>
    </View>
  )
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Top overlay
  topOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.xl,
    paddingBottom: spacing.md,
  },
  topMiddle: { flex: 1, alignItems: 'center' },
  overlayBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 56,
    alignItems: 'center',
  },
  overlayBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  recTime: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Bottom overlay
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
  sideBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  sideBtnText: { fontSize: 28 },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  captureBtnRec: { backgroundColor: colors.error, borderColor: 'rgba(255,255,255,0.5)' },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  // Gallery
  galleryLink: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  galleryLinkText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
})
