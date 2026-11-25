-- BJJ Arena · migração 003 (versão 1.9.0)
-- 1) Sessão única por academia: só um aparelho (web OU computador) por vez.
-- 2) Backup automático: versões anteriores do campeonato, com restauração.
-- 3) Registro de erros do aplicativo, visível no painel root.
-- Rodar depois de 001 e 002. Pode rodar de novo sem problema. Não contém senhas.

-- ---------- 1) sessão única ----------
alter table public.sessions add column if not exists device text;
alter table public.sessions add column if not exists last_seen timestamptz not null default now();
create index if not exists sessions_academy_idx on public.sessions(academy_id);

-- Chamada logo depois do login (e ao reabrir o app com sessão salva).
-- Se outro aparelho da mesma academia deu sinal de vida nos últimos 2 minutos, recusa e encerra esta sessão.
create or replace function public.session_claim(p_token text, p_device text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; o public.sessions;
begin
  s := public._sess(p_token);
  if s.token_hash is null then return json_build_object('ok', false, 'error', 'sessao_invalida'); end if;
  if s.role <> 'academy' then return json_build_object('ok', true); end if;
  select * into o from public.sessions
   where academy_id = s.academy_id and token_hash <> s.token_hash
     and expires_at > now() and last_seen > now() - interval '2 minutes'
   order by last_seen desc limit 1;
  if found then
    delete from public.sessions where token_hash = s.token_hash;
    return json_build_object('ok', false, 'error', 'sessao_em_uso', 'device', coalesce(o.device, ''), 'last_seen', o.last_seen);
  end if;
  delete from public.sessions where academy_id = s.academy_id and token_hash <> s.token_hash;
  update public.sessions set device = left(coalesce(p_device, ''), 20), last_seen = now() where token_hash = s.token_hash;
  return json_build_object('ok', true);
end $$;

-- Sinal de vida a cada minuto. Se a sessão foi encerrada (outro aparelho assumiu), avisa.
create or replace function public.session_ping(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions;
begin
  s := public._sess(p_token);
  if s.token_hash is null then return json_build_object('ok', false, 'error', 'sessao_encerrada'); end if;
  update public.sessions set last_seen = now() where token_hash = s.token_hash;
  return json_build_object('ok', true);
end $$;

-- ---------- 2) backup automático do campeonato ----------
create table if not exists public.academy_state_hist (
  id bigserial primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  rev bigint not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists academy_state_hist_idx on public.academy_state_hist(academy_id, id desc);
alter table public.academy_state_hist enable row level security;

-- Guarda a versão anterior: no máximo uma a cada 10 minutos, e sempre que o campeonato muda de nome
-- (novo campeonato, encerramento). Mantém as 40 mais recentes por academia.
create or replace function public._state_snapshot() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare last_at timestamptz;
begin
  if old.data is not distinct from new.data then return new; end if;
  select max(saved_at) into last_at from public.academy_state_hist where academy_id = old.academy_id;
  if not exists (select 1 from public.academy_state_hist where academy_id = old.academy_id and rev = old.rev)
     and (last_at is null or last_at < now() - interval '10 minutes'
     or coalesce(old.data #>> '{evento,nome}', '') <> coalesce(new.data #>> '{evento,nome}', '')) then
    insert into public.academy_state_hist(academy_id, rev, data) values (old.academy_id, old.rev, old.data);
    delete from public.academy_state_hist where academy_id = old.academy_id and id not in (
      select id from public.academy_state_hist where academy_id = old.academy_id order by id desc limit 40);
  end if;
  return new;
end $$;
drop trigger if exists academy_state_snapshot on public.academy_state;
create trigger academy_state_snapshot before update on public.academy_state
  for each row execute function public._state_snapshot();

create or replace function public.state_versions(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  return coalesce((select json_agg(x order by x.id desc) from (
    select h.id, h.rev, h.saved_at,
           coalesce(h.data #>> '{evento,nome}', '') as nome,
           case when jsonb_typeof(h.data->'fighters') = 'array' then jsonb_array_length(h.data->'fighters') else 0 end as atletas,
           case when jsonb_typeof(h.data->'brackets') = 'array' then jsonb_array_length(h.data->'brackets') else 0 end as chaves,
           case when jsonb_typeof(h.data->'history') = 'array' then jsonb_array_length(h.data->'history') else 0 end as historico
      from public.academy_state_hist h where h.academy_id = s.academy_id order by h.id desc limit 40) x), '[]'::json);
end $$;

-- Restaura uma versão. A versão atual vira backup antes (dá para desfazer).
create or replace function public.state_restore(p_token text, p_id bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; h public.academy_state_hist; v_rev bigint;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  select * into h from public.academy_state_hist where id = p_id and academy_id = s.academy_id;
  if not found then raise exception 'nao_encontrada'; end if;
  insert into public.academy_state_hist(academy_id, rev, data)
    select academy_id, rev, data from public.academy_state where academy_id = s.academy_id;
  update public.academy_state set data = h.data, rev = rev + 1, updated_at = now()
   where academy_id = s.academy_id returning rev into v_rev;
  if v_rev is null then
    insert into public.academy_state(academy_id, data, rev) values (s.academy_id, h.data, 1) returning rev into v_rev;
  end if;
  return json_build_object('ok', true, 'rev', v_rev, 'data', h.data, 'updated_at', now());
end $$;

-- ---------- 3) registro de erros ----------
create table if not exists public.app_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  academy_id uuid references public.academies(id) on delete set null,
  device text, version text, msg text, stack text, url text
);
create index if not exists app_errors_at_idx on public.app_errors(at desc);
alter table public.app_errors enable row level security;

create or replace function public.log_error(p_token text, p_device text, p_version text, p_msg text, p_stack text, p_url text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; v_acad uuid; n int;
begin
  s := public._sess(p_token);
  if s.token_hash is not null then v_acad := s.academy_id; end if;
  select count(*) into n from public.app_errors where at > now() - interval '1 minute' and academy_id is not distinct from v_acad;
  if n >= 20 then return json_build_object('ok', false); end if;
  insert into public.app_errors(academy_id, device, version, msg, stack, url)
    values (v_acad, left(p_device, 20), left(p_version, 20), left(p_msg, 500), left(p_stack, 3000), left(p_url, 300));
  delete from public.app_errors where at < now() - interval '90 days';
  return json_build_object('ok', true);
end $$;

create or replace function public.root_errors(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._need_root(p_token);
  return coalesce((select json_agg(x) from (
    select e.id, e.at, e.device, e.version, e.msg, e.stack, e.url, a.name as academia
      from public.app_errors e left join public.academies a on a.id = e.academy_id
     order by e.id desc limit 200) x), '[]'::json);
end $$;

revoke all on function public._state_snapshot() from public, anon, authenticated;
grant execute on function public.session_claim(text, text) to anon, authenticated;
grant execute on function public.session_ping(text) to anon, authenticated;
grant execute on function public.state_versions(text) to anon, authenticated;
grant execute on function public.state_restore(text, bigint) to anon, authenticated;
grant execute on function public.log_error(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.root_errors(text) to anon, authenticated;
