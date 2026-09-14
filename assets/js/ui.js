import { peranAktif, peranDipegang, gantiPeranAktif } from './akun.js';
import { arahkanKeLogin } from './api.js';

// Komponen tampilan bersama untuk semua halaman (audit UX 2026-09-14):
// prodi bawaan pengguna, penolakan halaman sesuai peran aktif, keadaan kosong
// "langkah berikutnya", glosarium istilah, label moda, dan tabel yang menjadi
// kartu bertumpuk di HP. Semua teks dari luar di-escape di sini; pemanggil
// cukup menaruh HTML hasilnya ke innerHTML. Rincian pemakaian:
// scratchpad ux-fondasi.md / komentar tiap fungsi.

export function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Hanya tautan di situs ini: path relatif (mis. "kuis.html?minggu=2") atau
// "/login/". Skema lain (javascript:, data:, //host) dibuang.
function tautanAman(href) {
  const h = String(href || '').trim();
  return /^(?![a-z][a-z0-9+.-]*:|\/\/|\\)[^\s]*$/i.test(h) ? h : '';
}

// ===== Prodi bawaan =====

/**
 * Kode prodi bawaan pengguna (huruf kecil, mis. "pai"), dipakai sebagai pilihan
 * awal form dan filter — bukan prodi pertama di daftar (TRPL).
 * Mahasiswa: prodi roster. Peran aktif kaprodi: prodi pertama yang dipimpin.
 * Peran aktif dosen: prodi mengajar pertama (atau prodi yang dipimpin).
 * Admin atau tidak diketahui: "".
 */
export function prodiBawaan(saya) {
  if (!saya) return '';
  const pertama = (daftar) => String((daftar || [])[0] || '').toLowerCase();
  switch (peranAktif(saya)) {
    case 'mahasiswa': return String(saya.prodi_kode || '').toLowerCase();
    case 'kaprodi': return pertama(saya.kaprodi_prodi);
    case 'dosen': return pertama(saya.prodi_mengajar) || pertama(saya.kaprodi_prodi);
    default: return '';
  }
}

/**
 * Pilih prodi bawaan pada <select> kalau opsinya ada (cocok tanpa peduli
 * huruf besar/kecil). Mengembalikan true bila terpilih. `picu: true` mengirim
 * event change supaya isian yang bergantung pada prodi ikut dimuat.
 */
