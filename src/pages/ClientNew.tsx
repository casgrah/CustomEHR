import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Card, Field, Msg } from '../components/ui'
import type { Facility, Profile, ValueListItem } from '../types'

export default function ClientNew() {
  const nav = useNavigate()
  const { profile } = useSession()

  const [locs, setLocs] = useState<ValueListItem[]>([])
  const [payers, setPayers] = useState<ValueListItem[]>([])
  const [flagList, setFlagList] = useState<ValueListItem[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [f, setF] = useState({
    first_name: '', last_name: '', preferred_name: '', mrn: '', dob: '',
    medicaid_id: '', payer: '', phone: '', email: '', notes: '',
  })
  const [admit, setAdmit] = useState(true)
  const [ep, setEp] = useState({
    level_of_care: '', admit_date: new Date().toISOString().slice(0, 10),
    facility_id: '', primary_counselor: '',
  })

  useEffect(() => { void load() }, [])

  async function load() {
    const { data: lists } = await supabase.from('value_lists').select('id, key')
    const byKey = Object.fromEntries((lists ?? []).map((l: any) => [l.key, l.id]))
    if (byKey.loc) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.loc).eq('is_active', true).order('sort_order')
      setLocs((data as ValueListItem[]) ?? [])
      setEp(s => ({ ...s, level_of_care: (data as ValueListItem[])?.[0]?.code ?? '' }))
    }
    if (byKey.payers) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.payers).eq('is_active', true).order('sort_order')
      setPayers((data as ValueListItem[]) ?? [])
    }
    if (byKey.flags) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.flags).eq('is_active', true).order('sort_order')
      setFlagList((data as ValueListItem[]) ?? [])
    }
    const { data: fac } = await supabase.from('facilities').select('*').eq('is_active', true).order('name')
    setFacilities((fac as Facility[]) ?? [])
    if ((fac as Facility[])?.length) setEp(s => ({ ...s, facility_id: (fac as Facility[])[0].id }))
    const { data: st } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name')
    setStaff((st as Profile[]) ?? [])
    if (profile) setEp(s => ({ ...s, primary_counselor: profile.id }))
  }

  function set<K extends keyof typeof f>(k: K, v: string) { setF(s => ({ ...s, [k]: v })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const { data: client, error } = await supabase.from('clients').insert({
        tenant_id: profile!.tenant_id,
        mrn: f.mrn.trim(),
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        preferred_name: f.preferred_name.trim(),
        dob: f.dob || null,
        medicaid_id: f.medicaid_id.trim(),
        payer: f.payer,
        phone: f.phone.trim(),
        email: f.email.trim(),
        notes: f.notes.trim(),
        flags,
        created_by: profile!.id,
      }).select().single()
      if (error) throw error

      if (admit) {
        const { error: e2 } = await supabase.from('episodes').insert({
          tenant_id: profile!.tenant_id,
          client_id: client.id,
          facility_id: ep.facility_id || null,
          level_of_care: ep.level_of_care,
          admit_date: ep.admit_date,
          primary_counselor: ep.primary_counselor || null,
        })
        if (e2) throw e2
      }
      nav(`/clients/${client.id}`)
    } catch (e: any) {
      setErr(e.message?.includes('clients_tenant_id_mrn_key')
        ? 'That MRN already exists for this agency. MRNs are unique per agency.'
        : (e.message ?? String(e)))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      {err && <Msg kind="err">{err}</Msg>}

      <Card title="New client"
            note="A client record and an episode are separate things. The client is the person; the episode is one admission at one level of care. A service event belongs to the episode matching its date of service — never to whatever the client is enrolled in today.">
        <div className="body">
          <div className="fields">
            <Field label="First name">
              <input value={f.first_name} onChange={e => set('first_name', e.target.value)} required />
            </Field>
            <Field label="Last name">
              <input value={f.last_name} onChange={e => set('last_name', e.target.value)} required />
            </Field>
            <Field label="Preferred name">
              <input value={f.preferred_name} onChange={e => set('preferred_name', e.target.value)} />
            </Field>
            <Field label="MRN">
              <input value={f.mrn} onChange={e => set('mrn', e.target.value)} required />
            </Field>
            <Field label="Date of birth">
              <input type="date" value={f.dob} onChange={e => set('dob', e.target.value)} />
            </Field>
            <Field label="Medicaid ID">
              <input value={f.medicaid_id} onChange={e => set('medicaid_id', e.target.value)} />
            </Field>
            <Field label="Payer">
              <select value={f.payer} onChange={e => set('payer', e.target.value)}>
                <option value="">—</option>
                {payers.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Phone">
              <input value={f.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" value={f.email} onChange={e => set('email', e.target.value)} />
            </Field>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
                          color: 'var(--ink-faint)', fontWeight: 700, marginBottom: 6 }}>
              Flags — shown on the census card and the chart header
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {flagList.map(fl => (
                <label key={fl.id} className="chk">
                  <input type="checkbox" checked={flags.includes(fl.code)}
                         onChange={e => setFlags(s2 => e.target.checked
                           ? [...s2, fl.code] : s2.filter(x => x !== fl.code))} />
                  {fl.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Admission"
            aside={<label className="chk" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
              <input type="checkbox" checked={admit} onChange={e => setAdmit(e.target.checked)} />
              Open an episode now
            </label>}>
        {admit ? (
          <div className="body">
            <div className="fields">
              <Field label="Level of care">
                <select value={ep.level_of_care} onChange={e => setEp(s => ({ ...s, level_of_care: e.target.value }))} required>
                  {locs.map(l => <option key={l.id} value={l.code}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Admit date">
                <input type="date" value={ep.admit_date}
                       onChange={e => setEp(s => ({ ...s, admit_date: e.target.value }))} required />
              </Field>
              <Field label="Facility">
                <select value={ep.facility_id} onChange={e => setEp(s => ({ ...s, facility_id: e.target.value }))}>
                  <option value="">—</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
              <Field label="Primary counselor">
                <select value={ep.primary_counselor}
                        onChange={e => setEp(s => ({ ...s, primary_counselor: e.target.value }))}>
                  <option value="">—</option>
                  {staff.map(x => <option key={x.id} value={x.id}>
                    {x.full_name}{x.credential ? `, ${x.credential}` : ''}
                  </option>)}
                </select>
              </Field>
            </div>
          </div>
        ) : (
          <div className="body">
            <p className="sub" style={{ margin: 0 }}>
              The client will exist but will not appear on census. You can admit them later.
            </p>
          </div>
        )}
      </Card>

      <div className="actions">
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save client'}</button>
        <button type="button" className="btn" onClick={() => nav('/census')}>Cancel</button>
      </div>
    </form>
  )
}
