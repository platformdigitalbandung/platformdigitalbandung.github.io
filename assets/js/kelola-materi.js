import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';
import { hitungHalaman } from './pdfmateri.js';

// Kelola Materi (dosen). Kewenangan tetap dicek backend. Prodi dan rumpun dibaca
// dari data kurikulum, tidak diketik ulang. YouTube ID diurai server dari
// tautan apa pun, jadi halaman ini tidak mencoba mengurainya sendiri.
//
// Materi jenis "berkas": PDF diunggah ke repo storage GitHub privat lewat
// backend. Jumlah halamannya dihitung di sini dengan pdf.js lalu ikut dikirim,
// karena penyebut progres mahasiswa ditetapkan dosen saat mengunggah — bukan
// oleh peramban mahasiswa yang membacanya nanti.

// Batas yang sama dengan yang dijaga backend; diperiksa di sini juga supaya
// dosen tidak menunggu unggahan 30 MiB cuma untuk ditolak di ujung.
const UKURAN_MAKS = 20 * 1024 * 1024; // 20 MiB
const UKURAN_MAKS_LABEL = '20 MiB';

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

let prodi = [];
const rumpunPerProdi = new Map();
let katalog = [];

async function rumpunProdi(kode) {
  if (!kode) return [];
  if (!rumpunPerProdi.has(kode)) {
    const res = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
    rumpunPerProdi.set(kode, res.rumpun || []);
  }
  return rumpunPerProdi.get(kode);
}

function opsiProdi(terpilih) {
  return prodi.map(p => `<option value="${esc(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)}</option>`).join('');
}

async function isiPilihanRumpun(selectProdi, selectRumpun, terpilih, denganSemua) {
  const daftar = await rumpunProdi(selectProdi.value);
  selectRumpun.innerHTML = (denganSemua ? '<option value="">(semua rumpun)</option>' : '')
    + daftar.map(r => `<option value="${esc(r.kode)}"${r.kode === terpilih ? ' selected' : ''}>${esc(r.kode)} — ${esc(r.nama)}</option>`).join('');
}

function kartuSaring() {
  return `
    <div class="kartu">
      <h3>Katalog</h3>
      <form id="form-saring">
        <label>Program studi <select name="prodi" id="saring-prodi">${opsiProdi()}</select></label>
        <label>Rumpun <select name="rumpun" id="saring-rumpun"></select></label>
        <label>Minggu (0 = semua) <input type="number" name="minggu" min="0" max="52" value="0"></label>
        <button class="sekunder">Tampilkan</button>
      </form>
      <div id="daftar"></div>
    </div>`;
}

