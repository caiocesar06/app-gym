import { useNavigate, useParams } from 'react-router'
import { Badge, Button, Card, cx, Empty, Page } from '../components/ui'
import { useAuth } from '../lib/auth'
import { exName, useExercises, useSession } from '../lib/hooks'
import { remove } from '../lib/repo'
import { durationMin, entryStats, fmtDate, fmtKg, fmtSec, fmtSet } from '../lib/workout'

export default function SessionDetail() {
  const { id } = useParams()
  const { me } = useAuth()
  const s = useSession(id)
  const ex = useExercises()
  const nav = useNavigate()

  if (s === undefined) return <Page title="Treino" back="/historico"><p className="text-zinc-500">Carregando…</p></Page>
  if (!s || s.deleted) return <Page title="Treino" back="/historico"><Empty>Treino não encontrado.</Empty></Page>
  const mine = s.owner_id === me
  const totalVol = s.entries.reduce((a, e) => a + (entryStats(e)?.volume ?? 0), 0)

  return (
    <Page title={s.day_name} back="/historico">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
        <span>{fmtDate(s.started_at)}</span>
        {durationMin(s) != null && <span>{durationMin(s)} min</span>}
        <span>Volume {Math.round(totalVol).toLocaleString('pt-BR')} kg</span>
      </div>

      {s.entries.map((e) => {
        const st = entryStats(e)
        return (
          <Card key={e.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold">{exName(ex, e.exerciseId)}</div>
              <div className="flex shrink-0 gap-1">
                {e.heavy && <Badge tone="amber">pesado</Badge>}
                <Badge>desc. {fmtSec(e.rest)}</Badge>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.sets.map((x, i) => (
                <span key={i} className={cx('rounded-lg px-2 py-1 text-sm tabular-nums', x.w ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-zinc-100 dark:bg-zinc-800')}>
                  {x.w && 'A '}{fmtSet(x)}
                </span>
              ))}
              {!e.sets.length && <span className="text-sm text-zinc-500">Sem séries</span>}
            </div>
            {st && (
              <div className="mt-2 text-xs text-zinc-500">
                Máx {fmtKg(st.topKg)} kg · 1RM est. {fmtKg(Math.round(st.best1rm * 10) / 10)} kg · volume {Math.round(st.volume)} kg
              </div>
            )}
          </Card>
        )
      })}

      {s.cardio && (
        <Card>
          <div className="font-bold">Cardio</div>
          <div className="text-sm">{s.cardio.kind}{s.cardio.minutes ? ` · ${s.cardio.minutes} min` : ''}</div>
          {s.cardio.note && <div className="text-sm text-zinc-500">{s.cardio.note}</div>}
        </Card>
      )}

      {s.notes && (
        <Card>
          <div className="font-bold">Observações</div>
          <p className="whitespace-pre-line text-sm">{s.notes}</p>
        </Card>
      )}

      {mine && (
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => nav(`/treino/${s.id}`)}>Editar</Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!confirm('Excluir este treino do histórico?')) return
              await remove('sessions', s.id)
              nav('/historico', { replace: true })
            }}
          >
            Excluir
          </Button>
        </div>
      )}
    </Page>
  )
}
