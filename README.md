# LastNite

> A private, temporary, mission-based social app that captures the real moments of your night — and reveals them all at the end.

---

## What Is LastNite?

LastNite is a private event-based social app built around two sacred pillars:

1. **The Mission Engine** — During the event, participants receive missions at timed intervals. Missions are private. You don't know what anyone else got. Missions cycle through participants (different people, different times). Custom missions can be created by the host or participants. Some are marked ultra-secret ("Shhhh...").
2. **The Recap & Reveal** — When the event ends, everything is revealed. Who got what mission, when they completed it, every result side by side. This is the emotional payoff.

The app should feel like a private disposable camera crossed with a secret mission game. Not a social network. Not a group chat. A shared memory machine.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + Expo (SDK 51+) | Fast cross-platform shipping, great camera/media APIs |
| Navigation | Expo Router (file-based) | Clean, type-safe routing |
| State | Zustand | Lightweight, no boilerplate |
| Data Fetching | TanStack Query | Caching, optimistic updates, polling |
| Backend | Node.js + Fastify + TypeScript | Fast, typed, minimal overhead |
| ORM | Prisma | Type-safe DB access, great migrations |
| Database | PostgreSQL (Supabase) | Relational, battle-tested, free to start |
| Auth | Supabase Auth | Phone OTP + magic link, handles sessions |
| Storage | Supabase Storage | S3-compatible, signed URLs, free tier |
| Job Queue | BullMQ + Redis | Mission dispatch, recap jobs, export jobs |
| Push | Expo Push Notifications | Cross-platform, simple for MVP |
| Hosting | Railway (API + Redis) + Supabase | Simple, cheap, fast to deploy |
| Monorepo | Turborepo | Task caching, clean workspace boundaries |

---

## Repository Structure

```
lastnite/
├── apps/
│   ├── mobile/              # Expo React Native app
│   └── api/                 # Fastify backend
├── packages/
│   ├── shared/              # Shared TypeScript types & contracts
│   ├── db/                  # Prisma schema, migrations, seed
│   └── config/              # Shared tsconfig, eslint config
├── docs/                    # Architecture docs, ADRs
├── .github/
│   └── workflows/           # CI workflows
├── turbo.json
└── package.json
```

---

## Branching Strategy

- `main` — production-ready, tagged releases only
- `dev` — integration branch, all features merge here first
- `step/XX-feature-name` — one branch per build step below

**Workflow:** `step/XX → PR → dev → (eventually) main`

Each step is a branch. Each branch may have multiple commits. Merge via PR into `dev`.

---

## Build Steps

This is the exact order we build the project. Each step = one branch = one PR into `dev`.

---

### Step 01 — `step/01-monorepo-setup`
**Monorepo foundation**

- [ ] Remove `StickerSmash` placeholder
- [ ] Initialize Turborepo with `apps/` and `packages/` structure
- [ ] Create `packages/config` — shared `tsconfig.base.json`, `eslint` config
- [ ] Create `packages/shared` — empty TS package, will hold shared types
- [ ] Create `packages/db` — Prisma setup, empty schema, scripts
- [ ] Create `apps/api` — blank Fastify + TypeScript project
- [ ] Create `apps/mobile` — blank Expo project (Expo Router, TypeScript)
- [ ] Set up root `package.json` with workspaces
- [ ] Configure `turbo.json` pipeline (build, lint, dev)
- [ ] Add `.github/workflows/ci.yml` — lint + typecheck on PR

**Commits:** monorepo init → api scaffold → mobile scaffold → turbo pipeline → CI

---

### Step 02 — `step/02-database-schema`
**Full database schema**

- [ ] Set up Supabase project (local dev + hosted)
- [ ] Write Prisma schema covering all entities:
  - `User`, `Profile`
  - `Event`, `EventTemplate`, `Participant`, `Invite`
  - `MissionDefinition`, `MissionPack`, `MissionInstance`, `MissionAssignment`
  - `Submission`, `SubmissionAsset`
  - `Reaction`, `Notification`
  - `RecapArtifact`, `ExportJob`
  - `ModerationReport`, `UserMissionPreference`
