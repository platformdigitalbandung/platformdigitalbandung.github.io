import { apiGet, apiPostJson } from './api.js';
import { esc } from './ui.js';
import { sayaHalaman, halamanMengajar } from './hal-dosen.js';

const isi = document.getElementById('isi');

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
            `<option value="${esc(t.id)}">${esc(t.judul)} (${esc(t.n_kiriman)} kiriman)</option>`).join('')}
          </select></label>
        <button id="muat">Tampilkan Laporan</button>`
        : '<p class="redup">Belum ada tugas. Buat tugas di atas; laporannya muncul di sini setelah mahasiswa mengumpulkan.</p>'}
      <div id="laporan"></div>
    </div>`;

  document.getElementById('buat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const h = document.getElementById('hasil-buat');
    try {
      const r = await apiPostJson('/api/tugas', {
        judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '' });
      const link = `${location.origin}${location.pathname.replace('dosen.html', '')}tugas.html?id=${encodeURIComponent(r.id)}`;
      // Panel dirender ulang supaya tugas baru masuk daftar laporan; pesannya
      // ditulis sesudahnya, kalau tidak ikut terhapus.
      await tampilPanel();
      document.getElementById('hasil-buat').innerHTML = `<div class="pesan sukses">Tugas <b>${esc(r.judul || '')}</b> dibuat.
        Bagikan tautan ini ke mahasiswa:<br><a href="${esc(link)}">${esc(link)}</a></div>`;
    } catch (err) { h.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`; }
  });

  const muat = document.getElementById('muat');
  if (muat) muat.addEventListener('click', async () => {
    const tid = document.getElementById('pilih').value;
    const lap = document.getElementById('laporan');
    lap.innerHTML = '<p class="redup">Memuat laporan…</p>';
    try {
      const d = await apiGet(`/api/tugas/${tid}/laporan`, { auth: true });
      const lencana = (b) => b === '-' ? '<span class="redup">–</span>' : `<span class="lencana ${b}">${b}</span>`;
      // Nomor urut kiriman menggantikan ObjectID mentah di tampilan; rujukan
      // "paling mirip dengan" dan tabel pasangan memakai nomor yang sama.
      const nomor = new Map(d.per_kiriman.map((r, i) => [r.id, i + 1]));
      const noKiriman = id => `#${nomor.get(id) ?? '?'}`;
      const baris = d.per_kiriman.map(r => `
        <tr class="band-${r.band}"><td class="num">${noKiriman(r.id)}</td>
          <td>${esc(r.nama)} <span class="redup">(${esc(r.nim)})</span></td>
          <td class="num">${r.max_score ?? '–'}</td>
          <td>${r.pasangan_id ? noKiriman(r.pasangan_id) + ' ' + esc(r.pasangan_nama || '') : '–'}</td>
          <td>${lencana(r.band)}</td></tr>`).join('');
      const pas = d.pasangan.slice(0, 20).map(p => `
        <tr class="band-${p.band}"><td class="num">${noKiriman(p.a_id)} <span class="redup">${esc(p.a_nama)}</span></td>
          <td class="num">${noKiriman(p.b_id)} <span class="redup">${esc(p.b_nama)}</span></td>
          <td class="num">${p.score}</td><td>${lencana(p.band)}</td></tr>`).join('');
      lap.innerHTML = `
        <h4>Per kiriman</h4>
        <div class="gulir"><table><thead><tr><th>Kiriman</th><th>Mahasiswa</th><th class="num">Skor maks</th>
          <th>Paling mirip dengan</th><th>Band</th></tr></thead><tbody>${baris || '<tr><td colspan="5">Belum ada kiriman</td></tr>'}</tbody></table></div>
        <h4>Pasangan paling mirip (top 20)</h4>
        <div class="gulir"><table><thead><tr><th>A</th><th>B</th><th class="num">Skor</th><th>Band</th></tr></thead><tbody>${pas || '<tr><td colspan="4">–</td></tr>'}</tbody></table></div>`;
    } catch (err) { lap.innerHTML = `<div class="pesan gagal">Gagal memuat laporan: ${esc(err.message)}</div>`; }
  });

  bukaLaporanDariTautan(tugas);
}

// Tautan dari bot WhatsApp ("laporan tugas <id>"): dosen.html?laporan=<id>
// langsung membuka laporan kemiripan tugas itu. Id wajib ObjectID (24 heksa)
// dan harus ada di daftar tugas; selain itu hanya diberi tahu, tidak dimuat.
function bukaLaporanDariTautan(tugas) {
  const diminta = new URLSearchParams(location.search).get('laporan');
  if (!diminta) return;
  const lap = document.getElementById('laporan');
  const pilih = document.getElementById('pilih');
  if (!/^[0-9a-f]{24}$/i.test(diminta) || !pilih || !tugas.some(t => t.id === diminta)) {
    if (lap) lap.innerHTML = `<div class="pesan gagal">Tugas #${esc(diminta)} dari tautan tidak ditemukan. Pilih tugas dari daftar di atas.</div>`;
    else isi.insertAdjacentHTML('afterbegin', `<div class="pesan gagal">Tugas #${esc(diminta)} dari tautan tidak ditemukan.</div>`);
    return;
  }
  pilih.value = diminta;
  document.getElementById('muat').click();
  lap.closest('.kartu').scrollIntoView({ block: 'start' });
}

// Satu pola penolakan untuk semua halaman kerja dosen (audit UX U15): kartu
// peran dari ui.js, tanpa mengeluarkan pengguna. Kewenangan membuat tugas dan
// membuka laporan tetap diperiksa backend (VerifyDosen).
async function mulai() {
  const saya = await sayaHalaman(isi);
  if (saya === undefined) return;
  if (!halamanMengajar(saya, isi, {
    judul: 'Buat Tugas & Laporan Kemiripan',
    pesan: 'Membuat tugas dan memeriksa kemiripan kiriman dikerjakan di peran dosen.',
    untukMahasiswa: { href: 'portal.html', label: 'Buka Tugas', pesan: 'Tugas yang harus Anda kumpulkan ada di halaman Tugas.' },
  })) return;
  try { await tampilPanel(); }
  catch (err) { isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`; }
}

mulai();
