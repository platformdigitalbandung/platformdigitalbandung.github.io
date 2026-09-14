import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahAdmin, adalahPimpinan, prodiPimpinan } from './akun.js';

// Pengisian kurikulum program studi. Kaprodi mengisi kurikulum prodinya; admin
// hanya membuat program studi baru (keputusan pemilik produk 2026-09-14: peran
// utama di kaprodi, admin hanya menyiapkan). Sebelumnya: kaprodi dan admin
// (semua prodi, termasuk prodi baru) — keputusan pemilik produk 2026-09-14;
// kewenangannya dicek backend (401/403), halaman ini hanya tidak menawarkan
// yang pasti ditolak. Pengguna lain melihat daftar prodi saja. Sebelum halaman
// ini ada, satu-satunya cara memasukkan prodi baru adalah menambah data
// hardcode di Go lalu deploy.
//
// Mata kuliah sengaja tidak punya formulir sendiri: ia diturunkan dari daftar
// mata kuliah tiap rumpun saat rumpunnya disimpan, jadi dokumen kurikulum
// tetap satu-satunya sumber.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

const MODA_SESI = ['asinkron', 'daring_sinkron', 'opsional_luring_daring', 'bebas'];
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

let prodi = [];
let ritme = [];
let admin = false;
// Prodi yang boleh diubah: prodi yang dipimpin kaprodi. Admin tidak mengubah
// prodi yang sudah ada — ia hanya membuat prodi baru.
let prodiDikelola = [];

