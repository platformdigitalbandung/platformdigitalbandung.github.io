import { apiGet, apiPostJson, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';

// Rekognisi Pembelajaran Lampau. Mahasiswa mengajukan (NIM diambil server dari
// roster lewat token) dengan satu berkas bukti; dosen menyaring dan meninjau.
// Pengajuan butuh token, jadi unggahnya lewat apiPostBerkasToken — apiPostBerkas
// biasa tidak mengirim Authorization sama sekali.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

const LENCANA = { diajukan: 'sedang', ditinjau: 'sedang', disetujui: 'rendah', ditolak: 'tinggi' };

async function rumpunSemuaProdi() {
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  const hasil = [];
  for (const p of prodi) {
    const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(p.kode)}/rumpun`);
    rumpun.forEach(r => hasil.push({ kode: r.kode, nama: r.nama, prodi: p.kode }));
  }
  return hasil;
}

// model.StorageRef kini bertag json huruf kecil (repo/path/sha), sesuai
// openapi. Sebelum 2026-09-13 kuncinya keluar huruf besar (Path); bentuk lama
// tetap dibaca supaya halaman tidak kosong kalau frontend terbit lebih dulu
// daripada deploy backend-nya.
function pathBukti(ref) { return (ref && (ref.path || ref.Path)) || ''; }

function barisPengajuan(p, untukDosen) {
  const bukti = (p.bukti_url || []).map(pathBukti).filter(Boolean);
  return `
    <div class="kartu">
      <h3>Rumpun ${esc(p.rumpun_target)} <span class="lencana ${LENCANA[p.status] || 'sedang'}">${esc(p.status)}</span></h3>
      <p class="meta">${untukDosen ? `NIM ${esc(p.nim)} · ` : ''}#${esc(String(p.id).slice(-6))}</p>
      <p>${esc(p.deskripsi)}</p>
      <p class="redup">Bukti: ${bukti.length ? bukti.map(b => `<code>${esc(b.split('/').pop())}</code>`).join(', ') : 'tidak ada berkas'}</p>
      ${p.catatan ? `<p class="redup">Catatan peninjau${p.dinilai_oleh ? ` (${esc(p.dinilai_oleh)})` : ''}: ${esc(p.catatan)}</p>` : ''}
      ${untukDosen && p.status !== 'disetujui' && p.status !== 'ditolak' ? `
        <form class="form-tinjau" data-id="${esc(p.id)}">
          <label>Putusan <select name="status">
            <option value="ditinjau">sedang ditinjau</option>
            <option value="disetujui">setujui</option>
            <option value="ditolak">tolak</option>
          </select></label>
          <label>Catatan <input name="catatan" maxlength="500"></label>
          <button>Simpan Putusan</button>
        </form>` : ''}
    </div>`;
}

function kartuAjukan(rumpun) {
  return `
    <div class="kartu">
      <h3>Ajukan RPL</h3>
      <p class="meta">NIM tidak perlu diisi — diambil dari data akademik Anda. Satu berkas bukti per pengajuan (portofolio, sertifikat, atau surat keterangan kerja).</p>
      <form id="form-ajukan">
        <label>Rumpun yang ingin diakui
          <select name="rumpun_target" required>
            ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)} (${esc(r.prodi)})</option>`).join('')}
          </select></label>
        <label>Uraian pengalaman <textarea name="deskripsi" rows="4" required maxlength="2000"></textarea></label>
        <label>Berkas bukti (opsional) <input type="file" id="bukti" name="bukti"></label>
        <button>Ajukan</button>
      </form>
      <div id="hasil-ajukan"></div>
    </div>`;
}

async function ajukan(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-ajukan');
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const p = await apiPostBerkasToken('/api/rpl',
      { rumpun_target: fd.get('rumpun_target'), deskripsi: fd.get('deskripsi') }, 'bukti', 'bukti');
    const adaBerkas = document.getElementById('bukti').files.length > 0;
    const tersimpan = (p.bukti_url || []).length;
    // Backend sengaja tetap menyimpan pengajuan walau unggah berkasnya gagal;
    // itu harus terlihat, bukan disembunyikan.
    hasil.innerHTML = `<div class="pesan sukses">Pengajuan rumpun ${esc(p.rumpun_target)} tersimpan, menunggu tinjauan.
      ${adaBerkas && !tersimpan ? ' <b>Berkas bukti gagal tersimpan</b> — pengajuannya tetap tercatat; hubungi dosen untuk menyusulkan bukti.' : ''}</div>`;
    muatRiwayat();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Pengajuan gagal: ${esc(err.message)}</div>`;
  }
}

let nimSaya = '';

async function muatRiwayat() {
  const wadah = document.getElementById('riwayat');
  wadah.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const { rpl = [] } = await apiGet(`/api/mahasiswa/${encodeURIComponent(nimSaya)}/rpl`, { auth: true });
    wadah.innerHTML = rpl.length ? rpl.map(p => barisPengajuan(p, false)).join('')
      : '<div class="kosong">Belum ada pengajuan RPL.</div>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function muatDaftarDosen(e) {
  if (e) e.preventDefault();
  const status = new FormData(document.getElementById('form-saring')).get('status');
  const wadah = document.getElementById('daftar');
  wadah.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const { rpl = [] } = await apiGet(`/api/rpl?${new URLSearchParams({ status })}`, { auth: true });
    wadah.innerHTML = rpl.length ? rpl.map(p => barisPengajuan(p, true)).join('')
      : '<div class="kosong">Tidak ada pengajuan untuk saringan ini.</div>';
    wadah.querySelectorAll('.form-tinjau').forEach(f => f.addEventListener('submit', tinjau));
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function tinjau(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await apiPostJson(`/api/rpl/${encodeURIComponent(e.target.dataset.id)}/tinjau`,
      { status: fd.get('status'), catatan: fd.get('catatan') || '' });
    muatDaftarDosen();
  } catch (err) {
    e.target.insertAdjacentHTML('afterend', `<div class="pesan gagal">${esc(err.message)}</div>`);
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran === 'dosen') {
    isi.innerHTML = `
      <div class="kartu">
        <h3>Tinjau Pengajuan RPL</h3>
        <p class="meta">Pengajuan yang disetujui ikut jadi bukti cakupan CPL mahasiswa di dasbor, dicatat terpisah dari bukti nilai proyek.</p>
        <form id="form-saring">
          <label>Status <select name="status">
            <option value="diajukan">menunggu (diajukan)</option>
            <option value="ditinjau">sedang ditinjau</option>
            <option value="disetujui">disetujui</option>
            <option value="ditolak">ditolak</option>
            <option value="">semua</option>
          </select></label>
          <button class="sekunder">Tampilkan</button>
        </form>
      </div>
      <div id="daftar"></div>`;
    document.getElementById('form-saring').addEventListener('submit', muatDaftarDosen);
    await muatDaftarDosen();
    return;
  }
  if (!saya.nim) {
    isi.innerHTML = '<div class="kosong">Nomor ini belum tercatat di roster mahasiswa, jadi pengajuan RPL tidak bisa dicatat atas nama siapa pun. Hubungi pengelola prodi.</div>';
    return;
  }
  nimSaya = saya.nim;
  isi.innerHTML = kartuAjukan(await rumpunSemuaProdi())
    + '<h3>Pengajuan Anda</h3><div id="riwayat"></div>';
  document.getElementById('form-ajukan').addEventListener('submit', ajukan);
  muatRiwayat();
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
