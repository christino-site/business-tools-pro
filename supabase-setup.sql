-- Business Tools Pro — table des enregistrements utilisateurs
-- À exécuter une seule fois : Supabase > SQL Editor > New query > Run.
-- La sécurité (RLS) garantit que chaque utilisateur ne voit et ne modifie QUE ses propres lignes.

create table if not exists public.user_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool        text not null,
  title       text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_items_user_idx
  on public.user_items (user_id, created_at desc);

-- Met à jour updated_at à chaque modification
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_items_set_updated_at on public.user_items;
create trigger user_items_set_updated_at
  before update on public.user_items
  for each row execute function public.set_updated_at();

-- Sécurité au niveau des lignes
alter table public.user_items enable row level security;

drop policy if exists "user_items_select_own" on public.user_items;
create policy "user_items_select_own" on public.user_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_items_insert_own" on public.user_items;
create policy "user_items_insert_own" on public.user_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_items_update_own" on public.user_items;
create policy "user_items_update_own" on public.user_items
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_items_delete_own" on public.user_items;
create policy "user_items_delete_own" on public.user_items
  for delete to authenticated using (auth.uid() = user_id);
