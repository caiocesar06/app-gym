import { useState } from 'react'
import { Button, Input, Label } from '../components/ui'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    if (!supabase || !email.trim() || !password) return
    setBusy(true)
    setMsg('')
    const mail = email.trim()
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      setBusy(false)
      if (error) setMsg(traduz(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp({ email: mail, password })
      setBusy(false)
      if (error) return setMsg(traduz(error.message))
      if (!data.session) {
        setMsg('Conta criada, mas o Supabase pediu confirmação por e-mail. Desative "Confirm email" em Authentication → Providers → Email no painel do Supabase.')
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <img src="icon.svg" alt="" className="mx-auto mb-4 h-20 w-20" />
        <h1 className="text-2xl font-bold">Ficha de Treino</h1>
        <p className="mt-1 text-zinc-500">Monte sua ficha e registre seus treinos.</p>
      </div>

      <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), void submit())}>
        <label className="block">
          <Label>Seu e-mail</Label>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </label>
        <label className="block">
          <Label>Senha</Label>
          <Input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
          />
        </label>
        <Button variant="primary" size="lg" className="w-full" disabled={busy || password.length < 6}>
          {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setMsg('')
          }}
        >
          {mode === 'in' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta — Entrar'}
        </Button>
      </form>
      {msg && <p className="rounded-xl bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400">{msg}</p>}
    </div>
  )
}

function traduz(m: string) {
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos (se for seu primeiro acesso, toque em "Criar conta").'
  if (/user already registered/i.test(m)) return 'Este e-mail já tem conta. Toque em "Já tenho conta — Entrar".'
  if (/email logins are disabled|email provider/i.test(m)) return 'No Supabase (Authentication → Providers → Email), deixe "Enable Email provider" LIGADO e desligue apenas "Confirm email".'
  if (/password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit|security purposes/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (/fetch|network/i.test(m)) return 'Sem conexão. Para entrar pela primeira vez é preciso internet.'
  return m
}
