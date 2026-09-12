import { apiGet, apiPostJson, isLoggedIn } from './api.js';

// Kalender akademik. Baca publik (hanya kalender yang sudah diterbitkan);
// pembuatan draft dan penerbitan hanya muncul kalau backend memang mengenali
// nomor yang sedang masuk sebagai dosen — kewenangannya tetap dicek server.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

const HARI_TANGGAL = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
function tanggal(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : d.toLocaleDateString('id-ID', HARI_TANGGAL);
}

let dosen = false;

function tabelSesi(sesi) {
  if (!sesi || !sesi.length) return '<p class="redup">Kalender ini belum punya sesi.</p>';
  return `<div class="gulir"><table>
      <tr><th class="num">Minggu</th><th>Tanggal</th><th>Moda</th><th>Jam</th><th>Keterangan</th></tr>
      ${sesi.map(s => `<tr>
        <td class="num">${s.minggu}</td>
        <td>${esc(tanggal(s.tanggal))}</td>
        <td>${esc(s.moda)}</td>
        <td>${s.jam_mulai ? `${esc(s.jam_mulai)}–${esc(s.jam_selesai || '')}` : '<span class="redup">–</span>'}</td>
        <td>${esc(s.keterangan || '')}</td></tr>`).join('')}
    </table></div>`;
}

function kartuKalender(k) {
  const status = k.diterbitkan
    ? '<span class="lencana rendah">terbit</span>'
    : '<span class="lencana sedang">draft</span>';
  const tombolTerbit = (!k.diterbitkan && dosen)
    ? `<button class="sekunder terbitkan" data-id="${esc(k.id)}">Terbitkan Kalender Ini</button>`
    : '';
  return `
    <div class="kartu">
      <h3>${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${k.semester} ${status}</h3>
      <p class="meta">Mulai ${esc(tanggal(k.tanggal_mulai))} · ${(k.sesi || []).length} sesi</p>
      ${tabelSesi(k.sesi)}
      ${tombolTerbit}
    </div>`;
}

function formBuat(prodi) {
  return `
    <div class="kartu">
      <h3>Buat Draft Kalender</h3>
      <p class="meta">Tanggal tiap sesi diisi otomatis dari ritme mingguan kurikulum. Selagi masih draft, sesinya boleh disunting; setelah diterbitkan tidak bisa lagi.</p>
      <form id="form-kalender">
        <label>Program studi
          <select name="prodi_kode" required>
            ${prodi.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)}</option>`).join('')}
          </select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" placeholder="2026"></label>
        <label>Semester
          <select name="semester">${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
        <label>Tanggal mulai <input type="date" name="tanggal_mulai" required></label>
        <label>Jumlah minggu <input type="number" name="jumlah_minggu" min="1" max="24" value="16"></label>
        <button>Buat Draft</button>
      </form>
      <div id="hasil-buat"></div>
    </div>`;
}

async function muatDaftar(filter = {}) {
  const q = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => { if (v) q.set(k, v); });
  if (dosen) q.set('draft', '1');
  const { kalender = [] } = await apiGet('/api/kalender' + (q.toString() ? `?${q}` : ''), { auth: dosen });
  const daftar = document.getElementById('daftar');
  daftar.innerHTML = kalender.length
    ? kalender.map(kartuKalender).join('')
    : '<div class="kosong">Belum ada kalender yang diterbitkan. Kalender resmi terbit sebelum semester dimulai.</div>';
  daftar.querySelectorAll('.terbitkan').forEach(b => b.addEventListener('click', () => terbitkan(b.dataset.id)));
}

async function terbitkan(id) {
  try {
    await apiPostJson(`/api/kalender/${encodeURIComponent(id)}/terbitkan`, {});
    await muatDaftar();
  } catch (err) {
    document.getElementById('daftar').insertAdjacentHTML('afterbegin',
      `<div class="pesan gagal">Gagal menerbitkan: ${esc(err.message)}</div>`);
  }
}

async function buatKalender(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-buat');
  hasil.innerHTML = '<p class="redup">Menyiapkan kalender…</p>';
  try {
    const k = await apiPostJson('/api/kalender', {
      prodi_kode: fd.get('prodi_kode'), angkatan: fd.get('angkatan'),
      semester: Number(fd.get('semester')), tanggal_mulai: fd.get('tanggal_mulai'),
      jumlah_minggu: Number(fd.get('jumlah_minggu')),
    });
    hasil.innerHTML = `<div class="pesan sukses">Draft kalender ${esc(k.prodi_kode)} angkatan ${esc(k.angkatan)} semester ${k.semester} dibuat (${(k.sesi || []).length} sesi).</div>`;
    await muatDaftar();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal membuat kalender: ${esc(err.message)}</div>`;
  }
}

try {
  if (isLoggedIn()) {
    try { dosen = (await apiGet('/api/proyekblok/saya', { auth: true })).peran === 'dosen'; } catch { dosen = false; }
  }
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  isi.innerHTML = (dosen && prodi.length ? formBuat(prodi) : '') + '<div id="daftar"><p class="redup">Memuat kalender…</p></div>';
  if (dosen && prodi.length) document.getElementById('form-kalender').addEventListener('submit', buatKalender);
  await muatDaftar();
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
}
