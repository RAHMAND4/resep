/**
 * ai-service.js — Integrasi Google Gemini API.
 *
 * Browser TIDAK pernah memegang API Key. Semua permintaan diteruskan ke
 * endpoint lokal `/api/ai` yang disediakan Vite dev server (vite.config.js).
 * Di sana, key dibaca dari file `.env` secara server-side.
 */

const API_ENDPOINT = '/api/ai';
const STATUS_ENDPOINT = '/api/status';

export const SYSTEM_PROMPT = [
  'Kamu adalah seorang Chef Profesional tingkat dunia.',
  'Berikan resep masakan berdasarkan input pengguna dalam format JSON',
  'yang mencakup: title, origin, category, prep_time, cook_time, difficulty,',
  'servings, emoji, ingredients (array), instructions (array), dan nutrition (object opsional).',
  'Gunakan Bahasa Indonesia yang mudah dipahami.',
  'Jangan sertakan teks lain di luar objek JSON, tanpa fenced block markdown.'
].join(' ');

export async function checkAIStatus() {
  try {
    const res = await fetch(STATUS_ENDPOINT);
    if (!res.ok) return { aiConfigured: false, model: null, error: res.statusText };
    return { aiConfigured: true, model: null, ...(await res.json()) };
  } catch {
    return { aiConfigured: false, model: null, error: 'Server tidak terjangkau.' };
  }
}

async function callAI(prompt) {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Server mengembalikan error (${res.status}).`);
  }
  return String(data.text || '').trim();
}

export async function chat(prompt) {
  return callAI(prompt);
}

function buildRecipePrompt(userInput, context) {
  const parts = [SYSTEM_PROMPT];
  if (context) {
    parts.push(
      '\nBerikut resep yang sedang dilihat pengguna, sesuaikan sesuai permintaan:',
      JSON.stringify(context)
    );
  }
  parts.push('\nPermintaan pengguna:', userInput);
  return parts.join('\n');
}

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
}

function parseRecipeJSON(text) {
  let candidate = stripMarkdownFences(text);

  const braceStart = candidate.indexOf('{');
  const braceEnd = candidate.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    candidate = candidate.slice(braceStart, braceEnd + 1);
  }

  try {
    const obj = JSON.parse(candidate);
    if (obj && (obj.ingredients || obj.title)) return obj;
  } catch {
    /* lanjut ke fallback teks */
  }
  return null;
}

export async function generateRecipe(userInput, context) {
  const prompt = buildRecipePrompt(userInput, context);
  const text = await callAI(prompt);
  return { recipe: parseRecipeJSON(text), rawText: text };
}