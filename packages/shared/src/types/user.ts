export interface User {
  id: string
  phone: string | null
  email: string | null
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface UserMissionPreference {
  id: string
  userId: string
  disablePublicSocial: boolean
  disableAlcoholRefs: boolean
  disableIntensityAbove: number | null // 1-5, null = no restriction
  createdAt: string
  updatedAt: string
}
