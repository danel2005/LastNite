// Validate and export all required environment variables at startup.
// The server will refuse to start if any required var is missing.

function required(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: Number(optional('PORT', '3001')),
  HOST: optional('HOST', '0.0.0.0'),

  DATABASE_URL: required('DATABASE_URL'),

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_JWT_SECRET: required('SUPABASE_JWT_SECRET'),

  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

  STORAGE_BUCKET_MEDIA: optional('STORAGE_BUCKET_MEDIA', 'event-media'),

  get isDev() {
    return this.NODE_ENV === 'development'
  },
} as const
