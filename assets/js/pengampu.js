import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, prodiPimpinan } from './akun.js';
import { esc, halamanUntuk, keadaanKosong, istilah } from './ui.js';

// Dosen Pengampu Prodi — kaprodi mencentang dosen yang mengajar di prodinya
// (dosentugas.prodi_kode). Centang itu menentukan kuis gerbang dan katalog
// materi prodi mana yang boleh dikelola dosen. Keputusan pemilik produk
// 2026-09-14: peran utamanya di kaprodi, admin hanya menyiapkan kaprodi.
// Kewenangan tetap diputuskan backend (PUT /api/jabatan/dosen/:email/prodi hanya
// mengubah centang prodi yang dipimpin pengirimnya).
//
// Tampilan (audit UX 2026-09-14, U12/R04): dosen yang sudah mengisi email kampus
// tampil sebagai daftar centang yang bisa diketuk seluruh barisnya; yang belum
// dilipat di bawah karena memang belum bisa dicentang. Satu tombol "Simpan
// perubahan" mengirim PUT per dosen yang centangnya berubah — backend tidak
// punya rute massal, jadi tiap dosen tetap satu permintaan.

const isi = document.getElementById('isi');
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

let dosen = [];
let prodiSaya = [];
let emailSaya = '';

const urutNama = (a, b) => (a.nama || a.email || '').localeCompare(b.nama || b.email || '', 'id', { sensitivity: 'base' });
function pengampuSaya(d) { return (d.prodi_kode || []).filter(k => prodiSaya.some(p => p.kode === k)); }

function namaTampil(d) {
  return d.nama ? esc(d.nama) : '<span class="redup">nama belum diisi</span>';
}

function barisDosen(d, p) {
  const anda = d.email && d.email === emailSaya ? ' <span class="lencana">Anda</span>' : '';
  return `<label class="pilih-dosen">
    <input type="checkbox" name="pengampu" data-email="${escAttr(d.email)}" value="${escAttr(p.kode)}"${(d.prodi_kode || []).includes(p.kode) ? ' checked' : ''}>
    <span class="pilih-dosen-teks"><span class="pilih-dosen-nama">${namaTampil(d)}${anda}</span><span class="redup">${esc(d.email)}</span></span>
  </label>`;
}

function daftarProdi(p, siap) {
  // Yang sudah pengampu di atas supaya kaprodi langsung melihat keadaan
  // sekarang; urutan dihitung sekali saat dimuat, tidak melompat saat dicentang.
  const urut = [...siap].sort((a, b) =>
    (Number((b.prodi_kode || []).includes(p.kode)) - Number((a.prodi_kode || []).includes(p.kode))) || urutNama(a, b));
  const jumlah = siap.filter(d => (d.prodi_kode || []).includes(p.kode)).length;
  return `<fieldset class="kelompok-pengampu">
    <legend>${esc(p.nama)} (${esc(p.kode.toUpperCase())}) <span class="redup" data-jumlah="${escAttr(p.kode)}">· ${jumlah} pengampu</span></legend>
    ${urut.map(d => barisDosen(d, p)).join('')}
  </fieldset>`;
}

function belumEmail(tanpaEmail) {
  if (!tanpaEmail.length) return '';
  const bernama = tanpaEmail.filter(d => d.nama).sort(urutNama);
  const tanpaNama = tanpaEmail.length - bernama.length;
  return `<details class="lipat-belum-email">
    <summary>${tanpaEmail.length} dosen aktif belum mengisi email kampus — belum bisa dicentang</summary>
    <p class="meta">Pengampu disimpan lewat email kampus. Minta dosen di bawah mengisi email kampusnya di halaman <a href="akademik.html">Roster &amp; Email Dosen</a>; setelah itu namanya muncul di daftar centang.</p>
    ${bernama.length ? `<ul class="daftar-ringkas">${bernama.map(d => `<li>${esc(d.nama)}</li>`).join('')}</ul>` : ''}
    ${tanpaNama ? `<p class="redup">${tanpaNama} data dosen aktif lainnya belum punya nama maupun email kampus, jadi tidak bisa dikenali dari halaman ini. Pengelola data dosen perlu melengkapinya.</p>` : ''}
  </details>`;
}

function render() {
  const siap = dosen.filter(d => d.email);
  const tanpaEmail = dosen.filter(d => !d.email);
  const kode = prodiSaya.map(p => p.kode.toUpperCase()).join(', ');
  isi.innerHTML = `
    <div class="kartu">
      <h3>Dosen Pengampu ${esc(kode)}</h3>
      <div class="meta">Centang dosen ${istilah('pengampu')} prodi Anda, yaitu dosen yang mengajar di prodi ini, lalu tekan <b>Simpan perubahan</b>. Dosen yang dicentang menjadi <b>daftar pilihan pengajar kelas</b> prodi Anda: tunjuk mereka sebagai pengajar tiap kelas di halaman <a href="kelas.html?kelola=${esc(kode.toLowerCase())}">Kelas</a> — hanya pengajar kelas yang bisa menyusun materi, kuis, tugas, dan nilai kelas itu (sejak 2026-09-25). Anda sendiri sebagai kaprodi otomatis termasuk.</div>
      ${siap.length
        ? `<form id="form-pengampu">
            ${prodiSaya.map(p => daftarProdi(p, siap)).join('')}
            <div class="bilah-simpan">
              <button id="simpan-pengampu" disabled>Simpan perubahan</button>
              <span class="redup" id="status-ubah" aria-live="polite">Belum ada perubahan.</span>
            </div>
          </form>`
        : keadaanKosong({
          judul: 'Belum ada dosen yang bisa dicentang',
          keterangan: 'Pengampu dipilih lewat email kampus, dan belum ada dosen aktif yang mengisinya.',
          siapa: 'dosen yang akan mengajar (mengisi email kampus)',
          aksi: { href: 'akademik.html', label: 'Buka Roster & Email Dosen' },
        })}
      <div id="pesan"></div>
      ${belumEmail(tanpaEmail)}
    </div>`;
}

