import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useNavigate } from 'react-router'
import { fmtKg, fmtSec } from '../lib/workout'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Page({ title, back, actions, children }: { title: ReactNode; back?: string | true; actions?: ReactNode; children: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        {back && (
          <button
            aria-label="Voltar"
            onClick={() => (back === true ? nav(-1) : nav(back))}
            className="-ml-2 rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
        {actions}
      </header>
      <main className="space-y-4 px-4 pt-4">{children}</main>
    </div>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900',
        onClick && 'cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-800',
        className,
      )}
    >
      {children}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }

export function Button({ variant = 'secondary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-40',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5',
        size === 'lg' && 'px-5 py-3.5 text-lg',
        variant === 'primary' && 'bg-emerald-600 text-white active:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950',
        variant === 'secondary' && 'bg-zinc-200 text-zinc-900 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:active:bg-zinc-700',
        variant === 'ghost' && 'text-zinc-600 active:bg-zinc-200 dark:text-zinc-300 dark:active:bg-zinc-800',
        variant === 'danger' && 'bg-red-600/10 text-red-600 active:bg-red-600/20 dark:text-red-400',
        className,
      )}
    />
  )
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
      {children}
      {hint && <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </span>
  )
}

const field =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950'

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(field, p.className)} />
}

export function TextArea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={cx(field, 'resize-y', p.className)} />
}

/** Texto que guarda o rascunho localmente e só salva ao sair do campo (ou Enter). */
export function LazyInput({ value, onCommit, multiline, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (v: string) => void
  multiline?: boolean
}) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value)
  }, [value, focused])
  const commit = () => {
    setFocused(false)
    if (text !== value) onCommit(text)
  }
  if (multiline)
    return (
      <TextArea
        value={text}
        placeholder={p.placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    )
  return (
    <Input
      {...p}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function Select({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(field, className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700')}
      >
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  )
}

/** Modal que sobe de baixo no celular e fica centralizado no PC. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] dark:bg-zinc-900 sm:rounded-3xl"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

/** Campo numérico que aceita vírgula e não "briga" com a digitação. */
export function NumInput({ value, onChange, placeholder, decimal, className, disabled, ariaLabel }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  decimal?: boolean
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const fmt = (v: number | null) => (v == null ? '' : decimal ? fmtKg(v) : String(v))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(fmt(value))
  }, [value, focused]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        if (t === '') return onChange(null)
        const n = decimal ? parseFloat(t.replace(',', '.')) : parseInt(t, 10)
        if (!Number.isNaN(n)) onChange(n)
      }}
      className={cx(
        'w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-center text-base tabular-nums outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-600',
        className,
      )}
    />
  )
}

/** Descanso m:ss com − / + (padrão 1:00 a 3:00, passo de 15 s). */
export function RestStepper({ value, onChange, target, min = 60, max = 180, step = 15, disabled }: {
  value: number | null
  onChange: (v: number | null) => void
  target?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  const base = value ?? target ?? 90
  const off = value != null && target != null && Math.abs(value - target) > 15
  return (
    <div className="inline-flex items-center gap-1">
      <button disabled={disabled} type="button" className="h-9 w-9 rounded-lg bg-zinc-200 text-lg font-bold dark:bg-zinc-800" onClick={() => onChange(Math.max(min, (value == null ? base : value) - step))} aria-label="Menos descanso">−</button>
      <button
        disabled={disabled}
        type="button"
        onClick={() => onChange(value == null ? base : null)}
        title={value == null ? 'Toque para registrar' : 'Toque para limpar'}
        className={cx('w-14 text-center font-semibold tabular-nums', value == null && 'text-zinc-400', off && 'text-amber-600 dark:text-amber-400')}
      >
        {value == null ? fmtSec(base) : fmtSec(value)}
      </button>
      <button disabled={disabled} type="button" className="h-9 w-9 rounded-lg bg-zinc-200 text-lg font-bold dark:bg-zinc-800" onClick={() => onChange(Math.min(max, (value == null ? base : value) + step))} aria-label="Mais descanso">+</button>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">{children}</div>
}

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'emerald' | 'amber' | 'sky' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        tone === 'zinc' && 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        tone === 'emerald' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        tone === 'amber' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        tone === 'sky' && 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
      )}
    >
      {children}
    </span>
  )
}

export function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} aria-label={label} title={label} onClick={onClick} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800">
      {children}
    </button>
  )
}

export const Icons = {
  up: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>,
  copy: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>,
  swap: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4" /></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
}
