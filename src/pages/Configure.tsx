import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Card, Msg, Tag } from '../components/ui'
import type { ValueList, ValueListItem } from '../types'

export default function Configure() {
  const { profile, isAdmin } = useSession()
  const [lists, setLists] = useState<ValueList[]>([])
  const [items, setItems] = useState<Record<string, ValueListItem[]>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data: l, error } = await supabase.from('value_lists').select('*').order('name')
    if (error) { setErr(error.message); return }
    setLists((l as ValueList[]) ?? [])
    const { data: it } = await supabase.from('value_list_items').select('*').order('sort_order')
    const by: Record<string, ValueListItem[]> = {}
    for (const i of (it as ValueListItem[]) ?? []) (by[i.list_id] ??= []).push(i)
    setItems(by)
  }

  async function toggle(item: ValueListItem) {
    const { error } = await supabase.from('value_list_items')
      .update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) setErr(error.message); else void load()
  }

  async function add(list: ValueList) {
    const label = adding.trim()
    if (!label) { setAdding(''); return }
    const existing = items[list.id] ?? []
    const prefix = existing[0]?.code.split('-')[0] ?? list.key.slice(0, 2).toUpperCase()
    const code = /^\d/.test(existing[0]?.code ?? '')
      ? label.slice(0, 6)
      : `${prefix}-${String(existing.length + 1).padStart(2, '0')}`
    const { error } = await supabase.from('value_list_items').insert({
      tenant_id: profile!.tenant_id, list_id: list.id, code, label,
      sort_order: existing.length + 1,
    })
    if (error) setErr(error.message)
    setAdding(''); void load()
  }

  if (!isAdmin) return <Msg kind="err">Only an owner or administrator can change configuration.</Msg>

  const open = lists.find(l => l.id === openId) ?? null

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}

      {open ? (
        <Card
          title={open.name}
          aside={<>
            <Tag tone={open.owner === 'system' ? 'mute' : 'info'}>{open.owner}</Tag>
            <button className="btn small" onClick={() => { setOpenId(null); setAdding('') }}>
              ← all lists
            </button>
          </>}
          note="Values are retired, never deleted — records already pointing at one keep resolving, and it stops appearing in new pickers. Labels can be renamed without breaking anything, because references bind to the code, not the text."
        >
          <div className="body" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
            <span className="sub"><b>Used by:</b> {open.used_by.join(' · ') || '—'}</span>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Code</th><th>Label</th><th>Status</th><th /></tr></thead>
              <tbody>
                {(items[open.id] ?? []).map(i => (
                  <tr key={i.id} style={i.is_active ? undefined : { opacity: .55 }}>
                    <td className="mono sub">{i.code}</td>
                    <td className="nm">{i.label}</td>
                    <td>{i.is_active ? <Tag tone="ok">Active</Tag> : <Tag tone="mute">Retired</Tag>}</td>
                    <td>
                      {open.owner === 'system'
                        ? <span className="sub">managed centrally</span>
                        : <button className="btn small" onClick={() => toggle(i)}>
                            {i.is_active ? 'retire' : 'reinstate'}
                          </button>}
                    </td>
                  </tr>
                ))}
                {open.owner === 'tenant' && (
                  <tr>
                    <td />
                    <td colSpan={3}>
                      <input value={adding} onChange={e => setAdding(e.target.value)}
                             onKeyDown={e => { if (e.key === 'Enter') void add(open) }}
                             onBlur={() => void add(open)}
                             placeholder="New value — press Enter"
                             style={{ maxWidth: 320 }} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title="Value lists"
              note="Define a list once; every form, field, and rule that uses it updates together. System lists are managed centrally because rules compose against them.">
          <div className="tw">
            <table>
              <thead><tr><th>List</th><th>Owner</th><th>Scope</th><th>Values</th><th>Used by</th></tr></thead>
              <tbody>
                {lists.map(l => {
                  const all = items[l.id] ?? []
                  const act = all.filter(i => i.is_active).length
                  return (
                    <tr key={l.id} className="click" onClick={() => setOpenId(l.id)}>
                      <td className="nm">{l.name}</td>
                      <td><Tag tone={l.owner === 'system' ? 'mute' : 'info'}>{l.owner}</Tag></td>
                      <td className="sub">{l.scope}</td>
                      <td className="mono">{act}{act < all.length &&
                        <span className="sub"> +{all.length - act} retired</span>}</td>
                      <td className="sub">{l.used_by.join(' · ') || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
