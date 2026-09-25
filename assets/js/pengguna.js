import { apiGet, apiPostJson, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, halamanUntuk, keadaanKosong, labelTabel, prodiBawaan } from './ui.js';

// Pengguna — admin dan kaprodi (keputusan developer Arfan 2026-09-25).
// Mahasiswa: GET /api/pengguna/mahasiswa (lingkup dari backend), tambah/ubah
// lewat rute roster POST /api/mahasiswa. Dosen: /api/pengguna/dosen.
// Reset kata sandi: POST /api/pengguna/sandi/reset. Kewenangan diputuskan
// backend; halaman ini hanya tidak menawarkan aksi yang pasti ditolak.

const isi = document.getElementById('isi');
const STATUS = ['aktif', 'cuti', 'lulus', 'keluar'];

let saya = null;
let admin = false;
let lingkup = [];
let prodi = [];
let dosen = [];
let mahasiswa = [];
let mhsDimuat = false;
let saringanMhs = { prodi: '', angkatan: '', cari: '' };
let cariDosen = '';

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function pesan(id, jenis, teks) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = teks ? `<div class="pesan ${jenis}">${teks}</div>` : '';
}

/** Nomor WhatsApp baku 62…, sama dengan waparse.NomorWA di backend (hanya pratinjau). */
function nomorBaku(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (/e\+?\d/i.test(t)) return null; // angka ilmiah dari Excel (6.28E+12): digitnya sudah hilang
  let n = t.replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  return n.startsWith('62') && n.length >= 10 && n.length <= 15 ? n : null;
}

/** Prodi yang boleh dikelola: admin semua, kaprodi hanya yang dipimpinnya. */
function prodiKelola() {
  return admin ? prodi : prodi.filter(p => lingkup.includes(p.kode));
}
function namaProdi(kode) {
  const p = prodi.find(x => x.kode === kode);
  return p ? p.nama : String(kode || '').toUpperCase();
}
function opsiProdi(terpilih, { semua = false } = {}) {
  const daftar = prodiKelola();
  return (semua && daftar.length > 1 ? `<option value="">(semua${admin ? '' : ' prodi Anda'})</option>` : '') +
    daftar.map(p => `<option value="${escAttr(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)}</option>`).join('');
}
function opsiStatus(terpilih = 'aktif') {
  return STATUS.map(s => `<option value="${s}"${s === terpilih ? ' selected' : ''}>${s}</option>`).join('');
}
function lencanaSandi(sendiri) {
  return sendiri ? '<span class="lencana rendah">sudah diganti</span>' : '<span class="lencana sedang">kata sandi awal</span>';
}

// ===================== Mahasiswa =====================

function kartuCariMhs() {
  return `
    <div class="kartu">
      <h3>Cari Mahasiswa</h3>
      <form id="form-cari-mhs" class="saringan">
        <label>Program studi <select name="prodi">${opsiProdi(saringanMhs.prodi, { semua: true })}</select></label>
        <label>Angkatan <input name="angkatan" maxlength="9" placeholder="(semua)" value="${escAttr(saringanMhs.angkatan)}"></label>
        <label>NIM atau nama <input name="cari" maxlength="60" value="${escAttr(saringanMhs.cari)}"></label>
        <button class="sekunder">Tampilkan</button>
      </form>
      <div id="pesan-mhs"></div>
      <div id="daftar-mhs"><p class="redup">Pilih saringan lalu tampilkan.</p></div>
    </div>`;
}