export function pilihProdiBawaan(select, saya, { picu = false } = {}) {
  const kode = prodiBawaan(saya);
  if (!select || !kode) return false;
  const opsi = [...select.options].find(o => o.value.toLowerCase() === kode);
  if (!opsi) return false;
  select.value = opsi.value;
  if (picu) select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// ===== Halaman sesuai peran aktif =====

const NAMA_PERAN = { admin: 'admin', kaprodi: 'kaprodi', dosen: 'dosen', mahasiswa: 'mahasiswa' };

/**
 * Pastikan halaman ini untuk peran aktif pengguna. Kalau ya: tidak menulis
 * apa pun dan mengembalikan true. Kalau tidak: menulis pemberitahuan ramah ke
 * `wadah` (bawaan #isi) dan mengembalikan false — pemanggil berhenti merender
 * form. Bila pengguna memegang peran yang diizinkan tapi sedang memakai peran
 * lain, pemberitahuan memuat tombol "Pakai peran …".
 *
 *   const saya = await sayaSekarang;
 *   if (!halamanUntuk(saya, ['dosen', 'kaprodi'], { judul: 'Kelola Materi' })) return;
 */
export function halamanUntuk(saya, peranDiizinkan, { judul = 'Halaman ini', pesan = '', wadah = null } = {}) {
  const tempat = wadah || document.getElementById('isi') || document.querySelector('main.halaman');
  const izin = (peranDiizinkan || []).filter(p => NAMA_PERAN[p]);
  if (saya && izin.includes(peranAktif(saya))) return true;
  if (!tempat) return false;

  const daftarIzin = izin.map(p => NAMA_PERAN[p]).join(' atau ');
  if (!saya) {
    tempat.innerHTML = `<div class="kartu pemberitahuan-peran">
      <h3>${esc(judul)} butuh masuk</h3>
      <p>${esc(pesan || `Halaman ini untuk ${daftarIzin}. Masuk dengan nomor WhatsApp yang terdaftar.`)}</p>
      <p class="cta-row"><button type="button" data-ui-masuk>Masuk</button><a class="aksi sekunder" href="./">Kembali ke Beranda</a></p>
    </div>`;
    tempat.querySelector('[data-ui-masuk]').addEventListener('click', () => arahkanKeLogin());
    return false;
  }

  const dipegang = peranDipegang(saya).filter(p => izin.includes(p));
  const aktif = NAMA_PERAN[peranAktif(saya)] || 'tamu';
  const tombol = dipegang.map(p =>
    `<button type="button" data-ui-peran="${esc(p)}">Pakai peran ${esc(NAMA_PERAN[p])}</button>`).join('');
  const penjelasan = dipegang.length
    ? `Anda sedang memakai peran <b>${esc(aktif)}</b>. Halaman ini untuk ${esc(daftarIzin)} — ganti peran di pojok kanan atas, atau tekan tombol di bawah.`
    : `Halaman ini untuk ${esc(daftarIzin)}, sedangkan nomor Anda terdaftar sebagai <b>${esc(aktif)}</b>.`;
  tempat.innerHTML = `<div class="kartu pemberitahuan-peran">
    <h3>${esc(judul)} untuk ${esc(daftarIzin)}</h3>
    <p>${penjelasan}</p>
    ${pesan ? `<p class="meta">${esc(pesan)}</p>` : ''}
    <p class="cta-row">${tombol}<a class="aksi sekunder" href="./">Kembali ke Beranda</a></p>
  </div>`;
  tempat.querySelectorAll('[data-ui-peran]').forEach(b =>
    b.addEventListener('click', () => gantiPeranAktif(b.dataset.uiPeran)));
  return false;
}

// ===== Keadaan kosong: langkah berikutnya =====

/**
 * HTML keadaan kosong yang menjawab: apa yang kosong (judul), mengapa/apa
 * artinya (keterangan), siapa yang harus bertindak (siapa), dan tombol ke
 * langkah itu (aksi: {href, label} atau array-nya; null bila tidak ada).
 *
 *   wadah.innerHTML = keadaanKosong({
 *     judul: 'Belum ada materi minggu 2',
 *     keterangan: 'Dosen pengampu belum menambahkannya.',
 *     siapa: 'dosen pengampu PAI',
 *     aksi: { href: 'forum.html', label: 'Tanya di forum' },
 *   });
 */
export function keadaanKosong({ judul = '', keterangan = '', siapa = '', aksi = null } = {}) {
  const daftarAksi = (Array.isArray(aksi) ? aksi : aksi ? [aksi] : [])
    .map(a => ({ href: tautanAman(a && a.href), label: a && a.label }))
    .filter(a => a.href && a.label);
  return `<div class="kosong-langkah">
    ${judul ? `<p class="kosong-judul">${esc(judul)}</p>` : ''}
    ${keterangan ? `<p>${esc(keterangan)}</p>` : ''}
    ${siapa ? `<p class="kosong-siapa">Yang perlu bertindak: <b>${esc(siapa)}</b></p>` : ''}
    ${daftarAksi.length ? `<p class="cta-row">${daftarAksi.map((a, i) =>
      `<a class="aksi${i ? ' sekunder' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</p>` : ''}
  </div>`;
}

// ===== Glosarium =====

export const GLOSARIUM = {
  rumpun: 'Kelompok beberapa mata kuliah yang dipelajari bersama lewat satu proyek. Nilai proyeknya dibagi ke tiap mata kuliah di rumpun itu.',
  blok: 'Nama lain rumpun: beberapa mata kuliah dikerjakan sekaligus dalam satu proyek selama beberapa minggu.',
  'proyek blok': 'Proyek kelompok yang mengikat satu rumpun; dinilai dosen pembimbing per mahasiswa per mata kuliah.',
  'proyek kerja': 'Pekerjaan di tempat kerja mahasiswa yang diakui sebagai proyek kuliah setelah disetujui dosen.',
  cpl: 'Capaian Pembelajaran Lulusan: kemampuan yang harus terbukti dimiliki lulusan program studi.',
  sks: 'Satuan Kredit Semester: ukuran beban belajar. Di platform ini 1 SKS dihitung 85 menit kegiatan per minggu.',
  'kuis gerbang': 'Kuis singkat tentang materi asinkron pekan itu. Harus lulus sebelum sesi tatap muka Jumat.',
  asinkron: 'Belajar mandiri tanpa jadwal bersama (Senin–Rabu): menonton video dan membaca materi kapan saja.',
  'daring sinkron': 'Kelas online bersama dosen pada jam yang sama (Kamis malam).',
  luring: 'Tatap muka langsung di kampus atau lokasi praktik.',
  sla: 'Target waktu respons dosen: pertanyaan forum dijawab paling lambat 1×24 jam (dihitung Senin–Rabu).',
  rpl: 'Rekognisi Pembelajaran Lampau: pengalaman kerja sebelum kuliah yang diajukan untuk diakui sebagai kredit satu rumpun.',
  'ritme mingguan': 'Pola kegiatan per hari dalam seminggu (menit dan moda) yang dipakai untuk menyusun kalender semester.',
  pengampu: 'Dosen yang dicentang kaprodi sebagai pengajar di prodi itu; hanya pengampu yang bisa menyusun materi dan kuis gerbangnya.',
  kepatuhan: 'Laporan menit kegiatan per mata kuliah dibanding tuntutan SKS, sebagai bukti untuk akreditasi.',
  autograder: 'Pengujian otomatis atas kode yang dikirim mahasiswa lewat Pull Request; hasilnya menjadi sebagian nilai.',
  coverage: 'Persentase baris kode mahasiswa yang dijalankan oleh tes; bagian dari skor autograder.',
  angkatan: 'Tahun masuk mahasiswa, mis. 2026. Kalender dan rapor disusun per angkatan dan semester.',
  semester: 'Urutan semester sejak masuk (1–8), bukan ganjil/genap tahun akademik.',
};

/** Penjelasan singkat satu istilah ("" bila tidak dikenal). Kunci tidak peka huruf besar. */
export function artiIstilah(kunci) {
  return GLOSARIUM[String(kunci || '').toLowerCase()] || '';
}

/**
 * HTML istilah yang bisa diketuk untuk melihat artinya (bekerja di layar
 * sentuh — tidak mengandalkan atribut title). `teks` bawaan = kunci.
 *
 *   `Pilih ${istilah('rumpun')} dan minggu`
 */
export function istilah(kunci, teks = '') {
  const arti = artiIstilah(kunci);
  const label = esc(teks || kunci);
  if (!arti) return label;
  return `<details class="istilah"><summary>${label}<span class="istilah-tanda" aria-hidden="true">?</span></summary><span class="istilah-isi">${esc(arti)}</span></details>`;
}

// ===== Moda sesi =====

const MODA = {
  asinkron: 'Belajar mandiri (asinkron)',
  daring_sinkron: 'Kelas daring bersama dosen',
  opsional_luring_daring: 'Praktik & proyek (luring atau daring)',
  luring: 'Tatap muka (luring)',
  daring: 'Daring',
  bebas: 'Tanpa kegiatan akademik',
};

/** Label manusiawi untuk kode moda sesi/ritme; kode tak dikenal dirapikan (garis bawah → spasi). */
export function labelModa(kode) {
  const k = String(kode || '');
  return MODA[k] || k.replace(/_/g, ' ');
}

/** Pilihan <option> moda dengan label manusiawi (nilai tetap kode). */
export function opsiModa(terpilih = '', daftar = Object.keys(MODA)) {
  return daftar.map(k => `<option value="${esc(k)}"${k === terpilih ? ' selected' : ''}>${esc(labelModa(k))}</option>`).join('');
}

// ===== Tabel menjadi kartu di HP =====

/**
 * Isi data-label setiap <td> dari teks <th> kolomnya, supaya tabel ber-kelas
 * `tabel-kartu` tampil sebagai kartu bertumpuk di layar ≤ 620px. Panggil
 * setiap kali isi tabel dirender ulang. Menerima elemen tabel atau selektor.
 */
export function labelTabel(tabel) {
  const t = typeof tabel === 'string' ? document.querySelector(tabel) : tabel;
  if (!t) return;
  const kepala = [];
  const barisKepala = t.tHead ? t.tHead.rows[0] : t.querySelector('tr');
  if (!barisKepala) return;
  for (const th of barisKepala.cells) {
    const n = th.colSpan || 1;
    for (let i = 0; i < n; i++) kepala.push(th.textContent.trim());
  }
  const baris = t.tBodies.length ? [...t.tBodies].flatMap(b => [...b.rows]) : [...t.rows].slice(1);
  for (const tr of baris) {
    let kolom = 0;
    for (const td of tr.cells) {
      if (td.tagName === 'TD' && !td.hasAttribute('data-label')) td.setAttribute('data-label', kepala[kolom] || '');
      kolom += td.colSpan || 1;
    }
  }
  t.classList.add('tabel-kartu');
}
