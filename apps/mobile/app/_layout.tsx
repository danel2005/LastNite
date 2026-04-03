import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession)
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    // On app start: load token from SecureStore, then verify it with /me
    loadSession().then(async (token) => {
      if (!token) return
      try {
        const res = await apiClient.get('/me')
        const data = res.data as { id: string; phone: string | null; email: string | null; createdAt?: string; updatedAt?: string; profile: null | Record<string, unknown> }
        const now = new Date().toISOString()
        await setSession(
          { id: data.id, phone: data.phone ?? null, email: data.email ?? null, createdAt: data.createdAt ?? now, updatedAt: data.updatedAt ?? now },
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
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
