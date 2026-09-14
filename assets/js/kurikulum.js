import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Pengisian kurikulum program studi. Khusus dosen/kaprodi — kewenangannya
// dicek backend (401/403). Sebelum halaman ini ada, satu-satunya cara
// memasukkan prodi baru adalah menambah data hardcode di Go lalu deploy.
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

function opsiProdi() {
  return prodi.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)} (${esc(p.kode)})</option>`).join('');
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

function kartuProdi() {
  return `
    <div class="kartu">
      <h3>1. Program Studi</h3>
      <p class="meta">Kode dipakai sebagai kunci di rumpun, CPL, mata kuliah, roster mahasiswa, dan kalender — huruf kecil, tanpa spasi, dan sebaiknya tidak diubah lagi setelah ada datanya.</p>
      ${tabelProdi()}
      <h4>Tambah / perbarui prodi</h4>
      <form id="form-prodi">
        <label>Kode <input name="kode" required placeholder="mis. pai" pattern="[a-z][a-z0-9-]{1,19}"></label>
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

function kartuRumpun() {
  return `
    <div class="kartu">
      <h3>2. Rumpun Mata Kuliah</h3>
      <p class="meta">Satu rumpun = satu proyek pengikat per semester. Mata kuliahnya ditulis satu per baris beserta SKS dalam kurung, mis. <code>Fikih Muamalah (3)</code>; koleksi mata kuliah diturunkan dari daftar ini.</p>
      <form id="form-rumpun">
        <label>Prodi <select name="prodi_kode" required>${opsiProdi()}</select></label>
        <label>Kode rumpun <input name="kode" required placeholder="R1"></label>
        <label>Nama rumpun <input name="nama" required placeholder="Dasar Keilmuan"></label>
        <label>Semester <input name="semester" type="number" min="1" max="14" required value="1"></label>
        <label>SKS <input name="sks" type="number" min="1" required value="12"></label>
        <label>Proyek pengikat <input name="proyek_pengikat" placeholder="mis. Portofolio Kajian"></label>
        <label>Moda
          <select name="moda">
            <option value="ritme_mingguan">Ritme mingguan (dikerjakan di kampus/daring)</option>
            <option value="tempat_kerja">Tempat kerja (di luar anggaran waktu mingguan)</option>
          </select></label>
        <label>Mata kuliah — satu per baris, <b>SKS dalam kurung di akhir</b>
          <textarea name="mata_kuliah" rows="5" required placeholder="Fikih Muamalah (3)&#10;Ushul Fikih (3)&#10;Bahasa Arab Hukum (2)"></textarea></label>
        <p class="redup">Tanpa "(SKS)" di akhir baris, penyimpanan ditolak — mata kuliah ber-SKS nol merusak perhitungan beban belajar, jadi lebih baik gagal terang-terangan.</p>
        <label>Kode CPL yang disentuh (pisahkan koma, boleh kosong)
          <input name="cpl" placeholder="CPL01, CPL03"></label>
        <button>Simpan Rumpun</button>
      </form>
      <div id="pesan-rumpun"></div>
    </div>`;
}

function kartuCPL() {
  return `
    <div class="kartu">
      <h3>3. Capaian Pembelajaran (CPL)</h3>
      <p class="meta">Teks CPL datang dari dokumen kurikulum prodi, jangan ditebak. Dasbor CPL mahasiswa menjawab 422 selama prodinya belum punya CPL sama sekali.</p>
      <form id="form-cpl">
        <label>Prodi <select name="prodi_kode" required>${opsiProdi()}</select></label>
        <label>Kode <input name="kode" required placeholder="CPL01"></label>
        <label>Domain
          <select name="domain">
            <option value="sikap">Sikap</option>
            <option value="pengetahuan">Pengetahuan</option>
            <option value="keterampilan_umum">Keterampilan umum</option>
            <option value="keterampilan_khusus">Keterampilan khusus</option>
          </select></label>
        <label>Deskripsi <textarea name="deskripsi" rows="3" placeholder="Rumusan capaian pembelajaran"></textarea></label>
        <label>Rumpun penyentuh (pisahkan koma) <input name="rumpun_penyentuh" placeholder="R1, R2"></label>
        <button>Simpan CPL</button>
      </form>
      <div id="pesan-cpl"></div>
    </div>`;
}

