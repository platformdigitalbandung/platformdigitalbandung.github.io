import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahDirektur } from './akun.js';

// Kelola Kaprodi — khusus direktur. Kaprodi disimpan per prodi
// (prodi.kaprodi_nip) dan diubah lewat PUT /api/kurikulum/prodi/:prodi/kaprodi;
// pilihan dosen dari GET /api/jabatan/dosen. Kewenangannya diputuskan backend
// (403 untuk selain direktur); halaman ini hanya tidak menawarkannya.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

let dosen = [];
let prodi = [];

function namaDosen(nip) {
  const d = dosen.find(x => x.nip === nip);
  if (!d) return nip ? `NIP ${nip} (bukan dosen aktif)` : '';
  return d.nama ? `${d.nama} · NIP ${d.nip}` : `NIP ${d.nip}`;
}

function opsiDosen(nipSekarang) {
  return '<option value="">— pilih dosen —</option>' + dosen.map(d => {
    const label = [d.nama || '(tanpa nama)', `NIP ${d.nip}`,
      d.jabatan === 'direktur' ? 'direktur' : '',
      d.kaprodi_prodi.length ? `kaprodi ${d.kaprodi_prodi.join('/').toUpperCase()}` : ''].filter(Boolean).join(' · ');
    return `<option value="${escAttr(d.nip)}"${d.nip === nipSekarang ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function tabelProdi() {
  return `<div class="gulir"><table class="tabel-sunting">
    <tr><th>Program studi</th><th>Kaprodi saat ini</th><th>Tetapkan kaprodi</th><th></th></tr>
    ${prodi.map(p => `<tr data-prodi="${escAttr(p.kode)}">
      <td><b>${esc(p.nama)}</b><br><span class="redup">${esc(p.kode.toUpperCase())}</span></td>
      <td>${p.kaprodi_nip ? esc(namaDosen(p.kaprodi_nip)) : '<span class="lencana sedang">belum ada</span>'}</td>
      <td><select name="nip" aria-label="Kaprodi ${escAttr(p.nama)}">${opsiDosen(p.kaprodi_nip || '')}</select></td>
      <td><div class="cta-row">
        <button type="button" data-aksi="tetapkan">${p.kaprodi_nip ? 'Ganti' : 'Tetapkan'}</button>
        ${p.kaprodi_nip ? '<button type="button" class="sekunder" data-aksi="kosongkan">Kosongkan</button>' : ''}
      </div></td></tr>`).join('')}
  </table></div>`;
}

function daftarDirektur() {
  const direktur = dosen.filter(d => d.jabatan === 'direktur');
  return direktur.length
    ? `<ul class="daftar-ringkas">${direktur.map(d => `<li>${esc(d.nama || '(tanpa nama)')}<span class="kecil">NIP ${esc(d.nip)}</span></li>`).join('')}</ul>`
    : '<p class="redup">Belum ada direktur terdaftar.</p>';
}

function render(pesan = '') {
  isi.innerHTML = `
    <div class="kartu">
      <h3>Kaprodi per Program Studi</h3>
      <p class="meta">Pilih dosen lalu tekan <b>Tetapkan</b> atau <b>Ganti</b>. Kaprodi lama otomatis kembali menjadi dosen biasa untuk prodi itu. <b>Kosongkan</b> membuat prodi tanpa kaprodi — laporannya hanya bisa dibuka direktur.</p>
      <div id="pesan">${pesan}</div>
      ${prodi.length ? tabelProdi() : '<div class="kosong">Belum ada program studi di data kurikulum.</div>'}
    </div>
    <div class="kartu">
      <h3>Direktur</h3>
      <p class="meta">Direktur adalah super admin: semua prodi dan semua laporan. Jabatan ini diubah langsung di database oleh pengelola, bukan dari halaman ini.</p>
      ${daftarDirektur()}
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

async function ubahKaprodi(kode, nip) {
  const p = prodi.find(x => x.kode === kode);
  const tanya = nip
    ? `Tetapkan ${namaDosen(nip)} sebagai kaprodi ${p.nama}?${p.kaprodi_nip && p.kaprodi_nip !== nip ? `\n\nKaprodi saat ini (${namaDosen(p.kaprodi_nip)}) akan digantikan.` : ''}`
    : `Kosongkan kaprodi ${p.nama}? ${namaDosen(p.kaprodi_nip)} kembali menjadi dosen biasa untuk prodi ini.`;
  if (!window.confirm(tanya)) return;
  try {
    await apiPutJson(`/api/kurikulum/prodi/${encodeURIComponent(kode)}/kaprodi`, { nip });
    await muatData();
    render(`<div class="pesan sukses">${nip ? `Kaprodi ${esc(p.nama)} kini ${esc(namaDosen(nip))}.` : `Kaprodi ${esc(p.nama)} dikosongkan.`} Minta yang bersangkutan keluar lalu masuk lagi agar labelnya ikut berubah.</div>`);
  } catch (err) {
    document.getElementById('pesan').innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (!adalahDirektur(saya)) {
    isi.innerHTML = `<div class="kartu"><h3>Khusus direktur</h3>
      <p class="meta">Penetapan dan penggantian kaprodi hanya bisa dilakukan direktur.</p>
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
    const nip = baris.querySelector('select[name="nip"]').value;
    if (!nip) {
      document.getElementById('pesan').innerHTML = '<div class="pesan gagal">Pilih dosen dulu sebelum menekan Tetapkan.</div>';
      return;
    }
    const p = prodi.find(x => x.kode === kode);
    if (p && p.kaprodi_nip === nip) {
      document.getElementById('pesan').innerHTML = `<div class="pesan sukses">${esc(namaDosen(nip))} memang sudah kaprodi ${esc(p.nama)}.</div>`;
      return;
    }
    ubahKaprodi(kode, nip);
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
