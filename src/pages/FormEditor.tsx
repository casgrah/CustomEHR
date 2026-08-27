import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Msg } from '../components/ui'
import { CHART_SECTIONS, type Placement } from '../chartSections'
import type { FormBlock, FormTemplate, TextSize } from '../types'

const SIZES: { v: TextSize; l: string }[] = [
  { v: 'sm', l: 'Small' }, { v: 'md', l: 'Normal' }, { v: 'lg', l: 'Large' }, { v: 'xl', l: 'Heading' },
]

const BLOCK_KINDS: { t: FormBlock['type']; l: string; make: () => FormBlock }[] = [
  { t: 'header', l: 'Header', make: () => ({ id: uid(), type: 'header', text: 'Section title', size: 'lg' }) },
  { t: 'text', l: 'Text', make: () => ({ id: uid(), type: 'text', text: 'Add your text…', size: 'md' }) },
  { t: 'field', l: 'Fill-in field', make: () => ({ id: uid(), type: 'field', label: 'Label', placeholder: '', fieldType: 'text' }) },
  { t: 'checkbox', l: 'Checkbox', make: () => ({ id: uid(), type: 'checkbox', label: 'Checkbox label' }) },
  { t: 'section', l: 'Section (collapsible)', make: () => ({ id: uid(), type: 'section', title: 'New section', collapsible: true, defaultOpen: true }) },
  { t: 'image', l: 'Image', make: () => ({ id: uid(), type: 'image', url: '', alt: '', width: 'md' }) },
  { t: 'divider', l: 'Divider', make: () => ({ id: uid(), type: 'divider' }) },
]

function uid() { return crypto.randomUUID() }

