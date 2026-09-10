import { apiGet, gantiAlamatBackend } from './api.js';
import { API_BASE } from './config.js';

document.getElementById('ganti-backend').onclick = (e) => { e.preventDefault(); gantiAlamatBackend(); };

const isi = document.getElementById('isi');
const status = document.getElementById('status-backend');

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

try {
  await apiGet('/health');
  status.innerHTML = `<span class="status-dot ok"></span>backend tersambung (${API_BASE})`;
  const { tugas } = await apiGet('/api/tugas');
  if (!tugas.length) {
    isi.innerHTML = '<div class="kosong">Belum ada tugas. Dosen dapat membuat tugas lewat Halaman Dosen.</div>';
  } else {
    isi.innerHTML = tugas.map(t => `
      <div class="kartu">
        <h3>${esc(t.judul)}</h3>
        <p class="meta">#${t.id} · ${t.n_kiriman} kiriman</p>
        <a class="aksi" href="tugas.html?id=${t.id}">Kumpulkan Jawaban</a>
      </div>`).join('');
  }
} catch (err) {
  status.innerHTML = `<span class="status-dot gagal"></span>backend tidak terjangkau (${API_BASE})`;
  isi.innerHTML = `<div class="pesan gagal">Tidak bisa memuat daftar tugas: ${esc(err.message)}.<br>
    Pastikan backend jalan, atau ganti <a href="#" onclick="return false" id="gb2">alamat backend</a>.</div>`;
  document.getElementById('gb2').onclick = () => gantiAlamatBackend();
}
