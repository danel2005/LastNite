import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '@/stores/auth-store'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach session token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('session_token')
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
      await useAuthStore.getState().clearSession()
    }
    return Promise.reject(error)
  },
)
