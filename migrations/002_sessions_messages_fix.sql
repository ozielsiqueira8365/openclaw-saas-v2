-- 002_sessions_messages_fix.sql
-- Ajusta schema existente sem quebrar, e só cria se não existir.

create extension if not exists pgcrypto;

-- SESSIONS: cria se não existir (TEXT id)
create table if not exists sessions (
  id text primary key default gen_random_uuid()::text,
  workspace_id text,
  title text,
  mode text default 'default',
  created_at timestamptz not null default now()
);

-- Se já existe, garante colunas mínimas
alter table sessions add column if not exists workspace_id text;
alter table sessions add column if not exists title text;
alter table sessions add column if not exists mode text;
alter table sessions add column if not exists created_at timestamptz;

-- default created_at se estiver nulo (não falha se não houver linhas)
update sessions set created_at = now() where created_at is null;

-- FK só se workspaces existe e se o tipo é compatível (TEXT)
-- (não dá pra usar IF NOT EXISTS em constraint, então tentamos de forma segura)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name='workspaces') then
    begin
      alter table sessions
        add constraint sessions_workspace_id_fkey
        foreign key (workspace_id) references workspaces(id) on delete cascade;
    exception when duplicate_object then
      -- constraint já existe
      null;
    end;
  end if;
end $$;

create index if not exists sessions_workspace_id_idx on sessions(workspace_id);

-- MESSAGES: cria se não existir (TEXT id + session_id)
create table if not exists messages (
  id text primary key default gen_random_uuid()::text,
  session_id text,
  role text,
  content text,
  created_at timestamptz not null default now()
);

-- Se já existe, garante colunas mínimas
alter table messages add column if not exists session_id text;
alter table messages add column if not exists role text;
alter table messages add column if not exists content text;
alter table messages add column if not exists created_at timestamptz;

update messages set created_at = now() where created_at is null;

-- FK session_id -> sessions(id) (seguro)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name='sessions') then
    begin
      alter table messages
        add constraint messages_session_id_fkey
        foreign key (session_id) references sessions(id) on delete cascade;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

create index if not exists messages_session_id_idx on messages(session_id);