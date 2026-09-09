// Alamat backend API (portal rlm via cloudflared QUICK tunnel — SEMENTARA).
// URL trycloudflare berubah tiap tunnel restart; perbarui baris ini lalu push,
// atau override tanpa deploy: tautan "alamat backend" di footer (localStorage).
export const API_BASE =
  (localStorage.getItem('rlm_api_base') ||
   'https://expressed-madonna-dosage-interested.trycloudflare.com').replace(/\/+$/, '');

// WebSocket WhatsAuth — diturunkan dari API_BASE (http→ws, https→wss).
export const WHATSAUTH_WS_BASE = API_BASE.replace(/^http/, 'ws') + '/ws/whatsauth/public';

// Nomor WhatsApp bot Iteung (angka saja, format 62...) dan kata kunci login-nya
// (persis seperti tersimpan di field `profile.qrkeyword` bot tsb, termasuk spasi
// di akhir bila ada — lihat catatan "manual steps" di plan). Placeholder sampai
// dikonfirmasi operasional; override cepat tanpa deploy via localStorage.
export const WHATSAUTH_BOTNUMBER =
  localStorage.getItem('rlm_wa_botnumber') || '628000000000';
export const WHATSAUTH_QRKEYWORD =
  localStorage.getItem('rlm_wa_qrkeyword') || 'login ';