function opsiProdi() {
  return prodiDikelola.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)} (${esc(p.kode)})</option>`).join('');
}

function tabelProdi() {
  if (!prodi.length) return '<div class="kosong">Belum ada program studi.</div>';
  return `<div class="gulir"><table>
    <tr><th>Kode</th><th>Nama</th><th class="num">SKS</th><th class="num">Semester</th><th>Jenjang</th><th class="num">Proyek kerja mulai</th></tr>
    ${prodi.map(p => `<tr>
      <td><code>${esc(p.kode)}</code></td><td>${esc(p.nama)}</td>
      <td class="num">${esc(p.sks_total)}</td><td class="num">${esc(p.semester)}</td>
      <td>${esc(p.jenjang)}</td>
      <td class="num">${p.semester_proyek_kerja_min ? `semester ${esc(p.semester_proyek_kerja_min)}` : '<span class="redup">bawaan</span>'}</td>
    </tr>`).join('')}
  </table></div>`;
}

function isianKodeProdi() {
  if (admin) return '<label>Kode <input name="kode" required placeholder="mis. pai" pattern="[a-z][a-z0-9-]{1,19}"></label>';
  return `<label>Kode <select name="kode" required>${opsiProdi()}</select></label>`;
}

function kartuProdi() {
  return `
    <div class="kartu">
      <h3>1. Program Studi</h3>
      <p class="meta">Kode dipakai sebagai kunci di rumpun, CPL, mata kuliah, roster mahasiswa, dan kalender — huruf kecil, tanpa spasi, dan sebaiknya tidak diubah lagi setelah ada datanya.</p>
      ${tabelProdi()}
      <h4>${admin ? 'Tambah program studi baru' : 'Perbarui prodi Anda'}</h4>
      ${admin
        ? '<p class="redup">Admin hanya membuat program studi baru. Setelah prodinya ada, tetapkan kaprodinya di Kelola Kaprodi — rumpun, CPL, dan data prodi selanjutnya diisi kaprodi itu.</p>'
        : '<p class="redup">Program studi baru dibuat admin. Isian di bawah terisi data prodi yang Anda pimpin.</p>'}
      <form id="form-prodi">
        ${isianKodeProdi()}
        <label>Nama <input name="nama" required placeholder="Pendidikan Agama Islam"></label>
        <label>Jenjang <input name="jenjang" required placeholder="S1" value="S1"></label>
        <label>Total SKS <input name="sks_total" type="number" min="1" required value="144"></label>
        <label>Jumlah semester <input name="semester" type="number" min="1" max="14" required value="8"></label>
        <label>Proyek kerja mulai semester <input name="semester_proyek_kerja_min" type="number" min="0" max="14" value="0"></label>
        <p class="redup">Isi 0 kalau mengikuti bawaan platform (semester 4).</p>
        <button>Simpan Prodi</button>
      </form>
      <div id="pesan-prodi"></div>
    </div>`;
}

// ===== 2. Rumpun =====

let rumpunProdi = [];
let cplProdi = [];
let seedProdi = [];
let klikTerpasang = false;

function lencanaStatus(r) {
  return r.catatan
    ? `<span class="lencana sedang" title="${escAttr(r.catatan)}">draf</span>`
    : '<span class="lencana rendah">disahkan</span>';
}

function sksBaris(teks) {
  const m = String(teks).trim().match(/\((\d+)\)\s*$/);
  return m ? Number(m[1]) : 0;
}

function tabelRumpun() {
  if (!rumpunProdi.length) return '<div class="kosong">Prodi ini belum punya rumpun.</div>';
  const p = prodi.find(x => x.kode === rumpunProdi[0].prodi_kode);
  const total = rumpunProdi.reduce((n, r) => n + (r.sks || 0), 0);
  const draf = rumpunProdi.filter(r => r.catatan).length;
  return `<p class="redup">${rumpunProdi.length} rumpun · ${total} SKS dari total ${p ? esc(p.sks_total) : '?'} SKS prodi · ${draf} masih draf</p>
    <div class="gulir"><table>
    <tr><th>Kode</th><th>Nama</th><th class="num">Smt</th><th class="num">SKS</th><th>Moda</th><th class="num">MK</th><th>CPL</th><th>Status</th><th></th></tr>
    ${rumpunProdi.map(r => `<tr>
      <td><code>${esc(r.kode)}</code></td><td>${esc(r.nama)}</td>
      <td class="num">${esc(r.semester)}</td><td class="num">${esc(r.sks)}</td>
      <td>${r.moda === 'tempat_kerja' ? 'tempat kerja' : 'ritme mingguan'}</td>
      <td class="num">${(r.mata_kuliah || []).length}</td>
      <td class="kecil">${esc((r.cpl || []).join(', '))}</td>
      <td>${lencanaStatus(r)}</td>
      <td><button type="button" class="sekunder" data-aksi="sunting-rumpun" data-kode="${escAttr(r.kode)}">Sunting</button></td>
    </tr>`).join('')}
  </table></div>`;
}

function kartuRumpun() {
  return `
    <div class="kartu">
      <h3>2. Rumpun Mata Kuliah</h3>
      <p class="meta">Satu rumpun = satu proyek pengikat per semester. Tekan <b>Sunting</b> untuk meninjau rumpun yang sudah ada — formulir di bawah terisi datanya — lalu simpan dengan kode yang sama. Mata kuliahnya ditulis satu per baris beserta SKS dalam kurung, mis. <code>Fikih Muamalah (3)</code>.</p>
      <label>Prodi <select id="prodi-rumpun">${opsiProdi()}</select></label>
      <div id="daftar-rumpun"><p class="redup">Memuat rumpun…</p></div>
      <h4 id="judul-form-rumpun">Tambah / perbarui rumpun</h4>
      <form id="form-rumpun">
        <label>Kode rumpun <input name="kode" required placeholder="R1"></label>
        <label>Nama rumpun <input name="nama" required placeholder="Dasar Keilmuan"></label>
        <label>Semester <input name="semester" type="number" min="1" max="14" required value="1"></label>
        <label>SKS <input name="sks" type="number" min="1" required value="6"></label>
        <label>Proyek pengikat <input name="proyek_pengikat" placeholder="mis. Portofolio Kajian"></label>
        <label>Moda
          <select name="moda">
            <option value="ritme_mingguan">Ritme mingguan (dikerjakan di kampus/daring)</option>
            <option value="tempat_kerja">Tempat kerja (di luar anggaran waktu mingguan)</option>
          </select></label>
        <label>Mata kuliah — satu per baris, <b>SKS dalam kurung di akhir</b>
          <textarea name="mata_kuliah" rows="5" required placeholder="Fikih Muamalah (3)&#10;Ushul Fikih (3)"></textarea></label>
        <p class="redup" id="jumlah-sks-mk">Jumlah SKS mata kuliah: 0</p>
        <label>Kode CPL yang disentuh (pisahkan koma, boleh kosong)
          <input name="cpl" placeholder="CPL01, CPL03"></label>
        <label>Catatan status
          <textarea name="catatan" rows="2" placeholder="mis. DRAF USULAN — belum disahkan prodi"></textarea></label>
        <p class="redup">Rumpun bercatatan tampil sebagai <b>draf</b>. Kosongkan catatan saat mengesahkan rumpun ini.</p>
        <button>Simpan Rumpun</button>
        <button type="button" class="sekunder" data-aksi="kosongkan-rumpun">Kosongkan Formulir</button>
      </form>
      <div id="pesan-rumpun"></div>
    </div>`;
}

async function muatRumpun() {
  const kode = document.getElementById('prodi-rumpun').value;
  const wadah = document.getElementById('daftar-rumpun');
  try {
    ({ rumpun: rumpunProdi = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`));
    rumpunProdi = (rumpunProdi || []).sort((a, b) => (a.semester - b.semester) || a.kode.localeCompare(b.kode, 'id', { numeric: true }));
    wadah.innerHTML = tabelRumpun();
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function hitungSKSMataKuliah() {
  const form = document.getElementById('form-rumpun');
  const baris = daftarDari(form.elements.mata_kuliah.value, '\n');
  const jumlah = baris.reduce((n, b) => n + sksBaris(b), 0);
  const sks = Number(form.elements.sks.value) || 0;
  const el = document.getElementById('jumlah-sks-mk');
  el.textContent = `Jumlah SKS mata kuliah: ${jumlah}` + (baris.length && jumlah !== sks ? ` — belum sama dengan SKS rumpun (${sks}); penyimpanan akan ditolak` : '');
  el.classList.toggle('teks-peringatan', Boolean(baris.length && jumlah !== sks));
}

