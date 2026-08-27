import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../lib/session'

/** Screens running on your live database. */
const LIVE = [
  { to: '/census', label: 'Census' },
  { to: '/clients/new', label: 'Add client' },
]

/**
 * The Phase 0 prototypes, served from public/prototypes. Census (above) already
 * lands here, so it isn't repeated. These are quick jumps to the other three
 * screens for the one real client on this tenant — not a separate demo track.
 */
const PROTO = [
  { file: 'group-note.html',    label: 'Group note' },
  { file: 'progress-note.html', label: 'Progress note' },
  { file: 'client-chart.html',  label: 'Client chart' },
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
              {p.label}
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
