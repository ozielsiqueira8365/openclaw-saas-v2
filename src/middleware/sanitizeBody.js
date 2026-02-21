// Middleware para sanitizar JSON malformado (PowerShell, curl manual, etc)
export function sanitizeBody(req, res, next) {
  // Só processa se for JSON
  if (!req.headers['content-type']?.includes('application/json')) {
    return next();
  }

  let data = '';

  req.on('data', chunk => {
    data += chunk;
  });

  req.on('end', () => {
    try {
      // Log para debug (remova em produção depois)
      console.log('[RAW BODY]', data.substring(0, 500));

      let cleaned = data.trim();

      // Remove BOM
      cleaned = cleaned.replace(/^\uFEFF/, '');

      // Se vier com aspas simples (erro PowerShell), converte para duplas
      // Mas só se não tiver aspas duplas já (para não quebrar JSON válido)
      if (cleaned.includes("'") && !cleaned.includes('"')) {
        cleaned = cleaned.replace(/'/g, '"');
      }

      // Remove trailing commas antes de } ou ]
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

      // Corrige undefined/null stringificado
      cleaned = cleaned.replace(/:undefined\b/g, ':null');
      cleaned = cleaned.replace(/:Undefined\b/g, ':null');

      // Se body estiver vazio
      if (!cleaned) {
        req.body = {};
        return next();
      }

      // Tenta parsear
      req.body = JSON.parse(cleaned);
      next();

    } catch (e) {
      console.error('[SANITIZE ERROR]', e.message);
      console.error('[RAW DATA]', data.substring(0, 200));
      
      return res.status(400).json({
        error: 'JSON_INVALID',
        message: 'Body não é um JSON válido',
        received: data.substring(0, 100),
        hint: 'Use aspas duplas. Exemplo: {"message":"teste"}'
      });
    }
  });

  req.on('error', (err) => {
    console.error('[BODY STREAM ERROR]', err);
    res.status(400).json({ error: 'BODY_READ_ERROR' });
  });
}