function suntingRumpun(kode) {
  const r = rumpunProdi.find(x => x.kode === kode);
  if (!r) return;
  const f = document.getElementById('form-rumpun');
  f.elements.kode.value = r.kode;
  f.elements.nama.value = r.nama || '';
  f.elements.semester.value = r.semester || 1;
  f.elements.sks.value = r.sks || 1;
  f.elements.proyek_pengikat.value = r.proyek_pengikat || '';
  f.elements.moda.value = r.moda || 'ritme_mingguan';
  f.elements.mata_kuliah.value = (r.mata_kuliah || []).join('\n');
  f.elements.cpl.value = (r.cpl || []).join(', ');
  f.elements.catatan.value = r.catatan || '';
  document.getElementById('judul-form-rumpun').textContent = `Sunting rumpun ${r.kode}`;
  document.getElementById('pesan-rumpun').innerHTML = '';
  hitungSKSMataKuliah();
  f.scrollIntoView({ behavior: 'smooth' });
}

function kosongkanRumpun() {
  const f = document.getElementById('form-rumpun');
  f.reset();
  document.getElementById('judul-form-rumpun').textContent = 'Tambah / perbarui rumpun';
  document.getElementById('pesan-rumpun').innerHTML = '';
  hitungSKSMataKuliah();
}

