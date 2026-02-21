-- Adiciona campos de segurança à api_keys
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON api_keys(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at);

-- Tabela de uso diário (para rate limit e billing)
CREATE TABLE IF NOT EXISTS workspace_usage (
    id SERIAL PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    requests_count INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    UNIQUE(workspace_id, date)
);

CREATE INDEX IF NOT EXISTS idx_workspace_usage_lookup ON workspace_usage(workspace_id, date);

-- Atualiza tabela messages se não existir
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    api_key_id INTEGER REFERENCES api_keys(id),
    prompt TEXT,
    response TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at);