function tabelMhs() {
  if (!mahasiswa.length) {
    return keadaanKosong({
      judul: 'Tidak ada mahasiswa yang cocok',
      keterangan: 'Ubah saringan, atau tambahkan mahasiswa lewat formulir di bawah.',
    });
  }
  return `<p class="meta">${mahasiswa.length} mahasiswa · ${mahasiswa.filter(m => !m.sandi_sendiri).length} masih memakai kata sandi awal</p>
    <div class="gulir"><table>
    <thead><tr><th>NIM</th><th>Nama</th><th>Prodi</th><th>WhatsApp</th><th>Email</th><th>Status</th><th>Kata sandi</th><th></th></tr></thead><tbody>
    ${mahasiswa.map(m => `<tr data-nim="${escAttr(m.nim)}">
      <td>${esc(m.nim)}</td>
      <td>${esc(m.nama)}</td>
      <td>${esc(String(m.prodi_kode || '').toUpperCase())} · ${esc(m.angkatan || '—')} · smt ${esc(m.semester || '—')}</td>
      <td>${m.phonenumber ? esc(m.phonenumber) : '<span class="lencana tinggi">belum ada</span>'}</td>
      <td>${esc(m.email || '—')}</td>
      <td>${esc(m.status || 'aktif')}</td>
      <td>${lencanaSandi(m.sandi_sendiri)}</td>
      <td><div class="aksi-sel">
        <button type="button" class="sekunder" data-aksi="ubah-mhs">Ubah</button>
        <button type="button" class="sekunder" data-aksi="reset-mhs">Reset kata sandi</button>
      </div></td></tr>`).join('')}
    </tbody></table></div>`;
}

function kartuFormMhs(m = null) {
  const baru = !m;
  m = m || { prodi_kode: saringanMhs.prodi || prodiBawaan(saya) };
  return `
    <div class="kartu" id="kartu-form-mhs">
      <h3>${baru ? 'Tambah Mahasiswa' : `Ubah Mahasiswa ${esc(m.nim)}`}</h3>
      <p class="meta">Disimpan berdasarkan NIM: NIM yang sudah ada diperbarui, bukan digandakan. Nomor WhatsApp dibakukan ke awalan 62 (boleh diketik 08…, 8…, atau 62…).</p>
      <form id="form-mhs">
        <label>NIM <input name="nim" required maxlength="30" value="${escAttr(m.nim || '')}"${baru ? '' : ' readonly'}></label>
        <label>Nama <input name="nama" required maxlength="120" value="${escAttr(m.nama || '')}"></label>
        <label>Nomor WhatsApp <input name="phonenumber" maxlength="20" inputmode="tel" value="${escAttr(m.phonenumber || '')}" placeholder="081234567890"></label>
        <label>Email <input type="email" name="email" maxlength="120" value="${escAttr(m.email || '')}" placeholder="menentukan kata sandi awal"></label>
        <label>Program studi <select name="prodi_kode" required>${opsiProdi(m.prodi_kode)}</select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" value="${escAttr(m.angkatan || '')}" placeholder="2026"></label>
        <label>Semester <input type="number" name="semester" min="0" max="14" value="${escAttr(m.semester ?? 1)}"></label>
        <label>Status <select name="status">${opsiStatus(m.status)}</select></label>
        <label>Username GitHub <input name="github_username" maxlength="40" value="${escAttr(m.github_username || '')}" placeholder="opsional — untuk autograder"></label>
        <div class="cta-row">
          <button>${baru ? 'Tambah Mahasiswa' : 'Simpan Perubahan'}</button>
          ${baru ? '' : '<button type="button" class="sekunder" data-aksi="batal-mhs">Batal</button>'}
        </div>
      </form>
      <div id="hasil-form-mhs"></div>
    </div>`;
}

