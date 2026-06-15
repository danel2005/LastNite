import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { colors } from '@/lib/design'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

async function registerPushToken() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return

    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data

    await apiClient.put('/me/push-token', { token })
  } catch {
    // Push notification setup is best-effort — don't crash the app
  }
}

const headerTheme = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: colors.bg },
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (Platform.OS !== 'web' && isAuthenticated) {
      registerPushToken()
    }
  }, [isAuthenticated])

  return (
    <Stack screenOptions={headerTheme}>
      {/* Tab shell — headerShown false so each tab controls its own header */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Modal screens */}
      <Stack.Screen name="events/create" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="events/join" options={{ title: 'Join Event', presentation: 'modal' }} />

      {/* Event detail screens */}
      <Stack.Screen name="events/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="events/[id]/lobby" options={{ title: 'Waiting Room' }} />
      <Stack.Screen name="events/[id]/feed" options={{ title: 'Feed' }} />
      <Stack.Screen name="events/[id]/reveal" options={{ title: 'The Reveal', headerShown: false }} />
      <Stack.Screen name="events/[id]/recap" options={{ title: 'Recap' }} />
      <Stack.Screen name="events/[id]/create-mission" options={{ title: 'New Mission', presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="events/[id]/preview" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="events/[id]/export" options={{ title: 'Export & Share' }} />
      <Stack.Screen name="admin" options={{ title: 'Admin' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />

      {/* Legacy index — redirect entry point */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  )
}
