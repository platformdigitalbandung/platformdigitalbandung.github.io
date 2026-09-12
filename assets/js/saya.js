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
    : kartu('Nilai Proyek Saya', 'Lihat rekap nilai proyek blok Anda beserta rincian per mata kuliah.', 'nilai.html', 'Lihat Nilai Saya');

  const catatanNIP = dosen && !saya.nip
    ? '<div class="pesan gagal">Nomor ini terdaftar sebagai dosen, tetapi NIP-nya belum diisi di data dosen. Pembuatan dan penilaian proyek blok baru bisa dilakukan setelah NIP dilengkapi pengelola.</div>'
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
