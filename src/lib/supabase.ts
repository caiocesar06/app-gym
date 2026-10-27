import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null = modo local (sem conta, sem sincronização). */
export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
  : null

export const LOCAL_USER = 'local'
