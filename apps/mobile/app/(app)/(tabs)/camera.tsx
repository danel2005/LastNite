/**
 * Camera tab — this is just a placeholder required by Expo Router
 * for the tab route to exist. The actual navigation happens in the
 * CameraTabButton in _layout.tsx (pushes to events/join).
 */

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/design'

export default function CameraTabScreen() {
  useEffect(() => {
    router.replace('/(app)/(tabs)/' as never)
  }, [])

  return <View style={s.root} />
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
})
