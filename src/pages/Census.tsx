import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { flagMeta } from '../lib/flags'
import { Avatar, Card, Empty, Msg, Tag, fmtDate, daysBetween } from '../components/ui'
import { LOC_COLOR, type Client, type Episode, type Profile, type ValueListItem } from '../types'

type Row = Client & { episode: Episode | null }

const COLS = [
  { k: 'mrn',      l: 'MRN',           on: true },
  { k: 'dob',      l: 'DOB',           on: true },
  { k: 'loc',      l: 'Level of care', on: true },
  { k: 'couns',    l: 'Counselor',     on: true },
  { k: 'payer',    l: 'Insurance',     on: true },
  { k: 'admit',    l: 'Admitted',      on: true },
  { k: 'los',      l: 'LOS',           on: true },
  { k: 'flags',    l: 'Flags',         on: false },
]

export default function Census() {
  const nav = useNavigate()
  const { profile } = useSession()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [locs, setLocs] = useState<ValueListItem[]>([])
  const [flagList, setFlagList] = useState<ValueListItem[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('all')
  const [layout, setLayout] = useState<'cards' | 'table'>('cards')
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [cols, setCols] = useState(COLS)
  const [colsOpen, setColsOpen] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setErr('')
    const { data: lists } = await supabase.from('value_lists').select('id, key')
    const byKey = Object.fromEntries((lists ?? []).map((l: any) => [l.key, l.id]))
    if (byKey.loc) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.loc).order('sort_order')
      setLocs((data as ValueListItem[]) ?? [])
    }
    if (byKey.flags) {
      const { data } = await supabase.from('value_list_items').select('*')
        .eq('list_id', byKey.flags).order('sort_order')
      setFlagList((data as ValueListItem[]) ?? [])
    }
    const { data: st } = await supabase.from('profiles').select('*')
    setStaff((st as Profile[]) ?? [])

    const { data, error } = await supabase.from('clients')
      .select('*, episodes(*)').eq('is_active', true).order('last_name')
    if (error) { setErr(error.message); setRows([]); return }
    setRows((data ?? []).map((c: any) => {
      const open = (c.episodes ?? []).find((e: Episode) => !e.discharge_date) ?? null
      const { episodes, ...rest } = c
      return { ...(rest as Client), episode: open }
    }))
  }

  const locLabel = (c: string) => locs.find(l => l.code === c)?.label ?? c
  const flagLabel = (c: string) => flagList.find(f => f.code === c)?.label
  const staffName = (id: string | null) => {
    const p = staff.find(s => s.id === id)
    return p ? p.full_name : '—'
  }
  const today = new Date().toISOString().slice(0, 10)
  const on = (k: string) => cols.find(c => c.k === k)?.on

  const all = rows ?? []
  const admitted = all.filter(r => r.episode)
  const filtered = admitted.filter(r => {
    if (loc !== 'all' && r.episode!.level_of_care !== loc) return false
    if (scope === 'mine' && r.episode!.primary_counselor !== profile!.id) return false
    if (q && !`${r.last_name} ${r.first_name} ${r.mrn}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  const notAdmitted = all.filter(r => !r.episode)
  const countBy = (code: string) => admitted.filter(r => r.episode!.level_of_care === code).length

  if (rows === null) return <div className="sub">Loading…</div>

  if (all.length === 0) return (
    <Card title="Census">
      <Empty title="No clients yet">
        <p style={{ maxWidth: 460, margin: '0 auto 16px' }}>
          A real, empty database. Add one and it will be here tomorrow.
        </p>
        <Link className="btn primary" to="/clients/new">Add the first client</Link>
      </Empty>
    </Card>
  )

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}

      <div className="kpis">
        <div className="kpi"><div className="l">On census</div>
          <div className="v">{admitted.length}</div>
          <div className="d">open episodes</div></div>
        {locs.filter(l => countBy(l.code) > 0).map(l => (
          <div className="kpi" key={l.id}><div className="l">{l.label}</div>
            <div className="v">{countBy(l.code)}</div>
            <div className="d">clients</div></div>
        ))}
        {notAdmitted.length > 0 && (
          <div className="kpi"><div className="l">Not admitted</div>
            <div className="v">{notAdmitted.length}</div>
            <div className="d">no open episode</div></div>
        )}
      </div>

      <div className="tools">
        <div className="locbar">
          <button className="locbtn" aria-pressed={loc === 'all'} onClick={() => setLoc('all')}>
            All levels
          </button>
          {locs.map(l => (
            <button key={l.id} className="locbtn" aria-pressed={loc === l.code}
                    onClick={() => setLoc(l.code)}>
              <i style={{ background: LOC_COLOR[l.code] ?? 'var(--ink-faint)' }} />{l.label}
              <span className="mono" style={{ opacity: .7 }}>{countBy(l.code)}</span>
            </button>
          ))}
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or MRN"
               style={{ width: 190, marginLeft: 'auto' }} />

        <div className="seg" style={{ width: 'auto' }}>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Everyone</button>
          <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>My caseload</button>
        </div>
        <div className="seg" style={{ width: 'auto' }}>
          <button aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}>Cards</button>
          <button aria-pressed={layout === 'table'} onClick={() => setLayout('table')}>Table</button>
        </div>
        {layout === 'table' && (
          <div style={{ position: 'relative' }}>
            <button className="btn small" onClick={() => setColsOpen(o => !o)}>Columns ▾</button>
            {colsOpen && (
              <div style={{ position: 'absolute', right: 0, top: 30, zIndex: 5, background: 'var(--surface)',
                            border: '1px solid var(--line-strong)', borderRadius: 5, padding: 10,
                            boxShadow: 'var(--shadow)', minWidth: 170 }}>
                {cols.map((c, i) => (
                  <label key={c.k} className="chk" style={{ display: 'flex', padding: '3px 0' }}>
                    <input type="checkbox" checked={c.on} onChange={e => {
                      const next = cols.slice(); next[i] = { ...c, on: e.target.checked }; setCols(next)
                    }} />{c.l}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <Link className="btn small primary" to="/clients/new">+ Add client</Link>
      </div>

      <div className="count">
        <b>{filtered.length}</b> {scope === 'mine' ? 'on your caseload' : 'active clients'}
        {loc !== 'all' && <> · {locLabel(loc)}</>}
        {q && <> · matching “{q}”</>}
      </div>

      {filtered.length === 0 ? (
        <Card><Empty title="Nothing matches">Clear the filters to see everyone.</Empty></Card>
      ) : layout === 'cards' ? (
        <div className="grid">
          {filtered.map(r => {
            const e = r.episode!
            return (
              <div className="fc" key={r.id} onClick={() => nav(`/clients/${r.id}`)}>
                <div className="stripe" style={{ background: LOC_COLOR[e.level_of_care] ?? 'var(--ink-faint)' }} />
                <div className="in">
                  <div className="r1">
                    <Avatar first={r.first_name} last={r.last_name} id={r.id} />
                    <span className="fcnm">{r.last_name}, {r.first_name}</span>
                  </div>
                  <div className="flags">
                    <span className="locchip" style={{ background: LOC_COLOR[e.level_of_care] }}>
                      {locLabel(e.level_of_care)}
                    </span>
                    {(r.flags ?? []).map(f => {
                      const m = flagMeta(f, flagLabel(f))
                      return <span key={f} className={`flag ${m.tone}`} title={m.full}>{m.short}</span>
                    })}
                  </div>
                  <div className="meta">
                    <div className="row"><span className="t mono">{r.mrn}</span>
                      <span>{fmtDate(r.dob)}</span></div>
                    <div className="row"><span className="t">{staffName(e.primary_counselor)}</span>
                      <span>day {daysBetween(e.admit_date, today)}</span></div>
                    <div className="row"><span className="t">{r.payer || '—'}</span>
                      <span>{fmtDate(e.admit_date)}</span></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead><tr>
              <th>Client</th>
              {on('mrn') && <th>MRN</th>}
              {on('dob') && <th>DOB</th>}
              {on('loc') && <th>Level of care</th>}
              {on('couns') && <th>Counselor</th>}
              {on('payer') && <th>Insurance</th>}
              {on('admit') && <th>Admitted</th>}
              {on('los') && <th>LOS</th>}
              {on('flags') && <th>Flags</th>}
            </tr></thead>
            <tbody>
              {filtered.map(r => {
                const e = r.episode!
                return (
                  <tr key={r.id} className="click" onClick={() => nav(`/clients/${r.id}`)}>
                    <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Avatar first={r.first_name} last={r.last_name} id={r.id} size={24} />
                      <span className="nm">{r.last_name}, {r.first_name}</span></div></td>
                    {on('mrn') && <td className="mono sub">{r.mrn}</td>}
                    {on('dob') && <td className="mono sub">{fmtDate(r.dob)}</td>}
                    {on('loc') && <td><span className="locchip"
                      style={{ background: LOC_COLOR[e.level_of_care] }}>{locLabel(e.level_of_care)}</span></td>}
                    {on('couns') && <td className="sub">{staffName(e.primary_counselor)}</td>}
                    {on('payer') && <td className="sub">{r.payer || '—'}</td>}
                    {on('admit') && <td className="mono sub">{fmtDate(e.admit_date)}</td>}
                    {on('los') && <td className="mono">{daysBetween(e.admit_date, today)}</td>}
                    {on('flags') && <td><div className="flags" style={{ marginBottom: 0 }}>
                      {(r.flags ?? []).map(f => {
                        const m = flagMeta(f, flagLabel(f))
                        return <span key={f} className={`flag ${m.tone}`} title={m.full}>{m.short}</span>
                      })}</div></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {notAdmitted.length > 0 && (
        <Card title="Not admitted" aside={<span className="n">{notAdmitted.length}</span>}
              note="Clients with no open episode. They are not on census and no service routes to them.">
          <div className="tw"><table><tbody>
            {notAdmitted.map(r => (
              <tr key={r.id} className="click" onClick={() => nav(`/clients/${r.id}`)}>
                <td className="nm">{r.last_name}, {r.first_name}</td>
                <td className="mono sub">{r.mrn}</td>
                <td><Tag tone="mute">No episode</Tag></td>
              </tr>
            ))}
          </tbody></table></div>
        </Card>
      )}
    </>
  )
}
