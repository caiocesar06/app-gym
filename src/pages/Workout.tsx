import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../components/ExercisePicker'
import { RestTimerBar, useRestTimer } from '../components/RestTimer'
import { Badge, Button, Card, cx, Empty, IconButton, Icons, Input, Label, LazyInput, NumInput, Page, RestStepper, Select, Sheet } from '../components/ui'
import { CARDIO_KINDS } from '../data/exercises'
import { useAuth } from '../lib/auth'
import type { Entry, Session, SetRow, Slot } from '../lib/db'
import { exName, useExercises, usePlan, useProfile, useSession, useSessions } from '../lib/hooks'
import { mutate, remove, uid } from '../lib/repo'
import { syncNow } from '../lib/sync'
import { cleanEntries, defaultRest, fmtDate, fmtKg, fmtSet, fmtShortDate, lastEntryFor, shouldIncrease, workingSets } from '../lib/workout'

export default function Workout() {
  const { id } = useParams()
  const { me } = useAuth()
  const s = useSession(id)
  const done = useSessions(s?.owner_id ?? me, 'done') ?? []
  const plan = usePlan(s?.plan_id ?? undefined)
  const ex = useExercises()
  const nav = useNavigate()
  const timer = useRestTimer()
  const settings = useProfile(me)?.settings
  const [adding, setAdding] = useState(false)
  const [swapFor, setSwapFor] = useState<Entry | null>(null)

  const active = s?.status === 'active'
  const readOnly = !!s && s.owner_id !== me
  useWakeLock(active && !readOnly)

  if (s === undefined) return <Page title="Treino" back="/"><p className="text-zinc-500">Carregando…</p></Page>
  if (!s || s.deleted) return <Page title="Treino" back="/"><Empty>Treino não encontrado.</Empty></Page>
  const session: Session = s

  const upd = (fn: (x: Session) => Session) => mutate('sessions', session.id, fn, active ? 4000 : 1500)
  const setEntry = (eid: string, fn: (e: Entry) => Entry) =>
    upd((x) => ({ ...x, entries: x.entries.map((e) => (e.id === eid ? fn(e) : e)) }))
  const slotOf = (e: Entry): Slot | undefined => plan?.days.find((d) => d.id === session.day_id)?.slots.find((sl) => sl.id === e.slotId)

  async function finish() {
    const empty = session.entries.every((e) => !e.sets.some((x) => x.kg != null || x.reps != null)) && !session.cardio
    if (empty && !confirm('Nenhuma série preenchida. Finalizar mesmo assim?')) return
    await upd((x) => ({ ...x, status: 'done', finished_at: new Date().toISOString(), entries: cleanEntries(x.entries) }))
    timer.stop()
    void syncNow()
    nav(`/historico/${session.id}`, { replace: true })
  }

  async function discard() {
    if (!confirm('Descartar este treino? Tudo que foi registrado nele será apagado.')) return
    timer.stop()
    await remove('sessions', session.id)
    nav('/', { replace: true })
  }

  return (
    <Page
      back={active ? '/' : `/historico/${session.id}`}
      title={
        <span className="flex flex-col leading-tight">
          <span>{session.day_name}</span>
          <span className="text-xs font-normal text-zinc-500">
            {active ? <Elapsed since={session.started_at} /> : `Editando · ${fmtDate(session.started_at)}`}
          </span>
        </span>
      }
      actions={active && !readOnly && <Button size="sm" variant="primary" onClick={finish}>Finalizar</Button>}
    >
      {readOnly && <div className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300">Somente leitura: este treino é do seu aluno.</div>}

      {!active && !readOnly && (
        <Card>
          <label className="block">
            <Label>Data do treino</Label>
            <Input
              type="date"
              value={toDateInput(session.started_at)}
              onChange={(e) => {
                if (!e.target.value) return
                upd((x) => shiftDate(x, e.target.value))
              }}
            />
          </label>
        </Card>
      )}

      {session.entries.map((e, i) => (
        <EntryCard
          key={e.id}
          entry={e}
          name={exName(ex, e.exerciseId)}
          index={i}
          total={session.entries.length}
          slot={slotOf(e)}
          last={lastEntryFor(done, e.exerciseId, session.id, session.started_at)}
          readOnly={readOnly}
          live={active}
          onChange={(fn) => setEntry(e.id, fn)}
          onSwap={() => setSwapFor(e)}
          onMove={(d) =>
            upd((x) => {
              const arr = [...x.entries]
              const j = i + d
              if (j < 0 || j >= arr.length) return x
              ;[arr[i], arr[j]] = [arr[j], arr[i]]
              return { ...x, entries: arr }
            })
          }
          onRemove={() => confirm(`Remover ${exName(ex, e.exerciseId)} deste treino?`) && upd((x) => ({ ...x, entries: x.entries.filter((y) => y.id !== e.id) }))}
          onRest={(setIdx) => timer.start({ entryId: e.id, label: exName(ex, e.exerciseId), target: e.sets[setIdx]?.w ? 60 : e.restTarget })}
        />
      ))}

      {!readOnly && (
        <Button className="w-full" onClick={() => setAdding(true)}>{Icons.plus} Adicionar exercício</Button>
      )}

      <CardioCard session={session} readOnly={readOnly} onChange={(cardio) => upd((x) => ({ ...x, cardio }))} />

      <Card>
        <Label>Observações do treino</Label>
        {readOnly ? (
          <p className="whitespace-pre-line text-sm">{session.notes || '—'}</p>
        ) : (
          <LazyInput multiline value={session.notes} placeholder="Como foi o treino? Dores, energia…" onCommit={(v) => upd((x) => ({ ...x, notes: v }))} />
        )}
      </Card>

      {!readOnly && (
        <div className="space-y-2 pt-2">
          {active ? (
            <>
              <Button variant="primary" size="lg" className="w-full" onClick={finish}>Finalizar treino</Button>
              <Button variant="danger" className="w-full" onClick={discard}>Descartar treino</Button>
            </>
          ) : (
            <Button variant="primary" size="lg" className="w-full" onClick={() => nav(`/historico/${session.id}`)}>Pronto</Button>
          )}
          <p className="text-center text-xs text-zinc-500">Tudo é salvo automaticamente neste aparelho, mesmo sem internet.</p>
        </div>
      )}

      {timer.timer && <div className="h-20" />}
      <RestTimerBar onUse={(eid, sec) => setEntry(eid, (e) => ({ ...e, rest: sec }))} />

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        title="Adicionar ao treino"
        onPick={(exId) => {
          const e: Entry = {
            id: uid(), slotId: null, exerciseId: exId, heavy: false,
            restTarget: defaultRest(false, settings), rest: null,
            sets: [{ kg: null, reps: null }, { kg: null, reps: null }, { kg: null, reps: null }],
          }
          upd((x) => ({ ...x, entries: [...x.entries, e] }))
          setAdding(false)
        }}
      />
      {swapFor && (
        <SwapSheet
          entry={swapFor}
          slot={slotOf(swapFor)}
          onClose={() => setSwapFor(null)}
          onPick={(exId) => {
            setEntry(swapFor.id, (e) => ({ ...e, exerciseId: exId }))
            setSwapFor(null)
          }}
        />
      )}
    </Page>
  )
}

function EntryCard({ entry: e, name, index, total, slot, last, readOnly, live, onChange, onSwap, onMove, onRemove, onRest }: {
  entry: Entry
  name: string
  index: number
  total: number
  slot?: Slot
  last: ReturnType<typeof lastEntryFor>
  readOnly: boolean
  live: boolean
  onChange: (fn: (e: Entry) => Entry) => void
  onSwap: () => void
  onMove: (d: number) => void
  onRemove: () => void
  onRest: (setIdx: number) => void
}) {
  const [menu, setMenu] = useState(false)
  const targetReps = e.targetReps ?? slot?.reps
  const lastWorking = last ? last.entry.sets.filter((x) => !x.w) : []
  const up = last && shouldIncrease(last.entry, targetReps)
  let workIdx = 0

  const setSet = (i: number, patch: Partial<SetRow>) => onChange((x) => ({ ...x, sets: x.sets.map((st, j) => (j === i ? { ...st, ...patch } : st)) }))

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button disabled={readOnly} onClick={onSwap} className="flex max-w-full items-center gap-1.5 text-left">
            <span className="text-lg font-bold leading-tight">{name}</span>
            {!readOnly && <span className="shrink-0 text-zinc-400">{Icons.swap}</span>}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {(e.targetSets || targetReps) && <span>Meta {e.targetSets ?? slot?.sets ?? '?'}×{targetReps ?? '?'}</span>}
            {e.heavy && <Badge tone="amber">pesado</Badge>}
            {up && <Badge tone="emerald">↑ subir carga</Badge>}
          </div>
          {(e.note || slot?.note) && <div className="mt-1 text-xs text-zinc-500">📝 {e.note || slot?.note}</div>}
        </div>
        {!readOnly && (
          <div className="relative">
            <IconButton label="Mais opções" onClick={() => setMenu(!menu)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </IconButton>
            {menu && (
              <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800" onClick={() => setMenu(false)}>
                <MenuItem disabled={index === 0} onClick={() => onMove(-1)}>Mover para cima</MenuItem>
                <MenuItem disabled={index === total - 1} onClick={() => onMove(1)}>Mover para baixo</MenuItem>
                <MenuItem onClick={() => onChange((x) => ({ ...x, heavy: !x.heavy }))}>{e.heavy ? 'Marcar como normal' : 'Marcar como pesado'}</MenuItem>
                <MenuItem danger onClick={onRemove}>Remover do treino</MenuItem>
              </div>
            )}
          </div>
        )}
      </div>

      {last && (
        <div className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Última ({fmtShortDate(last.session.started_at)}): {workingSets(last.entry).map(fmtSet).join(' · ')}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="grid grid-cols-[2.5rem_1fr_1fr_2.75rem] gap-2 px-0.5 text-center text-xs font-medium text-zinc-500">
          <span>Série</span><span>kg</span><span>reps</span><span />
        </div>
        {e.sets.map((st, i) => {
          const n = st.w ? null : ++workIdx
          const ph = st.w ? undefined : lastWorking[(n ?? 1) - 1] ?? lastWorking[lastWorking.length - 1]
          const prev = e.sets.slice(0, i).reverse().find((x) => !x.w && x.kg != null)
          const phKg = ph?.kg ?? prev?.kg ?? null
          const phReps = ph?.reps ?? prev?.reps ?? null
          return (
            <div key={i} className={cx('grid grid-cols-[2.5rem_1fr_1fr_2.75rem] items-center gap-2', st.done && 'opacity-90')}>
              <button
                disabled={readOnly}
                title="Toque para alternar aquecimento"
                onClick={() => setSet(i, { w: !st.w })}
                className={cx('h-10 rounded-lg text-sm font-bold', st.w ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'bg-zinc-100 dark:bg-zinc-800')}
              >
                {st.w ? 'A' : n}
              </button>
              <NumInput ariaLabel={`kg série ${i + 1}`} decimal disabled={readOnly} value={st.kg} placeholder={phKg != null ? fmtKg(phKg) : 'kg'} onChange={(v) => setSet(i, { kg: v })} />
              <NumInput ariaLabel={`reps série ${i + 1}`} disabled={readOnly} value={st.reps} placeholder={phReps != null ? String(phReps) : 'reps'} onChange={(v) => setSet(i, { reps: v })} />
              <button
                disabled={readOnly}
                aria-label="Concluir série"
                onClick={() => {
                  if (st.done) return setSet(i, { done: false })
                  setSet(i, { done: true, kg: st.kg ?? phKg, reps: st.reps ?? phReps })
                  if (live) onRest(i)
                }}
                className={cx('grid h-10 place-items-center rounded-lg', st.done ? 'bg-emerald-500 text-white dark:text-zinc-950' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800')}
              >
                {Icons.check}
              </button>
            </div>
          )
        })}
        {!readOnly && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={() => onChange((x) => ({ ...x, sets: [...x.sets, { kg: null, reps: null }] }))}>+ Série</Button>
            <Button size="sm" variant="ghost" onClick={() => onChange((x) => ({ ...x, sets: [{ kg: null, reps: null, w: true }, ...x.sets] }))}>+ Aquecimento</Button>
            <Button size="sm" variant="ghost" disabled={e.sets.length <= 1} onClick={() => onChange((x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>− Série</Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="text-sm">
          <div className="font-medium">Descanso</div>
          <div className="text-xs text-zinc-500">alvo {Math.floor(e.restTarget / 60)}:{String(e.restTarget % 60).padStart(2, '0')}</div>
        </div>
        <div className="flex items-center gap-2">
          <RestStepper disabled={readOnly} value={e.rest} target={e.restTarget} onChange={(v) => onChange((x) => ({ ...x, rest: v }))} />
          {live && !readOnly && (
            <IconButton label="Iniciar cronômetro" onClick={() => onRest(-1)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></svg>
            </IconButton>
          )}
        </div>
      </div>
    </Card>
  )
}

function MenuItem({ children, onClick, disabled, danger }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cx('block w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-700', danger && 'text-red-600 dark:text-red-400')}>
      {children}
    </button>
  )
}

function SwapSheet({ entry, slot, onClose, onPick }: { entry: Entry; slot?: Slot; onClose: () => void; onPick: (id: string) => void }) {
  const ex = useExercises()
  const [picker, setPicker] = useState(false)
  const options = slot?.options ?? []
  return (
    <Sheet open onClose={onClose} title="Trocar exercício">
      {options.length > 0 && (
        <div className="mb-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {options.map((o) => (
            <button key={o} onClick={() => onPick(o)} className={cx('flex w-full justify-between py-3 text-left', o === entry.exerciseId && 'font-bold text-emerald-600 dark:text-emerald-400')}>
              {exName(ex, o)} {o === entry.exerciseId && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
      <Button className="w-full" onClick={() => setPicker(true)}>Outro exercício…</Button>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={onPick} selected={[entry.exerciseId]} />
    </Sheet>
  )
}

function CardioCard({ session, readOnly, onChange }: { session: Session; readOnly: boolean; onChange: (c: Session['cardio']) => void }) {
  const c = session.cardio
  if (!c) {
    if (readOnly) return null
    return (
      <Button variant="ghost" className="w-full border border-dashed border-zinc-300 dark:border-zinc-700" onClick={() => onChange({ kind: 'Esteira', minutes: null })}>
        + Cardio
      </Button>
    )
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold">Cardio</div>
        {!readOnly && <IconButton label="Remover cardio" onClick={() => onChange(null)}>{Icons.trash}</IconButton>}
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Select value={c.kind} onChange={(kind) => onChange({ ...c, kind })} options={CARDIO_KINDS.map((k) => ({ value: k, label: k }))} />
        <div className="relative">
          <NumInput disabled={readOnly} value={c.minutes} placeholder="min" onChange={(minutes) => onChange({ ...c, minutes })} className="pr-9" />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">min</span>
        </div>
      </div>
      {readOnly ? (
        c.note && <p className="text-sm">{c.note}</p>
      ) : (
        <LazyInput value={c.note ?? ''} placeholder="Velocidade, inclinação, distância…" onCommit={(note) => onChange({ ...c, note })} />
      )}
    </Card>
  )
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(i)
  }, [])
  const min = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000))
  return <>Em andamento · {min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`}</>
}

/** Mantém a tela ligada durante o treino (onde o navegador suporta). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const req = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    const onVis = () => document.visibilityState === 'visible' && req()
    void req()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [on])
}

function toDateInput(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Muda a data mantendo horário e duração. */
function shiftDate(s: Session, ymd: string): Session {
  const [y, m, d] = ymd.split('-').map(Number)
  const start = new Date(s.started_at)
  const delta = new Date(y, m - 1, d, start.getHours(), start.getMinutes()).getTime() - start.getTime()
  const move = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : iso)
  return { ...s, started_at: move(s.started_at)!, finished_at: move(s.finished_at) }
}
