import { apiGet, apiPostJson } from './api.js';
import { esc, istilah, keadaanKosong, pilihProdiBawaan } from './ui.js';
import { sayaHalaman, halamanMengajar } from './hal-dosen.js';

// Pengawas Ujian (dosen). Kewenangan tetap dicek backend: jadwalkan untuk dosen,
// catat kehadiran hanya untuk pengawas sesi itu atau admin.

const isi = document.getElementById('isi');

// Kampus di Bandung. Backend menolak tanggal tanpa zona waktu (RFC3339), dan
// <input type="datetime-local"> tidak membawa zona — jadi zonanya ditulis
// eksplisit di sini, bukan ditebak dari zona peramban pengguna yang bisa saja
// sedang di luar WIB.
const ZONA_KAMPUS = '+07:00';

function waktuLokal(iso) {
  const t = new Date(iso);
  return isNaN(t) ? esc(iso) : t.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
}

let saya = null;
let prodi = [];
const JENIS = { 'tengah-blok': 'Ujian tengah blok', 'akhir-blok': 'Ujian akhir blok' };

// Rumpun dimuat per prodi yang dipilih (bawaan: prodi mengajar/prodi yang
// dipimpin), bukan seluruh prodi sekaligus dengan TRPL di urutan pertama.
async function isiRumpun() {
  const kode = document.getElementById('jadwal-prodi').value;
  const sel = document.getElementById('jadwal-rumpun');
  sel.innerHTML = '<option value="">memuat…</option>';
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
  sel.innerHTML = rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')
    || '<option value="">(rumpun prodi ini belum diisi kaprodi di halaman Kurikulum)</option>';
}

function kartuJadwalkan() {
  return `
    <div class="kartu">
      <h3>Jadwalkan Sesi Ujian</h3>
      <p class="catatan-istilah">${istilah('blok', 'Blok')}: ujian berpengawas diadakan di tengah dan di akhir tiap blok.</p>
      ${saya.email
        ? '<p class="meta">Kosongkan pengawas untuk menjadikan Anda sendiri pengawasnya.</p>'
        : '<div class="pesan info">Email kampus Anda belum diisi, jadi Anda belum bisa menjadi pengawas dan pengawas wajib diisi di bawah. <a href="akademik.html">Isi email kampus Anda</a> untuk mengawasi sendiri.</div>'}
      <form id="form-jadwal">
        <label>Program studi <select id="jadwal-prodi">
          ${prodi.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)}</option>`).join('')}
        </select></label>
        <label>Rumpun <select name="rumpun_kode" id="jadwal-rumpun" required></select></label>
        <label>Jenis <select name="jenis">
          ${Object.entries(JENIS).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
        </select></label>
        <label>Tanggal &amp; jam (WIB) <input type="datetime-local" name="tanggal_jam" required></label>
        <label>Lokasi <input name="lokasi" required maxlength="120" placeholder="Lab Komputer 2"></label>
        <label>Email kampus pengawas${saya.email ? ' (opsional)' : ''} <input type="email" name="pengawas" maxlength="120" placeholder="email kampus pengawas"${saya.email ? '' : ' required'}></label>
        <button>Jadwalkan</button>
      </form>
      <div id="hasil-jadwal"></div>
    </div>`;
}

function kartuSesi(s) {
  return `
    <div class="kartu">
      <h3>${esc(s.rumpun_kode)} · ${esc(JENIS[s.jenis] || s.jenis)}</h3>
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
        <thead><tr><th>NIM</th><th>Jam masuk</th><th>Dicatat oleh</th></tr></thead>
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
    hasil.innerHTML = `<div class="pesan sukses">Sesi ${esc(s.rumpun_kode)} ${esc(JENIS[s.jenis] || s.jenis)} dijadwalkan ${waktuLokal(s.tanggal_jam)} WIB, pengawas ${esc(s.pengawas)}.</div>`;
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
      : keadaanKosong({
        judul: saring === 'saya' ? 'Tidak ada sesi yang Anda awasi' : 'Belum ada sesi ujian terjadwal',
        keterangan: saring === 'saya'
          ? 'Sesi muncul di sini bila email kampus Anda dicatat sebagai pengawasnya. Pilih "semua sesi" untuk melihat jadwal dosen lain.'
          : 'Jadwalkan sesi lewat formulir Jadwalkan Sesi Ujian di bawah.',
        aksi: { href: '#form-jadwal', label: 'Ke formulir jadwal' },
      });
    wadah.querySelectorAll('.form-hadir').forEach(f => f.addEventListener('submit', catatHadir));
    sesi.forEach(s => muatRekap(s.id));
  } catch (err) {
    // 422 = email kampus belum diisi, jadi "sesi yang saya awasi" tidak bisa dicari.
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}${err.status === 422 ? ' <a href="akademik.html">Isi email kampus Anda</a>.' : ''}</div>`;
  }
}

async function muat() {
  ({ prodi = [] } = await apiGet('/api/kurikulum/prodi'));
  // Tanpa email kampus, "yang saya awasi" pasti ditolak 422 — mulai dari semua sesi.
  const awal = saya.email ? 'saya' : 'semua';
  isi.innerHTML = `
    <div class="kartu">
      <h3>Sesi Ujian</h3>
      <form id="form-saring">
        <label>Tampilkan <select name="saringan">
          <option value="saya"${awal === 'saya' ? ' selected' : ''}>yang saya awasi</option>
          <option value="semua"${awal === 'semua' ? ' selected' : ''}>semua sesi</option>
        </select></label>
        <button class="sekunder">Muat</button>
      </form>
    </div>
    <div id="sesi"></div>
    ${prodi.length ? kartuJadwalkan() : keadaanKosong({
      judul: 'Data program studi belum ada',
      keterangan: 'Sesi ujian dijadwalkan per rumpun, jadi data kurikulum harus ada lebih dulu.',
      siapa: 'admin (membuat prodi) dan kaprodi (mengisi kurikulum)',
      aksi: { href: 'kurikulum.html', label: 'Buka Kurikulum' },
    })}`;
  document.getElementById('form-saring').addEventListener('submit', e => { e.preventDefault(); muatSesi(); });
  if (prodi.length) {
    const selProdi = document.getElementById('jadwal-prodi');
    pilihProdiBawaan(selProdi, saya);
    selProdi.addEventListener('change', isiRumpun);
    document.getElementById('form-jadwal').addEventListener('submit', jadwalkan);
    await isiRumpun();
  }
  await muatSesi();
}

async function mulai() {
  const s = await sayaHalaman(isi);
  if (s === undefined) return;
  if (!halamanMengajar(s, isi, {
    judul: 'Pengawas Ujian',
    pesan: 'Penjadwalan ujian dan pencatatan kehadiran dikerjakan dosen pengawas di peran dosen atau kaprodi.',
    untukMahasiswa: { href: './', label: 'Beranda', pesan: 'Kehadiran ujian Anda dicatat dosen pengawas saat ujian berlangsung.' },
  })) return;
  saya = s;
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
