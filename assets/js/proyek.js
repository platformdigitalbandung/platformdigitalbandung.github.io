import { apiGet, apiPostJson } from './api.js';
import { esc, istilah, keadaanKosong, labelTabel, pilihProdiBawaan } from './ui.js';
import { sayaHalaman, halamanMengajar, kartuPrasyarat } from './hal-dosen.js';

// Kelola Proyek Blok (dosen). Kewenangan tetap dicek backend: hanya dosen
// pembimbing proyek itu yang boleh menilai — halaman ini cuma menyiapkan
// formulirnya. Rumpun dan mata kuliah dibaca dari data kurikulum, tidak
// diketik ulang di sini. Anggota dipilih dari roster (koleksi mahasiswa),
// bukan diketik ulang sebagai "nim | nama | nomor" — backend tetap
// menyelaraskan nama dan nomornya dari roster lewat NIM.

const isi = document.getElementById('isi');
function angka(n) { return typeof n === 'number' ? n.toFixed(2) : '–'; }

let saya = null;
const rumpunPerProdi = new Map();
let roster = [];

async function rumpunProdi(kode) {
  if (!rumpunPerProdi.has(kode)) {
    const res = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
    rumpunPerProdi.set(kode, res.rumpun || []);
  }
  return rumpunPerProdi.get(kode);
}

const STATUS_PROYEK = [['draft', 'Draf (belum dimulai)'], ['berjalan', 'Berjalan'], ['selesai', 'Selesai']];

function formBuat(prodi) {
  return `
    <div class="kartu">
      <h3>Buat Proyek Blok</h3>
      <p class="catatan-istilah">${istilah('proyek blok', 'Proyek blok')}: satu per rumpun per angkatan. Proyek dibuat atas nama email kampus Anda (${esc(saya.email)}) sebagai pembimbing.</p>
      <form id="form-buat">
        <label>Program studi
          <select name="prodi_kode" id="pilih-prodi" required>
            ${prodi.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)}</option>`).join('')}
          </select></label>
        <label>Rumpun <select name="rumpun_kode" id="pilih-rumpun" required></select></label>
        <label>Angkatan <input name="angkatan" id="isi-angkatan" required maxlength="9" placeholder="2026" inputmode="numeric"></label>
        <label>Judul proyek <input name="judul" required maxlength="200"></label>
        <label>Deskripsi <textarea name="deskripsi" rows="2"></textarea></label>
        <fieldset class="kelompok-anggota">
          <legend>Anggota dari roster</legend>
          <p class="meta">Isi angkatan, lalu centang mahasiswa prodi itu. Anggota boleh dikosongkan dan ditambah belakangan.</p>
          <div id="pilih-anggota"><p class="redup">Isi angkatan untuk memuat roster.</p></div>
        </fieldset>
        <label>Status
          <select name="status">
            ${STATUS_PROYEK.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
          </select></label>
        <button>Simpan Proyek</button>
      </form>
      <div id="hasil-buat"></div>
    </div>`;
}

async function muatRoster() {
  const prodi = document.getElementById('pilih-prodi').value;
  const angkatan = document.getElementById('isi-angkatan').value.trim();
  const wadah = document.getElementById('pilih-anggota');
  roster = [];
  if (!angkatan) {
    wadah.innerHTML = '<p class="redup">Isi angkatan untuk memuat roster.</p>';
    return;
  }
  wadah.innerHTML = '<p class="redup">Memuat roster…</p>';
  try {
    const q = new URLSearchParams({ prodi, angkatan });
    const res = await apiGet(`/api/mahasiswa?${q}`, { auth: true });
    roster = (res.mahasiswa || []).filter(m => !m.status || m.status === 'aktif');
    wadah.innerHTML = roster.length
      ? `<div class="pilih-anggota">${roster.map(m => `<label><input type="checkbox" name="anggota" value="${esc(m.nim)}"> ${esc(m.nama)} <span class="redup">${esc(m.nim)}</span></label>`).join('')}</div>
        <p class="meta">${roster.length} mahasiswa aktif di roster ${esc(prodi.toUpperCase())} angkatan ${esc(angkatan)}.</p>`
      : keadaanKosong({
        judul: `Roster ${prodi.toUpperCase()} angkatan ${angkatan} masih kosong`,
        keterangan: 'Anggota proyek dipilih dari roster mahasiswa. Daftarkan mahasiswanya lebih dulu, atau simpan proyek tanpa anggota.',
        siapa: 'dosen yang mengelola roster prodi ini',
        aksi: { href: 'akademik.html', label: 'Buka Roster Mahasiswa' },
      });
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">Roster tidak bisa dimuat: ${esc(err.message)}</div>`;
  }
}

