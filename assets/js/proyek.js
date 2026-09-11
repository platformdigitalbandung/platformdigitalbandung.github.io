import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Kelola Proyek Blok (dosen). Kewenangan tetap dicek backend: hanya dosen
// pembimbing proyek itu yang boleh menilai — halaman ini cuma menyiapkan
// formulirnya. Rumpun dan mata kuliah dibaca dari data kurikulum, tidak
// diketik ulang di sini.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function angka(n) { return typeof n === 'number' ? n.toFixed(2) : '–'; }

let saya = null;
const rumpunPerProdi = new Map();

async function rumpunProdi(kode) {
  if (!rumpunPerProdi.has(kode)) {
    const res = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
    rumpunPerProdi.set(kode, res.rumpun || []);
  }
  return rumpunPerProdi.get(kode);
}

// Satu baris = "nim | nama | nomor WhatsApp".
function parseAnggota(teks) {
  return teks.split('\n').map(b => b.trim()).filter(Boolean).map(b => {
    const [nim = '', nama = '', phonenumber = ''] = b.split('|').map(x => x.trim());
    return { nim, nama, phonenumber };
  });
}

function formBuat(prodi) {
  return `
    <div class="kartu">
      <h3>Buat Proyek Blok</h3>
      <p class="meta">Proyek dibuat atas nama NIP Anda (${esc(saya.nip)}) sebagai pembimbing.</p>
      <form id="form-buat">
        <label>Program studi
          <select name="prodi_kode" id="pilih-prodi" required>
            ${prodi.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)}</option>`).join('')}
          </select></label>
        <label>Rumpun <select name="rumpun_kode" id="pilih-rumpun" required></select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" placeholder="2026"></label>
        <label>Judul proyek <input name="judul" required maxlength="200"></label>
        <label>Deskripsi <textarea name="deskripsi" rows="2"></textarea></label>
        <label>Anggota (satu baris per mahasiswa: <code>nim | nama | nomor WhatsApp</code>)
          <textarea name="anggota" rows="3" placeholder="2026001 | Budi Santoso | 6281234567890"></textarea></label>
        <label>Status
          <select name="status">
            <option value="draft">draft</option>
            <option value="berjalan">berjalan</option>
            <option value="selesai">selesai</option>
          </select></label>
        <button>Simpan Proyek</button>
      </form>
      <div id="hasil-buat"></div>
    </div>`;
}

function tabelProyek(daftar) {
  if (!daftar.length) return '<div class="kosong">Belum ada proyek blok yang Anda bimbing.</div>';
  return `<div class="kartu"><h3>Proyek yang Anda Bimbing</h3><div class="gulir"><table>
      <tr><th>Judul</th><th>Rumpun</th><th>Angkatan</th><th>Status</th><th class="num">Anggota</th><th></th></tr>
      ${daftar.map(p => `<tr>
        <td>${esc(p.judul)}</td><td>${esc(p.rumpun_kode)}</td><td>${esc(p.angkatan)}</td>
        <td>${esc(p.status)}</td><td class="num">${(p.anggota || []).length}</td>
        <td><button class="sekunder buka-detail" data-id="${esc(p.id)}">Buka</button></td></tr>`).join('')}
    </table></div></div>
    <div id="detail"></div>`;
}

async function tampilDetail(id) {
  const detail = document.getElementById('detail');
  detail.innerHTML = '<p class="redup">Memuat detail proyek…</p>';
  try {
    const { proyek, nilai = [], rekap = [] } = await apiGet(`/api/proyekblok/${encodeURIComponent(id)}`, { auth: true });
    const rumpun = (await rumpunProdi(proyek.prodi_kode)).find(r => r.kode === proyek.rumpun_kode);
    const mk = (rumpun && rumpun.mata_kuliah) || [];
    const anggota = proyek.anggota || [];
    detail.innerHTML = `
      <div class="kartu">
        <h3>${esc(proyek.judul)}</h3>
        <p class="meta">Rumpun ${esc(proyek.rumpun_kode)}${rumpun ? ` — ${esc(rumpun.nama)}` : ''} · prodi ${esc(proyek.prodi_kode)} · angkatan ${esc(proyek.angkatan)} · ${esc(proyek.status)}</p>
        <h4>Nilai per mahasiswa</h4>
        ${rekap.length ? `<div class="gulir"><table>
            <tr><th>NIM</th><th>Mata kuliah dinilai</th><th class="num">Rata-rata</th></tr>
            ${rekap.map(r => `<tr><td>${esc(r.nim)}</td>
              <td>${Object.keys(r.per_mata_kuliah || {}).map(esc).join(', ') || '–'}</td>
              <td class="num">${angka(r.rata_rata)}</td></tr>`).join('')}
          </table></div>` : '<p class="redup">Belum ada nilai yang diinput.</p>'}
        <h4>Input Nilai</h4>
        ${anggota.length && mk.length ? `
        <form id="form-nilai" data-id="${esc(proyek.id)}">
          <label>Mahasiswa <select name="nim" required>
            ${anggota.map(a => `<option value="${esc(a.nim)}">${esc(a.nim)} — ${esc(a.nama)}</option>`).join('')}
          </select></label>
          <label>Mata kuliah <select name="kode_mk" required>
            ${mk.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
          </select></label>
          <label>Hasil proyek (40%) <input type="number" name="hasil_proyek" min="0" max="100" step="0.1" required></label>
          <label>Ujian (30%) <input type="number" name="ujian" min="0" max="100" step="0.1" required></label>
          <label>Kuis (15%) <input type="number" name="kuis" min="0" max="100" step="0.1" required></label>
          <label>Presentasi (15%) <input type="number" name="presentasi" min="0" max="100" step="0.1" required></label>
          <label>Catatan <input name="catatan" maxlength="500"></label>
          <button>Simpan Nilai</button>
        </form>
        <div id="hasil-nilai"></div>`
        : `<p class="redup">${anggota.length ? 'Data rumpun/mata kuliah tidak ditemukan untuk proyek ini.' : 'Proyek ini belum punya anggota, jadi belum ada yang bisa dinilai.'}</p>`}
        <h4>Seluruh baris nilai</h4>
        ${nilai.length ? `<div class="gulir"><table>
            <tr><th>NIM</th><th>Mata kuliah</th><th class="num">Akhir</th><th>Dinilai oleh</th></tr>
            ${nilai.map(n => `<tr><td>${esc(n.nim)}</td><td>${esc(n.kode_mk)}</td>
              <td class="num">${angka(n.nilai_akhir)}</td><td>${esc(n.dinilai_oleh)}</td></tr>`).join('')}
          </table></div>` : '<p class="redup">Belum ada.</p>'}
      </div>`;

    const formNilai = document.getElementById('form-nilai');
    if (formNilai) formNilai.addEventListener('submit', simpanNilai);
  } catch (err) {
    detail.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function simpanNilai(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-nilai');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const n = await apiPostJson(`/api/proyekblok/${encodeURIComponent(e.target.dataset.id)}/nilai`, {
      nim: fd.get('nim'), kode_mk: fd.get('kode_mk'), catatan: fd.get('catatan') || '',
      komponen: {
        hasil_proyek: Number(fd.get('hasil_proyek')), ujian: Number(fd.get('ujian')),
        kuis: Number(fd.get('kuis')), presentasi: Number(fd.get('presentasi')),
      },
    });
    hasil.innerHTML = `<div class="pesan sukses">Nilai ${esc(n.nim)} — ${esc(n.kode_mk)} tersimpan. Nilai akhir <b>${angka(n.nilai_akhir)}</b>.</div>`;
    tampilDetail(e.target.dataset.id);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan nilai: ${esc(err.message)}</div>`;
  }
}

