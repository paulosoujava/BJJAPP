-- BJJ Arena · multi-academia (rodar DEPOIS de supabase.sql). Pode rodar de novo sem problema.
-- Não contém senhas. O usuário root é criado à parte (root-seed.sql.modelo).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.root_admin (
  id int primary key default 1 check (id = 1),
  email text not null,
  pass_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  cpf text not null,
  phone text not null,
  email text not null,
  value_cents int not null default 0 check (value_cents >= 0),
  due date not null,
  status text not null default 'liberado' check (status in ('liberado','bloqueado')),
  pass_hash text not null,
  must_change boolean not null default true,
  profile jsonb,
  profile_done boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists academies_email_idx on public.academies (lower(email));

create table if not exists public.sessions (
  token_hash text primary key,
  role text not null check (role in ('root','academy')),
  academy_id uuid references public.academies(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  k text primary key,
  fails int not null default 0,
  locked_until timestamptz
);

alter table public.events add column if not exists academy_id uuid references public.academies(id) on delete cascade;

alter table public.root_admin enable row level security;
alter table public.academies enable row level security;
alter table public.sessions enable row level security;
alter table public.login_attempts enable row level security;

-- ---------- ajudantes (não expostos) ----------
create or replace function public._today() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function public._cpf_ok(c text) returns boolean language plpgsql immutable as $$
declare d int[]; s int; i int; r int;
begin
  if c is null or c !~ '^[0-9]{11}$' or c ~ '^(.)\1{10}$' then return false; end if;
  for i in 1..11 loop d[i] := substr(c,i,1)::int; end loop;
  s := 0; for i in 1..9 loop s := s + d[i]*(11-i); end loop;
  r := (s*10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0; for i in 1..10 loop s := s + d[i]*(12-i); end loop;
  r := (s*10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end $$;

create or replace function public._sess(p_token text) returns public.sessions
language sql security definer set search_path = public, extensions as $$
  select * from public.sessions
  where token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex') and expires_at > now()
$$;

create or replace function public._need_root(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'root' then raise exception 'sem_permissao'; end if;
end $$;

create or replace function public._acad_json(a public.academies, p_full boolean) returns json
language sql stable set search_path = public as $$
  select (json_build_object(
    'id', a.id, 'name', a.name, 'owner_name', a.owner_name, 'phone', a.phone, 'email', a.email,
    'due', a.due, 'status', a.status,
    'effective', case when a.status = 'bloqueado' then 'bloqueado' when a.due < public._today() then 'bloqueado' else 'liberado' end,
    'reason', case when a.status = 'bloqueado' then 'manual' when a.due < public._today() then 'vencida' else null end,
    'must_change', a.must_change, 'profile', a.profile, 'profile_done', a.profile_done, 'created_at', a.created_at
  )::jsonb || case when p_full then jsonb_build_object('cpf', a.cpf, 'value_cents', a.value_cents) else '{}'::jsonb end)::json
$$;

create or replace function public._profile_ok(p jsonb) returns boolean language plpgsql immutable as $$
declare k text; n int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  if length(p::text) > 6000 then return false; end if;
  if coalesce(length(trim(p->>'instagram')),0) < 2 then return false; end if;
  if coalesce(length(regexp_replace(coalesce(p->>'phone',''),'\D','','g')),0) not between 10 and 13 then return false; end if;
  if coalesce(length(trim(p->>'address')),0) < 5 then return false; end if;
  if jsonb_typeof(p->'hours') <> 'object' then return false; end if;
  for k in select jsonb_object_keys(p->'hours') loop n := n + 1; end loop;
  return n >= 1;
end $$;

-- ---------- login ----------
create or replace function public.auth_login(p_email text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_k text := lower(trim(coalesce(p_email,''))); la public.login_attempts; ok boolean := false; r public.root_admin; a public.academies; tok text; role text; res json;
begin
  select * into la from public.login_attempts where k = v_k;
  if la.locked_until is not null and la.locked_until > now() then
    return json_build_object('ok', false, 'error', 'muitas_tentativas');
  end if;
  select * into r from public.root_admin where lower(email) = v_k;
  if found then
    ok := r.pass_hash = crypt(coalesce(p_password,''), r.pass_hash); role := 'root';
  else
    select * into a from public.academies where lower(email) = v_k;
    if found then ok := a.pass_hash = crypt(coalesce(p_password,''), a.pass_hash); role := 'academy'; end if;
  end if;
  if not ok then
    insert into public.login_attempts(k, fails) values (v_k, 1)
      on conflict (k) do update set fails = public.login_attempts.fails + 1;
    update public.login_attempts set fails = 0, locked_until = now() + interval '15 minutes'
      where k = v_k and fails >= 5;
    return json_build_object('ok', false, 'error', 'credenciais_invalidas');
  end if;
  delete from public.login_attempts where k = v_k;
  delete from public.sessions where expires_at < now();
  tok := encode(gen_random_bytes(32), 'hex');
  insert into public.sessions(token_hash, role, academy_id, expires_at)
    values (encode(digest(tok,'sha256'),'hex'), role, case when role = 'academy' then a.id end,
            now() + case when role = 'root' then interval '8 hours' else interval '30 days' end);
  if role = 'root' then
    return json_build_object('ok', true, 'token', tok, 'role', 'root', 'email', r.email);
  end if;
  return json_build_object('ok', true, 'token', tok, 'role', 'academy', 'academy', public._acad_json(a, false));
end $$;

create or replace function public.auth_me(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; a public.academies; r public.root_admin;
begin
  s := public._sess(p_token);
  if s.token_hash is null then return json_build_object('ok', false, 'error', 'sessao_invalida'); end if;
  if s.role = 'root' then
    select * into r from public.root_admin limit 1;
    return json_build_object('ok', true, 'role', 'root', 'email', r.email);
  end if;
  select * into a from public.academies where id = s.academy_id;
  if not found then return json_build_object('ok', false, 'error', 'sessao_invalida'); end if;
  return json_build_object('ok', true, 'role', 'academy', 'academy', public._acad_json(a, false));
end $$;

create or replace function public.auth_logout(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.sessions where token_hash = encode(digest(coalesce(p_token,''),'sha256'),'hex');
  return json_build_object('ok', true);
end $$;

create or replace function public.auth_change_password(p_token text, p_old text, p_new text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; ok boolean := false; a public.academies; r public.root_admin;
begin
  s := public._sess(p_token);
  if s.token_hash is null then raise exception 'sessao_invalida'; end if;
  if p_new is null or char_length(p_new) < 8 or char_length(p_new) > 72 then raise exception 'senha_curta'; end if;
  if s.role = 'root' then
    select * into r from public.root_admin limit 1;
    ok := r.pass_hash = crypt(coalesce(p_old,''), r.pass_hash);
    if not ok then raise exception 'senha_atual_errada'; end if;
    update public.root_admin set pass_hash = crypt(p_new, gen_salt('bf')), updated_at = now() where id = 1;
  else
    select * into a from public.academies where id = s.academy_id;
    ok := a.pass_hash = crypt(coalesce(p_old,''), a.pass_hash);
    if not ok then raise exception 'senha_atual_errada'; end if;
    update public.academies set pass_hash = crypt(p_new, gen_salt('bf')), must_change = false where id = a.id;
  end if;
  return json_build_object('ok', true);
end $$;

-- ---------- academia ----------
create or replace function public.academy_setup(p_token text, p_old text, p_new text, p_profile jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; a public.academies; res json;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  select * into a from public.academies where id = s.academy_id;
  if a.pass_hash <> crypt(coalesce(p_old,''), a.pass_hash) then raise exception 'senha_atual_errada'; end if;
  if p_new is null or char_length(p_new) < 8 or char_length(p_new) > 72 then raise exception 'senha_curta'; end if;
  if p_new = p_old then raise exception 'senha_igual'; end if;
  if not public._profile_ok(p_profile) then raise exception 'perfil_invalido'; end if;
  update public.academies set pass_hash = crypt(p_new, gen_salt('bf')), must_change = false, profile = p_profile, profile_done = true where id = a.id
    returning * into a;
  return json_build_object('ok', true, 'academy', public._acad_json(a, false));
end $$;

create or replace function public.academy_update_profile(p_token text, p_profile jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; a public.academies;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  if not public._profile_ok(p_profile) then raise exception 'perfil_invalido'; end if;
  update public.academies set profile = p_profile where id = s.academy_id returning * into a;
  return json_build_object('ok', true, 'academy', public._acad_json(a, false));
end $$;

-- ---------- root ----------
create or replace function public.root_list(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._need_root(p_token);
  return coalesce((select json_agg(public._acad_json(a, true) order by a.created_at desc) from public.academies a), '[]'::json);
end $$;

create or replace function public.root_create_academy(
  p_token text, p_name text, p_owner text, p_cpf text, p_phone text, p_email text, p_value_cents int, p_due date, p_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.academies; v_cpf text := regexp_replace(coalesce(p_cpf,''),'\D','','g'); v_ph text := regexp_replace(coalesce(p_phone,''),'\D','','g');
begin
  perform public._need_root(p_token);
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 80 then raise exception 'nome_invalido'; end if;
  if p_owner is null or char_length(trim(p_owner)) < 2 or char_length(p_owner) > 80 then raise exception 'responsavel_invalido'; end if;
  if not public._cpf_ok(v_cpf) then raise exception 'cpf_invalido'; end if;
  if char_length(v_ph) not between 10 and 13 then raise exception 'telefone_invalido'; end if;
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 120 then raise exception 'email_invalido'; end if;
  if p_value_cents is null or p_value_cents < 0 then raise exception 'valor_invalido'; end if;
  if p_due is null then raise exception 'vencimento_invalido'; end if;
  if p_pass is null or char_length(p_pass) < 8 then raise exception 'senha_curta'; end if;
  begin
    insert into public.academies(name, owner_name, cpf, phone, email, value_cents, due, pass_hash)
    values (regexp_replace(trim(p_name),'\s+',' ','g'), regexp_replace(trim(p_owner),'\s+',' ','g'), v_cpf, v_ph, lower(trim(p_email)), p_value_cents, p_due, crypt(p_pass, gen_salt('bf')))
    returning * into a;
  exception when unique_violation then raise exception 'email_ja_cadastrado'; end;
  return public._acad_json(a, true);
end $$;

create or replace function public.root_update_academy(
  p_token text, p_id uuid, p_name text, p_owner text, p_cpf text, p_phone text, p_email text, p_value_cents int, p_due date) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.academies; v_cpf text := regexp_replace(coalesce(p_cpf,''),'\D','','g'); v_ph text := regexp_replace(coalesce(p_phone,''),'\D','','g');
begin
  perform public._need_root(p_token);
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'nome_invalido'; end if;
  if p_owner is null or char_length(trim(p_owner)) < 2 then raise exception 'responsavel_invalido'; end if;
  if not public._cpf_ok(v_cpf) then raise exception 'cpf_invalido'; end if;
  if char_length(v_ph) not between 10 and 13 then raise exception 'telefone_invalido'; end if;
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalido'; end if;
  if p_value_cents is null or p_value_cents < 0 then raise exception 'valor_invalido'; end if;
  if p_due is null then raise exception 'vencimento_invalido'; end if;
  begin
    update public.academies set name = regexp_replace(trim(p_name),'\s+',' ','g'), owner_name = regexp_replace(trim(p_owner),'\s+',' ','g'),
      cpf = v_cpf, phone = v_ph, email = lower(trim(p_email)), value_cents = p_value_cents, due = p_due
      where id = p_id returning * into a;
  exception when unique_violation then raise exception 'email_ja_cadastrado'; end;
  if not found then raise exception 'nao_encontrada'; end if;
  return public._acad_json(a, true);
end $$;

create or replace function public.root_set_status(p_token text, p_id uuid, p_status text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.academies;
begin
  perform public._need_root(p_token);
  if p_status not in ('liberado','bloqueado') then raise exception 'status_invalido'; end if;
  update public.academies set status = p_status where id = p_id returning * into a;
  if not found then raise exception 'nao_encontrada'; end if;
  return public._acad_json(a, true);
end $$;

create or replace function public.root_reset_password(p_token text, p_id uuid, p_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.academies;
begin
  perform public._need_root(p_token);
  if p_pass is null or char_length(p_pass) < 8 then raise exception 'senha_curta'; end if;
  update public.academies set pass_hash = crypt(p_pass, gen_salt('bf')), must_change = true where id = p_id returning * into a;
  if not found then raise exception 'nao_encontrada'; end if;
  delete from public.sessions where academy_id = p_id;
  delete from public.login_attempts where k = lower(a.email);
  return public._acad_json(a, true);
end $$;

create or replace function public.root_delete_academy(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._need_root(p_token);
  delete from public.academies where id = p_id;
  return json_build_object('ok', true);
end $$;

-- ---------- eventos (inscrição online) agora pertencem a uma academia liberada ----------
drop function if exists public.create_event(text, date, text);
create or replace function public.create_event(p_token text, p_name text, p_date date, p_admin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare s public.sessions; a public.academies; v uuid;
begin
  s := public._sess(p_token);
  if s.token_hash is null or s.role <> 'academy' then raise exception 'sessao_invalida'; end if;
  select * into a from public.academies where id = s.academy_id;
  if a.status = 'bloqueado' or a.due < public._today() then raise exception 'academia_bloqueada'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'nome_invalido'; end if;
  if p_admin is null or char_length(p_admin) < 16 then raise exception 'token_invalido'; end if;
  insert into public.events(name, event_date, admin_hash, academy_id)
  values (left(trim(p_name),80), p_date, encode(digest(p_admin,'sha256'),'hex'), a.id) returning id into v;
  return v;
end $$;

revoke all on function public._today() from public, anon, authenticated;
revoke all on function public._cpf_ok(text) from public, anon, authenticated;
revoke all on function public._sess(text) from public, anon, authenticated;
revoke all on function public._need_root(text) from public, anon, authenticated;
revoke all on function public._acad_json(public.academies, boolean) from public, anon, authenticated;
revoke all on function public._profile_ok(jsonb) from public, anon, authenticated;

grant execute on function public.auth_login(text,text) to anon, authenticated;
grant execute on function public.auth_me(text) to anon, authenticated;
grant execute on function public.auth_logout(text) to anon, authenticated;
grant execute on function public.auth_change_password(text,text,text) to anon, authenticated;
grant execute on function public.academy_setup(text,text,text,jsonb) to anon, authenticated;
grant execute on function public.academy_update_profile(text,jsonb) to anon, authenticated;
grant execute on function public.root_list(text) to anon, authenticated;
grant execute on function public.root_create_academy(text,text,text,text,text,text,int,date,text) to anon, authenticated;
grant execute on function public.root_update_academy(text,uuid,text,text,text,text,text,int,date) to anon, authenticated;
grant execute on function public.root_set_status(text,uuid,text) to anon, authenticated;
grant execute on function public.root_reset_password(text,uuid,text) to anon, authenticated;
grant execute on function public.root_delete_academy(text,uuid) to anon, authenticated;
grant execute on function public.create_event(text,text,date,text) to anon, authenticated;
