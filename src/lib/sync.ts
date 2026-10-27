import { useSyncExternalStore } from 'react'
import { db, getMeta, setMeta, type SyncTable } from './db'
import { supabase } from './supabase'

/*
 * Sincronização local-first:
 * - Toda escrita vai primeiro para o IndexedDB e entra na "outbox".
 * - push(): envia o que está na outbox (upsert). O servidor ignora escritas
 *   com updated_at mais antigo que o atual (last-write-wins).
 * - pull(): baixa o que mudou desde o último cursor (synced_at, relógio do
 *   servidor) e só sobrescreve o local se não houver edição local mais nova.
 */

const TABLES: SyncTable[] = ['profiles', 'exercises', 'plans', 'sessions']
const PAGE = 500
const OVERLAP_MS = 5000

export type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'error' | 'local'

let state: SyncState = supabase ? 'idle' : 'local'
let lastError = ''
let lastOk: number | null = null
const listeners = new Set<() => void>()

function setState(s: SyncState, err = '') {
  state = s
  lastError = err
  if (s === 'ok') lastOk = Date.now()
  snapshot = { state, lastError, lastOk }
  listeners.forEach((l) => l())
}

let snapshot: { state: SyncState; lastError: string; lastOk: number | null } = { state, lastError, lastOk }

export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

let running = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

export function scheduleSync(delay = 1500) {
  if (!supabase) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function syncNow() {
  if (!supabase) return
  if (running) {
    again = true
    return
  }
  if (!navigator.onLine) {
    setState('offline')
    return
  }
  running = true
  setState('syncing')
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setState('idle')
      return
    }
    await push()
    await pull()
    await pullLinks()
    setState('ok')
  } catch (e) {
    console.error('sync', e)
    setState(navigator.onLine ? 'error' : 'offline', e instanceof Error ? e.message : String(e))
  } finally {
    running = false
    if (again) {
      again = false
      scheduleSync(200)
    }
  }
}

async function push() {
  const items = await db.outbox.toArray()
  for (const table of TABLES) {
    const mine = items.filter((i) => i.table === table)
    if (!mine.length) continue
    const rows = (await db.table(table).bulkGet(mine.map((i) => i.id))).filter(Boolean) as Record<string, unknown>[]
    const payload = rows.map(({ synced_at: _ignored, ...r }) => r)
    if (payload.length) {
      const { error } = await supabase!.from(table).upsert(payload)
      if (error) throw new Error(`${table}: ${error.message}`)
    }
    // Remove da outbox só o que não foi editado de novo durante o envio.
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      for (const r of rows) {
        const now = await db.table(table).get(r.id as string)
        if (!now || now.updated_at === r.updated_at) await db.outbox.delete(`${table}:${r.id}`)
      }
      for (const i of mine) if (!rows.find((r) => r.id === i.id)) await db.outbox.delete(i.key)
    })
  }
}

async function pull() {
  for (const table of TABLES) {
    const key = `cursor:${table}`
    let cursor = (await getMeta<string>(key)) ?? '1970-01-01T00:00:00Z'
    let first = true
    for (;;) {
      const from = first ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : cursor
      first = false
      const { data, error } = await supabase!
        .from(table)
        .select('*')
        .gt('synced_at', from)
        .order('synced_at', { ascending: true })
        .limit(PAGE)
      if (error) throw new Error(`${table}: ${error.message}`)
      if (!data?.length) break
      await db.transaction('rw', db.table(table), db.outbox, async () => {
        for (const remote of data) {
          const local = await db.table(table).get(remote.id)
          const pending = await db.outbox.get(`${table}:${remote.id}`)
          if (!local || !pending || remote.updated_at >= local.updated_at) {
            await db.table(table).put(remote)
            if (pending && local && remote.updated_at >= local.updated_at) await db.outbox.delete(pending.key)
          }
        }
      })
      cursor = data[data.length - 1].synced_at
      await setMeta(key, cursor)
      if (data.length < PAGE) break
    }
  }
}

async function pullLinks() {
  const { data, error } = await supabase!.from('coach_links').select('id, coach_id, trainee_id')
  if (error) throw new Error(`coach_links: ${error.message}`)
  await db.transaction('rw', db.links, async () => {
    await db.links.clear()
    await db.links.bulkPut(data ?? [])
  })
}

/** Liga a sincronização automática (abrir o app, voltar para o app, voltar a conexão, a cada minuto). */
export function startAutoSync() {
  if (!supabase) return () => {}
  const onVisible = () => document.visibilityState === 'visible' && scheduleSync(100)
  const onOnline = () => scheduleSync(100)
  const onOffline = () => setState('offline')
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  const interval = setInterval(() => scheduleSync(0), 60_000)
  scheduleSync(0)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    clearInterval(interval)
  }
}
