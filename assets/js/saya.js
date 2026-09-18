import { apiGet, logout, arahkanKeLogin } from './api.js';
import { statusAkun, peranAktif, labelPeran, prodiPimpinan } from './akun.js';
import { esc, keadaanKosong, istilah } from './ui.js';
import { terdaftar, langkahMulai, ringkasMulai, htmlKartuLangkah, muatTugasMahasiswa } from './hal-beranda.js';

// Beranda Saya: kartu tugas sesuai peran aktif (Task-Oriented UI) — bukan menu
// navigasi umum. Bagian pertama adalah langkah kerja peran itu, sama urutan
// dan statusnya dengan checklist "Mulai di sini" di Beranda (hal-beranda.js);
// bagian kedua layanan lainnya. Peran datang dari backend
// (GET /api/proyekblok/saya lewat akun.js), bukan ditebak di browser.
// Form login hanya ada di /login/.

const isi = document.getElementById('isi');

// Kartu layanan: [judul, keterangan (HTML aman), tautan, label aksi].
function kartu([judul, keterangan, tautan, labelAksi]) {
  return `
    <div class="kartu">
      <h3>${esc(judul)}</h3>
      <p class="meta">${keterangan}</p>
      <a class="aksi" href="${esc(tautan)}">${esc(labelAksi)}</a>
    </div>`;
}

// Layanan di luar langkah kerja, per peran aktif. Laporan tingkat prodi tetap
// diputuskan backend (403 untuk yang lain).
function layananDosen() {
  return [
    ['Buat Tugas & Laporan Kemiripan', 'Buat tugas baru dan tinjau laporan kemiripan antar-kiriman.', 'dosen.html', 'Buat Tugas'],
    ['Rekaman Sesi & Tenggat', 'Terbitkan rekaman sesi daring sinkron sebelum tengah malam dan pantau yang terlambat atau belum ada.', 'rekaman.html', 'Kelola Rekaman'],
    ['Proyek Blok', `Buat ${istilah('proyek blok')} per rumpun, lihat anggotanya, dan isi nilai per mahasiswa per mata kuliah.`, 'proyek.html', 'Kelola Proyek Blok'],
    ['Proyek Kerja Bimbingan', 'Putuskan pengajuan proyek di tempat kerja, kirim tinjauan, dan terbitkan tautan tinjauan untuk atasan.', 'kerja.html', 'Buka Proyek Kerja'],
    ['Pengawas Ujian', 'Jadwalkan ujian berpengawas dan catat kehadiran mahasiswa di sesi yang Anda awasi.', 'ujian.html', 'Buka Pengawas Ujian'],
    ['Tinjau RPL', `Setujui atau tolak pengajuan ${istilah('rpl', 'RPL')}; yang disetujui jadi bukti CPL.`, 'rpl.html', 'Tinjau Pengajuan'],
    ['Hasil Autograder', `Hasil ${istilah('autograder')} atas kode mahasiswa, beserta pembagian bobotnya.`, 'autograder.html', 'Lihat Hasil'],
    ['Rapor Mahasiswa', 'Buka rapor mahasiswa per NIM, siap dicetak.', 'rapor.html', 'Buka Rapor'],
    ['Roster Mahasiswa & Email Dosen', 'Tambah atau tempel banyak mahasiswa ke roster, dan ubah email kampus Anda.', 'akademik.html', 'Kelola Roster'],
    ['Daftar Tugas', 'Tugas yang masih terbuka beserta kiriman mahasiswa.', 'portal.html', 'Buka Daftar Tugas'],
    ['Kalender Akademik', 'Jadwal semester per minggu. Kalender disusun dan diterbitkan kaprodi program studi.', 'kalender.html', 'Lihat Kalender'],
  ];
}