function kartuForm(m = {}) {
  const jenis = m.jenis || 'video';
  const sembunyi = (j) => (jenis === j ? '' : ' hidden');
  return `
    <div class="kartu">
      <h3>${m.id ? 'Ubah' : 'Tambah'} Materi</h3>
      <form id="form-materi" data-id="${esc(m.id || '')}">
        <label>Program studi <select name="prodi_kode" id="form-prodi" required>${opsiProdi(m.prodi_kode)}</select></label>
        <label>Rumpun <select name="rumpun_kode" id="form-rumpun" required></select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(m.minggu ?? 1)}"></label>
        <label>Urutan dalam minggu <input type="number" name="urutan" min="0" value="${esc(m.urutan ?? 0)}"></label>
        <label>Judul <input name="judul" required maxlength="200" value="${esc(m.judul || '')}"></label>
        <label>Jenis <select name="jenis" id="form-jenis">
          <option value="video"${jenis === 'video' ? ' selected' : ''}>video</option>
          <option value="bacaan"${jenis === 'bacaan' ? ' selected' : ''}>bacaan</option>
          <option value="berkas"${jenis === 'berkas' ? ' selected' : ''}>berkas (PDF)</option>
        </select></label>
        <label id="bidang-video"${sembunyi('video')}>Tautan atau ID YouTube
          <input name="youtube_id" maxlength="300" value="${esc(m.youtube_id || '')}" placeholder="https://youtu.be/…"></label>
        <label id="bidang-bacaan"${sembunyi('bacaan')}>Isi bacaan (teks lengkap; pisahkan paragraf dengan baris kosong)
          <textarea name="isi" rows="10" maxlength="100000">${esc(m.isi || '')}</textarea></label>
        <div id="bidang-berkas"${sembunyi('berkas')}>
          <label>Berkas materi — PDF saja, maksimal ${UKURAN_MAKS_LABEL}
            <input type="file" id="berkas-materi" name="berkas" accept="application/pdf"></label>
          <p class="redup">Slide PowerPoint atau dokumen Word ekspor dulu ke PDF: hanya PDF yang bisa ditampilkan per halaman di dalam platform, dan hanya halaman yang benar-benar dibuka mahasiswa yang bisa dilacak. Jumlah halamannya dihitung otomatis dari berkasnya.</p>
          ${m.nama_berkas ? `<p class="meta">Berkas sekarang: <b>${esc(m.nama_berkas)}</b>${m.halaman ? ` · ${esc(m.halaman)} halaman` : ''}. Pilih berkas baru hanya kalau ingin menggantinya.</p>` : ''}
        </div>
        <label>Deskripsi singkat <input name="deskripsi" maxlength="1000" value="${esc(m.deskripsi || '')}"></label>
        <button>${m.id ? 'Simpan Perubahan' : 'Tambah Materi'}</button>
        ${m.id ? '<button type="button" class="sekunder" id="batal-ubah">Batal</button>' : ''}
      </form>
      <div id="hasil-materi"></div>
    </div>`;
}

async function pasangForm(m = {}) {
  const wadah = document.getElementById('wadah-form');
  wadah.innerHTML = kartuForm(m);
  const selProdi = document.getElementById('form-prodi');
  const selRumpun = document.getElementById('form-rumpun');
  await isiPilihanRumpun(selProdi, selRumpun, m.rumpun_kode, false);
  selProdi.addEventListener('change', () => isiPilihanRumpun(selProdi, selRumpun, '', false));
  document.getElementById('form-jenis').addEventListener('change', e => {
    const jenis = e.target.value;
    document.getElementById('bidang-video').hidden = jenis !== 'video';
    document.getElementById('bidang-bacaan').hidden = jenis !== 'bacaan';
    document.getElementById('bidang-berkas').hidden = jenis !== 'berkas';
  });
  document.getElementById('form-materi').addEventListener('submit', simpan);
  const batal = document.getElementById('batal-ubah');
  if (batal) batal.addEventListener('click', () => pasangForm());
}

// Alasan berkasnya tidak ikut satu permintaan dengan datanya: path simpanannya
// memakai id materi, jadi materinya harus ada dulu. Simpan data -> dapat id ->
// unggah berkas ke /api/materi/<id>/berkas.
function periksaBerkas(berkas) {
  if (berkas.size > UKURAN_MAKS) {
    return `Berkas ${Math.round(berkas.size / (1024 * 1024))} MiB melebihi batas ${UKURAN_MAKS_LABEL}.`;
  }
  const namaPDF = /\.pdf$/i.test(berkas.name);
  if (berkas.type !== 'application/pdf' && !namaPDF) return 'Hanya berkas PDF yang bisa diunggah.';
  return '';
}

