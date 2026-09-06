# 🍳 World Recipe — Web Resep Masakan Dunia Berbasis AI

Aplikasi web ringan (tanpa framework) untuk menjelajahi resep masakan dari seluruh
dunia, plus **Asisten AI** bertenaga **Google Gemini** untuk meracik resep kustom
berdasarkan bahan yang Anda miliki di dapur.

Dibangun dengan **HTML5 / CSS3 / JavaScript (Vanilla ES6+)** dan **Vite**, tanpa
database — data resep disimpan dalam file JSON, favorit disimpan di `localStorage`.

---

## ✨ Fitur

| Fitur | Keterangan |
| --- | --- |
| 📖 **Katalog Resep Dunia** | 12+ resep dari Jepang, Italia, Indonesia, Meksiko, India, Thailand, Timur Tengah, Korea, Spanyol, Perancis. Data dari `data/recipes.json`. |
| 🧭 **Filter & Pencarian** | Filter kawasan/negara, kategori (Vegetarian, Soup, Dessert, dll.), waktu masak maksimal, serta pencarian *real-time* berdasarkan nama, bahan, atau negara. |
| 🤖 **Asisten AI (Gemini)** | Tanya resep bebas, *pantry search* (dari bahan yang ada), dan modifikasi resep (contoh: "ubah jadi versi vegan"). Output AI terstruktur sebagai JSON. |
| 🔍 **Detail Resep** | Bahan + porsi, langkah memasak bertahap, estimasi waktu, tingkat kesulitan, dan info nutrisi (opsional dari AI). |
| ❤️ **Favorit / Bookmark** | Simpan resep (termasuk resep buatan AI) tanpa database — tersimpan di `localStorage` browser. |

---

## 🚀 Cara Menjalankan

### 1. Prasyarat
- **Node.js** ≥ 18 (direkomendasikan ≥ 20)

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi API Key (Gemini)
1. Buka [Google AI Studio](https://aistudio.google.com/apikeys) → **Create API key**.
2. Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` dan tempel kunci Anda:
   ```env
   GEMINI_API_KEY=AIzaSyPaste-Kunci-Asli-Anda
   GEMINI_MODEL=gemini-2.0-flash
   ```

> 🔒 **Keamanan:** File `.env` sudah masuk `.gitignore` sehingga **tidak pernah
> terunggah ke GitHub**. API key **hanya dibaca di sisi server** (Vite dev server
> melalui plugin proxy di `vite.config.js`) dan diteruskan
> `x-goog-api-key` ke Gemini — kunci **tidak pernah dikirim ke browser**.

### 4. Jalankan
```bash
npm run dev
```

Buka `http://localhost:5173` di browser.

### Perintah Lain
```bash
npm run build    # build produksi ke folder dist/
npm run preview  # pratinjau hasil build
```

> Catatan: endpoint proxy AI (`/api/ai`) tersedia pada mode pengembangan
> (`npm run dev`). Untuk produksi, deploy dengan server yang ikut mem-proxy
> endpoint tersebut (mis. Express/Vercel serverless).

---

## 📂 Struktur Proyek

```text
recipe-world-app/
├── index.html                 # Halaman utama (SPA)
├── vite.config.js             # Konfigurasi Vite + proxy AI server-side
├── package.json
├── .env.example               # Template variabel lingkungan
├── .env                       # API key (WAJIB dicek ke .gitignore)
├── .gitignore
├── README.md
├── assets/
│   ├── css/
│   │   └── style.css          # Styling responsif
│   └── js/
│       ├── app.js             # Logika utama UI, filter, detail, favorit
│       ├── ai-service.js      # Integrasi Gemini API (struktur prompt + parsing)
│       └── storage.js         # Penyimpanan localStorage (favorit & resep AI)
└── data/
    └── recipes.json           # Data resep statis (JSON)
```

---

## 🧠 Cara Kerja Asisten AI

1. Browser mengirim prompt ke endpoint lokal `/api/ai` (disediakan Vite dev server).
2. `vite.config.js` membaca `GEMINI_API_KEY` dari `.env` **di server**, lalu memanggil
   Google Gemini API (`:generateContent`) dengan `x-goog-api-key` di header.
3. Sistem *prompt* meminta Gemini menjawab dalam **format JSON** berisi
   `title, origin, category, prep_time, cook_time, difficulty, servings, emoji,
   ingredients[], instructions[], nutrition{}`.
4. Hasil diparse di browser dan dirender sebagai kartu resep rapi, yang bisa
   disimpan ke favorit.

Contoh prompt cepat:
- *"Buatkan resep masakan khas Italia dengan bahan utama ayam dan jamur"*
- *"Saya punya telur, bawang putih, dan kecap. Apa yang bisa saya masak?"*
- *"Ubah resep ini menjadi versi vegan"*

---

## 📄 Skema Data (`data/recipes.json`)

```json
[
  {
    "id": "rec-001",
    "title": "Ramen Tonkotsu",
    "origin": "Jepang",
    "category": "Main Course",
    "prep_time": "30 menit",
    "cook_time": "120 menit",
    "difficulty": "Sulit",
    "servings": 2,
    "emoji": "🍜",
    "image": null,
    "ingredients": ["200 g mie ramen", "1 liter kaldu pekat"],
    "instructions": ["Rebus kaldu hingga mendidih.", "Rebus mie al dente."]
  }
]
```

---

## ✍️ Menambahkan Resep Baru

Tambah objek baru ke array di `data/recipes.json`. File JSON mendukung **hot reload** —
perubahan langsung tampil di `npm run dev` tanpa restart.

---

## 🧩 Lisensi

MIT — silakan gunakan dan kembangkan. Kredit ramah: alat ini dibantu oleh
[Google Gemini](https://deepmind.google/technologies/gemini/).