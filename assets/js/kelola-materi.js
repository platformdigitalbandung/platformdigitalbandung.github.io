import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Kelola Materi (dosen). Kewenangan tetap dicek backend. Prodi dan rumpun dibaca
// dari data kurikulum, tidak diketik ulang. YouTube ID diurai server dari
// tautan apa pun, jadi halaman ini tidak mencoba mengurainya sendiri.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

let prodi = [];
const rumpunPerProdi = new Map();
let katalog = [];

async function rumpunProdi(kode) {
  if (!kode) return [];
  if (!rumpunPerProdi.has(kode)) {
    const res = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
    rumpunPerProdi.set(kode, res.rumpun || []);
  }
  return rumpunPerProdi.get(kode);
}

function opsiProdi(terpilih) {
  return prodi.map(p => `<option value="${esc(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)}</option>`).join('');
}

async function isiPilihanRumpun(selectProdi, selectRumpun, terpilih, denganSemua) {
  const daftar = await rumpunProdi(selectProdi.value);
  selectRumpun.innerHTML = (denganSemua ? '<option value="">(semua rumpun)</option>' : '')
    + daftar.map(r => `<option value="${esc(r.kode)}"${r.kode === terpilih ? ' selected' : ''}>${esc(r.kode)} — ${esc(r.nama)}</option>`).join('');
}

function kartuSaring() {
  return `
    <div class="kartu">
      <h3>Katalog</h3>
      <form id="form-saring">
        <label>Program studi <select name="prodi" id="saring-prodi">${opsiProdi()}</select></label>
        <label>Rumpun <select name="rumpun" id="saring-rumpun"></select></label>
        <label>Minggu (0 = semua) <input type="number" name="minggu" min="0" max="52" value="0"></label>
        <button class="sekunder">Tampilkan</button>
      </form>
      <div id="daftar"></div>
    </div>`;
}

function kartuForm(m = {}) {
  const video = (m.jenis || 'video') === 'video';
  return `
    <div class="kartu">
      <h3>${m.id ? 'Ubah' : 'Tambah'} Materi</h3>
      <form id="form-materi" data-id="${esc(m.id || '')}">
        <label>Program studi <select name="prodi_kode" id="form-prodi" required>${opsiProdi(m.prodi_kode)}</select></label>
        <label>Rumpun <select name="rumpun_kode" id="form-rumpun" required></select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(m.minggu ?? 1)}"></label>
        <label>Urutan dalam minggu <input type="number" name="urutan" min="0" value="${esc(m.urutan ?? 0)}"></label>
        <label>Judul <input name="judul" required maxlength="200" value="${esc(m.judul || '')}"></label>
        <label>Jenis <select name="jenis" id="form-jenis">
          <option value="video"${video ? ' selected' : ''}>video</option>
          <option value="bacaan"${video ? '' : ' selected'}>bacaan</option>
        </select></label>
        <label id="bidang-video"${video ? '' : ' hidden'}>Tautan atau ID YouTube
          <input name="youtube_id" maxlength="300" value="${esc(m.youtube_id || '')}" placeholder="https://youtu.be/…"></label>
        <label id="bidang-bacaan"${video ? ' hidden' : ''}>Isi bacaan (teks lengkap; pisahkan paragraf dengan baris kosong)
          <textarea name="isi" rows="10" maxlength="100000">${esc(m.isi || '')}</textarea></label>
        <label>Deskripsi singkat <input name="deskripsi" maxlength="1000" value="${esc(m.deskripsi || '')}"></label>
        <button>${m.id ? 'Simpan Perubahan' : 'Tambah Materi'}</button>
        ${m.id ? '<button type="button" class="sekunder" id="batal-ubah">Batal</button>' : ''}
      </form>
      <div id="hasil-materi"></div>
    </div>`;
}

async function pasangForm(m = {}) {
  const wadah = document.getElementById('wadah-form');
  wadah.innerHTML = kartuForm(m);
  const selProdi = document.getElementById('form-prodi');
  const selRumpun = document.getElementById('form-rumpun');
  await isiPilihanRumpun(selProdi, selRumpun, m.rumpun_kode, false);
  selProdi.addEventListener('change', () => isiPilihanRumpun(selProdi, selRumpun, '', false));
  document.getElementById('form-jenis').addEventListener('change', e => {
    const video = e.target.value === 'video';
    document.getElementById('bidang-video').hidden = !video;
    document.getElementById('bidang-bacaan').hidden = video;
  });
  document.getElementById('form-materi').addEventListener('submit', simpan);
  const batal = document.getElementById('batal-ubah');
  if (batal) batal.addEventListener('click', () => pasangForm());
}

