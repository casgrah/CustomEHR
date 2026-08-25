import type { ReactNode } from 'react'
import { LOC_COLOR } from '../types'

export function Card({ title, aside, children, note }:
  { title?: string; aside?: ReactNode; children?: ReactNode; note?: ReactNode }) {
  return (
    <section className="card">
      {title && (
        <h2>
          <span>{title}</span>
          {aside && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>{aside}</span>}
        </h2>
      )}
      {children}
      {note && <div className="body"><p className="note">{note}</p></div>}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="f"><span>{label}</span>{children}</label>
}

export function Tag({ tone = 'mute', children }:
  { tone?: 'ok' | 'warn' | 'bad' | 'mute' | 'info'; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function LocTag({ code, label }: { code: string; label?: string }) {
  return <span className="loc" style={{ background: LOC_COLOR[code] ?? 'var(--ink-faint)' }}>
    {label ?? code}
  </span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>
}

export function Msg({ kind, children }: { kind: 'err' | 'ok'; children: ReactNode }) {
  return <div className={`msg ${kind}`}>{children}</div>
}

export function initials(first: string, last: string) {
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

/** Deterministic colour from a string, so an avatar keeps the same colour. */
export function hueOf(seed: string) {
  const HUES = ['#3D6E8C', '#7A5C86', '#2F6B5B', '#8A5B3A', '#4A5A8C', '#7C4B57', '#5B6E4A', '#6B4A6E']
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[n % HUES.length]
}

export function Avatar({ first, last, id, size = 32 }:
  { first: string; last: string; id: string; size?: number }) {
  const bg = hueOf(id)
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: 4, flex: '0 0 auto' }}
         role="img" aria-label={`${last}, ${first}`}>
      <rect width="32" height="32" fill={bg} />
      <circle cx="16" cy="12.4" r="5.4" fill="rgba(255,255,255,.9)" />
      <path d="M4 32c0-6.4 5.2-10 12-10s12 3.6 12 10z" fill="rgba(255,255,255,.9)" />
      <text x="16" y="19.5" textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif"
            fontSize="10.5" fontWeight="700" fill={bg}>{initials(first, last)}</text>
    </svg>
  )
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${m}/${day}/${y}`
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
