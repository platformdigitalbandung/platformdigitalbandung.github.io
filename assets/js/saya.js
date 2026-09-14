import { apiGet, isLoggedIn, logout, arahkanKeLogin } from './api.js';
import { peranAktif, labelPeran, prodiPimpinan } from './akun.js';

// Beranda Saya: kartu tugas sesuai peran (Task-Oriented UI) — bukan menu
// navigasi umum. Peran datang dari backend (GET /api/proyekblok/saya), bukan
// ditebak di browser. Form login hanya ada di /login/.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function kartu(judul, keterangan, tautan, labelAksi) {
  return `
    <div class="kartu">
      <h3>${esc(judul)}</h3>
      <p class="meta">${esc(keterangan)}</p>
      <a class="aksi" href="${tautan}">${esc(labelAksi)}</a>
    </div>`;
}

// Kartu per peran aktif (pemilih peran di bilah atas, akun.js). Tiap peran
// punya kartu sendiri: admin menyiapkan prodi dan kaprodi, kaprodi menjalankan
// kurikulum, pengampu, dan laporan prodinya, dosen mengajar dan menilai.
// Laporan tingkat prodi tetap diputuskan backend (403 untuk yang lain).
function kartuUmum() {
  return kartu('Daftar Tugas', 'Lihat tugas yang terbuka dan kumpulkan jawabannya.', 'portal.html', 'Buka Daftar Tugas')
    + kartu('Kalender Akademik', 'Jadwal per minggu: moda, jam, dan keterangan tiap sesi.', 'kalender.html', 'Lihat Kalender');
}

function kartuDosen() {
  return kartuUmum()
    + kartu('Buat Tugas & Laporan Kemiripan', 'Buat tugas baru dan tinjau laporan kemiripan antar-kiriman.', 'dosen.html', 'Buka Halaman Dosen')
    + kartu('Kelola Proyek Blok', 'Buat instance proyek per rumpun, lihat anggotanya, dan input nilai per mahasiswa per mata kuliah.', 'proyek.html', 'Kelola Proyek Blok')
    + kartu('Kelola Kalender', 'Buat draft kalender semester dari ritme mingguan, lalu terbitkan sebelum semester mulai.', 'kalender.html', 'Kelola Kalender')
    + kartu('Proyek Kerja Bimbingan', 'Putuskan pengajuan proyek di tempat kerja, kirim tinjauan, dan terbitkan tautan tinjauan untuk atasan.', 'kerja.html', 'Buka Proyek Kerja')
    + kartu('Roster Mahasiswa & Email Dosen', 'Isi email kampus Anda, tambah atau tempel banyak mahasiswa ke roster — sumber identitas akademik seluruh modul.', 'akademik.html', 'Kelola Roster')
    + kartu('Tinjau RPL', 'Setujui atau tolak pengajuan rekognisi pembelajaran lampau; yang disetujui jadi bukti CPL.', 'rpl.html', 'Tinjau Pengajuan')
    + kartu('Kuis Gerbang', 'Susun kuis pilihan ganda per prodi, rumpun, dan minggu untuk prodi tempat Anda mengajar, lalu cek apakah mahasiswa sudah lulus sebelum sesi Jumat.', 'kuis.html', 'Kelola Kuis')
    + kartu('Pengawas Ujian', 'Jadwalkan ujian berpengawas dan catat kehadiran mahasiswa di sesi yang Anda awasi.', 'ujian.html', 'Buka Pengawas Ujian')
    + kartu('Rekaman Sesi & Tenggat', 'Terbitkan rekaman sesi daring sinkron sebelum tengah malam dan pantau yang terlambat atau belum ada.', 'rekaman.html', 'Kelola Rekaman')
    + kartu('Forum Tanya Mahasiswa', 'Balas pertanyaan mahasiswa sebelum target 1×24 jam (dihitung Senin–Rabu).', 'forum.html', 'Buka Forum')
    + kartu('Rapor Mahasiswa', 'Buka rapor mahasiswa per NIM, siap dicetak.', 'rapor.html', 'Buka Rapor')
    + kartu('Kelola Materi', 'Tambah video YouTube dan bacaan asinkron per minggu rumpun untuk prodi tempat Anda mengajar — progres mahasiswa hanya tercatat untuk materi di katalog ini.', 'kelola-materi.html', 'Kelola Materi')
    + kartu('Hasil Autograder', 'Hasil tes otomatis atas kode yang dikirim mahasiswa lewat Pull Request, beserta pengaturan pembagian bobotnya.', 'autograder.html', 'Lihat Hasil Autograder');
}

