import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Proyek Kerja/Magang. Peran datang dari backend (GET /api/proyekkerja/saya),
// bukan ditebak di browser. NIM dan prodi tidak pernah dikirim dari sini:
// keduanya diambil server dari data akademik lewat nomor WhatsApp pada token.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
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

async function rumpunSemuaProdi() {
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  const hasil = [];
  for (const p of prodi) {
    const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(p.kode)}/rumpun`);
    rumpun.forEach(r => hasil.push({ kode: r.kode, nama: r.nama, prodi: p.kode }));
  }
  return hasil;
}

function formAjukan(rumpun) {
  return `
    <div class="kartu">
      <h3>Ajukan Proyek Kerja</h3>
      <p class="meta">Pengajuan ditinjau dosen pembimbing dahulu. NIM dan program studi diambil dari data akademik Anda, tidak perlu diisi di sini.</p>
      <form id="form-ajukan">
        <label>Rumpun yang dikonversi
          <select name="rumpun_kode" required>
            ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)} (${esc(r.prodi)})</option>`).join('')}
          </select></label>
        <label>Semester (kosongkan untuk ikut data akademik) <input type="number" name="semester" min="4" max="8"></label>
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

  // Tidak ada cabang "dosen tanpa NIP" di sini: sejak d921dca backend menjawab
  // 422 untuk kasus itu, jadi peran dosen yang sampai ke sini pasti ber-NIP.
  // Nomor di luar roster mahasiswa dijawab 404. Keduanya ditangani penangkap
  // galat di bawah, yang menampilkan pesan backend apa adanya — pesannya sudah
  // menyebut sebab dan jalan keluarnya.
  let atas = '';
  if (saya.peran !== 'dosen') {
    try {
      atas += formAjukan(await rumpunSemuaProdi());
    } catch (err) {
      atas += `<div class="pesan gagal">Data rumpun tidak bisa dimuat: ${esc(err.message)}</div>`;
    }
  }

  isi.innerHTML = atas + `<h3>${esc(judul)}</h3>` +
    (daftar.length ? daftar.map(kartuProyek).join('') : '<div class="kosong">Belum ada proyek kerja yang tercatat.</div>');

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
