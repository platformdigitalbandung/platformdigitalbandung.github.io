import { apiGet, isLoggedIn, logout, arahkanKeLogin } from './api.js';

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

function tampil(saya) {
  const dosen = saya.peran === 'dosen';
  const kartuUmum = kartu('Daftar Tugas', 'Lihat tugas yang terbuka dan kumpulkan jawabannya.', 'portal.html', 'Buka Daftar Tugas')
    + kartu('Kalender Akademik', 'Jadwal per minggu: moda, jam, dan keterangan tiap sesi.', 'kalender.html', 'Lihat Kalender');

  const kartuPeran = dosen
    ? kartu('Buat Tugas & Laporan Kemiripan', 'Buat tugas baru dan tinjau laporan kemiripan antar-kiriman.', 'dosen.html', 'Buka Halaman Dosen')
      + kartu('Kelola Proyek Blok', 'Buat instance proyek per rumpun, lihat anggotanya, dan input nilai per mahasiswa per mata kuliah.', 'proyek.html', 'Kelola Proyek Blok')
      + kartu('Kelola Kalender', 'Buat draft kalender semester dari ritme mingguan, lalu terbitkan sebelum semester mulai.', 'kalender.html', 'Kelola Kalender')
      + kartu('Proyek Kerja Bimbingan', 'Putuskan pengajuan proyek di tempat kerja, kirim tinjauan, dan terbitkan tautan tinjauan untuk atasan.', 'kerja.html', 'Buka Proyek Kerja')
      + kartu('Roster Mahasiswa & NIP', 'Isi NIP Anda, tambah atau tempel banyak mahasiswa ke roster — sumber identitas akademik seluruh modul.', 'akademik.html', 'Kelola Roster')
      + kartu('Tinjau RPL', 'Setujui atau tolak pengajuan rekognisi pembelajaran lampau; yang disetujui jadi bukti CPL.', 'rpl.html', 'Tinjau Pengajuan')
      + kartu('Status Kuis Gerbang', 'Cek apakah mahasiswa sudah lulus kuis gerbang sebelum sesi Jumat.', 'kuis.html', 'Cek Status Kuis')
      + kartu('Pengawas Ujian', 'Jadwalkan ujian berpengawas dan catat kehadiran mahasiswa di sesi yang Anda awasi.', 'ujian.html', 'Buka Pengawas Ujian')
      + kartu('Pantau Proyek Kerja', 'Untuk kaprodi: proyek kerja aktif dan yang telat tinjauan tengah semester, beserta siapa yang belum menilai.', 'kaprodi.html', 'Pantau Proyek Kerja')
      + kartu('Rekaman Sesi & Tenggat', 'Terbitkan rekaman sesi daring sinkron sebelum tengah malam dan pantau yang terlambat atau belum ada.', 'rekaman.html', 'Kelola Rekaman')
      + kartu('Forum & SLA Jawaban','Balas pertanyaan mahasiswa dan pantau yang lewat target 1×24 jam (dihitung Senin–Rabu).', 'forum.html', 'Buka Forum')
      + kartu('Rapor & Rekap Nilai', 'Buka rapor mahasiswa per NIM atau rekap nilai huruf dan IP satu angkatan per semester, siap dicetak.', 'rapor.html', 'Buka Rapor')
      + kartu('Laporan Kepatuhan','Menit asinkron, daring, dan luring per mata kuliah terhadap tuntutan SKS, beserta bukti nilai dan CPL — siap dicetak untuk akreditasi.', 'kepatuhan.html', 'Buka Laporan')
      + kartu('Kelola Materi','Tambah video YouTube dan bacaan asinkron per minggu rumpun — progres mahasiswa hanya tercatat untuk materi di katalog ini.', 'kelola-materi.html', 'Kelola Materi')
      + kartu('Hasil Autograder','Hasil tes otomatis atas kode yang dikirim mahasiswa lewat Pull Request, beserta pengaturan pembagian bobotnya.', 'autograder.html', 'Lihat Hasil Autograder')
      + kartu('Kurikulum Program Studi','Daftarkan prodi, rumpun beserta mata kuliahnya, CPL, dan ritme mingguan — prasyarat sebelum kalender, roster, dan dasbor bisa dipakai prodi itu.', 'kurikulum.html', 'Kelola Kurikulum')
    : kartu('Dasbor Belajar', 'Beban belajar minggu ini dan capaian pembelajaran (CPL) yang sudah terbukti dari nilai dan RPL Anda.', 'dasbor.html', 'Buka Dasbor')
      + kartu('Rekaman Sesi Sinkron', 'Tidak bisa ikut sesi daring Kamis? Tonton rekamannya sebelum sesi Jumat.', 'rekaman.html', 'Buka Rekaman')
      + kartu('Forum Tanya Dosen','Tersendat di materi asinkron Senin–Rabu? Ajukan pertanyaan; dosen menargetkan jawaban 1×24 jam.', 'forum.html', 'Buka Forum')
      + kartu('Materi Pekan Ini','Tonton video dan baca materi asinkron pekan ini; progresnya tercatat otomatis.', 'materi.html', 'Buka Materi')
      + kartu('Kuis Gerbang', 'Kerjakan kuis materi asinkron pekan ini sebelum sesi tatap muka Jumat.', 'kuis.html', 'Kerjakan Kuis')
      + kartu('Hasil Autograder', 'Hasil tes otomatis atas kode yang Anda kirim lewat Pull Request: tes dosen, coverage, dan skornya.', 'autograder.html', 'Lihat Hasil')
      + kartu('Rekognisi Pembelajaran Lampau', 'Ajukan pengalaman kerja sebelum kuliah untuk diakui sebagai kredit satu rumpun.', 'rpl.html', 'Ajukan / Lihat RPL')
      + kartu('Rapor Saya', 'Nilai huruf, IP per semester, dan IPK — siap dicetak.', 'rapor.html', 'Buka Rapor')
      + kartu('Nilai Proyek Saya','Lihat rekap nilai proyek blok Anda beserta rincian per mata kuliah.', 'nilai.html', 'Lihat Nilai Saya')
      + kartu('Proyek Kerja/Magang', 'Ajukan konversi pekerjaan di perusahaan jadi proyek, lalu ikuti status dan tinjauannya.', 'kerja.html', 'Ajukan / Lihat Proyek Kerja');

  const catatanNIP = dosen && !saya.nip
    ? '<div class="pesan gagal">Nomor ini terdaftar sebagai dosen, tetapi NIP-nya belum diisi di data dosen. Pembuatan dan penilaian proyek blok baru bisa dilakukan setelah NIP terisi — <a href="akademik.html">isi NIP Anda di halaman Roster &amp; NIP</a>.</div>'
    : '';

  const jumlah = (saya.proyekblok || []).length;
  const ringkas = dosen
    ? `${jumlah} proyek blok yang Anda bimbing.`
    : `${jumlah} proyek blok yang Anda ikuti${saya.nim ? ` · NIM ${esc(saya.nim)}` : ''}.`;

  isi.innerHTML = `
    ${catatanNIP}
    <p class="redup">Peran: ${esc(saya.peran)} · ${ringkas}</p>
    <div class="kartu-grid">${kartuUmum}${kartuPeran}</div>
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