async function buatProyek(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-buat');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const p = await apiPostJson('/api/proyekblok', {
      rumpun_kode: fd.get('rumpun_kode'), prodi_kode: fd.get('prodi_kode'),
      angkatan: fd.get('angkatan'), judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '',
      dosen_nip: saya.nip, anggota: parseAnggota(fd.get('anggota') || ''), status: fd.get('status'),
    });
    hasil.innerHTML = `<div class="pesan sukses">Proyek <b>${esc(p.judul)}</b> dibuat.</div>`;
    muat();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal membuat proyek: ${esc(err.message)}</div>`;
  }
}

async function isiRumpun() {
  const prodi = document.getElementById('pilih-prodi').value;
  const pilihRumpun = document.getElementById('pilih-rumpun');
  pilihRumpun.innerHTML = '<option>memuat…</option>';
  const daftar = await rumpunProdi(prodi);
  pilihRumpun.innerHTML = daftar.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')
    || '<option value="">(data rumpun kosong)</option>';
}

async function muat() {
  saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran !== 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk dosen</h3>
      <p class="meta">Nomor ini tidak terdaftar sebagai dosen. Nilai proyek yang Anda ikuti ada di halaman Nilai Proyek Saya.</p>
      <a class="aksi" href="nilai.html">Lihat Nilai Saya</a></div>`;
    return;
  }
  if (!saya.nip) {
    isi.innerHTML = '<div class="pesan gagal">Nomor ini terdaftar sebagai dosen, tetapi NIP-nya belum diisi di data dosen. Pembuatan dan penilaian proyek blok baru bisa dilakukan setelah pengelola melengkapi NIP.</div>';
    return;
  }
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  isi.innerHTML = (prodi.length ? formBuat(prodi) : '<div class="pesan gagal">Data program studi kosong; jalankan seed kurikulum dahulu.</div>')
    + tabelProyek(saya.proyekblok || []);

  if (prodi.length) {
    document.getElementById('form-buat').addEventListener('submit', buatProyek);
    document.getElementById('pilih-prodi').addEventListener('change', isiRumpun);
    await isiRumpun();
  }
  isi.querySelectorAll('.buka-detail').forEach(b =>
    b.addEventListener('click', () => tampilDetail(b.dataset.id)));
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
