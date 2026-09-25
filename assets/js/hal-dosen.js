import { isLoggedIn, arahkanKeLogin } from './api.js';
import { statusAkun, peranAktif, peranDipegang, punyaPeran } from './akun.js';
import { esc, halamanUntuk, keadaanKosong } from './ui.js';

// Bantuan bersama halaman kelompok dosen (dosen, kelola-materi, proyek, ujian,
// akademik, forum, rekaman, autograder, rapor) — audit UX 2026-09-14.
// Hanya tampilan: kewenangan tetap diputuskan backend.

/** Peran yang mengajar: dosen atau kaprodi (kaprodi juga dosen prodinya). */
export const PERAN_MENGAJAR = ['dosen', 'kaprodi'];

/** Memegang peran dosen (admin dan kaprodi juga dosen). Tanpa pemilih peran sejak 2026-09-26. */
export function sedangMengajar(saya) {
  return punyaPeran(saya, 'dosen');
}

/**
 * Data pengguna untuk halaman: belum masuk → diarahkan ke /login/ (hasil undefined);
 * backend tak terjangkau → pesan di `isi` (hasil undefined, pemanggil berhenti);
 * sesi berakhir → null (halamanUntuk menampilkan tombol Masuk).
 */
export async function sayaHalaman(isi) {
  if (!isLoggedIn()) { arahkanKeLogin(); return undefined; }
  const h = await statusAkun;
  if (h.status === 'tak-terjangkau') {
    isi.innerHTML = '<div class="pesan gagal">Backend tidak terjangkau, jadi peran Anda belum bisa dipastikan. Muat ulang halaman sebentar lagi.</div>';
    return undefined;
  }
  return h.status === 'masuk' ? h.saya : null;
}

/**
 * halamanUntuk untuk halaman kerja dosen. `pesan` untuk peran lain (admin);
 * mahasiswa yang tersasar diberi `untukMahasiswa.pesan` dan tombol ke halaman
 * miliknya (`untukMahasiswa`: {href, label, pesan}).
 */
export function halamanMengajar(saya, isi, { judul, pesan = '', untukMahasiswa = null } = {}) {
  const mahasiswa = Boolean(saya) && peranAktif(saya) === 'mahasiswa';
  const teks = mahasiswa && untukMahasiswa && untukMahasiswa.pesan ? untukMahasiswa.pesan : pesan;
  if (halamanUntuk(saya, PERAN_MENGAJAR, { judul, pesan: teks, wadah: isi })) return true;
  if (mahasiswa && untukMahasiswa) {
    const baris = isi.querySelector('.pemberitahuan-peran .cta-row');
    if (baris) baris.insertAdjacentHTML('afterbegin', `<a class="aksi" href="${esc(untukMahasiswa.href)}">${esc(untukMahasiswa.label)}</a>`);
  }
  return false;
}

/**
 * Rantai prasyarat kerja dosen, dari data GET /api/proyekblok/saya:
 *   1. email kampus terisi (dosen sendiri, halaman Roster & Email Dosen),
 *   2. ditunjuk kaprodi sebagai pengajar kelas — bila `pengampu` (nama opsi warisan).
 * Mengembalikan HTML kartu berisi daftar langkah bertanda selesai/belum dan
 * keadaan kosong untuk langkah pertama yang belum selesai; "" bila semua selesai.
 */
export function kartuPrasyarat(saya, { judul, untuk, pengampu = false, catatan = '' }) {
  const langkah = [{
    selesai: Boolean(saya.email),
    label: 'Isi email kampus Anda',
    kosong: {
      judul: 'Email kampus Anda belum diisi',
      keterangan: `Email kampus adalah identitas dosen di platform ini. ${untuk} baru bisa setelah email itu terisi.`,
      siapa: 'Anda sendiri',
      aksi: { href: 'akademik.html', label: 'Isi email kampus' },
    },
  }];
  if (pengampu) {
    const kaprodi = peranDipegang(saya).includes('kaprodi');
    // Sejak 2026-09-25 hak mengajar per kelas: pengajar kelas yang ditunjuk
    // kaprodi, atau kaprodi untuk semua kelas prodinya.
    langkah.push({
      selesai: kaprodi || (Number(saya.jumlah_kelas_diajar) || 0) > 0,
      label: 'Ditunjuk kaprodi sebagai pengajar kelas',
      kosong: {
        judul: 'Anda belum menjadi pengajar kelas mana pun',
        keterangan: 'Kaprodi menunjuk pengajar tiap kelas di halaman Kelola Kelas, dari semua dosen aktif. Hubungi kaprodi prodi tempat Anda mengajar; nama Anda baru bisa dipilih setelah email kampus terisi.',
        siapa: 'kaprodi prodi tempat Anda mengajar',
        aksi: { href: 'kelas.html', label: 'Lihat Kelas Saya' },
      },
    });
  }
  const pertama = langkah.findIndex(l => !l.selesai);
  if (pertama < 0) return '';
  // Langkah sesudah langkah yang belum selesai ikut menunggu, walau datanya terisi.
  const daftar = langkah.map((l, i) => {
    const status = i < pertama ? 'selesai' : (i === pertama ? 'sekarang' : 'menunggu');
    const tanda = { selesai: 'selesai', sekarang: 'langkah berikutnya', menunggu: 'menunggu langkah sebelumnya' }[status];
    return `<li class="prasyarat-${status}"><span>${esc(l.label)}</span> <span class="lencana${status === 'selesai' ? ' rendah' : status === 'sekarang' ? ' sedang' : ''}">${esc(tanda)}</span></li>`;
  }).join('');
  return `<div class="kartu kartu-prasyarat">
    <h3>${esc(judul)}: langkah yang belum selesai</h3>
    <ol class="rantai-prasyarat">${daftar}</ol>
    ${keadaanKosong(langkah[pertama].kosong)}
    ${catatan ? `<p class="meta">${esc(catatan)}</p>` : ''}
  </div>`;
}
