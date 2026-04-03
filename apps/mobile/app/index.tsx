import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth-store'
import { colors } from '@/lib/design'

// Root redirect: handle loading state, then send to correct stack
export default function RootIndex() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return <Redirect href={isAuthenticated ? '/(app)/' : '/(auth)/login'} />
}