function kartuImpor() {
  return `
    <div class="kartu">
      <h3>Impor dari Excel</h3>
      <p class="meta">Salin baris dari Excel atau Google Sheets lalu tempel di sini — satu baris satu mahasiswa, kolom berurutan: <b>NIM, Nama, Nomor WhatsApp, Email, Prodi, Angkatan, Semester</b>. Kolom setelah Nama boleh kosong; prodi, angkatan, dan semester kosong diisi dari pilihan di bawah. Baris judul kolom dilewati otomatis. Bisa juga dipisah tanda <code>|</code>.</p>
      <form id="form-impor">
        <label>Baris <textarea name="baris" rows="7" required placeholder="2026TRPL001&#9;Adinda Puspita&#9;81234567890&#9;2026001@digitalbdg.ac.id"></textarea></label>
        <div class="saringan">
          <label>Program studi bawaan <select name="prodi_kode">${opsiProdi(saringanMhs.prodi || prodiBawaan(saya))}</select></label>
          <label>Angkatan bawaan <input name="angkatan" maxlength="9" placeholder="2026"></label>
          <label>Semester bawaan <input type="number" name="semester" min="0" max="14" value="1"></label>
        </div>
        <div class="cta-row"><button type="button" class="sekunder" data-aksi="periksa-impor">Periksa</button></div>
      </form>
      <div id="pratinjau-impor"></div>
    </div>`;
}

/** Satu baris tempel → body POST /api/mahasiswa + catatan galat pratinjau. */
function uraiBaris(teks, bawaan) {
  const kolom = (teks.includes('\t') ? teks.split('\t') : teks.split('|')).map(x => x.trim());
  const [nim = '', nama = '', nomor = '', email = '', prodiKode = '', angkatan = '', semester = ''] = kolom;
  const baku = nomorBaku(nomor);
  const body = {
    nim, nama, phonenumber: baku || '', email,
    prodi_kode: (prodiKode || bawaan.prodi_kode).toLowerCase(),
    angkatan: angkatan || bawaan.angkatan,
    semester: semester === '' ? bawaan.semester : Number(semester),
    status: 'aktif',
  };
  const galat = [];
  if (!nim) galat.push('NIM kosong');
  if (!nama) galat.push('nama kosong');
  if (baku === null) galat.push(`nomor "${nomor}" tidak sah${/e\+?\d/i.test(nomor) ? ' (format kolom Excel sebagai teks)' : ''}`);
  if (!body.angkatan) galat.push('angkatan kosong');
  if (!prodiKelola().some(p => p.kode === body.prodi_kode)) galat.push(`prodi ${body.prodi_kode || '(kosong)'} bukan prodi yang Anda kelola`);
  if (Number.isNaN(body.semester)) galat.push('semester bukan angka');
  return { body, galat, nomorAsal: nomor };
}

let barisImpor = [];

function periksaImpor() {
  const form = document.getElementById('form-impor');
  const fd = new FormData(form);
  const bawaan = { prodi_kode: fd.get('prodi_kode') || '', angkatan: String(fd.get('angkatan') || '').trim(), semester: Number(fd.get('semester')) || 0 };
  const semua = String(fd.get('baris') || '').split('\n').map(x => x.replace(/\r$/, '')).filter(x => x.trim());
  barisImpor = semua.filter((x, i) => !(i === 0 && /^\s*nim\b/i.test(x))).map(x => uraiBaris(x, bawaan));
  const wadah = document.getElementById('pratinjau-impor');
  if (!barisImpor.length) {
    wadah.innerHTML = '<div class="pesan gagal">Belum ada baris yang bisa dibaca.</div>';
    return;
  }
  const sah = barisImpor.filter(b => !b.galat.length);
  const tanpaNomor = sah.filter(b => !b.body.phonenumber).length;
  wadah.innerHTML = `
    <div class="gulir"><table>
      <thead><tr><th>NIM</th><th>Nama</th><th>WhatsApp (baku)</th><th>Email</th><th>Prodi · angkatan · smt</th><th>Pemeriksaan</th></tr></thead><tbody>
      ${barisImpor.map(b => `<tr${b.galat.length ? ' class="baris-galat"' : ''}>
        <td>${esc(b.body.nim)}</td><td>${esc(b.body.nama)}</td>
        <td>${b.body.phonenumber ? esc(b.body.phonenumber) : (b.nomorAsal ? esc(b.nomorAsal) : '—')}</td>
        <td>${esc(b.body.email || '—')}</td>
        <td>${esc(b.body.prodi_kode.toUpperCase())} · ${esc(b.body.angkatan || '—')} · ${esc(b.body.semester)}</td>
        <td>${b.galat.length ? esc(b.galat.join('; ')) : 'siap'}</td></tr>`).join('')}
      </tbody></table></div>
    <p class="ringkas-impor">${sah.length} dari ${barisImpor.length} baris siap disimpan.${tanpaNomor ? ` ${tanpaNomor} di antaranya tanpa nomor WhatsApp — belum bisa masuk sampai nomornya diisi.` : ''} Semua nomor yang siap sudah berawalan 62.</p>
    ${sah.length ? `<div class="cta-row"><button type="button" data-aksi="simpan-impor">Simpan ${sah.length} Mahasiswa</button></div>` : ''}
    <div id="hasil-impor"></div>`;
  const t = wadah.querySelector('table');
  if (t) labelTabel(t);
}

