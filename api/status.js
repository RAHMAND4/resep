export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;

  res.status(200).json({
    aiConfigured: !!API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  });
}