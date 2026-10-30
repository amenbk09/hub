-- =====================================================================
--  AmenHub — schéma Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run
--  Rôles : 'admin' (toi, accès à tout) / 'collab' (collègues, accès
--  uniquement aux idées Miadome). La sécurité est appliquée CÔTÉ
--  SERVEUR par les politiques RLS : même en bricolant le code de
--  l'appli, un collègue ne peut pas lire tes autres données.
-- =====================================================================

-- ---------- Profils & rôles ------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'collab' check (role in ('admin','collab')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Vrai si l'utilisateur connecté est admin (security definer pour éviter
-- la récursion RLS sur profiles).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Vrai si l'utilisateur connecté a un profil (admin ou collab invité).
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- Chacun lit son propre profil ; l'admin lit tous les profils.
drop policy if exists "profil: lecture" on public.profiles;
create policy "profil: lecture" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- Aucune politique insert/update/delete : impossible de s'auto-promouvoir
-- admin depuis l'appli. Les rôles se changent uniquement dans le SQL Editor.

-- Création automatique du profil (rôle 'collab') à chaque nouvel utilisateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'collab'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils pour les comptes déjà existants (si tu relances le script).
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------- Idées Miadome (note partagée) ----------------------------
create table if not exists public.ideas (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name    text,
  title          text not null check (char_length(title) between 1 and 200),
  description    text check (char_length(description) <= 4000),
  lieu           text check (char_length(lieu) <= 200),
  reference_url  text check (char_length(reference_url) <= 500),
  status         text not null default 'en_attente'
                 check (status in ('en_attente','validee','refusee','a_retravailler')),
  admin_comment  text check (char_length(admin_comment) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.ideas enable row level security;

-- Tous les membres (toi + collègues invités) voient toutes les idées.
drop policy if exists "idees: lecture membres" on public.ideas;
create policy "idees: lecture membres" on public.ideas
  for select to authenticated
  using (public.is_member());

-- Un membre propose une idée en son nom, toujours "en attente".
drop policy if exists "idees: proposer" on public.ideas;
create policy "idees: proposer" on public.ideas
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid() and status = 'en_attente');

-- L'admin modifie tout ; l'auteur modifie son idée tant qu'elle n'est
-- pas tranchée (en attente ou à retravailler).
drop policy if exists "idees: modifier" on public.ideas;
create policy "idees: modifier" on public.ideas
  for update to authenticated
  using (public.is_admin() or (author_id = auth.uid() and status in ('en_attente','a_retravailler')))
  with check (public.is_admin() or author_id = auth.uid());

-- L'admin supprime tout ; l'auteur supprime son idée encore en attente.
drop policy if exists "idees: supprimer" on public.ideas;
create policy "idees: supprimer" on public.ideas
  for delete to authenticated
  using (public.is_admin() or (author_id = auth.uid() and status = 'en_attente'));

-- Garde-fou : un collègue ne peut ni changer le statut, ni le commentaire
-- admin, ni l'auteur. S'il retravaille une idée, elle repasse "en attente".
create or replace function public.ideas_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id   := auth.uid();
    new.author_name := (select display_name from public.profiles where id = auth.uid());
    new.status      := 'en_attente';
    new.admin_comment := null;
  elsif not public.is_admin() then
    new.author_id     := old.author_id;
    new.author_name   := old.author_name;
    new.admin_comment := old.admin_comment;
    new.status := case when old.status = 'a_retravailler' then 'en_attente' else old.status end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ideas_guard on public.ideas;
create trigger ideas_guard
  before insert or update on public.ideas
  for each row execute function public.ideas_guard();

-- Mises à jour en temps réel des idées dans l'appli.
do $$ begin
  alter publication supabase_realtime add table public.ideas;
exception when duplicate_object then null; end $$;

-- ---------- Données privées de l'admin (tous les autres modules) -----
-- Une seule table générique : kind = 'rdv' | 'contenu' | 'client' |
-- 'devis' | 'tournage' | 'intervention' | 'flashcard', data = JSON.
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind ~ '^[a-z_]{2,30}$'),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_owner_kind on public.items (owner_id, kind);

alter table public.items enable row level security;

-- Réservé à l'admin, et uniquement à ses propres lignes.
drop policy if exists "items: admin seulement" on public.items;
create policy "items: admin seulement" on public.items
  for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- =====================================================================
--  APRÈS avoir créé ton compte (Authentication > Users > Add user),
--  passe-toi admin en remplaçant l'e-mail ci-dessous puis Run :
--
--  update public.profiles set role = 'admin', display_name = 'Amen'
--  where id = (select id from auth.users where email = 'TON_EMAIL@gmail.com');
--
--  Pour renommer un collègue (le nom qui s'affiche sur ses idées) :
--  update public.profiles set display_name = 'Prénom'
--  where id = (select id from auth.users where email = 'email_du_collegue');
-- =====================================================================