async function simpanImpor(tombol) {
  const sah = barisImpor.filter(b => !b.galat.length);
  tombol.disabled = true;
  const gagal = [];
  let berhasil = 0;
  for (const b of sah) {
    try {
      await apiPostJson('/api/mahasiswa', b.body);
      berhasil++;
    } catch (err) {
      gagal.push(`${b.body.nim}: ${err.message}`);
    }
  }
  tombol.disabled = false;
  pesan('hasil-impor', gagal.length ? 'gagal' : 'sukses',
    `${berhasil} mahasiswa tersimpan.${gagal.length ? `<br>Gagal:<br>${gagal.map(esc).join('<br>')}` : ''}`);
  if (berhasil) await muatMahasiswa();
}

async function muatMahasiswa() {
  const q = new URLSearchParams({ prodi: saringanMhs.prodi, angkatan: saringanMhs.angkatan, cari: saringanMhs.cari });
  const { mahasiswa: d = [] } = await apiGet(`/api/pengguna/mahasiswa?${q}`);
  mahasiswa = d;
  mhsDimuat = true;
  renderDaftarMhs();
}

function renderDaftarMhs() {
  const wadah = document.getElementById('daftar-mhs');
  if (!wadah || !mhsDimuat) return;
  wadah.innerHTML = tabelMhs();
  const t = wadah.querySelector('table');
  if (t) labelTabel(t);
}

async function simpanMhs(form) {
  const fd = new FormData(form);
  const body = {
    nim: String(fd.get('nim') || '').trim(), nama: String(fd.get('nama') || '').trim(),
    phonenumber: String(fd.get('phonenumber') || '').trim(), email: String(fd.get('email') || '').trim(),
    prodi_kode: fd.get('prodi_kode'), angkatan: String(fd.get('angkatan') || '').trim(),
    semester: Number(fd.get('semester')) || 0, status: fd.get('status'),
    github_username: String(fd.get('github_username') || '').trim(),
  };
  if (body.phonenumber && nomorBaku(body.phonenumber) === null) {
    pesan('hasil-form-mhs', 'gagal', 'Nomor WhatsApp tidak sah. Awali dengan 0, 8, atau 62.');
    return;
  }
  try {
    const m = await apiPostJson('/api/mahasiswa', body);
    pesan('hasil-form-mhs', 'sukses', `Tersimpan: ${esc(m.nim)} — ${esc(m.nama)}${m.phonenumber ? ` (WhatsApp ${esc(m.phonenumber)})` : ' — belum ada nomor WhatsApp, belum bisa masuk'}.`);
    if (mhsDimuat) await muatMahasiswa();
  } catch (err) {
    pesan('hasil-form-mhs', 'gagal', `Gagal: ${esc(err.message)}`);
  }
}

// ===================== Dosen =====================

function jabatanDosen(d) {
  const j = [];
  if (d.admin) j.push('<span class="lencana">admin</span>');
  if ((d.kaprodi_prodi || []).length) j.push(`<span class="lencana">kaprodi ${esc(d.kaprodi_prodi.join('/').toUpperCase())}</span>`);
  return j.join(' ') || '—';
}

