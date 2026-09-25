import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, adalahKaprodiAktif, peranAktif } from './akun.js';
import { esc, keadaanKosong, istilah, labelModa, opsiModa, labelTabel, prodiBawaan } from './ui.js';

// Kalender akademik. Baca untuk dosen dan mahasiswa terdaftar (hanya kalender
// yang sudah diterbitkan); belum masuk diarahkan ke /login/.
//
// Pembuatan draft, penyuntingan sesi, penerbitan, dan penghapusan hanya untuk
// kaprodi prodi kalender itu (keputusan pemilik produk 2026-09-14): tombolnya
// muncul bagi pemegang jabatan kaprodi, dan hanya pada kalender prodi yang ia
// pimpin. Kewenangannya tetap dicek server (403 untuk yang lain).
//
// Tampilan baca (audit UX 2026-09-14, U04/U05/U11): kalender disaring ke prodi
// pengguna (mahasiswa: prodi roster, dosen: prodi mengajar, kaprodi: prodi yang
// dipimpin; admin: semua) dengan pemilih prodi yang bisa diganti, sesi dilipat
// per minggu dengan minggu berjalan terbuka, dan moda ditulis dengan label
// manusiawi, bukan kode.

const isi = document.getElementById('isi');
// esc tidak meloloskan tanda kutip, jadi nilai atribut (mis. keterangan sesi
// yang memuat ") wajib lewat escAttr.
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

