import { useState } from 'react'

export type Point = { x: string; y: number; label: string }

/** Gráfico de linha simples em SVG (sem dependências). */
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null
  const W = 400
  const H = 200
  const P = { l: 34, r: 10, t: 12, b: 26 }
  const ys = points.map((p) => p.y)
  let min = Math.min(...ys)
  let max = Math.max(...ys)
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.1
  min = Math.max(0, min - pad)
  max += pad
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r))
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b)
  const ticks = [0, 0.5, 1].map((t) => min + t * (max - min))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const h = hover ?? points.length - 1
  const step = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="select-none">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{fmt(points[h].y)} {unit}</span>
        <span className="text-sm text-zinc-500">{points[h].label}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none text-emerald-500"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          points.forEach((_, i) => Math.abs(x(i) - px) < Math.abs(x(best) - px) && (best = i))
          setHover(best)
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="fill-zinc-400 text-[13px]">{fmt(t)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-zinc-400 text-[13px]">{p.x}</text>
          ) : null,
        )}
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r={i === h ? 5 : 3} fill="currentColor" />
        ))}
        <line x1={x(h)} x2={x(h)} y1={P.t} y2={H - P.b} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
      </svg>
    </div>
  )
}

function fmt(n: number) {
  return n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString().replace('.', ',')
}
