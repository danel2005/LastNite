/**
 * Root Index
 *
 * - Authenticated users  → immediate redirect to /(app)/
 * - Loading             → branded splash
 * - Unauthenticated     → landing page with sign up / sign in CTAs
 */

import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
} from 'react-native'
import { Redirect, router } from 'expo-router'
import { useAuthStore } from '@/stores/auth-store'
import { colors, spacing, borderRadius, typography } from '@/lib/design'

// ─── How It Works modal ───────────────────────────────────────────────────────

interface HowItWorksProps {
  visible: boolean
  onClose: () => void
}

const HOW_IT_WORKS = [
  {
    emoji: '🎉',
    title: 'Create an Event',
    body: 'Set a name, pick a date, choose your vibe — house party, night out, trip, and more.',
  },
  {
    emoji: '🎯',
    title: 'Missions Drop',
    body: 'During the event everyone secretly receives timed missions — photo challenges, dares, and group moments.',
  },
  {
    emoji: '📸',
    title: 'Capture the Night',
    body: 'Snap photos and record videos to complete your missions. Nobody sees what missions anyone else has.',
  },
  {
    emoji: '🌅',
    title: 'The Reveal',
    body: "When it's over, everything is revealed. See who got what, compare submissions, relive the highlights.",
  },
]

function HowItWorksModal({ visible, onClose }: HowItWorksProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={hw.backdrop} onPress={onClose}>
        <Pressable style={hw.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={hw.handle} />
          <Text style={hw.title}>How it works</Text>

          {HOW_IT_WORKS.map((step, i) => (
            <View key={i} style={hw.step}>
              <View style={hw.stepIcon}>
                <Text style={hw.stepEmoji}>{step.emoji}</Text>
              </View>
              <View style={hw.stepText}>
                <Text style={hw.stepTitle}>{step.title}</Text>
                <Text style={hw.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={hw.closeBtn} onPress={onClose}>
            <Text style={hw.closeBtnText}>Got it!</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const hw = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.heading2, color: colors.text, marginBottom: spacing.lg },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepEmoji: { fontSize: 22 },
  stepText: { flex: 1 },
  stepTitle: { ...typography.heading3, color: colors.text, fontSize: 16, marginBottom: 3 },
  stepBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  closeBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

// ─── Feature pill ─────────────────────────────────────────────────────────────

function FeaturePill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={fp.pill}>
      <Text style={fp.emoji}>{emoji}</Text>
      <Text style={fp.label}>{label}</Text>
    </View>
  )
}

const fp = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 14 },
  label: { ...typography.label, color: colors.textSecondary, fontSize: 12 },
})

// ─── Root Component ───────────────────────────────────────────────────────────

export default function RootIndex() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading       = useAuthStore((s) => s.isLoading)
  const [showHow, setShowHow] = useState(false)

  // Authenticated — skip landing
  if (isAuthenticated) return <Redirect href="/(app)/" />

  // Loading splash
  if (isLoading) {
    return (
      <View style={s.splash}>
        <Text style={s.splashLogo}>LastNite</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.logo}>LastNite</Text>
          <Text style={s.headline}>
            Turn any night{'\n'}into a story.
          </Text>
          <Text style={s.subheadline}>
            Private missions. Secret moments. One epic reveal.
          </Text>
        </View>

        {/* Feature pills */}
        <View style={s.pills}>
          <FeaturePill emoji="🎯" label="Secret missions" />
          <FeaturePill emoji="📸" label="Capture moments" />
          <FeaturePill emoji="🔥" label="The reveal" />
          <FeaturePill emoji="🏆" label="Battle missions" />
          <FeaturePill emoji="🎉" label="Party energy" />
          <FeaturePill emoji="🌙" label="Memories" />
        </View>

        {/* Primary CTAs */}
        <View style={s.ctas}>
          <TouchableOpacity
            style={s.signupButton}
            onPress={() => router.push('/(auth)/signup' as never)}
            activeOpacity={0.85}
          >
            <Text style={s.signupText}>Get Started — It's Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.signinButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={s.signinText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.howButton}
            onPress={() => setShowHow(true)}
            activeOpacity={0.7}
          >
            <Text style={s.howText}>How it works ↓</Text>
          </TouchableOpacity>
        </View>

        {/* Feature blurbs */}
        <View style={s.blurbs}>
          {[
            {
              emoji: '🎯',
              title: 'Secret missions for everyone',
              body: 'Each person gets private timed missions during the event. Nobody knows what anyone else has.',
            },
            {
              emoji: '🔒',
              title: 'Private by design',
              body: "No public feed. No strangers. Your night, your crew, your memories — locked until the reveal.",
            },
            {
              emoji: '🌅',
              title: 'The reveal is the point',
              body: "After the event, everything drops at once. See who did what, compare moments, relive the chaos.",
            },
          ].map((blurb, i) => (
            <View key={i} style={s.blurb}>
              <Text style={s.blurbEmoji}>{blurb.emoji}</Text>
              <View style={s.blurbText}>
                <Text style={s.blurbTitle}>{blurb.title}</Text>
                <Text style={s.blurbBody}>{blurb.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer CTA */}
        <TouchableOpacity
          style={s.footerCta}
          onPress={() => router.push('/(auth)/signup' as never)}
          activeOpacity={0.85}
        >
          <Text style={s.footerCtaText}>Start your first event →</Text>
        </TouchableOpacity>

        <Text style={s.legal}>Free to use. No ads. No algorithm.</Text>
      </ScrollView>

      <HowItWorksModal visible={showHow} onClose={() => setShowHow(false)} />
    </>
  )
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -1,
  },
  root: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.xxl,
  },

  // ── Hero ──
  hero: { marginBottom: spacing.xl },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
  },
  headline: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1.5,
    lineHeight: 50,
    marginBottom: spacing.md,
  },
  subheadline: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 18,
    lineHeight: 26,
  },

  // ── Pills ──
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },

  // ── CTAs ──
  ctas: { gap: spacing.sm, marginBottom: spacing.xxl },
  signupButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signupText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  signinButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signinText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  howButton: { paddingVertical: spacing.sm, alignItems: 'center' },
  howText: { ...typography.body, color: colors.indigo, fontWeight: '600' },

  // ── Feature blurbs ──
  blurbs: { gap: spacing.lg, marginBottom: spacing.xxl },
  blurb: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blurbEmoji: { fontSize: 28, marginTop: 2 },
  blurbText: { flex: 1 },
  blurbTitle: { ...typography.heading3, color: colors.text, fontSize: 16, marginBottom: 4 },
  blurbBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  // ── Footer ──
  footerCta: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.accentSubtle,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerCtaText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  legal: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
