-- Banco online para o Bolão da Copa
-- Cole este arquivo no Supabase: SQL Editor > New query > Run.

create table if not exists public.participants (
  id text primary key,
  name text not null,
  contact text default '',
  paid boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.matches (
  id text primary key,
  phase text not null default 'Grupo',
  match_date date not null,
  home text not null,
  away text not null,
  home_score integer,
  away_score integer,
  created_at timestamptz default now()
);

create table if not exists public.predictions (
  participant_id text not null references public.participants(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  home_score integer not null,
  away_score integer not null,
  updated_at timestamptz default now(),
  primary key (participant_id, match_id)
);

create table if not exists public.settings (
  id integer primary key default 1,
  exact integer not null default 5,
  outcome integer not null default 3,
  goal integer not null default 1,
  constraint settings_single_row check (id = 1)
);

insert into public.settings (id, exact, outcome, goal)
values (1, 5, 3, 1)
on conflict (id) do nothing;

alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.settings enable row level security;

drop policy if exists "public read participants" on public.participants;
drop policy if exists "public insert participants" on public.participants;
drop policy if exists "public update participants" on public.participants;
drop policy if exists "public delete participants" on public.participants;

drop policy if exists "public read matches" on public.matches;
drop policy if exists "public insert matches" on public.matches;
drop policy if exists "public update matches" on public.matches;
drop policy if exists "public delete matches" on public.matches;

drop policy if exists "public read predictions" on public.predictions;
drop policy if exists "public insert predictions" on public.predictions;
drop policy if exists "public update predictions" on public.predictions;
drop policy if exists "public delete predictions" on public.predictions;

drop policy if exists "public read settings" on public.settings;
drop policy if exists "public insert settings" on public.settings;
drop policy if exists "public update settings" on public.settings;
drop policy if exists "public delete settings" on public.settings;

-- Versão simples para GitHub Pages: todos podem ler e escrever.
-- Funciona rápido, mas não é ideal para bolões públicos grandes.
-- Depois, recomendo criar login de administrador e links individuais por participante.

create policy "public read participants" on public.participants
for select to anon using (true);

create policy "public insert participants" on public.participants
for insert to anon with check (true);

create policy "public update participants" on public.participants
for update to anon using (true) with check (true);

create policy "public delete participants" on public.participants
for delete to anon using (true);


create policy "public read matches" on public.matches
for select to anon using (true);

create policy "public insert matches" on public.matches
for insert to anon with check (true);

create policy "public update matches" on public.matches
for update to anon using (true) with check (true);

create policy "public delete matches" on public.matches
for delete to anon using (true);


create policy "public read predictions" on public.predictions
for select to anon using (true);

create policy "public insert predictions" on public.predictions
for insert to anon with check (true);

create policy "public update predictions" on public.predictions
for update to anon using (true) with check (true);

create policy "public delete predictions" on public.predictions
for delete to anon using (true);


create policy "public read settings" on public.settings
for select to anon using (true);

create policy "public insert settings" on public.settings
for insert to anon with check (true);

create policy "public update settings" on public.settings
for update to anon using (true) with check (true);

create policy "public delete settings" on public.settings
for delete to anon using (true);


-- Ativa as tabelas na publicação do Realtime.
do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.predictions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.settings;
exception when duplicate_object then null;
end $$;
