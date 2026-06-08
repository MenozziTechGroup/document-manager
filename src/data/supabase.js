// Supabase client + auth for the shared team backend.
// The anon key is PUBLIC by design — row-level security + per-user login
// (enforced in the database) are what actually protect the data.
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://vuhvqqeywaaeaohplxlk.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1aHZxcWV5d2FhZWFvaHBseGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTc4MzAsImV4cCI6MjA5NjQ5MzgzMH0.F1MbTBceNXKj_VVq_P9od7zIoAG4QxP43kWMfEIGaj8'

export function isCloudConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY
}

export const supabase = isCloudConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

// ---- Session tracking (synchronous access for the data layer) ----

let _session = null
if (supabase) {
  supabase.auth.getSession().then(({ data }) => { _session = data.session ?? null })
  supabase.auth.onAuthStateChange((_e, s) => { _session = s ?? null })
}

/** True when the cloud is configured AND a user is signed in. */
export function useCloud() {
  return isCloudConfigured() && !!_session
}

/** Signed-in user's email (for audit attribution / updated_by). */
export function currentEmail() {
  return _session?.user?.email ?? ''
}

// ---- Auth helpers ----

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  _session = data.session ?? null
  return _session
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Cloud backend is not configured.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Subscribe to auth changes. Returns an unsubscribe function. */
export function onAuthChange(cb) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session ?? null))
  return () => data.subscription.unsubscribe()
}

/** The signed-in user's email (used to attribute audit entries). */
export function currentUserEmail(session) {
  return session?.user?.email ?? ''
}
