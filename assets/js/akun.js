import { getCookie } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.12/cookie.min.js';
import { apiGet, logout, arahkanKeLogin } from './api.js';
import { pasangNavigasi, buatLembar, bukaLembar, tutupLembar } from './menu.js';

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
// - terdaftar: menu dari menu.js menurut peran aktif (menu utama + bagian
//   Prodi saat kaprodi, Admin saat admin), di nav atas (layar lebar) dan di
//   bilah bawah + lembar "Menu" (HP <= 720px).
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
    const pilihan = sah ? pilihanPeran(saya) : [];
    const aktif = sah ? peranAktif(saya) : '';
    // Dosen dikenali lewat email kampus (pengganti NIP sejak 2026-09-14), mahasiswa lewat NIM.
    const nomorInduk = saya && saya.peran === 'dosen' ? (saya.email || '') : (saya && saya.nim ? `NIM ${saya.nim}` : '');
    // Mahasiswa tanpa nomor WhatsApp masuk dengan identitas token "nim:<NIM>" (sejak 2026-09-26).
    const nomorWA = isi.id && !String(isi.id).startsWith('nim:') ? isi.id : '';
    const judul = [`Masuk sebagai ${nama}`, nomorWA ? `nomor ${nomorWA}` : '', nomorInduk, isi.exp ? `berlaku sampai ${waktu(isi.exp)}` : '',
      hasil.status === 'tak-terjangkau' ? 'backend tidak terjangkau, peran belum bisa dipastikan' : ''].filter(Boolean).join(' · ');
    wadah.innerHTML = `
      <a class="status-akun masuk" href="./" title="${esc(judul)}">
        <span class="titik aktif"></span><span class="nama-akun">${esc(nama)}</span>
      </a>
      ${pilihan.length ? pemilihPeran(pilihan, aktif) : `<span class="peran">${esc(peran)}</span>`}
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
      ${pilihan.length ? `<fieldset class="pilih-peran-lembar"><legend>Peran aktif</legend>
        ${pilihan.map(([nilai, label]) => `<button type="button" class="opsi-peran${nilai === aktif ? ' aktif' : ''}" data-peran="${nilai}" aria-pressed="${nilai === aktif}">${esc(label)}</button>`).join('')}
        <small>Mengubah menu dan Beranda yang tampil. Hak akses tetap mengikuti jabatan Anda.</small></fieldset>` : ''}
      <div class="akun-aksi">
        ${sah ? '<a class="tautan-tombol" href="sandi.html">Kata sandi</a>' : ''}
        <a class="tautan-tombol" href="${tautanPanduan(sah ? saya : null)}">Panduan</a>
        <button type="button" class="tautan-tombol bahaya" data-keluar>Keluar</button>
      </div>`;
    lembarAkun.querySelectorAll('[data-peran]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.peran !== aktif) gantiPeranAktif(b.dataset.peran); else tutupLembar();
    }));
    pasangNavigasi(sah ? saya : null, aktif);
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

  document.querySelectorAll('.appbar [data-pilih-peran]').forEach(pilih =>
    pilih.addEventListener('change', () => gantiPeranAktif(pilih.value)));
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
// Pemilih peran (dikembalikan 2026-09-26, keputusan developer Arfan — sempat
// dihapus pagi harinya): dosen berjabatan memilih peran aktif — admin,
// kaprodi, atau dosen, hanya yang benar-benar ia pegang; bawaannya peran
// tertinggi. Pilihan disimpan di peramban ini dan hanya mengubah menu,
// label, dan isi Beranda. Halaman tetap memeriksa peran yang DIPEGANG
// (punyaPeran), dan kewenangan tetap diputuskan backend.
const KUNCI_PERAN = 'pdb_peran_aktif';

/** Semua peran yang dipegang, urut dari yang tertinggi: admin, kaprodi, dosen — atau mahasiswa. */
export function peranDipegang(saya) {
  if (!saya) return [];
  if (saya.peran !== 'dosen') return [saya.peran].filter(Boolean);
  const jab = saya.jabatan || [];
  return [jab.includes('admin') ? 'admin' : null, jab.includes('kaprodi') ? 'kaprodi' : null, 'dosen'].filter(Boolean);
}

/** Pemegang token memegang peran itu (admin, kaprodi, dosen, atau mahasiswa). */
export function punyaPeran(saya, peran) { return peranDipegang(saya).includes(peran); }

/** Label satu peran, mis. "kaprodi TRPL". */
function labelSatuPeran(saya, p) {
  return p === 'kaprodi' ? `kaprodi ${(saya.kaprodi_prodi || []).join('/').toUpperCase()}`.trim() : p;
}

/** Peran yang bisa dipilih [nilai, label], urut dari yang tertinggi. Kosong bila hanya satu peran. */
export function pilihanPeran(saya) {
  const dipegang = peranDipegang(saya);
  return dipegang.length > 1 ? dipegang.map(p => [p, labelSatuPeran(saya, p)]) : [];
}

/**
 * Peran aktif pilihan pengguna (bawaannya peran tertinggi). Menentukan menu,
 * label, dan Beranda; jangan dipakai menyembunyikan hak — pakai punyaPeran.
 */
export function peranAktif(saya) {
  const dipegang = peranDipegang(saya);
  let simpan = '';
  try { simpan = localStorage.getItem(KUNCI_PERAN) || ''; } catch { /* penyimpanan ditolak: pakai bawaan */ }
  // Pilihan tersimpan yang tidak lagi dipegang (mis. jabatan dicabut) jatuh ke peran tertinggi.
  return dipegang.includes(simpan) ? simpan : (dipegang[0] || '');
}

/** Ganti peran aktif lalu muat ulang halaman. */
export function gantiPeranAktif(nilai) {
  try { localStorage.setItem(KUNCI_PERAN, nilai); } catch { /* peramban menolak penyimpanan: tetap peran bawaan */ }
  location.reload();
}

function pemilihPeran(pilihan, aktif) {
  const opsi = pilihan.map(([nilai, label]) => `<option value="${nilai}"${nilai === aktif ? ' selected' : ''}>${esc(label)}</option>`).join('');
  return `<select class="peran pilih-peran" data-pilih-peran aria-label="Pilih peran" title="Pilih peran aktif — mengubah menu dan Beranda, bukan hak akses">${opsi}</select>`;
}

/** Tautan panduan pengguna (repo `panduan`, di-serve di /panduan/) untuk peran aktif. */
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

/** Label peran aktif, mis. "kaprodi TRPL". */
export function labelPeran(saya) {
  if (!saya) return '';
  return labelSatuPeran(saya, peranAktif(saya));
}

// Diekspor supaya halaman yang juga butuh peran (mis. beranda) tidak memanggil
// /api/proyekblok/saya dua kali. Modul hanya dievaluasi sekali per halaman.
export const statusAkun = muatSaya();
export const sayaSekarang = statusAkun.then(h => (h.status === 'masuk' ? h.saya : null));

statusAkun.then(render);
