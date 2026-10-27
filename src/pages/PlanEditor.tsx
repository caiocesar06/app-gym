import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../components/ExercisePicker'
import { Badge, Button, Card, Empty, IconButton, Icons, Input, Label, LazyInput, NumInput, Page, RestStepper, Sheet, Toggle } from '../components/ui'
import { blankDay, blankSlot } from '../data/templates'
import { useAuth } from '../lib/auth'
import { db, type Day, type Plan, type Slot } from '../lib/db'
import { exName, useExercises, usePlan, useProfile } from '../lib/hooks'
import { mutate, remove, save, uid } from '../lib/repo'
import { defaultRest, fmtSec } from '../lib/workout'

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function PlanEditor() {
  const { id } = useParams()
  const { me } = useAuth()
  const plan = usePlan(id)
  const ex = useExercises()
  const nav = useNavigate()
  const [editing, setEditing] = useState<{ dayId: string; slotId: string } | null>(null)
  const [adding, setAdding] = useState<string | null>(null) // dayId
  const [openDay, setOpenDay] = useState<string | null>(null)
  const settings = useProfile(me)?.settings

  if (plan === undefined) return <Page title="Ficha" back="/fichas"><p className="text-zinc-500">Carregando…</p></Page>
  if (!plan || plan.deleted) return <Page title="Ficha" back="/fichas"><Empty>Ficha não encontrada.</Empty></Page>
  const p: Plan = plan

  // Sempre parte da versão mais recente no banco local, para edições rápidas não se perderem.
  const update = (patch: Partial<Plan> | ((cur: Plan) => Partial<Plan>)) =>
    mutate('plans', p.id, (cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch), updated_by: me }))
  const setDays = (fn: (days: Day[]) => Day[]) => update((cur) => ({ days: fn(cur.days) }))
  const setDay = (dayId: string, fn: (d: Day) => Day) => setDays((ds) => ds.map((d) => (d.id === dayId ? fn(d) : d)))
  const setSlot = (dayId: string, slotId: string, fn: (s: Slot) => Slot) =>
    setDay(dayId, (d) => ({ ...d, slots: d.slots.map((s) => (s.id === slotId ? fn(s) : s)) }))

  async function setActive(v: boolean) {
    if (v) {
      const others = await db.plans.where('owner_id').equals(p.owner_id).filter((x) => x.active && x.id !== p.id && !x.deleted).toArray()
      for (const o of others) await save('plans', { ...o, active: false, updated_by: me })
    }
    await update({ active: v })
  }

  const editingSlot = editing && p.days.find((d) => d.id === editing.dayId)?.slots.find((s) => s.id === editing.slotId)
  const expanded = openDay ?? (p.days.length === 1 ? p.days[0].id : null)

  return (
    <Page title={p.name} back="/fichas">
      <Card className="space-y-3">
        <label className="block">
          <Label>Nome da ficha</Label>
          <LazyInput value={p.name} onCommit={(v) => update({ name: v.trim() || 'Minha ficha' })} />
        </label>
        <Toggle checked={p.active} onChange={setActive} label={<span>Ficha ativa <span className="text-sm text-zinc-500">(aparece no Início)</span></span>} />
      </Card>

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-bold">Dias</h2>
        <span className="text-xs text-zinc-500">Dias “na rotação” se alternam em sequência</span>
      </div>

      {p.days.map((d, di) => {
        const isOpen = expanded === d.id
        return (
          <Card key={d.id} className="p-0">
            <button className="flex w-full items-center gap-2 p-4 text-left" onClick={() => setOpenDay(isOpen ? '' : d.id)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-lg font-bold">{d.name}</span>
                  {d.rotation && <Badge tone="emerald">rotação</Badge>}
                </div>
                <div className="truncate text-sm text-zinc-500">
                  {d.slots.length ? d.slots.map((s) => (s.options[0] ? exName(ex, s.options[0]) : s.label)).join(', ') : 'Sem exercícios'}
                </div>
              </div>
              <span className="text-zinc-400">{isOpen ? Icons.up : Icons.down}</span>
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex gap-2">
                  <LazyInput value={d.name} onCommit={(v) => setDay(d.id, (x) => ({ ...x, name: v.trim() || x.name }))} aria-label="Nome do dia" />
                </div>
                <Toggle checked={d.rotation} onChange={(v) => setDay(d.id, (x) => ({ ...x, rotation: v }))} label="Faz parte da rotação" />

                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {d.slots.map((s, si) => (
                    <div key={s.id} className="flex items-center gap-1 py-2 pl-3 pr-1">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setEditing({ dayId: d.id, slotId: s.id })}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{s.options[0] ? exName(ex, s.options[0]) : s.label || 'Sem exercício'}</span>
                          {s.heavy && <Badge tone="amber">pesado</Badge>}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {s.sets}×{s.reps} · descanso {fmtSec(s.rest)}
                          {s.options.length > 1 && ` · +${s.options.length - 1} opç${s.options.length > 2 ? 'ões' : 'ão'}`}
                        </div>
                      </button>
                      <IconButton label="Subir" disabled={si === 0} onClick={() => setDay(d.id, (x) => ({ ...x, slots: move(x.slots, si, -1) }))}>{Icons.up}</IconButton>
                      <IconButton label="Descer" disabled={si === d.slots.length - 1} onClick={() => setDay(d.id, (x) => ({ ...x, slots: move(x.slots, si, 1) }))}>{Icons.down}</IconButton>
                    </div>
                  ))}
                  {!d.slots.length && <div className="p-3 text-sm text-zinc-500">Nenhum exercício neste dia.</div>}
                </div>
                <Button className="w-full" onClick={() => setAdding(d.id)}>{Icons.plus} Exercício</Button>

                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="ghost" disabled={di === 0} onClick={() => setDays((ds) => move(ds, di, -1))}>{Icons.up} Subir dia</Button>
                  <Button size="sm" variant="ghost" disabled={di === p.days.length - 1} onClick={() => setDays((ds) => move(ds, di, 1))}>{Icons.down} Descer</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDays((ds) => {
                        const copy: Day = { ...d, id: uid(), name: `${d.name} (cópia)`, slots: d.slots.map((s) => ({ ...s, id: uid() })) }
                        return [...ds.slice(0, di + 1), copy, ...ds.slice(di + 1)]
                      })
                    }
                  >
                    {Icons.copy} Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => confirm(`Excluir o dia “${d.name}”?`) && setDays((ds) => ds.filter((x) => x.id !== d.id))}
                  >
                    {Icons.trash} Excluir dia
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )
      })}

      <Button
        className="w-full"
        onClick={() => {
          const nd = blankDay(`Treino ${String.fromCharCode(65 + p.days.length)}`)
          setDays((ds) => [...ds, nd])
          setOpenDay(nd.id)
        }}
      >
        {Icons.plus} Adicionar dia
      </Button>

      <Button
        variant="danger"
        className="mt-6 w-full"
        onClick={async () => {
          if (!confirm(`Excluir a ficha “${p.name}”? O histórico de treinos continua salvo.`)) return
          await remove('plans', p.id)
          nav('/fichas')
        }}
      >
        Excluir ficha
      </Button>

      <ExercisePicker
        open={!!adding}
        onClose={() => setAdding(null)}
        onPick={(exId) => {
          const dayId = adding!
          const s = { ...blankSlot(), label: exName(ex, exId), options: [exId], rest: defaultRest(false, settings) }
          setDay(dayId, (d) => ({ ...d, slots: [...d.slots, s] }))
          setAdding(null)
        }}
        title="Adicionar exercício"
      />

      {editing && editingSlot && (
        <SlotSheet
          slot={editingSlot}
          onClose={() => setEditing(null)}
          onChange={(fn) => setSlot(editing.dayId, editing.slotId, fn)}
          onDelete={() => {
            setDay(editing.dayId, (d) => ({ ...d, slots: d.slots.filter((s) => s.id !== editing.slotId) }))
            setEditing(null)
          }}
        />
      )}
    </Page>
  )
}