const HARI_TANGGAL = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
function tanggal(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : d.toLocaleDateString('id-ID', HARI_TANGGAL);
}
// Tanggal sesi = tengah malam UTC, jadi diformat dalam UTC supaya harinya tidak bergeser.
function tanggalPendek(iso, opsi = { day: 'numeric', month: 'short' }) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { ...opsi, timeZone: 'UTC' });
}
// Hari ini (WIB) sebagai YYYY-MM-DD, untuk mencari minggu berjalan.
function hariIni() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Nilai moda yang dipakai ritme mingguan kurikulum. Moda lain yang sudah
// tersimpan tetap ditampilkan apa adanya supaya menyimpan tidak mengubahnya.
const MODA = ['asinkron', 'daring_sinkron', 'opsional_luring_daring', 'bebas'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Tanggal sesi disimpan sebagai tengah malam UTC dari tanggal kalendernya,
// jadi 10 karakter pertama ISO-nya adalah tanggal yang dimaksud.
function tanggalInput(iso) { return String(iso || '').slice(0, 10); }
function hariDari(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  return isNaN(d) ? '' : HARI[d.getUTCDay()];
}

// Prodi yang kalendernya boleh disusun pengguna ini: prodi yang ia pimpin
// sebagai kaprodi. Kosong = hanya membaca.
let prodiSusun = [];
let daftarKalender = [];
function bolehSusun(k) { return prodiSusun.includes(k.prodi_kode); }

/** Sesi dikelompokkan per nomor minggu, urut minggu lalu tanggal. */
function perMinggu(sesi) {
  const grup = new Map();
  [...sesi].sort((a, b) => (a.minggu - b.minggu) || String(a.tanggal).localeCompare(String(b.tanggal)))
    .forEach(s => { if (!grup.has(s.minggu)) grup.set(s.minggu, []); grup.get(s.minggu).push(s); });
  return [...grup];
}

/**
 * Minggu yang dibuka otomatis: minggu yang memuat hari ini; sebelum semester
 * mulai, minggu pertama; di sela minggu, minggu berikutnya; sesudah semester
 * selesai, tidak ada (0). `status`: 'berjalan' | 'belum' | 'selesai'.
 */
function mingguTerbuka(kelompok) {
  const kini = hariIni();
  if (!kelompok.length) return { minggu: 0, status: 'selesai' };
  const awal = tanggalInput(kelompok[0][1][0].tanggal);
  if (kini < awal) return { minggu: kelompok[0][0], status: 'belum' };
  for (const [minggu, daftar] of kelompok) {
    const akhir = tanggalInput(daftar[daftar.length - 1].tanggal);
    if (kini <= akhir) return { minggu, status: 'berjalan' };
  }
  return { minggu: 0, status: 'selesai' };
}

function sesiBaris(s) {
  const bebas = s.moda === 'bebas';
  return `<li class="sesi${bebas ? ' sesi-bebas' : ''}">
    <span class="sesi-hari">${esc(s.hari || '')}, ${esc(tanggalPendek(s.tanggal))}</span>
    <span class="sesi-moda moda-${escAttr(s.moda)}">${esc(labelModa(s.moda))}</span>
    <span class="sesi-jam">${s.jam_mulai ? `${esc(s.jam_mulai)}–${esc(s.jam_selesai || '')} WIB` : ''}</span>
    ${s.keterangan ? `<span class="sesi-ket">${esc(s.keterangan)}</span>` : ''}
  </li>`;
}

function tabelSesi(sesi) {
  if (!sesi || !sesi.length) return '<p class="redup">Kalender ini belum punya sesi.</p>';
  const kelompok = perMinggu(sesi);
  const { minggu: buka, status } = mingguTerbuka(kelompok);
  const catatan = status === 'selesai'
    ? '<p class="redup">Semester ini sudah selesai. Buka minggu mana pun untuk melihat jadwalnya.</p>'
    : status === 'belum' ? '<p class="redup">Semester belum dimulai; minggu pertama dibuka di bawah.</p>' : '';
  return `${catatan}<div class="daftar-minggu">
    ${kelompok.map(([minggu, daftar]) => {
      const awal = daftar[0].tanggal;
      const akhir = daftar[daftar.length - 1].tanggal;
      const ini = minggu === buka && status === 'berjalan';
      return `<details class="minggu"${minggu === buka ? ' open' : ''}>
        <summary><span class="minggu-judul">Minggu ${esc(minggu)}</span>
          <span class="minggu-tanggal">${esc(tanggalPendek(awal))} – ${esc(tanggalPendek(akhir, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
          ${ini ? '<span class="lencana rendah">minggu ini</span>' : ''}</summary>
        <ul class="daftar-sesi">${daftar.map(sesiBaris).join('')}</ul>
      </details>`;
    }).join('')}
  </div>`;
}

function pilihanModa(sekarang) {
  const semua = MODA.includes(sekarang) || !sekarang ? MODA : [...MODA, sekarang];
  return opsiModa(sekarang, semua);
}

function formSunting(k) {
  // Sesi dilipat per minggu seperti tampilan baca: 16 minggu × 7 hari terlalu
  // panjang untuk satu tabel, terutama di HP. Isian di minggu yang terlipat
  // tetap ikut terkirim; validasinya di kumpulkanSesi, bukan atribut required
  // (peramban tidak bisa menunjuk isian wajib di dalam lipatan tertutup).
  const indeks = new Map(k.sesi.map((s, i) => [s, i]));
  const kelompok = perMinggu(k.sesi);
  const { minggu: buka } = mingguTerbuka(kelompok);
  const bukaMinggu = buka || (kelompok[0] && kelompok[0][0]);
  return `
    <form class="form-sesi" data-id="${escAttr(k.id)}">
      <p class="meta">Buka minggu yang ingin diubah. Mengubah tanggal ikut mengubah harinya. Jam boleh dikosongkan (mis. hari bebas), tapi mulai dan selesai harus diisi berpasangan. Semua minggu tersimpan sekaligus.</p>
      <div class="daftar-minggu">
      ${kelompok.map(([minggu, daftar]) => `<details class="minggu"${minggu === bukaMinggu ? ' open' : ''}>
        <summary><span class="minggu-judul">Minggu ${esc(minggu)}</span>
          <span class="minggu-tanggal">${esc(tanggalPendek(daftar[0].tanggal))} – ${esc(tanggalPendek(daftar[daftar.length - 1].tanggal, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></summary>
        <div class="gulir"><table class="tabel-sunting">
          <thead><tr><th>Tanggal</th><th>Hari</th><th>Moda</th><th>Mulai</th><th>Selesai</th><th>Keterangan</th></tr></thead><tbody>
          ${daftar.map(s => `<tr data-i="${indeks.get(s)}">
            <td><input type="date" name="tanggal" value="${escAttr(tanggalInput(s.tanggal))}" aria-label="Tanggal"></td>
            <td class="hari">${esc(s.hari)}</td>
            <td><select name="moda">${pilihanModa(s.moda)}</select></td>
            <td><input type="time" name="jam_mulai" value="${escAttr(s.jam_mulai || '')}"></td>
            <td><input type="time" name="jam_selesai" value="${escAttr(s.jam_selesai || '')}"></td>
            <td><input name="keterangan" value="${escAttr(s.keterangan || '')}" maxlength="300"></td></tr>`).join('')}
          </tbody></table></div>
      </details>`).join('')}
      </div>
      <div class="cta-row">
        <button>Simpan Sesi</button>
        <button type="button" class="sekunder batal-sunting" data-id="${escAttr(k.id)}">Batal</button>
      </div>
    </form>`;
}

function kartuKalender(k) {
  const status = k.diterbitkan
    ? '<span class="lencana rendah">terbit</span>'
    : '<span class="lencana sedang">draft</span>';
  const id = escAttr(k.id);
  const aksi = bolehSusun(k)
    ? `<div class="cta-row">
        ${k.diterbitkan ? '' : `
          <button class="sekunder sunting" data-id="${id}">Sunting Sesi</button>
          <button class="sekunder terbitkan" data-id="${id}">Terbitkan Kalender Ini</button>`}
        <button class="sekunder hapus" data-id="${id}">${k.diterbitkan ? 'Hapus Kalender Terbit' : 'Hapus Draft'}</button>
      </div>`
    : '';
  return `
    <div class="kartu" data-kartu="${id}">
      <h3>${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)} ${status}</h3>
      <p class="meta">${esc(namaProdi(k.prodi_kode))} · mulai ${esc(tanggal(k.tanggal_mulai))} · ${perMinggu(k.sesi || []).length} minggu, ${(k.sesi || []).length} sesi</p>
      <div class="isi-sesi">${tabelSesi(k.sesi)}</div>
      <div class="aksi-kartu">${aksi}</div>
      <div class="hasil-kartu"></div>
    </div>`;
}

function formBuat(prodi, ritme) {
  return `
    <div class="kartu">
      <h3>Buat Draft Kalender</h3>
      <div class="meta">Tanggal, moda, dan jam tiap sesi dibuat otomatis dari ${istilah('ritme mingguan')} prodi di halaman <a href="kurikulum.html#ritme">Kurikulum › 4. Ritme Mingguan</a> — pastikan ritmenya sudah benar sebelum membuat draft. Selagi masih draft, sesinya boleh disunting; setelah diterbitkan tidak bisa lagi.</div>
      ${ritme.length ? '' : '<div class="pesan gagal">Belum ada ritme mingguan, jadi draft kalender belum bisa dibuat. Isi dulu ritmenya di <a href="kurikulum.html#ritme">Kurikulum › 4. Ritme Mingguan</a>, lalu muat ulang halaman ini.</div>'}
      <form id="form-kalender">
        <label>Program studi
          <select name="prodi_kode" required>
            ${prodi.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)}</option>`).join('')}
          </select></label>
        <label>Angkatan (tahun masuk) <input name="angkatan" required maxlength="9" placeholder="2026" inputmode="numeric"></label>
        <label>Semester
          <select name="semester">${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
        <label>Tanggal mulai <input type="date" name="tanggal_mulai" required></label>
        <label>Jumlah minggu <input type="number" name="jumlah_minggu" min="1" max="24" value="16"></label>
        ${ritme.length ? `<label>Ritme mingguan
          <select name="ritme_nama">${ritme.map(r => `<option value="${escAttr(r.nama)}">${esc(r.nama)} · ${esc(r.total_menit_per_minggu)} menit/minggu</option>`).join('')}</select></label>` : ''}
        <button${ritme.length ? '' : ' disabled'}>Buat Draft</button>
      </form>
      <div id="hasil-buat"></div>
    </div>`;
}

let semuaProdi = [];
let daftarRitme = [];
let prodiPengguna = '';
let saringProdi = '';
let peran = '';

function namaProdi(kode) {
  const p = semuaProdi.find(x => x.kode === kode);
  return p ? p.nama : String(kode || '').toUpperCase();
}

function kartuSaring() {
  const opsi = semuaProdi.map(p => `<option value="${escAttr(p.kode)}"${p.kode === saringProdi ? ' selected' : ''}>${esc(p.kode.toUpperCase())} — ${esc(p.nama)}${p.kode === prodiPengguna ? ' (prodi Anda)' : ''}</option>`).join('');
  return `<div class="saring-kalender">
    <label for="saring-prodi">Tampilkan kalender</label>
    <select id="saring-prodi"><option value=""${saringProdi ? '' : ' selected'}>Semua program studi</option>${opsi}</select>
  </div>`;
}

function kosongDaftar() {
  const kode = saringProdi.toUpperCase();
  if (saringProdi && prodiSusun.includes(saringProdi)) {
    return keadaanKosong({
      judul: `Belum ada kalender ${kode}`,
      keterangan: daftarRitme.length
        ? 'Buat draft di atas, periksa sesinya per minggu, lalu terbitkan sebelum semester dimulai. Mahasiswa dan dosen baru melihatnya setelah terbit.'
        : 'Draft kalender dibuat dari ritme mingguan, dan ritmenya belum ada. Isi ritme di halaman Kurikulum dulu.',
      siapa: `Anda, kaprodi ${kode}`,
      aksi: daftarRitme.length
        ? { href: '#form-kalender', label: 'Buat draft kalender' }
        : { href: 'kurikulum.html#ritme', label: 'Isi ritme mingguan' },
    });
  }
  if (saringProdi) {
    return keadaanKosong({
      judul: `Kalender semester ${kode} belum diterbitkan`,
      keterangan: `${saringProdi === prodiPengguna && peran === 'mahasiswa' ? 'Jadwal kuliah Anda' : 'Jadwal kuliah prodi ini'} muncul di sini setelah kaprodi ${kode} menerbitkannya.`,
      siapa: `kaprodi ${kode}`,
      aksi: peran === 'mahasiswa'
        ? { href: './', label: 'Kembali ke Beranda' }
        : [{ href: 'kalender.html?prodi=semua', label: 'Lihat kalender prodi lain' }, { href: './', label: 'Kembali ke Beranda' }],
    });
  }
  return keadaanKosong({
    judul: 'Belum ada kalender yang diterbitkan',
    keterangan: 'Kalender resmi disusun dan diterbitkan kaprodi tiap program studi sebelum semester dimulai.',
    siapa: 'kaprodi program studi',
    aksi: { href: './', label: 'Kembali ke Beranda' },
  });
}

function renderDaftar() {
  const kalender = daftarKalender.filter(k => !saringProdi || k.prodi_kode === saringProdi);
  const ket = document.getElementById('keterangan-saring');
  if (ket) {
    const lingkup = saringProdi
      ? `${saringProdi.toUpperCase()}${saringProdi === prodiPengguna ? ' (prodi Anda)' : ''}`
      : 'dari semua program studi';
    ket.textContent = kalender.length
      ? `${kalender.length} kalender ${lingkup}. Minggu berjalan terbuka otomatis; ketuk minggu lain untuk melihat jadwalnya.`
      : `Belum ada kalender ${lingkup}.`;
  }
  document.getElementById('daftar').innerHTML = kalender.length ? kalender.map(kartuKalender).join('') : kosongDaftar();
}

async function muatDaftar() {
  const q = prodiSusun.length ? '?draft=1' : '';
  const { kalender: semua = [] } = await apiGet('/api/kalender' + q);
  // Draft hanya ditampilkan untuk prodi yang disusun pengguna ini.
  daftarKalender = semua.filter(k => k.diterbitkan || bolehSusun(k));
  renderDaftar();
}

function gantiSaring(kode) {
  saringProdi = kode;
  const pilih = document.getElementById('saring-prodi');
  if (pilih) pilih.value = kode;
  history.replaceState(null, '', `?prodi=${encodeURIComponent(kode || 'semua')}`);
  renderDaftar();
}

function kartuDari(id) { return document.querySelector(`[data-kartu="${CSS.escape(id)}"]`); }
function cariKalender(id) { return daftarKalender.find(k => k.id === id); }

function pesanDaftar(html) {
  document.getElementById('daftar').insertAdjacentHTML('afterbegin', html);
}

async function terbitkan(id) {
  try {
    await apiPostJson(`/api/kalender/${encodeURIComponent(id)}/terbitkan`, {});
    await muatDaftar();
  } catch (err) {
    pesanDaftar(`<div class="pesan gagal">Gagal menerbitkan: ${esc(err.message)}</div>`);
  }
}

function bukaSunting(id) {
  const k = cariKalender(id);
  const kartu = kartuDari(id);
  if (!k || !kartu) return;
  kartu.querySelector('.isi-sesi').innerHTML = formSunting(k);
  kartu.querySelectorAll('.form-sesi table').forEach(t => labelTabel(t));
  kartu.querySelector('.aksi-kartu').hidden = true;
  kartu.querySelector('.hasil-kartu').innerHTML = '';
}

function tutupSunting(id) {
  const k = cariKalender(id);
  const kartu = kartuDari(id);
  if (!k || !kartu) return;
  kartu.querySelector('.isi-sesi').innerHTML = tabelSesi(k.sesi);
  kartu.querySelector('.aksi-kartu').hidden = false;
}

// kumpulkanSesi menyusun ulang seluruh larik sesi: PUT /api/kalender/:id
// mengganti larik itu utuh, jadi field yang tidak disunting (minggu,
// rumpun_kode, dan tanggal yang tidak diubah) wajib dikirim balik apa adanya.
function kumpulkanSesi(form, k) {
  const sesi = [];
  for (const tr of form.querySelectorAll('tr[data-i]')) {
    const asal = k.sesi[Number(tr.dataset.i)];
    const nilai = n => tr.querySelector(`[name="${n}"]`).value.trim();
    const tgl = nilai('tanggal');
    if (!tgl) throw new Error(`Minggu ${asal.minggu}: tanggal wajib diisi.`);
    const mulai = nilai('jam_mulai');
    const selesai = nilai('jam_selesai');
    if (Boolean(mulai) !== Boolean(selesai)) {
      throw new Error(`Minggu ${asal.minggu} (${tgl}): jam mulai dan selesai harus diisi berpasangan.`);
    }
    if (mulai && selesai <= mulai) {
      throw new Error(`Minggu ${asal.minggu} (${tgl}): jam selesai harus setelah jam mulai.`);
    }
    const berubahTanggal = tgl !== tanggalInput(asal.tanggal);
    const s = {
      ...asal,
      tanggal: berubahTanggal ? `${tgl}T00:00:00Z` : asal.tanggal,
      hari: berubahTanggal ? hariDari(tgl) : asal.hari,
      moda: nilai('moda'),
      keterangan: nilai('keterangan'),
    };
    delete s.jam_mulai;
    delete s.jam_selesai;
    if (mulai) { s.jam_mulai = mulai; s.jam_selesai = selesai; }
    if (!s.keterangan) delete s.keterangan;
    sesi.push(s);
  }
  return sesi;
}

async function simpanSesi(form) {
  const id = form.dataset.id;
  const k = cariKalender(id);
  const hasil = kartuDari(id).querySelector('.hasil-kartu');
  let sesi;
  try {
    sesi = kumpulkanSesi(form, k);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
    return;
  }
  const tombol = form.querySelector('button:not([type])');
  tombol.disabled = true;
  hasil.innerHTML = '<p class="redup">Menyimpan sesi…</p>';
  try {
    const baru = await apiPutJson(`/api/kalender/${encodeURIComponent(id)}`, { sesi });
    daftarKalender = daftarKalender.map(x => (x.id === id ? baru : x));
    tutupSunting(id);
    kartuDari(id).querySelector('.hasil-kartu').innerHTML = `<div class="pesan sukses">${baru.sesi.length} sesi tersimpan. Kalender masih draft — terbitkan kalau sudah final.</div>`;
  } catch (err) {
    tombol.disabled = false;
    hasil.innerHTML = `<div class="pesan gagal">Gagal menyimpan: ${esc(err.message)}</div>`;
  }
}

// Kalender terbit hanya terhapus dengan konfirmasi=terbit, dan itu keputusan
// sadar: mahasiswa sudah melihatnya. Kalau daftar di layar basi (kalender
// ternyata sudah diterbitkan orang lain), server menjawab 422 dan pengguna
// ditanya sekali lagi dengan alasan dari server.
async function hapus(id, konfirmasiTerbit = false) {
  const k = cariKalender(id);
  const nama = k ? `${k.prodi_kode.toUpperCase()} angkatan ${k.angkatan} semester ${k.semester}` : id;
  if (!konfirmasiTerbit) {
    const tanya = k && k.diterbitkan
      ? `Kalender ${nama} SUDAH DITERBITKAN dan sudah dilihat mahasiswa. Tetap hapus? Umumkan pembatalannya sesudah ini.`
      : `Hapus draft kalender ${nama}?`;
    if (!window.confirm(tanya)) return;
    konfirmasiTerbit = Boolean(k && k.diterbitkan);
  }
  try {
    await apiDeleteJson(`/api/kalender/${encodeURIComponent(id)}${konfirmasiTerbit ? '?konfirmasi=terbit' : ''}`);
    await muatDaftar();
    pesanDaftar(`<div class="pesan sukses">Kalender ${esc(nama)} dihapus.${konfirmasiTerbit ? ' Jangan lupa umumkan pembatalannya ke mahasiswa.' : ''}</div>`);
  } catch (err) {
    if (err.status === 422 && !konfirmasiTerbit && /konfirmasi=terbit/.test(err.message)) {
      if (window.confirm(`${err.message}\n\nTetap hapus?`)) await hapus(id, true);
      return;
    }
    pesanDaftar(`<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`);
  }
}

async function buatKalender(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hasil = document.getElementById('hasil-buat');
  hasil.innerHTML = '<p class="redup">Menyiapkan kalender…</p>';
  try {
    const k = await apiPostJson('/api/kalender', {
      prodi_kode: fd.get('prodi_kode'), angkatan: fd.get('angkatan'),
      semester: Number(fd.get('semester')), tanggal_mulai: fd.get('tanggal_mulai'),
      jumlah_minggu: Number(fd.get('jumlah_minggu')),
      // Kosong berarti ritme bawaan — prodi yang pola minggunya berbeda
      // memilih ritmenya sendiri di sini.
      ritme_nama: fd.get('ritme_nama') || '',
    });
    hasil.innerHTML = `<div class="pesan sukses">Draft kalender ${esc(k.prodi_kode.toUpperCase())} angkatan ${esc(k.angkatan)} semester ${esc(k.semester)} dibuat (${(k.sesi || []).length} sesi). Periksa sesinya di bawah, lalu terbitkan.</div>`;
    await muatDaftar();
    gantiSaring(k.prodi_kode);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal membuat kalender: ${esc(err.message)}</div>`;
  }
}

// Satu set pendengar di #daftar untuk semua kartu, karena isinya dirender
// ulang setiap kali daftar dimuat.
function pasangPendengarDaftar(daftar) {
  daftar.addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    if (b.classList.contains('terbitkan')) terbitkan(b.dataset.id);
    else if (b.classList.contains('sunting')) bukaSunting(b.dataset.id);
    else if (b.classList.contains('batal-sunting')) tutupSunting(b.dataset.id);
    else if (b.classList.contains('hapus')) hapus(b.dataset.id);
  });
  daftar.addEventListener('submit', e => {
    if (!e.target.classList.contains('form-sesi')) return;
    e.preventDefault();
    simpanSesi(e.target);
  });
  daftar.addEventListener('change', e => {
    if (e.target.name !== 'tanggal' || !e.target.closest('.form-sesi')) return;
    e.target.closest('tr').querySelector('.hari').textContent = hariDari(e.target.value);
  });
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else try {
  let saya = await sayaSekarang;
  if (!saya) { try { saya = await apiGet('/api/proyekblok/saya'); } catch { saya = null; } }
  const dipimpin = (saya && saya.kaprodi_prodi) || [];
  prodiSusun = saya && adalahKaprodiAktif(saya) ? dipimpin : [];
  peran = saya ? peranAktif(saya) : '';
  ({ prodi: semuaProdi = [] } = await apiGet('/api/kurikulum/prodi'));
  const prodi = semuaProdi.filter(p => prodiSusun.includes(p.kode));
  if (prodi.length) {
    try {
      ({ ritme: daftarRitme = [] } = await apiGet('/api/kurikulum/ritme'));
    } catch {
      daftarRitme = [];
    }
  }
  // Saringan awal: ?prodi= di alamat (semua = tanpa saringan), lalu prodi pengguna.
  prodiPengguna = prodiBawaan(saya);
  const dariAlamat = new URLSearchParams(location.search).get('prodi');
  saringProdi = dariAlamat === 'semua' ? ''
    : semuaProdi.some(p => p.kode === dariAlamat) ? dariAlamat
      : semuaProdi.some(p => p.kode === prodiPengguna) ? prodiPengguna : '';
  const kodeSaya = prodiPengguna.toUpperCase();
  const catatan = prodiSusun.length
    ? `<p class="pesan info">Anda menyusun kalender ${esc(prodiSusun.join(', ').toUpperCase())} sebagai kaprodi. Kalender prodi lain hanya bisa dibaca.</p>`
    : peran === 'mahasiswa' && kodeSaya
        ? `<p class="pesan info">Jadwal kuliah per minggu untuk prodi Anda, <b>${esc(kodeSaya)}</b>. Kalender disusun dan diterbitkan kaprodi ${esc(kodeSaya)}.</p>`
        : '<p class="pesan info">Kalender semester disusun dan diterbitkan kaprodi program studi masing-masing. Halaman ini menampilkan kalender yang sudah terbit.</p>';
  isi.innerHTML = catatan + (prodi.length ? formBuat(prodi, daftarRitme) : '')
    + `<div class="kartu kartu-saring">${kartuSaring()}<p class="meta" id="keterangan-saring"></p></div>`
    + '<div id="daftar"><p class="redup">Memuat kalender…</p></div>';
  if (prodi.length) {
    const form = document.getElementById('form-kalender');
    const pilihProdi = form.elements.prodi_kode;
    if ([...pilihProdi.options].some(o => o.value === saringProdi)) pilihProdi.value = saringProdi;
    form.addEventListener('submit', buatKalender);
  }
  document.getElementById('saring-prodi').addEventListener('change', e => gantiSaring(e.target.value));
  pasangPendengarDaftar(document.getElementById('daftar'));
  await muatDaftar();
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
}
