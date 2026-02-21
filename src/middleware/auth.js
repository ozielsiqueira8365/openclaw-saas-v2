import { pool } from '../db/pool.js';
import crypto from 'crypto';

export function requireBearer(req, res, next) {
  const auth = req.headers['authorization'];
  
  if (!auth) {
    return res.status(401).json({ error: 'MISSING_AUTH', message: 'Header Authorization necessário' });
  }

  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'INVALID_AUTH_FORMAT', message: 'Use: Bearer oc_live_...' });
  }

  req.apiKey = auth.slice(7).trim();
  next();
}

export async function authFromApiKey(req, res, next) {
  try {
    const fullKey = req.apiKey;
    
    if (!fullKey.startsWith('oc_live_')) {
      return res.status(401).json({ error: 'INVALID_KEY_FORMAT', message: 'Key deve começar com oc_live_' });
    }

    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const result = await pool.query(
      `SELECT ak.*, w.name as workspace_name, w.plan as workspace_plan 
       FROM api_keys ak 
       JOIN workspaces w ON ak.workspace_id = w.id 
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_KEY', message: 'API key não encontrada ou revogada' });
    }

    const keyData = result.rows[0];
    
    // Atualiza last_used_at
    await pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyData.id]
    );

    req.workspace = {
      id: keyData.workspace_id,
      name: keyData.workspace_name,
      plan: keyData.workspace_plan
    };
    
    req.apiKeyData = keyData;
    next();

  } catch (err) {
    console.error('[AUTH ERROR]', err);
    res.status(500).json({ error: 'AUTH_ERROR', message: err.message });
  }
}