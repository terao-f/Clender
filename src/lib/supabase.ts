import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key length:', supabaseAnonKey?.length)

if (!supabaseUrl || supabaseUrl === 'undefined') {
  throw new Error('Missing or invalid VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined') {
  throw new Error('Missing or invalid VITE_SUPABASE_ANON_KEY environment variable')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})