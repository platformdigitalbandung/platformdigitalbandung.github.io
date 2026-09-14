import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahPimpinan, prodiPimpinan } from './akun.js';

// Forum Tanya Dosen. Peran datang dari backend (GET /api/proyekblok/saya):
// mahasiswa bertanya untuk prodinya sendiri (prodi dan NIM diambil backend dari
// roster, bukan dari isian), dosen melihat ringkasan SLA dan membalas.
// Kewenangan membalas/menutup tetap dicek backend.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function paragraf(s) { return esc(s).replace(/\n/g, '<br>'); }

const WAKTU = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
function waktu(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : `${d.toLocaleString('id-ID', WAKTU)} WIB`;
}

const LENCANA_STATUS = { terbuka: 'sedang', dijawab: 'rendah', ditutup: '' };

let saya = null;
let rumpunProdi = [];

function lencanaUtas(u) {
  return `<span class="lencana ${LENCANA_STATUS[u.status] ?? ''}">${esc(u.status)}</span>`
    + (u.lewat_tenggat ? ' <span class="lencana tinggi">lewat tenggat</span>' : '');
}

function metaUtas(u) {
  return `${esc(u.prodi_kode.toUpperCase())} · ${esc(u.rumpun_kode)} · minggu ${esc(u.minggu)} · NIM ${esc(u.nim)} · ${waktu(u.dibuat)}`;
}

function kartuUtas(u) {
  const tenggat = u.dijawab_dosen_pada
    ? `Dijawab dosen ${waktu(u.dijawab_dosen_pada)}`
    : (u.status === 'ditutup' ? 'Ditutup tanpa jawaban dosen' : `Target jawaban dosen: ${waktu(u.tenggat_sla)}`);
  return `
    <div class="kartu">
      <h3><a href="?id=${encodeURIComponent(u.id)}">${esc(u.judul)}</a> ${lencanaUtas(u)}</h3>
      <p class="meta">${metaUtas(u)}</p>
      <p class="redup">${tenggat} · ${esc(u.jumlah_balasan)} balasan</p>
    </div>`;
}

function opsiRumpun(terpilih = '') {
  return rumpunProdi.map(r => `<option value="${escAttr(r.kode)}"${r.kode === terpilih ? ' selected' : ''}>${esc(r.kode)} — ${esc(r.nama)}</option>`).join('');
}

function formTanya() {
  if (!saya.prodi_kode) {
    return '<div class="kosong">Nomor ini belum tercatat di roster mahasiswa, jadi belum bisa bertanya. Hubungi pengelola prodi untuk didaftarkan.</div>';
  }
  return `
    <div class="kartu">
      <h3>Ajukan Pertanyaan</h3>
      <p class="meta">Pertanyaan tampil untuk dosen dan mahasiswa prodi ${esc(saya.prodi_kode.toUpperCase())}. Sebutkan materi yang dimaksud supaya mudah dijawab.</p>
      <form id="form-tanya">
        <label>Rumpun <select name="rumpun_kode" required>${opsiRumpun()}</select></label>
        <label>Minggu materi <input type="number" name="minggu" min="1" max="52" required></label>
        <label>Judul (opsional) <input name="judul" maxlength="150" placeholder="Kosongkan untuk memakai awal pertanyaan"></label>
        <label>Pertanyaan <textarea name="isi" rows="5" maxlength="4000" required></textarea></label>
        <button>Kirim Pertanyaan</button>
      </form>
      <div id="hasil-tanya"></div>
    </div>`;
}

