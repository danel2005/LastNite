# LastNite — Database Schema

## Entity Overview

```
User (auth identity)
 └── Profile (display name, avatar, push token)
 └── UserMissionPreference (opt-outs)
 └── Participant[] (events they're in)
 └── MissionAssignment[] (their private missions — NEVER exposed to others during live event)
 └── Submission[] (their media)

Event
 └── Participant[] (who's in it)
 └── Invite[] (join codes)
 └── EventMissionPack[] (which packs are active)
 └── MissionInstance[] (definitions instantiated for this event)
     └── MissionAssignment[] (who got it, when — the cycling layer)
         └── Submission (1:1 — their response)
             └── SubmissionAsset[] (photo/video files)
                 └── ModerationReport? (flagged content)
 └── RecapArtifact (post-event computed payload)
 └── ExportJob[] (photo pack / reel exports)
 └── Notification[] (push notifications sent)

MissionDefinition (reusable template)
 └── MissionPackDefinition[] (pack membership)
 └── MissionInstance[] (instantiated per event)

MissionPack (curated collection)
 └── MissionPackDefinition[] → MissionDefinition[]
 └── EventMissionPack[] → Event[]
```

## Key Tables & Relationships

### The Mission Privacy Chain

```
MissionDefinition (what the mission is — global or event-scoped)
    ↓  1:N per event
MissionInstance (this definition active in this event)
    ↓  1:N (cycling — same instance → multiple users)
MissionAssignment (user X got this mission at time T)
    ↓  1:1
Submission → SubmissionAsset[] (their media response)
```

**Privacy invariant:** `MissionAssignment` rows for `userId != requestingUser` are NEVER returned during a live event. Only after `event.state = completed`.

**Cycling:** Same `MissionInstance` → multiple `MissionAssignment` rows with different `userId` and `assignedAt`. Enforced via `@@unique([userId, missionInstanceId])` — one user can't get the same mission twice.

### Custom Missions

Custom missions are `MissionDefinition` rows with:
- `isSystem = false`
- `createdByUserId` = the creator
- `eventId` = the event they're scoped to
- `targetUserId` (optional) = "photograph this specific person"

They are instantiated as `MissionInstance` rows and assigned exactly like system missions.

## Indexes

| Table | Index | Purpose |
|---|---|---|
| `events` | `state, starts_at` | Scheduler: find events to transition to `live` |
| `events` | `state, ends_at` | Scheduler: find events to close |
| `participants` | `user_id` | "My events" query |
| `mission_assignments` | `event_id, user_id, status` | "My active missions" (primary live query) |
| `mission_assignments` | `status, expires_at` | Expiry worker: find assignments to expire |
| `mission_assignments` | `event_id` | Reveal: fetch all assignments for an event |
| `submissions` | `event_id, created_at` | Feed: chronological per event |
| `submission_assets` | `moderation_status` | Moderation queue |
| `export_jobs` | `status, created_at` | Export worker poll |
| `notifications` | `user_id, sent_at` | Delivery worker |

## Enums

| Enum | Values |
|---|---|
| `EventState` | draft, scheduled, live, ending, processing, completed, archived, cancelled |
| `EventTemplate` | house_party, night_out, birthday, bachelor_bachelorette, trip, festival |
| `MissionCategory` | selfie, group_selfie, duo, target_person, object_hunt, environment, food_drink, mood_vibe, chaos, public_social, finale, everyone_now, custom |
| `MissionMediaType` | photo, video, any |
| `MissionAssignmentStatus` | pending, active, completed, expired, skipped |
| `SubmissionAssetStatus` | pending_upload, uploaded, failed |
| `ModerationStatus` | pending, approved, flagged, removed |
| `ExportJobType` | photo_pack, highlight_reel |
| `ExportJobStatus` | pending, processing, ready, failed |
| `NotificationType` | event_starting_soon, event_started, mission_assigned, mission_expiring_soon, group_mission_live, event_ending_soon, reveal_ready, export_ready |

## Seed Data

System mission definitions: 60+ missions across all categories.
Mission packs: Party, Chill, Chaos, Safe Mode, Social, Bachelor/Bachelorette, Trip, Birthday, Finale.

Run seed: `cd packages/db && npm run db:seed`

## Environment Setup

1. Create a Supabase project at supabase.com
2. Copy the connection string from Project Settings → Database
3. Create `packages/db/prisma/.env` with:
   ```
   DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
   ```
4. Run: `npm run db:migrate` (from packages/db)
5. Run: `npm run db:seed` (from packages/db)
