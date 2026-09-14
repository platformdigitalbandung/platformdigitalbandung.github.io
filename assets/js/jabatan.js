import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahAdmin } from './akun.js';

// Kelola Kaprodi — khusus super admin. Kaprodi diubah lewat
// PUT /api/kurikulum/prodi/:prodi/kaprodi dengan email kampus dosen; pilihan
// dosen dari GET /api/jabatan/dosen. Kaprodi yang sedang menjabat dibaca dari
// kaprodi_prodi di baris dosen (dihitung backend, termasuk kaprodi lama yang
// masih tercatat lewat NIP). Kewenangannya diputuskan backend (403 untuk selain
// admin); halaman ini hanya tidak menawarkannya.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

let dosen = [];
let prodi = [];

/** Dosen yang sedang menjadi kaprodi satu prodi (null bila belum ada). */
function kaprodiDari(kode) {
  return dosen.find(d => (d.kaprodi_prodi || []).includes(kode)) || null;
}

function labelDosen(d) {
  if (!d) return '';
  const nama = d.nama || '(tanpa nama)';
  return d.email ? `${nama} · ${d.email}` : `${nama} (belum mengisi email)`;
}

function namaDosen(email) {
  const d = dosen.find(x => x.email && x.email === email);
  if (!d) return email ? `${email} (bukan dosen aktif)` : '';
  return labelDosen(d);
}

// Dosen yang belum mengisi email kampus tetap tampil, tetapi tidak bisa dipilih:
// kaprodi ditetapkan lewat email.
function opsiDosen(emailSekarang) {
  return '<option value="">— pilih dosen —</option>' + dosen.map(d => {
    const label = [labelDosen(d),
      d.jabatan === 'admin' ? 'admin' : '',
      (d.kaprodi_prodi || []).length ? `kaprodi ${d.kaprodi_prodi.join('/').toUpperCase()}` : ''].filter(Boolean).join(' · ');
    if (!d.email) return `<option value="" disabled>${esc(label)}</option>`;
    return `<option value="${escAttr(d.email)}"${d.email === emailSekarang ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function tabelProdi() {
  return `<div class="gulir"><table class="tabel-sunting">
    <tr><th>Program studi</th><th>Kaprodi saat ini</th><th>Tetapkan kaprodi</th><th></th></tr>
    ${prodi.map(p => {
      const k = kaprodiDari(p.kode);
      return `<tr data-prodi="${escAttr(p.kode)}">
      <td><b>${esc(p.nama)}</b><br><span class="redup">${esc(p.kode.toUpperCase())}</span></td>
      <td>${k ? esc(labelDosen(k)) : '<span class="lencana sedang">belum ada</span>'}</td>
      <td><select name="email" aria-label="Kaprodi ${escAttr(p.nama)}">${opsiDosen(k ? k.email : '')}</select></td>
      <td><div class="cta-row">
        <button type="button" data-aksi="tetapkan">${k ? 'Ganti' : 'Tetapkan'}</button>
        ${k ? '<button type="button" class="sekunder" data-aksi="kosongkan">Kosongkan</button>' : ''}
      </div></td></tr>`;
    }).join('')}
  </table></div>`;
}

function daftarAdmin() {
  const admin = dosen.filter(d => d.jabatan === 'admin');
  return admin.length
    ? `<ul class="daftar-ringkas">${admin.map(d => `<li>${esc(d.nama || '(tanpa nama)')}<span class="kecil">${d.email ? esc(d.email) : 'belum mengisi email kampus'}</span></li>`).join('')}</ul>`
    : '<p class="redup">Belum ada admin terdaftar.</p>';
}

function render(pesan = '') {
  isi.innerHTML = `
    <div class="kartu">
      <h3>Kaprodi per Program Studi</h3>
      <p class="meta">Pilih dosen lalu tekan <b>Tetapkan</b> atau <b>Ganti</b>. Kaprodi lama otomatis kembali menjadi dosen biasa untuk prodi itu. <b>Kosongkan</b> membuat prodi tanpa kaprodi — laporannya hanya bisa dibuka admin. Kaprodi ditetapkan lewat email kampus, jadi dosen yang belum mengisinya belum bisa dipilih.</p>
      <div id="pesan">${pesan}</div>
      ${prodi.length ? tabelProdi() : '<div class="kosong">Belum ada program studi di data kurikulum.</div>'}
    </div>
    <div class="kartu">
      <h3>Super Admin</h3>
      <p class="meta">Admin hanya menyiapkan: menetapkan kaprodi, membuat program studi baru, dan membuka laporan semua prodi. Kurikulum, dosen pengampu, kuis, dan materi dijalankan kaprodi untuk prodinya. Jabatan admin diubah langsung di database oleh pengelola, bukan dari halaman ini.</p>
      ${daftarAdmin()}
    </div>`;
}

async function muatData() {
  const [{ prodi: p = [] }, { dosen: d = [] }] = await Promise.all([
    apiGet('/api/kurikulum/prodi'),
    apiGet('/api/jabatan/dosen', { auth: true }),
  ]);
  prodi = p;
  dosen = d;
}

async function ubahKaprodi(kode, email) {
  const p = prodi.find(x => x.kode === kode);
  const k = kaprodiDari(kode);
  const tanya = email
    ? `Tetapkan ${namaDosen(email)} sebagai kaprodi ${p.nama}?${k && k.email !== email ? `\n\nKaprodi saat ini (${labelDosen(k)}) akan digantikan.` : ''}`
    : `Kosongkan kaprodi ${p.nama}? ${labelDosen(k)} kembali menjadi dosen biasa untuk prodi ini.`;
  if (!window.confirm(tanya)) return;
  try {
    await apiPutJson(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/kaprodi`, { email });
    await muatData();
    render(`<div class="pesan sukses">${email ? `Kaprodi ${esc(p.nama)} kini ${esc(namaDosen(email))}.` : `Kaprodi ${esc(p.nama)} dikosongkan.`} Minta yang bersangkutan keluar lalu masuk lagi agar labelnya ikut berubah.</div>`);
  } catch (err) {
    document.getElementById('pesan').innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (!adalahAdmin(saya)) {
    isi.innerHTML = `<div class="kartu"><h3>Khusus admin</h3>
      <p class="meta">Penetapan dan penggantian kaprodi hanya bisa dilakukan admin. Admin yang sedang memakai peran lain: pilih peran admin di pojok kanan atas.</p>
      <a class="aksi" href="saya.html">Kembali ke Beranda Saya</a></div>`;
    return;
  }
  await muatData();
  render();
  isi.addEventListener('click', e => {
    const tombol = e.target.closest('button[data-aksi]');
    if (!tombol) return;
    const baris = tombol.closest('tr[data-prodi]');
    const kode = baris.dataset.prodi;
    if (tombol.dataset.aksi === 'kosongkan') {
      ubahKaprodi(kode, '');
      return;
    }
    const email = baris.querySelector('select[name="email"]').value;
    if (!email) {
      document.getElementById('pesan').innerHTML = '<div class="pesan gagal">Pilih dosen dulu sebelum menekan Tetapkan.</div>';
      return;
    }
    const p = prodi.find(x => x.kode === kode);
    const k = kaprodiDari(kode);
    if (p && k && k.email === email) {
      document.getElementById('pesan').innerHTML = `<div class="pesan sukses">${esc(namaDosen(email))} memang sudah kaprodi ${esc(p.nama)}.</div>`;
      return;
    }
    ubahKaprodi(kode, email);
  });
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
