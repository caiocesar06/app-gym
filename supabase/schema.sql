-- =====================================================================
-- Ficha de Treino — esquema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode ser executado de novo sem problemas (é idempotente).
-- =====================================================================

-- ---------- Tabelas -------------------------------------------------

-- Perfil de cada usuário (criado automaticamente no primeiro login).
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null default '',
  name        text not null default '',
  notes       text not null default '',          -- restrições / observações
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(), -- relógio do cliente (resolve conflitos)
  synced_at   timestamptz not null default now(), -- relógio do servidor (cursor de sincronização)
  deleted     boolean not null default false
);

-- Vínculo treinador → aluno. Quem cria é o aluno (via função link_coach).
create table if not exists public.coach_links (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users on delete cascade,
  trainee_id  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  unique (coach_id, trainee_id),
  check (coach_id <> trainee_id)
);

-- Exercícios personalizados (o catálogo padrão fica no próprio app).
create table if not exists public.exercises (
  id          text primary key,
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  muscle      text not null default 'Outros',
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  deleted     boolean not null default false
);

-- Fichas. Os dias e slots ficam em "days" (JSON ordenado), o que mantém a
-- ordem da ficha e torna a sincronização offline simples e atômica.
create table if not exists public.plans (
  id          uuid primary key,
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null default 'Minha ficha',
  active      boolean not null default false,
  days        jsonb not null default '[]'::jsonb,
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  deleted     boolean not null default false
);

-- Treinos (em andamento ou finalizados). "entries" segue a ordem da ficha.
create table if not exists public.sessions (
  id          uuid primary key,
  owner_id    uuid not null references auth.users on delete cascade,
  plan_id     uuid,
  day_id      text,
  day_name    text not null default '',
  status      text not null default 'active' check (status in ('active', 'done')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  entries     jsonb not null default '[]'::jsonb,
  cardio      jsonb,
  notes       text not null default '',
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  deleted     boolean not null default false
);

create index if not exists exercises_sync_idx on public.exercises (synced_at);
create index if not exists plans_sync_idx     on public.plans (synced_at);
create index if not exists sessions_sync_idx  on public.sessions (synced_at);
create index if not exists profiles_sync_idx  on public.profiles (synced_at);
create index if not exists plans_owner_idx    on public.plans (owner_id);
create index if not exists sessions_owner_idx on public.sessions (owner_id);

-- ---------- Sincronização --------------------------------------------
-- synced_at sempre recebe a hora do servidor; e uma escrita mais antiga
-- (vinda de um aparelho que ficou offline) não sobrescreve uma mais nova.

create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- ignora a escrita desatualizada
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'exercises', 'plans', 'sessions'] loop
    execute format('drop trigger if exists touch_synced_at on public.%I', t);
    execute format('create trigger touch_synced_at before insert or update on public.%I
                    for each row execute function public.touch_synced_at()', t);
  end loop;
end $$;

-- Cria o perfil no primeiro login.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Permissões -----------------------------------------------

-- Eu sou treinador de "owner"?
create or replace function public.is_coach_of(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_links where coach_id = auth.uid() and trainee_id = owner)
$$;

-- Posso gerenciar dados de "owner"? (é meu, ou sou treinador dele)
create or replace function public.can_manage(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or public.is_coach_of(owner)
$$;

-- Tenho vínculo com "owner"? (eu, meu aluno ou meu treinador)
create or replace function public.is_linked(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (
    select 1 from coach_links
    where (coach_id = auth.uid() and trainee_id = owner)
       or (trainee_id = auth.uid() and coach_id = owner)
  )
$$;

-- Acesso pela API só para usuários logados (as linhas visíveis são filtradas pelas políticas abaixo).
revoke all on public.profiles, public.coach_links, public.exercises, public.plans, public.sessions from anon;
grant select, insert, update on public.profiles, public.exercises, public.plans, public.sessions to authenticated;
grant select, delete on public.coach_links to authenticated;

alter table public.profiles    enable row level security;
alter table public.coach_links enable row level security;
alter table public.exercises   enable row level security;
alter table public.plans       enable row level security;
alter table public.sessions    enable row level security;

-- profiles: vejo o meu e os de quem tem vínculo comigo; edito só o meu.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select using (public.is_linked(id));
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- coach_links: as duas pontas veem e podem desfazer; criação só via link_coach().
drop policy if exists links_select on public.coach_links;
drop policy if exists links_delete on public.coach_links;
create policy links_select on public.coach_links for select using (coach_id = auth.uid() or trainee_id = auth.uid());
create policy links_delete on public.coach_links for delete using (coach_id = auth.uid() or trainee_id = auth.uid());

-- exercises: visíveis entre pessoas vinculadas (o treinador cria, o aluno vê).
drop policy if exists exercises_select on public.exercises;
drop policy if exists exercises_insert on public.exercises;
drop policy if exists exercises_update on public.exercises;
create policy exercises_select on public.exercises for select using (public.is_linked(owner_id));
create policy exercises_insert on public.exercises for insert with check (owner_id = auth.uid());
create policy exercises_update on public.exercises for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- plans: dono e treinador do dono leem e editam.
drop policy if exists plans_select on public.plans;
drop policy if exists plans_insert on public.plans;
drop policy if exists plans_update on public.plans;
create policy plans_select on public.plans for select using (public.can_manage(owner_id));
create policy plans_insert on public.plans for insert with check (public.can_manage(owner_id));
create policy plans_update on public.plans for update using (public.can_manage(owner_id)) with check (public.can_manage(owner_id));

-- sessions: dono lê e escreve; treinador só lê.
drop policy if exists sessions_select on public.sessions;
drop policy if exists sessions_insert on public.sessions;
drop policy if exists sessions_update on public.sessions;
create policy sessions_select on public.sessions for select using (public.can_manage(owner_id));
create policy sessions_insert on public.sessions for insert with check (owner_id = auth.uid());
create policy sessions_update on public.sessions for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Funções chamadas pelo app --------------------------------

-- O aluno adiciona um treinador pelo e-mail (o treinador precisa já ter entrado no app uma vez).
create or replace function public.link_coach(coach_email text) returns text
language plpgsql security definer set search_path = public as $$
declare c profiles;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into c from profiles where lower(email) = lower(trim(coach_email)) limit 1;
  if c.id is null then
    raise exception 'Ninguém com esse e-mail entrou no app ainda.';
  end if;
  if c.id = auth.uid() then raise exception 'Você não pode ser seu próprio treinador.'; end if;
  insert into coach_links (coach_id, trainee_id) values (c.id, auth.uid())
  on conflict do nothing;
  return coalesce(nullif(c.name, ''), c.email);
end $$;

-- Exclui a conta e todos os dados do usuário (cascata).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- As políticas acima chamam estas funções com o papel do usuário logado.
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.can_manage(uuid) to authenticated;
grant execute on function public.is_linked(uuid) to authenticated;

revoke all on function public.link_coach(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.link_coach(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
