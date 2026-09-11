import { apiGet, apiPostBerkas } from './api.js';

const id = new URLSearchParams(location.search).get('id');
const isi = document.getElementById('isi');

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

try {
  if (!id) throw new Error('ID tugas tidak ada di URL');
  const t = await apiGet(`/api/tugas/${id}`);
  isi.innerHTML = `
    <div class="kartu">
      <h3>${esc(t.judul)}</h3>
      <p>${esc(t.deskripsi) || '<span class="redup">Tanpa deskripsi.</span>'}</p>
    </div>
    <div class="kartu">
      <h3>Kirim Jawaban</h3>
      <form id="form">
        <label>Nama lengkap<input name="nama" required maxlength="120"></label>
        <label>NIM<input name="nim" required maxlength="40"></label>
        <label>Berkas jawaban
          <input type="file" id="berkas" name="berkas" required accept=".txt,.docx,.pdf"></label>
        <button id="kirim">Unggah Jawaban</button>
      </form>
      <div id="hasil"></div>
    </div>`;

  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('kirim');
    const hasil = document.getElementById('hasil');
    btn.disabled = true; hasil.innerHTML = '<p class="redup">Mengunggah…</p>';
    try {
      const fd = new FormData(e.target);
      const r = await apiPostBerkas(`/api/tugas/${id}/kirim`,
        { nama: fd.get('nama'), nim: fd.get('nim') }, 'berkas', 'berkas');
      hasil.innerHTML = `<div class="pesan sukses">Jawaban terkirim ✔ Nomor kiriman
        <b>#${r.kiriman_id}</b> (${r.n_kata} kata terbaca). Simpan nomor ini sebagai bukti.</div>`;
      e.target.reset();
    } catch (err) {
      hasil.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
    } finally { btn.disabled = false; }
  };
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
}
