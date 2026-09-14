import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Pengawas Ujian (dosen). Kewenangan tetap dicek backend: jadwalkan untuk dosen,
// catat kehadiran hanya untuk pengawas sesi itu atau admin.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Kampus di Bandung. Backend menolak tanggal tanpa zona waktu (RFC3339), dan
// <input type="datetime-local"> tidak membawa zona — jadi zonanya ditulis
// eksplisit di sini, bukan ditebak dari zona peramban pengguna yang bisa saja
// sedang di luar WIB.
const ZONA_KAMPUS = '+07:00';

function waktuLokal(iso) {
  const t = new Date(iso);
  return isNaN(t) ? esc(iso) : t.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
}

let rumpun = [];

async function rumpunSemuaProdi() {
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  const hasil = [];
  for (const p of prodi) {
    const { rumpun: rs = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(p.kode)}/rumpun`);
    rs.forEach(r => hasil.push({ kode: r.kode, nama: r.nama, prodi: p.kode }));
  }
  return hasil;
}

function kartuJadwalkan() {
  return `
    <div class="kartu">
      <h3>Jadwalkan Sesi Ujian</h3>
      <p class="meta">Kosongkan pengawas untuk menjadikan Anda sendiri pengawasnya (butuh email kampus Anda terisi).</p>
      <form id="form-jadwal">
        <label>Rumpun <select name="rumpun_kode" required>
          ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)} (${esc(r.prodi)})</option>`).join('')}
        </select></label>
        <label>Jenis <select name="jenis">
          <option value="tengah-blok">tengah blok</option>
          <option value="akhir-blok">akhir blok</option>
        </select></label>
        <label>Tanggal &amp; jam (WIB) <input type="datetime-local" name="tanggal_jam" required></label>
        <label>Lokasi <input name="lokasi" required maxlength="120" placeholder="Lab Komputer 2"></label>
        <label>Email kampus pengawas (opsional) <input type="email" name="pengawas" maxlength="120" placeholder="nama@digitalbdg.ac.id"></label>
        <button>Jadwalkan</button>
      </form>
      <div id="hasil-jadwal"></div>
    </div>`;
}

function kartuSesi(s) {
  return `
    <div class="kartu">
      <h3>${esc(s.rumpun_kode)} · ${esc(s.jenis)}</h3>
      <p class="meta">${waktuLokal(s.tanggal_jam)} WIB · ${esc(s.lokasi)} · pengawas ${esc(s.pengawas)}</p>
      <form class="form-hadir" data-id="${esc(s.id)}">
        <label>NIM hadir <input name="nim" required maxlength="30"></label>
        <button>Catat Hadir</button>
      </form>
      <div class="rekap" data-id="${esc(s.id)}"><p class="redup">Memuat rekap…</p></div>
    </div>`;
}

async function muatRekap(id) {
  const wadah = document.querySelector(`.rekap[data-id="${id}"]`);
  if (!wadah) return;
  try {
    const { kehadiran = [] } = await apiGet(`/api/sesiujian/${encodeURIComponent(id)}/kehadiran`, { auth: true });
    wadah.innerHTML = kehadiran.length ? `<div class="gulir"><table>
        <tr><th>NIM</th><th>Jam masuk</th><th>Dicatat oleh</th></tr>
        ${kehadiran.map(k => `<tr><td>${esc(k.nim)}</td><td>${waktuLokal(k.jam_masuk)}</td><td>${esc(k.dicatat_oleh)}</td></tr>`).join('')}
      </table></div><p class="redup">${kehadiran.length} mahasiswa tercatat hadir.</p>`
      : '<p class="redup">Belum ada kehadiran yang dicatat.</p>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function catatHadir(e) {
  e.preventDefault();
  const id = e.target.dataset.id;
  const input = e.target.querySelector('input[name="nim"]');
  try {
    const h = await apiPostJson(`/api/sesiujian/${encodeURIComponent(id)}/checkin`, { nim: input.value.trim() });
    input.value = '';
    input.focus();
    e.target.insertAdjacentHTML('afterend', `<div class="pesan sukses">${esc(h.nim)} tercatat hadir.</div>`);
    muatRekap(id);
  } catch (err) {
    e.target.insertAdjacentHTML('afterend', `<div class="pesan gagal">${esc(err.message)}</div>`);
  }
}

async function jadwalkan(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-jadwal');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const s = await apiPostJson('/api/sesiujian', {
      rumpun_kode: fd.get('rumpun_kode'), jenis: fd.get('jenis'),
      tanggal_jam: `${fd.get('tanggal_jam')}:00${ZONA_KAMPUS}`,
      lokasi: fd.get('lokasi'), pengawas: (fd.get('pengawas') || '').trim().toLowerCase(),
    });
    hasil.innerHTML = `<div class="pesan sukses">Sesi ${esc(s.rumpun_kode)} ${esc(s.jenis)} dijadwalkan ${waktuLokal(s.tanggal_jam)} WIB, pengawas ${esc(s.pengawas)}.</div>`;
    muatSesi();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menjadwalkan: ${esc(err.message)}</div>`;
  }
}

async function muatSesi() {
  const saring = new FormData(document.getElementById('form-saring')).get('saringan');
  const wadah = document.getElementById('sesi');
  wadah.innerHTML = '<p class="redup">Memuat sesi…</p>';
  try {
    const q = saring === 'saya' ? '?pengawas=saya' : '';
    const { sesi = [] } = await apiGet(`/api/sesiujian${q}`, { auth: true });
    wadah.innerHTML = sesi.length ? sesi.map(kartuSesi).join('')
      : `<div class="kosong">${saring === 'saya' ? 'Tidak ada sesi yang Anda awasi.' : 'Belum ada sesi ujian terjadwal.'}</div>`;
    wadah.querySelectorAll('.form-hadir').forEach(f => f.addEventListener('submit', catatHadir));
    sesi.forEach(s => muatRekap(s.id));
  } catch (err) {
    // 422 = email kampus belum diisi, jadi "sesi yang saya awasi" tidak bisa dicari.
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}${err.status === 422 ? ' <a href="akademik.html">Isi email kampus Anda</a>.' : ''}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran !== 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk dosen</h3>
      <p class="meta">Penjadwalan ujian dan pencatatan kehadiran dilakukan dosen pengawas.</p>
      <a class="aksi" href="saya.html">Kembali ke Beranda Saya</a></div>`;
    return;
  }
  rumpun = await rumpunSemuaProdi();
  isi.innerHTML = `
    <div class="kartu">
      <h3>Sesi Ujian</h3>
      <form id="form-saring">
        <label>Tampilkan <select name="saringan">
          <option value="saya">yang saya awasi</option>
          <option value="semua">semua sesi</option>
        </select></label>
        <button class="sekunder">Muat</button>
      </form>
    </div>
    <div id="sesi"></div>
    ${kartuJadwalkan()}`;
  document.getElementById('form-saring').addEventListener('submit', e => { e.preventDefault(); muatSesi(); });
  document.getElementById('form-jadwal').addEventListener('submit', jadwalkan);
  await muatSesi();
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
