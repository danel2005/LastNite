/**
 * Profile Tab — redirects to the Settings screen which has
 * full profile management, sign-out, etc.
 */

import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/design'

export default function ProfileTab() {
  useEffect(() => {
    // Push to settings so the back button works correctly
    router.push('/(app)/settings' as never)
  }, [])

  return (
    <View style={s.root}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
})
