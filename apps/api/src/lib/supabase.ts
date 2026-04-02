import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Admin client — uses service_role key, bypasses Row Level Security.
// Only used server-side. NEVER expose this key to the client.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
