import { useMemo, useState } from 'react'
import { MUSCLES } from '../data/exercises'
import { useAuth } from '../lib/auth'
import { useExercises } from '../lib/hooks'
import { save, uid } from '../lib/repo'
import { Button, Input, Select, Sheet, cx } from './ui'

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function ExercisePicker({ open, onClose, onPick, selected = [], title = 'Escolher exercício' }: {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
  selected?: string[]
  title?: string
}) {
  const { me } = useAuth()
  const all = useExercises()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string>('')
  const [newMuscle, setNewMuscle] = useState<string>('Outros')

  const groups = useMemo(() => {
    const nq = norm(q.trim())
    const list = [...all.values()].filter((e) => (!muscle || e.muscle === muscle) && (!nq || norm(e.name).includes(nq)))
    const by = new Map<string, typeof list>()
    for (const m of MUSCLES) by.set(m, [])
    for (const e of list) (by.get(e.muscle) ?? by.set(e.muscle, []).get(e.muscle)!).push(e)
    return [...by.entries()].filter(([, l]) => l.length).map(([m, l]) => [m, l.sort((a, b) => a.name.localeCompare(b.name))] as const)
  }, [all, q, muscle])

  const exact = [...all.values()].some((e) => norm(e.name) === norm(q.trim()))

  async function create() {
    const name = q.trim()
    if (!name) return
    const id = `c-${uid()}`
    await save('exercises', { id, owner_id: me, name, muscle: newMuscle, updated_at: '', deleted: false })
    onPick(id)
    setQ('')
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 space-y-2 bg-white px-4 pb-2 pt-4 dark:bg-zinc-900">
        <Input autoFocus placeholder="Buscar exercício…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {['', ...MUSCLES].map((m) => (
            <button
              key={m || 'all'}
              onClick={() => setMuscle(m)}
              className={cx('shrink-0 rounded-full px-3 py-1 text-sm', muscle === m ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950' : 'bg-zinc-200 dark:bg-zinc-800')}
            >
              {m || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {q.trim() && !exact && (
        <div className="my-3 space-y-2 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
          <div className="text-sm">Não achou? Crie <b>“{q.trim()}”</b>:</div>
          <div className="flex gap-2">
            <Select className="flex-1" value={newMuscle} onChange={setNewMuscle} options={MUSCLES.map((m) => ({ value: m, label: m }))} />
            <Button variant="primary" onClick={create}>Criar</Button>
          </div>
        </div>
      )}

      {groups.map(([m, list]) => (
        <div key={m} className="mt-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{m}</div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.map((e) => (
              <button
                key={e.id}
                onClick={() => onPick(e.id)}
                className={cx('flex w-full items-center justify-between py-2.5 text-left', selected.includes(e.id) && 'text-emerald-600 dark:text-emerald-400')}
              >
                <span>{e.name}</span>
                {selected.includes(e.id) && <span className="text-sm">✓</span>}
                {e.id.startsWith('c-') && !selected.includes(e.id) && <span className="text-xs text-zinc-400">personalizado</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && !q && <div className="py-6 text-center text-zinc-500">Nenhum exercício.</div>}
    </Sheet>
  )
}