function formSaring(prodiList) {
  const pilihProdi = saya.peran === 'dosen'
    ? `<label>Prodi <select name="prodi">${prodiList.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)}</option>`).join('')}</select></label>`
    : '';
  return `
    <div class="kartu">
      <h3>Daftar Pertanyaan</h3>
      <form id="form-saring">
        ${pilihProdi}
        <label>Rumpun <select name="rumpun"><option value="">Semua rumpun</option>${opsiRumpun()}</select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" placeholder="Semua minggu"></label>
        <label>Status
          <select name="status">
            <option value="">Semua status</option>
            <option value="terbuka">Terbuka (belum dijawab dosen)</option>
            <option value="dijawab">Dijawab</option>
            <option value="ditutup">Ditutup</option>
          </select></label>
        <button>Tampilkan</button>
      </form>
    </div>
    <div id="ringkasan-sla"></div>
    <div id="daftar"><p class="redup">Memuat pertanyaan…</p></div>`;
}

function kartuSLA(r) {
  const lewat = r.terbuka_lewat_tenggat || [];
  return `
    <div class="kartu">
      <h3>SLA Respons Dosen${r.prodi_kode ? ` · ${esc(r.prodi_kode.toUpperCase())}` : ''}</h3>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(lewat.length)}</span><span class="label">terbuka lewat tenggat</span></div>
        <div class="stat"><span class="angka">${esc(r.menunggu_dalam_sla)}</span><span class="label">menunggu, masih dalam SLA</span></div>
        <div class="stat"><span class="angka">${esc(r.dijawab_tepat)} / ${esc(r.dijawab_tepat + r.dijawab_terlambat)}</span><span class="label">dijawab tepat waktu</span></div>
      </div>
      <p class="meta">Target ${esc(r.sla_jam)} jam, dihitung hanya ${(r.hari_berlaku || []).map(esc).join(', ')}.</p>
      ${lewat.length ? `<ul>${lewat.map(u => `<li><a href="?id=${encodeURIComponent(u.id)}">${esc(u.judul)}</a> <span class="redup">— ${esc(u.rumpun_kode)} minggu ${esc(u.minggu)}, tenggat ${waktu(u.tenggat_sla)}</span></li>`).join('')}</ul>` : ''}
    </div>`;
}

async function muatRumpun(prodi) {
  if (!prodi) { rumpunProdi = []; return; }
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(prodi)}/rumpun`);
  rumpunProdi = rumpun;
}