function kartuMahasiswa() {
  return kartuUmum()
    + kartu('Dasbor Belajar', 'Beban belajar minggu ini dan capaian pembelajaran (CPL) yang sudah terbukti dari nilai dan RPL Anda.', 'dasbor.html', 'Buka Dasbor')
    + kartu('Rekaman Sesi Sinkron', 'Tidak bisa ikut sesi daring Kamis? Tonton rekamannya sebelum sesi Jumat.', 'rekaman.html', 'Buka Rekaman')
    + kartu('Forum Tanya Dosen', 'Tersendat di materi asinkron Senin–Rabu? Ajukan pertanyaan; dosen menargetkan jawaban 1×24 jam.', 'forum.html', 'Buka Forum')
    + kartu('Materi Pekan Ini', 'Tonton video dan baca materi asinkron pekan ini; progresnya tercatat otomatis.', 'materi.html', 'Buka Materi')
    + kartu('Kuis Gerbang', 'Kerjakan kuis materi asinkron pekan ini sebelum sesi tatap muka Jumat.', 'kuis.html', 'Kerjakan Kuis')
    + kartu('Hasil Autograder', 'Hasil tes otomatis atas kode yang Anda kirim lewat Pull Request: tes dosen, coverage, dan skornya.', 'autograder.html', 'Lihat Hasil')
    + kartu('Rekognisi Pembelajaran Lampau', 'Ajukan pengalaman kerja sebelum kuliah untuk diakui sebagai kredit satu rumpun.', 'rpl.html', 'Ajukan / Lihat RPL')
    + kartu('Rapor Saya', 'Nilai huruf, IP per semester, dan IPK — siap dicetak.', 'rapor.html', 'Buka Rapor')
    + kartu('Nilai Proyek Saya', 'Lihat rekap nilai proyek blok Anda beserta rincian per mata kuliah.', 'nilai.html', 'Lihat Nilai Saya')
    + kartu('Proyek Kerja/Magang', 'Ajukan konversi pekerjaan di perusahaan jadi proyek, lalu ikuti status dan tinjauannya.', 'kerja.html', 'Ajukan / Lihat Proyek Kerja');
}

// Laporan tingkat prodi, dipakai kaprodi (prodinya) dan admin (semua prodi).
function kartuLaporan(lingkup) {
  return kartu('Pantau Proyek Kerja', `Proyek kerja aktif dan yang telat tinjauan tengah semester, beserta siapa yang belum menilai — ${lingkup}.`, 'kaprodi.html', 'Pantau Proyek Kerja')
    + kartu('Laporan Kepatuhan', `Menit asinkron, daring, dan luring per mata kuliah terhadap tuntutan SKS, beserta bukti nilai dan CPL — ${lingkup}.`, 'kepatuhan.html', 'Buka Laporan')
    + kartu('Rekap Rapor Angkatan', `Nilai huruf dan IP satu angkatan per semester, siap dicetak — ${lingkup}.`, 'rapor.html', 'Buka Rekap Rapor')
    + kartu('SLA Forum', `Pertanyaan mahasiswa yang lewat target jawaban 1×24 jam — ${lingkup}.`, 'forum.html', 'Buka SLA Forum')
    + kartu('Rekap Rekaman', `Sesi daring sinkron yang rekamannya terlambat atau belum ada — ${lingkup}.`, 'rekaman.html', 'Buka Rekap Rekaman');
}

