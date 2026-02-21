-- 005_fix_uuid_ids.sql
-- Corrige sessions.id e messages.session_id para UUID
-- (porque o SaaS v2 usa crypto.randomUUID())

BEGIN;

-- garante extensão uuid (se não tiver)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) sessions.id -> uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sessions' AND column_name='id'
      AND data_type IN ('bigint','integer')
  ) THEN
    -- cria coluna nova
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id_uuid uuid;

    -- tenta migrar valores existentes se forem uuid em texto (caso raro)
    -- se não der, gera uuid novo
    UPDATE sessions
    SET id_uuid = COALESCE(
      NULLIF(id::text, '')::uuid,
      gen_random_uuid()
    )
    WHERE id_uuid IS NULL;

    -- troca PK
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
    ALTER TABLE sessions DROP COLUMN id;
    ALTER TABLE sessions RENAME COLUMN id_uuid TO id;
    ALTER TABLE sessions ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 2) messages.session_id -> uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='session_id'
      AND data_type IN ('bigint','integer')
  ) THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS session_id_uuid uuid;

    -- tenta mapear usando sessions (se messages.session_id era FK numérico)
    UPDATE messages m
    SET session_id_uuid = s.id
    FROM sessions s
    WHERE m.session_id_uuid IS NULL;

    -- se ainda ficou nulo, gera uuid (não ideal, mas evita travar)
    UPDATE messages
    SET session_id_uuid = COALESCE(session_id_uuid, gen_random_uuid())
    WHERE session_id_uuid IS NULL;

    ALTER TABLE messages DROP COLUMN session_id;
    ALTER TABLE messages RENAME COLUMN session_id_uuid TO session_id;
  END IF;
END $$;

-- 3) garante constraints/índices básicos
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_session_id_fkey;

ALTER TABLE messages
  ADD CONSTRAINT messages_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_session_created
  ON messages(session_id, created_at);

COMMIT;