import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../lib/session'

/** Screens running on your live database. */
const LIVE = [
  { to: '/census', label: 'Census' },
  { to: '/clients/new', label: 'Add client' },
]

/**
 * The Phase 0 prototypes, served from public/prototypes and linked here so the
 * whole thing reads as one site. These still run on generated demo data — they
 * are the design spec, not yet wired to Supabase.
 */
const PROTO = [
  { file: 'census.html',        label: 'Groups & Schedule' },
  { file: 'group-note.html',    label: 'Group note' },
  { file: 'progress-note.html', label: 'Progress note' },
  { file: 'client-chart.html',  label: 'Chart study' },
]

const ADMIN = [
  { to: '/users', label: 'Users' },
  { to: '/configure', label: 'Configure' },
]

export default function Shell() {
  const { profile, tenant, isAdmin, signOut } = useSession()
  const base = import.meta.env.BASE_URL
  return (
    <>
      <header className="topbar">
        <div className="row1">
          <div className="brand">{tenant?.name ?? 'EHR'}<span>Sandbox</span></div>
          <div className="who">
            Signed in as <b>{profile?.full_name}</b>
            {profile?.credential ? `, ${profile.credential}` : ''}
            <button className="btn small" style={{ marginLeft: 8 }} onClick={signOut}>Sign out</button>
          </div>
        </div>
        <nav className="nav">
          {LIVE.map(t => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => isActive ? 'on' : undefined}>
              {t.label}
            </NavLink>
          ))}
          <span className="navsep" />
          {PROTO.map(p => (
            <a key={p.file} href={`${base}prototypes/${p.file}`}>
              {p.label}<em>demo</em>
            </a>
          ))}
          <span className="navsep" />
          {isAdmin && ADMIN.map(t => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => isActive ? 'on' : undefined}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page"><Outlet /></main>
    </>
  )
}
