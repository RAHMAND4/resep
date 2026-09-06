/**
 * app.js — Logika utama World Recipe (Vanilla JS, tidak memakai framework).
 * Mengatur: katalog resep, filter & pencarian, detail resep, favorit,
 * serta integrasi Asisten AI.
 */

import recipesData from '/data/recipes.json';
import { storage } from './storage.js';
import { checkAIStatus, chat, generateRecipe } from './ai-service.js';

/* ---------- Helpers DOM ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function halalLogoHTML(recipe) {
  if (typeof recipe.halal !== 'boolean') return '';
  if (recipe.halal) {
    return `
    <svg class="halal-logo is-halal" viewBox="0 0 132 48" role="img" aria-label="Masakan halal" title="Halal">
      <rect x="1" y="1" width="130" height="46" rx="23" fill="#0e7d49"/>
      <path d="M26 14 a10.5 10.5 0 1 0 0 20 a8.5 8.5 0 1 1 0 -20 z" fill="#fff"/>
      <path d="M43 19 45 23 49 24 45 25 43 29 41 25 37 24 41 23 Z" fill="#fff"/>
      <text x="86" y="30.5" text-anchor="middle" font-size="21" font-family="'Times New Roman', 'Traditional Arabic', Georgia, serif" font-weight="bold" fill="#fff">حلال</text>
    </svg>`;
  }
  return `
    <svg class="halal-logo is-non-halal" viewBox="0 0 132 48" role="img" aria-label="Masakan non halal" title="Non Halal">
      <rect x="1" y="1" width="130" height="46" rx="23" fill="#7a7370"/>
      <path d="M18 16.5 34 31.5" stroke="#ffb3ae" stroke-width="4" stroke-linecap="round"/>
      <path d="M34 16.5 18 31.5" stroke="#ffb3ae" stroke-width="4" stroke-linecap="round"/>
      <text x="83" y="29.5" text-anchor="middle" font-size="15" font-family="'Segoe UI', Arial, sans-serif" font-weight="700" fill="#fff" letter-spacing="0.5">NON HALAL</text>
    </svg>`;
}

function parseMinutes(str) {
  const match = String(str || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function totalMinutes(recipe) {
  return parseMinutes(recipe.prep_time) + parseMinutes(recipe.cook_time);
}

const isAIRecipe = (r) => String(r.id).startsWith('ai-');

const CATEGORY_GRADIENTS = {
  'Main Course': ['#ffe9d6', '#ffcfa8'],
  'Soup': ['#dcf1fb', '#aed8f3'],
  'Vegetarian': ['#dcf5e6', '#b0e6c8'],
  'Dessert': ['#fde5f2', '#f5c4e3'],
  'Street Food': ['#fff3c9', '#ffdf8a']
};

const DEFAULT_GRADIENT = ['#fdeee3', '#f8cfa8'];

function gradientFor(category) {
  return CATEGORY_GRADIENTS[category] || DEFAULT_GRADIENT;
}

/* ---------- State ---------- */
const state = {
  recipes: recipesData,
  filters: { search: '', origin: '', category: '', maxTime: '0', favOnly: false },
  view: 'home'
};

let toastTimer = null;

/* ---------- Toast ---------- */
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

/* ---------- Render: Kartu Resep ---------- */
function badgeHTML(recipe) {
  const [a] = gradientFor(recipe.category);
  return `
    <div class="card-visual" style="--card-a:${a}; --card-b:${gradientFor(recipe.category)[1]}">
      <span aria-hidden="true">${escapeHTML(recipe.emoji || '🍽️')}</span>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHTML(recipe.title)}</h3>
      <div class="card-meta">
        <span class="badge">${escapeHTML(recipe.origin || 'Dunia')}</span>
        <span class="badge badge-cat">${escapeHTML(recipe.category || 'Umum')}</span>
        <span class="badge badge-time">⏱ ${escapeHTML(recipe.prep_time || '')} +
          ${escapeHTML(recipe.cook_time || '')}</span>
      </div>
      ${halalLogoHTML(recipe)}
      <span class="badge badge-diff recipe-card-difficulty">${escapeHTML(recipe.difficulty || 'Tidak disebut')}</span>
    </div>`;
}

