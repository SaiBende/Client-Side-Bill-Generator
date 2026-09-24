import { createClient } from '@supabase/supabase-js'
import { createLocalAdapter, isDesktopMode } from './desktop'

function createWebClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = isDesktopMode ? createLocalAdapter() : createWebClient()