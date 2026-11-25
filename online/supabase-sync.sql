-- BJJ Arena · sincronização do campeonato entre web e desktop (rodar DEPOIS de supabase-multi.sql).
-- Pode rodar de novo sem problema. Não contém senhas.

create table if not exists public.academy_state (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  data jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.academy_state enable row level security;

create or replace function public.state_get(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; st public.academy_state;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  select * into st from public.academy_state where academy_id = s.academy_id;
  if not found then return json_build_object('ok', true, 'rev', 0); end if;
  return json_build_object('ok', true, 'rev', st.rev, 'data', st.data, 'updated_at', st.updated_at);
end $$;

create or replace function public.state_put(p_token text, p_data jsonb, p_rev bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; a public.academies; st public.academy_state; v_rev bigint;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  select * into a from public.academies where id = s.academy_id;
  if a.status = 'bloqueado' or a.due < public._today() then raise exception 'academia_bloqueada'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'dados_invalidos'; end if;
  if octet_length(p_data::text) > 4000000 then raise exception 'dados_grandes'; end if;
  select * into st from public.academy_state where academy_id = s.academy_id for update;
  if not found then
    insert into public.academy_state(academy_id, data, rev) values (s.academy_id, p_data, 1) returning rev into v_rev;
    return json_build_object('ok', true, 'rev', v_rev, 'updated_at', now());
  end if;
  if st.rev <> coalesce(p_rev, 0) then
    return json_build_object('ok', false, 'conflict', true, 'rev', st.rev, 'data', st.data, 'updated_at', st.updated_at);
  end if;
  update public.academy_state set data = p_data, rev = st.rev + 1, updated_at = now()
    where academy_id = s.academy_id returning rev into v_rev;
  return json_build_object('ok', true, 'rev', v_rev, 'updated_at', now());
end $$;

grant execute on function public.state_get(text) to anon, authenticated;
grant execute on function public.state_put(text, jsonb, bigint) to anon, authenticated;
