import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahPimpinan, prodiPimpinan } from './akun.js';

// Pantau Proyek Kerja (kaprodi/dosen). Semua angka dihitung backend
// (GET /api/proyekkerja/dasbor); halaman ini hanya menampilkannya tanpa
// menambah tafsiran — terutama tidak mengubah "tanpa acuan" jadi "telat".

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function kartuSaring(prodi, semua) {
  return `
    <div class="kartu">
      <h3>Saringan</h3>
      <p class="meta">Titik tengah semester hanya bisa dihitung kalau prodi, angkatan, <b>dan</b> semester diisi — kalender disimpan per kombinasi itu.</p>
      <form id="form-saring">
        <label>Program studi <select name="prodi">${semua ? '<option value="">(semua)</option>' : ''}
          ${prodi.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)}</option>`).join('')}</select></label>
        <label>Angkatan (untuk kalender acuan) <input name="angkatan" maxlength="9" placeholder="2024"></label>
        <label>Semester <input type="number" name="semester" min="0" max="8" value="0"></label>
        <button>Tampilkan</button>
      </form>
    </div>
    <div id="ringkas"></div>`;
}

function tampil(r) {
  const perStatus = Object.entries(r.per_status || {});
  const acuan = r.acuan_tengah === 'kalender'
    ? `<p class="meta">Titik tengah semester (dari kalender terbit): <b>${esc(r.titik_tengah)}</b></p>`
    : '<div class="kosong">Tidak ada kalender terbit untuk saringan ini, jadi keterlambatan tinjauan tengah <b>tidak dihitung</b>. Isi prodi, angkatan, dan semester yang kalendernya sudah diterbitkan.</div>';
  return `
    <div class="kartu">
      <h3>Ringkasan</h3>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(r.aktif)}</span><span class="label">proyek aktif</span></div>
        <div class="stat"><span class="angka">${esc(r.total)}</span><span class="label">total pengajuan</span></div>
        <div class="stat"><span class="angka">${esc((r.telat || []).length)}</span><span class="label">telat tinjauan tengah</span></div>
      </div>
      ${acuan}
      ${r.tanpa_acuan ? `<p class="redup">${esc(r.tanpa_acuan)} proyek aktif tidak bisa dinilai keterlambatannya karena tidak ada kalender acuan.</p>` : ''}
      ${perStatus.length ? `<p class="redup">Per status: ${perStatus.map(([s, n]) => `${esc(s)} ${esc(n)}`).join(' · ')}</p>` : ''}
    </div>
    ${(r.telat || []).length ? `
    <div class="kartu">
      <h3>Telat Tinjauan Tengah Semester</h3>
      <div class="gulir"><table>
        <tr><th>NIM</th><th>Pekerjaan</th><th>Rumpun</th><th>Belum menilai</th><th class="num">Hari telat</th><th>Pembimbing</th></tr>
        ${r.telat.map(t => `<tr class="band-tinggi">
          <td>${esc(t.nim)}</td><td>${esc(t.judul_pekerjaan)} — ${esc(t.nama_perusahaan)}</td>
          <td>${esc(t.rumpun_kode)}</td><td>${(t.kurang || []).map(esc).join(' & ')}</td>
          <td class="num">${esc(t.hari_terlambat)}</td><td>${esc(t.dosen_nip || '–')}</td></tr>`).join('')}
      </table></div>
      <p class="redup">Kolom "Belum menilai" menunjukkan siapa yang perlu ditagih: dosen pembimbing, atasan di kantor, atau keduanya.</p>
    </div>` : ''}`;
}

async function muatRingkas(e) {
  if (e) e.preventDefault();
  const fd = new FormData(document.getElementById('form-saring'));
  const wadah = document.getElementById('ringkas');
  wadah.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const q = new URLSearchParams({
      prodi: fd.get('prodi') || '', angkatan: fd.get('angkatan') || '', semester: fd.get('semester') || '0',
    });
    wadah.innerHTML = tampil(await apiGet(`/api/proyekkerja/dasbor?${q}`, { auth: true }));
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (!adalahPimpinan(saya)) {
    isi.innerHTML = `<div class="kartu"><h3>Khusus kaprodi dan direktur</h3>
      <p class="meta">Pantauan proyek kerja tingkat prodi hanya bisa dibuka kaprodi (untuk prodinya) dan direktur.</p>
      <a class="aksi" href="saya.html">Kembali ke Beranda Saya</a></div>`;
    return;
  }
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  const boleh = prodiPimpinan(saya);
  isi.innerHTML = kartuSaring(boleh ? prodi.filter(p => boleh.includes(p.kode)) : prodi, !boleh);
  document.getElementById('form-saring').addEventListener('submit', muatRingkas);
  await muatRingkas();
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
