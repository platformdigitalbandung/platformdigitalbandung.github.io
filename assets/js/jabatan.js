import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, halamanUntuk, keadaanKosong, labelTabel } from './ui.js';

// Kelola Kaprodi — khusus super admin. Kaprodi diubah lewat
// PUT /api/kurikulum/prodi/:prodi/kaprodi dengan email kampus dosen; pilihan
// dosen dari GET /api/jabatan/dosen. Kaprodi yang sedang menjabat dibaca dari
// kaprodi_prodi di baris dosen (dihitung backend, termasuk kaprodi lama yang
// masih tercatat lewat NIP). Kewenangannya diputuskan backend (403 untuk selain
// admin); halaman ini hanya tidak menawarkannya.
//
// Di HP tabel prodi menjadi kartu bertumpuk (labelTabel) supaya pilihan dosen
// dan tombol Tetapkan tidak tersembunyi di area gulir (audit UX U07).

const isi = document.getElementById('isi');
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

let dosen = [];
let prodi = [];

/** Dosen yang sedang menjadi kaprodi satu prodi (null bila belum ada). */
function kaprodiDari(kode) {
  return dosen.find(d => (d.kaprodi_prodi || []).includes(kode)) || null;
}

const urutNama = (a, b) => (a.nama || a.email || '').localeCompare(b.nama || b.email || '', 'id', { sensitivity: 'base' });

function labelDosen(d) {
  if (!d) return '';
  const nama = d.nama || 'nama belum diisi';
  return d.email ? `${nama} · ${d.email}` : `${nama} (belum mengisi email)`;
}

function namaDosen(email) {
  const d = dosen.find(x => x.email && x.email === email);
  if (!d) return email ? `${email} (bukan dosen aktif)` : '';
  return labelDosen(d);
}

// Hanya dosen yang sudah mengisi email kampus yang bisa dipilih: kaprodi
// ditetapkan lewat email. Yang belum dirangkum di bawah tabel, bukan puluhan
// opsi mati di setiap pilihan.
function opsiDosen(emailSekarang) {
  return '<option value="">— pilih dosen —</option>' + dosen.filter(d => d.email).sort(urutNama).map(d => {
    const label = [labelDosen(d),
      d.jabatan === 'admin' ? 'admin' : '',
      (d.kaprodi_prodi || []).length ? `kaprodi ${d.kaprodi_prodi.join('/').toUpperCase()}` : ''].filter(Boolean).join(' · ');
    return `<option value="${escAttr(d.email)}"${d.email === emailSekarang ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function ringkasBelumEmail() {
  const belum = dosen.filter(d => !d.email);
  if (!belum.length) return '';
  const bernama = belum.filter(d => d.nama).sort(urutNama);
  const tanpaNama = belum.length - bernama.length;
  return `<details class="lipat-belum-email">
    <summary>${belum.length} dosen aktif belum mengisi email kampus — belum bisa dipilih</summary>
    <p class="meta">Minta mereka mengisi email kampus di halaman <a href="akademik.html">Roster &amp; Email Dosen</a>. Setelah terisi, namanya muncul di pilihan kaprodi.</p>
    ${bernama.length ? `<ul class="daftar-ringkas">${bernama.map(d => `<li>${esc(d.nama)}${(d.kaprodi_prodi || []).length ? ` <span class="lencana">kaprodi ${esc(d.kaprodi_prodi.join('/').toUpperCase())}</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${tanpaNama ? `<p class="redup">${tanpaNama} data dosen aktif lainnya belum punya nama maupun email kampus; pengelola data dosen perlu melengkapinya.</p>` : ''}
  </details>`;
}

function tabelProdi() {
  return `<div class="gulir"><table class="tabel-sunting">
    <thead><tr><th>Program studi</th><th>Kaprodi saat ini</th><th>Tetapkan kaprodi</th><th></th></tr></thead><tbody>
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
  </tbody></table></div>`;
}

function daftarAdmin() {
  const admin = dosen.filter(d => d.jabatan === 'admin');
  return admin.length
    ? `<ul class="daftar-ringkas">${admin.map(d => `<li>${esc(d.nama || 'nama belum diisi')}<span class="kecil">${d.email ? esc(d.email) : 'belum mengisi email kampus'}</span></li>`).join('')}</ul>`
    : '<p class="redup">Belum ada admin terdaftar.</p>';
}

function render(pesan = '') {
  isi.innerHTML = `
    <div class="kartu">
      <h3>Kaprodi per Program Studi</h3>
      <p class="meta">Pilih dosen lalu tekan <b>Tetapkan</b> atau <b>Ganti</b>. Kaprodi lama otomatis kembali menjadi dosen biasa untuk prodi itu. <b>Kosongkan</b> membuat prodi tanpa kaprodi — laporannya hanya bisa dibuka admin. Kaprodi ditetapkan lewat email kampus, jadi dosen yang belum mengisinya belum bisa dipilih.</p>
      <div id="pesan">${pesan}</div>
      ${prodi.length ? tabelProdi() : keadaanKosong({
        judul: 'Belum ada program studi',
        keterangan: 'Kaprodi ditetapkan per program studi. Buat program studinya dulu di halaman Kurikulum.',
        siapa: 'admin',
        aksi: { href: 'kurikulum.html', label: 'Buat program studi' },
      })}
      ${ringkasBelumEmail()}
    </div>
    <div class="kartu">
      <h3>Super Admin</h3>
      <p class="meta">Admin hanya menyiapkan: menetapkan kaprodi, membuat program studi baru, dan membuka laporan semua prodi. Kurikulum, dosen pengampu, kuis, dan materi dijalankan kaprodi untuk prodinya. Jabatan admin ditetapkan atau dicabut di halaman <a href="pengguna.html#dosen">Pengguna</a> (tab Dosen).</p>
      ${daftarAdmin()}
    </div>`;
  const tabel = isi.querySelector('table');
  if (tabel) labelTabel(tabel);
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
  const saya = await sayaSekarang;
  if (!halamanUntuk(saya, ['admin'], {
    judul: 'Kelola Kaprodi',
    pesan: 'Penetapan dan penggantian kaprodi hanya dilakukan admin.',
  })) return;
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
