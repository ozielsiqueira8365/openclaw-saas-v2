-- 001_init.sql (core SaaS, compatível com banco existente)

create extension if not exists pgcrypto;

-- USERS (compatível)
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- WORKSPACES (TENANT)
create table if not exists workspaces (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  plan text not null default 'free',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- WORKSPACE MEMBERS
create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- API KEYS
create table if not exists api_keys (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text,
  prefix text not null,
  key_hash text not null,
  last4 text not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(prefix)
);
create index if not exists api_keys_workspace_id_idx on api_keys(workspace_id);

-- RATE LIMIT
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
create index if not exists rate_limits_window_idx on rate_limits(window_start);

-- LOGS (mínimo)
create table if not exists llm_logs (
  id bigserial primary key,
  workspace_id text,
  api_key_id text,
  request_id text,
  route text,
  provider text,
  model text,
  status text,
  latency_ms int,
  input_tokens int,
  output_tokens int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);