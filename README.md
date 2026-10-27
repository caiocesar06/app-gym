# Ficha de Treino

App de treino para celular e PC: cada pessoa monta a própria ficha, registra os treinos
(inclusive sem internet na academia) e acompanha a evolução. Um **treinador** pode montar e
acompanhar a ficha de um aluno.

## Funcionalidades

- **Fichas** com dias (rotação ou avulsos), exercícios com **opções de troca**, séries × repetições,
  marcação de **pesado** e **descanso alvo** (padrão 2:00 nos pesados e 1:30 nos demais). Modelos prontos.
- **Treino**: sugere o próximo dia da rotação, mostra a última vez de cada exercício e sugere subir a carga
  quando você bate o topo da faixa de repetições. ✓ conclui a série e inicia o **cronômetro de descanso**
  com o alvo automático (som e vibração). O descanso é registrado à mão (1:00 a 3:00) ou pelo botão “Usar”.
- **Aquecimento** (série “A”) fica fora das médias e da progressão.
- **Cardio** e observações por treino.
- **Histórico** editável e excluível, na ordem da ficha.
- **Progresso**: 1RM estimado, carga máxima e volume por exercício, e treinos por semana.
- **Treinador/aluno**: o aluno adiciona o treinador pelo e-mail; o treinador edita as fichas e vê os treinos do aluno.
- **Offline**: tudo é salvo primeiro no aparelho (IndexedDB) e sincroniza quando a internet volta.
- **PWA**: dá para instalar na tela inicial do celular.

## Arquitetura

| Parte | Tecnologia |
|---|---|
| Interface | React + TypeScript + Vite + Tailwind CSS |
| Offline / PWA | Service worker (vite-plugin-pwa) + IndexedDB (Dexie) |
| Backend | Supabase: login por e-mail e senha, Postgres com Row Level Security |
| Hospedagem | GitHub Pages (deploy automático pelo GitHub Actions) |

```
src/
  lib/db.ts        tipos e banco local (IndexedDB)
  lib/sync.ts      sincronização: outbox → upsert; pull incremental por synced_at
  lib/repo.ts      save / mutate / remove (sempre locais primeiro)
  lib/auth.tsx     login, "vendo como" (eu ou aluno), entrada offline
  lib/workout.ts   regras: próximo dia, última vez, sugestão de carga, 1RM
  data/            catálogo de exercícios e modelos de ficha
  pages/           telas
supabase/schema.sql  tabelas, políticas de acesso e funções
```

**Por que fichas e treinos são JSON dentro do Postgres?** Cada ficha e cada treino é salvo como uma
linha só (os dias, exercícios e séries ficam num campo JSON, em ordem). Assim a sincronização
offline é atômica e simples, a ordem da ficha é preservada naturalmente e conflitos se resolvem
por “a edição mais recente vence” (o servidor ignora gravações mais antigas que a atual).

## Configuração (uma vez só)

### 1. Supabase
1. Crie uma conta e um projeto em <https://supabase.com> (plano grátis).
2. **SQL Editor** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Providers → Email**: deixe **Enable Email provider** ligado, desligue **Confirm email** e salve (assim o login por e-mail e senha funciona na hora, sem precisar enviar e-mail nem configurar SMTP).
4. **Project Settings → API**: copie a *Project URL* e a chave *anon public*.

> O plano grátis pausa projetos sem uso por ~7 dias. Com uso semanal isso não acontece; se pausar,
> é só reativar no painel.

### 2. Rodar no PC
```bash
npm install
cp .env.example .env   # preencha com a URL e a chave anon
npm run dev
```
Sem o `.env`, o app roda em **modo local** (sem login, dados só no navegador). Isso é útil para testar.

### 3. Publicar (GitHub Pages)
1. Crie um repositório no GitHub e envie este código (`git push`).
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: crie `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`. A chave *anon* é pública por natureza: quem protege os dados são as políticas do banco.
4. Cada `git push` na `main` publica automaticamente em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

### 4. Vincular treinador
1. O treinador entra no app uma vez.
2. O aluno vai em **Perfil → Treinador**, digita o e-mail do treinador e toca em **Adicionar**.
3. No app do treinador aparece o seletor **“Vendo: Eu / Aluno”** no topo.
