import { create } from 'zustand'
import type { Profile, User } from '@lastnite/shared'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  profile: Profile | null
  sessionToken: string | null

  setSession: (user: User, profile: Profile, token: string) => void
  setProfile: (profile: Profile) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  profile: null,
  sessionToken: null,

  setSession: (user, profile, token) =>
    set({ isAuthenticated: true, user, profile, sessionToken: token }),

  setProfile: (profile) => set({ profile }),

  clearSession: () =>
    set({ isAuthenticated: false, user: null, profile: null, sessionToken: null }),
}))
