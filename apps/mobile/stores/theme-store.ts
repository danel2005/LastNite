import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type ThemeMode = 'dark' | 'light'

const KEY = 'lastnite_theme_mode'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => Promise<void>
  loadMode: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  setMode: async (mode) => {
    await SecureStore.setItemAsync(KEY, mode)
    set({ mode })
  },
  loadMode: async () => {
    const stored = await SecureStore.getItemAsync(KEY)
    if (stored === 'light' || stored === 'dark') set({ mode: stored })
  },
}))
