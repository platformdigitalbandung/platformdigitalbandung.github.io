import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { API_BASE } from './config.js';

const isi = document.getElementById('isi');
const status = document.getElementById('status-backend');

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

if (!isLoggedIn()) {
  arahkanKeLogin();
} else try {
  await apiGet('/health');
  status.innerHTML = `<span class="status-dot ok"></span>backend tersambung (${API_BASE})`;
  const { tugas } = await apiGet('/api/tugas');
  // Pengumpulan khusus mahasiswa di roster (backend menolak yang lain), jadi
  // dosen tidak ditawari tombol Kumpulkan Jawaban — cukup ke laporan kemiripan.
  const saya = await sayaSekarang;
  const dosen = Boolean(saya && saya.peran === 'dosen');
  if (!tugas.length) {
    isi.innerHTML = '<div class="kosong">Belum ada tugas. Dosen dapat membuat tugas lewat Halaman Dosen.</div>';
  } else {
    isi.innerHTML = tugas.map(t => `
      <div class="kartu">
        <h3>${esc(t.judul)}</h3>
        <p class="meta">#${t.id} · ${t.n_kiriman} kiriman</p>
        ${dosen
          ? '<a class="aksi sekunder" href="dosen.html">Laporan Kemiripan</a>'
          : `<a class="aksi" href="tugas.html?id=${t.id}">Kumpulkan Jawaban</a>`}
      </div>`).join('');
  }
} catch (err) {
  status.innerHTML = `<span class="status-dot gagal"></span>backend tidak terjangkau (${API_BASE})`;
  isi.innerHTML = `<div class="pesan gagal">Tidak bisa memuat daftar tugas: ${esc(err.message)}.</div>`;
}
