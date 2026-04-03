# LastNite — Claude Context File

This file gives any new Claude session full context on the project. Read this before doing anything.

---

## What Is LastNite?

A private, temporary, mission-based social mobile app. Users create events (parties, trips, nights out). During the event, the app sends private missions to participants at timed intervals — missions are secret, nobody knows what others got. At the end, everything is revealed: who got what mission, when, and what they submitted. This reveal is the emotional climax of the product.

**Two sacred pillars:**
1. The Mission Engine (during event)
2. The Reveal + Recap (after event)

**It is NOT a chat app, NOT a public social network.**

---

## Danel's Added Ideas (Treat as Hard Requirements)

1. **Custom user missions** — Before/at the start of an event, any participant (not just host) can create custom missions. These can be user-specific: "Take a picture of [participant name] in an awkward moment." At the reveal, all submissions under that mission are shown together.

2. **Mission cycling** — The same mission can be assigned to multiple users at different times. At reveal, you see who got it when and what they submitted. This creates natural comparison moments.

3. **Private missions + Secret missions** — During the event, missions are fully private. Nobody can see what mission anyone else has. Some missions are marked `isSecret: true`. When a user receives a secret mission, they see a special card: "Shhhh... this one's a secret mission!" with a lock icon. When creating a custom mission, the creator can set it as secret or not via dropdown.

4. **Battle missions (Duel mechanic)** — A hunter/target system. User A gets "Take a photo of UserB before they notice! (2 min timer!)" and UserB simultaneously gets "UserA is trying to photograph you — don't let them!" Whoever succeeds gets points. Final reveal has a "BATTLES!" section. Implemented as duo missions with `targetUserId` + a simultaneous "evade" assignment. Points are tracked on `MissionAssignment.points`.

5. **Points system + Prize pot** — Harder/more embarrassing missions worth more points. Winner = most points at reveal. Event has a `prizePot` field (text, e.g. "20 shekel") agreed at creation.

6. **Event templates expanded** — Not just parties. Includes: trek (view/environment missions), ski, wedding ("take a pic with the bride"), birthday, costume_party. Missions match the event type. Also captures pure scenery/environment for long events (treks, trips).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (SDK 51+), Expo Router |
| State | Zustand |
| Data Fetching | TanStack Query + Axios |
| Backend | Node.js + Fastify + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (phone OTP + email magic link) |
| Storage | Supabase Storage (signed URLs) |
| Job Queue | BullMQ + Redis |
| Push | Expo Push Notifications |
| Hosting | Railway (API + Redis) + Supabase (DB + Storage) |
| Monorepo | Turborepo |

---

## Repository Structure

```
LastNite/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── api/             # Fastify backend
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── db/              # Prisma schema + migrations + seed
│   └── config/          # Shared tsconfig, eslint
├── docs/
├── .github/workflows/
├── turbo.json
├── package.json
├── README.md            # Build steps + full project plan
└── CLAUDE.md            # This file
```

---

## Branching Strategy

- `main` — production only
- `dev` — integration branch, all PRs go here
- `step/XX-feature-name` — one branch per step

**Workflow:** `step/XX → PR → dev → (eventually) main`

---

## Build Steps Summary

The README.md has the full detailed plan. Quick reference:

