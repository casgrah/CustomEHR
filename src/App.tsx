import { Route, Routes } from 'react-router-dom'
import { useSession } from './lib/session'
import Shell from './components/Shell'
import Auth from './pages/Auth'
import ClientNew from './pages/ClientNew'
import ClientChart from './pages/ClientChart'
import Users from './pages/Users'
import Configure from './pages/Configure'

/**
 * Landing after sign-in. The prototype census page (public/prototypes/census.html)
 * is the one built out to look like the actual product — the real Census.tsx
 * component is still here (see git history) but is deliberately not the default
 * landing until it's built out to match. This leaves the SPA entirely: it's a
 * real navigation, not a client-side route.
 */
function GoToCensusPrototype() {
  window.location.replace(import.meta.env.BASE_URL + 'prototypes/census.html')
  return <div className="authwrap"><div className="sub">Loading…</div></div>
}

export default function App() {
  const { session, profile, loading } = useSession()

  if (loading) return <div className="authwrap"><div className="sub">Loading…</div></div>
  if (!session) return <Auth />
  if (!profile) return (
    <div className="authwrap"><div className="authbox">
      <div className="msg err">
        Your sign-in worked but no profile was created. That means the database migration
        has not been run, or the signup trigger failed. Check <code>0001_init.sql</code>.
      </div>
    </div></div>
  )

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/census" element={<GoToCensusPrototype />} />
        <Route path="/clients/new" element={<ClientNew />} />
        <Route path="/clients/:id" element={<ClientChart />} />
        <Route path="/users" element={<Users />} />
        <Route path="/configure" element={<Configure />} />
        <Route path="*" element={<GoToCensusPrototype />} />
      </Route>
    </Routes>
  )
}
