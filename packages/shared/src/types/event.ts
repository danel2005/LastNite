import type { EventState, EventTemplate } from './enums'
import type { Profile } from './user'

export interface Event {
  id: string
  title: string
  hostId: string
  state: EventState
  template: EventTemplate
  startsAt: string
  endsAt: string
  missionIntervalMinutes: number // default 30
  missionIntensity: number // 1-5
  allowCustomMissions: boolean
  allowPublicSocialMissions: boolean
  safeMode: boolean
  inviteCode: string
  createdAt: string
  updatedAt: string
}

export interface Participant {
  id: string
  eventId: string
  userId: string
  profile: Profile
  joinedAt: string
  lastActiveAt: string | null
  submissionCount: number
  missionsCompleted: number
  isHost: boolean
  removedAt: string | null
}

export interface Invite {
  id: string
  eventId: string
  code: string
  createdByUserId: string
  usedCount: number
  expiresAt: string | null
  createdAt: string
}

// The live event state payload — what the mobile client polls for
export interface LiveEventState {
  event: Pick<Event, 'id' | 'title' | 'state' | 'startsAt' | 'endsAt' | 'allowCustomMissions'>
  timeRemainingMs: number
  myActiveMissions: ActiveMissionSummary[]
  participantActivity: ParticipantActivity[]
  feedPreview: FeedPreviewItem[]
  hostControls: HostControls | null // only populated if current user is host
}

export interface ActiveMissionSummary {
  assignmentId: string
  title: string
  description: string
  mediaType: string
  isSecret: boolean
  expiresAt: string
  timeUntilExpiryMs: number
  status: string
}

export interface ParticipantActivity {
  userId: string
  displayName: string
  avatarUrl: string | null
  isActive: boolean // active in last 5 minutes
  submissionCount: number
  // NOTE: mission details are never included here — privacy invariant
}

export interface FeedPreviewItem {
  submissionId: string
  submittedBy: { displayName: string; avatarUrl: string | null }
  assetType: string
  thumbnailUrl: string
  submittedAt: string
}

export interface HostControls {
  participantCompletionRates: Array<{
    userId: string
    displayName: string
    completionRate: number
  }>
  canTriggerGroupMission: boolean
}
