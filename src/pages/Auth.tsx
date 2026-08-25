import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Field, Msg } from '../components/ui'

export default function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setOk(''); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim(), org_name: orgName.trim() } },
        })
        if (error) throw error
        if (!data.session) setOk('Check your email to confirm the address, then sign in.')
      }
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="authwrap">
      <div className="authbox">
        <div style={{ marginBottom: 14 }}>
          <div className="brand" style={{ color: 'var(--ink)', fontSize: 20 }}>
            EHR<span style={{ color: 'var(--ink-faint)' }}>Sandbox</span>
          </div>
        </div>

        <Card
          title={mode === 'in' ? 'Sign in' : 'Create an account'}
          note={mode === 'up'
            ? 'If someone has invited you, sign up with the email address they invited — you will join their agency with the role they chose. Otherwise you start a new agency and become its owner.'
            : 'No real client information belongs in this environment.'}
        >
          <div className="body">
            <div className="seg" style={{ marginBottom: 16 }}>
              <button type="button" aria-pressed={mode === 'in'} onClick={() => setMode('in')}>Sign in</button>
              <button type="button" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Sign up</button>
            </div>

            {err && <Msg kind="err">{err}</Msg>}
            {ok && <Msg kind="ok">{ok}</Msg>}

            <form onSubmit={submit}>
              <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
                {mode === 'up' && (
                  <>
                    <Field label="Your name">
                      <input value={fullName} onChange={e => setFullName(e.target.value)}
                             placeholder="Casey Reyes" required />
                    </Field>
                    <Field label="Agency name">
                      <input value={orgName} onChange={e => setOrgName(e.target.value)}
                             placeholder="Leave blank if you were invited" />
                    </Field>
                  </>
                )}
                <Field label="Email">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         autoComplete="username" required />
                </Field>
                <Field label="Password">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                         autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                         minLength={8} required />
                </Field>
              </div>
              <div className="actions" style={{ marginTop: 16 }}>
                <button className="btn primary" disabled={busy}>
                  {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
