import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, apiPostBerkasToken } from './api.js';
import { hitungHalaman } from './pdfmateri.js';
import { esc, istilah, keadaanKosong, labelTabel, pilihProdiBawaan } from './ui.js';
import { sayaHalaman, halamanMengajar, kartuPrasyarat } from './hal-dosen.js';
import { periksaBerkas, UKURAN_MAKS_LABEL } from './panel-isi.js';

// Kelola Materi (dosen). Kewenangan tetap dicek backend. Prodi dan rumpun dibaca
// dari data kurikulum, tidak diketik ulang. YouTube ID diurai server dari
// tautan apa pun, jadi halaman ini tidak mencoba mengurainya sendiri.
//
// Menambah, mengubah, dan menghapus materi hanya untuk prodi tempat dosen
// mengajar (kaprodi: prodinya; admin tidak lintas prodi) — keputusan pemilik produk
// 2026-09-14. Katalog tetap bisa dilihat untuk semua prodi.
//
// Materi jenis "berkas": PDF diunggah ke repo storage GitHub privat lewat
// backend, yang menghitung jumlah halamannya dari berkas itu. Hitungan pdf.js
// di sini hanya ikut dikirim sebagai cadangan kalau server gagal mengurai PDF.

const isi = document.getElementById('isi');
// Tautan "+ Materi" dari halaman Kelas: ?prodi=&rumpun=&mk=&minggu= mengisi formulir.
const paramURL = new URLSearchParams(location.search);

let saya = null;
let prodi = [];
// Prodi yang materinya boleh diubah pemegang token: prodi mengajar (termasuk
// prodi yang dipimpin sebagai kaprodi).
let prodiKelola = [];
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

function bolehKelola(kode) { return prodiKelola.some(p => p.kode === kode); }

