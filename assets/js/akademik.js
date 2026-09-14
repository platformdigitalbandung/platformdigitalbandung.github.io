import { apiGet, apiPostJson, apiPutJson, apiDeleteJson } from './api.js';
import { esc, halamanUntuk, keadaanKosong, labelTabel, prodiBawaan } from './ui.js';
import { peranAktif } from './akun.js';
import { sayaHalaman, halamanMengajar, PERAN_MENGAJAR } from './hal-dosen.js';

// Roster Mahasiswa & Email Dosen (dosen). Kewenangan tetap dicek backend — halaman
// ini hanya menyiapkan formulir. Peran dan email kampus datang dari
// GET /api/proyekblok/saya,
// bukan ditebak di browser.

const isi = document.getElementById('isi');

const STATUS = ['aktif', 'cuti', 'lulus', 'keluar'];
let saya = null;
let prodi = [];

// Pilihan awal = prodi bawaan peran aktif (prodi mengajar / prodi yang dipimpin), bukan TRPL.
function opsiProdi(terpilih = prodiBawaan(saya)) {
  return prodi.map(p => `<option value="${esc(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)}</option>`).join('');
}

function opsiStatus(terpilih = 'aktif') {
  return STATUS.map(s => `<option value="${s}"${s === terpilih ? ' selected' : ''}>${s}</option>`).join('');
}

// Email kampus menggantikan NIP sebagai identitas dosen (keputusan pemilik
// produk 2026-09-14). Dosen mengisinya sendiri; backend tetap memeriksa domain,
// keabsahan, dan keunikannya.
const DOMAIN_KAMPUS = '@digitalbdg.ac.id';

function kartuEmail() {
  return `
    <div class="kartu">
      <h3>Email Kampus Anda</h3>
      <p class="meta">Email kampus menentukan proyek mana yang boleh Anda nilai, pengajuan mana yang boleh Anda putuskan, dan sesi ujian yang Anda awasi. Anda hanya bisa mengisi email kampus nomor Anda sendiri, dan wajib berakhiran ${DOMAIN_KAMPUS}.</p>
      ${saya.email ? `<p>Email kampus tercatat: <b>${esc(saya.email)}</b></p>` : '<div class="pesan gagal">Email kampus belum diisi — Anda belum bisa dicentang sebagai dosen pengampu, dipilih sebagai kaprodi, membuat dan menilai proyek blok, atau memutus proyek kerja.</div>'}
      <form id="form-email">
        <label>Email kampus <input type="email" name="email" required maxlength="120" value="${esc(saya.email || '')}" placeholder="nama${DOMAIN_KAMPUS}"></label>
        <button>${saya.email ? 'Perbarui Email' : 'Simpan Email'}</button>
      </form>
      <div id="hasil-email"></div>
    </div>`;
}

function kartuSatu(m = {}) {
  return `
    <div class="kartu">
      <h3>${m.nim ? 'Ubah' : 'Tambah'} Satu Mahasiswa</h3>
      <p class="meta">Disimpan berdasarkan NIM: NIM yang sudah ada akan diperbarui, bukan digandakan.</p>
      <form id="form-satu">
        <label>NIM <input name="nim" required maxlength="30" value="${esc(m.nim || '')}"></label>
        <label>Nama <input name="nama" required maxlength="120" value="${esc(m.nama || '')}"></label>
        <label>Nomor WhatsApp <input name="phonenumber" maxlength="20" value="${esc(m.phonenumber || '')}" placeholder="6281234567890"></label>
        <label>Surel <input type="email" name="email" maxlength="120" value="${esc(m.email || '')}"></label>
        <label>Program studi <select name="prodi_kode" required>${opsiProdi(m.prodi_kode)}</select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" value="${esc(m.angkatan || '')}" placeholder="2026"></label>
        <label>Semester <input type="number" name="semester" min="0" max="14" value="${esc(m.semester ?? '')}"></label>
        <label>Status <select name="status">${opsiStatus(m.status)}</select></label>
        <label>Username GitHub <input name="github_username" maxlength="40" value="${esc(m.github_username || '')}" placeholder="opsional — untuk autograder"></label>
        <button>Simpan Mahasiswa</button>
      </form>
      <div id="hasil-satu"></div>
    </div>`;
}