/** Email dosen yang centangnya berbeda dari data tersimpan, beserta pilihan barunya. */
function perubahan() {
  const form = document.getElementById('form-pengampu');
  if (!form) return [];
  const pilihan = new Map();
  for (const c of form.querySelectorAll('input[name="pengampu"]')) {
    if (!pilihan.has(c.dataset.email)) pilihan.set(c.dataset.email, []);
    if (c.checked) pilihan.get(c.dataset.email).push(c.value);
  }
  return [...pilihan].filter(([email, baru]) => {
    const d = dosen.find(x => x.email === email);
    const lama = d ? pengampuSaya(d) : [];
    return lama.length !== baru.length || baru.some(k => !lama.includes(k));
  }).map(([email, baru]) => ({ email, baru }));
}

function perbaruiStatus() {
  const n = perubahan().length;
  const tombol = document.getElementById('simpan-pengampu');
  if (!tombol) return;
  tombol.disabled = n === 0;
  tombol.textContent = n ? `Simpan perubahan (${n} dosen)` : 'Simpan perubahan';
  document.getElementById('status-ubah').textContent = n ? 'Perubahan belum disimpan.' : 'Belum ada perubahan.';
  for (const p of prodiSaya) {
    const el = isi.querySelector(`[data-jumlah="${CSS.escape(p.kode)}"]`);
    const jumlah = isi.querySelectorAll(`input[name="pengampu"][value="${CSS.escape(p.kode)}"]:checked`).length;
    if (el) el.textContent = `· ${jumlah} pengampu`;
  }
}

async function simpan(e) {
  e.preventDefault();
  const daftar = perubahan();
  if (!daftar.length) return;
  const tombol = document.getElementById('simpan-pengampu');
  const pesan = document.getElementById('pesan');
  tombol.disabled = true;
  pesan.innerHTML = '<p class="redup">Menyimpan…</p>';
  const berhasil = [];
  const gagal = [];
  // Berurutan, supaya pesan galat bisa menyebut dosen mana yang gagal.
  for (const { email, baru } of daftar) {
    const d = dosen.find(x => x.email === email);
    const nama = d && d.nama ? d.nama : email;
    try {
      const r = await apiPutJson(`/api/jabatan/dosen/${encodeURIComponent(email)}/prodi`, { prodi_kode: baru });
      if (d) d.prodi_kode = r.prodi_kode || [];
      const kini = d ? pengampuSaya(d) : baru;
      berhasil.push(`${nama} ${kini.length ? `kini pengampu ${kini.join(', ').toUpperCase()}` : 'tidak lagi pengampu prodi Anda'}`);
    } catch (err) {
      gagal.push(`${nama}: ${err.message}`);
    }
  }
  pesan.innerHTML = (berhasil.length ? `<div class="pesan sukses">Tersimpan: ${berhasil.map(esc).join('; ')}. Berlaku seketika.</div>` : '')
    + (gagal.length ? `<div class="pesan gagal">Gagal disimpan (centangnya masih tampil, coba lagi): ${gagal.map(esc).join('; ')}.</div>` : '');
  perbaruiStatus();
}

async function muat() {
  const saya = await sayaSekarang;
  if (!halamanUntuk(saya, ['kaprodi'], {
    judul: 'Dosen Pengampu Prodi',
    pesan: 'Kaprodi mencentang dosen yang mengajar di prodinya. Dosen dan mahasiswa tidak perlu membuka halaman ini.',
  })) return;
  const kodeSaya = prodiPimpinan(saya) || [];
  emailSaya = saya.email || '';
  const [{ prodi = [] }, { dosen: d = [] }] = await Promise.all([
    apiGet('/api/kurikulum/prodi'),
    apiGet('/api/jabatan/dosen'),
  ]);
  prodiSaya = prodi.filter(p => kodeSaya.includes(p.kode));
  dosen = d;
  if (!prodiSaya.length) {
    isi.innerHTML = keadaanKosong({
      judul: 'Prodi yang Anda pimpin tidak ditemukan',
      keterangan: 'Data kaprodi Anda belum cocok dengan daftar program studi. Keluar lalu masuk lagi; kalau tetap begini, minta admin memeriksa Kelola Kaprodi.',
      siapa: 'admin',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  render();
  isi.addEventListener('change', e => { if (e.target.name === 'pengampu') perbaruiStatus(); });
  isi.addEventListener('submit', e => { if (e.target.id === 'form-pengampu') simpan(e); });
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