function layananMahasiswa() {
  return [
    ['Rekaman Sesi Sinkron', 'Tidak bisa ikut sesi daring Kamis? Tonton rekamannya sebelum sesi Jumat.', 'rekaman.html', 'Buka Rekaman'],
    ['Dasbor Belajar', `Beban belajar minggu ini dan ${istilah('cpl', 'CPL')} yang sudah terbukti dari nilai dan RPL Anda.`, 'dasbor.html', 'Buka Dasbor'],
    ['Nilai Proyek Saya', `Rekap nilai ${istilah('proyek blok')} Anda beserta rincian per mata kuliah.`, 'nilai.html', 'Lihat Nilai Saya'],
    ['Rapor Saya', 'Nilai huruf, IP per semester, dan IPK — siap dicetak.', 'rapor.html', 'Buka Rapor'],
    ['Hasil Autograder', `Hasil ${istilah('autograder')} atas kode yang Anda kirim lewat Pull Request.`, 'autograder.html', 'Lihat Hasil'],
    ['Proyek Kerja/Magang', 'Ajukan konversi pekerjaan di perusahaan jadi proyek, lalu ikuti status dan tinjauannya.', 'kerja.html', 'Ajukan / Lihat Proyek Kerja'],
    ['Rekognisi Pembelajaran Lampau', `Ajukan pengalaman kerja sebelum kuliah (${istilah('rpl', 'RPL')}) untuk diakui sebagai kredit satu rumpun.`, 'rpl.html', 'Ajukan / Lihat RPL'],
  ];
}

// Laporan tingkat prodi, dipakai kaprodi (prodinya) dan admin (semua prodi).
function layananLaporan(lingkup) {
  const l = esc(lingkup);
  return [
    ['Pantau Proyek Kerja', `Proyek kerja aktif dan yang telat tinjauan tengah semester — ${l}.`, 'kaprodi.html', 'Pantau Proyek Kerja'],
    ['Laporan Kepatuhan', `Menit kegiatan per mata kuliah terhadap tuntutan SKS, sebagai bukti ${istilah('kepatuhan', 'kepatuhan')} — ${l}.`, 'kepatuhan.html', 'Buka Laporan'],
    ['Rekap Rapor Angkatan', `Nilai huruf dan IP satu angkatan per semester — ${l}.`, 'rapor.html', 'Buka Rekap Rapor'],
    ['Rekap Rekaman', `Sesi daring sinkron yang rekamannya terlambat atau belum ada — ${l}.`, 'rekaman.html', 'Buka Rekap Rekaman'],
  ];
}

const BAGIAN_LAIN = { dosen: 'Layanan mengajar lainnya', mahasiswa: 'Layanan lainnya', kaprodi: 'Laporan prodi', admin: 'Penyiapan dan laporan semua prodi' };

function layananLain(peran, saya) {
  if (peran === 'admin') {
    return [['Program Studi Baru', 'Buat program studi baru, lalu tetapkan kaprodinya — kurikulum prodi diisi kaprodi itu.', 'kurikulum.html', 'Buat Program Studi']]
      .concat(layananLaporan('semua prodi'));
  }
  if (peran === 'kaprodi') return layananLaporan((prodiPimpinan(saya) || []).join(', ').toUpperCase());
  return peran === 'dosen' ? layananDosen() : layananMahasiswa();
}

const CATATAN_PERAN = {
  kaprodi: 'Menu mengajar — materi, kuis, tugas, dan penilaian — ada di peran dosen. Ganti lewat pemilih peran di pojok kanan atas.',
  admin: 'Admin hanya menyiapkan prodi dan kaprodinya. Menu mengajar ada di peran dosen, lewat pemilih peran di pojok kanan atas.',
};

function tombolKeluar(label = 'Keluar') {
  return `<p><button class="sekunder" id="keluar">${esc(label)}</button></p>`;
}
function pasangKeluar(keLogin = false) {
  document.getElementById('keluar').addEventListener('click', () => {
    logout();
    if (keLogin) arahkanKeLogin(); else location.href = './';
  });
}

