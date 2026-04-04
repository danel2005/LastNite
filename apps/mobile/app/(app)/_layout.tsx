import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { Platform, TouchableOpacity, Text, View, StyleSheet } from 'react-native'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { colors, spacing } from '@/lib/design'

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

function AvatarButton({ initial }: { initial: string }) {
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/settings')}
      style={av.btn}
      activeOpacity={0.7}
    >
      <Text style={av.text}>{initial}</Text>
    </TouchableOpacity>
  )
}

const av = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSubtle,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  text: { color: colors.accent, fontWeight: '700', fontSize: 14 },
})

export default function AppLayout() {
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      registerPushToken()
    }
  }, [])

  const initial = (profile?.displayName?.[0] ?? '?').toUpperCase()

  const headerTheme = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
    headerShadowVisible: false,
    headerBackTitleVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  }

  return (
    <Stack screenOptions={headerTheme}>
      <Stack.Screen
        name="index"
        options={{
          title: 'LastNite',
          headerLargeTitle: true,
          headerLargeTitleStyle: { color: colors.text },
          headerRight: () => <AvatarButton initial={initial} />,
        }}
      />
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
