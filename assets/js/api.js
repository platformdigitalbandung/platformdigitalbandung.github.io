import { API_BASE, WHATSAUTH_WS_BASE, WHATSAUTH_BOTNUMBER, WHATSAUTH_QRKEYWORD } from './config.js';

function authHeader() {
  const token = sessionStorage.getItem('rlm_dosen_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch { /* biarkan */ }
    throw new Error(detail);
  }
  return res.json();
}

export async function apiGet(path, { auth = false } = {}) {
  const res = await fetch(API_BASE + path, { headers: auth ? authHeader() : {} });
  return handle(res);
}

export async function apiPostJson(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function apiPostForm(path, formData) {
  const res = await fetch(API_BASE + path, { method: 'POST', body: formData });
  return handle(res);
}

// --- Masuk sebagai Dosen: satu-satunya jalur adalah WhatsAuth (lihat
// pdb/README.md bagian Frontend, "Otorisasi di web wajib WhatsAuth") ---

// Membuka websocket WhatsAuth, menghasilkan tautan wa.me untuk discan/diklik, dan
// mengembalikan Promise yang selesai begitu token diterima lewat socket tsb.
export function loginDosenWhatsAuth() {
  const uuid = crypto.randomUUID();
  const waLink = 'https://wa.me/' + WHATSAUTH_BOTNUMBER +
    '?text=' + encodeURIComponent(WHATSAUTH_QRKEYWORD + uuid);

  let sock;
  const waitForToken = () => new Promise((resolve, reject) => {
    sock = new WebSocket(WHATSAUTH_WS_BASE);
    sock.onopen = () => sock.send(uuid);
    sock.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.login) {
          sessionStorage.setItem('rlm_dosen_token', data.login);
          resolve(data.login);
          sock.close();
        }
      } catch { /* abaikan frame yang bukan JSON login */ }
    };
    sock.onerror = () => reject(new Error('Koneksi WhatsAuth gagal, coba lagi.'));
    sock.onclose = (ev) => { if (ev.code !== 1000) reject(new Error('Sesi WhatsAuth berakhir, coba lagi.')); };
  });

  return { waLink, waitForToken, cancel: () => sock && sock.close() };
}

export function logoutDosen() {
  sessionStorage.removeItem('rlm_dosen_token');
}

export function isDosen() {
  return Boolean(sessionStorage.getItem('rlm_dosen_token'));
}