- [ ] Add indexes, constraints, soft-delete fields
- [ ] Run first migration
- [ ] Write seed script with sample mission definitions + packs
- [ ] Document schema with ER diagram in `docs/`

**Key design decisions:**
- Missions are private per-assignment (no one sees your mission during the event)
- `MissionAssignment` tracks `userId`, `missionInstanceId`, `assignedAt`, `completedAt`, `isSecret`
- Same `MissionInstance` can have multiple `MissionAssignment` rows (one per user who gets it at different times — this is how cycling works)
- Custom user missions get a `MissionDefinition` with `createdBy: userId`

**Commits:** prisma init → core schema → mission schema → recap/export schema → seed data → migration

---

### Step 03 — `step/03-backend-auth`
**Auth + user profile API**

- [ ] Supabase Auth integration in Fastify (phone OTP + email magic link)
- [ ] JWT verification middleware
- [ ] `POST /auth/request-otp` — sends OTP via Supabase
- [ ] `POST /auth/verify-otp` — verifies, returns session
- [ ] `GET /me` — fetch current user + profile
- [ ] `PUT /me` — update display name, avatar
- [ ] `POST /me/avatar` — upload avatar (signed URL flow)
- [ ] Auth guard plugin for protected routes
- [ ] Basic rate limiting on auth routes

**Commits:** supabase auth setup → jwt middleware → otp endpoints → profile endpoints → avatar upload → rate limiting

---

### Step 04 — `step/04-event-crud`
**Event creation, invite, join**

- [ ] Event lifecycle state machine: `draft → scheduled → live → ending → processing → completed → archived`
- [ ] `POST /events` — create event (title, start/end datetime, template, settings)
- [ ] `GET /events` — list user's events (upcoming + past)
- [ ] `GET /events/:id` — fetch event detail
- [ ] `PUT /events/:id` — update event (host only, pre-live)
- [ ] `DELETE /events/:id` — cancel event
- [ ] `POST /events/:id/invites` — generate invite link / code
- [ ] `POST /invites/:code/join` — join event as participant
- [ ] `GET /events/:id/participants` — list participants
- [ ] `DELETE /events/:id/participants/:userId` — host removes participant
- [ ] Event templates: hardcode 6 templates (Party, Night Out, Birthday, Trip, Festival, Bachelor/Bachelorette)
- [ ] Cron/scheduler: auto-transition event states based on datetime

**Commits:** event model + state machine → create/list/get endpoints → invite system → join flow → participant management → event templates → state scheduler

---

### Step 05 — `step/05-mission-engine`
**The core mission engine**

This is the most important step. Take it seriously.

- [ ] Seed 60+ `MissionDefinition` rows across categories:
  - `selfie`, `group_selfie`, `duo`, `target_person`, `object_hunt`, `environment`, `food_drink`, `mood_vibe`, `chaos`, `public_social`, `finale`, `secret`, `everyone_now`
- [ ] Each definition has: `mediaType` (photo/video/any), `intensity` (1-5), `isSocial`, `isSecret`, `minDuration` (for video), `category`, `packIds[]`
- [ ] Create `MissionPack` rows — Party Pack, Chill Pack, Chaos Pack, Bachelor Pack, Safe Mode Pack, etc.
- [ ] **Custom mission creation endpoint:** `POST /events/:id/missions/custom`
  - Host OR participant can create before/during event
  - Fields: `title`, `description`, `targetUserId?` (for "take a picture of user4"), `mediaType`, `isSecret`, `assignToAll?`
  - Custom missions get a `MissionDefinition` with `createdBy` and `eventId` scope
