import type { EventTemplate } from '@prisma/client'

export interface EventTemplateConfig {
  template: EventTemplate
  defaultDurationHours: number
  defaultMissionIntervalMinutes: number
  defaultMissionIntensity: number
  defaultAllowPublicSocial: boolean
  defaultSafeMode: boolean
  /** Pack slugs that will be activated for events using this template */
  packSlugs: string[]
}

export const EVENT_TEMPLATES: Record<EventTemplate, EventTemplateConfig> = {
  house_party: {
    template: 'house_party',
    defaultDurationHours: 4,
    defaultMissionIntervalMinutes: 30,
    defaultMissionIntensity: 3,
    defaultAllowPublicSocial: false,
    defaultSafeMode: false,
    packSlugs: ['party', 'chaos'],
  },
  night_out: {
    template: 'night_out',
    defaultDurationHours: 5,
    defaultMissionIntervalMinutes: 30,
    defaultMissionIntensity: 4,
    defaultAllowPublicSocial: true,
    defaultSafeMode: false,
    packSlugs: ['party', 'chaos', 'public-social'],
  },
  birthday: {
    template: 'birthday',
    defaultDurationHours: 4,
    defaultMissionIntervalMinutes: 40,
    defaultMissionIntensity: 3,
    defaultAllowPublicSocial: false,
    defaultSafeMode: false,
    packSlugs: ['party', 'birthday'],
  },
  bachelor_bachelorette: {
    template: 'bachelor_bachelorette',
    defaultDurationHours: 6,
    defaultMissionIntervalMinutes: 25,
    defaultMissionIntensity: 5,
    defaultAllowPublicSocial: true,
    defaultSafeMode: false,
    packSlugs: ['bachelor', 'chaos', 'public-social'],
  },
  trip: {
    template: 'trip',
    defaultDurationHours: 8,
    defaultMissionIntervalMinutes: 60,
    defaultMissionIntensity: 2,
    defaultAllowPublicSocial: false,
    defaultSafeMode: false,
    packSlugs: ['chill', 'adventure'],
  },
  festival: {
    template: 'festival',
    defaultDurationHours: 8,
    defaultMissionIntervalMinutes: 45,
    defaultMissionIntensity: 4,
    defaultAllowPublicSocial: true,
    defaultSafeMode: false,
    packSlugs: ['party', 'public-social', 'chaos'],
  },
  trek: {
    template: 'trek',
    defaultDurationHours: 6,
    defaultMissionIntervalMinutes: 60,
    defaultMissionIntensity: 2,
    defaultAllowPublicSocial: false,
    defaultSafeMode: true,
    packSlugs: ['adventure', 'chill'],
  },
  ski: {
    template: 'ski',
    defaultDurationHours: 8,
    defaultMissionIntervalMinutes: 60,
    defaultMissionIntensity: 3,
    defaultAllowPublicSocial: false,
    defaultSafeMode: false,
    packSlugs: ['adventure', 'chaos'],
  },
  wedding: {
    template: 'wedding',
    defaultDurationHours: 6,
    defaultMissionIntervalMinutes: 40,
    defaultMissionIntensity: 2,
    defaultAllowPublicSocial: false,
    defaultSafeMode: true,
    packSlugs: ['chill', 'birthday'],
  },
  costume_party: {
    template: 'costume_party',
    defaultDurationHours: 4,
    defaultMissionIntervalMinutes: 30,
    defaultMissionIntensity: 4,
    defaultAllowPublicSocial: false,
    defaultSafeMode: false,
    packSlugs: ['party', 'chaos'],
  },
}

export function getTemplateConfig(template: EventTemplate): EventTemplateConfig {
  return EVENT_TEMPLATES[template]
}
