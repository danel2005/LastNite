/**
 * Feed Tab — global feed placeholder.
 * Directs users to their event feeds until a global feed is built.
 */

import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing, typography } from '@/lib/design'

export default function FeedScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Feed</Text>
      </View>
      <View style={s.centered}>
        <Text style={s.emoji}>✨</Text>
        <Text style={s.label}>Your moments live inside events</Text>
        <Text style={s.sub}>
          Go to an active or past event to see the shared feed of captures.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  label: { ...typography.heading3, color: colors.text, textAlign: 'center' },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
