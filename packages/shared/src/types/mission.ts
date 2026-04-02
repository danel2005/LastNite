import type { MissionAssignmentStatus, MissionCategory, MissionMediaType } from './enums'

export interface MissionDefinition {
  id: string
  title: string
  description: string
  category: MissionCategory
  mediaType: MissionMediaType
  intensity: number // 1–5
  isSocial: boolean // involves strangers / public interaction
  isSecret: boolean // default secret status
  minDurationMs: number | null // for video missions
  maxDurationMs: number | null
  // If set, this is a user-created mission scoped to one event
  createdByUserId: string | null
  eventId: string | null // null = global system mission
  targetUserId: string | null // for user-specific missions ("photograph this person")
  createdAt: string
  updatedAt: string
}

export interface MissionPack {
  id: string
  name: string
  description: string
  slug: string // e.g. "party", "birthday", "chaos", "safe"
  isSystem: boolean
  definitionIds: string[]
  createdAt: string
}

// A MissionDefinition instantiated for a specific event
export interface MissionInstance {
  id: string
  eventId: string
  definitionId: string
  definition: MissionDefinition
  isFinale: boolean // true = assigned to everyone at event end
  createdAt: string
}

// A specific user getting a specific MissionInstance at a specific time.
// Key invariant: this is NEVER exposed to other users during a live event.
// Only revealed after event.state = completed.
export interface MissionAssignment {
  id: string
  missionInstanceId: string
  eventId: string
  userId: string
  isSecret: boolean
  assignedAt: string
  expiresAt: string
  completedAt: string | null
  skippedAt: string | null
  status: MissionAssignmentStatus
}

// What the reveal returns — grouped by mission, showing all assignments
export interface MissionRevealEntry {
  missionInstance: MissionInstance
  isSecret: boolean
  assignments: Array<{
    assignment: MissionAssignment
    userDisplayName: string
    userAvatarUrl: string | null
    submissions: Array<{
      id: string
      thumbnailUrl: string
      assetType: string
      submittedAt: string
    }>
  }>
}
