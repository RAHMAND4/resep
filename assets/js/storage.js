/**
 * storage.js — Penyimpanan lokal (localStorage) untuk favorit & resep AI.
 * Tidak membutuhkan database; semua disimpan di browser pengguna.
 */

const FAV_KEY = 'worldrecipe:favorites';
const AI_KEY = 'worldrecipe:ai-recipes';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getFavorites() {
    return readJSON(FAV_KEY, []);
  },

  isFavorite(id) {
    return this.getFavorites().includes(id);
  },

  toggleFavorite(id) {
    const favs = this.getFavorites();
    const idx = favs.indexOf(id);
    if (idx === -1) {
      favs.push(id);
    } else {
      favs.splice(idx, 1);
    }
    return writeJSON(FAV_KEY, favs) && favs;
  },

  getFavoriteIds() {
    return this.getFavorites();
  },

  getAIRecipes() {
    return readJSON(AI_KEY, []);
  },

  getAIRecipeById(id) {
    return this.getAIRecipes().find((r) => r.id === id) || null;
  },

  saveAIRecipe(recipe) {
    const recipes = this.getAIRecipes();
    recipes.unshift(recipe);
    const trimmed = recipes.slice(0, 30);
    return writeJSON(AI_KEY, trimmed) && trimmed;
  },

  isAIFavorite(id) {
    return this.getAIRecipes().some((r) => r.id === id);
  },

  toggleAIRecipe(recipe) {
    const recipes = this.getAIRecipes();
    const idx = recipes.findIndex((r) => r.id === recipe.id);
    if (idx === -1) {
      recipes.unshift(recipe);
    } else {
      recipes.splice(idx, 1);
    }
    return writeJSON(AI_KEY, recipes) && recipes;
  }
};