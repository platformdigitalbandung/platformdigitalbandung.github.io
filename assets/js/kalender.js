import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, adalahKaprodiAktif } from './akun.js';

// Kalender akademik. Baca untuk dosen dan mahasiswa terdaftar (hanya kalender
// yang sudah diterbitkan); belum masuk diarahkan ke /login/.
//
// Pembuatan draft, penyuntingan sesi, penerbitan, dan penghapusan hanya untuk
// kaprodi prodi kalender itu (keputusan pemilik produk 2026-09-14): tombolnya
// muncul selagi peran aktif kaprodi, dan hanya pada kalender prodi yang ia
// pimpin. Kewenangannya tetap dicek server (403 untuk yang lain).

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
// esc tidak meloloskan tanda kutip, jadi nilai atribut (mis. keterangan sesi
// yang memuat ") wajib lewat escAttr.
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

const HARI_TANGGAL = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
function tanggal(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : d.toLocaleDateString('id-ID', HARI_TANGGAL);
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

// Prodi yang kalendernya boleh disusun pengguna ini: prodi yang ia pimpin,
// selagi peran aktifnya kaprodi. Kosong = hanya membaca.
let prodiSusun = [];
let daftarKalender = [];
function bolehSusun(k) { return prodiSusun.includes(k.prodi_kode); }

function tabelSesi(sesi) {
  if (!sesi || !sesi.length) return '<p class="redup">Kalender ini belum punya sesi.</p>';
  return `<div class="gulir"><table>
      <tr><th class="num">Minggu</th><th>Tanggal</th><th>Moda</th><th>Jam</th><th>Keterangan</th></tr>
      ${sesi.map(s => `<tr>
        <td class="num">${s.minggu}</td>
        <td>${esc(tanggal(s.tanggal))}</td>
        <td>${esc(s.moda)}</td>
        <td>${s.jam_mulai ? `${esc(s.jam_mulai)}–${esc(s.jam_selesai || '')}` : '<span class="redup">–</span>'}</td>
        <td>${esc(s.keterangan || '')}</td></tr>`).join('')}
    </table></div>`;
}

function pilihanModa(sekarang) {
  const semua = MODA.includes(sekarang) || !sekarang ? MODA : [...MODA, sekarang];
  return semua.map(m => `<option value="${escAttr(m)}"${m === sekarang ? ' selected' : ''}>${esc(m)}</option>`).join('');
}

function formSunting(k) {
  return `
    <form class="form-sesi" data-id="${escAttr(k.id)}">
      <p class="meta">Mengubah tanggal ikut mengubah harinya. Jam boleh dikosongkan (mis. hari bebas), tapi mulai dan selesai harus diisi berpasangan.</p>
      <div class="gulir"><table class="tabel-sunting">
        <tr><th class="num">Minggu</th><th>Tanggal</th><th>Hari</th><th>Moda</th><th>Mulai</th><th>Selesai</th><th>Keterangan</th></tr>
        ${k.sesi.map((s, i) => `<tr data-i="${i}">
          <td class="num">${s.minggu}</td>
          <td><input type="date" name="tanggal" value="${escAttr(tanggalInput(s.tanggal))}" required></td>
          <td class="hari">${esc(s.hari)}</td>
          <td><select name="moda">${pilihanModa(s.moda)}</select></td>
          <td><input type="time" name="jam_mulai" value="${escAttr(s.jam_mulai || '')}"></td>
          <td><input type="time" name="jam_selesai" value="${escAttr(s.jam_selesai || '')}"></td>
          <td><input name="keterangan" value="${escAttr(s.keterangan || '')}" maxlength="300"></td></tr>`).join('')}
      </table></div>
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
      <h3>${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${k.semester} ${status}</h3>
      <p class="meta">Mulai ${esc(tanggal(k.tanggal_mulai))} · ${(k.sesi || []).length} sesi</p>
      <div class="isi-sesi">${tabelSesi(k.sesi)}</div>
      <div class="aksi-kartu">${aksi}</div>
      <div class="hasil-kartu"></div>
    </div>`;
}

function formBuat(prodi, ritme) {
  return `
    <div class="kartu">
      <h3>Buat Draft Kalender</h3>
      <p class="meta">Tanggal tiap sesi diisi otomatis dari ritme mingguan kurikulum. Selagi masih draft, sesinya boleh disunting; setelah diterbitkan tidak bisa lagi.</p>
      <form id="form-kalender">
        <label>Program studi
          <select name="prodi_kode" required>
            ${prodi.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)}</option>`).join('')}
          </select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" placeholder="2026"></label>
        <label>Semester
          <select name="semester">${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
        <label>Tanggal mulai <input type="date" name="tanggal_mulai" required></label>
        <label>Jumlah minggu <input type="number" name="jumlah_minggu" min="1" max="24" value="16"></label>
        ${ritme.length > 1 ? `<label>Ritme mingguan
          <select name="ritme_nama">${ritme.map(r => `<option value="${escAttr(r.nama)}">${esc(r.nama)} · ${esc(r.total_menit_per_minggu)} menit/minggu</option>`).join('')}</select></label>` : ''}
        <button>Buat Draft</button>
      </form>
      <div id="hasil-buat"></div>
    </div>`;
}

let filterAktif = {};

async function muatDaftar(filter = filterAktif) {
  filterAktif = filter;
  const q = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => { if (v) q.set(k, v); });
  if (prodiSusun.length) q.set('draft', '1');
  const { kalender: semua = [] } = await apiGet('/api/kalender' + (q.toString() ? `?${q}` : ''));
  // Draft hanya ditampilkan untuk prodi yang disusun pengguna ini.
  const kalender = semua.filter(k => k.diterbitkan || bolehSusun(k));
  daftarKalender = kalender;
  document.getElementById('daftar').innerHTML = kalender.length
    ? kalender.map(kartuKalender).join('')
    : `<div class="kosong">${prodiSusun.length
      ? `Belum ada kalender untuk ${esc(prodiSusun.join(', ').toUpperCase())}. Buat draft di atas, periksa sesinya, lalu terbitkan sebelum semester dimulai.`
      : 'Belum ada kalender yang diterbitkan. Kalender resmi disusun dan diterbitkan kaprodi program studi sebelum semester dimulai.'}</div>`;
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
    hasil.innerHTML = `<div class="pesan sukses">Draft kalender ${esc(k.prodi_kode)} angkatan ${esc(k.angkatan)} semester ${k.semester} dibuat (${(k.sesi || []).length} sesi).</div>`;
    await muatDaftar();
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
  const { prodi: semuaProdi = [] } = await apiGet('/api/kurikulum/prodi');
  const prodi = semuaProdi.filter(p => prodiSusun.includes(p.kode));
  let ritme = [];
  try {
    ({ ritme = [] } = await apiGet('/api/kurikulum/ritme'));
  } catch {
    // Pilihan ritme hanya muncul kalau memang ada lebih dari satu; tanpa itu
    // backend memakai ritme bawaan, jadi halaman tetap berguna.
  }
  const catatan = prodiSusun.length
    ? `<p class="pesan info">Anda menyusun kalender ${esc(prodiSusun.join(', ').toUpperCase())} sebagai kaprodi. Kalender prodi lain hanya bisa dibaca.</p>`
    : dipimpin.length
      ? `<p class="pesan info">Kalender disusun kaprodi program studi. Untuk menyusun kalender ${esc(dipimpin.join(', ').toUpperCase())}, pilih peran <b>kaprodi</b> di pojok kanan atas.</p>`
      : '<p class="pesan info">Kalender semester disusun dan diterbitkan kaprodi program studi masing-masing. Halaman ini menampilkan kalender yang sudah terbit.</p>';
  isi.innerHTML = catatan + (prodi.length ? formBuat(prodi, ritme) : '') + '<div id="daftar"><p class="redup">Memuat kalender…</p></div>';
  if (prodi.length) document.getElementById('form-kalender').addEventListener('submit', buatKalender);
  pasangPendengarDaftar(document.getElementById('daftar'));
  await muatDaftar();
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
}
