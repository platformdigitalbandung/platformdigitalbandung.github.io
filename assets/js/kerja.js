import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong, istilah } from './ui.js';

// Proyek Kerja/Magang. Peran datang dari backend (GET /api/proyekkerja/saya),
// bukan ditebak di browser. NIM dan prodi tidak pernah dikirim dari sini:
// keduanya diambil server dari data akademik lewat nomor WhatsApp pada token.

const isi = document.getElementById('isi');
function angka(n) { return typeof n === 'number' ? n.toFixed(2) : '–'; }

const LABEL_JENIS = { 'tengah-semester': 'tengah semester', 'akhir': 'akhir' };
const LENCANA = {
  diajukan: 'sedang', disetujui: 'rendah', berjalan: 'rendah',
  'tinjauan-tengah': 'rendah', selesai: 'rendah', ditolak: 'tinggi',
};

let saya = null;

function lencana(status) {
  return `<span class="lencana ${LENCANA[status] || 'sedang'}">${esc(status)}</span>`;
}

// Rentang semester proyek kerja satu prodi — cermin proyekkerja.BatasSemester
// di backend: bawaan 4–8, `semester_proyek_kerja_min` dan `semester` prodi
// menimpanya. Backend tetap penentu; ini supaya mahasiswa yang belum waktunya
// diberi tahu sebelum mengisi form, bukan ditolak saat mengirim.
function batasSemester(prodi) {
  let min = 4;
  let max = 8;
  if (prodi && prodi.semester_proyek_kerja_min > 0) min = prodi.semester_proyek_kerja_min;
  if (prodi && prodi.semester > 0) max = prodi.semester;
  if (min > max) min = max;
  return { min, max };
}

