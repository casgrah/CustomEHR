import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Avatar, Card, Empty, LocTag, Msg, Tag, fmtDate, daysBetween } from '../components/ui'
import type { Client, Episode, ValueListItem } from '../types'

type Row = Client & { episode: Episode | null }

export default function Census() {
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [locs, setLocs] = useState<ValueListItem[]>([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setErr('')
    const { data: list } = await supabase.from('value_lists').select('id').eq('key', 'loc').maybeSingle()
    if (list) {
      const { data: items } = await supabase.from('value_list_items')
        .select('*').eq('list_id', list.id).order('sort_order')
      setLocs((items as ValueListItem[]) ?? [])
    }
    const { data, error } = await supabase
      .from('clients')
      .select('*, episodes(*)')
      .eq('is_active', true)
      .order('last_name')
    if (error) { setErr(error.message); setRows([]); return }
    const mapped: Row[] = (data ?? []).map((c: any) => {
      const open = (c.episodes ?? []).find((e: Episode) => !e.discharge_date) ?? null
      const { episodes, ...rest } = c
      return { ...(rest as Client), episode: open }
    })
    setRows(mapped)
  }

  const locLabel = (code: string) => locs.find(l => l.code === code)?.label ?? code
  const filtered = (rows ?? []).filter(r => {
    if (!q) return true
    const s = `${r.last_name} ${r.first_name} ${r.mrn}`.toLowerCase()
    return s.includes(q.toLowerCase())
  })

  const admitted = filtered.filter(r => r.episode)
  const notAdmitted = filtered.filter(r => !r.episode)

  if (rows === null) return <div className="sub">Loading…</div>

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}

      {rows.length === 0 ? (
        <Card title="Census">
          <Empty title="No clients yet">
            <p style={{ maxWidth: 460, margin: '0 auto 16px' }}>
              This is a real, empty database — not a prototype full of made-up people.
              Add one and it will be here when you come back.
            </p>
            <Link className="btn primary" to="/clients/new">Add the first client</Link>
          </Empty>
        </Card>
      ) : (
        <Card
          title="Census"
          aside={
            <>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or MRN"
                     style={{ width: 200, fontSize: 12.5, padding: '5px 9px' }} />
              <Link className="btn small" to="/clients/new">+ Add client</Link>
            </>
          }
          note="Only clients with an open episode are on census. Adding a client does not admit them — that is the episode, and it is what every service event routes to by date of service."
        >
          <div className="body" style={{ padding: '9px 16px', borderBottom: '1px solid var(--line)' }}>
            <span className="sub">
              <b className="mono">{admitted.length}</b> on census
              {notAdmitted.length > 0 && <> · <b className="mono">{notAdmitted.length}</b> not admitted</>}
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Client</th><th>MRN</th><th>DOB</th><th>Level of care</th>
                  <th>Payer</th><th>Admitted</th><th>LOS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="click" onClick={() => nav(`/clients/${r.id}`)}>
                    <td>
                      <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                        <Avatar first={r.first_name} last={r.last_name} id={r.id} />
                        <span className="nm">{r.last_name}, {r.first_name}</span>
                      </div>
                    </td>
                    <td className="mono sub">{r.mrn}</td>
                    <td className="mono sub">{fmtDate(r.dob)}</td>
                    <td>{r.episode
                      ? <LocTag code={r.episode.level_of_care} label={locLabel(r.episode.level_of_care)} />
                      : <Tag tone="mute">Not admitted</Tag>}</td>
                    <td className="sub">{r.payer || '—'}</td>
                    <td className="mono sub">{r.episode ? fmtDate(r.episode.admit_date) : '—'}</td>
                    <td className="mono">{r.episode
                      ? daysBetween(r.episode.admit_date, new Date().toISOString().slice(0, 10))
                      : '—'}</td>
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
