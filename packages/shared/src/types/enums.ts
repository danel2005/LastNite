// ─── Event ───────────────────────────────────────────────────────────────────

export enum EventState {
  Draft = 'draft',
  Scheduled = 'scheduled',
  Live = 'live',
  Ending = 'ending',
  Processing = 'processing',
  Completed = 'completed',
  Archived = 'archived',
  Cancelled = 'cancelled',
}

export enum EventTemplate {
  HouseParty = 'house_party',
  NightOut = 'night_out',
  Birthday = 'birthday',
  BachelorBachelorette = 'bachelor_bachelorette',
  Trip = 'trip',
  Festival = 'festival',
}

// ─── Mission ─────────────────────────────────────────────────────────────────

export enum MissionCategory {
  Selfie = 'selfie',
  GroupSelfie = 'group_selfie',
  Duo = 'duo',
  TargetPerson = 'target_person',
  ObjectHunt = 'object_hunt',
  Environment = 'environment',
  FoodDrink = 'food_drink',
  MoodVibe = 'mood_vibe',
  Chaos = 'chaos',
  PublicSocial = 'public_social',
  Finale = 'finale',
  EveryoneNow = 'everyone_now',
  Custom = 'custom',
}

export enum MissionMediaType {
  Photo = 'photo',
  Video = 'video',
  Any = 'any',
}

export enum MissionAssignmentStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Expired = 'expired',
  Skipped = 'skipped',
}

// ─── Submission ───────────────────────────────────────────────────────────────

export enum SubmissionAssetType {
  Photo = 'photo',
  Video = 'video',
}

export enum SubmissionAssetStatus {
  PendingUpload = 'pending_upload',
  Uploaded = 'uploaded',
  Failed = 'failed',
}

export enum ModerationStatus {
  Pending = 'pending',
  Approved = 'approved',
  Flagged = 'flagged',
  Removed = 'removed',
}

// ─── Export ───────────────────────────────────────────────────────────────────

export enum ExportJobType {
  PhotoPack = 'photo_pack',
  HighlightReel = 'highlight_reel',
}

export enum ExportJobStatus {
  Pending = 'pending',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
}

// ─── Notification ─────────────────────────────────────────────────────────────

export enum NotificationType {
  EventStartingSoon = 'event.starting_soon',
  EventStarted = 'event.started',
  MissionAssigned = 'mission.assigned',
  MissionExpiringSoon = 'mission.expiring_soon',
  GroupMissionLive = 'group_mission.live',
  EventEndingSoon = 'event.ending_soon',
  RevealReady = 'event.reveal_ready',
  ExportReady = 'event.export_ready',
}
