import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: '#0A0A0A' } }}>
      <Stack.Screen name="index" options={{ title: 'LastNite', headerLargeTitle: true }} />
      <Stack.Screen name="events/create" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="events/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="events/[id]/feed" options={{ title: 'Feed' }} />
      <Stack.Screen name="events/[id]/reveal" options={{ title: 'The Reveal', headerShown: false }} />
      <Stack.Screen name="events/[id]/recap" options={{ title: 'Recap' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  )
}