function bolehResetDosen(d) {
  return admin || (!d.admin && !(d.kaprodi_prodi || []).length);
}

function tabelDosen() {
  const q = cariDosen.toLowerCase();
  const daftar = dosen.filter(d => !q || `${d.nama} ${d.email} ${d.nohp}`.toLowerCase().includes(q));
  if (!dosen.length) {
    return keadaanKosong({
      judul: admin ? 'Belum ada dosen' : 'Belum ada dosen yang mengajar di prodi Anda',
      keterangan: admin ? 'Tambahkan dosen lewat formulir di atas.' : 'Dosen tampil di sini setelah dicentang di halaman Dosen Pengampu Prodi.',
      aksi: admin ? null : { href: 'pengampu.html', label: 'Buka Dosen Pengampu Prodi' },
    });
  }
  return `<p class="meta">${daftar.length} dari ${dosen.length} dosen${admin ? ` · ${dosen.filter(d => !d.aktif).length} nonaktif` : ''} · ${dosen.filter(d => !d.sandi_sendiri).length} masih memakai kata sandi awal</p>
    <div class="gulir"><table>
    <thead><tr><th>Nama</th><th>Email kampus</th><th>WhatsApp</th><th>Mengajar</th><th>Jabatan</th><th>Status</th><th>Kata sandi</th><th></th></tr></thead><tbody>
    ${daftar.map(d => `<tr data-id="${escAttr(d.id)}">
      <td>${esc(d.nama || '(nama belum diisi)')}</td>
      <td>${d.email ? esc(d.email) : '<span class="lencana sedang">belum diisi</span>'}</td>
      <td>${esc(d.nohp)}</td>
      <td>${(d.prodi_kode || []).length ? esc(d.prodi_kode.join(', ').toUpperCase()) : '—'}</td>
      <td>${jabatanDosen(d)}</td>
      <td>${d.aktif ? 'aktif' : '<span class="lencana tinggi">nonaktif</span>'}</td>
      <td>${d.email ? lencanaSandi(d.sandi_sendiri) : '<span class="redup">menunggu email</span>'}</td>
      <td><div class="aksi-sel">
        ${bolehResetDosen(d) && d.email ? '<button type="button" class="sekunder" data-aksi="reset-dosen">Reset kata sandi</button>' : ''}
        ${admin ? `<button type="button" class="sekunder" data-aksi="ubah-dosen">Ubah</button>
          ${d.aktif ? `<button type="button" class="sekunder" data-aksi="admin-dosen">${d.admin ? 'Cabut admin' : 'Jadikan admin'}</button>` : ''}
          <button type="button" class="${d.aktif ? 'bahaya' : 'sekunder'}" data-aksi="aktif-dosen">${d.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>` : ''}
      </div></td></tr>`).join('')}
    </tbody></table></div>`;
}

function kartuTambahDosen() {
  return `
    <div class="kartu">
      <h3>Tambah Dosen</h3>
      <p class="meta">Dosen baru langsung aktif. Email kampusnya diisi dosen sendiri (lewat WhatsApp <code>daftar dosen | email</code> atau halaman Roster &amp; Email Dosen); setelah itu ia bisa masuk dengan email + kata sandi awal.${admin ? '' : ' Dosen baru tampil di daftar prodi Anda setelah Anda mencentangnya di Dosen Pengampu Prodi.'} Nomor yang pernah dinonaktifkan hanya bisa diaktifkan kembali admin.</p>
      <form id="form-tambah-dosen" class="saringan">
        <label>Nomor WhatsApp <input name="nohp" required maxlength="20" inputmode="tel" placeholder="081234567890"></label>
        <label>Nama lengkap <input name="nama" required maxlength="120"></label>
        <button>Tambah Dosen</button>
      </form>
      <div id="hasil-tambah-dosen"></div>
    </div>`;
}

