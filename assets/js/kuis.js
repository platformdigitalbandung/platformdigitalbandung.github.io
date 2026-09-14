import { apiGet, apiPostJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, peranAktif } from './akun.js';
import { esc, keadaanKosong, istilah, halamanUntuk, pilihProdiBawaan, labelTabel } from './ui.js';
import { pekanMahasiswa, isiDatalistNIM } from './hal-mahasiswa.js';

// Kuis Gerbang. Mahasiswa mengerjakan kuis rumpun/minggu prodinya; NIM dan
// prodinya diambil server dari roster lewat token, bukan dikirim dari sini.
// Kunci jawaban tidak pernah sampai ke peramban mahasiswa — backend
// membuangnya sebelum membalas.
//
// Dosen menyusun kuis (satu per prodi + rumpun + minggu) untuk prodi tempat ia
// mengajar — kaprodi untuk prodinya; admin tidak punya hak lintas prodi — dan melihat status
// kuis mahasiswa lewat isian NIM. Jalur dosen memang memuat kunci jawaban.

const isi = document.getElementById('isi');
function satuDesimal(n) { return typeof n === 'number' ? n.toFixed(1) : '–'; }

let kuisAktif = null;

// Mahasiswa hanya ditawari rumpun prodinya: kuis berkunci prodi, dan backend
// memakai prodi dari roster.
async function rumpunProdi(kode) {
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/rumpun`);
  return (rumpun || []).map(r => ({ kode: r.kode, nama: r.nama, prodi: kode }));
}

function lencanaLulus(lulus) {
  return lulus ? '<span class="lencana rendah">lulus</span>' : '<span class="lencana tinggi">belum lulus</span>';
}

let prodiMahasiswa = '';

// Rumpun terpilih otomatis bila kalender menyebut tepat satu rumpun minggu itu;
// selain itu mahasiswa memilih sendiri — API tidak dipanggil selama rumpun kosong.
function kartuPilih(rumpun, pekan) {
  const terpilih = pekan.rumpun.length === 1 ? pekan.rumpun[0] : '';
  const judul = pekan.minggu
    ? `Kuis Minggu ${pekan.minggu}${pekan.rentang ? ` · ${esc(pekan.rentang)}` : ''}`
    : 'Pilih Kuis';
  const petunjuk = pekan.minggu
    ? (terpilih ? `Kuis ${istilah('rumpun')} yang dijadwalkan minggu ini.`
      : `Minggu ${pekan.minggu} sedang berjalan. Pilih ${istilah('rumpun')} yang kuisnya ingin dikerjakan${pekan.rumpun.length ? ` (minggu ini: ${pekan.rumpun.map(esc).join(', ')})` : ''}.`)
    : `Hari ini di luar jadwal kalender semester Anda (perkuliahan belum mulai atau sudah selesai). Pilih ${istilah('rumpun')} dan minggu.`;
  return `
    <div class="kartu">
      <h3>${judul}</h3>
      <div class="meta petunjuk">${petunjuk}</div>
      <form id="form-pilih">
        <label>Rumpun
          <select name="rumpun" required>
            ${terpilih ? '' : '<option value="">— pilih rumpun —</option>'}
            ${rumpun.map(r => `<option value="${esc(r.kode)}"${r.kode === terpilih ? ' selected' : ''}>${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')}
          </select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(pekan.minggu || 1)}"></label>
        <button>Muat Kuis</button>
      </form>
      <div id="kuis"></div>
    </div>`;
}

async function muatKuis(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('form-pilih');
  const fd = new FormData(form);
  const rumpun = String(fd.get('rumpun') || '');
  const minggu = Number(fd.get('minggu'));
  const wadah = document.getElementById('kuis');
  if (!rumpun || !(minggu >= 1)) {
    wadah.innerHTML = '<div class="pesan info">Pilih rumpun dan isi minggu (mulai dari 1), lalu tekan Muat Kuis.</div>';
    return;
  }
  wadah.innerHTML = '<p class="redup">Memuat kuis…</p>';
  try {
    kuisAktif = await apiGet(`/api/kuisgerbang/${encodeURIComponent(rumpun)}/${encodeURIComponent(minggu)}`, { auth: true });
    const soal = kuisAktif.soal || [];
    if (!soal.length) {
      wadah.innerHTML = keadaanKosong({
        judul: 'Kuis ini belum punya soal',
        keterangan: 'Dosen pengampu masih menyusunnya. Kerjakan setelah soalnya tersedia.',
        siapa: `dosen pengampu ${prodiMahasiswa.toUpperCase()}`,
        aksi: { href: 'materi.html', label: 'Pelajari materinya dulu' },
      });
      return;
    }
    wadah.innerHTML = `
      <p class="meta">${soal.length} soal · ambang lulus ${satuDesimal(kuisAktif.ambang_lulus || 60)}%</p>
      <form id="form-jawab">
        ${soal.map((s, i) => `
          <fieldset class="soal-jawab">
            <legend>${i + 1}. ${esc(s.pertanyaan)}</legend>
            ${(s.pilihan || []).map((p, j) => `
              <label><input type="radio" name="s${i}" value="${j}" required> ${esc(p)}</label>`).join('')}
          </fieldset>`).join('')}
        <button>Kirim Jawaban</button>
      </form>
      <div id="hasil-jawab"></div>`;
    document.getElementById('form-jawab').addEventListener('submit', kirimJawaban);
  } catch (err) {
    // 404 = belum ada kuis untuk rumpun/minggu itu: keadaan wajar, bukan rusak.
    wadah.innerHTML = err.status === 404
      ? keadaanKosong({
        judul: `Belum ada kuis rumpun ${rumpun} minggu ${minggu}`,
        keterangan: 'Dosen pengampu belum menyusun kuis gerbangnya. Kuis muncul di sini begitu disimpan dosen.',
        siapa: `dosen pengampu ${prodiMahasiswa.toUpperCase()}`,
        aksi: [{ href: 'materi.html', label: 'Buka materi minggu ini' }, { href: 'forum.html', label: 'Tanya di forum' }],
      })
      : `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function kirimJawaban(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const soal = kuisAktif.soal || [];
  const jawaban = soal.map((_, i) => Number(fd.get(`s${i}`)));
  const hasil = document.getElementById('hasil-jawab');
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const r = await apiPostJson(`/api/kuisgerbang/${encodeURIComponent(kuisAktif.id)}/submit`, { jawaban_idx: jawaban });
    hasil.innerHTML = `<div class="pesan ${r.lulus ? 'sukses' : 'gagal'}">Skor <b>${satuDesimal(r.skor)}%</b> — ${lencanaLulus(r.lulus)}.
      ${r.lulus ? '' : ' Pelajari lagi materinya lalu kerjakan ulang; hasil terbaru akan menimpa yang ini.'}</div>`;
    muatRiwayat(r.nim);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Jawaban gagal dikirim: ${esc(err.message)}</div>`;
  }
}

async function muatRiwayat(nim) {
  const wadah = document.getElementById('riwayat');
  if (!wadah || !nim) return;
  wadah.innerHTML = '<p class="redup">Memuat riwayat…</p>';
  try {
    const { jawaban = [] } = await apiGet(`/api/mahasiswa/${encodeURIComponent(nim)}/kuisgerbang/status`, { auth: true });
    wadah.innerHTML = jawaban.length ? `<div class="gulir"><table>
        <tr><th>Kuis</th><th class="num">Skor</th><th>Status</th></tr>
        ${jawaban.map(j => `<tr><td>#${esc(String(j.kuis_id).slice(-6))}</td>
          <td class="num">${satuDesimal(j.skor)}%</td><td>${lencanaLulus(j.lulus)}</td></tr>`).join('')}
      </table></div>
      <p class="redup">Satu baris per kuis — percobaan terakhir menimpa yang sebelumnya.</p>`
      : '<div class="kosong">Belum ada kuis yang dikerjakan. Hasil kuis yang Anda kirim tercatat di sini.</div>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function kartuDosen(nimAwal) {
  return `
    <div class="kartu">
      <h3>Status Kuis Mahasiswa</h3>
      <p class="meta">Cek apakah seorang mahasiswa sudah lulus kuis gerbang sebelum sesi Jumat. Ketik NIM atau nama untuk memilih dari roster.</p>
      <form id="form-nim">
        <label>NIM <input name="nim" required maxlength="30" list="daftar-nim" autocomplete="off" placeholder="Ketik NIM atau nama" value="${esc(nimAwal || '')}"></label>
        <datalist id="daftar-nim"></datalist>
        <button>Tampilkan</button>
      </form>
      <div id="riwayat"></div>
    </div>`;
}

// ===== Penyusun kuis (dosen) =====

let daftarProdi = [];
const cacheRumpun = {};
let daftarKuis = [];
let mingguDosen = 0; // minggu berjalan kalender prodi mengajar (0 = tidak diketahui)
let sayaDosen = null;

async function rumpunDari(prodi) {
  if (!prodi) return [];
  if (!cacheRumpun[prodi]) cacheRumpun[prodi] = await rumpunProdi(prodi);
  return cacheRumpun[prodi];
}

function opsiProdi(terpilih, denganSemua) {
  return (denganSemua ? '<option value="">(semua prodi)</option>' : '')
    + daftarProdi.map(p => `<option value="${esc(p.kode)}"${p.kode === terpilih ? ' selected' : ''}>${esc(p.nama)} (${esc(p.kode)})</option>`).join('');
}

function opsiRumpun(rumpun, terpilih, denganSemua) {
  return (denganSemua ? '<option value="">(semua rumpun)</option>' : '')
    + rumpun.map(r => `<option value="${esc(r.kode)}"${r.kode === terpilih ? ' selected' : ''}>${esc(r.kode)} — ${esc(r.nama)}</option>`).join('');
}

function kartuKelola() {
  return `
    <div class="kartu">
      <h3>Kelola Kuis Gerbang</h3>
      <p class="meta">Satu kuis untuk satu prodi, rumpun, dan minggu. Kuis yang sudah dikerjakan mahasiswa tidak bisa disunting — skor mereka dihitung dari soal itu.</p>
      <form id="form-saring">
        <label>Program studi <select name="prodi">${opsiProdi('', true)}</select></label>
        <label>Rumpun <select name="rumpun"><option value="">(semua rumpun)</option></select></label>
      </form>
      <div id="daftar-kuis"><p class="redup">Memuat kuis…</p></div>
      <div id="hasil-hapus"></div>
    </div>
    <div class="kartu">
      <h3 id="judul-susun">Susun Kuis</h3>
      <form id="form-susun">
        <label>Program studi <select name="prodi_kode" required>${opsiProdi(daftarProdi[0] && daftarProdi[0].kode, false)}</select></label>
        <label>Rumpun <select name="rumpun_kode" required></select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(mingguDosen || 1)}"></label>
        <label>Ambang lulus (%) <input type="number" name="ambang_lulus" min="0" max="100" step="1" value="60"></label>
        <p class="redup">Isi 0 untuk memakai ambang bawaan 60%.</p>
        <div id="daftar-soal"></div>
        <p><button type="button" class="sekunder" data-aksi="tambah-soal">+ Tambah Soal</button></p>
        <button>Simpan Kuis</button>
        <button type="button" class="sekunder" data-aksi="kosongkan">Kosongkan Formulir</button>
      </form>
      <div id="hasil-susun"></div>
    </div>`;
}

let nomorSoal = 0;

function htmlPilihan(namaRadio, teks, benar) {
  return `<div class="pilihan-kuis">
    <label class="tanda-benar" title="Tandai sebagai jawaban benar"><input type="radio" name="${namaRadio}"${benar ? ' checked' : ''} aria-label="Tandai sebagai jawaban benar"></label>
    <input type="text" class="teks-pilihan" required maxlength="500" placeholder="Teks pilihan" value="${esc(teks)}">
    <button type="button" class="sekunder" data-aksi="hapus-pilihan" aria-label="Hapus pilihan">×</button>
  </div>`;
}

function htmlSoal(soal = { pertanyaan: '', pilihan: ['', '', '', ''], indeks_benar: -1 }) {
  nomorSoal += 1;
  const nama = `benar-${nomorSoal}`;
  return `<fieldset class="soal-kuis">
    <legend>Soal</legend>
    <label>Pertanyaan <textarea class="teks-pertanyaan" rows="2" required maxlength="2000">${esc(soal.pertanyaan)}</textarea></label>
    <p class="redup">Tulis pilihan jawaban, lalu tandai bulatan di depan jawaban yang benar.</p>
    <div class="daftar-pilihan">${soal.pilihan.map((p, j) => htmlPilihan(nama, p, j === soal.indeks_benar)).join('')}</div>
    <p><button type="button" class="sekunder" data-aksi="tambah-pilihan" data-radio="${nama}">+ Pilihan</button>
      <button type="button" class="sekunder" data-aksi="hapus-soal">Hapus Soal</button></p>
  </fieldset>`;
}

function nomoriSoal() {
  document.querySelectorAll('#daftar-soal .soal-kuis legend').forEach((l, i) => { l.textContent = `Soal ${i + 1}`; });
}

function tambahSoal(soal) {
  document.getElementById('daftar-soal').insertAdjacentHTML('beforeend', htmlSoal(soal));
  nomoriSoal();
}

async function isiRumpunSusun(terpilih) {
  const form = document.getElementById('form-susun');
  const rumpun = await rumpunDari(form.elements.prodi_kode.value);
  form.elements.rumpun_kode.innerHTML = opsiRumpun(rumpun, terpilih, false);
}

async function kosongkanFormulir() {
  const form = document.getElementById('form-susun');
  form.reset();
  pilihProdiBawaan(form.elements.prodi_kode, sayaDosen);
  document.getElementById('judul-susun').textContent = 'Susun Kuis';
  document.getElementById('daftar-soal').innerHTML = '';
  document.getElementById('hasil-susun').innerHTML = '';
  tambahSoal();
  await isiRumpunSusun();
}

// Membaca formulir apa adanya; kelengkapannya diperiksa backend
// (kuisgerbang.NormalkanKuis) dan pesannya ditampilkan.
function bacaFormulir(form) {
  const fd = new FormData(form);
  const soal = [...document.querySelectorAll('#daftar-soal .soal-kuis')].map(f => {
    const baris = [...f.querySelectorAll('.pilihan-kuis')];
    return {
      pertanyaan: f.querySelector('.teks-pertanyaan').value,
      pilihan: baris.map(b => b.querySelector('.teks-pilihan').value),
      indeks_benar: baris.findIndex(b => b.querySelector('input[type=radio]').checked),
    };
  });
  return {
    prodi_kode: fd.get('prodi_kode'), rumpun_kode: fd.get('rumpun_kode'),
    minggu: Number(fd.get('minggu')), ambang_lulus: Number(fd.get('ambang_lulus')) || 0, soal,
  };
}

async function simpanKuis(e) {
  e.preventDefault();
  const hasil = document.getElementById('hasil-susun');
  const data = bacaFormulir(e.target);
  const tanpaKunci = data.soal.findIndex(s => s.indeks_benar < 0);
  if (tanpaKunci >= 0) {
    hasil.innerHTML = `<div class="pesan gagal">Tandai jawaban benar untuk soal ke-${tanpaKunci + 1}.</div>`;
    return;
  }
  hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    const k = await apiPostJson('/api/kuisgerbang', data);
    await muatDaftarKuis();
    hasil.innerHTML = `<div class="pesan sukses">Kuis ${esc(k.prodi_kode.toUpperCase())} rumpun ${esc(k.rumpun_kode)} minggu ${esc(k.minggu)} tersimpan (${k.soal.length} soal).</div>`;
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function tabelKuis() {
  if (!daftarKuis.length) return '<div class="kosong">Belum ada kuis untuk saringan ini.</div>';
  return `<div class="gulir"><table>
    <thead><tr><th>Prodi</th><th>Rumpun</th><th class="num">Minggu</th><th class="num">Soal</th><th class="num">Ambang</th><th class="num">Dikerjakan</th><th></th></tr></thead>
    <tbody>${daftarKuis.map(k => `<tr>
      <td>${esc(k.prodi_kode.toUpperCase())}</td><td>${esc(k.rumpun_kode)}</td><td class="num">${esc(k.minggu)}</td>
      <td class="num">${k.soal.length}</td><td class="num">${satuDesimal(k.ambang_lulus || 60)}%</td>
      <td class="num">${esc(k.dikerjakan)}</td>
      <td>${k.dikerjakan ? '' : `<button type="button" class="sekunder" data-aksi="sunting" data-id="${esc(k.id)}">Sunting</button> `}<button type="button" class="sekunder" data-aksi="hapus" data-id="${esc(k.id)}">Hapus</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function muatDaftarKuis() {
  const fd = new FormData(document.getElementById('form-saring'));
  const q = new URLSearchParams();
  if (fd.get('prodi')) q.set('prodi', fd.get('prodi'));
  if (fd.get('rumpun')) q.set('rumpun', fd.get('rumpun'));
  const wadah = document.getElementById('daftar-kuis');
  try {
    ({ kuis: daftarKuis = [] } = await apiGet(`/api/kuisgerbang${q.toString() ? `?${q}` : ''}`));
    wadah.innerHTML = tabelKuis();
    labelTabel(wadah.querySelector('table'));
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function suntingKuis(id) {
  const k = daftarKuis.find(x => x.id === id);
  if (!k) return;
  const form = document.getElementById('form-susun');
  form.elements.prodi_kode.value = k.prodi_kode;
  await isiRumpunSusun(k.rumpun_kode);
  form.elements.minggu.value = k.minggu;
  form.elements.ambang_lulus.value = k.ambang_lulus || 0;
  document.getElementById('daftar-soal').innerHTML = '';
  k.soal.forEach(s => tambahSoal(s));
  document.getElementById('judul-susun').textContent = `Sunting Kuis ${k.prodi_kode.toUpperCase()} · ${k.rumpun_kode} · minggu ${k.minggu}`;
  document.getElementById('hasil-susun').innerHTML = '';
  form.scrollIntoView({ behavior: 'smooth' });
}

async function hapusKuis(id, konfirmasi = false) {
  const k = daftarKuis.find(x => x.id === id);
  const hasil = document.getElementById('hasil-hapus');
  if (!konfirmasi && !window.confirm(`Hapus kuis ${k ? `${k.prodi_kode.toUpperCase()} ${k.rumpun_kode} minggu ${k.minggu}` : id}?`)) return;
  hasil.innerHTML = '<p class="redup">Menghapus…</p>';
  try {
    await apiDeleteJson(`/api/kuisgerbang/${encodeURIComponent(id)}${konfirmasi ? '?konfirmasi=hapus' : ''}`);
    await muatDaftarKuis();
    hasil.innerHTML = '<div class="pesan sukses">Kuis dihapus.</div>';
  } catch (err) {
    if (err.status === 422 && !konfirmasi) {
      hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>
        <p><button type="button" class="sekunder" data-aksi="tetap-hapus" data-id="${esc(id)}">Tetap hapus</button></p>`;
      return;
    }
    hasil.innerHTML = `<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`;
  }
}

async function pasangPenyusun() {
  const saring = document.getElementById('form-saring');
  saring.elements.prodi.addEventListener('change', async () => {
    saring.elements.rumpun.innerHTML = opsiRumpun(await rumpunDari(saring.elements.prodi.value), '', true);
    muatDaftarKuis();
  });
  saring.elements.rumpun.addEventListener('change', muatDaftarKuis);

  const susun = document.getElementById('form-susun');
  susun.elements.prodi_kode.addEventListener('change', () => isiRumpunSusun());
  susun.addEventListener('submit', simpanKuis);

  isi.addEventListener('click', e => {
    const b = e.target.closest('button[data-aksi]');
    if (!b) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'tambah-soal') tambahSoal();
    else if (aksi === 'hapus-soal') { b.closest('.soal-kuis').remove(); nomoriSoal(); }
    else if (aksi === 'tambah-pilihan') {
      const daftar = b.closest('.soal-kuis').querySelector('.daftar-pilihan');
      if (daftar.children.length < 6) daftar.insertAdjacentHTML('beforeend', htmlPilihan(b.dataset.radio, '', false));
    } else if (aksi === 'hapus-pilihan') {
      const daftar = b.closest('.daftar-pilihan');
      if (daftar.children.length > 2) b.closest('.pilihan-kuis').remove();
    } else if (aksi === 'kosongkan') kosongkanFormulir();
    else if (aksi === 'sunting') suntingKuis(b.dataset.id);
    else if (aksi === 'hapus') hapusKuis(b.dataset.id);
    else if (aksi === 'tetap-hapus') hapusKuis(b.dataset.id, true);
  });

  pilihProdiBawaan(susun.elements.prodi_kode, sayaDosen);
  tambahSoal();
  await isiRumpunSusun();
  await muatDaftarKuis();
}

async function muat() {
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda sudah berakhir atau backend tidak terjangkau. Tekan Masuk lagi di pojok kanan atas.</div>';
    return;
  }
  if (saya.peran === 'dosen') {
    // Admin hanya menyiapkan: kuis disusun di peran dosen/kaprodi.
    if (peranAktif(saya) === 'admin' && !halamanUntuk(saya, ['dosen', 'kaprodi'], {
      judul: 'Kuis Gerbang',
      pesan: 'Kuis gerbang disusun dosen pengampu dan kaprodi prodinya, bukan di peran admin.',
    })) return;
    sayaDosen = saya;
    const [{ prodi = [] }, agenda] = await Promise.all([
      apiGet('/api/kurikulum/prodi'),
      apiGet('/api/beranda/agenda').catch(() => ({})),
    ]);
    mingguDosen = Number(agenda && agenda.minggu_berjalan) || 0;
    const mengajar = saya.prodi_mengajar || [];
    daftarProdi = prodi.filter(p => mengajar.includes(p.kode));
    const kelola = daftarProdi.length
      ? kartuKelola()
      : `<div class="kartu"><h3>Kelola Kuis Gerbang</h3>
          ${keadaanKosong({
            judul: 'Anda belum tercatat mengajar di prodi mana pun',
            keterangan: 'Kuis gerbang hanya bisa disusun untuk prodi tempat Anda mengajar. Kaprodi mencentang dosen pengampu di halaman Dosen Pengampu Prodi.',
            siapa: 'kaprodi prodi Anda',
            aksi: null,
          })}</div>`;
    isi.innerHTML = kelola + kartuDosen(new URLSearchParams(location.search).get('nim'));
    document.getElementById('form-nim').addEventListener('submit', e => {
      e.preventDefault();
      muatRiwayat(new FormData(e.target).get('nim').trim());
    });
    isiDatalistNIM(document.getElementById('daftar-nim'), mengajar);
    if (daftarProdi.length) await pasangPenyusun();
    return;
  }
  if (!saya.nim) {
    isi.innerHTML = keadaanKosong({
      judul: 'Nomor ini belum tercatat di roster mahasiswa',
      keterangan: 'Jawaban kuis dicatat atas nama NIM. Setelah nomor WhatsApp Anda didaftarkan di roster, kuis prodi Anda tampil di sini.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  if (!saya.prodi_kode) {
    isi.innerHTML = keadaanKosong({
      judul: 'Program studi Anda belum tercatat di roster',
      keterangan: 'Kuis gerbang disusun per program studi, jadi belum bisa ditentukan kuis mana yang untuk Anda.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  prodiMahasiswa = saya.prodi_kode;
  const PRODI = prodiMahasiswa.toUpperCase();
  const [pekan, rumpun] = await Promise.all([pekanMahasiswa(prodiMahasiswa), rumpunProdi(prodiMahasiswa)]);
  const riwayat = '<div class="kartu"><h3>Riwayat Kuis Anda</h3><div id="riwayat"></div></div>';

  if (!pekan.terbit) {
    isi.innerHTML = `<div class="kartu">${keadaanKosong({
      judul: `Kalender semester ${PRODI} belum diterbitkan`,
      keterangan: 'Kuis gerbang dibuka per minggu mengikuti kalender semester. Begitu kaprodi menerbitkan kalender Anda, kuis minggu berjalan langsung tampil di sini.',
      siapa: `kaprodi ${PRODI}`,
      aksi: [{ href: 'kalender.html', label: 'Lihat kalender' }, { href: 'forum.html', label: 'Tanya di forum' }],
    })}</div>` + riwayat;
    muatRiwayat(saya.nim);
    return;
  }

  isi.innerHTML = kartuPilih(rumpun, pekan) + riwayat;
  document.getElementById('form-pilih').addEventListener('submit', muatKuis);
  muatRiwayat(saya.nim);
  if (pekan.minggu && pekan.rumpun.length === 1) await muatKuis();
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
