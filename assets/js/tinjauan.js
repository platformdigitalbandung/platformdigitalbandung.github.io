import { apiGet, apiPostJson } from './api.js';

// Halaman tinjauan atasan. Atasan bukan pengguna platform ini: otorisasinya
// token dari tautan yang dikirim dosen, bukan WhatsAuth — jadi halaman ini
// sengaja tidak memakai cookie login dan tidak mengarahkan ke /login/.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

const token = new URLSearchParams(location.search).get('token') || '';

const LABEL = { 'tengah-semester': 'Tinjauan tengah semester', 'akhir': 'Tinjauan akhir' };

function formTinjauan(ringkas) {
  const sudah = ringkas.sudah_ditinjau || [];
  const pilihan = ['tengah-semester', 'akhir']
    .map(j => `<option value="${j}">${esc(LABEL[j])}${sudah.includes(j) ? ' (sudah pernah diisi — akan diperbarui)' : ''}</option>`)
    .join('');
  return `
    <div class="kartu">
      <h3>${esc(ringkas.judul_pekerjaan)}</h3>
      <p class="meta">${esc(ringkas.nama_perusahaan)} · status proyek: ${esc(ringkas.status)}</p>
      ${ringkas.deskripsi ? `<p>${esc(ringkas.deskripsi)}</p>` : ''}
      <p class="redup">Penilai: ${esc(ringkas.atasan_nama)}</p>
    </div>
    <div class="kartu">
      <h3>Kirim Penilaian</h3>
      <form id="form-tinjauan">
        <label>Jenis tinjauan <select name="jenis" required>${pilihan}</select></label>
        <label>Skor (0–100) <input type="number" name="skor" min="0" max="100" step="0.1" required></label>
        <label>Catatan <textarea name="catatan" rows="3" placeholder="Kontribusi nyata mahasiswa, kualitas kerja, hal yang perlu diperbaiki"></textarea></label>
        <button>Kirim Tinjauan</button>
      </form>
      <div id="hasil"></div>
    </div>`;
}

async function kirim(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil');
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const r = await apiPostJson('/api/proyekkerja/tinjauan-atasan', {
      token, jenis: fd.get('jenis'), skor: Number(fd.get('skor')), catatan: fd.get('catatan') || '',
    });
    hasil.innerHTML = `<div class="pesan sukses">Terima kasih, tinjauan tersimpan (${esc(LABEL[r.jenis] || r.jenis)}, skor ${r.skor}).
      Status proyek sekarang: <b>${esc(r.status_proyek)}</b>.</div>`;
    e.target.reset();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal mengirim: ${esc(err.message)}</div>`;
  }
}

if (!token) {
  isi.innerHTML = '<div class="pesan gagal">Tautan tidak lengkap. Mohon buka kembali tautan tinjauan yang dikirim dosen pembimbing.</div>';
} else {
  try {
    const ringkas = await apiGet(`/api/proyekkerja/tinjauan-atasan?token=${encodeURIComponent(token)}`);
    isi.innerHTML = formTinjauan(ringkas);
    document.getElementById('form-tinjauan').addEventListener('submit', kirim);
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
      <p class="redup">Tautan tinjauan berlaku 14 hari. Kalau sudah lewat, mohon minta tautan baru ke dosen pembimbing.</p>`;
  }
}