export default function FormEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile } = useSession()
  const [form, setForm] = useState<FormTemplate | null>(null)
  const [blocks, setBlocks] = useState<FormBlock[]>([])
  const [name, setName] = useState('')
  const [placements, setPlacements] = useState<Placement[]>([])
  const [placeOpen, setPlaceOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [addAt, setAddAt] = useState<number | null>(null)

  useEffect(() => { void load() }, [id])

  async function load() {
    const { data, error } = await supabase.from('form_templates').select('*').eq('id', id).single()
    if (error) { setErr(error.message); return }
    const f = data as FormTemplate
    setForm(f); setName(f.name); setBlocks(f.schema); setPlacements(f.placements ?? []); setDirty(false)
  }

  function togglePlacement(g: string, item: string) {
    setPlacements(p => p.some(x => x.g === g && x.item === item)
      ? p.filter(x => !(x.g === g && x.item === item))
      : [...p, { g, item }])
    setDirty(true)
  }

  function update(updater: (b: FormBlock[]) => FormBlock[]) {
    setBlocks(b => updater(b)); setDirty(true)
  }

  function patch(i: number, patch: Partial<FormBlock>) {
    update(b => b.map((x, j) => j === i ? { ...x, ...patch } as FormBlock : x))
  }

  function move(i: number, dir: -1 | 1) {
    update(b => {
      const j = i + dir
      if (j < 0 || j >= b.length) return b
      const copy = b.slice()
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function remove(i: number) {
    update(b => b.filter((_, j) => j !== i))
  }

  function duplicate(i: number) {
    update(b => {
      const copy = b.slice()
      copy.splice(i + 1, 0, { ...copy[i], id: uid() })
      return copy
    })
  }

  function insert(kind: typeof BLOCK_KINDS[number], at: number) {
    update(b => {
      const copy = b.slice()
      copy.splice(at, 0, kind.make())
      return copy
    })
    setAddAt(null)
  }

  async function save() {
    setBusy(true); setErr(''); setOk('')
    const { error } = await supabase.from('form_templates')
      .update({ name: name.trim() || 'Untitled form', schema: blocks, placements })
      .eq('id', id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setDirty(false); setOk('Saved.')
    setTimeout(() => setOk(''), 2000)
  }

  async function uploadImage(i: number, file: File) {
    setErr('')
    const path = `${profile!.tenant_id}/${uid()}-${file.name}`
    const { error } = await supabase.storage.from('form-assets').upload(path, file)
    if (error) { setErr(error.message); return }
    const { data } = supabase.storage.from('form-assets').getPublicUrl(path)
    patch(i, { url: data.publicUrl } as Partial<FormBlock>)
  }

  if (!form) return err ? <Msg kind="err">{err}</Msg> : null

  return (
    <>
      {err && <Msg kind="err">{err}</Msg>}
      {ok && <Msg kind="ok">{ok}</Msg>}

      <div className="formedit-bar">
        <button className="btn small" onClick={() => nav('/forms')}>&larr; Forms</button>
        <input className="formedit-name" value={name}
               onChange={e => { setName(e.target.value); setDirty(true) }} placeholder="Form name" />
        <div className="seg2">
          <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')} type="button">Edit</button>
          <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')} type="button">Preview</button>
        </div>
        <button type="button" className="btn small" onClick={() => setPlaceOpen(o => !o)}>
          Where it shows up{placements.length > 0 ? ` (${placements.length})` : ''}
        </button>
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>
          {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {placeOpen && (
        <div className="formedit-canvas">
          <div className="fb" style={{ marginBottom: 14 }}>
            <div className="fb-tools"><span className="fb-kind">Where this form shows up in the chart</span></div>
            <div className="fb-body">
              <p className="sub" style={{ margin: '0 0 4px' }}>
                Check every group and section this form should appear under. None checked means it's saved but not
                placed anywhere yet — still reachable from Forms.
              </p>
              <div className="fields" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                {CHART_SECTIONS.map(s => (
                  <div key={s.g}>
                    <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
                                  color: 'var(--ink-faint)', fontWeight: 700, marginBottom: 5 }}>{s.g}</div>
                    {s.items.map(item => (
                      <label key={item} className="chk" style={{ display: 'flex', padding: '2px 0' }}>
                        <input type="checkbox"
                               checked={placements.some(p => p.g === s.g && p.item === item)}
                               onChange={() => togglePlacement(s.g, item)} />
                        {item}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="formedit-canvas">
        {mode === 'edit'
          ? <EditView blocks={blocks} onPatch={patch} onMove={move} onRemove={remove} onDuplicate={duplicate}
                      addAt={addAt} setAddAt={setAddAt} onInsert={insert} onUpload={uploadImage} />
          : <PreviewView blocks={blocks} />}
      </div>
    </>
  )
}

function AddMenu({ at, onInsert }: { at: number; onInsert: (k: typeof BLOCK_KINDS[number], at: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="addblock">
      <button type="button" className="addblock-btn" onClick={() => setOpen(o => !o)}>+ Add block</button>
      {open && (
        <div className="addblock-menu">
          {BLOCK_KINDS.map(k => (
            <button key={k.t} type="button" onClick={() => { onInsert(k, at); setOpen(false) }}>{k.l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditView({ blocks, onPatch, onMove, onRemove, onDuplicate, onInsert, onUpload }: {
  blocks: FormBlock[]
  onPatch: (i: number, p: Partial<FormBlock>) => void
  onMove: (i: number, dir: -1 | 1) => void
  onRemove: (i: number) => void
  onDuplicate: (i: number) => void
  addAt: number | null
  setAddAt: (i: number | null) => void
  onInsert: (k: typeof BLOCK_KINDS[number], at: number) => void
  onUpload: (i: number, f: File) => void
}) {
  if (blocks.length === 0) {
    return <AddMenu at={0} onInsert={onInsert} />
  }
  return (
    <>
      <AddMenu at={0} onInsert={onInsert} />
      {blocks.map((b, i) => (
        <div key={b.id}>
          <div className="fb">
            <div className="fb-tools">
              <span className="fb-kind">{BLOCK_KINDS.find(k => k.t === b.type)?.l}</span>
              <span style={{ flex: 1 }} />
              <button type="button" title="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>↑</button>
              <button type="button" title="Move down" disabled={i === blocks.length - 1} onClick={() => onMove(i, 1)}>↓</button>
              <button type="button" title="Duplicate" onClick={() => onDuplicate(i)}>⧉</button>
              <button type="button" title="Delete" onClick={() => onRemove(i)}>✕</button>
            </div>
            <div className="fb-body">
              {(b.type === 'header' || b.type === 'text') && (
                <>
                  {b.type === 'header'
                    ? <input value={b.text} placeholder="Header text"
                             onChange={e => onPatch(i, { text: e.target.value } as Partial<FormBlock>)} />
                    : <textarea rows={2} value={b.text} placeholder="Text"
                                onChange={e => onPatch(i, { text: e.target.value } as Partial<FormBlock>)} />}
                  <label className="fb-inline">Size
                    <select value={b.size} onChange={e => onPatch(i, { size: e.target.value as TextSize } as Partial<FormBlock>)}>
                      {SIZES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                  </label>
                </>
              )}
              {b.type === 'field' && (
                <div className="fb-row">
                  <input value={b.label} placeholder="Field label"
                         onChange={e => onPatch(i, { label: e.target.value } as Partial<FormBlock>)} />
                  <input value={b.placeholder} placeholder="Placeholder text (optional)"
                         onChange={e => onPatch(i, { placeholder: e.target.value } as Partial<FormBlock>)} />
                  <select value={b.fieldType}
                          onChange={e => onPatch(i, { fieldType: e.target.value as any } as Partial<FormBlock>)}>
                    <option value="text">Short text</option>
                    <option value="textarea">Long text</option>
                    <option value="date">Date</option>
                  </select>
                </div>
              )}
              {b.type === 'checkbox' && (
                <input value={b.label} placeholder="Checkbox label"
                       onChange={e => onPatch(i, { label: e.target.value } as Partial<FormBlock>)} />
              )}
              {b.type === 'section' && (
                <div className="fb-row">
                  <input value={b.title} placeholder="Section title"
                         onChange={e => onPatch(i, { title: e.target.value } as Partial<FormBlock>)} />
                  <label className="chk">
                    <input type="checkbox" checked={b.collapsible}
                           onChange={e => onPatch(i, { collapsible: e.target.checked } as Partial<FormBlock>)} />
                    Collapsible
                  </label>
                  {b.collapsible && (
                    <label className="chk">
                      <input type="checkbox" checked={b.defaultOpen}
                             onChange={e => onPatch(i, { defaultOpen: e.target.checked } as Partial<FormBlock>)} />
                      Open by default
                    </label>
                  )}
                </div>
              )}
              {b.type === 'image' && (
                <div className="fb-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="file" accept="image/*"
                           onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(i, f) }} />
                    <input value={b.alt} placeholder="Alt text (for accessibility)"
                           onChange={e => onPatch(i, { alt: e.target.value } as Partial<FormBlock>)} />
                    <label className="fb-inline">Width
                      <select value={b.width}
                              onChange={e => onPatch(i, { width: e.target.value as any } as Partial<FormBlock>)}>
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                        <option value="full">Full width</option>
                      </select>
                    </label>
                  </div>
                  {b.url && <img src={b.url} alt={b.alt} className="fb-thumb" />}
                </div>
              )}
              {b.type === 'divider' && <p className="sub" style={{ margin: 0 }}>A plain horizontal rule — nothing to configure.</p>}
            </div>
          </div>
          <AddMenu at={i + 1} onInsert={onInsert} />
        </div>
      ))}
    </>
  )
}

function sizeClass(size: TextSize, kind: 'header' | 'text') {
  return `fp-${kind}-${size}`
}

function PreviewView({ blocks }: { blocks: FormBlock[] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {}
    blocks.forEach(b => { if (b.type === 'section') s[b.id] = b.defaultOpen })
    return s
  })

  // Group blocks under their nearest preceding section, so a "collapsible
  // section" is just a section block plus whatever follows it — no nested
  // tree to build or drag around.
  const groups: { section: (FormBlock & { type: 'section' }) | null; items: FormBlock[] }[] = []
  let cur: { section: (FormBlock & { type: 'section' }) | null; items: FormBlock[] } = { section: null, items: [] }
  for (const b of blocks) {
    if (b.type === 'section') {
      if (cur.section || cur.items.length) groups.push(cur)
      cur = { section: b, items: [] }
    } else {
      cur.items.push(b)
    }
  }
  groups.push(cur)

  function renderBlock(b: FormBlock, key: string) {
    switch (b.type) {
      case 'header': return <div key={key} className={sizeClass(b.size, 'header')}>{b.text}</div>
      case 'text': return <p key={key} className={sizeClass(b.size, 'text')}>{b.text}</p>
      case 'field': return (
        <label key={key} className="fp-field">
          <span>{b.label}</span>
          {b.fieldType === 'textarea' ? <textarea rows={3} placeholder={b.placeholder} disabled />
            : <input type={b.fieldType === 'date' ? 'date' : 'text'} placeholder={b.placeholder} disabled />}
        </label>
      )
      case 'checkbox': return <label key={key} className="chk" style={{ display: 'flex' }}><input type="checkbox" disabled />{b.label}</label>
      case 'image': return b.url
        ? <img key={key} src={b.url} alt={b.alt} className={`fp-img fp-img-${b.width}`} />
        : <p key={key} className="sub">(no image uploaded)</p>
      case 'divider': return <hr key={key} className="fp-divider" />
      default: return null
    }
  }

  return (
    <div className="fp">
      {groups.map((g, gi) => g.section ? (
        <details key={g.section.id} open={openSections[g.section.id] ?? true} className="fp-section"
                 onToggle={e => setOpenSections(s => ({ ...s, [g.section!.id]: (e.target as HTMLDetailsElement).open }))}>
          <summary className={g.section.collapsible ? '' : 'fp-nocollapse'}>
            {g.section.title}
          </summary>
          <div className="fp-section-body">
            {g.items.map((b, i) => renderBlock(b, `${gi}-${i}`))}
          </div>
        </details>
      ) : (
        <div key={`root-${gi}`}>{g.items.map((b, i) => renderBlock(b, `${gi}-${i}`))}</div>
      ))}
      {blocks.length === 0 && <p className="sub">Nothing here yet — switch to Edit and add a block.</p>}
    </div>
  )
}
