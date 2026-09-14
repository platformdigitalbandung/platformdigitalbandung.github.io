import { getCookie } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/cookie.min.js';
import { apiGet, logout } from './api.js';

// Status akun di pojok kanan bilah atas, dipakai semua halaman: sedang masuk
// sebagai siapa, atau belum masuk. Diisi ke elemen .akun di header.appbar.
//
// Nama dan masa berlaku dibaca dari isi token PASETO v4.public di cookie
// `login`. Isi token itu memang tidak terenkripsi (hanya ditandatangani), jadi
// membacanya di peramban aman — tapi BUKAN bukti keaslian: yang menentukan
// sesi masih sah tetap backend, lewat GET /api/proyekblok/saya. Kalau backend
// menolak (token kedaluwarsa atau dicabut), statusnya "Sesi berakhir".
//
// Tidak ada tombol login di sini (form login hanya di /login/). Tautan "Beranda
// Saya" mengarahkan ke sana kalau belum masuk.

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Isi token: "v4.public.<base64url(pesan || tanda tangan 64 byte)>[.footer]".
function isiToken() {
  const token = getCookie('login');
  if (!token) return null;
  const bagian = token.split('.');
  if (bagian.length < 3 || bagian[0] !== 'v4' || bagian[1] !== 'public') return {};
  try {
    const b64 = bagian[2].replace(/-/g, '+').replace(/_/g, '/');
    const biner = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(biner, c => c.charCodeAt(0)).slice(0, -64);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

function waktu(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
}

async function muatSaya() {
  const isi = isiToken();
  if (!isi) return { status: 'belum' };
  const kedaluwarsa = isi.exp && Date.parse(isi.exp) <= Date.now();
  if (kedaluwarsa) return { status: 'berakhir', isi };
  try {
    const saya = await apiGet('/api/proyekblok/saya', { auth: true });
    return { status: 'masuk', isi, saya };
  } catch (err) {
    // 401/403: token ditolak. Galat jaringan tidak dianggap sesi berakhir.
    return { status: err.status === 0 ? 'tak-terjangkau' : 'berakhir', isi };
  }
}

function render(hasil) {
  const wadah = document.querySelector('.appbar .akun');
  if (!wadah) return;
  const berandaSaya = '<a class="tautan-tombol" href="saya.html">Beranda Saya</a>';
  const keluar = '<button type="button" class="tautan-tombol" data-keluar>Keluar</button>';

  if (hasil.status === 'belum') {
    wadah.innerHTML = `<span class="status-akun" title="Anda belum masuk. Buka Beranda Saya untuk masuk dengan WhatsApp."><span class="titik"></span>Belum masuk</span>${berandaSaya}`;
  } else if (hasil.status === 'berakhir') {
    wadah.innerHTML = `<span class="status-akun" title="Sesi login sudah tidak berlaku. Keluar lalu masuk lagi."><span class="titik berakhir"></span>Sesi berakhir</span>${keluar}`;
  } else {
    const { isi, saya } = hasil;
    const nama = isi.alias || isi.id || 'Pengguna';
    const peran = saya ? saya.peran : '';
    const nomorInduk = saya && saya.nip ? `NIP ${saya.nip}` : (saya && saya.nim ? `NIM ${saya.nim}` : '');
    const judul = [`Masuk sebagai ${nama}`, isi.id ? `nomor ${isi.id}` : '', nomorInduk, isi.exp ? `berlaku sampai ${waktu(isi.exp)}` : '',
      hasil.status === 'tak-terjangkau' ? 'backend tidak terjangkau, peran belum bisa dipastikan' : ''].filter(Boolean).join(' · ');
    wadah.innerHTML = `
      <a class="status-akun masuk" href="saya.html" title="${esc(judul)}">
        <span class="titik aktif"></span><span class="nama-akun">${esc(nama)}</span>
      </a>
      ${peran ? `<span class="peran">${esc(peran)}</span>` : ''}
      ${nomorInduk ? `<span class="nomor-induk">${esc(nomorInduk)}</span>` : ''}
      ${keluar}`;
  }
  const tombol = wadah.querySelector('[data-keluar]');
  if (tombol) tombol.addEventListener('click', () => { logout(); location.href = './'; });
}

// Diekspor supaya halaman yang juga butuh peran (mis. beranda) tidak memanggil
// /api/proyekblok/saya dua kali. Modul hanya dievaluasi sekali per halaman.
export const statusAkun = muatSaya();
export const sayaSekarang = statusAkun.then(h => (h.status === 'masuk' ? h.saya : null));

statusAkun.then(render);