async function simpanRumpun(e) {
  e.preventDefault();
  const kodeProdi = document.getElementById('prodi-rumpun').value;
  const hasil = await kirim(e.target, 'pesan-rumpun', () => `/api/kurikulum/prodi/${encodeURIComponent(kodeProdi)}/rumpun`, f => ({
    kode: f.get('kode'), nama: f.get('nama'), semester: Number(f.get('semester')),
    sks: Number(f.get('sks')), proyek_pengikat: f.get('proyek_pengikat'), moda: f.get('moda'),
    mata_kuliah: daftarDari(f.get('mata_kuliah'), '\n'),
    cpl: daftarDari(f.get('cpl'), ','),
    catatan: String(f.get('catatan') || '').trim(),
  }), h => `${(h.matakuliah || []).length} mata kuliah ikut diturunkan.`
    + ((h.matakuliah_dihapus || []).length ? ` Dilepas dan dihapus: ${esc(h.matakuliah_dihapus.join(', '))}.` : ''));
  // Rumpun juga tersimpan saat penulisan mata kuliahnya salah, jadi tabel
  // selalu dimuat ulang.
  await muatRumpun();
  if (hasil) document.getElementById('judul-form-rumpun').textContent = `Sunting rumpun ${hasil.rumpun.kode}`;
}

// ===== 3. CPL =====

const DOMAIN_CPL = [['sikap', 'Sikap'], ['pengetahuan', 'Pengetahuan'], ['keterampilan_umum', 'Keterampilan umum'], ['keterampilan_khusus', 'Keterampilan khusus']];

function opsiDomain(terpilih) {
  const ada = DOMAIN_CPL.some(([v]) => v === terpilih);
  // Domain lama di luar empat pilihan (mis. "ket. umum" dari seed TRPL) tetap
  // ditawarkan supaya menyunting CPL tidak diam-diam mengganti domainnya.
  return (terpilih && !ada ? `<option value="${escAttr(terpilih)}" selected>${esc(terpilih)}</option>` : '')
    + DOMAIN_CPL.map(([v, l]) => `<option value="${v}"${v === terpilih ? ' selected' : ''}>${l}</option>`).join('');
}

function tabelCPL() {
  if (!cplProdi.length) return '<div class="kosong">Prodi ini belum punya CPL.</div>';
  return `<div class="gulir"><table>
    <tr><th>Kode</th><th>Domain</th><th>Rumusan</th><th>Rumpun penyentuh</th><th></th></tr>
    ${cplProdi.map(c => `<tr>
      <td><code>${esc(c.kode)}</code></td><td>${esc(c.domain)}</td>
      <td class="kecil">${esc(c.deskripsi || '')}${(c.penopang_lain || []).length ? `<br><span class="redup">Penopang lain: ${esc(c.penopang_lain.join(', '))}</span>` : ''}</td>
      <td class="kecil">${esc((c.rumpun_penyentuh || []).join(', '))}</td>
      <td><button type="button" class="sekunder" data-aksi="sunting-cpl" data-kode="${escAttr(c.kode)}">Sunting</button></td>
    </tr>`).join('')}
  </table></div>`;
}

function kartuCPL() {
  return `
    <div class="kartu">
      <h3>3. Capaian Pembelajaran (CPL)</h3>
      <p class="meta">Teks CPL datang dari dokumen kurikulum prodi, jangan ditebak. Tekan <b>Sunting</b> untuk meninjau CPL yang sudah ada. Penguatan usulan dan penopang lain tidak diubah dari halaman ini dan tetap dipertahankan saat CPL disimpan.</p>
      <label>Prodi <select id="prodi-cpl">${opsiProdi()}</select></label>
      <div id="daftar-cpl"><p class="redup">Memuat CPL…</p></div>
      <h4 id="judul-form-cpl">Tambah / perbarui CPL</h4>
      <form id="form-cpl">
        <label>Kode <input name="kode" required placeholder="CPL01"></label>
        <label>Domain <select name="domain">${opsiDomain('sikap')}</select></label>
        <label>Deskripsi <textarea name="deskripsi" rows="3" placeholder="Rumusan capaian pembelajaran"></textarea></label>
        <label>Rumpun penyentuh (pisahkan koma) <input name="rumpun_penyentuh" placeholder="R1, R2"></label>
        <button>Simpan CPL</button>
        <button type="button" class="sekunder" data-aksi="kosongkan-cpl">Kosongkan Formulir</button>
      </form>
      <div id="pesan-cpl"></div>
    </div>`;
}

