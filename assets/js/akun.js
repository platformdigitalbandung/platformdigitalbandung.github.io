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
// - terdaftar: menu dari menu.js menurut peran aktif, di nav atas (layar lebar)
//   dan di bilah bawah + lembar "Lainnya"/"Laporan" (HP <= 720px).
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
    wadah.innerHTML = `${tentang}<button type="button" class="tautan-tombol utama" data-masuk title="Masuk dengan WhatsApp">Masuk</button>`;
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
    const bisaPilih = sah && pilihanPeran(saya).length > 1;
    // Dosen dikenali lewat email kampus (pengganti NIP sejak 2026-09-14), mahasiswa lewat NIM.
    const nomorInduk = saya && saya.peran === 'dosen' ? (saya.email || '') : (saya && saya.nim ? `NIM ${saya.nim}` : '');
    const judul = [`Masuk sebagai ${nama}`, isi.id ? `nomor ${isi.id}` : '', nomorInduk, isi.exp ? `berlaku sampai ${waktu(isi.exp)}` : '',
      hasil.status === 'tak-terjangkau' ? 'backend tidak terjangkau, peran belum bisa dipastikan' : ''].filter(Boolean).join(' · ');
    wadah.innerHTML = `
      <a class="status-akun masuk" href="${sah ? 'saya.html' : './'}" title="${esc(judul)}">
        <span class="titik aktif"></span><span class="nama-akun">${esc(nama)}</span>
      </a>
      ${bisaPilih ? pemilihPeran(saya) : `<span class="peran">${esc(peran)}</span>`}
      ${nomorInduk ? `<span class="nomor-induk">${esc(nomorInduk)}</span>` : ''}
      <a class="tautan-tentang" href="${tautanPanduan(sah ? saya : null)}" title="Panduan pemakaian untuk peran Anda">Panduan</a>
      ${keluar}`;

    const peranPendek = sah ? (peranAktif(saya) || '') : '';
    ringkas = `<button type="button" class="tombol-akun" aria-haspopup="dialog" aria-expanded="false" aria-controls="lembar-akun" aria-label="Akun: ${esc(nama)}${sah ? `, ${esc(peran)}` : ''}">
      <span class="inisial" aria-hidden="true">${esc(String(nama).trim().charAt(0).toUpperCase() || '?')}</span>${peranPendek ? `<span class="tombol-akun-peran">${esc(peranPendek)}</span>` : ''}</button>`;

    lembarAkun = buatLembar('lembar-akun', 'Akun');
    const aktif = sah ? peranAktif(saya) : '';
    const pilihan = bisaPilih ? pilihanPeran(saya) : [];
    lembarAkun.querySelector('.lembar-isi').innerHTML = `
      <div class="akun-identitas">
        <span class="inisial besar" aria-hidden="true">${esc(String(nama).trim().charAt(0).toUpperCase() || '?')}</span>
        <div><b>${esc(nama)}</b><span class="peran">${esc(peran)}</span>${nomorInduk ? `<small>${esc(nomorInduk)}</small>` : ''}</div>
      </div>
      ${!sah && hasil.status !== 'tak-terjangkau' ? '<p class="akun-catatan">Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen. Hubungi pengelola program studi (kaprodi) untuk didaftarkan.</p>' : ''}
      ${hasil.status === 'tak-terjangkau' ? '<p class="akun-catatan">Server belum terjangkau, jadi peran Anda belum bisa dipastikan. Coba muat ulang sebentar lagi.</p>' : ''}
      ${pilihan.length ? `<fieldset class="pilih-peran-lembar"><legend>Peran aktif</legend>
        ${pilihan.map(([nilai, label]) => `<button type="button" class="opsi-peran${nilai === aktif ? ' aktif' : ''}" data-peran="${nilai}" aria-pressed="${nilai === aktif}">${esc(label)}</button>`).join('')}
        <small>Mengubah menu yang tampil. Hak akses tetap mengikuti jabatan Anda.</small></fieldset>` : ''}
      <div class="akun-aksi">
        ${sah ? '<a class="tautan-tombol" href="saya.html">Beranda Saya</a>' : ''}
        <a class="tautan-tombol" href="${tautanPanduan(sah ? saya : null)}">Panduan</a>
        <button type="button" class="tautan-tombol bahaya" data-keluar>Keluar</button>
      </div>`;
    lembarAkun.querySelectorAll('[data-peran]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.peran !== aktif) gantiPeranAktif(b.dataset.peran); else tutupLembar();
    }));

    pasangNavigasi({
      peran: sah ? peranAktif(saya) : '',
      gantiPeran: gantiPeranAktif,
      bisaGantiDosen: sah && pilihanPeran(saya).some(([nilai]) => nilai === 'dosen'),
    });
  }
  if (hasil.status === 'belum' || hasil.status === 'berakhir') pasangNavigasi({ peran: '' });

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
    pilih.addEventListener('change', () => { simpanPeranAktif(pilih.value); location.reload(); }));
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
// Dosen berjabatan memilih peran aktif lewat pemilih di bilah atas: admin,
// kaprodi, atau dosen — hanya yang benar-benar ia pegang. Pilihan itu hanya
// menampilkan atau menyembunyikan menu di peramban ini; kewenangan tetap
// diputuskan backend, jadi tidak perlu keluar-masuk lagi.
const KUNCI_PERAN = 'pdb_peran_aktif';

