import { apiGet, apiPostJson, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong, istilah } from './ui.js';

// Rekognisi Pembelajaran Lampau. Mahasiswa mengajukan (NIM diambil server dari
// roster lewat token) dengan satu berkas bukti; dosen menyaring dan meninjau.
// Pengajuan butuh token, jadi unggahnya lewat apiPostBerkasToken (api.js).

const isi = document.getElementById('isi');

const LENCANA = { diajukan: 'sedang', ditinjau: 'sedang', disetujui: 'rendah', ditolak: 'tinggi' };

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
      ${untukDosen ? `<p class="meta">NIM ${esc(p.nim)}</p>` : ''}
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

function kartuAjukan(rumpun, prodi) {
  const PRODI = String(prodi || '').toUpperCase();
  return `
    <div class="kartu">
      <h3>Ajukan ${istilah('rpl', 'RPL')}</h3>
      <p class="meta">NIM tidak perlu diisi — diambil dari data akademik Anda. Satu berkas bukti per pengajuan (portofolio, sertifikat, atau surat keterangan kerja).</p>
      <form id="form-ajukan">
        <label>Rumpun yang ingin diakui
          <select name="rumpun_target" required>
            <option value="">— pilih rumpun ${esc(PRODI)} —</option>
            ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')}
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
      : '<div class="kosong">Belum ada pengajuan RPL. Pengajuan yang Anda kirim beserta putusan dosennya tampil di sini.</div>';
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
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda sudah berakhir atau backend tidak terjangkau. Tekan Masuk lagi di pojok kanan atas.</div>';
    return;
  }
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
  if (!saya.nim || !saya.prodi_kode) {
    isi.innerHTML = keadaanKosong({
      judul: 'Data akademik Anda belum lengkap',
      keterangan: 'Pengajuan RPL dicatat atas NIM dan rumpun program studi Anda di roster. Setelah pengelola prodi melengkapinya, form pengajuan tampil di sini.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  nimSaya = saya.nim;
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(saya.prodi_kode)}/rumpun`);
  isi.innerHTML = kartuAjukan(rumpun, saya.prodi_kode)
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
