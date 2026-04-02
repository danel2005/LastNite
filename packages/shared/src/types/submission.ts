import type { ModerationStatus, SubmissionAssetStatus, SubmissionAssetType } from './enums'

export interface Submission {
  id: string
  eventId: string
  userId: string
  assignmentId: string // always linked to a MissionAssignment
  assets: SubmissionAsset[]
  // Mission title is hidden during live event — revealed only after event ends
  missionTitleVisible: boolean
  createdAt: string
}

export interface SubmissionAsset {
  id: string
  submissionId: string
  assetType: SubmissionAssetType
  status: SubmissionAssetStatus
  storageKey: string
  signedUrl: string | null // populated when serving to client
  mimeType: string
  fileSizeBytes: number
  widthPx: number | null
  heightPx: number | null
  durationMs: number | null // for video
  capturedAt: string | null
  moderationStatus: ModerationStatus
  createdAt: string
}

// What the API returns when creating a submission (upload flow init)
export interface SubmissionInitResponse {
  submissionId: string
  assetId: string
  uploadUrl: string // signed URL for direct-to-storage upload
  uploadMethod: 'PUT'
  uploadHeaders: Record<string, string>
  expiresAt: string
}

export interface Reaction {
  id: string
  submissionId: string
  userId: string
  emoji: '🔥' | '❤️' | '😂' | '😮'
  createdAt: string
}