function SlotSheet({ slot, onClose, onChange, onDelete }: {
  slot: Slot
  onClose: () => void
  onChange: (fn: (s: Slot) => Slot) => void
  onDelete: () => void
}) {
  const ex = useExercises()
  const { me } = useAuth()
  const settings = useProfile(me)?.settings
  const [picking, setPicking] = useState(false)

  return (
    <Sheet open onClose={onClose} title={slot.options[0] ? exName(ex, slot.options[0]) : 'Exercício'}>
      <div className="space-y-4">
        <div>
          <Label hint="a primeira é a padrão; as outras aparecem como troca no treino">Opções</Label>
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {slot.options.map((o, i) => (
              <div key={o} className="flex items-center gap-1 py-1.5 pl-3 pr-1">
                <span className="flex-1">
                  {exName(ex, o)} {i === 0 && <Badge tone="emerald">padrão</Badge>}
                </span>
                {i > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => onChange((s) => ({ ...s, options: [o, ...s.options.filter((x) => x !== o)] }))}>
                    Tornar padrão
                  </Button>
                )}
                <IconButton label="Remover opção" onClick={() => onChange((s) => ({ ...s, options: s.options.filter((x) => x !== o) }))}>{Icons.x}</IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-2" onClick={() => setPicking(true)}>{Icons.plus} Adicionar opção de troca</Button>
        </div>

        <label className="block">
          <Label hint="opcional">Nome do grupo</Label>
          <LazyInput value={slot.label} placeholder="Ex.: Supino, Puxada…" onCommit={(v) => onChange((s) => ({ ...s, label: v }))} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Séries</Label>
            <NumInput value={slot.sets} onChange={(v) => onChange((s) => ({ ...s, sets: Math.max(1, Math.min(10, v ?? 1)) }))} />
          </label>
          <label className="block">
            <Label>Repetições</Label>
            <RepsInput value={slot.reps} onChange={(v) => onChange((s) => ({ ...s, reps: v }))} />
          </label>
        </div>

        <Toggle
          checked={slot.heavy}
          onChange={(v) => onChange((s) => ({ ...s, heavy: v, rest: defaultRest(v, settings) }))}
          label={<span>Exercício pesado <span className="text-sm text-zinc-500">(descanso maior)</span></span>}
        />

        <div className="flex items-center justify-between">
          <Label>Descanso alvo</Label>
          <RestStepper value={slot.rest} min={30} max={300} onChange={(v) => onChange((s) => ({ ...s, rest: v ?? s.rest }))} />
        </div>

        <label className="block">
          <Label hint="opcional">Observação</Label>
          <LazyInput value={slot.note ?? ''} placeholder="Ex.: banco a 30°, pegada neutra" onCommit={(v) => onChange((s) => ({ ...s, note: v || undefined }))} />
        </label>

        <div className="flex gap-2 pt-2">
          <Button variant="danger" onClick={() => confirm('Remover este exercício do dia?') && onDelete()}>{Icons.trash} Remover</Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>Pronto</Button>
        </div>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        selected={slot.options}
        title="Opção de troca"
        onPick={(id) => {
          onChange((s) => ({ ...s, options: s.options.includes(id) ? s.options : [...s.options, id], label: s.label || exName(ex, id) }))
          setPicking(false)
        }}
      />
    </Sheet>
  )
}

function RepsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [t, setT] = useState(value)
  return <Input value={t} placeholder="8-12" onChange={(e) => setT(e.target.value)} onBlur={() => t !== value && onChange(t.trim() || '8-12')} />
}