// Data untuk form pengajuan mahasiswa: rumpun prodinya sendiri (backend
// menolak rumpun prodi lain), rentang semester prodinya, dan semester
// berjalan dari roster (lewat rapor miliknya sendiri).
async function dataPengajuan(identitas) {
  const kode = identitas.prodi_kode;
  const [{ prodi = [] }, { rumpun = [] }, rapor] = await Promise.all([
    apiGet('/api/kurikulum/prodi'),
    apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`),
    apiGet(`/api/rapor/${encodeURIComponent(identitas.nim)}`).catch(() => null),
  ]);
  const dataProdi = prodi.find(p => p.kode === kode) || null;
  return {
    rumpun, prodi: dataProdi, ...batasSemester(dataProdi),
    semester: rapor && Number(rapor.semester_berjalan) > 0 ? Number(rapor.semester_berjalan) : 0,
  };
}

function formAjukan(d) {
  const PRODI = String((d.prodi && d.prodi.kode) || '').toUpperCase();
  return `
    <div class="kartu">
      <h3>Ajukan ${istilah('proyek kerja', 'Proyek Kerja')}</h3>
      <p class="meta">Proyek kerja ${esc(PRODI)} untuk semester ${d.min}–${d.max}${d.semester ? `; Anda sekarang semester ${d.semester}` : ''}. Pengajuan ditinjau dosen pembimbing dahulu. NIM dan program studi diambil dari data akademik Anda, tidak perlu diisi di sini.</p>
      <form id="form-ajukan">
        <label>Rumpun yang dikonversi
          <select name="rumpun_kode" required>
            <option value="">— pilih rumpun ${esc(PRODI)} —</option>
            ${d.rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')}
          </select></label>
        <label>Semester (kosongkan untuk ikut data akademik) <input type="number" name="semester" min="${d.min}" max="${d.max}"${d.semester ? ` placeholder="${d.semester}"` : ''}></label>
        <label>Nama perusahaan <input name="nama_perusahaan" required maxlength="120"></label>
        <label>Judul pekerjaan <input name="judul_pekerjaan" required maxlength="200"></label>
        <label>Deskripsi <textarea name="deskripsi" rows="3"></textarea></label>
        <label>Nama atasan <input name="atasan_nama" required maxlength="120"></label>
        <label>Surel atasan <input type="email" name="atasan_email" required></label>
        <label>Nomor WhatsApp atasan (opsional) <input name="atasan_phonenumber" maxlength="20" placeholder="6281234567890"></label>
        <button>Ajukan</button>
      </form>
      <div id="hasil-ajukan"></div>
    </div>`;
}

// Kartu pengganti form bila semester roster di luar rentang prodi.
function kartuBelumWaktunya(d) {
  const PRODI = String((d.prodi && d.prodi.kode) || '').toUpperCase();
  const awal = d.semester < d.min;
  return `<div class="kartu"><h3>Ajukan ${istilah('proyek kerja', 'Proyek Kerja')}</h3>${keadaanKosong({
    judul: awal ? `Pengajuan dibuka mulai semester ${d.min}` : `Masa pengajuan proyek kerja ${PRODI} sudah lewat`,
    keterangan: awal
      ? `Proyek kerja untuk ${PRODI} mulai semester ${d.min}. Menurut data akademik, Anda sekarang semester ${d.semester}, jadi form pengajuan belum ditampilkan. Kalau semester di data akademik keliru, minta pengelola prodi memperbaikinya.`
      : `Proyek kerja untuk ${PRODI} berlaku semester ${d.min}–${d.max}, sedangkan menurut data akademik Anda semester ${d.semester}. Kalau data itu keliru, minta pengelola prodi memperbaikinya.`,
    siapa: awal ? '' : 'pengelola program studi',
    aksi: { href: './', label: 'Kembali ke Beranda' },
  })}</div>`;
}

function kartuProyek(p) {
  const dosen = saya.peran === 'dosen';
  const aksiDosen = dosen ? `
    ${p.status === 'diajukan' ? `
      <h4>Putusan</h4>
      <form class="form-putusan" data-id="${esc(p.id)}">
        <label>Catatan (wajib kalau menolak) <input name="catatan" maxlength="500"></label>
        <button name="setuju" value="ya">Setujui</button>
        <button class="sekunder" name="setuju" value="tidak">Tolak</button>
      </form>` : ''}
    ${['disetujui', 'berjalan', 'tinjauan-tengah'].includes(p.status) ? `
      <h4>Tinjauan Dosen</h4>
      <form class="form-tinjauan" data-id="${esc(p.id)}">
        <label>Jenis <select name="jenis">
          <option value="tengah-semester">tengah semester</option>
          <option value="akhir">akhir</option>
        </select></label>
        <label>Skor (0–100) <input type="number" name="skor" min="0" max="100" step="0.1" required></label>
        <label>Catatan <input name="catatan" maxlength="500"></label>
        <button>Simpan Tinjauan</button>
      </form>
      <h4>Tautan Tinjauan Atasan</h4>
      <p class="redup">Terbitkan tautan lalu teruskan sendiri ke atasan — berlaku 14 hari.</p>
      <button class="sekunder tautan" data-id="${esc(p.id)}">Terbitkan Tautan</button>
      <div class="hasil-tautan" data-id="${esc(p.id)}"></div>` : ''}` : '';

  return `
    <div class="kartu">
      <h3>${esc(p.judul_pekerjaan)} ${lencana(p.status)}</h3>
      <p class="meta">${esc(p.nama_perusahaan)} · rumpun ${esc(p.rumpun_kode)} · semester ${p.semester}${dosen ? ` · NIM ${esc(p.nim)}` : ''}</p>
      ${p.catatan ? `<p class="redup">Catatan dosen: ${esc(p.catatan)}</p>` : ''}
      <div class="detail-proyek" data-id="${esc(p.id)}"><p class="redup">Memuat tinjauan…</p></div>
      ${aksiDosen}
    </div>`;
}

async function muatDetail(id) {
  const kotak = document.querySelector(`.detail-proyek[data-id="${id}"]`);
  if (!kotak) return;
  try {
    const { tinjauan = [], nilai_akhir } = await apiGet(`/api/proyekkerja/${encodeURIComponent(id)}`, { auth: true });
    kotak.innerHTML = tinjauan.length
      ? `<div class="gulir"><table>
          <tr><th>Tinjauan</th><th>Penilai</th><th class="num">Skor</th><th>Catatan</th></tr>
          ${tinjauan.map(t => `<tr>
            <td>${esc(LABEL_JENIS[t.jenis] || t.jenis)}</td>
            <td>${esc(t.penilai_peran)}${t.penilai_nama ? ` — ${esc(t.penilai_nama)}` : ''}</td>
            <td class="num">${angka(t.skor)}</td><td>${esc(t.catatan || '')}</td></tr>`).join('')}
        </table></div>
        <p class="meta">Nilai akhir: ${nilai_akhir !== undefined ? `<b>${angka(nilai_akhir)}</b>` : 'menunggu tinjauan akhir dari dosen dan atasan'}</p>`
      : '<p class="redup">Belum ada tinjauan.</p>';
  } catch (err) {
    kotak.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function ajukan(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-ajukan');
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const p = await apiPostJson('/api/proyekkerja', {
      rumpun_kode: fd.get('rumpun_kode'),
      semester: Number(fd.get('semester')) || 0,
      nama_perusahaan: fd.get('nama_perusahaan'),
      judul_pekerjaan: fd.get('judul_pekerjaan'),
      deskripsi: fd.get('deskripsi') || '',
      atasan_nama: fd.get('atasan_nama'),
      atasan_email: fd.get('atasan_email'),
      atasan_phonenumber: fd.get('atasan_phonenumber') || '',
    });
    hasil.innerHTML = `<div class="pesan sukses">Pengajuan tersimpan untuk NIM ${esc(p.nim)} (${esc(p.prodi_kode)}), menunggu putusan dosen.</div>`;
    await muat();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal mengajukan: ${esc(err.message)}</div>`;
  }
}

async function putusan(e) {
  e.preventDefault();
  const setuju = e.submitter && e.submitter.value === 'ya';
  const fd = new FormData(e.target);
  try {
    await apiPostJson(`/api/proyekkerja/${encodeURIComponent(e.target.dataset.id)}/putusan`,
      { setuju, catatan: fd.get('catatan') || '' });
    await muat();
  } catch (err) {
    e.target.insertAdjacentHTML('afterend', `<div class="pesan gagal">${esc(err.message)}</div>`);
  }
}

async function tinjau(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await apiPostJson(`/api/proyekkerja/${encodeURIComponent(e.target.dataset.id)}/tinjauan`, {
      jenis: fd.get('jenis'), skor: Number(fd.get('skor')), catatan: fd.get('catatan') || '',
    });
    await muat();
  } catch (err) {
    e.target.insertAdjacentHTML('afterend', `<div class="pesan gagal">${esc(err.message)}</div>`);
  }
}

async function terbitkanTautan(id) {
  const kotak = document.querySelector(`.hasil-tautan[data-id="${id}"]`);
  kotak.innerHTML = '<p class="redup">Menerbitkan…</p>';
  try {
    const t = await apiPostJson(`/api/proyekkerja/${encodeURIComponent(id)}/tautan-tinjauan`, {});
    kotak.innerHTML = `<div class="pesan sukses">Tautan untuk ${esc(t.atasan_nama)} (berlaku sampai ${esc((t.kedaluwarsa || '').slice(0, 10))}):<br>
      <input value="${esc(t.url)}" readonly></div>`;
  } catch (err) {
    kotak.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function muat() {
  saya = await apiGet('/api/proyekkerja/saya', { auth: true });
  const daftar = saya.proyekkerja || [];
  const judul = saya.peran === 'dosen' ? 'Proyek kerja yang Anda bimbing' : 'Proyek kerja Anda';

  // Dosen yang belum mengisi email kampus tetap sampai ke sini (email kosong) —
  // putusan dan tinjauannya akan ditolak backend, jadi diberi tahu di awal.
  // Nomor di luar roster mahasiswa dijawab 404 dan ditangani penangkap galat di
  // bawah, yang menampilkan pesan backend apa adanya.
  let atas = '';
  if (saya.peran === 'dosen' && !saya.email) {
    atas += '<div class="pesan gagal">Nomor ini terdaftar sebagai dosen, tetapi email kampusnya belum diisi. Putusan pengajuan dan tinjauan proyek kerja baru bisa dilakukan setelah email kampus terisi — <a href="akademik.html">isi email kampus Anda di halaman Roster &amp; Email Dosen</a>.</div>';
  }
  if (saya.peran !== 'dosen') {
    const identitas = await sayaSekarang;
    if (!identitas || !identitas.nim || !identitas.prodi_kode) {
      atas += keadaanKosong({
        judul: 'Data akademik Anda belum lengkap',
        keterangan: 'Pengajuan proyek kerja memakai NIM dan program studi dari roster. Setelah pengelola prodi melengkapinya, form pengajuan tampil di sini.',
        siapa: 'pengelola program studi',
        aksi: { href: './', label: 'Kembali ke Beranda' },
      });
    } else {
      try {
        const d = await dataPengajuan(identitas);
        atas += d.semester && (d.semester < d.min || d.semester > d.max) ? kartuBelumWaktunya(d) : formAjukan(d);
      } catch (err) {
        atas += `<div class="pesan gagal">Data rumpun tidak bisa dimuat: ${esc(err.message)}</div>`;
      }
    }
  }

  isi.innerHTML = atas + `<h3>${esc(judul)}</h3>` +
    (daftar.length ? daftar.map(kartuProyek).join('')
      : `<div class="kosong">${saya.peran === 'dosen'
        ? 'Belum ada proyek kerja yang Anda bimbing. Pengajuan mahasiswa muncul di sini untuk diputuskan.'
        : 'Belum ada proyek kerja yang Anda ajukan. Pengajuan dan tinjauannya tampil di sini setelah dikirim.'}</div>`);

  const formA = document.getElementById('form-ajukan');
  if (formA) formA.addEventListener('submit', ajukan);
  isi.querySelectorAll('.form-putusan').forEach(f => f.addEventListener('submit', putusan));
  isi.querySelectorAll('.form-tinjauan').forEach(f => f.addEventListener('submit', tinjau));
  isi.querySelectorAll('.tautan').forEach(b => b.addEventListener('click', () => terbitkanTautan(b.dataset.id)));
  daftar.forEach(p => muatDetail(p.id));
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
