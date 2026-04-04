/**
 * Settings Screen
 *
 * Sections:
 *   - Profile (avatar, display name, bio)
 *   - Mission opt-out preferences
 *   - Account (change password, delete account, sign out)
 */

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Preferences {
  disablePublicSocial:   boolean
  disableAlcoholRefs:    boolean
  disableIntensityAbove: number | null
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.text}>{title}</Text>
}

const sh = StyleSheet.create({
  text: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label, description, value, onChange, disabled,
}: {
  label:        string
  description?: string
  value:        boolean
  onChange:     (v: boolean) => void
  disabled?:    boolean
}) {
  return (
    <View style={trSt.row}>
      <View style={trSt.text}>
        <Text style={trSt.label}>{label}</Text>
        {description && <Text style={trSt.desc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bgElevated, true: colors.accent }}
        thumbColor="#fff"
        disabled={disabled}
      />
    </View>
  )
}

const trSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  desc: { ...typography.bodySmall, color: colors.textSecondary },
})

// ─── Intensity selector ───────────────────────────────────────────────────────

const INTENSITY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'All missions' },
  { value: 2,    label: 'Skip 3+' },
  { value: 3,    label: 'Skip 4+' },
  { value: 4,    label: 'Skip 5 only' },
]

function IntensitySelector({
  value, onChange, disabled,
}: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  return (
    <View style={isSt.container}>
      {INTENSITY_OPTIONS.map((opt) => {
        const selected = opt.value === value
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[isSt.option, selected && isSt.optionSelected]}
            onPress={() => !disabled && onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[isSt.optionText, selected && isSt.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const isSt = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  optionText: { ...typography.label, color: colors.textSecondary },
  optionTextSelected: { color: colors.accent },
})

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  visible, onClose,
}: { visible: boolean; onClose: () => void }) {
  const [step, setStep]           = useState<'verify' | 'newpass'>('verify')
  const [code, setCode]           = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function reset() {
    setStep('verify'); setCode(''); setNewPw(''); setConfirmPw(''); setError(null)
  }

  async function requestCode() {
    setLoading(true); setError(null)
    try {
      await apiClient.post('/me/change-password/request')
      setStep('verify')
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send code.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (code.length < 6) { setError('Enter the 6-digit code.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    try {
      await apiClient.post('/me/change-password/verify', { token: code, newPassword: newPw })
      Alert.alert('Password changed', 'Your password has been updated.')
      reset()
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cpSt.backdrop} onPress={onClose}>
        <Pressable style={cpSt.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={cpSt.handle} />
          <Text style={cpSt.title}>Change Password</Text>

          {error && <Text style={cpSt.error}>{error}</Text>}

          {step === 'verify' ? (
            <>
              <Text style={cpSt.hint}>We'll send a verification code to your phone number.</Text>
              <TouchableOpacity style={cpSt.primaryBtn} onPress={requestCode} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={cpSt.primaryBtnText}>Send code →</Text>}
              </TouchableOpacity>
              <Text style={[cpSt.hint, { marginTop: spacing.lg }]}>Already have the code?</Text>
              <TextInput
                style={cpSt.input}
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                placeholder="000000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              <TextInput
                style={cpSt.input}
                value={newPw}
                onChangeText={(v) => { setNewPw(v); setError(null) }}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
              <TextInput
                style={cpSt.input}
                value={confirmPw}
                onChangeText={(v) => { setConfirmPw(v); setError(null) }}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
              <TouchableOpacity
                style={[cpSt.primaryBtn, (code.length < 6 || newPw.length < 8) && cpSt.disabled]}
                onPress={handleVerify}
                disabled={loading || code.length < 6 || newPw.length < 8}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={cpSt.primaryBtnText}>Set new password</Text>}
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity style={cpSt.cancelBtn} onPress={() => { reset(); onClose() }}>
            <Text style={cpSt.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const cpSt = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 36,
    gap: spacing.sm,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.heading3, color: colors.text, marginBottom: spacing.sm },
  hint: { ...typography.bodySmall, color: colors.textSecondary },
  error: { color: colors.error, fontSize: 13 },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  cancelBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const profile     = useAuthStore((s) => s.profile)
  const setProfile  = useAuthStore((s) => s.setProfile)
  const clearSession = useAuthStore((s) => s.clearSession)
  const qc          = useQueryClient()

  const [displayName, setDisplayName]     = useState(profile?.displayName ?? '')
  const [bio, setBio]                     = useState((profile as { bio?: string })?.bio ?? '')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileSaving, setProfileSaving]   = useState(false)
  const [showChangePw, setShowChangePw]     = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const { data: prefsData, isLoading: prefsLoading } = useQuery<Preferences>({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/me/preferences')
      return res.data as Preferences
    },
  })

  const [localPrefs, setLocalPrefs] = useState<Preferences | null>(null)

  useEffect(() => {
    if (prefsData && !localPrefs) setLocalPrefs(prefsData)
  }, [prefsData]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async (prefs: Partial<Preferences>) => {
      await apiClient.put('/me/preferences', prefs)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preferences'] }),
    onError: () => Alert.alert('Error', 'Failed to save preferences.'),
  })

  function updatePref<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const updated = { ...localPrefs!, [key]: value }
    setLocalPrefs(updated)
    saveMutation.mutate({ [key]: value })
  }

  async function saveProfile() {
    const name = displayName.trim()
    if (!name || name.length < 2) {
      Alert.alert('Display name must be at least 2 characters.')
      return
    }
    setProfileSaving(true)
    try {
      const res = await apiClient.put('/me/profile', {
        displayName: name,
        bio: bio.trim() || null,
      })
      const data = res.data as { profile: typeof profile }
      if (data.profile) setProfile(data.profile as never)
      setEditingProfile(false)
    } catch {
      Alert.alert('Error', 'Failed to save profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setAvatarUploading(true)
    try {
      // Get signed upload URL
      const initRes = await apiClient.post('/me/avatar')
      const { uploadUrl, storageKey } = initRes.data as { uploadUrl: string; storageKey: string }

      // Upload the image
      await FileSystem.uploadAsync(uploadUrl, asset.uri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      })

      // Confirm with backend
      const confirmRes = await apiClient.post('/me/avatar/confirm', { storageKey })
      const data = confirmRes.data as { profile: typeof profile }
      if (data.profile) setProfile(data.profile as never)
    } catch {
      Alert.alert('Error', 'Failed to upload avatar. Please try again.')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearSession()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/me')
              await clearSession()
              router.replace('/')
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.')
            }
          },
        },
      ],
    )
  }

  const saving = saveMutation.isPending
  const prefs  = localPrefs ?? prefsData
  const avatarUri = (profile as { avatarUrl?: string })?.avatarUrl
  const initial   = (profile?.displayName?.[0] ?? '?').toUpperCase()

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile card ── */}
        <View style={s.profileCard}>
          <TouchableOpacity onPress={handlePickAvatar} style={s.avatarContainer} activeOpacity={0.8}>
            {avatarUploading ? (
              <View style={s.avatar}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImage} />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Text style={s.avatarEditText}>✏</Text>
            </View>
          </TouchableOpacity>

          {editingProfile ? (
            <View style={s.profileEditForm}>
              <TextInput
                style={s.nameInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor={colors.textTertiary}
                maxLength={50}
                autoFocus
              />
              <TextInput
                style={[s.nameInput, s.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Short bio (optional)"
                placeholderTextColor={colors.textTertiary}
                maxLength={200}
                multiline
              />
              <View style={s.profileEditActions}>
                <TouchableOpacity
                  style={s.saveBtn}
                  onPress={saveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.cancelEditBtn}
                  onPress={() => {
                    setDisplayName(profile?.displayName ?? '')
                    setBio((profile as { bio?: string })?.bio ?? '')
                    setEditingProfile(false)
                  }}
                >
                  <Text style={s.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.profileInfo}>
              <Text style={s.displayName}>{profile?.displayName ?? 'Unknown'}</Text>
              {bio ? <Text style={s.bioText}>{bio}</Text> : null}
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={s.editProfileBtn}>
                <Text style={s.editProfileText}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Mission preferences ── */}
        <SectionHeader title="Mission Preferences" />

        {prefsLoading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.loadingText}>Loading preferences...</Text>
          </View>
        ) : prefs ? (
          <>
            <ToggleRow
              label="Disable public/social missions"
              description="Skip missions that require public interaction or involve strangers"
              value={prefs.disablePublicSocial}
              onChange={(v) => updatePref('disablePublicSocial', v)}
              disabled={saving}
            />
            <ToggleRow
              label="Disable alcohol references"
              description="Skip missions that reference drinking or alcohol"
              value={prefs.disableAlcoholRefs}
              onChange={(v) => updatePref('disableAlcoholRefs', v)}
              disabled={saving}
            />
            <View style={s.intensitySection}>
              <Text style={s.intensityLabel}>Mission intensity limit</Text>
              <Text style={s.intensityDesc}>Skip missions above this level (1 = easy, 5 = chaos)</Text>
              <IntensitySelector
                value={prefs.disableIntensityAbove}
                onChange={(v) => updatePref('disableIntensityAbove', v)}
                disabled={saving}
              />
            </View>
          </>
        ) : null}

        {/* ── Account ── */}
        <SectionHeader title="Account" />

        <TouchableOpacity style={s.actionRow} onPress={() => setShowChangePw(true)} activeOpacity={0.8}>
          <Text style={s.actionText}>Change password</Text>
          <Text style={s.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionRow} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={s.actionText}>Sign out</Text>
          <Text style={s.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.actionRow, s.dangerRow]} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Text style={s.dangerText}>Delete account</Text>
        </TouchableOpacity>

      </ScrollView>

      <ChangePasswordModal visible={showChangePw} onClose={() => setShowChangePw(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSubtle,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.accent },
  avatarText: { color: colors.accent, fontSize: 24, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditText: { fontSize: 10, color: '#fff' },
  profileInfo: { flex: 1, gap: 3 },
  displayName: { ...typography.heading3, color: colors.text },
  bioText: { ...typography.bodySmall, color: colors.textSecondary },
  editProfileBtn: { marginTop: 6 },
  editProfileText: { color: colors.indigo, fontSize: 13, fontWeight: '600' },
  profileEditForm: { flex: 1, gap: spacing.sm },
  nameInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 15,
  },
  bioInput: { minHeight: 60, textAlignVertical: 'top' },
  profileEditActions: { flexDirection: 'row', gap: spacing.sm },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelEditBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelEditText: { color: colors.textSecondary, fontSize: 14 },

  // Misc
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { ...typography.bodySmall, color: colors.textSecondary },
  intensitySection: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  intensityDesc: { ...typography.bodySmall, color: colors.textSecondary },

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { ...typography.body, color: colors.text },
  actionChevron: { color: colors.textTertiary, fontSize: 20 },
  dangerRow: {
    borderColor: colors.error,
    backgroundColor: 'rgba(244,63,94,0.06)',
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  dangerText: { color: colors.error, fontSize: 16, fontWeight: '600' },
})