function cardHTML(recipe) {
  const fav = storage.isFavorite(recipe.id);
  const heart = fav ? '❤️' : '🤍';
  return `
    <article class="recipe-card" data-id="${escapeHTML(recipe.id)}" tabindex="0" role="button"
      aria-label="Lihat resep ${escapeHTML(recipe.title)}">
      <button class="btn-fav ${fav ? 'active' : ''}" data-fav="${escapeHTML(recipe.id)}"
        aria-label="Simpan ke favorit" type="button">${heart}</button>
      ${badgeHTML(recipe)}
    </article>`;
}

/* ---------- Render: Filter Opsi ---------- */
function populateFilters() {
  const origins = [...new Set(state.recipes.map((r) => r.origin))].sort();
  const categories = [...new Set(state.recipes.map((r) => r.category))].sort();

  const originSelect = $('#filter-origin');
  originSelect.innerHTML = `<option value="">Semua</option>` +
    origins.map((o) => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');

  const catSelect = $('#filter-category');
  catSelect.innerHTML = `<option value="">Semua</option>` +
    categories.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

/* ---------- Filter & Pencarian ---------- */
function getVisibleRecipes() {
  const { search, origin, category, maxTime, favOnly } = state.filters;
  const q = search.toLowerCase().trim();

  let list = state.recipes.filter((r) => {
    if (origin && r.origin !== origin) return false;
    if (category && r.category !== category) return false;
    if (maxTime !== '0' && totalMinutes(r) > parseInt(maxTime, 10)) return false;
    if (favOnly && !storage.isFavorite(r.id)) return false;
    if (q) {
      const haystack = [
        r.title,
        r.origin,
        r.category,
        r.difficulty,
        ...(r.ingredients || []),
        ...(r.instructions || [])
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (state.view === 'favorites' && !favOnly) {
    const favIds = new Set(storage.getFavoriteIds());
    const aiRecipes = storage.getAIRecipes().filter((r) => {
      if (q) {
        const haystack = [r.title, r.origin, r.category, ...(r.ingredients || [])]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return [...aiRecipes, ...list.filter((r) => favIds.has(r.id))];
  }

  return list;
}

function renderGrid() {
  const list = getVisibleRecipes();
  const grid = $('#recipe-grid');
  const empty = $('#empty-state');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    grid.innerHTML = list.map(cardHTML).join('');
  }

  const count = $('#result-count');
  const label =
    state.view === 'favorites'
      ? list.length === 0
        ? '0 favorit'
        : `${list.length} favorit`
      : `${list.length} resep`;
  count.textContent = label;
}

/* ---------- Render: Detail Resep ---------- */
function detailHTML(recipe) {
  const [a, b] = gradientFor(recipe.category);
  const fav = storage.isFavorite(recipe.id);
  const ai = isAIRecipe(recipe);
  return `
    <div class="detail-visual" style="background:linear-gradient(135deg, ${a}, ${b})">
      <span aria-hidden="true">${escapeHTML(recipe.emoji || '🍽️')}</span>
    </div>
    <div class="detail-body">
      <h2 class="detail-title" id="detail-title">${escapeHTML(recipe.title)}</h2>
      <div class="detail-meta">
        <span class="badge">${escapeHTML(recipe.origin || 'Dunia')}</span>
        <span class="badge badge-cat">${escapeHTML(recipe.category || 'Umum')}</span>
        <span class="badge badge-time">⏱ ${escapeHTML(recipe.prep_time || '')} +
          ${escapeHTML(recipe.cook_time || '')}</span>
        <span class="badge badge-diff">${escapeHTML(recipe.difficulty || 'Tidak disebut')}</span>
        ${recipe.servings ? `<span class="badge">${escapeHTML(recipe.servings)} porsi</span>` : ''}
        ${ai ? '<span class="badge">✨ Buatan AI</span>' : ''}
        ${halalLogoHTML(recipe)}
      </div>

      <h3 class="detail-heading">🧺 Bahan-bahan (${(recipe.ingredients || []).length})</h3>
      <ul class="ingredient-list">
        ${(recipe.ingredients || []).map((i) => `<li>${escapeHTML(i)}</li>`).join('')}
      </ul>

      <h3 class="detail-heading">👨‍🍳 Langkah Memasak</h3>
      <ol class="step-list">
        ${(recipe.instructions || []).map((s) => `<li>${escapeHTML(s)}</li>`).join('')}
      </ol>

      ${recipe.nutrition ? `
        <h3 class="detail-heading">⚖️ Informasi Nutrisi (per porsi)</h3>
        <ul class="ingredient-list">
          ${Object.entries(recipe.nutrition)
            .map(([k, v]) => `<li><strong>${escapeHTML(k)}:</strong> ${escapeHTML(v)}</li>`)
            .join('')}
        </ul>` : ''}

      <div class="detail-footer">
        <button class="btn btn-primary" id="detail-fav-btn" data-id="${escapeHTML(recipe.id)}">
          ${fav ? '💔 Hapus dari favorit' : '❤️ Simpan ke favorit'}
        </button>
        <button class="btn btn-ghost" data-open-ai="${escapeHTML(recipe.id)}">✨ Ubah resep dengan AI</button>
      </div>
    </div>`;
}

function openDetail(recipe) {
  if (!recipe) return;
  state.currentRecipe = recipe;
  $('#detail-content').innerHTML = detailHTML(recipe);
  $('#detail-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  const title = $('#detail-title');
  if (title) title.scrollIntoView({ block: 'nearest' });
}

function closeModal(id) {
  $(`#${id}`).hidden = true;
  if (!document.querySelector('.modal-backdrop:not([hidden])')) {
    document.body.style.overflow = '';
  }
}

/* ---------- Favorit ---------- */
function handleFavoriteToggle(id) {
  let recipe = state.recipes.find((r) => r.id === id);
  const isFavNow = storage.isFavorite(id);
  if (isFavNow) {
    storage.toggleFavorite(id);
    showToast('💔 Resep dihapus dari favorit.');
  } else {
    storage.toggleFavorite(id);
    showToast('❤️ Resep disimpan ke favorit!');
  }
  renderGrid();
  if (state.currentRecipe && state.currentRecipe.id === id && !$('#detail-modal').hidden) {
    $('#detail-content').innerHTML = detailHTML(state.currentRecipe);
  }
}

/* ---------- Navigasi ---------- */
function setView(view) {
  state.view = view;
  $('#nav-home').classList.toggle('active', view === 'home');
  $('#nav-fav').classList.toggle('active', view === 'favorites');
  if (view === 'favorites') {
    $('#filter-fav').checked = false;
    state.filters.favOnly = false;
    $('#filter-bar').scrollIntoView({ block: 'start' });
  }
  renderGrid();
}

/* ---------- Asisten AI ---------- */
let aiReady = false;

async function initAI() {
  const status = await checkAIStatus();
  const statusEl = $('#ai-status');
  if (status.aiConfigured) {
    aiReady = true;
    statusEl.textContent = `Terhubung ke Gemini (${status.model || 'model default'})`;
    statusEl.classList.add('ok');
  } else {
    aiReady = false;
    statusEl.textContent =
      'GEMINI_API_KEY belum diatur — salin .env.example menjadi .env.';
    statusEl.classList.add('err');
    $('#ai-input').disabled = true;
    $('#ai-send-btn').disabled = true;
  }
}

function openAI(prompt, context) {
  const modal = $('#ai-modal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $('#ai-input');

  if (prompt) {
    input.value = prompt;
    input.disabled = !aiReady;
    $('#ai-send-btn').disabled = !aiReady;
    $('#ai-conversation').querySelectorAll('.ai-msg-typing').forEach((n) => n.remove());
    if (aiReady) {
      setTimeout(() => submitAI(), 350);
    }
  } else if (context) {
    input.value = `Ubah resep "${context.title}" agar sesuai permintaan saya: `;
    input.focus();
  } else {
    input.value = '';
    input.focus();
  }
  input.focus();
}

async function submitAI() {
  const input = $('#ai-input');
  const prompt = input.value.trim();
  if (!prompt || $('#ai-send-btn').disabled) return;

  const context = state.currentRecipe && isAIRecipe(state.currentRecipe)
    ? null
    : state.currentRecipe || null;

  addChatMessage('user', prompt);
  input.value = '';
  input.style.height = 'auto';

  const typingEl = addTypingIndicator();
  try {
    const { recipe, rawText } = await generateRecipe(prompt, context);
    if (recipe) {
      addChatRecipe(recipe);
    } else {
      const txt = escapeHTML(rawText || '(Tidak ada respons)');
      addChatMessage('bot', txt, true);
    }
  } catch (err) {
    addChatMessage('bot', '❌ ' + escapeHTML(err.message), true);
  } finally {
    typingEl.remove();
  }
}

function addChatMessage(role, html, isHTML) {
  const conv = $('#ai-conversation');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${role}`;
  div.innerHTML = isHTML ? html : escapeHTML(html);
  conv.appendChild(div);
  conv.scrollTop = conv.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const conv = $('#ai-conversation');
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot ai-msg-typing';
  div.innerHTML = '<span class="ai-typing"><span></span><span></span><span></span></span>';
  conv.appendChild(div);
  conv.scrollTop = conv.scrollHeight;
  return div;
}

function addChatRecipe(recipe) {
  const conv = $('#ai-conversation');
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot';
  const total = totalMinutes(recipe);
  div.innerHTML = `
    <div class="ai-recipe-card">
      <h4>${escapeHTML(recipe.emoji || '🍽️')} ${escapeHTML(recipe.title || 'Resep AI')}</h4>
      <div class="card-meta">
        <span class="badge">${escapeHTML(recipe.origin || 'Dunia')}</span>
        <span class="badge badge-cat">${escapeHTML(recipe.category || 'Umum')}</span>
        <span class="badge badge-diff">${escapeHTML(recipe.difficulty || '')}</span>
        ${total ? `<span class="badge badge-time">⏱ Total ±${total} menit</span>` : ''}
      </div>
      <h5>🧺 Bahan</h5>
      <ul>${(recipe.ingredients || []).map((i) => `<li>${escapeHTML(i)}</li>`).join('')}</ul>
      <h5>👨‍🍳 Cara masak</h5>
      <ol>${(recipe.instructions || []).map((s) => `<li>${escapeHTML(s)}</li>`).join('')}</ol>
      <div class="detail-footer">
        <button class="btn btn-primary btn-save-ai" data-id="${escapeHTML(recipe.id)}">🔖 Simpan resep ini</button>
        <button class="btn btn-ghost" data-detail-ai="${escapeHTML(recipe.id)}">Lihat selengkapnya</button>
      </div>
    </div>`;
  conv.appendChild(div);
  conv.scrollTop = conv.scrollHeight;
}

function saveAIChatRecipe(id) {
  const card = document.querySelector(`.btn-save-ai[data-id="${id}"]`);
  if (!card) return;
  const container = card.closest('.ai-recipe-card');
  const text = container.querySelector('h4').textContent.replace(/^\S+\s/, '');
  const recipe = {
    id,
    title: text,
    origin: container.querySelector('.badge').textContent,
    category: container.querySelector('.badge-cat').textContent,
    difficulty: container.querySelector('.badge-diff').textContent,
    prep_time: '',
    cook_time: '',
    emoji: '✨',
    image: null,
    servings: '',
    ingredients: Array.from(container.querySelectorAll('ul li')).map((li) => li.textContent),
    instructions: Array.from(container.querySelectorAll('ol li')).map((li) => li.textContent)
  };
  storage.saveAIRecipe(recipe);
  storage.toggleFavorite(id);
  showToast('🔖 Resep AI disimpan ke favorit!');
}

/* ---------- Event Listeners ---------- */
function bindEvents() {
  $('#brand-link').addEventListener('click', (e) => {
    e.preventDefault();
    resetFilters();
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#nav-home').addEventListener('click', () => setView('home'));
  $('#nav-fav').addEventListener('click', () => setView('favorites'));

  $('#search-input').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderGrid();
  });

  $('#filter-origin').addEventListener('change', (e) => {
    state.filters.origin = e.target.value;
    renderGrid();
  });
  $('#filter-category').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderGrid();
  });
  $('#filter-time').addEventListener('change', (e) => {
    state.filters.maxTime = e.target.value;
    renderGrid();
  });
  $('#filter-fav').addEventListener('change', (e) => {
    state.filters.favOnly = e.target.checked;
    renderGrid();
  });

  const resetFilters = () => {
    state.filters = { search: '', origin: '', category: '', maxTime: '0', favOnly: false };
    $('#search-input').value = '';
    $('#filter-origin').value = '';
    $('#filter-category').value = '';
    $('#filter-time').value = '0';
    $('#filter-fav').checked = false;
  };

  $('#reset-filter-btn').addEventListener('click', () => {
    resetFilters();
    renderGrid();
  });
  $('#empty-reset-btn').addEventListener('click', () => {
    resetFilters();
    renderGrid();
  });

  $('#recipe-grid').addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.stopPropagation();
      handleFavoriteToggle(favBtn.dataset.fav);
      return;
    }
    const card = e.target.closest('[data-id]');
    if (card) {
      const recipe = state.recipes.find((r) => r.id === card.dataset.id);
      if (recipe) openDetail(recipe);
    }
  });

  $('#recipe-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-id]');
    if (card) {
      e.preventDefault();
      const recipe = state.recipes.find((r) => r.id === card.dataset.id);
      if (recipe) openDetail(recipe);
    }
  });

  $('#detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal('detail-modal');
  });
  $('#ai-modal').addEventListener('click', (e) => {
    if (e.target.id === 'ai-modal') closeModal('ai-modal');
  });

  $$('.modal-close').forEach((btn) =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('detail-modal');
      closeModal('ai-modal');
    }
  });

  $('#detail-content').addEventListener('click', (e) => {
    const favBtn = e.target.closest('#detail-fav-btn');
    if (favBtn) {
      handleFavoriteToggle(favBtn.dataset.id);
      return;
    }
    const aiBtn = e.target.closest('[data-open-ai]');
    if (aiBtn) {
      const recipe = state.currentRecipe;
      openAI('', recipe);
    }
  });

  $('#ai-conversation').addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.btn-save-ai');
    if (saveBtn) {
      saveAIChatRecipe(saveBtn.dataset.id);
      return;
    }
    const detailBtn = e.target.closest('[data-detail-ai]');
    if (detailBtn) {
      const id = detailBtn.dataset.detailAi;
      const recipe = storage.getAIRecipeById(id);
      if (recipe) openDetail(recipe);
    }
  });

  $('#ai-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitAI();
  });

  $('#ai-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  });

  $('#open-ai-btn').addEventListener('click', () => {
    openAI();
    if (!aiReady) initAI();
  });

  $('#search-ai-btn').addEventListener('click', () => {
    const q = $('#search-input').value.trim();
    if (q) {
      openAI(`Buatkan resep lengkap berdasarkan pencarian saya: "${q}".`);
    } else {
      openAI();
    }
    initAI();
  });

  $$('.chip').forEach((chip) =>
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      $('#search-input').value = chip.dataset.prompt;
      openAI(chip.dataset.prompt);
      initAI();
    })
  );
}

/* ---------- Init ---------- */
function init() {
  populateFilters();
  bindEvents();
  renderGrid();
  initAI();
}

init();