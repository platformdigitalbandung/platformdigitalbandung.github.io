// Alamat backend API (portal rlm via cloudflared QUICK tunnel — SEMENTARA).
// URL trycloudflare berubah tiap tunnel restart; perbarui baris ini lalu push,
// atau override tanpa deploy: tautan "alamat backend" di footer (localStorage).
export const API_BASE =
  (localStorage.getItem('rlm_api_base') ||
   'https://expressed-madonna-dosage-interested.trycloudflare.com').replace(/\/+$/, '');

// WebSocket WhatsAuth — diturunkan dari API_BASE (http→ws, https→wss).
export const WHATSAUTH_WS_BASE = API_BASE.replace(/^http/, 'ws') + '/ws/whatsauth/public';

// Nomor WhatsApp bot Iteung — sudah dikonfirmasi.
export const WHATSAUTH_BOTNUMBER =
  localStorage.getItem('rlm_wa_botnumber') || '6282258512828';

// Kata kunci login WhatsAuth — MASIH PLACEHOLDER. Bot di atas belum pernah
// di-pairing (koleksi `profile` di Mongo masih kosong saat baris ini
// ditulis), jadi `qrkeyword` sebenarnya belum ada nilainya untuk dibaca.
// Begitu proses pairing dilakukan dan dokumen profile tercipta, ganti nilai
// di bawah ini persis seperti field `profile.qrkeyword`-nya (termasuk spasi
// di akhir bila ada — lihat GetUUID di helper/wa/hook.go, tidak ada TrimSpace).
export const WHATSAUTH_QRKEYWORD =
  localStorage.getItem('rlm_wa_qrkeyword') || 'login ';
