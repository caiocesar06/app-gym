import { db, type RowOf, type SyncTable } from './db'
import { scheduleSync } from './sync'
import { supabase } from './supabase'

/** Salva localmente e agenda o envio ao servidor. */
export async function save<T extends SyncTable>(table: T, row: RowOf<T>, syncDelay?: number) {
  const next = { ...row, updated_at: new Date().toISOString() }
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(next)
    if (supabase) await db.outbox.put({ key: `${table}:${row.id}`, table, id: row.id })
  })
  scheduleSync(syncDelay)
  return next as RowOf<T>
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Lê a versão mais recente, aplica fn e salva — em fila, para que toques
 * rápidos em sequência (ex.: + + + no descanso) não se sobrescrevam.
 */
export function mutate<T extends SyncTable>(table: T, id: string, fn: (cur: RowOf<T>) => RowOf<T>, syncDelay?: number) {
  const run = queue.then(async () => {
    const cur = (await db.table(table).get(id)) as RowOf<T> | undefined
    if (cur) await save(table, fn(cur), syncDelay)
  })
  queue = run.catch(() => {})
  return run
}

/** Exclusão "suave": marca deleted para que a exclusão também sincronize. */
export async function remove<T extends SyncTable>(table: T, id: string) {
  const row = await db.table(table).get(id)
  if (row) await save(table, { ...row, deleted: true })
}

export function uid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  // Fallback para contextos sem HTTPS (ex.: testar pelo IP da rede local).
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