function jabatanDipegang(saya) { return (saya && saya.jabatan) || []; }

/** Peran yang bisa dipilih, urut dari yang tertinggi. Kosong untuk dosen biasa dan mahasiswa. */
function pilihanPeran(saya) {
  const jab = jabatanDipegang(saya);
  if (!jab.length) return [];
  return [
    jab.includes('admin') ? ['admin', 'admin'] : null,
    jab.includes('kaprodi') ? ['kaprodi', `kaprodi ${(saya.kaprodi_prodi || []).join('/').toUpperCase()}`.trim()] : null,
    ['dosen', 'dosen'],
  ].filter(Boolean);
}

/** Tautan panduan pengguna (repo `panduan`, di-serve di /panduan/) untuk peran aktif. */
export function tautanPanduan(saya) {
  const p = saya ? peranAktif(saya) : '';
  return ['mahasiswa', 'dosen', 'kaprodi', 'admin'].includes(p) ? `panduan/${p}/` : 'panduan/';
}

/** Peran aktif untuk menentukan isi beranda: admin, kaprodi, dosen, atau mahasiswa. */
export function peranAktif(saya) {
  const pilihan = pilihanPeran(saya).map(([nilai]) => nilai);
  if (!pilihan.length) return saya ? saya.peran : '';
  let simpan = '';
  try { simpan = localStorage.getItem(KUNCI_PERAN) || ''; } catch { /* penyimpanan ditolak: pakai bawaan */ }
  // Pilihan tersimpan yang tidak lagi dipegang (mis. jabatan dicabut) jatuh ke peran tertinggi.
  return pilihan.includes(simpan) ? simpan : pilihan[0];
}
function simpanPeranAktif(nilai) {
  try { localStorage.setItem(KUNCI_PERAN, nilai); } catch { /* peramban menolak penyimpanan: tetap peran bawaan */ }
}

/** Semua peran yang dipegang (admin, kaprodi, dosen, atau mahasiswa), urut dari yang tertinggi. */
export function peranDipegang(saya) {
  if (!saya) return [];
  const pilihan = pilihanPeran(saya).map(([nilai]) => nilai);
  return pilihan.length ? pilihan : [saya.peran].filter(Boolean);
}
/** Ganti peran aktif lalu muat ulang halaman (dipakai tombol "Pakai peran …" di ui.js). */
export function gantiPeranAktif(nilai) {
  simpanPeranAktif(nilai);
  location.reload();
}

/** Menu khusus kaprodi (Dosen Pengampu Prodi) ditampilkan: peran aktif kaprodi. */
export function adalahKaprodiAktif(saya) { return peranAktif(saya) === 'kaprodi'; }
/** Menu super admin (Kelola Kaprodi, laporan semua prodi) ditampilkan. */
export function adalahAdmin(saya) { return peranAktif(saya) === 'admin'; }
/** Menu laporan tingkat prodi ditampilkan: admin, atau kaprodi yang memakai peran kaprodi. */
export function adalahPimpinan(saya) { return ['admin', 'kaprodi'].includes(peranAktif(saya)); }
/** Kode prodi yang boleh dilaporkan: null berarti semua prodi (admin). */
export function prodiPimpinan(saya) {
  if (adalahAdmin(saya)) return null;
  return (saya && saya.kaprodi_prodi) || [];
}

/** Label peran aktif untuk ditampilkan, mis. "kaprodi PAI". */
export function labelPeran(saya) {
  if (!saya) return '';
  const aktif = pilihanPeran(saya).find(([nilai]) => nilai === peranAktif(saya));
  return aktif ? aktif[1] : saya.peran;
}

function pemilihPeran(saya) {
  const aktif = peranAktif(saya);
  const opsi = pilihanPeran(saya)
    .map(([nilai, label]) => `<option value="${nilai}"${nilai === aktif ? ' selected' : ''}>${esc(label)}</option>`).join('');
  return `<select class="peran pilih-peran" data-pilih-peran aria-label="Pilih peran" title="Pilih peran aktif — hanya mengubah menu yang tampil">${opsi}</select>`;
}

// Diekspor supaya halaman yang juga butuh peran (mis. beranda) tidak memanggil
// /api/proyekblok/saya dua kali. Modul hanya dievaluasi sekali per halaman.
export const statusAkun = muatSaya();
export const sayaSekarang = statusAkun.then(h => (h.status === 'masuk' ? h.saya : null));

statusAkun.then(render);
