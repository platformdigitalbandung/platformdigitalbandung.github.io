import { getJSON, postJSON, postFile } from 'https://cdn.jsdelivr.net/gh/jscroot/lib@0.2.8/api.min.js';
import { getCookie, deleteCookie, setCookieWithExpireHour } from 'https://cdn.jsdelivr.net/gh/jscroot/lib@0.2.8/cookie.min.js';
import { redirect } from 'https://cdn.jsdelivr.net/gh/jscroot/lib@0.2.8/url.min.js';
import { API_BASE } from './config.js';

// Konvensi wa.my.id: token PASETO ada di cookie `login` (diisi halaman /login/),
// alamat halaman asal disimpan di cookie `login_redirect`.
const COOKIE_TOKEN = 'login';
const COOKIE_KEMBALI = 'login_redirect';
const BATAS_WAKTU_MS = 15000;
const BATAS_WAKTU_UNGGAH_MS = 120000;

// crootjs tidak memanggil callback kalau jaringan gagal atau balasan bukan JSON
// (hanya console.log), jadi tiap panggilan diberi batas waktu supaya halaman
// tidak menunggu selamanya.
function tunggu(panggil, batasMs = BATAS_WAKTU_MS) {
  return new Promise((resolve, reject) => {
    const batas = setTimeout(() => reject(new Error('Backend tidak merespons, coba lagi.')), batasMs);
    panggil((err, data) => {
      clearTimeout(batas);
      if (err) reject(err); else resolve(data);
    });
  });
}

function menurutStatus(selesai) {
  return ({ status, data }) => {
    if (status >= 200 && status < 300) selesai(null, data);
    else selesai(new Error((data && data.detail) || `HTTP ${status}`));
  };
}

function headerToken() {
  const token = getCookie(COOKIE_TOKEN);
  return token ? ['Authorization', 'Bearer ' + token] : [null, null];
}

export function apiGet(path, { auth = false } = {}) {
  const [nama, nilai] = auth ? headerToken() : [null, null];
  return tunggu((selesai) => getJSON(API_BASE + path, menurutStatus(selesai), nama, nilai));
}

export function apiPostJson(path, body) {
  const [nama, nilai] = headerToken();
  return tunggu((selesai) => postJSON(API_BASE + path, body, menurutStatus(selesai), nama, nilai));
}

// postFile crootjs hanya mengirim satu field berkas dari elemen input, jadi field
// teks dikirim lewat query string — backend membaca keduanya lewat c.FormValue.
export function apiPostBerkas(path, fields, inputId, namaField) {
  const url = API_BASE + path + '?' + new URLSearchParams(fields);
  return tunggu((selesai) => postFile(url, inputId, namaField, (data) =>
    (data && data.detail ? selesai(new Error(data.detail)) : selesai(null, data))), BATAS_WAKTU_UNGGAH_MS);
}

export function isLoggedIn() {
  return Boolean(getCookie(COOKIE_TOKEN));
}

export function logout() {
  deleteCookie(COOKIE_TOKEN);
}

// Form login hanya ada di /login/ (pdb/README.md bagian Frontend). Alamat asal
// disimpan di cookie, bukan query string, karena whatsauth/js memakai query
// string untuk alur magic link.
export function arahkanKeLogin() {
  setCookieWithExpireHour(COOKIE_KEMBALI, location.pathname + location.search, 1);
  redirect('/login/');
}
