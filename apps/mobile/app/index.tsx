import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth-store'

// Root redirect: send to app if authenticated, auth flow if not
export default function RootIndex() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return <Redirect href={isAuthenticated ? '/(app)/' : '/(auth)/login'} />
}
