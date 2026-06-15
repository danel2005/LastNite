import { useEffect, Component, type ReactNode } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { apiClient } from '@/lib/api-client'
import { colors, spacing, typography } from '@/lib/design'

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebSt.root}>
          <Text style={ebSt.emoji}>⚠️</Text>
          <Text style={ebSt.title}>Something went wrong</Text>
          <Text style={ebSt.message} numberOfLines={4}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={ebSt.btn} onPress={this.handleReset} activeOpacity={0.8}>
            <Text style={ebSt.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const ebSt = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: { fontSize: 48 },
  title: { ...typography.heading2, color: colors.text, textAlign: 'center' },
  message: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  btn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  btnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
})

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession)
  const setSession = useAuthStore((s) => s.setSession)
  const loadMode = useThemeStore((s) => s.loadMode)

  useEffect(() => {
    loadMode()
    // On app start: load token from SecureStore, then verify it with /me
    loadSession().then(async (token) => {
      if (!token) return
      try {
        const res = await apiClient.get('/me')
        const data = res.data as { id: string; phone: string | null; email: string | null; createdAt?: string; updatedAt?: string; isAdmin?: boolean; profile: null | Record<string, unknown> }
        const now = new Date().toISOString()
        await setSession(
          { id: data.id, phone: data.phone ?? null, email: data.email ?? null, createdAt: data.createdAt ?? now, updatedAt: data.updatedAt ?? now, isAdmin: data.isAdmin },
          data.profile as never,
          token,
        )
      } catch {
        // Token invalid or expired — clear it
        const { clearSession } = useAuthStore.getState()
        await clearSession()
      }
    })
  }, [])

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0A0A0A' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#0A0A0A' },
          }}
        >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
