import express from 'express';
import { sanitizeBody } from './middleware/sanitizeBody.js';
import { requireBearer, authFromApiKey } from './middleware/auth.js';
import { chatHandler } from './llm/llmClient.js';
import { pool } from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware de sanitização de JSON (substitui express.json())
app.use(sanitizeBody);

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({
      ok: true,
      port: PORT,
      db: 'postgres',
      dbTime: dbResult.rows[0].now,
      llm: {
        baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        model: process.env.NVIDIA_MODEL || 'moonshotai/kimi-k2.5'
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'DB_ERROR', message: err.message });
  }
});

// Ping routes
app.get('/__ping', (req, res) => res.send('pong'));
app.post('/__ping', (req, res) => res.json({ ok: true, body: req.body }));

// Chat endpoint com auth
app.post('/v1/chat', requireBearer, authFromApiKey, chatHandler);

// Error handler global
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SaaS v2 online na porta ${PORT}`);
});