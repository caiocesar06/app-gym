import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/hooks'
import { fmtSec } from '../lib/workout'
import { Button, cx } from './ui'

type Timer = { startedAt: number; target: number; entryId: string; label: string }
type Ctx = { timer: Timer | null; start: (t: Omit<Timer, 'startedAt'>) => void; stop: () => void }

const TimerCtx = createContext<Ctx>(null!)
const KEY = 'ficha:timer'

let audio: AudioContext | null = null
function beep() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    for (const [i, f] of [880, 1175].entries()) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.25 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.22)
      o.connect(g).connect(audio.destination)
      o.start(t + i * 0.25)
      o.stop(t + i * 0.25 + 0.25)
    }
  } catch {
    /* sem áudio */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<Timer | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || 'null')
    } catch {
      return null
    }
  })
  const start = useCallback((t: Omit<Timer, 'startedAt'>) => {
    // Cria o áudio dentro do toque do usuário (exigência dos navegadores).
    try {
      audio ??= new AudioContext()
      void audio.resume()
    } catch {
      /* ignore */
    }
    const next = { ...t, startedAt: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(next))
    setTimer(next)
  }, [])
  const stop = useCallback(() => {
    sessionStorage.removeItem(KEY)
    setTimer(null)
  }, [])
  return <TimerCtx.Provider value={{ timer, start, stop }}>{children}</TimerCtx.Provider>
}

export const useRestTimer = () => useContext(TimerCtx)

/** Barra flutuante do cronômetro. "Usar" grava o tempo decorrido no descanso do exercício. */
export function RestTimerBar({ onUse }: { onUse: (entryId: string, seconds: number) => void }) {
  const { timer, stop } = useRestTimer()
  const { me } = useAuth()
  const settings = useProfile(me)?.settings
  const [now, setNow] = useState(Date.now())
  const alerted = useRef<number | null>(null)

  useEffect(() => {
    if (!timer) return
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [timer])

  const elapsed = timer ? (now - timer.startedAt) / 1000 : 0
  const reached = !!timer && elapsed >= timer.target

  useEffect(() => {
    if (!timer || !reached || alerted.current === timer.startedAt) return
    alerted.current = timer.startedAt
    if (settings?.vibrate !== false) navigator.vibrate?.([250, 120, 250])
    if (settings?.sound !== false) beep()
  }, [reached, timer, settings])

  if (!timer) return null
  const pct = Math.min(100, (elapsed / timer.target) * 100)
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className={cx('mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-lg ring-1', reached ? 'bg-emerald-600 text-white ring-emerald-700' : 'bg-zinc-900 text-white ring-zinc-700')}>
        <div className="h-1 bg-white/20">
          <div className="h-full bg-white/80 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs opacity-80">Descanso · {timer.label}</div>
            <div className="text-2xl font-bold tabular-nums">
              {fmtSec(elapsed)} <span className="text-sm font-medium opacity-70">/ {fmtSec(timer.target)}</span>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-white/15 text-white active:bg-white/25"
            onClick={() => {
              const s = Math.min(180, Math.max(60, Math.round(elapsed / 15) * 15))
              onUse(timer.entryId, s)
              stop()
            }}
          >
            Usar {fmtSec(Math.min(180, Math.max(60, Math.round(elapsed / 15) * 15)))}
          </Button>
          <Button size="sm" className="bg-white/15 text-white active:bg-white/25" onClick={stop}>Parar</Button>
        </div>
      </div>
    </div>
  )
}
