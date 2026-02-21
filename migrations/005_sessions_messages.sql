-- 005_sessions_messages.sql
-- Cria sessions/messages (UUID) para SaaS v2

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'geral',
  active_doc_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_created
  ON sessions (workspace_id, created_at DESC);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created
  ON messages (session_id, created_at ASC);

COMMIT;