function kartuDaftarDosen() {
  return `
    <div class="kartu">
      <h3>${admin ? 'Semua Dosen' : 'Dosen yang Mengajar di Prodi Anda'}</h3>
      <form id="form-cari-dosen" class="saringan"><label>Cari nama, email, atau nomor <input name="cari" maxlength="60" value="${escAttr(cariDosen)}"></label></form>
      <div id="pesan-dosen"></div>
      <div id="daftar-dosen">${tabelDosen()}</div>
    </div>
    <div id="wadah-ubah-dosen"></div>
    ${admin ? '<div class="kartu"><h3>Riwayat Jabatan Admin</h3><div id="riwayat-admin"><p class="redup">Memuat…</p></div></div>' : ''}`;
}

function kartuUbahDosen(d) {
  return `
    <div class="kartu" id="kartu-ubah-dosen">
      <h3>Ubah Dosen: ${esc(d.nama || d.nohp)}</h3>
      <p class="meta">Email kampus tidak diubah di sini — dosennya sendiri yang mengisi, karena email menentukan wewenangnya.</p>
      <form id="form-ubah-dosen" data-id="${escAttr(d.id)}">
        <label>Nama lengkap <input name="nama" required maxlength="120" value="${escAttr(d.nama || '')}"></label>
        <label>Nomor WhatsApp <input name="nohp" required maxlength="20" inputmode="tel" value="${escAttr(d.nohp || '')}"></label>
        <div class="cta-row"><button>Simpan Perubahan</button><button type="button" class="sekunder" data-aksi="batal-dosen">Batal</button></div>
      </form>
      <div id="hasil-ubah-dosen"></div>
    </div>`;
}

function renderDaftarDosen() {
  const wadah = document.getElementById('daftar-dosen');
  if (!wadah) return;
  wadah.innerHTML = tabelDosen();
  const t = wadah.querySelector('table');
  if (t) labelTabel(t);
}

async function muatDosen() {
  const r = await apiGet('/api/pengguna/dosen');
  dosen = r.dosen || [];
  admin = Boolean(r.admin);
  lingkup = r.lingkup || [];
}

