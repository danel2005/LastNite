import { PrismaClient, type MissionCategory, type MissionMediaType } from '@prisma/client'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// MISSION DEFINITIONS — 60 system missions across all categories
// ─────────────────────────────────────────────────────────────────────────────

type MissionDef = {
  title: string
  description: string
  category: MissionCategory
  mediaType: MissionMediaType
  intensity: number
  isSocial: boolean
  defaultIsSecret: boolean
  minDurationMs?: number
  maxDurationMs?: number
}

const MISSIONS: MissionDef[] = [
  // ── SELFIE ────────────────────────────────────────────────────────────────
  {
    title: 'Current mood',
    description: 'Take a selfie that captures exactly how you feel right now.',
    category: 'selfie', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Location check',
    description: 'Selfie showing where you are right now.',
    category: 'selfie', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Dramatic pose',
    description: 'Strike the most dramatic pose you can manage.',
    category: 'selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Eyes closed selfie',
    description: 'Take a selfie with your eyes fully closed.',
    category: 'selfie', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Front vs back',
    description: 'Take a selfie, then spin around and photograph what\'s behind you. Two shots.',
    category: 'selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },

  // ── GROUP SELFIE ──────────────────────────────────────────────────────────
  {
    title: 'Squad up',
    description: 'Get everyone in frame. Nobody gets left out.',
    category: 'group_selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Pile in',
    description: 'Get as many people as physically possible into one selfie.',
    category: 'group_selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Worst face',
    description: 'Group selfie where EVERYONE pulls the worst face they can.',
    category: 'group_selfie', mediaType: 'photo', intensity: 3, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Height order',
    description: 'Line up by height and take the photo. Tallest on one side, shortest on the other.',
    category: 'group_selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Best smile in the room',
    description: 'Find and photograph the best smile in the group right now.',
    category: 'group_selfie', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Shoe audit',
    description: 'Everyone puts their feet together. Photograph the result from above.',
    category: 'group_selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Hands in',
    description: 'Everyone puts their hand in the middle. Photograph from above.',
    category: 'group_selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },

  // ── DUO ───────────────────────────────────────────────────────────────────
  {
    title: 'Find your partner',
    description: 'Grab the person nearest to you and take a photo together.',
    category: 'duo', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Mirror twins',
    description: 'Find someone and copy their exact pose or expression side-by-side.',
    category: 'duo', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: '5-second vibe check',
    description: 'Record a 5-second video with the person next to you. No words — just vibes.',
    category: 'duo', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 10000,
  },
  {
    title: 'Secret handshake',
    description: 'Invent a secret handshake with someone right now and film it.',
    category: 'duo', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 20000,
  },

  // ── OBJECT HUNT ───────────────────────────────────────────────────────────
  {
    title: 'Something red',
    description: 'Find and photograph the reddest thing in the room.',
    category: 'object_hunt', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Most expensive thing',
    description: 'Find and photograph the thing that looks most expensive here.',
    category: 'object_hunt', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Weirdest thing',
    description: 'Find and photograph the strangest or most out-of-place thing you can spot.',
    category: 'object_hunt', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Best drink in the room',
    description: 'Find and photograph the most impressive or ridiculous drink present.',
    category: 'object_hunt', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Double take',
    description: 'Find something worth a second look and photograph it from two different angles.',
    category: 'object_hunt', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },

  // ── ENVIRONMENT ───────────────────────────────────────────────────────────
  {
    title: 'The vibe',
    description: 'Take a wide shot that captures the overall atmosphere right now.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Best corner',
    description: 'Find the most interesting corner or spot in the venue and photograph it.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Sky check',
    description: 'Step outside or find a window and photograph what\'s above.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Street level',
    description: 'Take a photo from as low as possible — floor level or crouched down.',
    category: 'environment', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Candid moment',
    description: 'Take a natural, unposed photo of what\'s happening around you.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },

  // ── FOOD & DRINK ──────────────────────────────────────────────────────────
  {
    title: 'Cheers',
    description: 'Photograph a cheers moment with whatever everyone is holding.',
    category: 'food_drink', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Dramatic cheers video',
    description: 'Record a dramatic cheers moment. Slow motion energy. Make it cinematic.',
    category: 'food_drink', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 15000,
  },
  {
    title: 'Mystery reaction',
    description: 'Find something to eat or drink and capture your honest reaction on video.',
    category: 'food_drink', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 15000,
  },

  // ── MOOD / VIBE ───────────────────────────────────────────────────────────
  {
    title: 'One sentence',
    description: 'Record yourself saying exactly one sentence describing this moment.',
    category: 'mood_vibe', mediaType: 'video', intensity: 1, isSocial: false, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 10000,
  },
  {
    title: 'Current energy level',
    description: 'Show your energy right now in a 3-second video. No words needed.',
    category: 'mood_vibe', mediaType: 'video', intensity: 1, isSocial: false, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 8000,
  },
  {
    title: 'Confession booth',
    description: 'Look directly at the camera and say one thing about tonight. Anything.',
    category: 'mood_vibe', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: true,
    minDurationMs: 3000, maxDurationMs: 20000,
  },
  {
    title: 'The midnight interview',
    description: 'Point the camera at someone and ask "How\'s your night going?" Film their answer.',
    category: 'mood_vibe', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 20000,
  },
  {
    title: 'Quick hello',
    description: 'Record a 3-second video of yourself waving hello to whoever watches this later.',
    category: 'mood_vibe', mediaType: 'video', intensity: 1, isSocial: false, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 8000,
  },

  // ── CHAOS ─────────────────────────────────────────────────────────────────
  {
    title: 'Loudest person',
    description: 'Capture the loudest, most chaotic person in the room right now.',
    category: 'chaos', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 15000,
  },
  {
    title: 'Background chaos',
    description: 'Take a photo where the most interesting thing is happening BEHIND you.',
    category: 'chaos', mediaType: 'photo', intensity: 3, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Dance floor truth',
    description: 'Film 5 seconds of what\'s actually happening on the dance floor right now.',
    category: 'chaos', mediaType: 'video', intensity: 4, isSocial: false, defaultIsSecret: false,
    minDurationMs: 4000, maxDurationMs: 10000,
  },
  {
    title: 'Worst dancer',
    description: 'Find the person dancing the hardest (or worst) and capture the moment.',
    category: 'chaos', mediaType: 'video', intensity: 4, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 10000,
  },
  {
    title: 'Slow zoom',
    description: 'Start wide, slowly zoom into the most interesting thing happening right now.',
    category: 'chaos', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 4000, maxDurationMs: 15000,
  },

  // ── PUBLIC / SOCIAL (isSocial=true — requires opt-in on event) ───────────
  {
    title: 'Selfie with a stranger',
    description: 'Politely ask someone you don\'t know for a quick selfie. If they say no, respect it.',
    category: 'public_social', mediaType: 'photo', intensity: 3, isSocial: true, defaultIsSecret: false,
  },
  {
    title: 'Wave at the camera',
    description: 'Ask someone nearby to wave at the camera. They can say no — totally fine!',
    category: 'public_social', mediaType: 'photo', intensity: 2, isSocial: true, defaultIsSecret: false,
  },
  {
    title: 'Selfie with staff',
    description: 'Ask a bartender or venue staff member for a quick selfie. Be polite. Tip well.',
    category: 'public_social', mediaType: 'photo', intensity: 2, isSocial: true, defaultIsSecret: false,
  },
  {
    title: 'Thumbs up from a stranger',
    description: 'Get a stranger to give a thumbs up toward your camera. Ask nicely. No pressure.',
    category: 'public_social', mediaType: 'photo', intensity: 2, isSocial: true, defaultIsSecret: false,
  },
  {
    title: 'Cheers with a random person',
    description: 'Film a friendly cheers with someone outside your group. Ask first.',
    category: 'public_social', mediaType: 'video', intensity: 3, isSocial: true, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 15000,
  },
  {
    title: 'One word from a stranger',
    description: 'Ask someone nearby to say ONE word on camera — anything they want.',
    category: 'public_social', mediaType: 'video', intensity: 3, isSocial: true, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 10000,
  },

  // ── TARGET PERSON ─────────────────────────────────────────────────────────
  {
    title: 'Catch them off guard',
    description: 'Take a candid photo of someone in the group when they\'re not expecting it.',
    category: 'target_person', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: true,
  },
  {
    title: 'The look',
    description: 'Capture the look someone in the group is giving right now. You know the one.',
    category: 'target_person', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: true,
  },
  {
    title: 'Best reaction',
    description: 'Find someone in the group and capture their reaction to something happening.',
    category: 'target_person', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 10000,
  },
  {
    title: 'Most photogenic moment',
    description: 'Find someone and wait for their best natural moment, then shoot.',
    category: 'target_person', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },

  // ── EVERYONE NOW ──────────────────────────────────────────────────────────
  {
    title: 'Freeze frame',
    description: 'Everyone: photograph exactly what you\'re doing in the next 10 seconds.',
    category: 'everyone_now', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Night check-in',
    description: 'Everyone: take a selfie right now. No posing. Just real.',
    category: 'everyone_now', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Point at something',
    description: 'Everyone: point at the most interesting thing around you right now. Photograph it.',
    category: 'everyone_now', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },

  // ── EXTRA SELFIE ──────────────────────────────────────────────────────────
  {
    title: 'The awkward selfie',
    description: 'Take the most awkward, unflattering selfie you can manage.',
    category: 'selfie', mediaType: 'photo', intensity: 3, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Invisible selfie',
    description: 'Take a selfie where you pretend you\'re invisible. Do NOT look at the camera.',
    category: 'selfie', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },

  // ── EXTRA FOOD & DRINK ────────────────────────────────────────────────────
  {
    title: 'Plate presentation',
    description: 'Photograph whatever you\'re eating/drinking as if it\'s in a Michelin-star restaurant.',
    category: 'food_drink', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Order something unusual',
    description: 'Order or grab something you\'ve never tried before and film your first reaction.',
    category: 'food_drink', mediaType: 'video', intensity: 2, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 20000,
  },

  // ── EXTRA ENVIRONMENT (for trek/ski/outdoor events) ───────────────────────
  {
    title: 'Horizon shot',
    description: 'Find a clear line between ground and sky. Make it beautiful.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Nature close-up',
    description: 'Get extremely close to something natural — bark, rock, snow, leaf — and photograph the texture.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Golden moment',
    description: 'Find and photograph the best light you can see right now.',
    category: 'environment', mediaType: 'photo', intensity: 1, isSocial: false, defaultIsSecret: false,
  },

  // ── EXTRA DUO ─────────────────────────────────────────────────────────────
  {
    title: 'Back to back',
    description: 'Stand back-to-back with someone and photograph from above.',
    category: 'duo', mediaType: 'photo', intensity: 2, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Synchronized move',
    description: 'Convince one person to do the exact same move as you at the same time. Film it.',
    category: 'duo', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 3000, maxDurationMs: 15000,
  },

  // ── FINALE — assigned to all participants near event end ──────────────────
  {
    title: 'Last photo of the night',
    description: 'This is it. Take the photo that sums up everything that happened tonight.',
    category: 'finale', mediaType: 'photo', intensity: 3, isSocial: false, defaultIsSecret: false,
  },
  {
    title: 'Final group video',
    description: 'Get everyone together. Record 10 seconds. This is the ending.',
    category: 'finale', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 5000, maxDurationMs: 15000,
  },
  {
    title: 'One word for tonight',
    description: 'Record yourself saying one word that captures this entire night.',
    category: 'finale', mediaType: 'video', intensity: 3, isSocial: false, defaultIsSecret: false,
    minDurationMs: 2000, maxDurationMs: 8000,
  },
  {
    title: 'Final confession',
    description: 'Look at the camera. Say the one thing you\'ve been thinking all night.',
    category: 'finale', mediaType: 'video', intensity: 5, isSocial: false, defaultIsSecret: true,
    minDurationMs: 3000, maxDurationMs: 15000,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// MISSION PACKS
// ─────────────────────────────────────────────────────────────────────────────

type PackDef = {
  name: string
  description: string
  slug: string
  categories: MissionCategory[]
  maxIntensity: number
}

const PACKS: PackDef[] = [
  {
    name: 'Party Pack',
    description: 'The classic LastNite pack. Works for any party, night out, or gathering.',
    slug: 'party',
    categories: ['selfie', 'group_selfie', 'duo', 'chaos', 'mood_vibe', 'food_drink', 'finale', 'everyone_now'],
    maxIntensity: 4,
  },
  {
    name: 'Chill Pack',
    description: 'Low-intensity, easy missions. Great for dinners, relaxed gatherings, mixed ages.',
    slug: 'chill',
    categories: ['selfie', 'group_selfie', 'environment', 'food_drink', 'mood_vibe', 'object_hunt'],
    maxIntensity: 2,
  },
  {
    name: 'Chaos Pack',
    description: 'High-energy, chaotic missions. Not for the faint of heart.',
    slug: 'chaos',
    categories: ['chaos', 'duo', 'group_selfie', 'mood_vibe', 'finale', 'everyone_now'],
    maxIntensity: 5,
  },
  {
    name: 'Safe Mode Pack',
    description: 'Gentle, inclusive missions. No awkward dares. Great for mixed groups.',
    slug: 'safe',
    categories: ['selfie', 'group_selfie', 'environment', 'object_hunt', 'mood_vibe'],
    maxIntensity: 2,
  },
  {
    name: 'Public Social Pack',
    description: 'Includes public interaction missions. Requires allowPublicSocialMissions on the event.',
    slug: 'public-social',
    categories: ['public_social', 'selfie', 'duo', 'chaos'],
    maxIntensity: 4,
  },
  {
    name: 'Bachelor / Bachelorette Pack',
    description: 'Mission-heavy pack for the big send-off. High energy, group focused.',
    slug: 'bachelor',
    categories: ['chaos', 'group_selfie', 'duo', 'target_person', 'finale', 'everyone_now'],
    maxIntensity: 4,
  },
  {
    name: 'Trip Pack',
    description: 'For vacations, road trips, and travel groups. Environment and memory focused.',
    slug: 'trip',
    categories: ['environment', 'selfie', 'group_selfie', 'object_hunt', 'mood_vibe', 'finale'],
    maxIntensity: 3,
  },
  {
    name: 'Adventure Pack',
    description: 'For treks, ski trips, and outdoor adventures. Environment-heavy, captures scenery and moments.',
    slug: 'adventure',
    categories: ['environment', 'selfie', 'group_selfie', 'object_hunt', 'duo', 'mood_vibe'],
    maxIntensity: 3,
  },
  {
    name: 'Birthday Pack',
    description: 'Celebratory missions. The birthday person is the star.',
    slug: 'birthday',
    categories: ['group_selfie', 'target_person', 'food_drink', 'mood_vibe', 'finale', 'everyone_now'],
    maxIntensity: 3,
  },
  {
    name: 'Finale Pack',
    description: 'End-of-night missions only. Used to close any event with a bang.',
    slug: 'finale',
    categories: ['finale', 'everyone_now'],
    maxIntensity: 5,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.info('🌱 Seeding LastNite database...\n')

  // Wipe system data in correct dependency order
  console.info('  Clearing existing system seed data...')
  await prisma.missionPackDefinition.deleteMany({})
  await prisma.missionPack.deleteMany({ where: { isSystem: true } })
  await prisma.missionDefinition.deleteMany({ where: { isSystem: true } })

  // ── Create mission definitions ───────────────────────────────────────────
  console.info(`  Creating ${MISSIONS.length} mission definitions...`)
  const createdDefs = await Promise.all(
    MISSIONS.map((m) =>
      prisma.missionDefinition.create({
        data: {
          title: m.title,
          description: m.description,
          category: m.category,
          mediaType: m.mediaType,
          intensity: m.intensity,
          isSocial: m.isSocial,
          defaultIsSecret: m.defaultIsSecret,
          minDurationMs: m.minDurationMs ?? null,
          maxDurationMs: m.maxDurationMs ?? null,
          isSystem: true,
        },
      }),
    ),
  )
  console.info(`  ✓ ${createdDefs.length} mission definitions created\n`)

  // ── Create packs and link definitions ────────────────────────────────────
  console.info(`  Creating ${PACKS.length} mission packs...`)
  for (const packDef of PACKS) {
    const pack = await prisma.missionPack.create({
      data: {
        name: packDef.name,
        description: packDef.description,
        slug: packDef.slug,
        isSystem: true,
      },
    })

    const matchingDefs = createdDefs.filter(
      (d) =>
        packDef.categories.includes(d.category as MissionCategory) &&
        d.intensity <= packDef.maxIntensity,
    )

    if (matchingDefs.length > 0) {
      await prisma.missionPackDefinition.createMany({
        data: matchingDefs.map((d) => ({
          packId: pack.id,
          definitionId: d.id,
        })),
      })
    }

    console.info(`  ✓ "${pack.name}" → ${matchingDefs.length} missions`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalDefs = await prisma.missionDefinition.count({ where: { isSystem: true } })
  const totalPacks = await prisma.missionPack.count({ where: { isSystem: true } })
  const totalLinks = await prisma.missionPackDefinition.count()

  console.info(`\n✅ Seed complete.`)
  console.info(`   ${totalDefs} mission definitions`)
  console.info(`   ${totalPacks} mission packs`)
  console.info(`   ${totalLinks} pack→definition links`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
