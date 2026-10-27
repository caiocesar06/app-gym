import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge, Button, Card, Empty, Page, Sheet } from '../components/ui'
import { blankDay, TEMPLATES, type Template } from '../data/templates'
import { useAuth } from '../lib/auth'
import { usePlans } from '../lib/hooks'
import { save, uid } from '../lib/repo'

export default function Plans() {
  const { me, viewing } = useAuth()
  const plans = usePlans(viewing)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  async function create(t: Template | null) {
    const id = uid()
    await save('plans', {
      id,
      owner_id: viewing,
      name: t?.name ?? 'Minha ficha',
      active: !plans?.some((p) => p.active),
      days: t ? t.build() : [blankDay('Treino A')],
      updated_by: me,
      updated_at: '',
      deleted: false,
    })
    setOpen(false)
    nav(`/fichas/${id}`)
  }

  return (
    <Page title="Fichas" actions={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>+ Nova</Button>}>
      {plans?.length === 0 && (
        <Empty>
          <p className="mb-3">Nenhuma ficha ainda. Comece de um modelo ou do zero.</p>
          <Button variant="primary" onClick={() => setOpen(true)}>Criar ficha</Button>
        </Empty>
      )}
      {plans?.map((p) => (
        <Card key={p.id} onClick={() => nav(`/fichas/${p.id}`)}>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-lg font-bold">{p.name}</div>
            {p.active && <Badge tone="emerald">ativa</Badge>}
          </div>
          <div className="mt-1 text-sm text-zinc-500">{p.days.map((d) => d.name).join(' · ') || 'Sem dias'}</div>
        </Card>
      ))}

      <Sheet open={open} onClose={() => setOpen(false)} title="Nova ficha">
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id} onClick={() => create(t)}>
              <div className="font-bold">{t.name}</div>
              <div className="mt-0.5 text-sm text-zinc-500">{t.description}</div>
            </Card>
          ))}
          <Card onClick={() => create(null)}>
            <div className="font-bold">Em branco</div>
            <div className="mt-0.5 text-sm text-zinc-500">Monte do zero, exercício por exercício.</div>
          </Card>
          <p className="pt-1 text-center text-xs text-zinc-500">Tudo pode ser editado depois.</p>
        </div>
      </Sheet>
    </Page>
  )
}
