import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiClient } from '@/lib/api-client'

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

    // Register with backend
    await apiClient.put('/me/push-token', { token })
  } catch {
    // Push notification setup is best-effort — don't crash the app
  }
}

export default function AppLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      registerPushToken()
    }
  }, [])

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: '#0A0A0A' } }}>
      <Stack.Screen name="index" options={{ title: 'LastNite', headerLargeTitle: true }} />
      <Stack.Screen name="events/create" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="events/join" options={{ title: 'Join Event', presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="events/[id]/lobby" options={{ title: 'Waiting Room' }} />
      <Stack.Screen name="events/[id]/feed" options={{ title: 'Feed' }} />
      <Stack.Screen name="events/[id]/reveal" options={{ title: 'The Reveal', headerShown: false }} />
      <Stack.Screen name="events/[id]/recap" options={{ title: 'Recap' }} />
      <Stack.Screen name="events/[id]/create-mission" options={{ title: 'New Mission', presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="events/[id]/preview" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="events/[id]/export" options={{ title: 'Export & Share' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  )
}
