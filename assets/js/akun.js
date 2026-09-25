import { getCookie } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.12/cookie.min.js';
import { apiGet, logout, arahkanKeLogin } from './api.js';
import { pasangNavigasi, buatLembar, bukaLembar } from './menu.js';

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

/** Nomor yang benar-benar terdaftar: dosen aktif, atau mahasiswa di roster (punya prodi). */
export function terdaftar(saya) {
  return !!saya && (saya.peran === 'dosen' || (saya.peran === 'mahasiswa' && !!saya.prodi_kode));
}

// Bilah atas dan navigasi (keputusan pemilik produk 2026-09-15):
// - tamu, sesi berakhir, backend tak terjangkau, nomor belum terdaftar: TANPA menu
//   aplikasi — hanya merek, "Tentang program", dan Masuk (atau akun + Keluar);
// - terdaftar: menu dari menu.js menurut peran yang dipegang (menu utama +
//   bagian Prodi/Admin), di nav atas (layar lebar) dan di bilah bawah +
//   lembar "Menu" (HP <= 720px).
// Di HP baris akun diganti satu tombol akun yang membuka lembar Akun.
function render(hasil) {
  const wadah = document.querySelector('.appbar .akun');
  if (!wadah) return;
  const dalam = wadah.parentElement;
  const keluar = '<button type="button" class="tautan-tombol" data-keluar>Keluar</button>';
  const tentang = '<a class="tautan-tentang" href="program.html">Tentang program</a><a class="tautan-tentang" href="panduan/">Panduan</a>';
  let ringkas = '';
  let lembarAkun = null;

  if (hasil.status === 'belum') {
    wadah.innerHTML = `${tentang}<button type="button" class="tautan-tombol utama" data-masuk title="Masuk dengan NIM/email dan kata sandi, atau WhatsApp">Masuk</button>`;
    ringkas = `${tentang}<button type="button" class="tautan-tombol utama" data-masuk>Masuk</button>`;
  } else if (hasil.status === 'berakhir') {
    wadah.innerHTML = `${tentang}<span class="status-akun" title="Sesi login sudah tidak berlaku."><span class="titik berakhir"></span>Sesi berakhir</span>
      <button type="button" class="tautan-tombol utama" data-masuk-lagi>Masuk lagi</button>`;
    ringkas = '<button type="button" class="tautan-tombol utama" data-masuk-lagi>Masuk lagi</button>';
  } else {
    const { isi, saya } = hasil;
    const nama = isi.alias || isi.id || 'Pengguna';
    const sah = terdaftar(saya);
    const peran = sah ? labelPeran(saya) : (hasil.status === 'tak-terjangkau' ? 'peran belum pasti' : 'belum terdaftar');
    // Dosen dikenali lewat email kampus (pengganti NIP sejak 2026-09-14), mahasiswa lewat NIM.
    const nomorInduk = saya && saya.peran === 'dosen' ? (saya.email || '') : (saya && saya.nim ? `NIM ${saya.nim}` : '');
    const judul = [`Masuk sebagai ${nama}`, isi.id ? `nomor ${isi.id}` : '', nomorInduk, isi.exp ? `berlaku sampai ${waktu(isi.exp)}` : '',
      hasil.status === 'tak-terjangkau' ? 'backend tidak terjangkau, peran belum bisa dipastikan' : ''].filter(Boolean).join(' · ');
    wadah.innerHTML = `
      <a class="status-akun masuk" href="./" title="${esc(judul)}">
        <span class="titik aktif"></span><span class="nama-akun">${esc(nama)}</span>
      </a>
      <span class="peran${sah && (saya.jabatan || []).length ? ' peran-jabatan' : ''}">${esc(peran)}</span>
      ${nomorInduk ? `<span class="nomor-induk">${esc(nomorInduk)}</span>` : ''}
      <a class="tautan-tentang" href="${tautanPanduan(sah ? saya : null)}" title="Panduan pemakaian untuk peran Anda">Panduan</a>
      ${sah ? '<a class="tautan-tentang" href="sandi.html" title="Ganti kata sandi untuk masuk dengan NIM atau email">Kata sandi</a>' : ''}
      ${keluar}`;

    const peranPendek = sah ? (peranAktif(saya) || '') : '';
    ringkas = `<button type="button" class="tombol-akun" aria-haspopup="dialog" aria-expanded="false" aria-controls="lembar-akun" aria-label="Akun: ${esc(nama)}${sah ? `, ${esc(peran)}` : ''}">
      <span class="inisial" aria-hidden="true">${esc(String(nama).trim().charAt(0).toUpperCase() || '?')}</span>${peranPendek ? `<span class="tombol-akun-peran">${esc(peranPendek)}</span>` : ''}</button>`;

    lembarAkun = buatLembar('lembar-akun', 'Akun');
    lembarAkun.querySelector('.lembar-isi').innerHTML = `
      <div class="akun-identitas">
        <span class="inisial besar" aria-hidden="true">${esc(String(nama).trim().charAt(0).toUpperCase() || '?')}</span>
        <div><b>${esc(nama)}</b><span class="peran">${esc(peran)}</span>${nomorInduk ? `<small>${esc(nomorInduk)}</small>` : ''}</div>
      </div>
      ${!sah && hasil.status !== 'tak-terjangkau' ? '<p class="akun-catatan">Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen. Hubungi pengelola program studi (kaprodi) untuk didaftarkan.</p>' : ''}
      ${hasil.status === 'tak-terjangkau' ? '<p class="akun-catatan">Server belum terjangkau, jadi peran Anda belum bisa dipastikan. Coba muat ulang sebentar lagi.</p>' : ''}
      <div class="akun-aksi">
        ${sah ? '<a class="tautan-tombol" href="sandi.html">Kata sandi</a>' : ''}
        <a class="tautan-tombol" href="${tautanPanduan(sah ? saya : null)}">Panduan</a>
        <button type="button" class="tautan-tombol bahaya" data-keluar>Keluar</button>
      </div>`;
    pasangNavigasi(sah ? saya : null);
  }
  if (hasil.status === 'belum' || hasil.status === 'berakhir') pasangNavigasi(null);

  // Tombol akun ringkas (HP), disisipkan sesudah .akun di bilah atas.
  let wadahRingkas = dalam.querySelector('.akun-ringkas');
  if (!wadahRingkas) {
    wadahRingkas = document.createElement('div');
    wadahRingkas.className = 'akun-ringkas';
    dalam.appendChild(wadahRingkas);
  }
  wadahRingkas.innerHTML = ringkas;
  const tombolAkun = wadahRingkas.querySelector('.tombol-akun');
  if (tombolAkun && lembarAkun) tombolAkun.addEventListener('click', () => bukaLembar(lembarAkun, tombolAkun));

  document.querySelectorAll('.appbar [data-keluar], #lembar-akun [data-keluar]').forEach(b =>
    b.addEventListener('click', () => { logout(); location.href = './'; }));
  document.querySelectorAll('.appbar [data-masuk]').forEach(b => b.addEventListener('click', () => arahkanKeLogin()));
  // Token lama dibuang dulu supaya halaman asal tidak langsung menolak lagi
  // dengan token yang sama setelah kembali dari /login/.
  document.querySelectorAll('.appbar [data-masuk-lagi]').forEach(b => b.addEventListener('click', () => { logout(); arahkanKeLogin(); }));
}

