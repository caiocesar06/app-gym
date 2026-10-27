import { Link } from 'react-router'
import { Badge, Card, Empty, Page } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSessions } from '../lib/hooks'
import { durationMin, fmtDate, workingSets } from '../lib/workout'

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

export default function History() {
  const { viewing } = useAuth()
  const sessions = useSessions(viewing, 'done')

  const groups = new Map<string, NonNullable<typeof sessions>>()
  for (const s of sessions ?? []) {
    const k = monthFmt.format(new Date(s.started_at))
    groups.set(k, [...(groups.get(k) ?? []), s])
  }

  return (
    <Page title="Histórico">
      {sessions?.length === 0 && <Empty>Nenhum treino finalizado ainda.</Empty>}
      {[...groups.entries()].map(([month, list]) => (
        <section key={month} className="space-y-2">
          <h2 className="pt-2 text-sm font-bold text-zinc-500 first-letter:uppercase">
            {month} · {list.length} treino{list.length > 1 ? 's' : ''}
          </h2>
          {list.map((s) => {
            const sets = s.entries.reduce((a, e) => a + workingSets(e).length, 0)
            return (
              <Link key={s.id} to={`/historico/${s.id}`} className="block">
                <Card className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{s.day_name}</div>
                    <div className="text-sm text-zinc-500">{fmtDate(s.started_at)}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
                    <span>{s.entries.length} exercício{s.entries.length === 1 ? "" : "s"} · {sets} série{sets === 1 ? "" : "s"}</span>
                    {durationMin(s) != null && <span>· {durationMin(s)} min</span>}
                    {s.cardio && <Badge tone="sky">cardio {s.cardio.minutes ? `${s.cardio.minutes} min` : ''}</Badge>}
                  </div>
                </Card>
              </Link>
            )
          })}
        </section>
      ))}
    </Page>
  )
}
