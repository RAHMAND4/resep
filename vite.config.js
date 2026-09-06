import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_KEY = env.GEMINI_API_KEY || '';
  const MODEL = env.GEMINI_MODEL || 'gemini-2.0-flash';

  const aiProxyMiddleware = async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Method tidak diizinkan.' }));
    }

    if (!API_KEY || API_KEY.startsWith('GANTI_')) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(
        JSON.stringify({
          error: 'GEMINI_API_KEY belum diatur. Salin .env.example menjadi .env dan isi API key-nya.'
        })
      );
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let prompt = '';
    try {
      const payload = JSON.parse(body || '{}');
      prompt = String(payload.prompt || '').trim().slice(0, 8000);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Payload JSON tidak valid.' }));
    }
    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Prompt kosong.' }));
    }

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(MODEL) +
      ':generateContent';

    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            topP: 0.95
          }
        })
      });
      const data = await geminiRes.json();
      if (!geminiRes.ok) {
        const msg =
          (data && data.error && data.error.message) || 'Gemini API mengembalikan error.';
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: msg }));
      }
      const parts =
        (data &&
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts) ||
        [];
      const text = parts.map((p) => p.text || '').join('').trim();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ text }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(
        JSON.stringify({ error: 'Gagal terhubung ke Gemini API: ' + err.message })
      );
    }
  };

  return {
    plugins: [
      {
        name: 'gemini-ai-proxy',
        configureServer(server) {
          server.middlewares.use('/api/ai', (req, res, next) =>
            aiProxyMiddleware(req, res).catch((err) => {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: err.message }));
            })
          );
          server.middlewares.use('/api/status', (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                aiConfigured: !!API_KEY && !API_KEY.startsWith('GANTI_'),
                model: MODEL
              })
            );
          });
        }
      }
    ]
  };
});