import { getJSON, postJSON, putJSON, deleteJSON, postFile, postFileJSON } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/api.min.js';
import { getCookie, deleteCookie, setCookieWithExpireHour } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/cookie.min.js';
// url.js (bukan url.min.js): sejak ±2026-09-11 jsDelivr menyajikan balasan
// GitHub "429: Too Many Requests" sebagai isi url.min.js@0.0.10 — peramban
// gagal mengurainya dan SELURUH modul yang mengimpor api.js ikut batal. Purge
// cache jsDelivr (2026-09-14) belum memulihkannya karena jsDelivr sendiri masih
// dibatasi GitHub. url.js di tag yang sama utuh, dan crootjs sendiri memakainya
// (auth.min.js mengimpor "./url.js"). Kembalikan ke url.min.js kalau
//   curl -s https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/url.min.js | head -c 20
// sudah berisi kode JavaScript, bukan "429".
import { redirect } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/url.js';
import { API_BASE } from './config.js';

// Konvensi wa.my.id: token PASETO ada di cookie `login` (diisi halaman /login/),
// alamat halaman asal disimpan di cookie `login_redirect`.
const COOKIE_TOKEN = 'login';
const COOKIE_KEMBALI = 'login_redirect';
const PESAN_TIDAK_TERJANGKAU = 'Backend tidak terjangkau, coba lagi.';

// getJSON/postJSON crootjs selalu memanggil callback: status 0 berarti jaringan
// gagal atau timeout, data null berarti balasan bukan JSON.
// Galat membawa `status` HTTP-nya (0 = jaringan gagal) supaya pemanggil bisa
// membedakan, mis., 422 "masih dirujuk" dari 404 "tidak ada" tanpa mencocokkan
// teks pesan. Pemanggil lama yang hanya membaca err.message tidak terpengaruh.
function galat(pesan, status) {
  const e = new Error(pesan);
  e.status = status;
  return e;
}

function menurutStatus(resolve, reject) {
  return ({ status, data }) => {
    if (status >= 200 && status < 300) resolve(data);
    else if (status === 0) reject(galat(PESAN_TIDAK_TERJANGKAU, 0));
    else reject(galat((data && data.detail) || `HTTP ${status}`, status));
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

export function apiPutJson(path, body) {
  const [nama, nilai] = headerToken();
  return new Promise((resolve, reject) =>
    putJSON(API_BASE + path, body, menurutStatus(resolve, reject), nama, nilai));
}

// DELETE tanpa body: backend PDB membaca parameternya dari path dan query
// (mis. ?konfirmasi=hapus), jadi datajson sengaja undefined — crootjs tidak
// mengirim body sama sekali kalau undefined.
export function apiDeleteJson(path) {
  const [nama, nilai] = headerToken();
  return new Promise((resolve, reject) =>
    deleteJSON(API_BASE + path, undefined, menurutStatus(resolve, reject), nama, nilai));
}

// Unggah berkas untuk rute yang MEMBUTUHKAN token. postFileJSON crootjs
// mengirim header Authorization dan membalas {status, data} — bentuk yang sama
// dengan getJSON/postJSON, jadi galatnya ikut membawa status HTTP. Field teks
// dikirim lewat query string, sama seperti apiPostBerkas.
//
// Hanya satu berkas per kiriman (crootjs mengambil input.files[0]).
export function apiPostBerkasToken(path, fields, inputId, namaField) {
  const [nama, nilai] = headerToken();
  const url = API_BASE + path + '?' + new URLSearchParams(fields);
  return new Promise((resolve, reject) =>
    postFileJSON(url, nama, nilai, inputId, namaField, menurutStatus(resolve, reject)));
}

// PERHATIAN: apiPostBerkas TIDAK mengirim token — postFile crootjs tidak punya
// parameter header sama sekali. Aman hanya untuk rute publik seperti kirim
// tugas; untuk rute yang butuh token pakai apiPostBerkasToken di atas.
//
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