function barisSesiRitme(i) {
  return `<tr>
    <td><select name="hari">${HARI.map(h => `<option${h === 'Senin' && i === 0 ? ' selected' : ''}>${h}</option>`).join('')}</select></td>
    <td><select name="moda">${MODA_SESI.map(m => `<option value="${m}">${esc(m)}</option>`).join('')}</select></td>
    <td><input name="jam_mulai" placeholder="08.00" size="6"></td>
    <td><input name="jam_selesai" placeholder="10.00" size="6"></td>
    <td><input name="menit" type="number" min="0" value="0" size="5"></td>
    <td><input name="catatan" placeholder="opsional"></td>
  </tr>`;
}

function kartuRitme() {
  return `
    <div class="kartu">
      <h3>4. Ritme Mingguan</h3>
      <p class="meta">Pola satu minggu yang diulang jadi kalender semester. Isi ini hanya kalau prodi memakai pola yang berbeda dari yang sudah ada — kalender memilih ritme lewat namanya.</p>
      ${ritme.length ? `<p class="redup">Sudah ada: ${ritme.map(r => `${esc(r.nama)} (${esc(r.total_menit_per_minggu)} menit/minggu)`).join(' · ')}</p>` : ''}
      <form id="form-ritme">
        <label>Nama ritme <input name="nama" required placeholder="Ritme PAI — Semester 1-6"></label>
        <label>Kapasitas SKS per semester <input name="kapasitas" type="number" min="0" step="0.1" value="0"></label>
        <div class="gulir"><table class="tabel-sunting" id="sesi-ritme">
          <tr><th>Hari</th><th>Moda</th><th>Jam mulai</th><th>Jam selesai</th><th class="num">Menit</th><th>Catatan</th></tr>
          ${[0, 1, 2, 3, 4].map(barisSesiRitme).join('')}
        </table></div>
        <p class="redup">Baris dengan menit 0 tetap disimpan sebagai hari tanpa agenda instruksional.</p>
        <button>Simpan Ritme</button>
      </form>
      <div id="pesan-ritme"></div>
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

// Kartu rumpun dan CPL hanya dirender kalau sudah ada prodi, jadi form-nya
// dipasang hanya kalau elemennya memang ada.
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

  pasangForm('form-rumpun', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    kirim(e.target, 'pesan-rumpun', () => `/api/kurikulum/prodi/${encodeURIComponent(fd.get('prodi_kode'))}/rumpun`, f => ({
      kode: f.get('kode'), nama: f.get('nama'), semester: Number(f.get('semester')),
      sks: Number(f.get('sks')), proyek_pengikat: f.get('proyek_pengikat'), moda: f.get('moda'),
      mata_kuliah: daftarDari(f.get('mata_kuliah'), '\n'),
      cpl: daftarDari(f.get('cpl'), ','),
    }), hasil => `${(hasil.matakuliah || []).length} mata kuliah ikut diturunkan.`);
  });

  pasangForm('form-cpl', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    kirim(e.target, 'pesan-cpl', () => `/api/kurikulum/prodi/${encodeURIComponent(fd.get('prodi_kode'))}/cpl`, f => ({
      kode: f.get('kode'), domain: f.get('domain'), deskripsi: f.get('deskripsi'),
      rumpun_penyentuh: daftarDari(f.get('rumpun_penyentuh'), ','),
    }));
  });

  pasangForm('form-ritme', async e => {
    e.preventDefault();
    const baris = [...document.querySelectorAll('#sesi-ritme tr')].slice(1);
    const sesi = baris.map(tr => ({
      hari: tr.querySelector('[name=hari]').value,
      moda: tr.querySelector('[name=moda]').value,
      jam_mulai: tr.querySelector('[name=jam_mulai]').value,
      jam_selesai: tr.querySelector('[name=jam_selesai]').value,
      menit_instruksional: Number(tr.querySelector('[name=menit]').value) || 0,
      catatan: tr.querySelector('[name=catatan]').value,
    }));
    const hasil = await kirim(e.target, 'pesan-ritme', () => '/api/kurikulum/ritme', fd => ({
      nama: fd.get('nama'),
      kapasitas_sks_per_semester: Number(fd.get('kapasitas')) || 0,
      sesi,
    }));
    if (hasil) await muat();
  });
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran !== 'dosen') {
    isi.innerHTML = '<div class="kosong">Halaman ini untuk dosen/kaprodi. Kalau Anda kaprodi tapi melihat pesan ini, nomor WhatsApp Anda belum terdaftar sebagai dosen.</div>';
    return;
  }
  ({ prodi = [] } = await apiGet('/api/kurikulum/prodi'));
  try {
    ({ ritme = [] } = await apiGet('/api/kurikulum/ritme'));
  } catch {
    ritme = [];
  }
  isi.innerHTML = kartuProdi() + (prodi.length ? kartuRumpun() + kartuCPL() : '') + kartuRitme();
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
