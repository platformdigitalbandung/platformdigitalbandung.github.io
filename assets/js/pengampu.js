import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { prodiPimpinan, adalahKaprodiAktif } from './akun.js';

// Dosen Pengampu Prodi — kaprodi mencentang dosen yang mengajar di prodinya
// (dosentugas.prodi_kode). Centang itu menentukan kuis gerbang dan katalog
// materi prodi mana yang boleh dikelola dosen. Keputusan pemilik produk
// 2026-09-14: peran utamanya di kaprodi, admin hanya menyiapkan kaprodi.
// Kewenangan tetap diputuskan backend (PUT /api/jabatan/dosen/:email/prodi hanya
// mengubah centang prodi yang dipimpin pengirimnya).

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

let dosen = [];
let prodiSaya = [];

function tabel() {
  if (!dosen.length) return '<div class="kosong">Belum ada dosen aktif.</div>';
  // Baris dikunci email kampus. Dosen yang belum mengisinya tetap tampil,
  // tetapi centangnya nonaktif: pengampu disimpan lewat email.
  return `<div class="gulir"><table class="tabel-sunting">
    <tr><th>Dosen</th>${prodiSaya.map(p => `<th>${esc(p.kode.toUpperCase())}</th>`).join('')}<th></th></tr>
    ${dosen.map(d => {
      const mati = d.email ? '' : ' disabled';
      return `<tr data-email="${escAttr(d.email || '')}">
      <td>${esc(d.nama || '(tanpa nama)')}<br><span class="redup">${d.email ? esc(d.email) : 'belum mengisi email kampus'}</span></td>
      ${prodiSaya.map(p => `<td><input type="checkbox" name="prodi" value="${escAttr(p.kode)}"${(d.prodi_kode || []).includes(p.kode) ? ' checked' : ''}${mati} aria-label="${escAttr(d.nama || d.email)} mengajar di ${escAttr(p.nama)}"></td>`).join('')}
      <td><button type="button" class="sekunder" data-aksi="simpan"${mati}>Simpan</button></td>
    </tr>`;
    }).join('')}
  </table></div>`;
}

async function simpan(baris) {
  const email = baris.dataset.email;
  const pesan = document.getElementById('pesan');
  if (!email) {
    pesan.innerHTML = '<div class="pesan gagal">Dosen ini belum mengisi email kampus, jadi belum bisa dijadikan pengampu.</div>';
    return;
  }
  // Yang dikirim hanya centang prodi yang Anda pimpin; backend mempertahankan
  // centang prodi lain milik dosen itu.
  const pilihan = [...baris.querySelectorAll('input[name="prodi"]:checked')].map(c => c.value);
  try {
    const r = await apiPutJson(`/api/jabatan/dosen/${encodeURIComponent(email)}/prodi`, { prodi_kode: pilihan });
    const d = dosen.find(x => x.email === email);
    if (d) d.prodi_kode = r.prodi_kode || [];
    const nama = d ? (d.nama || d.email) : email;
    const diSaya = (r.prodi_kode || []).filter(k => prodiSaya.some(p => p.kode === k));
    pesan.innerHTML = `<div class="pesan sukses">${esc(nama)} ${diSaya.length ? `kini pengampu ${esc(diSaya.join(', ').toUpperCase())}` : 'tidak lagi pengampu prodi Anda'}.</div>`;
  } catch (err) {
    pesan.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  const kodeSaya = prodiPimpinan(saya) || [];
  if (!adalahKaprodiAktif(saya) || !kodeSaya.length) {
    isi.innerHTML = `<div class="kartu"><h3>Khusus kaprodi</h3>
      <p class="meta">Dosen pengampu diatur kaprodi untuk prodinya. Kaprodi yang sedang memakai peran lain: pilih peran kaprodi di pojok kanan atas.</p>
      <a class="aksi" href="saya.html">Kembali ke Beranda Saya</a></div>`;
    return;
  }
  const [{ prodi = [] }, { dosen: d = [] }] = await Promise.all([
    apiGet('/api/kurikulum/prodi'),
    apiGet('/api/jabatan/dosen'),
  ]);
  prodiSaya = prodi.filter(p => kodeSaya.includes(p.kode));
  dosen = d;
  isi.innerHTML = `
    <div class="kartu">
      <h3>Dosen Pengampu ${esc(prodiSaya.map(p => p.kode.toUpperCase()).join(', '))}</h3>
      <p class="meta">Centang dosen yang mengajar di prodi Anda, lalu tekan <b>Simpan</b> di barisnya. Dosen yang dicentang bisa menyusun kuis gerbang dan mengelola katalog materi prodi Anda.</p>
      <div id="pesan"></div>
      ${tabel()}
    </div>`;
  isi.addEventListener('click', e => {
    const b = e.target.closest('button[data-aksi="simpan"]');
    if (b) simpan(b.closest('tr[data-email]'));
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
