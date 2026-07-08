import { API_BASE } from './config.js';

function authHeader() {
  const cred = sessionStorage.getItem('rlm_dosen_cred');
  return cred ? { Authorization: `Basic ${cred}` } : {};
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

export function loginDosen(password) {
  sessionStorage.setItem('rlm_dosen_cred', btoa(`dosen:${password}`));
  return apiGet('/api/dosen/ping', { auth: true });
}

export function logoutDosen() {
  sessionStorage.removeItem('rlm_dosen_cred');
}

export function isDosen() {
  return Boolean(sessionStorage.getItem('rlm_dosen_cred'));
}

export function gantiAlamatBackend() {
  const sekarang = localStorage.getItem('rlm_api_base') || '';
  const baru = prompt('Alamat backend API (kosongkan untuk default):', sekarang);
  if (baru === null) return;
  if (baru.trim()) localStorage.setItem('rlm_api_base', baru.trim());
  else localStorage.removeItem('rlm_api_base');
  location.reload();
}
