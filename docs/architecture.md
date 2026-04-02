# LastNite Architecture

## Monorepo Structure

```
LastNite/
├── apps/
│   ├── mobile/      Expo Router app (React Native)
│   └── api/         Fastify backend (Node.js)
├── packages/
│   ├── shared/      Shared TypeScript types — single source of truth
│   ├── db/          Prisma schema + migrations + seed
│   └── config/      Shared tsconfig + eslint config
```

## Key Invariants

See CLAUDE.md for the full list. Short version:

1. **Mission privacy during live events** — `GET /events/:id/my-missions` only returns YOUR missions. Other users' assignments are NEVER in any response until after `event.state = completed`.
2. **Mission cycling** — One `MissionInstance` → many `MissionAssignment` rows (different users, different `assignedAt` times).
3. **Secret missions** — `isSecret: true` on `MissionAssignment`. Client shows special "Shhhh" card. Revealed dramatically at the end.
4. **Custom missions** — `MissionDefinition` with `createdByUserId` and optional `targetUserId`. Scoped to one event via `eventId`.

## Data Flow

```
Host creates event
  → EventTemplate selected (hardcoded in step/02)
  → MissionInstances created from template's MissionPack
  → event.state = scheduled

At event start datetime:
  → event.state = live
  → Mission dispatch worker starts
  → Every N minutes: MissionAssignment created per participant
  → Expo push notification sent to each participant

Participant receives mission:
  → Sees ONLY their own assignment (isSecret → "Shhhh" card)
  → Captures media (photo or video)
  → Upload: POST /submissions/init → signed URL → upload → POST /submissions/:id/confirm
  → MissionAssignment.status = completed

At event end:
  → event.state = ending → processing
  → Reveal computation job runs (groups all assignments by mission)
  → RecapArtifact generated
  → event.state = completed
  → All participants notified: "The reveal is ready"

Participants view reveal:
  → See ALL missions and who got them, when, and what they submitted
  → Secret missions dramatically uncovered
  → Awards computed and shown
```

## Tech Stack Decision Log

| Decision | Choice | Reason |
|---|---|---|
| Mobile framework | Expo Router | File-based routing, great DX, handles permissions/camera well |
| Backend | Fastify | Faster than Express, great TypeScript support, plugin system |
| ORM | Prisma | Type-safe, great migration system, easy to read schema |
| Auth | Supabase | Handles phone OTP, JWT, no auth server to build |
| Storage | Supabase Storage | S3-compatible, signed URLs, free tier, same vendor as auth |
| Job queue | BullMQ + Redis | Reliable, great for scheduled mission dispatch |
| State (mobile) | Zustand | No boilerplate, works well with React Query |
| Data fetching | TanStack Query | Caching, polling, optimistic updates |
| Monorepo | Turborepo | Task caching, simple setup |
