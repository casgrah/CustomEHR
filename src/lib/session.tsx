import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, Tenant } from '../types'

type Ctx = {
  session: Session | null
  profile: Profile | null
  tenant: Tenant | null
  loading: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionCtx = createContext<Ctx | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(s: Session | null) {
    if (!s) { setProfile(null); setTenant(null); setLoading(false); return }
    // The signup trigger creates the profile. On a brand-new account the row can
    // land a beat after the session does, so give it a couple of tries.
    let p: Profile | null = null
    for (let i = 0; i < 5 && !p; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
      p = (data as Profile) ?? null
      if (!p) await new Promise(r => setTimeout(r, 400))
    }
    setProfile(p)
    if (p) {
      const { data: t } = await supabase.from('tenants').select('*').eq('id', p.tenant_id).maybeSingle()
      setTenant((t as Tenant) ?? null)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); load(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setLoading(true); load(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: Ctx = {
    session, profile, tenant, loading,
    isAdmin: profile?.role === 'owner' || profile?.role === 'admin',
    refresh: () => load(session),
    signOut: async () => { await supabase.auth.signOut() },
  }
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const c = useContext(SessionCtx)
  if (!c) throw new Error('useSession must be used inside <SessionProvider>')
  return c
}