async function simpan(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = e.target.dataset.id;
  const body = {
    prodi_kode: fd.get('prodi_kode'), rumpun_kode: fd.get('rumpun_kode'),
    minggu: Number(fd.get('minggu')), urutan: Number(fd.get('urutan')) || 0,
    judul: fd.get('judul'), jenis: fd.get('jenis'),
    youtube_id: fd.get('youtube_id') || '', isi: fd.get('isi') || '', deskripsi: fd.get('deskripsi') || '',
  };
  const hasil = document.getElementById('hasil-materi');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const m = id
      ? await apiPutJson(`/api/materi/${encodeURIComponent(id)}`, body)
      : await apiPostJson('/api/materi', body);
    hasil.innerHTML = `<div class="pesan sukses">Materi <b>${esc(m.judul)}</b> tersimpan (minggu ${esc(m.minggu)}, ${esc(m.jenis)}${m.youtube_id ? `, YouTube ID <code>${esc(m.youtube_id)}</code>` : ''}).</div>`;
    if (!id) e.target.reset();
    tampilDaftar();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan: ${esc(err.message)}</div>`;
  }
}

async function tampilDaftar(e) {
  if (e) e.preventDefault();
  const fd = new FormData(document.getElementById('form-saring'));
  const daftar = document.getElementById('daftar');
  daftar.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const q = new URLSearchParams({ prodi: fd.get('prodi') || '', rumpun: fd.get('rumpun') || '', minggu: fd.get('minggu') || '0' });
    const res = await apiGet(`/api/materi?${q}`, { auth: true });
    katalog = res.materi || [];
    daftar.innerHTML = katalog.length ? `<div class="gulir"><table>
        <tr><th class="num">Mgg</th><th class="num">Urut</th><th>Judul</th><th>Jenis</th><th>Rumpun</th><th></th></tr>
        ${katalog.map(m => `<tr>
          <td class="num">${esc(m.minggu)}</td><td class="num">${esc(m.urutan)}</td>
          <td>${esc(m.judul)}</td><td>${esc(m.jenis)}</td><td>${esc(m.rumpun_kode)}</td>
          <td><button class="sekunder ubah" data-id="${esc(m.id)}">Ubah</button>
              <button class="sekunder hapus" data-id="${esc(m.id)}">Hapus</button></td></tr>`).join('')}
      </table></div><div id="hasil-hapus"></div>`
      : '<div class="kosong">Belum ada materi untuk saringan ini.</div>';
    daftar.querySelectorAll('.ubah').forEach(b => b.addEventListener('click', () => {
      const m = katalog.find(x => x.id === b.dataset.id);
      if (m) { pasangForm(m); document.getElementById('wadah-form').scrollIntoView({ behavior: 'smooth' }); }
    }));
    daftar.querySelectorAll('.hapus').forEach(b => b.addEventListener('click', () => hapus(b.dataset.id)));
  } catch (err) {
    daftar.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

// Hapus tidak berantai: catatan progres mahasiswa tetap ada. Materi yang sudah
// punya progres dijawab 422 dengan jumlahnya, dan dosen harus mengonfirmasi.
async function hapus(id, konfirmasi = false) {
  const m = katalog.find(x => x.id === id);
  const hasil = document.getElementById('hasil-hapus');
  if (!konfirmasi && !window.confirm(`Hapus materi "${m ? m.judul : id}" dari katalog?`)) return;
  hasil.innerHTML = '<p class="redup">Menghapus…</p>';
  try {
    const d = await apiDeleteJson(`/api/materi/${encodeURIComponent(id)}${konfirmasi ? '?konfirmasi=hapus' : ''}`);
    hasil.innerHTML = `<div class="pesan sukses">Materi dihapus.${d.progres_tertinggal ? ` ${esc(d.progres_tertinggal)} catatan progres mahasiswa tetap ada, tapi kehilangan judul materinya.` : ''}</div>`;
    tampilDaftar();
  } catch (err) {
    if (err.status === 422 && !konfirmasi) {
      hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
        <p><button class="sekunder" id="tetap-hapus">Tetap hapus</button></p>`;
      document.getElementById('tetap-hapus').addEventListener('click', () => hapus(id, true));
      return;
    }
    hasil.innerHTML = `<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran !== 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk dosen</h3>
      <p class="meta">Materi pekan ini untuk mahasiswa ada di halaman Materi.</p>
      <a class="aksi" href="materi.html">Buka Materi</a></div>`;
    return;
  }
  const res = await apiGet('/api/kurikulum/prodi');
  prodi = res.prodi || [];
  if (!prodi.length) {
    isi.innerHTML = '<div class="pesan gagal">Data program studi kosong; jalankan seed kurikulum dahulu.</div>';
    return;
  }
  isi.innerHTML = '<div id="wadah-form"></div>' + kartuSaring();
  await pasangForm();
  const sp = document.getElementById('saring-prodi');
  const sr = document.getElementById('saring-rumpun');
  await isiPilihanRumpun(sp, sr, '', true);
  sp.addEventListener('change', () => isiPilihanRumpun(sp, sr, '', true));
  document.getElementById('form-saring').addEventListener('submit', tampilDaftar);
  await tampilDaftar();
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
