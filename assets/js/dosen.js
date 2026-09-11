import { apiGet, apiPostJson, isLoggedIn, logout, arahkanKeLogin } from './api.js';

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Form login hanya ada di repo login (/login/) — halaman ini tidak punya form
// login sendiri, cukup mengarahkan ke sana (lihat pdb/README.md bagian Frontend).
function tampilBukanDosen(pesan) {
  isi.innerHTML = `
    <div class="pesan gagal">${esc(pesan)}</div>
    <div class="kartu">
      <h3>Halaman Dosen</h3>
      <p class="meta">Nomor WhatsApp yang sedang masuk belum dikenali sebagai dosen Portal Tugas.</p>
      <button id="ganti-akun">Masuk dengan nomor lain</button>
    </div>`;
  document.getElementById('ganti-akun').onclick = () => { logout(); arahkanKeLogin(); };
}

async function tampilPanel() {
  const { tugas } = await apiGet('/api/tugas');
  isi.innerHTML = `
    <div class="kartu">
      <h3>Buat Tugas Baru</h3>
      <form id="buat">
        <label>Judul<input name="judul" required maxlength="200"></label>
        <label>Deskripsi<textarea name="deskripsi" rows="3"></textarea></label>
        <button>Simpan Tugas</button>
      </form>
      <div id="hasil-buat"></div>
    </div>
    <div class="kartu">
      <h3>Laporan Kemiripan</h3>
      ${tugas.length ? `
        <label>Pilih tugas
          <select id="pilih">${tugas.map(t =>
            `<option value="${t.id}">#${t.id} — ${esc(t.judul)} (${t.n_kiriman} kiriman)</option>`).join('')}
          </select></label>
        <button id="muat">Tampilkan Laporan</button>`
        : '<p class="redup">Belum ada tugas.</p>'}
      <div id="laporan"></div>
    </div>
    <p><button class="sekunder" id="keluar">Keluar</button></p>`;

  document.getElementById('keluar').onclick = () => { logout(); location.href = './'; };

  document.getElementById('buat').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const h = document.getElementById('hasil-buat');
    try {
      const r = await apiPostJson('/api/tugas', {
        judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '' });
      const link = `${location.origin}${location.pathname.replace('dosen.html', '')}tugas.html?id=${r.id}`;
      h.innerHTML = `<div class="pesan sukses">Tugas <b>#${r.id}</b> dibuat.
        Bagikan tautan ini ke mahasiswa:<br><a href="${link}">${link}</a></div>`;
      tampilPanel();
    } catch (err) { h.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`; }
  };

  const muat = document.getElementById('muat');
  if (muat) muat.onclick = async () => {
    const tid = document.getElementById('pilih').value;
    const lap = document.getElementById('laporan');
    lap.innerHTML = '<p class="redup">Memuat laporan…</p>';
    try {
      const d = await apiGet(`/api/tugas/${tid}/laporan`, { auth: true });
      const lencana = (b) => b === '-' ? '<span class="redup">–</span>' : `<span class="lencana ${b}">${b}</span>`;
      const baris = d.per_kiriman.map(r => `
        <tr class="band-${r.band}"><td class="num">#${r.id}</td>
          <td>${esc(r.nama)} <span class="redup">(${esc(r.nim)})</span></td>
          <td class="num">${r.max_score ?? '–'}</td>
          <td>${r.pasangan_id ? '#' + r.pasangan_id + ' ' + esc(r.pasangan_nama || '') : '–'}</td>
          <td>${lencana(r.band)}</td></tr>`).join('');
      const pas = d.pasangan.slice(0, 20).map(p => `
        <tr class="band-${p.band}"><td class="num">#${p.a_id} <span class="redup">${esc(p.a_nama)}</span></td>
          <td class="num">#${p.b_id} <span class="redup">${esc(p.b_nama)}</span></td>
          <td class="num">${p.score}</td><td>${lencana(p.band)}</td></tr>`).join('');
      lap.innerHTML = `
        <h4>Per kiriman</h4>
        <div class="gulir"><table><tr><th>Kiriman</th><th>Mahasiswa</th><th class="num">Skor maks</th>
          <th>Paling mirip dengan</th><th>Band</th></tr>${baris || '<tr><td colspan="5">Belum ada kiriman</td></tr>'}</table></div>
        <h4>Pasangan paling mirip (top 20)</h4>
        <div class="gulir"><table><tr><th>A</th><th>B</th><th class="num">Skor</th><th>Band</th></tr>${pas || '<tr><td colspan="4">–</td></tr>'}</table></div>`;
    } catch (err) { lap.innerHTML = `<div class="pesan gagal">Gagal memuat laporan: ${esc(err.message)}</div>`; }
  };
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try { await apiGet('/api/dosen/ping', { auth: true }); tampilPanel(); }
  catch (err) { tampilBukanDosen(err.message); }
}