| Step | Branch | What |
|---|---|---|
| 01 | `step/01-monorepo-setup` | Turborepo monorepo, remove StickerSmash placeholder |
| 02 | `step/02-database-schema` | Full Prisma schema, migrations, seed |
| 03 | `step/03-backend-auth` | Supabase Auth, phone OTP, JWT, profile endpoints |
| 04 | `step/04-event-crud` | Event CRUD, invite, join, state machine |
| 05 | `step/05-mission-engine` | Mission definitions, packs, assignment algorithm, cycling, custom missions, secret missions |
| 06 | `step/06-live-event-api` | Live event state endpoint, polling contract |
| 07 | `step/07-media-upload` | Signed URL upload, photo + video submissions |
| 08 | `step/08-event-feed-api` | Event feed, reactions |
| 09 | `step/09-event-close-and-reveal` | Close event, reveal computation, awards |
| 10 | `step/10-recap-generation` | Recap artifacts, heuristics |
| 11 | `step/11-export-system` | Photo pack + highlight reel export |
| 12 | `step/12-notifications` | Expo push, mission assigned, recap ready, quiet hours |
| 13 | `step/13-mobile-foundation` | Expo Router, Zustand, auth screens, design system |
| 14 | `step/14-mobile-event-screens` | Create event, join, lobby, custom mission creation |
| 15 | `step/15-mobile-live-event` | Live dashboard, mission cards, host controls |
| 16 | `step/16-mobile-camera` | Camera capture, upload flow, retry logic |
| 17 | `step/17-mobile-feed` | Feed grid, fullscreen viewer, reactions |
| 18 | `step/18-mobile-reveal-and-recap` | Reveal screen, secret mission reveal, awards, timeline |
| 19 | `step/19-mobile-export` | Export options, save to camera roll, share sheet |
| 20 | `step/20-safety-and-polish` | Report/block, safety mode, opt-outs, Sentry, App Store assets |

---

## Key Domain Entities

- **User / Profile** — auth identity + display info
- **Event** — the core unit (title, start/end, state, template, settings)
- **Participant** — user's membership in an event
- **Invite** — join code/link
- **MissionDefinition** — reusable mission template (can be system or user-created)
- **MissionPack** — curated collection of definitions
- **MissionInstance** — a definition instantiated for a specific event
- **MissionAssignment** — a specific user getting a specific instance at a specific time (with `assignedAt`, `completedAt`, `isSecret`)
- **Submission** — a user's response to a mission assignment
- **SubmissionAsset** — the actual photo/video file metadata + storage reference
- **RecapArtifact** — computed metadata for the post-event recap
- **ExportJob** — async export task

---

## Critical Invariants

1. **During a live event, a user must NEVER see another user's MissionAssignment.** Only the user's own assignments are returned. This is enforced server-side. Never expose assignment data until after `event.state = completed`.

2. **Secret missions (`isSecret: true`) get a special UX on assignment.** The server includes an `isSecret` flag in the assignment response. The mobile client shows the "Shhhh..." card. This flag is included in the reveal.

3. **Mission cycling means one MissionInstance → many MissionAssignments** (different users, different times). The reveal shows all assignments for a mission grouped together for comparison.

4. **Custom missions have `createdBy: userId` and optional `targetUserId`.** They are stored as `MissionDefinition` rows with `eventId` scope (not global). They work identically to system missions in the assignment algorithm.

5. **No direct social platform publishing in MVP.** Export = save to camera roll + native share sheet. Users post to Instagram/TikTok manually.

---

## What NOT To Build

- Chat / threaded comments
- Public social graph / follower system
- Server-side AI video editing
- Direct Instagram/TikTok/YouTube API publishing
- Real-time WebSockets (polling for MVP)
- Complex gamification / XP / leaderboards
- Public event discovery
- QR code invites
- Multi-language / i18n
- Paid tiers / paywalls
- Complex admin dashboard

---

## Current Progress

Check the Status table in README.md for which steps are done/in-progress.

---

## How We Work

- Always create a branch for the step being worked on: `git checkout -b step/XX-name dev`
- Make multiple atomic commits per step (not one giant commit)
- After EVERY commit: `git push` (or `git push -u origin <branch>` for first push on new branch) — Danel needs to see branches live on GitHub
- When step is done: merge into `dev`, then `git push` dev immediately
- Steps are meant to be asked one at a time: "Do step 01", "Do step 02", etc.
- Claude should read this file + README.md at the start of any new session
- Update the Status table in README.md when a step is completed
- Update this CLAUDE.md if any major decisions change

---

## Where The Blueprint Came From

The full product blueprint (200+ pages) was generated from the `idea` file in `/home/danelc/lastnight/` and saved as `LastNite_Product_Blueprint.docx`. The `generate_doc.py` script generated that docx. You don't need to re-read those — this file + README.md capture everything relevant to implementation.
