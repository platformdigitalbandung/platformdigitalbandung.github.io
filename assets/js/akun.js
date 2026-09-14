import { getCookie } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/cookie.min.js';
import { apiGet, logout, arahkanKeLogin } from './api.js';

// Status akun di pojok kanan bilah atas, dipakai semua halaman: sedang masuk
// sebagai siapa, atau belum masuk. Diisi ke elemen .akun di header.appbar.
//
// Nama dan masa berlaku dibaca dari isi token PASETO v4.public di cookie
// `login`. Isi token itu memang tidak terenkripsi (hanya ditandatangani), jadi
// membacanya di peramban aman — tapi BUKAN bukti keaslian: yang menentukan
// sesi masih sah tetap backend, lewat GET /api/proyekblok/saya. Kalau backend
// menolak (token kedaluwarsa atau dicabut), statusnya "Sesi berakhir".
//
// Tombol "Masuk" di sini HANYA mengarahkan ke /login/ lewat arahkanKeLogin()
// (yang mengingat halaman asal) — tidak ada form, kartu, atau QR WhatsAuth di
// luar repo login. Keputusan pemilik produk 2026-09-14; lihat pdb/README.md
// bagian Frontend.

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
  const keluar = '<button type="button" class="tautan-tombol" data-keluar>Keluar</button>';

  if (hasil.status === 'belum') {
    wadah.innerHTML = `<span class="status-akun"><span class="titik"></span>Belum masuk</span>
      <button type="button" class="tautan-tombol utama" data-masuk title="Masuk dengan WhatsApp">Masuk</button>`;
  } else if (hasil.status === 'berakhir') {
    wadah.innerHTML = `<span class="status-akun" title="Sesi login sudah tidak berlaku."><span class="titik berakhir"></span>Sesi berakhir</span>
      <button type="button" class="tautan-tombol utama" data-masuk-lagi>Masuk lagi</button>`;
  } else {
    const { isi, saya } = hasil;
    const nama = isi.alias || isi.id || 'Pengguna';
    const peran = labelPeran(saya);
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
  const tombolKeluar = wadah.querySelector('[data-keluar]');
  if (tombolKeluar) tombolKeluar.addEventListener('click', () => { logout(); location.href = './'; });
  const tombolMasuk = wadah.querySelector('[data-masuk]');
  if (tombolMasuk) tombolMasuk.addEventListener('click', () => arahkanKeLogin());
  // Token lama dibuang dulu supaya halaman asal tidak langsung menolak lagi
  // dengan token yang sama setelah kembali dari /login/.
  const tombolMasukLagi = wadah.querySelector('[data-masuk-lagi]');
  if (tombolMasukLagi) tombolMasukLagi.addEventListener('click', () => { logout(); arahkanKeLogin(); });
}

// Jabatan pimpinan dari GET /api/proyekblok/saya. Direktur melihat laporan
// tingkat prodi untuk semua prodi; kaprodi hanya prodinya (kaprodi_prodi).
// Kewenangan tetap diputuskan backend — ini hanya untuk menyembunyikan menu
// yang pasti ditolak.
export function adalahDirektur(saya) { return Boolean(saya && (saya.jabatan || []).includes('direktur')); }
export function adalahPimpinan(saya) { return Boolean(saya && (saya.jabatan || []).length); }
/** Kode prodi yang boleh dilaporkan: null berarti semua prodi (direktur). */
export function prodiPimpinan(saya) {
  if (adalahDirektur(saya)) return null;
  return (saya && saya.kaprodi_prodi) || [];
}

function labelPeran(saya) {
  if (!saya) return '';
  if (adalahDirektur(saya)) return 'direktur';
  if ((saya.jabatan || []).includes('kaprodi')) return `kaprodi ${(saya.kaprodi_prodi || []).join('/').toUpperCase()}`.trim();
  return saya.peran;
}

// Diekspor supaya halaman yang juga butuh peran (mis. beranda) tidak memanggil
// /api/proyekblok/saya dua kali. Modul hanya dievaluasi sekali per halaman.
export const statusAkun = muatSaya();
export const sayaSekarang = statusAkun.then(h => (h.status === 'masuk' ? h.saya : null));

statusAkun.then(render);
