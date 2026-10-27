import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearLocalData, db, getMeta, setMeta } from './db'
import { LOCAL_USER, supabase } from './supabase'
import { startAutoSync, syncNow } from './sync'

type AuthValue = {
  status: 'loading' | 'out' | 'in'
  /** id do usuário logado */
  me: string
  email: string
  /** de quem são os dados exibidos (eu, ou um aluno meu) */
  viewing: string
  setViewing: (id: string) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue>(null!)
const LAST_USER = 'ficha:lastUser'
const VIEWING = 'ficha:viewing'

function readLastUser(): { id: string; email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_USER) || 'null')
  } catch {
    return null
  }
}

/** Garante que o banco local pertence a este usuário (outro login no mesmo aparelho limpa tudo). */
async function claimLocalDb(id: string) {
  const owner = await getMeta<string>('uid')
  if (owner && owner !== id) await clearLocalData()
  await setMeta('uid', id)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthValue['status']>('loading')
  const [me, setMe] = useState('')
  const [email, setEmail] = useState('')
  const [viewing, setViewingState] = useState('')

  const enter = useCallback(async (id: string, mail: string) => {
    await claimLocalDb(id)
    localStorage.setItem(LAST_USER, JSON.stringify({ id, email: mail }))
    setMe(id)
    setEmail(mail)
    setViewingState(localStorage.getItem(VIEWING) || id)
    setStatus('in')
  }, [])

  useEffect(() => {
    if (!supabase) {
      // Modo local: um usuário fixo, tudo só neste navegador.
      void (async () => {
        if (!(await db.profiles.get(LOCAL_USER))) {
          await db.profiles.put({
            id: LOCAL_USER, email: '', name: '', notes: '', settings: {},
            updated_at: new Date().toISOString(), deleted: false,
          })
        }
        await enter(LOCAL_USER, '')
      })()
      return
    }
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const u = data.session?.user
      if (u) return enter(u.id, u.email ?? '')
      // Sem rede o token pode não renovar: entra com o último usuário e sincroniza depois.
      const last = readLastUser()
      if (last && !navigator.onLine) return enter(last.id, last.email)
      setStatus('out')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        void enter(session.user.id, session.user.email ?? '').then(() => syncNow())
      }
      if (event === 'SIGNED_OUT') setStatus('out')
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [enter])

  useEffect(() => {
    if (status === 'in') return startAutoSync()
  }, [status])

  const setViewing = useCallback((id: string) => {
    localStorage.setItem(VIEWING, id)
    setViewingState(id)
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem(LAST_USER)
    localStorage.removeItem(VIEWING)
    await clearLocalData()
    await supabase?.auth.signOut()
    setStatus('out')
  }, [])

  return <Ctx.Provider value={{ status, me, email, viewing: viewing || me, setViewing, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
