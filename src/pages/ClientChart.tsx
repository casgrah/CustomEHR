import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Avatar, Card, Empty, Field, LocTag, Msg, Tag, fmtDate, daysBetween } from '../components/ui'
import { CHART_SECTIONS } from '../chartSections'
import type { Client, Episode, Facility, FormTemplate, Profile, ValueListItem } from '../types'

/** The section list settled in the prototypes. Only Overview is built. */
const SECTIONS = CHART_SECTIONS

export default function ClientChart() {
  const { id } = useParams()
  const { profile, isAdmin } = useSession()
  const [client, setClient] = useState<Client | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [locs, setLocs] = useState<ValueListItem[]>([])
  const [reasons, setReasons] = useState<ValueListItem[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [newEp, setNewEp] = useState({
    level_of_care: '', admit_date: new Date().toISOString().slice(0, 10), facility_id: '',
  })

  useEffect(() => { void load() }, [id])

  async function load() {
    setErr('')
    const { data: c, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle()
    if (error) { setErr(error.message); return }
    setClient((c as Client) ?? null)

    const { data: eps } = await supabase.from('episodes').select('*')
      .eq('client_id', id).order('admit_date', { ascending: false })
    setEpisodes((eps as Episode[]) ?? [])

    const { data: lists } = await supabase.from('value_lists').select('id, key')
    const byKey = Object.fromEntries((lists ?? []).map((l: any) => [l.key, l.id]))
    if (byKey.loc) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.loc).eq('is_active', true).order('sort_order')
      setLocs((data as ValueListItem[]) ?? [])
      setNewEp(s => ({ ...s, level_of_care: s.level_of_care || (data as ValueListItem[])?.[0]?.code || '' }))
    }
    if (byKey.dc_reason) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.dc_reason).eq('is_active', true).order('sort_order')
      setReasons((data as ValueListItem[]) ?? [])
    }
    const { data: fac } = await supabase.from('facilities').select('*').eq('is_active', true)
    setFacilities((fac as Facility[]) ?? [])
    const { data: st } = await supabase.from('profiles').select('*')
    setStaff((st as Profile[]) ?? [])
    const { data: ft } = await supabase.from('form_templates').select('*').eq('is_active', true)
    setForms((ft as FormTemplate[]) ?? [])
  }

  function formsFor(g: string, item: string) {
    return forms.filter(f => (f.placements ?? []).some(p => p.g === g && p.item === item))
  }

  const locLabel = (code: string) => locs.find(l => l.code === code)?.label ?? code
  const staffName = (uid: string | null) => {
    const p = staff.find(s => s.id === uid)
    return p ? `${p.full_name}${p.credential ? `, ${p.credential}` : ''}` : '—'
  }
  const open = episodes.find(e => !e.discharge_date) ?? null
  const today = new Date().toISOString().slice(0, 10)

  async function discharge(epId: string, reason: string) {
    const { error } = await supabase.from('episodes')
      .update({ discharge_date: today, discharge_reason: reason }).eq('id', epId)
    if (error) setErr(error.message); else void load()
  }

  async function addEpisode(e: React.FormEvent) {
    e.preventDefault()
    // Half-open intervals: [admit, discharge). Overlap is a.start < b.end && b.start < a.end.
    const clash = episodes.some(x =>
      newEp.admit_date < (x.discharge_date ?? '9999-12-31') &&
      x.admit_date < '9999-12-31')
    if (open && clash) { setErr('This client already has an open episode. Discharge it first.'); return }
    const { error } = await supabase.from('episodes').insert({
      tenant_id: profile!.tenant_id, client_id: id,
      level_of_care: newEp.level_of_care, admit_date: newEp.admit_date,
      facility_id: newEp.facility_id || null,
    })
    if (error) setErr(error.message)
    else { setAdding(false); void load() }
  }

  if (!client) return <div className="sub">{err ? <Msg kind="err">{err}</Msg> : 'Loading…'}</div>

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}

      <Card>
        <div className="body" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar first={client.first_name} last={client.last_name} id={client.id} size={44} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>
              {client.last_name}, {client.first_name}
              {client.preferred_name && <span className="sub" style={{ marginLeft: 8 }}>
                “{client.preferred_name}”
              </span>}
            </div>
            <div className="sub">
              MRN <span className="mono">{client.mrn}</span> · DOB {fmtDate(client.dob)}
              {client.payer && <> · {client.payer}</>}
              {client.medicaid_id && <> · <span className="mono">{client.medicaid_id}</span></>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {open
              ? <><LocTag code={open.level_of_care} label={locLabel(open.level_of_care)} />
                  <span className="sub">day {daysBetween(open.admit_date, today)}</span></>
              : <Tag tone="mute">Not admitted</Tag>}
            <Link className="btn small" to="/census">← Census</Link>
          </div>
        </div>
      </Card>

      <Card title="Episodes"
            aside={!open && !adding
              ? <button className="btn small" onClick={() => setAdding(true)}>+ Admit</button>
              : undefined}
            note="Episodes are what service events route to, by date of service. An episode that has been discharged stays workable — documentation and corrections are still possible — until it is deliberately closed.">
        {adding && (
          <div className="body" style={{ borderBottom: '1px solid var(--line)' }}>
            <form onSubmit={addEpisode}>
              <div className="fields">
                <Field label="Level of care">
                  <select value={newEp.level_of_care}
                          onChange={e => setNewEp(s => ({ ...s, level_of_care: e.target.value }))}>
                    {locs.map(l => <option key={l.id} value={l.code}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="Admit date">
                  <input type="date" value={newEp.admit_date}
                         onChange={e => setNewEp(s => ({ ...s, admit_date: e.target.value }))} />
                </Field>
                <Field label="Facility">
                  <select value={newEp.facility_id}
                          onChange={e => setNewEp(s => ({ ...s, facility_id: e.target.value }))}>
                    <option value="">—</option>
                    {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="actions" style={{ marginTop: 13 }}>
                <button className="btn primary">Admit</button>
                <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
        {episodes.length === 0 && !adding ? (
          <Empty title="No episodes">This client has never been admitted.</Empty>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr><th>Level of care</th><th>Admitted</th><th>Discharged</th><th>Reason</th>
                    <th>Counselor</th><th>Days</th><th /></tr>
              </thead>
              <tbody>
                {episodes.map(e => (
                  <tr key={e.id}>
                    <td><LocTag code={e.level_of_care} label={locLabel(e.level_of_care)} /></td>
                    <td className="mono">{fmtDate(e.admit_date)}</td>
                    <td className="mono">{e.discharge_date ? fmtDate(e.discharge_date)
                      : <Tag tone="ok">Open</Tag>}</td>
                    <td className="sub">{e.discharge_reason ?? '—'}</td>
                    <td className="sub">{staffName(e.primary_counselor)}</td>
                    <td className="mono">{daysBetween(e.admit_date, e.discharge_date ?? today)}</td>
                    <td>
                      {!e.discharge_date && (
                        <select defaultValue="" style={{ fontSize: 11, padding: '3px 6px', width: 'auto' }}
                                onChange={ev => { if (ev.target.value) void discharge(e.id, ev.target.value) }}>
                          <option value="">Discharge…</option>
                          {reasons.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Chart sections"
            aside={<Link className="btn small" to="/forms">Forms</Link>}
            note="The section list is settled; most screens behind it aren't built yet. A form placed on a section (from Forms) shows up here now — that's real; the rest of each screen is still a slice to port from the prototypes.">
        <div className="body">
          <div className="fields" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
            {SECTIONS.map(s => (
              <div key={s.g}>
                <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
                              color: 'var(--ink-faint)', fontWeight: 700, marginBottom: 5 }}>{s.g}</div>
                {s.items.map(i => {
                  const placed = formsFor(s.g, i)
                  return (
                    <div key={i} className="sub" style={{ padding: '3px 0' }}>
                      {i}{' '}
                      {placed.length === 0
                        ? <Tag tone="mute">not built</Tag>
                        : placed.map(f => (
                            <Link key={f.id} to={`/forms/${f.id}`} className="tag info" style={{ marginRight: 4 }}>
                              {f.name}
                            </Link>
                          ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {isAdmin && (
        <Card title="Record">
          <div className="body">
            <span className="sub">
              Created {fmtDate(client.created_at.slice(0, 10))} · id <span className="mono">{client.id}</span>
            </span>
          </div>
        </Card>
      )}
    </>
  )
}
