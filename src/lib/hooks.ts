import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { GLOBAL_EXERCISES } from '../data/exercises'
import { db, type Exercise, type Session } from './db'
import { useAuth } from './auth'

export function useProfile(id: string | undefined) {
  return useLiveQuery(() => (id ? db.profiles.get(id) : undefined), [id])
}

export function useProfiles() {
  return useLiveQuery(() => db.profiles.toArray(), [], [])
}

/** Catálogo padrão + exercícios personalizados visíveis para mim. */
export function useExercises() {
  const custom = useLiveQuery(() => db.exercises.filter((e) => !e.deleted).toArray(), [], [])
  return useMemo(() => {
    const map = new Map<string, Exercise>()
    for (const e of GLOBAL_EXERCISES) map.set(e.id, e)
    for (const e of custom) map.set(e.id, e)
    return map
  }, [custom])
}

export function exName(map: Map<string, Exercise>, id: string) {
  return map.get(id)?.name ?? 'Exercício removido'
}

export function usePlans(owner: string) {
  return useLiveQuery(
    async () =>
      (await db.plans.where('owner_id').equals(owner).filter((p) => !p.deleted).toArray()).sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      ),
    [owner],
  )
}

export function usePlan(id: string | undefined) {
  return useLiveQuery(() => (id ? db.plans.get(id) : undefined), [id])
}

/** Treinos de "owner", mais recentes primeiro. */
export function useSessions(owner: string, status?: Session['status']) {
  return useLiveQuery(
    async () =>
      (
        await db.sessions
          .where('owner_id')
          .equals(owner)
          .filter((s) => !s.deleted && (!status || s.status === status))
          .toArray()
      ).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [owner, status],
  )
}

export function useSession(id: string | undefined) {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
}

/** Meus treinadores e meus alunos. */
export function useLinks() {
  const { me } = useAuth()
  const links = useLiveQuery(() => db.links.toArray(), [], [])
  return useMemo(
    () => ({
      coaches: links.filter((l) => l.trainee_id === me),
      trainees: links.filter((l) => l.coach_id === me),
    }),
    [links, me],
  )
}

export function usePendingCount() {
  return useLiveQuery(() => db.outbox.count(), [], 0)
}
