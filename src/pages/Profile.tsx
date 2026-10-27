import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Label, LazyInput, Page, RestStepper, Toggle } from '../components/ui'
import { REST_HEAVY, REST_NORMAL } from '../data/templates'
import { useAuth } from '../lib/auth'
import { db, type Settings } from '../lib/db'
import { useLinks, usePendingCount, useProfile, useProfiles } from '../lib/hooks'
import { mutate } from '../lib/repo'
import { supabase } from '../lib/supabase'
import { syncNow, useSyncState } from '../lib/sync'

export default function Profile() {
  const { me, email, signOut, setViewing } = useAuth()
  const profile = useProfile(me)
  const nav = useNavigate()
  const local = !supabase

  if (!profile) return <Page title="Perfil"><p className="text-zinc-500">Carregando perfil… (é preciso internet no primeiro acesso)</p></Page>

  const setProfile = (patch: Partial<typeof profile>) => mutate('profiles', me, (p) => ({ ...p, ...patch }))
  const setSettings = (patch: Partial<Settings>) => mutate('profiles', me, (p) => ({ ...p, settings: { ...p.settings, ...patch } }))
  const st = profile.settings

  return (
    <Page title="Perfil">
      {local && (
        <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <b>Modo local:</b> os dados ficam só neste navegador (sem login e sem sincronização). Configure o Supabase para usar em vários aparelhos.
        </div>
      )}

      <Card className="space-y-3">
        <label className="block">
          <Label>Nome</Label>
          <LazyInput value={profile.name} placeholder="Seu nome" onCommit={(v) => setProfile({ name: v.trim() })} />
        </label>
        {email && <div className="text-sm text-zinc-500">E-mail: {email}</div>}
        <label className="block">
          <Label hint="seu treinador também vê">Restrições e observações</Label>
          <LazyInput multiline value={profile.notes} placeholder="Ex.: dor no joelho esquerdo, evitar supino com barra (punho)…" onCommit={(v) => setProfile({ notes: v.trim() })} />
        </label>
      </Card>

      <Card className="space-y-3">
        <div className="font-bold">Treino</div>
        <div className="flex items-center justify-between">
          <Label>Descanso padrão (pesados)</Label>
          <RestStepper value={st.restHeavy ?? REST_HEAVY} min={30} max={300} onChange={(v) => setSettings({ restHeavy: v ?? REST_HEAVY })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Descanso padrão (demais)</Label>
          <RestStepper value={st.restNormal ?? REST_NORMAL} min={30} max={300} onChange={(v) => setSettings({ restNormal: v ?? REST_NORMAL })} />
        </div>
        <p className="text-xs text-zinc-500">Usado ao criar exercícios novos na ficha. Cada exercício pode ter seu próprio alvo.</p>
        <Toggle checked={st.sound !== false} onChange={(v) => setSettings({ sound: v })} label="Som ao fim do descanso" />
        <Toggle checked={st.vibrate !== false} onChange={(v) => setSettings({ vibrate: v })} label="Vibrar ao fim do descanso" />
      </Card>

      {!local && <CoachSection onView={(id) => (setViewing(id), nav('/'))} />}
      {!local && <SyncSection />}

      <Card className="space-y-2">
        <div className="font-bold">Instalar no celular</div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <b>iPhone (Safari):</b> botão Compartilhar → “Adicionar à Tela de Início”.<br />
          <b>Android (Chrome):</b> menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.
        </p>
      </Card>

      <Card className="space-y-2">
        <div className="font-bold">Seus dados</div>
        <Button className="w-full" onClick={exportData}>Exportar meus dados (JSON)</Button>
        {!local && (
          <Button
            className="w-full"
            onClick={async () => {
              const pending = await db.outbox.count()
              if (pending && !confirm(`Há ${pending} alteração(ões) ainda não sincronizada(s). Se sair agora, elas serão perdidas. Sair mesmo assim?`)) return
              await signOut()
            }}
          >
            Sair
          </Button>
        )}
        {!local && <DeleteAccount />}
      </Card>
    </Page>
  )
}

function CoachSection({ onView }: { onView: (id: string) => void }) {
  const { coaches, trainees } = useLinks()
  const profiles = useProfiles()
  const [mail, setMail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    return p?.name || p?.email || 'Carregando…'
  }

  async function add() {
    if (!mail.trim()) return
    setBusy(true)
    setMsg('')
    const { data, error } = await supabase!.rpc('link_coach', { coach_email: mail.trim() })
    setBusy(false)
    if (error) return setMsg(navigator.onLine ? error.message : 'Sem conexão. Tente de novo com internet.')
    setMail('')
    setMsg(`${data} agora é seu treinador e pode montar e acompanhar sua ficha.`)
    await syncNow()
  }

  async function unlink(id: string, who: string) {
    if (!confirm(`Desfazer o vínculo com ${who}?`)) return
    const { error } = await supabase!.from('coach_links').delete().eq('id', id)
    if (error) return alert(navigator.onLine ? error.message : 'Sem conexão.')
    await db.links.delete(id)
    await syncNow()
  }

  return (
    <Card className="space-y-3">
      <div className="font-bold">Treinador</div>
      {coaches.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-2">
          <span>{nameOf(l.coach_id)}</span>
          <Button size="sm" variant="ghost" onClick={() => unlink(l.id, nameOf(l.coach_id))}>Remover</Button>
        </div>
      ))}
      <p className="text-sm text-zinc-500">
        Um treinador pode montar e editar suas fichas e ver seus treinos. Ele precisa ter entrado no app pelo menos uma vez.
      </p>
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), void add())}>
        <Input type="email" placeholder="E-mail do treinador" value={mail} onChange={(e) => setMail(e.target.value)} />
        <Button variant="primary" disabled={busy}>Adicionar</Button>
      </form>
      {msg && <p className="text-sm">{msg}</p>}

      {trainees.length > 0 && (
        <>
          <div className="border-t border-zinc-200 pt-3 font-bold dark:border-zinc-800">Meus alunos</div>
          {trainees.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2">
              <span>{nameOf(l.trainee_id)}</span>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => onView(l.trainee_id)}>Ver ficha</Button>
                <Button size="sm" variant="ghost" onClick={() => unlink(l.id, nameOf(l.trainee_id))}>Remover</Button>
              </div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

function SyncSection() {
  const sync = useSyncState()
  const pending = usePendingCount()
  const label = {
    idle: 'Aguardando',
    syncing: 'Sincronizando…',
    ok: 'Tudo sincronizado',
    offline: 'Sem internet — os dados ficam salvos neste aparelho',
    error: 'Erro ao sincronizar',
    local: 'Modo local',
  }[sync.state]
  return (
    <Card className="space-y-2">
      <div className="font-bold">Sincronização</div>
      <div className="text-sm">
        {label}
        {pending > 0 && ` · ${pending} alteração(ões) pendente(s)`}
      </div>
      {sync.lastOk && <div className="text-xs text-zinc-500">Última sincronização: {new Date(sync.lastOk).toLocaleTimeString('pt-BR')}</div>}
      {sync.state === 'error' && <div className="text-xs text-red-600 dark:text-red-400">{sync.lastError}</div>}
      <Button size="sm" onClick={() => syncNow()}>Sincronizar agora</Button>
    </Card>
  )
}

function DeleteAccount() {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) return <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>Excluir minha conta</Button>
  return (
    <div className="space-y-2 rounded-xl bg-red-500/10 p-3">
      <p className="text-sm">Isso apaga <b>permanentemente</b> sua conta, fichas e histórico. Digite <b>EXCLUIR</b> para confirmar.</p>
      <Input value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={text !== 'EXCLUIR'}
          onClick={async () => {
            const { error } = await supabase!.rpc('delete_my_account')
            if (error) return alert(navigator.onLine ? error.message : 'Sem conexão.')
            await signOut()
          }}
        >
          Excluir
        </Button>
      </div>
    </div>
  )
}

async function exportData() {
  const [profiles, plans, sessions, exercises] = await Promise.all([
    db.profiles.toArray(), db.plans.toArray(), db.sessions.toArray(), db.exercises.toArray(),
  ])
  const live = <T extends { deleted: boolean }>(a: T[]) => a.filter((x) => !x.deleted)
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), profiles, plans: live(plans), sessions: live(sessions), exercises: live(exercises) }, null, 2)],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ficha-treino-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