- [ ] **Mission assignment algorithm** (runs as BullMQ job):
  - When event goes live, schedule first mission dispatch
  - Every N minutes (configurable per event, default 30min): select next mission per participant
  - Anti-repeat: never assign same definition twice to same user in same event
  - Cycling: same `MissionInstance` can be assigned to multiple users at different times — tracked via `MissionAssignment`
  - Respect `UserMissionPreference` (opt-outs: no public/social, no alcohol refs, etc.)
  - Secret missions: assign with `isSecret: true` — client shows special "Shhhh" warning card
  - Finale mission: auto-trigger 30min before event end, assigned to everyone simultaneously
- [ ] `GET /events/:id/my-missions` — returns active missions for current user only (never leaks others' missions)
- [ ] `POST /events/:id/missions/:assignmentId/skip` — skip a mission (optional, host-configurable)
- [ ] Mission expiry: assignments expire after `expiresAt` if not completed

**Key invariant:** During the event, a user can NEVER see another user's mission assignments. The reveal is at the end.

**Commits:** mission definitions seed → mission packs seed → custom mission endpoint → assignment algorithm → mission dispatch worker → my-missions endpoint → skip + expiry logic

---

### Step 06 — `step/06-live-event-api`
**Live event state contract**

- [ ] `GET /events/:id/live` — the main live-event polling endpoint
  - Returns: event metadata, state, time remaining, my active missions, participant activity summary (who's submitted recently — no mission details), host flags
  - Participants can see others are "active" but NOT what missions they have
- [ ] `GET /events/:id/feed` — chronological submission feed (photos/videos visible to all participants)
- [ ] Participant activity summary (last_active_at, submission_count) — no mission content leaked
- [ ] Host-only fields: full participant mission completion rates, ability to trigger a bonus mission
- [ ] `POST /events/:id/missions/trigger` — host manually triggers a group mission (host only)
- [ ] Poll interval recommendation: 30s for live state, 10s during active mission window
- [ ] Design for WebSocket upgrade later (polling first for MVP)

**Commits:** live event endpoint → feed endpoint → host controls → polling strategy docs

---

### Step 07 — `step/07-media-upload`
**Photo + video submission**

- [ ] Supabase Storage bucket setup (`event-media`, private, signed URLs)
- [ ] `POST /events/:id/submissions/init` — creates `Submission` + `SubmissionAsset` shell, returns signed upload URL
- [ ] `POST /events/:id/submissions/:id/confirm` — marks upload complete, links to `MissionAssignment`
- [ ] `POST /events/:id/submissions/:id/cancel` — cleanup if upload fails
- [ ] Photo: JPEG, max 15MB, stored as-is
- [ ] Video: MP4/MOV, max 60s, max 150MB, stored as-is (no server transcoding in MVP)
- [ ] Metadata captured: `mediaType`, `durationMs` (video), `width`, `height`, `fileSize`, `mimeType`, `capturedAt`
- [ ] Upload idempotency: prevent duplicate submissions for same assignment
- [ ] Moderation flag field on `SubmissionAsset` (default: pending → approved auto, manual review on report)
- [ ] Gallery upload: allowed by default (in-app capture preferred but not enforced in MVP)

**Commits:** storage setup → submission init + signed URL → submission confirm → video handling → metadata + moderation flags → duplicate prevention

---

### Step 08 — `step/08-event-feed-api`
**Feed + reactions**

- [ ] `GET /events/:id/feed` — paginated, newest first, includes submitter name + avatar, media signed URL, mission title (only visible after event ends, blurred/hidden during live)
- [ ] During live event: feed shows media but NOT which mission it was for (preserves mystery)
- [ ] After event ends: feed shows mission title per submission
- [ ] `POST /submissions/:id/reactions` — add emoji reaction (fire, heart, laugh, wow — 4 only)
- [ ] `DELETE /submissions/:id/reactions/:reactionId` — remove own reaction
- [ ] `GET /submissions/:id/reactions` — list reactions with user display names
- [ ] Reaction counts denormalized on `Submission` for performance

**Commits:** feed endpoint with pagination → mission title visibility logic → reactions CRUD → denormalized counts

---

### Step 09 — `step/09-event-close-and-reveal`
**Event close + THE BIG REVEAL**

This step is the emotional payoff of the whole app.

- [ ] `POST /events/:id/close` — host closes event early (or auto-close at end datetime)
- [ ] State transition: `live → ending → processing`
- [ ] **Reveal data computation** (BullMQ job triggered on close):
  - For each `MissionInstance` that had at least one assignment:
    - Collect all `MissionAssignment` rows with their `assignedAt`, `completedAt`, `userId`
    - Collect all `Submission` rows linked to each assignment
    - Sort by `assignedAt` to show the "timeline" of who got it when
  - For custom missions (user-specific): group results under that mission
  - For secret missions: reveal the "Shhhh" label in the reveal
  - Compute awards: Most Active, Mission Machine (most completed), First Submission, Best Chaos, etc.
- [ ] `GET /events/:id/reveal` — returns full reveal payload (only available after state = `completed`)
  - Structure: `missions[]` → each with `assignmentTimeline[]` → each with `userId`, `assignedAt`, `completedAt`, `submissions[]`
  - `awards[]` — funny computed awards
  - `stats` — total submissions, total missions completed, participation rate
- [ ] State transition to `completed` after reveal is computed
- [ ] Notify all participants: "The reveal is ready!"

**Commits:** close event endpoint → reveal computation job → reveal endpoint → awards logic → completion notification trigger

---

### Step 10 — `step/10-recap-generation`
**Recap artifacts**

- [ ] Recap generation job (BullMQ, triggered after reveal computation):
  - **Timeline recap**: submissions ordered by time, one per "chapter" (every ~30min of event)
  - **By-mission recap**: for each mission, collect all submissions across all users
  - **By-participant recap**: for each participant, their submission journey
  - **Photo collage metadata**: select best N photos (heuristics: variety of participants, spread across time, avoid duplicates)
  - **Highlight reel metadata**: select 8-12 video clips, prefer short (<15s), spread across participants and event time
- [ ] Heuristics (all server-side, no ML in MVP):
  - Balance participants (no single person dominates)
  - Balance time (spread across event duration)
  - Prefer video clips under 15s for reel
  - Prefer group content over solo for highlights
  - If < 5 total submissions: include everything, no filtering
- [ ] `GET /events/:id/recap` — returns `RecapArtifact` with all structured metadata
- [ ] `RecapArtifact` is metadata only — references `SubmissionAsset` IDs, no video rendering server-side in MVP
- [ ] Recap available to all participants (not just host)

**Commits:** recap job structure → timeline computation → by-mission + by-participant → collage + highlight heuristics → recap endpoint

---

### Step 11 — `step/11-export-system`
**Export + share**

- [ ] `POST /events/:id/export` — create `ExportJob`
  - Types: `photo_pack` (zip of all photos), `highlight_reel` (MP4 — see note)
  - For MVP: `photo_pack` is a zip of signed URLs (client downloads individually), no server-side video rendering
  - `highlight_reel` in MVP: return an ordered list of signed video URLs + metadata — client assembles on device or user saves manually
- [ ] `GET /export-jobs/:id` — poll export status (`pending → processing → ready → failed`)
- [ ] `GET /export-jobs/:id/download` — returns download URL(s)
- [ ] Export-to-device: client uses `expo-media-library` to save to camera roll
- [ ] Share sheet: native OS share sheet with the exported file(s)
- [ ] No direct Instagram/TikTok publishing in MVP — user saves to camera roll and posts manually
- [ ] Future: server-side FFmpeg reel generation, Reels/TikTok handoff

**Commits:** export job model → photo pack export → highlight reel metadata export → status polling → download endpoint

---

### Step 12 — `step/12-notifications`
**Push notifications**

- [ ] Expo Push Notification token registration: `PUT /me/push-token`
- [ ] Notification worker (BullMQ):
  - `event.starting_soon` — 1hr before event start
  - `event.started` — at event start datetime
  - `mission.assigned` — when a new mission is assigned (with mission title, kept vague enough not to spoil)
  - `mission.expiring_soon` — 15min before mission expiry
  - `group_mission.live` — when host triggers a group mission (everyone gets it now)
  - `event.ending_soon` — 30min before event end
  - `event.reveal_ready` — when reveal computation is done
  - `event.export_ready` — when export job completes
- [ ] Per-user notification preferences (stored in `UserMissionPreference` / separate table)
- [ ] Quiet hours: no notifications between 02:00-08:00 local time (user configurable)
- [ ] Daily cap: max 15 mission notifications per day per event
- [ ] Notification idempotency keys to prevent duplicates on retry

**Commits:** push token registration → notification worker → mission notifications → event lifecycle notifications → quiet hours + caps → preferences endpoint

---

### Step 13 — `step/13-mobile-foundation`
**Mobile app foundation**

- [ ] Expo Router navigation structure:
  ```
  app/
  ├── (auth)/          # Unauthenticated: splash, login, OTP verify
  ├── (app)/           # Authenticated root
  │   ├── index.tsx    # Home: events list
  │   ├── events/
  │   │   ├── create.tsx
  │   │   ├── [id]/
  │   │   │   ├── index.tsx      # Live event dashboard
  │   │   │   ├── feed.tsx
  │   │   │   ├── reveal.tsx
  │   │   │   └── recap.tsx
  │   └── settings.tsx
  └── _layout.tsx
  ```
- [ ] Zustand stores: `authStore`, `eventStore`, `missionStore`
- [ ] TanStack Query setup with Axios API client (base URL from env)
- [ ] Auth flow: splash → OTP phone input → verify → profile setup → home
- [ ] Push notification permission request on first login
- [ ] Expo SecureStore for session token
- [ ] Basic design system: colors (dark, amber/orange accent), typography (Inter), spacing constants
- [ ] Reusable components: `Button`, `Avatar`, `CountdownChip`, `MissionCard`, `MediaTile`, `EventCard`

**Commits:** expo router setup → zustand + query setup → auth screens → push permission → design system tokens → core components

---

### Step 14 — `step/14-mobile-event-screens`
**Event creation + invite + lobby**

- [ ] Home screen: list of upcoming + past events, "Create Event" CTA
- [ ] Create event flow (multi-step):
  - Step 1: Event name + dates
  - Step 2: Choose template (6 options with icon + description)
  - Step 3: Settings (mission frequency, intensity, allow custom missions toggle, allow public social missions toggle)
  - Step 4: Invite participants (share link / copy code)
- [ ] Join via invite link screen
- [ ] Event lobby / waiting room (event is scheduled, not live yet): participant avatars, countdown to start
- [ ] Custom mission creation screen (accessible from lobby and during live event):
  - Mission title + description
  - Target a specific participant? (dropdown of participants)
  - Media type: Photo / Video / Either
  - Secret mission toggle
  - Assign to everyone or just selected participants
- [ ] Event settings screen (host only, pre-live)

**Commits:** home screen → create event flow → join screen → lobby screen → custom mission creation screen → event settings

---

### Step 15 — `step/15-mobile-live-event`
**Live event experience**

- [ ] Live event dashboard: mission card (current active mission), countdown to next mission, participant activity dots (active/inactive), feed preview strip
- [ ] Mission card states:
  - `no_mission` — waiting for next mission
  - `active` — mission title, description, media type indicator, countdown to expiry, "Complete" CTA
  - `secret` — extra "Shhhh... this one's a secret!" banner with lock icon
  - `completed` — checkmark, greyed out, submission thumbnail
  - `expired` — greyed out, "Missed this one"
- [ ] Mission detail screen: full mission text, media type, timer, camera shortcut
- [ ] Host dashboard extras: participant completion rates, trigger group mission button
- [ ] Polling: 30s live state refresh, 10s when mission is active and about to expire
- [ ] Optimistic UI: mark mission complete immediately on submission, revert on error

**Commits:** live dashboard → mission card component states → host controls → polling setup → optimistic updates

---

### Step 16 — `step/16-mobile-camera`
**Camera + media capture + upload**

- [ ] `expo-camera` integration for in-app capture
- [ ] Photo capture screen: viewfinder, capture button, flash toggle, flip camera
- [ ] Video capture screen: same + record button (hold or tap), duration indicator, 60s max, stops automatically
- [ ] Upload flow:
  1. Capture/select media
  2. Preview screen with confirm/retake
  3. On confirm: call `POST /submissions/init` → get signed URL → upload directly to Supabase Storage → call `POST /submissions/:id/confirm`
  4. Upload progress indicator
  5. Submission confirmation screen with mission completion animation
- [ ] Handle: network loss mid-upload (retry with exponential backoff, max 3 attempts)
- [ ] Handle: app backgrounded mid-upload (use `expo-background-fetch` or just retry on resume)
- [ ] Gallery upload: allowed via `expo-image-picker` as alternative to in-app capture

**Commits:** camera screen photo → camera screen video → upload flow → retry logic → gallery picker → submission confirmation animation

---

### Step 17 — `step/17-mobile-feed`
**Event feed screen**

- [ ] Scrollable grid of submissions (2-column photo grid, full-width for video)
- [ ] During live event: submission visible, mission title hidden (shows "???" or mission category only)
- [ ] Tap media: fullscreen viewer with submitter name, timestamp, reaction strip
- [ ] Emoji reactions: 4 options (fire, heart, laugh, wow), show counts
- [ ] Reaction animation on tap
- [ ] Infinite scroll with cursor-based pagination
- [ ] Empty state: "Be the first to submit something!"
- [ ] Loading states: skeleton tiles

**Commits:** feed grid → fullscreen viewer → reactions → pagination → empty + loading states

---

### Step 18 — `step/18-mobile-reveal-and-recap`
**The reveal + recap experience**

This is the emotional climax of the app.

- [ ] Event ended screen: "The night is over. Get ready for the reveal..." with dramatic countdown (3-2-1)
- [ ] **Reveal screen** — the big moment:
  - Each mission as a card, expandable
  - Inside each mission card: list of users who got it, their `assignedAt` time, their submission(s)
  - For secret missions: header says "SECRET MISSION REVEALED" with lock-unlock animation
  - For custom user-specific missions: show creator + target
  - Timeline: show who got it first, second, etc. — with timestamps
  - Side-by-side comparison if multiple users got same mission: tap to switch
- [ ] Awards screen: animated cards for "Most Active", "Mission Machine", "First Blood", "Best Chaos", "Most Creative" etc.
- [ ] Recap timeline view: submissions ordered by time, chapter markers every 30min
- [ ] By-participant view: select a participant, see their entire journey (missions + submissions in order)
- [ ] Stats card: total submissions, completion rate, total participants

**Commits:** event ended screen → reveal screen mission cards → secret mission reveal animation → awards screen → timeline recap → by-participant view → stats card

---

### Step 19 — `step/19-mobile-export`
**Export + share flow**

- [ ] Recap reel preview: ordered list of video clips + photos played sequentially in-app (no rendering, just native player chain)
- [ ] Export options screen:
  - "Save All Photos" — saves all event photos to camera roll
  - "Save All Videos" — saves all event videos to camera roll
  - "Export Highlight Reel" — downloads ordered list, opens native share sheet
- [ ] Export progress screen with cancel option
- [ ] Native share sheet on export complete
- [ ] "Share the app" CTA at end of export flow (organic growth)
- [ ] No direct platform posting in MVP — user saves and posts manually

**Commits:** export options screen → save photos flow → save videos flow → share sheet integration → export progress → share app CTA

---

### Step 20 — `step/20-safety-and-polish`
**Safety, moderation, and final polish**

- [ ] Report content flow: long-press submission → report → category (inappropriate/harmful/spam) → submitted
- [ ] Block participant flow (from their profile in participant list)
- [ ] Safety mode toggle in event settings: disables all `intensity >= 4` missions and all `isSocial` missions
- [ ] Mission opt-out: user can opt out of categories (public/social, alcohol-related) in their preferences
- [ ] Host can remove participant at any time
- [ ] Moderation queue: basic admin endpoint to list flagged content (manual review for MVP)
- [ ] Empty states polish: all screens have proper empty + error states
- [ ] Offline banner: when network is lost during live event
- [ ] Error boundaries in React
- [ ] Crash reporting (Sentry)
- [ ] App Store / Play Store metadata, icons, splash screen finalized

**Commits:** report flow → block flow → safety mode → mission opt-out preferences → moderation admin endpoint → empty/error state polish → offline detection → Sentry → App Store assets

---

## Current Status

| Step | Branch | Status |
|---|---|---|
| Step 01 | `step/01-monorepo-setup` | ✅ Done |
| Step 02 | `step/02-database-schema` | ✅ Done |
| Step 03 | `step/03-backend-auth` | ✅ Done |
| Step 04 | `step/04-event-crud` | ✅ Done |
| Step 05 | `step/05-mission-engine` | ✅ Done |
| Step 06 | `step/06-live-event-api` | ✅ Done |
| Step 07 | `step/07-media-upload` | ✅ Done |
| Step 08 | `step/08-event-feed-api` | ✅ Done |
| Step 09 | `step/09-event-close-and-reveal` | ✅ Done |
| Step 10 | `step/10-recap-generation` | ✅ Done |
| Step 11 | `step/11-export-system` | ✅ Done |
| Step 12 | `step/12-notifications` | ✅ Done |
| Step 13 | `step/13-mobile-foundation` | ✅ Done |
| Step 14 | `step/14-mobile-event-screens` | ✅ Done |
| Step 15 | `step/15-mobile-live-event` | ✅ Done |
| Step 16 | `step/16-mobile-camera` | ✅ Done |
| Step 17 | `step/17-mobile-feed` | ✅ Done |
| Step 18 | `step/18-mobile-reveal-and-recap` | Not started |
| Step 19 | `step/19-mobile-export` | Not started |
| Step 20 | `step/20-safety-and-polish` | Not started |

---

## Do NOT Build Yet

These are tempting but explicitly excluded from the first version:

- Threaded comments or chat
- Public profiles / social graph / follower system
- Complex drag-and-drop mission builder UI
- Server-side AI video editing or AI clip selection
- Direct Instagram/TikTok/YouTube publishing API integrations (platform limitations make this impractical in MVP)
- Real-time WebSockets (polling is enough for MVP)
- Complex gamification / reputation / XP systems
- Public event discovery feed
- QR code invites (deep link is enough)
- Multi-language / i18n
- Paid subscription / paywall (build product first)
- Complex admin moderation dashboard (manual endpoint review is enough)
- Background audio for recap reel

---

## Core Product Rules

1. **Missions are private during the event.** A user must never be able to see what missions other participants have. This is enforced server-side. Never expose assignment data to other users until after event close.
2. **The reveal is sacred.** The moment where everything is shown must feel dramatic and rewarding. Don't make it boring.
3. **Same mission, different times.** The same mission definition can be assigned to multiple participants at different times (cycling). This is intentional and creates interesting comparison moments in the reveal.
4. **Custom missions are first-class.** User-created missions work identically to system missions. They have a `createdBy` field and optional `targetUserId`. They appear in the reveal like any other mission.
5. **Secret missions get a special UX.** When assigned a secret mission, the user sees a distinctive "Shhhh... this one's a secret mission!" card. At reveal time, these are dramatically uncovered.
6. **The app is NOT a chat app.** No threaded discussion. No group chat. Reactions only.
7. **Build backend before mobile.** Most steps are backend-first. Build and test API endpoints before building mobile screens.
