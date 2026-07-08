// Alamat backend API (portal rlm via cloudflared QUICK tunnel — SEMENTARA).
// URL trycloudflare berubah tiap tunnel restart; perbarui baris ini lalu push,
// atau override tanpa deploy: tautan "alamat backend" di footer (localStorage).
export const API_BASE =
  (localStorage.getItem('rlm_api_base') ||
   'https://expressed-madonna-dosage-interested.trycloudflare.com').replace(/\/+$/, '');
