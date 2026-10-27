import { useMemo, useState } from 'react'
import { LineChart, type Point } from '../components/LineChart'
import { Card, cx, Empty, Page, Select } from '../components/ui'
import { useAuth } from '../lib/auth'
import { exName, useExercises, useSessions } from '../lib/hooks'
import { entryStats, fmtDate, fmtKg, fmtShortDate, weekStart } from '../lib/workout'

const METRICS = [
  { id: 'best1rm', label: '1RM est.', unit: 'kg' },
  { id: 'topKg', label: 'Carga máx.', unit: 'kg' },
  { id: 'volume', label: 'Volume', unit: 'kg' },
] as const
type Metric = (typeof METRICS)[number]['id']

export default function Progress() {
  const { viewing } = useAuth()
  const sessions = useSessions(viewing, 'done')
  const ex = useExercises()
  const [picked, setPicked] = useState('')
  const [metric, setMetric] = useState<Metric>('best1rm')

  // Exercícios que já apareceram, do mais recente para o mais antigo.
  const exercises = useMemo(() => {
    const seen = new Map<string, number>()
    for (const s of sessions ?? []) for (const e of s.entries) if (entryStats(e)) seen.set(e.exerciseId, (seen.get(e.exerciseId) ?? 0) + 1)
    return [...seen.entries()].map(([id, n]) => ({ id, n }))
  }, [sessions])

  const current = picked && exercises.some((e) => e.id === picked) ? picked : exercises[0]?.id

  const series = useMemo(() => {
    const out: { date: string; topKg: number; best1rm: number; volume: number }[] = []
    for (const s of [...(sessions ?? [])].reverse()) {
      const e = s.entries.find((x) => x.exerciseId === current)
      const st = e && entryStats(e)
      if (st) out.push({ date: s.started_at, ...st })
    }
    return out
  }, [sessions, current])

  const weeks = useMemo(() => {
    const start = weekStart()
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(start)
      from.setDate(from.getDate() - 7 * (7 - i))
      const to = new Date(from)
      to.setDate(to.getDate() + 7)
      const n = (sessions ?? []).filter((s) => {
        const d = new Date(s.started_at)
        return d >= from && d < to
      }).length
      return { label: fmtShortDate(from.toISOString()), n }
    })
  }, [sessions])

  if (sessions && !sessions.length) return <Page title="Progresso"><Empty>Finalize alguns treinos para ver sua evolução aqui.</Empty></Page>

  const maxW = Math.max(1, ...weeks.map((w) => w.n))
  const avg = weeks.slice(-4).reduce((a, w) => a + w.n, 0) / 4
  const points: Point[] = series.map((p) => ({ x: fmtShortDate(p.date), y: p[metric], label: fmtDate(p.date) }))
  const best1 = series.reduce<(typeof series)[number] | null>((b, p) => (!b || p.best1rm > b.best1rm ? p : b), null)
  const bestKg = series.reduce<(typeof series)[number] | null>((b, p) => (!b || p.topKg > b.topKg ? p : b), null)

  return (
    <Page title="Progresso">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-sm text-zinc-500">Treinos no total</div>
          <div className="text-3xl font-bold">{sessions?.length ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm text-zinc-500">Média por semana</div>
          <div className="text-3xl font-bold">{avg.toFixed(1).replace('.', ',')}</div>
          <div className="text-xs text-zinc-500">últimas 4 semanas</div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 text-sm font-semibold">Treinos por semana</div>
        <div className="flex h-28 items-end gap-2">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold tabular-nums">{w.n || ''}</span>
              <div className={cx('w-full rounded-t-md', i === weeks.length - 1 ? 'bg-emerald-500' : 'bg-emerald-500/40')} style={{ height: `${(w.n / maxW) * 72 + 2}px` }} />
              <span className="text-[10px] text-zinc-500">{w.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {exercises.length > 0 && current && (
        <Card className="space-y-3">
          <Select
            value={current}
            onChange={setPicked}
            options={exercises
              .map((e) => ({ value: e.id, label: `${exName(ex, e.id)} (${e.n})` }))}
          />
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={cx('flex-1 rounded-lg px-2 py-1.5 text-sm font-medium', metric === m.id ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800')}
              >
                {m.label}
              </button>
            ))}
          </div>
          {points.length >= 1 ? <LineChart points={points} unit="kg" /> : null}
          {points.length === 1 && <p className="text-center text-xs text-zinc-500">Faça mais treinos com este exercício para ver a curva.</p>}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {best1 && (
              <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
                <div className="text-xs text-zinc-500">Recorde 1RM est.</div>
                <div className="font-bold">{fmtKg(Math.round(best1.best1rm * 10) / 10)} kg</div>
                <div className="text-xs text-zinc-500">{fmtShortDate(best1.date)}</div>
              </div>
            )}
            {bestKg && (
              <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
                <div className="text-xs text-zinc-500">Maior carga</div>
                <div className="font-bold">{fmtKg(bestKg.topKg)} kg</div>
                <div className="text-xs text-zinc-500">{fmtShortDate(bestKg.date)}</div>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500">Séries de aquecimento não entram nos cálculos.</p>
        </Card>
      )}
    </Page>
  )
}
