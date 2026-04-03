import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, spacing, borderRadius, typography } from '@/lib/design'
import { apiClient } from '@/lib/api-client'
interface ApiParticipant {
  id: string
  userId: string
  user: { profile: { displayName: string } | null }
}

async function fetchParticipants(eventId: string): Promise<ApiParticipant[]> {
  const res = await apiClient.get(`/events/${eventId}/participants`)
  return (res.data as { participants: ApiParticipant[] }).participants ?? []
}

export default function CreateMissionScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'any'>('any')
  const [isSecret, setIsSecret] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: participants } = useQuery({
    queryKey: ['participants', eventId],
    queryFn: () => fetchParticipants(eventId!),
    enabled: !!eventId,
  })

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Enter a mission title')
      return
    }
    setLoading(true)
    try {
      await apiClient.post(`/events/${eventId}/missions/custom`, {
        title: title.trim(),
        description: description.trim() || title.trim(),
        mediaType,
        isSecret,
        targetUserId: targetUserId ?? undefined,
      })
      router.back()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create mission.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {isSecret && (
        <View style={s.secretBanner}>
          <Text style={s.secretBannerText}>🔒 Secret mission — only the assigned person will know</Text>
        </View>
      )}

      <Text style={s.label}>Mission title</Text>
      <TextInput
        style={s.input}
        value={title}
        onChangeText={setTitle}
        placeholder='e.g. "Take a photo of the host looking surprised"'
        placeholderTextColor={colors.textTertiary}
        maxLength={200}
        autoFocus
        multiline
      />

      <Text style={s.label}>Description (optional)</Text>
      <TextInput
        style={[s.input, s.inputMulti]}
        value={description}
        onChangeText={setDescription}
        placeholder="Extra context or rules for this mission..."
        placeholderTextColor={colors.textTertiary}
        maxLength={500}
        multiline
        numberOfLines={3}
      />

      <Text style={s.label}>Media type</Text>
      <View style={s.segmented}>
        {(['photo', 'video', 'any'] as const).map((mt) => (
          <TouchableOpacity
            key={mt}
            style={[s.seg, mediaType === mt && s.segActive]}
            onPress={() => setMediaType(mt)}
          >
            <Text style={[s.segText, mediaType === mt && s.segTextActive]}>
              {mt === 'photo' ? '📸 Photo' : mt === 'video' ? '🎥 Video' : '✨ Either'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Target participant (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.targetScroll}>
        <TouchableOpacity
          style={[s.targetChip, targetUserId === null && s.targetChipActive]}
          onPress={() => setTargetUserId(null)}
        >
          <Text style={[s.targetChipText, targetUserId === null && s.targetChipTextActive]}>
            Anyone
          </Text>
        </TouchableOpacity>
        {participants?.map((p) => (
          <TouchableOpacity
            key={p.userId}
            style={[s.targetChip, targetUserId === p.userId && s.targetChipActive]}
            onPress={() => setTargetUserId(p.userId)}
          >
            <Text style={[s.targetChipText, targetUserId === p.userId && s.targetChipTextActive]}>
              {p.user.profile?.displayName ?? 'Unknown'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <Text style={[s.toggleLabel, isSecret && { color: colors.secret }]}>
            {isSecret ? '🔒 Secret mission' : 'Secret mission'}
          </Text>
          <Text style={s.toggleDesc}>
            Recipient sees "Shhhh..." instead of the title. Revealed at the end.
          </Text>
        </View>
        <Switch
          value={isSecret}
          onValueChange={setIsSecret}
          trackColor={{ true: colors.secret }}
        />
      </View>

      <TouchableOpacity
        style={[s.createButton, (loading || !title.trim()) && s.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading || !title.trim()}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={s.createText}>Add mission</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  secretBanner: {
    backgroundColor: colors.secretSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.secret,
  },
  secretBannerText: { color: colors.secret, fontSize: 14, fontWeight: '600' },
  label: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.md },
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
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', gap: spacing.xs },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: colors.bg },
  targetScroll: { marginTop: spacing.xs },
  targetChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  targetChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  targetChipText: { color: colors.textSecondary, fontSize: 14 },
  targetChipTextActive: { color: colors.bg, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  toggleDesc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: { opacity: 0.4 },
  createText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
})
