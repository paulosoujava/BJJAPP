-- BJJ Arena · inscrição online (Supabase)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run.
-- Ninguém acessa as tabelas diretamente (RLS ligado, sem políticas):
-- tudo passa pelas funções abaixo.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  event_date date,
  admin_hash text not null,
  open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  team text not null,
  sex text not null check (sex in ('M','F')),
  born int not null,
  weight numeric(5,1) not null,
  belt text not null,
  phone text,
  imported boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists registrations_event_idx on public.registrations(event_id);
create unique index if not exists registrations_dup_idx on public.registrations(event_id, lower(name), born);

alter table public.events enable row level security;
alter table public.registrations enable row level security;

create or replace function public.create_event(p_name text, p_date date, p_admin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v uuid;
begin
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'nome_invalido'; end if;
  if p_admin is null or char_length(p_admin) < 16 then raise exception 'token_invalido'; end if;
  insert into events(name, event_date, admin_hash)
  values (left(trim(p_name),80), p_date, encode(digest(p_admin,'sha256'),'hex'))
  returning id into v;
  return v;
end $$;

create or replace function public.get_event(p_id uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object('name', name, 'date', event_date, 'open', open) from events where id = p_id;
$$;

create or replace function public.submit_registration(
  p_event uuid, p_name text, p_team text, p_sex text, p_born int, p_weight numeric, p_belt text, p_phone text)
returns json language plpgsql security definer set search_path = public as $$
declare ev events%rowtype; yr int := extract(year from now());
begin
  select * into ev from events where id = p_event;
  if not found then raise exception 'evento_inexistente'; end if;
  if not ev.open then raise exception 'inscricoes_encerradas'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 60 then raise exception 'nome_invalido'; end if;
  if p_team is null or char_length(trim(p_team)) < 2 or char_length(p_team) > 50 then raise exception 'equipe_invalida'; end if;
  if p_sex not in ('M','F') then raise exception 'sexo_invalido'; end if;
  if p_born is null or p_born < yr-100 or p_born > yr-3 then raise exception 'nascimento_invalido'; end if;
  if p_weight is null or p_weight < 15 or p_weight > 200 then raise exception 'peso_invalido'; end if;
  if p_belt is null or char_length(trim(p_belt)) < 3 or char_length(p_belt) > 24 then raise exception 'faixa_invalida'; end if;
  if (select count(*) from registrations where event_id = p_event) >= 3000 then raise exception 'limite_atingido'; end if;
  begin
    insert into registrations(event_id,name,team,sex,born,weight,belt,phone)
    values (p_event, regexp_replace(trim(p_name),'\s+',' ','g'), regexp_replace(trim(p_team),'\s+',' ','g'),
            p_sex, p_born, round(p_weight,1), lower(trim(p_belt)), nullif(left(trim(coalesce(p_phone,'')),20),''));
  exception when unique_violation then raise exception 'ja_inscrito'; end;
  return json_build_object('ok', true);
end $$;

create or replace function public._is_admin(p_event uuid, p_admin text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists(select 1 from events where id = p_event and admin_hash = encode(digest(coalesce(p_admin,''),'sha256'),'hex'));
$$;

create or replace function public.list_registrations(p_event uuid, p_admin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_event, p_admin) then raise exception 'sem_permissao'; end if;
  return coalesce((select json_agg(json_build_object('id',id,'name',name,'team',team,'sex',sex,'born',born,
            'weight',weight,'belt',belt,'phone',phone,'imported',imported,'at',created_at) order by created_at)
          from registrations where event_id = p_event), '[]'::json);
end $$;

create or replace function public.set_open(p_event uuid, p_admin text, p_open boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_event, p_admin) then raise exception 'sem_permissao'; end if;
  update events set open = p_open where id = p_event;
  return json_build_object('open', p_open);
end $$;

create or replace function public.mark_imported(p_event uuid, p_admin text, p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_event, p_admin) then raise exception 'sem_permissao'; end if;
  update registrations set imported = true where event_id = p_event and id = any(p_ids);
  return json_build_object('ok', true);
end $$;

revoke all on function public._is_admin(uuid,text) from public, anon, authenticated;
grant execute on function public.create_event(text,date,text) to anon, authenticated;
grant execute on function public.get_event(uuid) to anon, authenticated;
grant execute on function public.submit_registration(uuid,text,text,text,int,numeric,text,text) to anon, authenticated;
grant execute on function public.list_registrations(uuid,text) to anon, authenticated;
grant execute on function public.set_open(uuid,text,boolean) to anon, authenticated;
grant execute on function public.mark_imported(uuid,text,uuid[]) to anon, authenticated;