function kartuTempel() {
  return `
    <div class="kartu">
      <h3>Tempel Banyak Mahasiswa</h3>
      <p class="meta">Satu baris per mahasiswa: <code>nim | nama | nomor WhatsApp | prodi | angkatan | semester</code>. Kolom setelah nama boleh dikosongkan — diisi dari pilihan di bawah. Tiap baris diproses sendiri-sendiri, jadi satu baris gagal tidak menghentikan yang lain.</p>
      <form id="form-tempel">
        <label>Baris <textarea name="baris" rows="6" required placeholder="2026TRPL001 | Adinda Puspita | 6281234567890&#10;2026TRPL002 | Bagas Nugroho | 6281234567891 | trpl | 2026 | 1"></textarea></label>
        <label>Program studi bawaan <select name="prodi_kode">${opsiProdi()}</select></label>
        <label>Angkatan bawaan <input name="angkatan" maxlength="9" placeholder="2026"></label>
        <label>Semester bawaan <input type="number" name="semester" min="0" max="14" value="1"></label>
        <button>Proses Semua Baris</button>
      </form>
      <div id="hasil-tempel"></div>
    </div>`;
}

function kartuDaftar() {
  return `
    <div class="kartu">
      <h3>Daftar Roster</h3>
      <form id="form-saring">
        <label>Program studi <select name="prodi"><option value="">(semua)</option>${opsiProdi()}</select></label>
        <label>Angkatan <input name="angkatan" maxlength="9" placeholder="(semua)"></label>
        <button class="sekunder">Tampilkan</button>
      </form>
      <div id="daftar"><p class="redup">Pilih saringan lalu tampilkan.</p></div>
    </div>`;
}

// Satu baris tempel -> body POST /api/mahasiswa. Kolom kosong diisi bawaan.
function parseBaris(teks, bawaan) {
  const [nim = '', nama = '', phonenumber = '', prodiKode = '', angkatan = '', semester = ''] =
    teks.split('|').map(x => x.trim());
  return {
    nim, nama, phonenumber,
    prodi_kode: prodiKode || bawaan.prodi_kode,
    angkatan: angkatan || bawaan.angkatan,
    semester: semester === '' ? bawaan.semester : Number(semester),
    status: 'aktif',
  };
}

function bodyForm(fd) {
  return {
    nim: fd.get('nim'), nama: fd.get('nama'), phonenumber: fd.get('phonenumber') || '',
    email: fd.get('email') || '', prodi_kode: fd.get('prodi_kode'), angkatan: fd.get('angkatan'),
    semester: Number(fd.get('semester')) || 0, status: fd.get('status'),
    github_username: (fd.get('github_username') || '').trim(),
  };
}

async function simpanEmail(e) {
  e.preventDefault();
  const hasil = document.getElementById('hasil-email');
  const email = String(new FormData(e.target).get('email') || '').trim().toLowerCase();
  if (!email.endsWith(DOMAIN_KAMPUS)) {
    hasil.innerHTML = `<div class="pesan gagal">Email kampus wajib berakhiran ${DOMAIN_KAMPUS}.</div>`;
    return;
  }
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const d = await apiPutJson('/api/dosen/email', { email });
    saya.email = d.email || email;
    const berikut = (saya.prodi_mengajar || []).length ? ''
      : ' Langkah berikutnya: kaprodi prodi tempat Anda mengajar mencentang nama Anda di halaman Dosen Pengampu Prodi, supaya Anda bisa mengelola materi dan kuis prodi itu.';
    hasil.innerHTML = `<div class="pesan sukses">Email kampus ${esc(d.nama)} tersimpan: <b>${esc(saya.email)}</b>.${esc(berikut)}</div>`;
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan email kampus: ${esc(err.message)}</div>`;
  }
}

async function simpanSatu(e) {
  e.preventDefault();
  const hasil = document.getElementById('hasil-satu');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const m = await apiPostJson('/api/mahasiswa', bodyForm(new FormData(e.target)));
    hasil.innerHTML = `<div class="pesan sukses">${esc(m.nim)} — ${esc(m.nama)} tersimpan (${esc(m.status)}).</div>`;
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan: ${esc(err.message)}</div>`;
  }
}