async function simpan(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = e.target.dataset.id;
  const jenis = fd.get('jenis');
  const hasil = document.getElementById('hasil-materi');
  const masukan = document.getElementById('berkas-materi');
  const berkas = jenis === 'berkas' && masukan && masukan.files.length ? masukan.files[0] : null;
  const punyaBerkas = Boolean(id && katalog.find(x => x.id === id && x.nama_berkas));

  if (jenis === 'berkas' && !berkas && !punyaBerkas) {
    hasil.innerHTML = '<div class="pesan gagal">Pilih berkas PDF-nya dulu — materi jenis berkas tidak bisa dibaca mahasiswa tanpa berkas.</div>';
    return;
  }
  if (berkas) {
    const galat = periksaBerkas(berkas);
    if (galat) { hasil.innerHTML = `<div class="pesan gagal">${esc(galat)}</div>`; return; }
  }

  const body = {
    prodi_kode: fd.get('prodi_kode'), rumpun_kode: fd.get('rumpun_kode'),
    minggu: Number(fd.get('minggu')), urutan: Number(fd.get('urutan')) || 0,
    judul: fd.get('judul'), jenis,
    youtube_id: fd.get('youtube_id') || '', isi: fd.get('isi') || '', deskripsi: fd.get('deskripsi') || '',
  };
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  let m;
  try {
    m = id
      ? await apiPutJson(`/api/materi/${encodeURIComponent(id)}`, body)
      : await apiPostJson('/api/materi', body);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan: ${esc(err.message)}</div>`;
    return;
  }

  if (!berkas) {
    hasil.innerHTML = `<div class="pesan sukses">Materi <b>${esc(m.judul)}</b> tersimpan (minggu ${esc(m.minggu)}, ${esc(m.jenis)}${m.youtube_id ? `, YouTube ID <code>${esc(m.youtube_id)}</code>` : ''}).</div>`;
    if (!id) e.target.reset();
    tampilDaftar();
    return;
  }

  // Materinya sudah tercatat; kalau unggahannya gagal itu harus terlihat, bukan
  // disembunyikan — materinya ada di katalog tapi belum bisa dibaca mahasiswa.
  const tertunda = `Materi <b>${esc(m.judul)}</b> tersimpan, tetapi berkasnya belum terunggah`;
  let halaman = 0;
  hasil.innerHTML = '<p class="redup">Menghitung halaman…</p>';
  try {
    halaman = await hitungHalaman(await berkas.arrayBuffer());
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">${tertunda}: berkasnya tidak bisa dibaca sebagai PDF (${esc(err.message)}). Pastikan berkasnya PDF yang utuh, lalu tekan Ubah pada materi ini dan pilih berkasnya lagi.</div>`;
    tampilDaftar();
    return;
  }
  if (!halaman) {
    hasil.innerHTML = `<div class="pesan gagal">${tertunda}: jumlah halamannya tidak terbaca. Tekan Ubah pada materi ini dan pilih berkasnya lagi.</div>`;
    tampilDaftar();
    return;
  }

  hasil.innerHTML = `<p class="redup">Mengunggah berkas (${halaman} halaman)…</p>`;
  // Catatan: postFileJSON crootjs memutus permintaan setelah 15 detik, jadi PDF
  // besar di jaringan lambat bisa gagal dengan pesan "backend tidak terjangkau".
  // Batas itu ada di lib-nya; kalau sering mengganggu, laporkan ke tim crootjs
  // supaya timeout-nya bisa diatur — jangan di-workaround di sini.
  try {
    const mb = await apiPostBerkasToken(`/api/materi/${encodeURIComponent(m.id)}/berkas`,
      { halaman: String(halaman) }, 'berkas-materi', 'berkas');
    hasil.innerHTML = `<div class="pesan sukses">Materi <b>${esc(mb.judul || m.judul)}</b> tersimpan (minggu ${esc(mb.minggu ?? m.minggu)}, berkas <code>${esc(mb.nama_berkas || berkas.name)}</code>, ${esc(mb.halaman || halaman)} halaman).</div>`;
    if (!id) e.target.reset();
    tampilDaftar();
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">${tertunda}: ${esc(err.message)}. Tekan Ubah pada materi ini dan pilih berkasnya lagi.</div>`;
    tampilDaftar();
  }
}

// Materi berkas yang unggahannya gagal tetap ada di katalog tapi tidak bisa
// dibaca mahasiswa — itu harus kelihatan di daftar, bukan cuma di pesan sesaat.
function selBerkas(m) {
  if (m.nama_berkas) {
    return `<br><span class="redup">${esc(m.nama_berkas)}${m.halaman ? ` · ${esc(m.halaman)} halaman` : ''}</span>`;
  }
  if (m.jenis === 'berkas') return '<br><span class="redup">berkas belum diunggah</span>';
  return '';
}

