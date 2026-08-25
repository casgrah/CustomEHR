import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../lib/session'

const TABS = [
  { to: '/census', label: 'Census' },
  { to: '/clients/new', label: 'Add client' },
  { to: '/users', label: 'Users', admin: true },
  { to: '/configure', label: 'Configure', admin: true },
]

export default function Shell() {
  const { profile, tenant, isAdmin, signOut } = useSession()
  return (
    <>
      <header className="topbar">
        <div className="row1">
          <div className="brand">
            {tenant?.name ?? 'EHR'}<span>Sandbox</span>
          </div>
          <div className="who">
            Signed in as <b>{profile?.full_name}</b>
            {profile?.credential ? `, ${profile.credential}` : ''}
            {' · '}
            <button className="btn small" style={{ marginLeft: 6 }} onClick={signOut}>Sign out</button>
          </div>
        </div>
        <nav className="nav">
          {TABS.filter(t => !t.admin || isAdmin).map(t => (
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