async function prosesTempel(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-tempel');
  const bawaan = {
    prodi_kode: fd.get('prodi_kode'), angkatan: fd.get('angkatan') || '',
    semester: Number(fd.get('semester')) || 0,
  };
  const baris = (fd.get('baris') || '').split('\n').map(b => b.trim()).filter(Boolean);
  const hasilBaris = [];
  let berhasil = 0;
  // Berurutan, bukan paralel: ratusan permintaan serentak ke backend gratisan
  // lebih mungkin gagal karena batas koneksi daripada karena datanya salah.
  for (let i = 0; i < baris.length; i++) {
    hasil.innerHTML = `<p class="redup">Memproses baris ${i + 1} dari ${baris.length}…</p>`;
    const body = parseBaris(baris[i], bawaan);
    try {
      await apiPostJson('/api/mahasiswa', body);
      berhasil++;
      hasilBaris.push(`<tr><td>${i + 1}</td><td>${esc(body.nim)}</td><td>${esc(body.nama)}</td><td>tersimpan</td></tr>`);
    } catch (err) {
      hasilBaris.push(`<tr class="band-tinggi"><td>${i + 1}</td><td>${esc(body.nim)}</td><td>${esc(body.nama)}</td><td>${esc(err.message)}</td></tr>`);
    }
  }
  const gagal = baris.length - berhasil;
  hasil.innerHTML = `
    <div class="pesan ${gagal ? 'gagal' : 'sukses'}">${berhasil} dari ${baris.length} baris tersimpan${gagal ? `, ${gagal} gagal — perbaiki baris yang ditandai lalu tempel ulang baris itu saja` : ''}.</div>
    <div class="gulir"><table><thead><tr><th>Baris</th><th>NIM</th><th>Nama</th><th>Hasil</th></tr></thead><tbody>${hasilBaris.join('')}</tbody></table></div>`;
}

let roster = [];

