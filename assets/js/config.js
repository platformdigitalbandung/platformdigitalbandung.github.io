// Alamat backend (origin saja, TANPA /api) — TETAP, tidak boleh bisa diganti
// dari sisi pengguna (mengizinkan itu membuka jalur phishing: halaman ini
// bisa diarahkan diam-diam ke backend lain lalu mencuri token WhatsAuth).
// Sebelumnya menunjuk ke tunnel trycloudflare.com sementara yang sudah mati
// (DNS tidak lagi resolve) — diperbaiki ke backend produksi asli.
//
// PENTING: setiap pemanggil (apiGet/apiPostJson/apiPostForm di api.js) sudah
// menyertakan awalan "/api/..." sendiri di argumen path-nya (kecuali
// "/health", yang memang rute akar, bukan di bawah /api) — jadi API_BASE di
// sini TIDAK boleh diberi akhiran "/api", atau semua panggilan selain health
// akan berakhir memanggil ".../api/api/..." dan gagal 404.
export const API_BASE = 'https://apk.fly.dev';

// WebSocket WhatsAuth — rute akar, bukan di bawah /api (lihat apkflydev
// url/url.go: `page.Get("/ws/whatsauth/public", ...)`).
export const WHATSAUTH_WS_BASE = API_BASE.replace(/^http/, 'ws') + '/ws/whatsauth/public';

// Nomor WhatsApp bot Iteung — sudah dikonfirmasi.
export const WHATSAUTH_BOTNUMBER = '6282258512828';

// Kata kunci login WhatsAuth — HARUS sama persis dengan `user.waqrkeyword` di
// Mongo untuk nomor bot di atas. Sebelumnya 'wh4t5auth0' (tanpa @), tidak
// cocok dengan nilai sungguhan di database — WhatsAuth tidak pernah berhasil
// selama itu (lihat docs/produk/temuan-terbuka.md, T11).
export const WHATSAUTH_QRKEYWORD = 'wh4t5@uth0';
