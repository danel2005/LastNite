import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    // bypass tunnel warning pages (loca.lt + ngrok)
    'Bypass-Tunnel-Reminder': 'bypass',
    'ngrok-skip-browser-warning': 'true',
  },
})

// Attach session token to every request
apiClient.interceptors.request.use(async (config) => {
  let token: string | null = null
  if (Platform.OS === 'web') {
    // SecureStore unavailable on web — read from Zustand store directly
    const { useAuthStore } = await import('@/stores/auth-store')
    token = useAuthStore.getState().sessionToken
  } else {
    token = await SecureStore.getItemAsync('session_token')
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — clear session and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await SecureStore.deleteItemAsync('session_token')
      // Navigation handled by auth store subscription
    }
    return Promise.reject(error)
  },
)
