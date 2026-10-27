import { REST_HEAVY, REST_NORMAL } from '../data/templates'
import type { Day, Entry, Plan, Session, SetRow, Settings } from './db'
import { uid } from './repo'

// ---------- Séries ----------

/** Séries válidas (sem aquecimento e preenchidas). */
export function workingSets(e: Entry): { kg: number; reps: number }[] {
  return e.sets.filter((s): s is { kg: number; reps: number } => !s.w && s.kg != null && s.reps != null && s.reps > 0)
}

/** 1RM estimado (Epley). */
export function e1rm(kg: number, reps: number) {
  return reps <= 1 ? kg : kg * (1 + reps / 30)
}

export function entryStats(e: Entry) {
  const ws = workingSets(e)
  if (!ws.length) return null
  return {
    topKg: Math.max(...ws.map((s) => s.kg)),
    best1rm: Math.max(...ws.map((s) => e1rm(s.kg, s.reps))),
    volume: ws.reduce((a, s) => a + s.kg * s.reps, 0),
    sets: ws.length,
  }
}

export function parseRepRange(reps: string | undefined): { min: number; max: number } | null {
  const m = reps?.match(/(\d+)\s*(?:-|–|a)\s*(\d+)/)
  if (m) return { min: +m[1], max: +m[2] }
  const one = reps?.match(/^\s*(\d+)\s*$/)
  return one ? { min: +one[1], max: +one[1] } : null
}

// ---------- Histórico ----------

/** Último treino finalizado (antes de "before") em que o exercício apareceu com séries válidas. */
export function lastEntryFor(done: Session[], exerciseId: string, excludeSessionId?: string, before?: string) {
  for (const s of done) {
    if (s.id === excludeSessionId || s.status !== 'done') continue
    if (before && s.started_at >= before) continue
    const e = s.entries.find((x) => x.exerciseId === exerciseId && workingSets(x).length)
    if (e) return { session: s, entry: e }
  }
  return null
}

/** Qual opção do slot foi usada da última vez. */
export function lastChoiceFor(done: Session[], slotId: string) {
  for (const s of done) {
    const e = s.entries.find((x) => x.slotId === slotId)
    if (e) return e.exerciseId
  }
  return null
}

/** Bateu o topo da faixa de repetições em todas as séries válidas → sugerir subir a carga. */
export function shouldIncrease(entry: Entry, targetReps?: string) {
  const range = parseRepRange(targetReps)
  const ws = workingSets(entry)
  if (!range || !ws.length) return false
  const topKg = Math.max(...ws.map((s) => s.kg))
  const top = ws.filter((s) => s.kg === topKg)
  return top.length >= Math.min(2, ws.length) && top.every((s) => s.reps >= range.max)
}

/** Próximo dia da rotação, com base no último treino desta ficha. */
export function nextDay(plan: Plan, done: Session[]): Day | undefined {
  const rot = plan.days.filter((d) => d.rotation && d.slots.length)
  if (!rot.length) return plan.days.find((d) => d.slots.length)
  const last = done.find((s) => s.plan_id === plan.id && rot.some((d) => d.id === s.day_id))
  if (!last) return rot[0]
  const i = rot.findIndex((d) => d.id === last.day_id)
  return rot[(i + 1) % rot.length]
}

export function defaultRest(heavy: boolean, settings?: Settings) {
  return heavy ? (settings?.restHeavy ?? REST_HEAVY) : (settings?.restNormal ?? REST_NORMAL)
}

export function newSession(owner: string, plan: Plan | null, day: Day | null, done: Session[]): Session {
  const now = new Date().toISOString()
  const entries: Entry[] = (day?.slots ?? [])
    .filter((sl) => sl.options.length)
    .map((sl) => {
      const choice = lastChoiceFor(done, sl.id)
      const exerciseId = choice && sl.options.includes(choice) ? choice : sl.options[0]
      return {
        id: uid(),
        slotId: sl.id,
        exerciseId,
        heavy: sl.heavy,
        restTarget: sl.rest,
        rest: null,
        targetSets: sl.sets,
        targetReps: sl.reps,
        note: sl.note,
        sets: Array.from({ length: Math.max(1, sl.sets) }, (): SetRow => ({ kg: null, reps: null })),
      }
    })
  return {
    id: uid(),
    owner_id: owner,
    plan_id: plan?.id ?? null,
    day_id: day?.id ?? null,
    day_name: day?.name ?? 'Treino livre',
    status: 'active',
    started_at: now,
    finished_at: null,
    entries,
    cardio: null,
    notes: '',
    updated_at: now,
    deleted: false,
  }
}

/** Ao finalizar: tira séries vazias e exercícios que ficaram sem nenhuma série. */
export function cleanEntries(entries: Entry[]): Entry[] {
  return entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.kg != null || s.reps != null) }))
    .filter((e) => e.sets.length)
}

// ---------- Formatação ----------

export function fmtSec(sec: number | null | undefined) {
  if (sec == null) return '—'
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtKg(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function fmtSet(s: { kg: number | null; reps: number | null }) {
  return `${s.kg != null ? fmtKg(s.kg) : '–'}×${s.reps ?? '–'}`
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
const shortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export function fmtDate(iso: string) {
  const s = dateFmt.format(new Date(iso)).replace(/\./g, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtShortDate(iso: string) {
  return shortFmt.format(new Date(iso))
}

export function durationMin(s: Session) {
  if (!s.finished_at) return null
  return Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)
}

/** Início da semana (segunda-feira). */
export function weekStart(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
