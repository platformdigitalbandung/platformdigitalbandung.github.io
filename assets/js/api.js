import { getJSON, postJSON, postFile } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/api.min.js';
import { getCookie, deleteCookie, setCookieWithExpireHour } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/cookie.min.js';
import { redirect } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/url.min.js';
import { API_BASE } from './config.js';

// Konvensi wa.my.id: token PASETO ada di cookie `login` (diisi halaman /login/),
// alamat halaman asal disimpan di cookie `login_redirect`.
const COOKIE_TOKEN = 'login';
const COOKIE_KEMBALI = 'login_redirect';
const PESAN_TIDAK_TERJANGKAU = 'Backend tidak terjangkau, coba lagi.';

// getJSON/postJSON crootjs selalu memanggil callback: status 0 berarti jaringan
// gagal atau timeout, data null berarti balasan bukan JSON.
function menurutStatus(resolve, reject) {
  return ({ status, data }) => {
    if (status >= 200 && status < 300) resolve(data);
    else if (status === 0) reject(new Error(PESAN_TIDAK_TERJANGKAU));
    else reject(new Error((data && data.detail) || `HTTP ${status}`));
  };
}

function headerToken() {
  const token = getCookie(COOKIE_TOKEN);
  return token ? ['Authorization', 'Bearer ' + token] : [null, null];
}

export function apiGet(path, { auth = false } = {}) {
  const [nama, nilai] = auth ? headerToken() : [null, null];
  return new Promise((resolve, reject) =>
    getJSON(API_BASE + path, menurutStatus(resolve, reject), nama, nilai));
}

export function apiPostJson(path, body) {
  const [nama, nilai] = headerToken();
  return new Promise((resolve, reject) =>
    postJSON(API_BASE + path, body, menurutStatus(resolve, reject), nama, nilai));
}

// postFile crootjs hanya mengirim satu field berkas dari elemen input, jadi field
// teks dikirim lewat query string (backend membaca keduanya lewat c.FormValue).
// Callback-nya menerima JSON balasan, atau null kalau jaringan gagal, timeout,
// atau balasan bukan JSON.
export function apiPostBerkas(path, fields, inputId, namaField) {
  const url = API_BASE + path + '?' + new URLSearchParams(fields);
  return new Promise((resolve, reject) =>
    postFile(url, inputId, namaField, (data) => {
      if (data === null) reject(new Error(PESAN_TIDAK_TERJANGKAU));
      else if (data.detail) reject(new Error(data.detail));
      else resolve(data);
    }));
}

export function isLoggedIn() {
  return Boolean(getCookie(COOKIE_TOKEN));
}

export function logout() {
  deleteCookie(COOKIE_TOKEN);
}

// Form login hanya ada di /login/ (pdb/README.md bagian Frontend). Alamat asal
// disimpan di cookie, bukan query string, karena auth.js crootjs memakai query
// string untuk alur magic link.
export function arahkanKeLogin() {
  setCookieWithExpireHour(COOKIE_KEMBALI, location.pathname + location.search, 1);
  redirect('/login/');
}