function opsiProdi(terpilih, daftar = prodi) {
  return daftar.map(p => `<option value="${esc(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)}</option>`).join('');
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
      <p class="catatan-istilah">${istilah('rumpun', 'Rumpun')} dan minggu menentukan letak materi. Katalog semua prodi bisa dilihat; mengubahnya hanya untuk prodi tempat Anda mengajar.</p>
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
        <label>Program studi <select name="prodi_kode" id="form-prodi" required>${opsiProdi(m.prodi_kode, prodiKelola)}</select></label>
        <label>Rumpun <select name="rumpun_kode" id="form-rumpun" required></select></label>
        <label>Mata kuliah <select name="mk_kode" id="form-mk"><option value="">(seluruh rumpun)</option></select></label>
        <p class="redup">Pilih mata kuliah hanya untuk kelas mata kuliah lepas (rumpun tanpa proyek pengikat, mis. Jalur Kontinu).</p>
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
  if (!prodiKelola.length) {
    // Rantai prasyarat: email kampus → ditunjuk kaprodi sebagai pengajar kelas.
    wadah.innerHTML = kartuPrasyarat(saya, {
      judul: 'Tambah Materi', untuk: 'Menambah dan mengubah materi', pengampu: true,
      catatan: 'Sambil menunggu, katalog di bawah tetap bisa dilihat.',
    });
    return;
  }
  wadah.innerHTML = kartuForm(m);
  const selProdi = document.getElementById('form-prodi');
  const selRumpun = document.getElementById('form-rumpun');
  const selMK = document.getElementById('form-mk');
  const isiMK = async (terpilih = '') => {
    let mks = [];
    if (selProdi.value && selRumpun.value) {
      try {
        ({ matakuliah: mks = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(selProdi.value)}/matakuliah?rumpun=${encodeURIComponent(selRumpun.value)}`));
      } catch (_) { mks = []; }
    }
    selMK.innerHTML = '<option value="">(seluruh rumpun)</option>'
      + (mks || []).map(x => `<option value="${esc(x.kode)}"${x.kode === terpilih ? ' selected' : ''}>${esc(x.nama)}</option>`).join('');
  };
  let rumpunAwal = m.rumpun_kode;
  let mkAwal = m.mk_kode || '';
  if (!m.id) {
    pilihProdiBawaan(selProdi, saya);
    const prodiQ = paramURL.get('prodi') || '';
    if (prodiQ && [...selProdi.options].some(o => o.value === prodiQ)) selProdi.value = prodiQ;
    rumpunAwal = paramURL.get('rumpun') || undefined;
    mkAwal = (paramURL.get('mk') || '').toUpperCase();
    const mingguQ = Number(paramURL.get('minggu'));
    if (mingguQ) document.querySelector('#form-materi [name="minggu"]').value = String(mingguQ);
  }
  await isiPilihanRumpun(selProdi, selRumpun, rumpunAwal, false);
  await isiMK(mkAwal);
  selProdi.addEventListener('change', async () => { await isiPilihanRumpun(selProdi, selRumpun, '', false); await isiMK(); });
  selRumpun.addEventListener('change', () => isiMK());
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
// Batas dan pemeriksaan berkasnya bersama panel materi di halaman Kelas (panel-isi.js).

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
    prodi_kode: fd.get('prodi_kode'), rumpun_kode: fd.get('rumpun_kode'), mk_kode: fd.get('mk_kode') || '',
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
    const prodiSaring = fd.get('prodi') || '';
    daftar.innerHTML = katalog.length ? `<div class="gulir"><table>
        <thead><tr><th class="num">Minggu</th><th class="num">Urutan</th><th>Judul</th><th>Jenis</th><th>Rumpun</th><th></th></tr></thead><tbody>
        ${katalog.map(m => `<tr>
          <td class="num">${esc(m.minggu)}</td><td class="num">${esc(m.urutan)}</td>
          <td>${esc(m.judul)}</td><td><div>${esc(m.jenis)}${selBerkas(m)}</div></td><td>${esc(m.rumpun_kode)}</td>
          <td>${bolehKelola(m.prodi_kode) ? `<div class="aksi-sel"><button class="sekunder ubah" data-id="${esc(m.id)}">Ubah</button>
              <button class="sekunder hapus" data-id="${esc(m.id)}">Hapus</button></div>` : '<span class="redup kecil">hanya pengajar kelas prodi ini</span>'}</td></tr>`).join('')}
      </tbody></table></div><div id="hasil-hapus"></div>`
      : keadaanKosong({
        judul: 'Belum ada materi untuk saringan ini',
        keterangan: bolehKelola(prodiSaring)
          ? 'Tambahkan materi minggu pertama lewat formulir Tambah Materi di atas.'
          : 'Materi prodi ini diisi pengajar kelasnya.',
        siapa: bolehKelola(prodiSaring) ? 'Anda, sebagai pengajar kelas prodi ini' : `pengajar kelas ${prodiSaring.toUpperCase()}`,
        aksi: bolehKelola(prodiSaring) ? { href: '#wadah-form', label: 'Ke formulir Tambah Materi' } : null,
      });
    const tabel = daftar.querySelector('table');
    if (tabel) labelTabel(tabel);
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
  const res = await apiGet('/api/kurikulum/prodi');
  prodi = res.prodi || [];
  const mengajar = saya.prodi_mengajar || [];
  prodiKelola = prodi.filter(p => mengajar.includes(p.kode));
  if (!prodi.length) {
    isi.innerHTML = keadaanKosong({
      judul: 'Data program studi belum ada',
      keterangan: 'Materi disusun per prodi dan rumpun, jadi data kurikulum harus ada lebih dulu.',
      siapa: 'admin (membuat prodi) dan kaprodi (mengisi kurikulum)',
      aksi: { href: 'kurikulum.html', label: 'Buka Kurikulum' },
    });
    return;
  }
  isi.innerHTML = '<div id="wadah-form"></div>' + kartuSaring();
  await pasangForm();
  const sp = document.getElementById('saring-prodi');
  const sr = document.getElementById('saring-rumpun');
  pilihProdiBawaan(sp, saya);
  await isiPilihanRumpun(sp, sr, '', true);
  sp.addEventListener('change', () => isiPilihanRumpun(sp, sr, '', true));
  document.getElementById('form-saring').addEventListener('submit', tampilDaftar);
  await tampilDaftar();
}

async function mulai() {
  saya = await sayaHalaman(isi);
  if (saya === undefined) return;
  if (!halamanMengajar(saya, isi, {
    judul: 'Kelola Materi',
    pesan: 'Menyusun katalog materi dikerjakan pengajar kelas dan kaprodi prodinya.',
    untukMahasiswa: { href: 'materi.html', label: 'Buka Materi', pesan: 'Materi pekan ini untuk Anda ada di halaman Materi.' },
  })) return;
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