function tabelProyek(daftar) {
  if (!daftar.length) {
    return `<div class="kartu"><h3>Proyek yang Anda Bimbing</h3>${keadaanKosong({
      judul: 'Belum ada proyek blok yang Anda bimbing',
      keterangan: 'Proyek yang Anda buat lewat formulir di atas muncul di sini, lengkap dengan tombol untuk menginput nilai.',
    })}</div><div id="detail"></div>`;
  }
  return `<div class="kartu"><h3>Proyek yang Anda Bimbing</h3><div class="gulir"><table>
      <thead><tr><th>Judul</th><th>Rumpun</th><th>Angkatan</th><th>Status</th><th class="num">Anggota</th><th></th></tr></thead><tbody>
      ${daftar.map(p => `<tr>
        <td>${esc(p.judul)}</td><td>${esc(p.rumpun_kode)}</td><td>${esc(p.angkatan)}</td>
        <td>${esc(p.status)}</td><td class="num">${(p.anggota || []).length}</td>
        <td><button class="sekunder buka-detail" data-id="${esc(p.id)}">Buka</button></td></tr>`).join('')}
    </tbody></table></div></div>
    <div id="detail"></div>`;
}

async function tampilDetail(id) {
  const detail = document.getElementById('detail');
  detail.innerHTML = '<p class="redup">Memuat detail proyek…</p>';
  try {
    const { proyek, nilai = [], rekap = [] } = await apiGet(`/api/proyekblok/${encodeURIComponent(id)}`, { auth: true });
    const rumpun = (await rumpunProdi(proyek.prodi_kode)).find(r => r.kode === proyek.rumpun_kode);
    const mk = (rumpun && rumpun.mata_kuliah) || [];
    const anggota = proyek.anggota || [];
    detail.innerHTML = `
      <div class="kartu" id="kartu-detail">
        <h3>${esc(proyek.judul)}</h3>
        <p class="meta">Rumpun ${esc(proyek.rumpun_kode)}${rumpun ? ` — ${esc(rumpun.nama)}` : ''} · prodi ${esc(proyek.prodi_kode)} · angkatan ${esc(proyek.angkatan)} · ${esc(proyek.status)}</p>
        <h4>Nilai per mahasiswa</h4>
        ${rekap.length ? `<div class="gulir"><table>
            <thead><tr><th>NIM</th><th>Mata kuliah dinilai</th><th class="num">Rata-rata</th></tr></thead>
            ${rekap.map(r => `<tr><td>${esc(r.nim)}</td>
              <td>${Object.keys(r.per_mata_kuliah || {}).map(esc).join(', ') || '–'}</td>
              <td class="num">${angka(r.rata_rata)}</td></tr>`).join('')}
          </table></div>` : '<p class="redup">Belum ada nilai yang diinput.</p>'}
        <h4>Input Nilai</h4>
        ${anggota.length && mk.length ? `
        <form id="form-nilai" data-id="${esc(proyek.id)}">
          <label>Mahasiswa <select name="nim" required>
            ${anggota.map(a => `<option value="${esc(a.nim)}">${esc(a.nim)} — ${esc(a.nama)}</option>`).join('')}
          </select></label>
          <label>Mata kuliah <select name="kode_mk" required>
            ${mk.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
          </select></label>
          <label>Hasil proyek (40%) <input type="number" name="hasil_proyek" min="0" max="100" step="0.1" required></label>
          <label>Ujian (30%) <input type="number" name="ujian" min="0" max="100" step="0.1" required></label>
          <label>Kuis (15%) <input type="number" name="kuis" min="0" max="100" step="0.1" required></label>
          <label>Presentasi (15%) <input type="number" name="presentasi" min="0" max="100" step="0.1" required></label>
          <label>Catatan <input name="catatan" maxlength="500"></label>
          <button>Simpan Nilai</button>
        </form>
        <div id="hasil-nilai"></div>`
        : `<p class="redup">${anggota.length ? 'Data rumpun/mata kuliah tidak ditemukan untuk proyek ini.' : 'Proyek ini belum punya anggota, jadi belum ada yang bisa dinilai.'}</p>`}
        <h4>Seluruh baris nilai</h4>
        ${nilai.length ? `<div class="gulir"><table>
            <thead><tr><th>NIM</th><th>Mata kuliah</th><th class="num">Akhir</th><th>Dinilai oleh</th></tr></thead>
            ${nilai.map(n => `<tr><td>${esc(n.nim)}</td><td>${esc(n.kode_mk)}</td>
              <td class="num">${angka(n.nilai_akhir)}</td><td>${esc(n.dinilai_oleh)}</td></tr>`).join('')}
          </table></div>` : '<p class="redup">Belum ada.</p>'}
      </div>`;

    const formNilai = document.getElementById('form-nilai');
    if (formNilai) formNilai.addEventListener('submit', simpanNilai);
    document.getElementById('kartu-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    detail.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function simpanNilai(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-nilai');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const n = await apiPostJson(`/api/proyekblok/${encodeURIComponent(e.target.dataset.id)}/nilai`, {
      nim: fd.get('nim'), kode_mk: fd.get('kode_mk'), catatan: fd.get('catatan') || '',
      komponen: {
        hasil_proyek: Number(fd.get('hasil_proyek')), ujian: Number(fd.get('ujian')),
        kuis: Number(fd.get('kuis')), presentasi: Number(fd.get('presentasi')),
      },
    });
    hasil.innerHTML = `<div class="pesan sukses">Nilai ${esc(n.nim)} — ${esc(n.kode_mk)} tersimpan. Nilai akhir <b>${angka(n.nilai_akhir)}</b>.</div>`;
    tampilDetail(e.target.dataset.id);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan nilai: ${esc(err.message)}</div>`;
  }
}

async function buatProyek(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-buat');
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const p = await apiPostJson('/api/proyekblok', {
      rumpun_kode: fd.get('rumpun_kode'), prodi_kode: fd.get('prodi_kode'),
      angkatan: fd.get('angkatan'), judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '',
      dosen_email: saya.email, status: fd.get('status'),
      anggota: fd.getAll('anggota').map(nim => roster.find(m => m.nim === nim)).filter(Boolean)
        .map(m => ({ nim: m.nim, nama: m.nama, phonenumber: m.phonenumber || '' })),
    });
    await muat(true);
    document.getElementById('hasil-buat').innerHTML = `<div class="pesan sukses">Proyek <b>${esc(p.judul)}</b> dibuat.</div>`;
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal membuat proyek: ${esc(err.message)}</div>`;
  }
}

async function isiRumpun() {
  const prodi = document.getElementById('pilih-prodi').value;
  const pilihRumpun = document.getElementById('pilih-rumpun');
  pilihRumpun.innerHTML = '<option>memuat…</option>';
  const daftar = await rumpunProdi(prodi);
  pilihRumpun.innerHTML = daftar.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')
    || '<option value="">(rumpun prodi ini belum diisi kaprodi di halaman Kurikulum)</option>';
}

// segarkan: ambil ulang daftar proyek setelah menyimpan (data awal dari akun.js).
async function muat(segarkan = false) {
  if (segarkan) saya = await apiGet('/api/proyekblok/saya', { auth: true });
  const prasyarat = kartuPrasyarat(saya, { judul: 'Kelola Proyek Blok', untuk: 'Membuat dan menilai proyek blok' });
  if (prasyarat) {
    isi.innerHTML = prasyarat;
    return;
  }
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  isi.innerHTML = (prodi.length ? formBuat(prodi) : keadaanKosong({
    judul: 'Data program studi belum ada',
    keterangan: 'Proyek blok disusun per prodi dan rumpun, jadi data kurikulum harus ada lebih dulu.',
    siapa: 'admin (membuat prodi) dan kaprodi (mengisi kurikulum)',
    aksi: { href: 'kurikulum.html', label: 'Buka Kurikulum' },
  })) + tabelProyek(saya.proyekblok || []);

  if (prodi.length) {
    document.getElementById('form-buat').addEventListener('submit', buatProyek);
    const pilihProdi = document.getElementById('pilih-prodi');
    pilihProdiBawaan(pilihProdi, saya);
    pilihProdi.addEventListener('change', () => { isiRumpun(); muatRoster(); });
    document.getElementById('isi-angkatan').addEventListener('change', muatRoster);
    await isiRumpun();
  }
  const tabel = isi.querySelector('.kartu table');
  if (tabel && tabel.querySelector('.buka-detail')) labelTabel(tabel);
  isi.querySelectorAll('.buka-detail').forEach(b =>
    b.addEventListener('click', () => tampilDetail(b.dataset.id)));
}

async function mulai() {
  const s = await sayaHalaman(isi);
  if (s === undefined) return;
  if (!halamanMengajar(s, isi, {
    judul: 'Kelola Proyek Blok',
    pesan: 'Membuat dan menilai proyek blok dikerjakan dosen pembimbing di peran dosen atau kaprodi.',
    untukMahasiswa: { href: 'nilai.html', label: 'Lihat Nilai Saya', pesan: 'Nilai proyek yang Anda ikuti ada di halaman Nilai Proyek Saya.' },
  })) return;
  saya = s;
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