function kartuKaprodi(saya) {
  const lingkup = (prodiPimpinan(saya) || []).join(', ').toUpperCase();
  return kartu('Kurikulum Program Studi', `Isi rumpun beserta mata kuliahnya, CPL, dan ritme mingguan — prasyarat sebelum kalender, roster, dan dasbor bisa dipakai prodi itu — ${lingkup}.`, 'kurikulum.html', 'Kelola Kurikulum')
    + kartu('Dosen Pengampu Prodi', `Centang dosen yang mengajar di prodi Anda — mereka yang bisa menyusun kuis gerbang dan materi — ${lingkup}.`, 'pengampu.html', 'Atur Pengampu')
    + kartu('Kalender Akademik', `Susun draft kalender semester dari ritme mingguan, lalu terbitkan sebelum semester mulai — ${lingkup}.`, 'kalender.html', 'Kelola Kalender')
    + kartuLaporan(lingkup);
}

function kartuAdmin() {
  return kartu('Kelola Kaprodi', 'Tetapkan atau ganti kaprodi tiap program studi, atau kosongkan jabatannya.', 'jabatan.html', 'Kelola Kaprodi')
    + kartu('Program Studi Baru', 'Buat program studi baru, lalu tetapkan kaprodinya — kurikulum prodi diisi kaprodi itu.', 'kurikulum.html', 'Buat Program Studi')
    + kartuLaporan('semua prodi');
}

const CATATAN_PERAN = {
  kaprodi: 'Menu mengajar — materi, kuis, tugas, dan penilaian — ada di peran dosen. Ganti lewat pemilih peran di pojok kanan atas.',
  admin: 'Admin hanya menyiapkan prodi dan kaprodinya. Menu mengajar ada di peran dosen, lewat pemilih peran di pojok kanan atas.',
};

function tampil(saya) {
  const dosen = saya.peran === 'dosen';
  const peran = peranAktif(saya);
  const kartuPeran = peran === 'admin' ? kartuAdmin()
    : peran === 'kaprodi' ? kartuKaprodi(saya)
      : dosen ? kartuDosen() : kartuMahasiswa();

  const catatanEmail = dosen && !saya.email
    ? '<div class="pesan gagal">Nomor ini terdaftar sebagai dosen, tetapi email kampusnya belum diisi. Pembuatan dan penilaian proyek blok baru bisa dilakukan setelah email kampus terisi — <a href="akademik.html">isi email kampus Anda di halaman Roster &amp; Email Dosen</a>.</div>'
    : '';

  const jumlah = (saya.proyekblok || []).length;
  const ringkas = peran === 'admin' || peran === 'kaprodi' ? ''
    : dosen ? ` · ${jumlah} proyek blok yang Anda bimbing.`
      : ` · ${jumlah} proyek blok yang Anda ikuti${saya.nim ? ` · NIM ${esc(saya.nim)}` : ''}.`;

  isi.innerHTML = `
    ${catatanEmail}
    <p class="redup">Peran: ${esc(labelPeran(saya))}${ringkas}</p>
    ${CATATAN_PERAN[peran] ? `<p class="redup">${esc(CATATAN_PERAN[peran])}</p>` : ''}
    <div class="kartu-grid">${kartuPeran}</div>
    <p><button class="sekunder" id="keluar">Keluar</button></p>`;

  document.getElementById('keluar').addEventListener('click', () => { logout(); location.href = './'; });
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    tampil(await apiGet('/api/proyekblok/saya', { auth: true }));
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
      <p><button class="sekunder" id="masuk-lagi">Masuk dengan nomor lain</button></p>`;
    document.getElementById('masuk-lagi').addEventListener('click', () => { logout(); arahkanKeLogin(); });
  }
}