async function tampilDaftar(e) {
  if (e) e.preventDefault();
  const fd = new FormData(document.getElementById('form-saring'));
  const daftar = document.getElementById('daftar');
  daftar.innerHTML = '<p class="redup">Memuat…</p>';
  try {
    const q = new URLSearchParams({ prodi: fd.get('prodi') || '', rumpun: fd.get('rumpun') || '', minggu: fd.get('minggu') || '0' });
    const res = await apiGet(`/api/materi?${q}`, { auth: true });
    katalog = res.materi || [];
    daftar.innerHTML = katalog.length ? `<div class="gulir"><table>
        <tr><th class="num">Mgg</th><th class="num">Urut</th><th>Judul</th><th>Jenis</th><th>Rumpun</th><th></th></tr>
        ${katalog.map(m => `<tr>
          <td class="num">${esc(m.minggu)}</td><td class="num">${esc(m.urutan)}</td>
          <td>${esc(m.judul)}</td><td>${esc(m.jenis)}${selBerkas(m)}</td><td>${esc(m.rumpun_kode)}</td>
          <td><button class="sekunder ubah" data-id="${esc(m.id)}">Ubah</button>
              <button class="sekunder hapus" data-id="${esc(m.id)}">Hapus</button></td></tr>`).join('')}
      </table></div><div id="hasil-hapus"></div>`
      : '<div class="kosong">Belum ada materi untuk saringan ini.</div>';
    daftar.querySelectorAll('.ubah').forEach(b => b.addEventListener('click', () => {
      const m = katalog.find(x => x.id === b.dataset.id);
      if (m) { pasangForm(m); document.getElementById('wadah-form').scrollIntoView({ behavior: 'smooth' }); }
    }));
    daftar.querySelectorAll('.hapus').forEach(b => b.addEventListener('click', () => hapus(b.dataset.id)));
  } catch (err) {
    daftar.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

// Hapus tidak berantai: catatan progres mahasiswa tetap ada. Materi yang sudah
// punya progres dijawab 422 dengan jumlahnya, dan dosen harus mengonfirmasi.
async function hapus(id, konfirmasi = false) {
  const m = katalog.find(x => x.id === id);
  const hasil = document.getElementById('hasil-hapus');
  if (!konfirmasi && !window.confirm(`Hapus materi "${m ? m.judul : id}" dari katalog?`)) return;
  hasil.innerHTML = '<p class="redup">Menghapus…</p>';
  try {
    const d = await apiDeleteJson(`/api/materi/${encodeURIComponent(id)}${konfirmasi ? '?konfirmasi=hapus' : ''}`);
    hasil.innerHTML = `<div class="pesan sukses">Materi dihapus.${d.progres_tertinggal ? ` ${esc(d.progres_tertinggal)} catatan progres mahasiswa tetap ada, tapi kehilangan judul materinya.` : ''}</div>`;
    tampilDaftar();
  } catch (err) {
    if (err.status === 422 && !konfirmasi) {
      hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
        <p><button class="sekunder" id="tetap-hapus">Tetap hapus</button></p>`;
      document.getElementById('tetap-hapus').addEventListener('click', () => hapus(id, true));
      return;
    }
    hasil.innerHTML = `<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran !== 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk dosen</h3>
      <p class="meta">Materi pekan ini untuk mahasiswa ada di halaman Materi.</p>
      <a class="aksi" href="materi.html">Buka Materi</a></div>`;
    return;
  }
  const res = await apiGet('/api/kurikulum/prodi');
  prodi = res.prodi || [];
  if (!prodi.length) {
    isi.innerHTML = '<div class="pesan gagal">Data program studi kosong; jalankan seed kurikulum dahulu.</div>';
    return;
  }
  isi.innerHTML = '<div id="wadah-form"></div>' + kartuSaring();
  await pasangForm();
  const sp = document.getElementById('saring-prodi');
  const sr = document.getElementById('saring-rumpun');
  await isiPilihanRumpun(sp, sr, '', true);
  sp.addEventListener('change', () => isiPilihanRumpun(sp, sr, '', true));
  document.getElementById('form-saring').addEventListener('submit', tampilDaftar);
  await tampilDaftar();
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