async function muatRiwayat() {
  const wadah = document.getElementById('riwayat-admin');
  if (!wadah) return;
  try {
    const { riwayat = [] } = await apiGet('/api/pengguna/riwayat-jabatan');
    wadah.innerHTML = riwayat.length
      ? `<ul class="daftar-ringkas">${riwayat.map(r => `<li>${r.aksi === 'tetapkan' ? 'Menetapkan' : 'Mencabut'} admin <b>${esc(r.nama || '')}</b><span class="kecil">oleh ${esc(r.oleh)} · ${esc(new Date(r.pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }))} WIB</span></li>`).join('')}</ul>`
      : '<p class="redup">Belum ada perubahan jabatan admin lewat halaman ini.</p>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function aksiDosen(aksi, d) {
  try {
    if (aksi === 'reset-dosen') {
      if (!window.confirm(`Reset kata sandi ${d.nama}? Kata sandinya kembali ke kata sandi awal (bagian email sebelum @ ditambah ADB).`)) return;
      await apiPostJson('/api/pengguna/sandi/reset', { peran: 'dosen', id: d.id });
      pesan('pesan-dosen', 'sukses', `Kata sandi ${esc(d.nama)} kembali ke kata sandi awal. Ia masuk dengan ${esc(d.email)} dan kata sandi <b>bagian email sebelum @ + ADB</b>.`);
    } else if (aksi === 'admin-dosen') {
      const jadi = !d.admin;
      if (!window.confirm(jadi
        ? `Jadikan ${d.nama} admin? Admin bisa menetapkan kaprodi, membuat prodi baru, membuka laporan semua prodi, dan mengelola semua pengguna termasuk jabatan admin.`
        : `Cabut jabatan admin ${d.nama}?`)) return;
      await apiPutJson(`/api/pengguna/dosen/${encodeURIComponent(d.id)}/admin`, { admin: jadi });
      pesan('pesan-dosen', 'sukses', `${esc(d.nama)} ${jadi ? 'kini admin' : 'bukan admin lagi'}. Label perannya berubah setelah ia keluar lalu masuk lagi.`);
      await muatRiwayat();
    } else if (aksi === 'aktif-dosen') {
      const jadi = !d.aktif;
      if (!window.confirm(jadi
        ? `Aktifkan kembali ${d.nama}?`
        : `Nonaktifkan ${d.nama}? Semua perannya (dosen, kaprodi, admin) gugur dan ia tidak bisa masuk lagi sampai diaktifkan kembali admin.`)) return;
      await apiPutJson(`/api/pengguna/dosen/${encodeURIComponent(d.id)}/aktif`, { aktif: jadi });
      pesan('pesan-dosen', 'sukses', `${esc(d.nama)} ${jadi ? 'aktif kembali' : 'dinonaktifkan'}.`);
    } else if (aksi === 'ubah-dosen') {
      document.getElementById('wadah-ubah-dosen').innerHTML = kartuUbahDosen(d);
      document.getElementById('kartu-ubah-dosen').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    await muatDosen();
    renderDaftarDosen();
  } catch (err) {
    pesan('pesan-dosen', 'gagal', `Gagal: ${esc(err.message)}`);
  }
}

// ===================== Halaman =====================

function tabAktif() { return location.hash === '#dosen' ? 'dosen' : 'mahasiswa'; }

function render() {
  const tab = tabAktif();
  isi.innerHTML = `
    <div class="tab-halaman" role="tablist" aria-label="Jenis pengguna">
      <button type="button" role="tab" id="tab-mahasiswa" aria-selected="${tab === 'mahasiswa'}" aria-controls="panel-pengguna"${tab === 'mahasiswa' ? '' : ' tabindex="-1"'}>Mahasiswa</button>
      <button type="button" role="tab" id="tab-dosen" aria-selected="${tab === 'dosen'}" aria-controls="panel-pengguna"${tab === 'dosen' ? '' : ' tabindex="-1"'}>Dosen</button>
    </div>
    <div id="panel-pengguna" role="tabpanel" aria-labelledby="tab-${tab}">
      ${tab === 'mahasiswa' ? kartuCariMhs() + kartuFormMhs() + kartuImpor() : kartuTambahDosen() + kartuDaftarDosen()}
    </div>`;
  if (tab === 'dosen') {
    renderDaftarDosen();
    muatRiwayat();
  } else {
    renderDaftarMhs();
  }
}

function pasangPendengar() {
  isi.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.getAttribute('role') === 'tab') {
      const tujuan = t.id === 'tab-dosen' ? '#dosen' : '#mahasiswa';
      if (location.hash !== tujuan) history.replaceState(null, '', tujuan);
      render();
      document.getElementById(t.id).focus();
      return;
    }
    const aksi = t.dataset.aksi;
    if (!aksi) return;
    if (aksi === 'periksa-impor') return periksaImpor();
    if (aksi === 'simpan-impor') return simpanImpor(t);
    if (aksi === 'batal-mhs') {
      document.getElementById('kartu-form-mhs').outerHTML = kartuFormMhs();
      return;
    }
    if (aksi === 'batal-dosen') {
      document.getElementById('wadah-ubah-dosen').innerHTML = '';
      return;
    }
    const barisMhs = t.closest('tr[data-nim]');
    if (barisMhs) {
      const m = mahasiswa.find(x => x.nim === barisMhs.dataset.nim);
      if (!m) return;
      if (aksi === 'ubah-mhs') {
        document.getElementById('kartu-form-mhs').outerHTML = kartuFormMhs(m);
        document.getElementById('kartu-form-mhs').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (aksi === 'reset-mhs') {
        if (!window.confirm(`Reset kata sandi ${m.nama} (${m.nim})? Kata sandinya kembali ke kata sandi awal.`)) return;
        try {
          await apiPostJson('/api/pengguna/sandi/reset', { peran: 'mahasiswa', id: m.id });
          pesan('pesan-mhs', 'sukses', `Kata sandi ${esc(m.nama)} kembali ke kata sandi awal: ${m.email ? 'bagian email sebelum @' : 'NIM'} ditambah <b>ADB</b>. Ia masuk dengan NIM ${esc(m.nim)}.`);
          await muatMahasiswa();
        } catch (err) {
          pesan('pesan-mhs', 'gagal', `Gagal: ${esc(err.message)}`);
        }
      }
      return;
    }
    const barisDosen = t.closest('tr[data-id]');
    if (barisDosen) {
      const d = dosen.find(x => x.id === barisDosen.dataset.id);
      if (d) await aksiDosen(aksi, d);
    }
  });

  isi.addEventListener('keydown', (e) => {
    if (!e.target.closest('.tab-halaman') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const lain = tabAktif() === 'dosen' ? 'tab-mahasiswa' : 'tab-dosen';
    document.getElementById(lain).click();
  });

  isi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'form-cari-mhs') {
      const fd = new FormData(form);
      saringanMhs = { prodi: fd.get('prodi') || '', angkatan: String(fd.get('angkatan') || '').trim(), cari: String(fd.get('cari') || '').trim() };
      try {
        pesan('pesan-mhs', '', '');
        await muatMahasiswa();
      } catch (err) {
        pesan('pesan-mhs', 'gagal', esc(err.message));
      }
    } else if (form.id === 'form-mhs') {
      await simpanMhs(form);
    } else if (form.id === 'form-tambah-dosen') {
      const fd = new FormData(form);
      try {
        const r = await apiPostJson('/api/pengguna/dosen', { nohp: String(fd.get('nohp') || '').trim(), nama: String(fd.get('nama') || '').trim() });
        pesan('hasil-tambah-dosen', 'sukses', r.baru
          ? `${esc(r.nama)} terdaftar sebagai dosen (WhatsApp ${esc(r.nohp)}). Minta ia mengisi email kampusnya.`
          : `Nomor ${esc(r.nohp)} sudah terdaftar sebagai dosen aktif (${esc(r.nama)}).`);
        form.reset();
        await muatDosen();
        renderDaftarDosen();
      } catch (err) {
        pesan('hasil-tambah-dosen', 'gagal', `Gagal: ${esc(err.message)}`);
      }
    } else if (form.id === 'form-ubah-dosen') {
      const fd = new FormData(form);
      try {
        await apiPutJson(`/api/pengguna/dosen/${encodeURIComponent(form.dataset.id)}`, { nama: String(fd.get('nama') || '').trim(), nohp: String(fd.get('nohp') || '').trim() });
        document.getElementById('wadah-ubah-dosen').innerHTML = '';
        pesan('pesan-dosen', 'sukses', 'Data dosen tersimpan.');
        await muatDosen();
        renderDaftarDosen();
      } catch (err) {
        pesan('hasil-ubah-dosen', 'gagal', `Gagal: ${esc(err.message)}`);
      }
    }
  });

  isi.addEventListener('input', (e) => {
    if (e.target.closest('#form-cari-dosen')) {
      cariDosen = e.target.value.trim();
      renderDaftarDosen();
    }
  });
}

async function muat() {
  saya = await sayaSekarang;
  if (!halamanUntuk(saya, ['admin', 'kaprodi'], {
    judul: 'Pengguna',
    pesan: 'Pengelolaan pengguna untuk admin (semua prodi) dan kaprodi (prodinya).',
  })) return;
  const [{ prodi: p = [] }] = await Promise.all([apiGet('/api/kurikulum/prodi'), muatDosen()]);
  prodi = p || [];
  if (!admin && lingkup.length === 1) saringanMhs.prodi = lingkup[0];
  render();
  pasangPendengar();
  if (tabAktif() === 'mahasiswa' && saringanMhs.prodi) {
    try { await muatMahasiswa(); } catch (err) { pesan('pesan-mhs', 'gagal', esc(err.message)); }
  }
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