async function muatDaftar(form) {
  const fd = new FormData(form);
  const q = new URLSearchParams();
  const prodi = saya.peran === 'dosen' ? fd.get('prodi') : saya.prodi_kode;
  if (prodi) q.set('prodi', prodi);
  for (const k of ['rumpun', 'minggu', 'status']) {
    const v = (fd.get(k) || '').trim();
    if (v) q.set(k, v);
  }
  const wadah = document.getElementById('daftar');
  wadah.innerHTML = '<p class="redup">Memuat pertanyaan…</p>';
  try {
    const { forum = [] } = await apiGet(`/api/forum?${q}`, { auth: true });
    wadah.innerHTML = forum.length
      ? forum.map(kartuUtas).join('')
      : '<div class="kosong">Belum ada pertanyaan yang cocok dengan saringan ini.</div>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
  // Ringkasan SLA adalah laporan tingkat prodi: hanya kaprodi (prodinya) dan admin.
  // Kaprodi yang menyaring prodi lain tetap melihat SLA prodinya.
  if (adalahPimpinan(saya)) {
    const sla = document.getElementById('ringkasan-sla');
    const boleh = prodiPimpinan(saya);
    const prodiSla = !boleh || boleh.includes(prodi) ? prodi : '';
    try {
      sla.innerHTML = kartuSLA(await apiGet(`/api/forum/sla${prodiSla ? `?prodi=${encodeURIComponent(prodiSla)}` : ''}`, { auth: true }));
    } catch (err) {
      sla.innerHTML = `<div class="pesan gagal">Ringkasan SLA: ${esc(err.message)}</div>`;
    }
  }
}

async function kirimTanya(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-tanya');
  const tombol = e.target.querySelector('button');
  tombol.disabled = true;
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const u = await apiPostJson('/api/forum', {
      rumpun_kode: fd.get('rumpun_kode'), minggu: Number(fd.get('minggu')),
      judul: (fd.get('judul') || '').trim(), isi: (fd.get('isi') || '').trim(),
    });
    e.target.reset();
    hasil.innerHTML = `<div class="pesan sukses">Pertanyaan terkirim. Target jawaban dosen: ${waktu(u.tenggat_sla)}. <a href="?id=${encodeURIComponent(u.id)}">Buka pertanyaan</a></div>`;
    await muatDaftar(document.getElementById('form-saring'));
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal mengirim: ${esc(err.message)}</div>`;
  } finally {
    tombol.disabled = false;
  }
}

function kartuBalasan(b) {
  const siapa = b.peran === 'dosen' ? `Dosen · ${esc(b.email || '–')}` : `Mahasiswa · NIM ${esc(b.nim)}`;
  return `
    <div class="kartu">
      <p class="meta"><span class="lencana ${b.peran === 'dosen' ? 'rendah' : ''}">${esc(b.peran)}</span> ${siapa} · ${waktu(b.dibuat)}</p>
      <p>${paragraf(b.isi)}</p>
    </div>`;
}

function bolehTutup(u) {
  return u.status !== 'ditutup' && (saya.peran === 'dosen' || (saya.nim && saya.nim === u.nim));
}

function tampilDetail(d) {
  const u = d.utas;
  const tenggat = u.dijawab_dosen_pada
    ? `Dijawab dosen ${waktu(u.dijawab_dosen_pada)} (target ${waktu(u.tenggat_sla)})`
    : `Target jawaban dosen: ${waktu(u.tenggat_sla)}`;
  isi.innerHTML = `
    <p><a href="forum.html">← Kembali ke daftar</a></p>
    <div class="kartu">
      <h3>${esc(u.judul)} ${lencanaUtas(u)}</h3>
      <p class="meta">${metaUtas(u)}</p>
      <p>${paragraf(u.isi)}</p>
      <p class="redup">${tenggat}</p>
      ${bolehTutup(u) ? '<p><button class="sekunder" id="tutup">Tutup Pertanyaan</button></p>' : ''}
    </div>
    <h3>${esc(d.balasan.length)} Balasan</h3>
    ${d.balasan.length ? d.balasan.map(kartuBalasan).join('') : '<div class="kosong">Belum ada balasan.</div>'}
    ${u.status === 'ditutup' ? '<div class="kosong">Pertanyaan ini sudah ditutup dan tidak menerima balasan lagi.</div>' : `
    <div class="kartu">
      <h3>Tulis Balasan</h3>
      ${saya.peran === 'dosen' ? '<p class="meta">Balasan dosen pertama menghentikan jam SLA pertanyaan ini.</p>' : ''}
      <form id="form-balas">
        <label>Balasan <textarea name="isi" rows="5" maxlength="4000" required></textarea></label>
        <button>Kirim Balasan</button>
      </form>
    </div>`}
    <div id="hasil-detail"></div>`;

  const formBalas = document.getElementById('form-balas');
  if (formBalas) {
    formBalas.addEventListener('submit', async e => {
      e.preventDefault();
      const tombol = formBalas.querySelector('button');
      tombol.disabled = true;
      try {
        await apiPostJson(`/api/forum/${encodeURIComponent(u.id)}/balas`, { isi: new FormData(formBalas).get('isi').trim() });
        await bukaDetail(u.id);
      } catch (err) {
        tombol.disabled = false;
        document.getElementById('hasil-detail').innerHTML = `<div class="pesan gagal">Gagal membalas: ${esc(err.message)}</div>`;
      }
    });
  }
  const tutup = document.getElementById('tutup');
  if (tutup) {
    tutup.addEventListener('click', async () => {
      if (!window.confirm('Tutup pertanyaan ini? Setelah ditutup tidak bisa dibalas lagi.')) return;
      try {
        await apiPostJson(`/api/forum/${encodeURIComponent(u.id)}/tutup`, {});
        await bukaDetail(u.id);
      } catch (err) {
        document.getElementById('hasil-detail').innerHTML = `<div class="pesan gagal">Gagal menutup: ${esc(err.message)}</div>`;
      }
    });
  }
}

async function bukaDetail(id) {
  try {
    tampilDetail(await apiGet(`/api/forum/${encodeURIComponent(id)}`, { auth: true }));
  } catch (err) {
    isi.innerHTML = `<p><a href="forum.html">← Kembali ke daftar</a></p><div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function tampilDaftar() {
  let prodiList = [];
  if (saya.peran === 'dosen') {
    ({ prodi: prodiList = [] } = await apiGet('/api/kurikulum/prodi'));
    await muatRumpun(prodiList[0]?.kode);
  } else {
    await muatRumpun(saya.prodi_kode);
  }
  isi.innerHTML = (saya.peran === 'dosen' ? '' : formTanya()) + formSaring(prodiList);

  const formSaringEl = document.getElementById('form-saring');
  formSaringEl.addEventListener('submit', e => { e.preventDefault(); muatDaftar(formSaringEl); });
  if (saya.peran === 'dosen') {
    formSaringEl.querySelector('select[name="prodi"]').addEventListener('change', async e => {
      await muatRumpun(e.target.value);
      formSaringEl.querySelector('select[name="rumpun"]').innerHTML = `<option value="">Semua rumpun</option>${opsiRumpun()}`;
      muatDaftar(formSaringEl);
    });
  }
  const formTanyaEl = document.getElementById('form-tanya');
  if (formTanyaEl) formTanyaEl.addEventListener('submit', kirimTanya);
  await muatDaftar(formSaringEl);
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    saya = await apiGet('/api/proyekblok/saya', { auth: true });
    const id = new URLSearchParams(location.search).get('id');
    if (id) await bukaDetail(id);
    else await tampilDaftar();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
