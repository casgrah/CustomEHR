import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Card, Msg, Tag, fmtDate } from '../components/ui'
import type { FormTemplate } from '../types'

/**
 * Forms are tenant-defined, not built into the product. Creating one writes a
 * row (form_templates) — nothing here ever runs a database migration. See
 * supabase/migrations/0003_forms.sql.
 */
export default function Forms() {
  const nav = useNavigate()
  const { profile } = useSession()
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data, error } = await supabase.from('form_templates').select('*').order('updated_at', { ascending: false })
    if (error) setErr(error.message)
    setForms((data as FormTemplate[]) ?? [])
  }

  async function create() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('form_templates').insert({
      tenant_id: profile!.tenant_id,
      name: 'Untitled form',
      schema: [{ id: crypto.randomUUID(), type: 'header', text: 'Untitled form', size: 'xl' }],
      created_by: profile!.id,
    }).select().single()
    setBusy(false)
    if (error) { setErr(error.message); return }
    nav(`/forms/${data.id}`)
  }

  async function setActive(f: FormTemplate, is_active: boolean) {
    const { error } = await supabase.from('form_templates').update({ is_active }).eq('id', f.id)
    if (error) setErr(error.message); else void load()
  }

  const live = forms.filter(f => f.is_active)
  const retired = forms.filter(f => !f.is_active)

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}

      <Card title="Forms"
            aside={<button className="btn primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : '+ New form'}</button>}
            note="Build a form here, then use it wherever it belongs — attached to a chart, a group note, or standalone. A blank form is always a click away; nothing about it is pre-built into the product.">
        {live.length === 0 ? (
          <div className="body"><p className="sub" style={{ margin: 0 }}>
            No forms yet. Start with "+ New form" — you get a blank page and can add headers, text, fill-in
            fields, checkboxes, sections, dividers, and images, in any order.
          </p></div>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Name</th><th>Blocks</th><th>Shows up in</th><th>Last updated</th><th /></tr></thead>
              <tbody>
                {live.map(f => (
                  <tr key={f.id}>
                    <td className="nm" style={{ cursor: 'pointer' }} onClick={() => nav(`/forms/${f.id}`)}>{f.name}</td>
                    <td className="sub mono">{f.schema.length}</td>
                    <td className="sub">
                      {(f.placements ?? []).length === 0
                        ? <Tag tone="mute">nowhere yet</Tag>
                        : (f.placements ?? []).map(p => (
                            <span key={`${p.g}-${p.item}`} style={{ marginRight: 4, display: 'inline-block' }}>
                              <Tag tone="info">{p.item}</Tag>
                            </span>
                          ))}
                    </td>
                    <td className="sub mono">{fmtDate(f.updated_at.slice(0, 10))}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn small" onClick={() => nav(`/forms/${f.id}`)}>Edit</button>
                      <button className="btn small" onClick={() => setActive(f, false)}>Retire</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {retired.length > 0 && (
        <Card title="Retired" aside={<span className="n">{retired.length}</span>}>
          <div className="tw">
            <table>
              <thead><tr><th>Name</th><th /></tr></thead>
              <tbody>
                {retired.map(f => (
                  <tr key={f.id} style={{ opacity: .6 }}>
                    <td className="nm">{f.name} <Tag tone="mute">Retired</Tag></td>
                    <td><button className="btn small" onClick={() => setActive(f, true)}>Reinstate</button></td>
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