// Peran platform: mahasiswa, dosen, kaprodi, ditambah super admin (keputusan
// pemilik produk 2026-09-14; super admin sempat bernama direktur). Jabatan
// (admin, kaprodi) dan prodi yang dipimpin datang dari GET /api/proyekblok/saya.
//
// TANPA pemilih peran sejak 2026-09-26 (keputusan developer Arfan, membalik
// pemilih peran 2026-09-15): semua peran yang dipegang berlaku bersamaan.
// Menu menampilkan bagian Prodi (kaprodi) dan Admin di samping menu dosen,
// dan halaman memeriksa peran yang DIPEGANG, bukan peran yang "dipakai".
// Kewenangan tetap diputuskan backend.

// Pilihan peran lama di peramban tidak dipakai lagi; dibersihkan sekali.
try { localStorage.removeItem('pdb_peran_aktif'); } catch { /* penyimpanan ditolak */ }

/** Semua peran yang dipegang, urut dari yang tertinggi: admin, kaprodi, dosen — atau mahasiswa. */
export function peranDipegang(saya) {
  if (!saya) return [];
  if (saya.peran !== 'dosen') return [saya.peran].filter(Boolean);
  const jab = saya.jabatan || [];
  return [jab.includes('admin') ? 'admin' : null, jab.includes('kaprodi') ? 'kaprodi' : null, 'dosen'].filter(Boolean);
}

/** Pemegang token memegang peran itu (admin, kaprodi, dosen, atau mahasiswa). */
export function punyaPeran(saya, peran) { return peranDipegang(saya).includes(peran); }

/**
 * Peran tertinggi yang dipegang. Hanya untuk pilihan bawaan (panduan, prodi
 * bawaan); jangan dipakai menyembunyikan hak — pakai punyaPeran.
 */
export function peranAktif(saya) { return peranDipegang(saya)[0] || ''; }

/** Tautan panduan pengguna (repo `panduan`, di-serve di /panduan/) untuk peran tertinggi. */
export function tautanPanduan(saya) {
  const p = saya ? peranAktif(saya) : '';
  return ['mahasiswa', 'dosen', 'kaprodi', 'admin'].includes(p) ? `panduan/${p}/` : 'panduan/';
}

/** Memimpin prodi (kaprodi). */
export function adalahKaprodiAktif(saya) { return punyaPeran(saya, 'kaprodi'); }
/** Super admin. */
export function adalahAdmin(saya) { return punyaPeran(saya, 'admin'); }
/** Boleh membuka laporan tingkat prodi: admin atau kaprodi. */
export function adalahPimpinan(saya) { return adalahAdmin(saya) || adalahKaprodiAktif(saya); }
/** Kode prodi yang boleh dilaporkan: null berarti semua prodi (admin). */
export function prodiPimpinan(saya) {
  if (adalahAdmin(saya)) return null;
  return (saya && saya.kaprodi_prodi) || [];
}

/** Label semua peran yang dipegang, mis. "kaprodi TRPL · dosen". */
export function labelPeran(saya) {
  if (!saya) return '';
  return peranDipegang(saya).map(p => (p === 'kaprodi'
    ? `kaprodi ${(saya.kaprodi_prodi || []).join('/').toUpperCase()}`.trim()
    : p)).join(' · ');
}

// Diekspor supaya halaman yang juga butuh peran (mis. beranda) tidak memanggil
// /api/proyekblok/saya dua kali. Modul hanya dievaluasi sekali per halaman.
export const statusAkun = muatSaya();
export const sayaSekarang = statusAkun.then(h => (h.status === 'masuk' ? h.saya : null));

statusAkun.then(render);
