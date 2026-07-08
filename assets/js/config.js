// Alamat backend API (portal rlm via cloudflared tunnel).
// Bisa dioverride tanpa deploy ulang: localStorage.setItem('rlm_api_base', 'https://...')
// atau lewat tautan "alamat backend" di footer tiap halaman.
export const API_BASE =
  (localStorage.getItem('rlm_api_base') || 'https://rlm.digitalbdg.ac.id').replace(/\/+$/, '');
