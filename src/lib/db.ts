import Dexie, { type EntityTable } from 'dexie'

// ---------- Tipos do domínio ----------

/** Série. kg/reps nulos = ainda não preenchida. w = aquecimento (fica fora de médias e progressão). */
export type SetRow = { kg: number | null; reps: number | null; w?: boolean; done?: boolean }

/** Um exercício dentro de um treino. */
export type Entry = {
  id: string
  slotId: string | null
  exerciseId: string
  heavy: boolean
  restTarget: number // segundos
  rest: number | null // descanso registrado à mão (segundos)
  sets: SetRow[]
  targetSets?: number
  targetReps?: string
  note?: string
}

/** Posição na ficha, com opções de troca (options[0] é a padrão). */
export type Slot = {
  id: string
  label: string
  options: string[]
  heavy: boolean
  rest: number
  sets: number
  reps: string
  note?: string
}

export type Day = { id: string; name: string; rotation: boolean; slots: Slot[] }

export type Cardio = { kind: string; minutes: number | null; note?: string }

export type Settings = { restHeavy?: number; restNormal?: number; sound?: boolean; vibrate?: boolean }

type Base = { id: string; updated_at: string; deleted: boolean; synced_at?: string }

export type Profile = Base & { email: string; name: string; notes: string; settings: Settings }
export type Exercise = Base & { owner_id: string; name: string; muscle: string }
export type Plan = Base & { owner_id: string; name: string; active: boolean; days: Day[]; updated_by?: string | null }
export type Session = Base & {
  owner_id: string
  plan_id: string | null
  day_id: string | null
  day_name: string
  status: 'active' | 'done'
  started_at: string
  finished_at: string | null
  entries: Entry[]
  cardio: Cardio | null
  notes: string
}
export type Link = { id: string; coach_id: string; trainee_id: string }

export type SyncTable = 'profiles' | 'exercises' | 'plans' | 'sessions'
export type RowOf<T extends SyncTable> = {
  profiles: Profile
  exercises: Exercise
  plans: Plan
  sessions: Session
}[T]

type Outbox = { key: string; table: SyncTable; id: string }
type Meta = { key: string; value: unknown }

// ---------- Banco local (IndexedDB) ----------

export const db = new Dexie('ficha-treino') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  plans: EntityTable<Plan, 'id'>
  sessions: EntityTable<Session, 'id'>
  links: EntityTable<Link, 'id'>
  outbox: EntityTable<Outbox, 'key'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  profiles: 'id',
  exercises: 'id, owner_id',
  plans: 'id, owner_id',
  sessions: 'id, owner_id, status, started_at',
  links: 'id',
  outbox: 'key',
  meta: 'key',
})

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

export async function clearLocalData() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
