// Alamat backend (origin saja, TANPA /api) — TETAP, tidak boleh bisa diganti
// dari sisi pengguna (mengizinkan itu membuka jalur phishing: halaman ini
// bisa diarahkan diam-diam ke backend lain lalu mencuri token WhatsAuth).
// Sebelumnya menunjuk ke tunnel trycloudflare.com sementara yang sudah mati
// (DNS tidak lagi resolve) — diperbaiki ke backend produksi asli.
//
// PENTING: setiap pemanggil (apiGet/apiPostJson/apiPostBerkas di api.js) sudah
// menyertakan awalan "/api/..." sendiri di argumen path-nya (kecuali
// "/health", yang memang rute akar, bukan di bawah /api) — jadi API_BASE di
// sini TIDAK boleh diberi akhiran "/api", atau semua panggilan selain health
// akan berakhir memanggil ".../api/api/..." dan gagal 404.
export const API_BASE = 'https://apk.fly.dev';

// Konfigurasi WhatsAuth (nomor bot, kata kunci, websocket) sengaja TIDAK ada
// di sini: form login hanya satu, di repo login (/login/).