async function tampilDaftar(e) {
  if (e) e.preventDefault();
  const fd = new FormData(document.getElementById('form-saring'));
  const daftar = document.getElementById('daftar');
  daftar.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const q = new URLSearchParams({ prodi: fd.get('prodi') || '', angkatan: fd.get('angkatan') || '' });
    const res = await apiGet(`/api/mahasiswa?${q}`, { auth: true });
    roster = res.mahasiswa || [];
    daftar.innerHTML = roster.length ? `<div class="gulir"><table>
        <thead><tr><th>NIM</th><th>Nama</th><th>Prodi</th><th>Angkatan</th><th class="num">Semester</th><th>Status</th><th>Nomor</th><th>GitHub</th><th></th></tr></thead><tbody>
        ${roster.map(m => `<tr>
          <td>${esc(m.nim)}</td><td>${esc(m.nama)}</td><td>${esc(m.prodi_kode)}</td><td>${esc(m.angkatan)}</td>
          <td class="num">${esc(m.semester)}</td><td>${esc(m.status)}</td><td>${esc(m.phonenumber || '–')}</td><td>${esc(m.github_username || '–')}</td>
          <td><div class="aksi-sel"><a class="aksi sekunder" href="dasbor.html?nim=${encodeURIComponent(m.nim)}">Dasbor</a>
              <button class="sekunder ubah" data-nim="${esc(m.nim)}">Ubah</button>
              <button class="sekunder hapus" data-nim="${esc(m.nim)}">Hapus</button></div></td></tr>`).join('')}
      </tbody></table></div><div id="hasil-hapus"></div>`
      : keadaanKosong({
        judul: 'Tidak ada mahasiswa untuk saringan ini',
        keterangan: 'Tambahkan lewat formulir Tambah Satu Mahasiswa atau Tempel Banyak Mahasiswa di atas.',
        aksi: { href: '#wadah-satu', label: 'Ke formulir tambah' },
      });
    const tabel = daftar.querySelector('table');
    if (tabel) labelTabel(tabel);
    daftar.querySelectorAll('.ubah').forEach(b => b.addEventListener('click', () => ubah(b.dataset.nim)));
    daftar.querySelectorAll('.hapus').forEach(b => b.addEventListener('click', () => hapus(b.dataset.nim)));
  } catch (err) {
    daftar.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function ubah(nim) {
  const m = roster.find(x => x.nim === nim);
  if (!m) return;
  const wadah = document.getElementById('wadah-satu');
  wadah.innerHTML = kartuSatu(m);
  document.getElementById('form-satu').addEventListener('submit', simpanSatu);
  wadah.scrollIntoView({ behavior: 'smooth' });
}

// Penghapusan tidak berantai: nilai, pengajuan, dan kehadiran milik NIM itu
// tetap ada. Kalau masih dirujuk, backend menjawab 422 dengan daftar
// rujukannya, dan dosen harus mengonfirmasi secara sadar.
async function hapus(nim, konfirmasi = false) {
  const hasil = document.getElementById('hasil-hapus');
  if (!konfirmasi && !window.confirm(`Hapus ${nim} dari roster?\n\nMahasiswa yang lulus atau berhenti sebaiknya diubah statusnya, bukan dihapus.`)) return;
  hasil.innerHTML = '<p class="redup">Menghapus…</p>';
  try {
    const d = await apiDeleteJson(`/api/mahasiswa/${encodeURIComponent(nim)}${konfirmasi ? '?konfirmasi=hapus' : ''}`);
    hasil.innerHTML = `<div class="pesan sukses">${esc(d.dihapus)} dihapus dari roster.${d.rujukan_tertinggal ? ` Dokumen yang ditinggalkan tanpa identitas: ${esc(d.rujukan_tertinggal)}.` : ''}</div>`;
    tampilDaftar();
  } catch (err) {
    if (err.status === 422 && !konfirmasi) {
      hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
        <p><button class="sekunder" id="tetap-hapus">Tetap hapus ${esc(nim)}</button></p>`;
      document.getElementById('tetap-hapus').addEventListener('click', () => hapus(nim, true));
      return;
    }
    hasil.innerHTML = `<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const res = await apiGet('/api/kurikulum/prodi');
  prodi = res.prodi || [];
  if (!prodi.length) {
    isi.innerHTML = kartuEmail() + keadaanKosong({
      judul: 'Data program studi belum ada',
      keterangan: 'Roster disusun per prodi, jadi data kurikulum harus ada sebelum mahasiswa didaftarkan.',
      siapa: 'admin (membuat prodi) dan kaprodi (mengisi kurikulum)',
      aksi: { href: 'kurikulum.html', label: 'Buka Kurikulum' },
    });
    document.getElementById('form-email').addEventListener('submit', simpanEmail);
    return;
  }
  isi.innerHTML = kartuEmail() + '<div id="wadah-satu"></div>' + kartuTempel() + kartuDaftar();
  document.getElementById('wadah-satu').innerHTML = kartuSatu();
  document.getElementById('form-email').addEventListener('submit', simpanEmail);
  document.getElementById('form-satu').addEventListener('submit', simpanSatu);
  document.getElementById('form-tempel').addEventListener('submit', prosesTempel);
  document.getElementById('form-saring').addEventListener('submit', tampilDaftar);
}

async function mulai() {
  const s = await sayaHalaman(isi);
  if (s === undefined) return;
  // Admin tetap dosen: email kampusnya sendiri boleh diisi di sini (syarat
  // dipilih sebagai kaprodi), tetapi form roster hanya di peran dosen/kaprodi.
  if (s && s.peran === 'dosen' && peranAktif(s) === 'admin') {
    saya = s;
    isi.innerHTML = kartuEmail() + '<div id="roster-peran"></div>';
    document.getElementById('form-email').addEventListener('submit', simpanEmail);
    halamanUntuk(s, PERAN_MENGAJAR, {
      judul: 'Roster mahasiswa', wadah: document.getElementById('roster-peran'),
      pesan: 'Mendaftarkan dan mengubah roster mahasiswa dikerjakan di peran dosen atau kaprodi.',
    });
    return;
  }
  if (!halamanMengajar(s, isi, {
    judul: 'Roster Mahasiswa & Email Dosen',
    pesan: 'Roster memuat nomor WhatsApp dan surel mahasiswa, jadi hanya dikelola dosen.',
    untukMahasiswa: { href: 'saya.html', label: 'Beranda Saya', pesan: 'Data roster Anda dikelola dosen. Bila ada yang keliru, sampaikan ke dosen atau kaprodi prodi Anda.' },
  })) return;
  saya = s;
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
