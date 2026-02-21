create table if not exists tasks (
  id text primary key,
  user_id text not null,
  parent_id text,
  title text,
  description text,
  task_type text not null default 'llm',
  status text not null default 'queued',
  priority int not null default 50,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_status_runat_idx on tasks(status, run_at);