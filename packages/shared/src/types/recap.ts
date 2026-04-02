import type { ExportJobStatus, ExportJobType } from './enums'
import type { MissionRevealEntry } from './mission'

export interface RecapArtifact {
  id: string
  eventId: string
  // Timeline: submissions ordered by time, grouped into ~30min chapters
  timeline: TimelineChapter[]
  // All missions with all their assignments and submissions (the reveal)
  missionEntries: MissionRevealEntry[]
  // Per-participant journey
  participantJourneys: ParticipantJourney[]
  // Computed awards
  awards: Award[]
  // High-level stats
  stats: RecapStats
  // IDs of assets selected for the highlight reel (ordered)
  highlightReelAssetIds: string[]
  // IDs of assets selected for the photo collage
  collageAssetIds: string[]
  generatedAt: string
}

export interface TimelineChapter {
  label: string // e.g. "10:00 PM – 10:30 PM"
  startTime: string
  endTime: string
  submissionIds: string[]
}

export interface ParticipantJourney {
  userId: string
  displayName: string
  avatarUrl: string | null
  assignments: Array<{
    assignmentId: string
    missionTitle: string
    assignedAt: string
    completedAt: string | null
    submissionIds: string[]
  }>
}

export interface Award {
  type: AwardType
  label: string // e.g. "Mission Machine"
  description: string // e.g. "Completed 8 out of 10 missions"
  userId: string
  displayName: string
  avatarUrl: string | null
}

export enum AwardType {
  MostActive = 'most_active',
  MissionMachine = 'mission_machine',
  FirstBlood = 'first_blood',
  BestChaos = 'best_chaos',
  MostCreative = 'most_creative',
  SecretAgent = 'secret_agent', // completed the most secret missions
}

export interface RecapStats {
  totalSubmissions: number
  totalMissionsCompleted: number
  totalParticipants: number
  activeParticipants: number
  participationRate: number // 0–1
  eventDurationMs: number
}

export interface ExportJob {
  id: string
  eventId: string
  requestedByUserId: string
  type: ExportJobType
  status: ExportJobStatus
  // For photo_pack: list of signed download URLs
  // For highlight_reel: ordered list of asset metadata
  resultPayload: ExportResultPayload | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export interface ExportResultPayload {
  type: ExportJobType
  items: Array<{
    assetId: string
    downloadUrl: string
    assetType: string
    durationMs: number | null
    order: number | null
  }>
  totalCount: number
}
