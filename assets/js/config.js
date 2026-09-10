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

// Kata kunci login WhatsAuth — sama dengan konvensi bawaan platform ini
// (config.QRKeyword di apkflydev), disimpan sebagai `user.waqrkeyword` di
// Mongo untuk nomor bot di atas.
export const WHATSAUTH_QRKEYWORD =
  localStorage.getItem('rlm_wa_qrkeyword') || 'wh4t5auth0';
