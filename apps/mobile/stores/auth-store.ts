import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { Profile, User } from '@lastnite/shared'

const SESSION_TOKEN_KEY = 'session_token'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: (User & { isAdmin?: boolean }) | null
  profile: (Profile & { avatarStorageKey?: string | null }) | null
  sessionToken: string | null

  setSession: (user: User & { isAdmin?: boolean }, profile: (Profile & { avatarStorageKey?: string | null }) | null, token: string) => Promise<void>
  setProfile: (profile: Profile & { avatarStorageKey?: string | null }) => void
  clearSession: () => Promise<void>
  loadSession: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  profile: null,
  sessionToken: null,

  setSession: async (user, profile, token) => {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
    set({ isAuthenticated: true, user, profile, sessionToken: token })
  },

  setProfile: (profile) => set({ profile }),

  clearSession: async () => {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
    set({ isAuthenticated: false, user: null, profile: null, sessionToken: null })
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
      if (token) {
        set({ sessionToken: token })
        return token
      }
    } catch {
      // SecureStore can fail on emulator/web — ignore
    } finally {
      set({ isLoading: false })
    }
    set({ isLoading: false })
    return null
  },
}))
