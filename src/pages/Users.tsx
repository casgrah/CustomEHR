import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Card, Field, Msg, Tag, fmtDate } from '../components/ui'
import { ROLES, type AppRole, type Invitation, type Profile } from '../types'

export default function Users() {
  const { profile, isAdmin, refresh } = useSession()
  const [people, setPeople] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [inv, setInv] = useState({ email: '', full_name: '', credential: '', role: 'clinician' as AppRole })

  useEffect(() => { void load() }, [])

  async function load() {
    const { data: p, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) setErr(error.message)
    setPeople((p as Profile[]) ?? [])
    const { data: i } = await supabase.from('invitations').select('*')
      .is('accepted_at', null).order('created_at', { ascending: false })
    setInvites((i as Invitation[]) ?? [])
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setOk('')
    const { error } = await supabase.from('invitations').insert({
      tenant_id: profile!.tenant_id,
      email: inv.email.trim().toLowerCase(),
      full_name: inv.full_name.trim(),
      credential: inv.credential.trim(),
      role: inv.role,
      invited_by: profile!.id,
    })
    if (error) {
      setErr(error.message.includes('invitations_tenant_id_email_key')
        ? 'That email already has an open invitation.' : error.message)
      return
    }
    setOk(`Invited ${inv.email.trim()}. They sign up with that email address and land in this agency as ${
      ROLES.find(r => r.code === inv.role)?.label}.`)
    setInv({ email: '', full_name: '', credential: '', role: 'clinician' })
    void load()
  }

  async function setRole(id: string, role: AppRole) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setErr(error.message); else { void load(); if (id === profile!.id) void refresh() }
  }

  async function setActive(id: string, is_active: boolean) {
    const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id)
    if (error) setErr(error.message); else void load()
  }

  async function revoke(id: string) {
    const { error } = await supabase.from('invitations').delete().eq('id', id)
    if (error) setErr(error.message); else void load()
  }

  if (!isAdmin) return <Msg kind="err">Only an owner or administrator can manage users.</Msg>

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}
      {ok && <Msg kind="ok">{ok}</Msg>}

      <Card title="People"
            note="Users are deactivated, never deleted. Everything they signed keeps resolving to them, with the credential they held at the time.">
        <div className="tw">
          <table>
            <thead>
              <tr><th>Name</th><th>Credential</th><th>Role</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id} style={p.is_active ? undefined : { opacity: .55 }}>
                  <td className="nm">{p.full_name}{p.id === profile!.id && <span className="sub"> (you)</span>}</td>
                  <td className="sub">{p.credential || '—'}</td>
                  <td>
                    <select value={p.role} onChange={e => setRole(p.id, e.target.value as AppRole)}
                            disabled={p.role === 'owner' && p.id !== profile!.id}
                            style={{ fontSize: 12, padding: '3px 6px', width: 'auto' }}>
                      {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>{p.is_active ? <Tag tone="ok">Active</Tag> : <Tag tone="mute">Deactivated</Tag>}</td>
                  <td>
                    {p.id !== profile!.id && (
                      <button className="btn small" onClick={() => setActive(p.id, !p.is_active)}>
                        {p.is_active ? 'Deactivate' : 'Reinstate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Invite someone"
            note="No email is sent yet — this creates the invitation, and whoever signs up with that address joins this agency with the role you picked. Wiring it to an actual email goes through Supabase Auth later.">
        <div className="body">
          <form onSubmit={invite}>
            <div className="fields">
              <Field label="Email"><input type="email" value={inv.email}
                onChange={e => setInv(s => ({ ...s, email: e.target.value }))} required /></Field>
              <Field label="Name"><input value={inv.full_name}
                onChange={e => setInv(s => ({ ...s, full_name: e.target.value }))} /></Field>
              <Field label="Credential"><input value={inv.credential} placeholder="LCSW, CSAC…"
                onChange={e => setInv(s => ({ ...s, credential: e.target.value }))} /></Field>
              <Field label="Role">
                <select value={inv.role} onChange={e => setInv(s => ({ ...s, role: e.target.value as AppRole }))}>
                  {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </Field>
            </div>
            <p className="sub" style={{ margin: '10px 0 0' }}>
              {ROLES.find(r => r.code === inv.role)?.what}
            </p>
            <div className="actions" style={{ marginTop: 13 }}>
              <button className="btn primary">Create invitation</button>
            </div>
          </form>
        </div>
      </Card>

      {invites.length > 0 && (
        <Card title="Open invitations" aside={<span className="n">{invites.length}</span>}>
          <div className="tw">
            <table>
              <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th /></tr></thead>
              <tbody>
                {invites.map(i => (
                  <tr key={i.id}>
                    <td className="nm">{i.email}</td>
                    <td className="sub">{i.full_name || '—'}</td>
                    <td>{ROLES.find(r => r.code === i.role)?.label}</td>
                    <td className="mono sub">{fmtDate(i.created_at.slice(0, 10))}</td>
                    <td><button className="btn small" onClick={() => revoke(i.id)}>Revoke</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