function tampil(saya, agenda, tugas) {
  const peran = peranAktif(saya);
  const langkah = langkahMulai(peran, saya, agenda, tugas);
  const mengajar = saya.prodi_mengajar || [];

  // Dosen yang belum dicentang: tujuan tautan butir agenda "belum_pengampu".
  const pengampu = peran === 'dosen' && !mengajar.length
    ? `<div id="pengampu">${keadaanKosong({
      judul: 'Anda belum dicentang sebagai dosen pengampu',
      keterangan: 'Materi dan kuis gerbang hanya bisa disusun untuk program studi yang mencentang Anda. Centang itu diberikan kaprodi program studi tempat Anda mengajar, di halaman Dosen Pengampu Prodi. Sampaikan nama dan email kampus Anda kepadanya.',
      siapa: 'kaprodi program studi tempat Anda mengajar',
      aksi: [saya.email ? null : { href: 'akademik.html', label: 'Isi email kampus dulu' }, { href: './', label: 'Kembali ke Beranda' }].filter(Boolean),
    })}</div>`
    : '';

  // Peringatan email untuk kaprodi (dosen melihatnya di langkah 1). Admin tidak:
  // penyiapan tidak butuh email kampusnya sendiri (audit UX U24).
  const catatanEmail = peran === 'kaprodi' && !saya.email
    ? '<div class="pesan gagal">Email kampus Anda belum diisi, jadi Anda belum bisa dipilih sebagai pembimbing atau pengawas. <a href="akademik.html">Isi email kampus di halaman Roster &amp; Email Dosen</a>.</div>'
    : '';

  const jumlah = (saya.proyekblok || []).length;
  const ringkas = peran === 'dosen' ? [`mengajar di ${mengajar.length ? esc(mengajar.join(', ').toUpperCase()) : 'belum ada prodi'}`, `${jumlah} proyek blok yang Anda bimbing`]
    : peran === 'mahasiswa' ? [`NIM ${esc(saya.nim || '-')}`, `${jumlah} proyek blok yang Anda ikuti`] : [];

  const labelLangkah = { dosen: 'Langkah mengajar', kaprodi: 'Langkah kaprodi', admin: 'Langkah penyiapan', mahasiswa: 'Langkah belajar' }[peran] || 'Langkah';
  const status = ringkasMulai(langkah);

  isi.innerHTML = `
    ${catatanEmail}
    <p class="redup saya-ringkas">Peran: ${esc(labelPeran(saya))}${ringkas.length ? ` · ${ringkas.join(' · ')}` : ''}.</p>
    ${CATATAN_PERAN[peran] ? `<p class="redup saya-ringkas">${esc(CATATAN_PERAN[peran])}</p>` : ''}
    ${pengampu}
    <h2 class="saya-bagian">${esc(labelLangkah)}${status ? `<span class="kecil">${esc(status)}</span>` : ''}</h2>
    ${agenda ? '' : '<p class="pesan info">Status langkah belum bisa dihitung karena agenda tidak termuat. Tautannya tetap bisa dipakai.</p>'}
    <div class="kartu-grid">${htmlKartuLangkah(langkah)}</div>
    <h2 class="saya-bagian">${esc(BAGIAN_LAIN[peran] || 'Layanan lainnya')}</h2>
    <div class="kartu-grid">${layananLain(peran, saya).map(kartu).join('')}</div>
    ${tombolKeluar()}`;
  pasangKeluar();
  // Isi dirender sesudah muat, jadi lompatan ke #pengampu dilakukan manual.
  const sasaran = location.hash && document.getElementById(location.hash.slice(1));
  if (sasaran) sasaran.scrollIntoView();
}

const hasil = await statusAkun;
if (hasil.status === 'belum') {
  arahkanKeLogin();
} else if (hasil.status !== 'masuk') {
  const pesan = hasil.status === 'tak-terjangkau'
    ? 'Server platform tidak terjangkau. Periksa koneksi, lalu muat ulang halaman.'
    : 'Sesi login Anda sudah berakhir. Masuk lagi dengan WhatsApp.';
  isi.innerHTML = `<div class="pesan gagal">${esc(pesan)}</div>${hasil.status === 'berakhir' ? tombolKeluar('Masuk lagi') : ''}`;
  if (hasil.status === 'berakhir') pasangKeluar(true);
} else if (!terdaftar(hasil.saya)) {
  isi.innerHTML = keadaanKosong({
    judul: 'Nomor ini belum terdaftar',
    keterangan: 'Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen. Tidak ada pendaftaran mandiri: nomor didaftarkan oleh pengelola program studi.',
    siapa: 'pengelola program studi (kaprodi program studi Anda)',
    aksi: { href: './', label: 'Kembali ke Beranda' },
  }) + tombolKeluar('Masuk dengan nomor lain');
  pasangKeluar(true);
} else {
  let agenda = null;
  const tugasJanji = muatTugasMahasiswa(peranAktif(hasil.saya));
  try { agenda = await apiGet('/api/beranda/agenda', { auth: true }); } catch { /* langkah tanpa status */ }
  tampil(hasil.saya, agenda, await tugasJanji);
}
