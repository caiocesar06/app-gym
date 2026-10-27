import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge, Button, Card, Empty, Input, Page } from '../components/ui'
import { useAuth } from '../lib/auth'
import type { Day, Plan } from '../lib/db'
import { exName, useExercises, usePlans, useProfile, useSessions } from '../lib/hooks'
import { save } from '../lib/repo'
import { durationMin, fmtDate, newSession, nextDay, weekStart } from '../lib/workout'

export default function Home() {
  const { me, viewing } = useAuth()
  const nav = useNavigate()
  const mine = viewing === me
  const profile = useProfile(viewing)
  const myProfile = useProfile(me)
  const plans = usePlans(viewing)
  const sessions = useSessions(viewing)
  const ex = useExercises()

  const plan = plans?.find((p) => p.active) ?? plans?.[0]
  const done = sessions?.filter((s) => s.status === 'done') ?? []
  const active = sessions?.find((s) => s.status === 'active')
  const suggested = plan ? nextDay(plan, done) : undefined
  const thisWeek = done.filter((s) => new Date(s.started_at) >= weekStart()).length
  const name = profile?.name || (mine ? '' : profile?.email?.split('@')[0])

  async function start(p: Plan | null, d: Day | null) {
    if (active) {
      if (confirm('Você já tem um treino em andamento. Abrir ele?')) nav(`/treino/${active.id}`)
      return
    }
    const s = newSession(me, p, d, done)
    await save('sessions', s)
    nav(`/treino/${s.id}`)
  }

  return (
    <Page title={mine ? (name ? `Olá, ${name.split(' ')[0]}!` : 'Início') : `Ficha de ${name}`}>
      {mine && myProfile && !myProfile.name && <NamePrompt />}

      {mine && active && (
        <Card className="border-emerald-500 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10">
          <div className="text-sm text-emerald-700 dark:text-emerald-400">Treino em andamento</div>
          <div className="mt-0.5 text-xl font-bold">{active.day_name}</div>
          <div className="text-sm text-zinc-500">
            Começou {new Date(active.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => nav(`/treino/${active.id}`)}>
            Continuar treino
          </Button>
        </Card>
      )}

      {plans && !plan && (
        <Empty>
          <p className="mb-3">{mine ? 'Você ainda não tem uma ficha.' : 'Nenhuma ficha ainda.'}</p>
          <Button variant="primary" onClick={() => nav('/fichas')}>Montar ficha</Button>
        </Empty>
      )}

      {plan && suggested && !(mine && active) && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="truncate">{plan.name}</span>
            {suggested.rotation && <Badge tone="emerald">próximo da rotação</Badge>}
          </div>
          <div className="mt-1 text-2xl font-bold">{suggested.name}</div>
          <ul className="mt-2 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {suggested.slots.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate">{s.options[0] ? exName(ex, s.options[0]) : s.label}</span>
                <span className="shrink-0 tabular-nums text-zinc-400">{s.sets}×{s.reps}</span>
              </li>
            ))}
          </ul>
          {mine ? (
            <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => start(plan, suggested)}>
              Começar {suggested.name}
            </Button>
          ) : (
            <Button className="mt-4 w-full" onClick={() => nav(`/fichas/${plan.id}`)}>Editar ficha</Button>
          )}
        </Card>
      )}

      {mine && plan && !active && (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-500">Ou escolha outro dia</div>
          <div className="flex flex-wrap gap-2">
            {plan.days
              .filter((d) => d.id !== suggested?.id && d.slots.length)
              .map((d) => (
                <Button key={d.id} size="sm" onClick={() => start(plan, d)}>{d.name}</Button>
              ))}
            <Button size="sm" variant="ghost" onClick={() => start(null, null)}>+ Treino livre</Button>
          </div>
        </div>
      )}

      {profile?.notes && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Restrições e observações</div>
          <p className="mt-1 whitespace-pre-line text-sm">{profile.notes}</p>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-bold">Últimos treinos</h2>
        <span className="text-sm text-zinc-500">Esta semana: <b className="text-zinc-900 dark:text-zinc-100">{thisWeek}</b></span>
      </div>
      {done.length === 0 && <p className="text-sm text-zinc-500">Nenhum treino finalizado ainda.</p>}
      {done.slice(0, 4).map((s) => (
        <Link key={s.id} to={`/historico/${s.id}`} className="block">
          <Card className="flex items-center justify-between py-3">
            <div>
              <div className="font-semibold">{s.day_name}</div>
              <div className="text-sm text-zinc-500">{fmtDate(s.started_at)}</div>
            </div>
            <div className="text-right text-sm text-zinc-500">
              {s.entries.length} exercício{s.entries.length === 1 ? "" : "s"}
              {durationMin(s) != null && <div>{durationMin(s)} min</div>}
            </div>
          </Card>
        </Link>
      ))}
      {done.length > 4 && (
        <Link to="/historico" className="block text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">Ver histórico completo</Link>
      )}
    </Page>
  )
}

function NamePrompt() {
  const { me } = useAuth()
  const profile = useProfile(me)
  const [name, setName] = useState('')
  if (!profile) return null
  return (
    <Card>
      <form className="space-y-2" onSubmit={(e) => (e.preventDefault(), name.trim() && void save('profiles', { ...profile, name: name.trim() }))}>
        <div className="font-semibold">Como podemos te chamar?</div>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          <Button variant="primary">Salvar</Button>
        </div>
      </form>
    </Card>
  )
}
