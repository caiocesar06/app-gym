import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import { cx } from './components/ui'
import { RestTimerProvider } from './components/RestTimer'
import { AuthProvider, useAuth } from './lib/auth'
import { db } from './lib/db'
import { useLinks, usePendingCount, useProfiles } from './lib/hooks'
import { useSyncState } from './lib/sync'
import Home from './pages/Home'
import Login from './pages/Login'
import Plans from './pages/Plans'
import PlanEditor from './pages/PlanEditor'
import Workout from './pages/Workout'
import History from './pages/History'
import SessionDetail from './pages/SessionDetail'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

export default function App() {
  return (
    <AuthProvider>
      <RestTimerProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </RestTimerProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') return <div className="grid min-h-dvh place-items-center text-zinc-500">Carregando…</div>
  if (status === 'out') return <Login />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/fichas" element={<Plans />} />
        <Route path="/fichas/:id" element={<PlanEditor />} />
        <Route path="/treino/:id" element={<Workout />} />
        <Route path="/historico" element={<History />} />
        <Route path="/historico/:id" element={<SessionDetail />} />
        <Route path="/progresso" element={<Progress />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}

const NAV = [
  { to: '/', label: 'Início', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/fichas', label: 'Fichas', icon: 'M9 4h6M8 4H6a1 1 0 00-1 1v15a1 1 0 001 1h12a1 1 0 001-1V5a1 1 0 00-1-1h-2M9 11h6M9 15h4' },
  { to: '/historico', label: 'Histórico', icon: 'M12 7v5l3 3M21 12a9 9 0 11-9-9 9 9 0 019 9z' },
  { to: '/progresso', label: 'Progresso', icon: 'M3 20h18M6 16l4-5 4 3 5-7' },
  { to: '/perfil', label: 'Perfil', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
]

function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const inWorkout = loc.pathname.startsWith('/treino/')
  return (
    <div className="min-h-dvh">
      <ViewingBar />
      {children}
      {!inWorkout && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex max-w-2xl">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500')
                }
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

/** Barra fina no topo: troca entre "eu" e alunos, e avisa offline/pendências. */
function ViewingBar() {
  const { me, viewing, setViewing } = useAuth()
  const { trainees } = useLinks()
  const rawLinks = useLiveQuery(() => db.links.toArray())
  const profiles = useProfiles()
  const sync = useSyncState()
  const pending = usePendingCount()

  // Se o vínculo com o aluno acabou, volta a mostrar os meus dados.
  useEffect(() => {
    if (rawLinks && viewing !== me && !rawLinks.some((l) => l.coach_id === me && l.trainee_id === viewing)) setViewing(me)
  }, [rawLinks, viewing, me, setViewing])

  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    return p?.name || p?.email?.split('@')[0] || 'Aluno'
  }
  const showSync = sync.state === 'offline' || sync.state === 'error' || pending > 0

  if (!trainees.length && !showSync) return null
  return (
    <div className={cx('pt-[env(safe-area-inset-top)]', viewing !== me ? 'bg-sky-600 text-white' : 'bg-zinc-100 dark:bg-zinc-900')}>
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-1.5 text-sm">
        {trainees.length > 0 && (
          <>
            <span className="opacity-80">Vendo:</span>
            <select
              value={viewing}
              onChange={(e) => setViewing(e.target.value)}
              className="rounded-lg bg-black/10 px-2 py-1 font-semibold outline-none dark:bg-white/10"
            >
              <option value={me}>Eu</option>
              {trainees.map((t) => (
                <option key={t.trainee_id} value={t.trainee_id}>{nameOf(t.trainee_id)}</option>
              ))}
            </select>
          </>
        )}
        <span className="flex-1" />
        {showSync && (
          <span className="text-xs opacity-80">
            {sync.state === 'offline' ? 'Offline' : sync.state === 'error' ? 'Erro ao sincronizar' : 'Sincronizando'}
            {pending > 0 && ` · ${pending} pendente${pending > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
    </div>
  )
}