async function muatCPL() {
  const kode = document.getElementById('prodi-cpl').value;
  const wadah = document.getElementById('daftar-cpl');
  try {
    ({ cpl: cplProdi = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/cpl`));
    cplProdi = (cplProdi || []).sort((a, b) => a.kode.localeCompare(b.kode, 'id', { numeric: true }));
    wadah.innerHTML = tabelCPL();
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function suntingCPL(kode) {
  const c = cplProdi.find(x => x.kode === kode);
  if (!c) return;
  const f = document.getElementById('form-cpl');
  f.elements.kode.value = c.kode;
  f.elements.domain.innerHTML = opsiDomain(c.domain);
  f.elements.deskripsi.value = c.deskripsi || '';
  f.elements.rumpun_penyentuh.value = (c.rumpun_penyentuh || []).join(', ');
  document.getElementById('judul-form-cpl').textContent = `Sunting ${c.kode}`;
  document.getElementById('pesan-cpl').innerHTML = '';
  f.scrollIntoView({ behavior: 'smooth' });
}

function kosongkanCPL() {
  const f = document.getElementById('form-cpl');
  f.reset();
  f.elements.domain.innerHTML = opsiDomain('sikap');
  document.getElementById('judul-form-cpl').textContent = 'Tambah / perbarui CPL';
  document.getElementById('pesan-cpl').innerHTML = '';
}

async function simpanCPL(e) {
  e.preventDefault();
  const kodeProdi = document.getElementById('prodi-cpl').value;
  const hasil = await kirim(e.target, 'pesan-cpl', () => `/api/kurikulum/prodi/${encodeURIComponent(kodeProdi)}/cpl`, f => ({
    kode: f.get('kode'), domain: f.get('domain'), deskripsi: f.get('deskripsi'),
    rumpun_penyentuh: daftarDari(f.get('rumpun_penyentuh'), ','),
  }));
  if (hasil) await muatCPL();
}

// ===== 4. Ritme =====

function barisSesiRitme(sesi = {}) {
  return `<tr>
    <td><select name="hari">${HARI.map(h => `<option${h === sesi.hari ? ' selected' : ''}>${h}</option>`).join('')}</select></td>
    <td><select name="moda">${MODA_SESI.map(m => `<option value="${m}"${m === sesi.moda ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></td>
    <td><input name="jam_mulai" placeholder="08:00" size="6" value="${escAttr(sesi.jam_mulai || '')}"></td>
    <td><input name="jam_selesai" placeholder="10:00" size="6" value="${escAttr(sesi.jam_selesai || '')}"></td>
    <td><input name="menit" type="number" min="0" size="5" value="${escAttr(sesi.menit_instruksional || 0)}"></td>
    <td><input name="catatan" placeholder="opsional" value="${escAttr(sesi.catatan || '')}"></td>
    <td><button type="button" class="sekunder" data-aksi="hapus-baris-ritme" aria-label="Hapus baris">×</button></td>
  </tr>`;
}

function barisBawaanRitme() {
  return HARI.map(h => barisSesiRitme({ hari: h, moda: h === 'Sabtu' || h === 'Minggu' ? 'bebas' : 'asinkron' })).join('');
}

function kartuRitme() {
  return `
    <div class="kartu">
      <h3>4. Ritme Mingguan</h3>
      <p class="meta">Pola satu minggu yang diulang jadi kalender semester. Isi ini hanya kalau prodi memakai pola yang berbeda dari yang sudah ada — kalender memilih ritme lewat namanya.</p>
      ${'<p class="redup">Ritme dipakai kalender lewat namanya. Ritme yang sudah ada boleh Anda ubah selama tidak dipakai kalender prodi lain; kalau dipakai, simpan pola prodi Anda dengan nama ritme baru.</p>'}
      <label>Muat ritme <select id="pilih-ritme">
        <option value="">(ritme baru)</option>
        ${ritme.map(r => `<option value="${escAttr(r.nama)}">${esc(r.nama)} · ${esc(r.total_menit_per_minggu)} menit/minggu</option>`).join('')}
      </select></label>
      <form id="form-ritme">
        <label>Nama ritme <input name="nama" required placeholder="Ritme PAI — Semester 1-6"></label>
        <div class="gulir"><table class="tabel-sunting">
          <thead><tr><th>Hari</th><th>Moda</th><th>Jam mulai</th><th>Jam selesai</th><th class="num">Menit</th><th>Catatan</th><th></th></tr></thead>
          <tbody id="sesi-ritme">${barisBawaanRitme()}</tbody>
        </table></div>
        <p><button type="button" class="sekunder" data-aksi="tambah-baris-ritme">+ Tambah Baris</button></p>
        <p class="redup" id="ringkas-ritme">Total 0 menit/minggu · kapasitas 0 SKS per semester</p>
        <p class="redup">Menit = menit instruksional (jam kotor dikurangi ibadah, makan, dan jeda). Kapasitas dihitung otomatis: total menit ÷ 85. Baris dengan menit 0 tetap disimpan sebagai hari tanpa agenda instruksional.</p>
        <button>Simpan Ritme</button>
      </form>
      <div id="pesan-ritme"></div>
    </div>`;
}

function totalMenitRitme() {
  return [...document.querySelectorAll('#sesi-ritme tr')]
    .reduce((n, tr) => n + (Number(tr.querySelector('[name=menit]').value) || 0), 0);
}

function perbaruiRingkasRitme() {
  const total = totalMenitRitme();
  const kapasitas = Math.round(total / 85 * 10) / 10;
  document.getElementById('ringkas-ritme').textContent =
    `Total ${total.toLocaleString('id-ID')} menit/minggu · kapasitas ${kapasitas.toLocaleString('id-ID')} SKS per semester`;
}

function muatRitmeKeFormulir(nama) {
  const f = document.getElementById('form-ritme');
  const r = ritme.find(x => x.nama === nama);
  f.elements.nama.value = r ? r.nama : '';
  document.getElementById('sesi-ritme').innerHTML = r ? r.sesi.map(s => barisSesiRitme(s)).join('') : barisBawaanRitme();
  document.getElementById('pesan-ritme').innerHTML = '';
  perbaruiRingkasRitme();
}

async function simpanRitme(e) {
  e.preventDefault();
  const sesi = [...document.querySelectorAll('#sesi-ritme tr')].map(tr => ({
    hari: tr.querySelector('[name=hari]').value,
    moda: tr.querySelector('[name=moda]').value,
    jam_mulai: tr.querySelector('[name=jam_mulai]').value,
    jam_selesai: tr.querySelector('[name=jam_selesai]').value,
    menit_instruksional: Number(tr.querySelector('[name=menit]').value) || 0,
    catatan: tr.querySelector('[name=catatan]').value,
  }));
  const pesan = document.getElementById('pesan-ritme');
  if (!sesi.length) {
    pesan.innerHTML = '<div class="pesan gagal">Ritme minimal punya satu baris sesi.</div>';
    return;
  }
  // Kapasitas dikirim 0: backend menghitungnya dari total menit ÷ 85.
  const hasil = await kirim(e.target, 'pesan-ritme', () => '/api/kurikulum/ritme', fd => ({ nama: fd.get('nama'), kapasitas_sks_per_semester: 0, sesi }),
    h => `${esc(h.nama)}: ${esc(h.total_menit_per_minggu)} menit/minggu, kapasitas ${esc(h.kapasitas_sks_per_semester)} SKS.`);
  if (hasil) {
    ({ ritme = [] } = await apiGet('/api/kurikulum/ritme'));
    const pilih = document.getElementById('pilih-ritme');
    pilih.innerHTML = '<option value="">(ritme baru)</option>'
      + ritme.map(r => `<option value="${escAttr(r.nama)}">${esc(r.nama)} · ${esc(r.total_menit_per_minggu)} menit/minggu</option>`).join('');
    pilih.value = hasil.nama;
  }
}

// ===== 5. Seed =====

function prodiBerSeedDikelola() {
  return prodiDikelola.filter(p => seedProdi.includes(p.kode));
}

function kartuSeed() {
  const pilihan = prodiBerSeedDikelola();
  return `
    <div class="kartu">
      <h3>5. Data Bawaan (Seed)</h3>
      <p class="meta">Menulis ulang data prodi, rumpun, dan CPL bawaan platform untuk satu prodi, lalu menurunkan mata kuliahnya. Hanya tampil untuk prodi yang punya data bawaan.</p>
      <form id="form-seed">
        <label>Prodi <select name="prodi" required>${pilihan.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)} (${esc(p.kode)})</option>`).join('')}</select></label>
        <label><input type="checkbox" name="paham" required> Saya paham rumpun dan CPL berkode sama yang sudah diketik akan ditimpa data bawaan</label>
        <button>Muat Data Bawaan</button>
      </form>
      <div id="pesan-seed"></div>
    </div>`;
}

function daftarDari(teks, pemisah) {
  return String(teks || '').split(pemisah).map(s => s.trim()).filter(Boolean);
}

async function kirim(form, pesanID, path, susun, sesudah) {
  const pesan = document.getElementById(pesanID);
  pesan.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const hasil = await apiPostJson(path(), susun(new FormData(form)));
    pesan.innerHTML = `<div class="pesan sukses">Tersimpan.${sesudah ? ' ' + sesudah(hasil) : ''}</div>`;
    return hasil;
  } catch (err) {
    pesan.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
    return null;
  }
}

// Kartu rumpun, CPL, dan seed hanya dirender kalau ada prodi yang dikelola,
// jadi form-nya dipasang hanya kalau elemennya memang ada.
function pasangForm(id, penangan) {
  const form = document.getElementById(id);
  if (form) form.addEventListener('submit', penangan);
}

function pasang() {
  pasangForm('form-prodi', async e => {
    e.preventDefault();
    const hasil = await kirim(e.target, 'pesan-prodi', () => '/api/kurikulum/prodi', fd => ({
      kode: fd.get('kode'), nama: fd.get('nama'), jenjang: fd.get('jenjang'),
      sks_total: Number(fd.get('sks_total')), semester: Number(fd.get('semester')),
      semester_proyek_kerja_min: Number(fd.get('semester_proyek_kerja_min')) || 0,
    }));
    if (hasil) await muat();
  });

  pasangForm('form-rumpun', simpanRumpun);
  pasangForm('form-cpl', simpanCPL);
  pasangForm('form-ritme', simpanRitme);

  pasangForm('form-seed', async e => {
    e.preventDefault();
    const prodiSeed = new FormData(e.target).get('prodi');
    const hasil = await kirim(e.target, 'pesan-seed', () => `/api/kurikulum/seed?prodi=${encodeURIComponent(prodiSeed)}`, () => ({}),
      h => esc(h.ringkasan || ''));
    if (hasil) await muat();
  });

  const prodiRumpun = document.getElementById('prodi-rumpun');
  if (prodiRumpun) {
    prodiRumpun.addEventListener('change', () => { kosongkanRumpun(); muatRumpun(); });
    const fr = document.getElementById('form-rumpun');
    fr.elements.mata_kuliah.addEventListener('input', hitungSKSMataKuliah);
    fr.elements.sks.addEventListener('input', hitungSKSMataKuliah);
    muatRumpun();
  }
  const prodiCPL = document.getElementById('prodi-cpl');
  if (prodiCPL) {
    prodiCPL.addEventListener('change', () => { kosongkanCPL(); muatCPL(); });
    muatCPL();
  }
  const pilihRitme = document.getElementById('pilih-ritme');
  if (pilihRitme) {
    pilihRitme.addEventListener('change', e => muatRitmeKeFormulir(e.target.value));
    document.getElementById('sesi-ritme').addEventListener('input', perbaruiRingkasRitme);
    perbaruiRingkasRitme();
  }

  if (klikTerpasang) return;
  klikTerpasang = true;
  isi.addEventListener('click', e => {
    const b = e.target.closest('button[data-aksi]');
    if (!b) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'sunting-rumpun') suntingRumpun(b.dataset.kode);
    else if (aksi === 'kosongkan-rumpun') kosongkanRumpun();
    else if (aksi === 'sunting-cpl') suntingCPL(b.dataset.kode);
    else if (aksi === 'kosongkan-cpl') kosongkanCPL();
    else if (aksi === 'tambah-baris-ritme') {
      document.getElementById('sesi-ritme').insertAdjacentHTML('beforeend', barisSesiRitme({ hari: 'Senin', moda: 'asinkron' }));
      perbaruiRingkasRitme();
    } else if (aksi === 'hapus-baris-ritme') {
      b.closest('tr').remove();
      perbaruiRingkasRitme();
    }
  });
}

// Kaprodi memilih prodinya di isian Kode; isian lain diisi data prodi itu
// supaya menyimpan tidak diam-diam menimpa nama/SKS dengan nilai bawaan form.
function isiDataProdi(form) {
  const p = prodi.find(x => x.kode === form.elements.kode.value);
  if (!p) return;
  form.elements.nama.value = p.nama || '';
  form.elements.jenjang.value = p.jenjang || '';
  form.elements.sks_total.value = p.sks_total || '';
  form.elements.semester.value = p.semester || '';
  form.elements.semester_proyek_kerja_min.value = p.semester_proyek_kerja_min || 0;
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  ({ prodi = [] } = await apiGet('/api/kurikulum/prodi'));
  if (!adalahPimpinan(saya)) {
    isi.innerHTML = `<div class="kartu"><h3>Program Studi</h3>${tabelProdi()}</div>
      <div class="kosong">Kurikulum hanya bisa diubah kaprodi prodi itu. Kalau Anda kaprodi yang sedang memakai peran dosen, pilih peran kaprodi di pojok kanan atas.</div>`;
    return;
  }
  admin = adalahAdmin(saya);
  const boleh = admin ? [] : (prodiPimpinan(saya) || []);
  prodiDikelola = prodi.filter(p => boleh.includes(p.kode));
  try {
    ({ ritme = [] } = await apiGet('/api/kurikulum/ritme'));
  } catch {
    ritme = [];
  }
  try {
    ({ prodi: seedProdi = [] } = await apiGet('/api/kurikulum/seed'));
  } catch {
    seedProdi = [];
  }
  // Admin: hanya kartu prodi baru. Kaprodi: seluruh kartu untuk prodinya.
  isi.innerHTML = kartuProdi() + (prodiDikelola.length ? kartuRumpun() + kartuCPL() + kartuRitme() : '')
    + (prodiBerSeedDikelola().length ? kartuSeed() : '');
  const formProdi = document.getElementById('form-prodi');
  if (!admin) {
    isiDataProdi(formProdi);
    formProdi.elements.kode.addEventListener('change', () => isiDataProdi(formProdi));
  }
  pasang();
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
