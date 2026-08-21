create extension if not exists vector;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  site_url text not null,
  access_key text not null unique,
  starter_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  url text not null,
  title text not null default '',
  fetched_at timestamptz not null default now(),
  char_count int not null default 0,
  unique (lead_id, url)
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  ord int not null,
  text text not null,
  embedding vector(768) not null
);

create table if not exists ask_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  session_id text not null,
  question text not null,
  had_answer boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_lead_idx on chunks (lead_id);
create index if not exists ask_log_session_idx on ask_log (lead_id, session_id);

-- RLS без политик: прямой доступ закрыт для всех, включая publishable-ключ.
alter table leads enable row level security;
alter table pages enable row level security;
alter table chunks enable row level security;
alter table ask_log enable row level security;

-- Единственная дверь: RPC принимают access_key страницы, а не lead_id.

create or replace function get_lead_page(p_access_key text)
returns table (name text, site_url text, starter_questions jsonb)
language sql security definer set search_path = public stable as $$
  select l.name, l.site_url, l.starter_questions
  from leads l where l.access_key = p_access_key;
$$;

create or replace function match_chunks(p_access_key text, p_embedding vector(768), p_k int)
returns table (text text, url text, similarity double precision)
language sql security definer set search_path = public stable as $$
  select c.text, p.url, 1 - (c.embedding <=> p_embedding) as similarity
  from chunks c
  join leads l on l.id = c.lead_id
  join pages p on p.id = c.page_id
  where l.access_key = p_access_key
  order by c.embedding <=> p_embedding
  limit greatest(1, least(p_k, 20));
$$;

create or replace function session_count(p_access_key text, p_session text)
returns int
language sql security definer set search_path = public stable as $$
  select coalesce(count(*), 0)::int from ask_log a
  join leads l on l.id = a.lead_id
  where l.access_key = p_access_key and a.session_id = p_session;
$$;

create or replace function log_question(
  p_access_key text, p_session text, p_q text, p_had_answer boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  select id into v_lead from leads where access_key = p_access_key;
  if v_lead is null then return; end if;
  insert into ask_log (lead_id, session_id, question, had_answer)
  values (v_lead, p_session, left(p_q, 500), p_had_answer);
end $$;

-- Публичной роли доступны только эти четыре функции и ничего больше.
revoke all on function get_lead_page(text) from public;
revoke all on function match_chunks(text, vector, int) from public;
revoke all on function session_count(text, text) from public;
revoke all on function log_question(text, text, text, boolean) from public;
grant execute on function get_lead_page(text) to anon;
grant execute on function match_chunks(text, vector, int) to anon;
grant execute on function session_count(text, text) to anon;
grant execute on function log_question(text, text, text, boolean) to anon;

-- Пишущие функции. Публичной роли НЕ выдаются: доступны только секретному ключу.
create or replace function upsert_lead(p_slug text, p_name text, p_site_url text)
returns table (id uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select l.id into v_id from leads l where l.slug = p_slug;
  if v_id is null then
    insert into leads (slug, name, site_url, access_key)
    values (p_slug, p_name, p_site_url, encode(gen_random_bytes(24), 'hex'))
    returning leads.id into v_id;
  else
    update leads set name = p_name, site_url = p_site_url where leads.id = v_id;
    delete from chunks where lead_id = v_id;  -- переиндексация: чанки заменяются целиком
  end if;
  return query select v_id;
end $$;

create or replace function upsert_page(p_lead_id uuid, p_url text, p_title text, p_char_count int)
returns table (id uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into pages (lead_id, url, title, char_count)
  values (p_lead_id, p_url, p_title, p_char_count)
  on conflict (lead_id, url) do update set title = excluded.title, char_count = excluded.char_count, fetched_at = now()
  returning pages.id into v_id;
  return query select v_id;
end $$;

revoke all on function upsert_lead(text, text, text) from public, anon;
revoke all on function upsert_page(uuid, text, text, int) from public, anon;

create or replace function set_starters(p_slug text, p_questions jsonb)
returns table (access_key text)
language sql security definer set search_path = public as $$
  update leads set starter_questions = p_questions where slug = p_slug
  returning leads.access_key;
$$;

revoke all on function set_starters(text, jsonb) from public, anon;
