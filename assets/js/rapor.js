import { apiGet } from './api.js';
import { adalahPimpinan, prodiPimpinan } from './akun.js';
import { esc, istilah, keadaanKosong, pilihProdiBawaan, prodiBawaan } from './ui.js';
import { sayaHalaman } from './hal-dosen.js';

// Rapor per semester dan rekap nilai. Mahasiswa melihat rapornya sendiri (NIM
// dari /api/proyekblok/saya); dosen membuka rapor mahasiswa mana pun lewat NIM
// atau rekap satu prodi/angkatan/semester. Kewenangannya tetap dicek backend.
// Bentuk cetaknya halaman ini sendiri (dialog cetak peramban) — tanpa PDF di
// server, keputusan pemilik produk 2026-09-13.

const isi = document.getElementById('isi');
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function dua(n) { return typeof n === 'number' ? n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'; }
function angka(n) { return typeof n === 'number' ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '–'; }

const TANGGAL = { day: 'numeric', month: 'long', year: 'numeric' };
const KELAS_HURUF = { A: 'rendah', B: 'rendah', C: '', D: 'tinggi', E: 'tinggi' };

function lencanaHuruf(h) { return `<span class="lencana ${KELAS_HURUF[h] ?? ''}">${esc(h)}</span>`; }

function pesanGagal(err) {
  const kelas = err && err.status === 422 ? 'kosong' : 'pesan gagal';
  return `<div class="${kelas}">${esc(err ? err.message : 'Gagal memuat.')}</div>`;
}

function tabelSkala(skala) {
  return `<p class="meta">Skala: ${(skala || []).map(s => `${esc(s.huruf)} ≥${esc(s.minimal)} (bobot ${esc(s.bobot)})`).join(' · ')}</p>`;
}

function kartuSemester(s) {
  return `
    <div class="kartu">
      <h3>Semester ${esc(s.semester)}</h3>
      <div class="gulir"><table>
        <tr><th>Mata kuliah</th><th>Rumpun</th><th class="num">SKS</th><th class="num">Nilai</th><th>Huruf</th><th class="num">Bobot</th><th>Status</th><th>CPL</th></tr>
        ${s.mata_kuliah.map(m => `<tr>
          <td>${esc(m.nama)}<br><span class="redup">${esc(m.kode_mk)}</span></td>
          <td>${esc(m.rumpun_kode)}</td>
          <td class="num">${esc(m.sks)}</td>
          <td class="num">${angka(m.nilai_akhir)}</td>
          <td>${lencanaHuruf(m.huruf)}</td>
          <td class="num">${esc(m.bobot)}</td>
          <td>${m.lulus ? '<span class="lencana rendah">lulus</span>' : '<span class="lencana tinggi">tidak lulus</span>'}</td>
          <td>${(m.cpl || []).map(esc).join(', ') || '<span class="redup">–</span>'}</td></tr>`).join('')}
        <tr><td colspan="2"><b>Semester ${esc(s.semester)}</b></td><td class="num"><b>${esc(s.sks_dinilai)}</b></td><td colspan="3" class="num">IP <b>${dua(s.ip)}</b></td><td colspan="2">${esc(s.sks_lulus)} SKS lulus</td></tr>
      </table></div>
      <p class="meta">CPL tersentuh dari mata kuliah lulus: ${(s.cpl_tersentuh || []).map(esc).join(', ') || '–'}</p>
    </div>`;
}

function htmlRapor(r) {
  const tak = r.tidak_terpetakan || [];
  return `
    <div class="kartu">
      <h3>Rapor ${esc(r.nama)} · NIM ${esc(r.nim)}</h3>
      <p class="meta">${esc(r.prodi_kode.toUpperCase())} · angkatan ${esc(r.angkatan)} · semester berjalan ${esc(r.semester_berjalan)} · disusun ${esc(new Date().toLocaleDateString('id-ID', TANGGAL))}</p>
      <div class="stat-row">
        <div class="stat"><span class="angka">${dua(r.ipk)}</span><span class="label">IPK</span></div>
        <div class="stat"><span class="angka">${esc(r.sks_lulus)} / ${esc(r.sks_dinilai)}</span><span class="label">SKS lulus dari yang dinilai</span></div>
        <div class="stat"><span class="angka">${esc(r.semester.length)}</span><span class="label">semester dengan nilai</span></div>
      </div>
      ${tabelSkala(r.skala)}
    </div>
    ${r.semester.length ? r.semester.map(kartuSemester).join('') : keadaanKosong({
      judul: 'Belum ada nilai yang tercatat',
      keterangan: 'Nilai mata kuliah masuk rapor setelah dosen pembimbing proyek blok menginputnya.',
      siapa: 'dosen pembimbing proyek blok',
      aksi: { href: 'nilai.html', label: 'Lihat Nilai Proyek' },
    })}
    ${(r.rumpun_diakui_rpl || []).length ? `<div class="kartu"><h3>Diakui lewat ${istilah('rpl', 'RPL')}</h3><p>${r.rumpun_diakui_rpl.map(esc).join(', ')}</p><p class="redup">Tanpa nilai angka; tidak masuk IP maupun IPK.</p></div>` : ''}
    ${tak.length ? `<div class="kartu"><h3>Nilai Tidak Terpetakan</h3>
      <div class="gulir"><table><tr><th>Kode</th><th class="num">Nilai</th><th>Huruf</th></tr>
      ${tak.map(n => `<tr><td>${esc(n.kode_mk)}</td><td class="num">${angka(n.nilai_akhir)}</td><td>${lencanaHuruf(n.huruf)}</td></tr>`).join('')}</table></div></div>` : ''}
    ${(r.catatan || []).length ? `<div class="kartu"><h3>Catatan</h3><ul>${r.catatan.map(c => `<li class="redup">${esc(c)}</li>`).join('')}</ul></div>` : ''}`;
}

function htmlRekap(r) {
  const mk = r.mata_kuliah || [];
  return `
    <div class="kartu">
      <h3>Rekap Nilai ${esc(r.prodi_kode.toUpperCase())} · Angkatan ${esc(r.angkatan)} · Semester ${esc(r.semester)}</h3>
      <p class="meta">${esc(r.mahasiswa.length)} mahasiswa · ${esc(mk.length)} mata kuliah · disusun ${esc(new Date().toLocaleDateString('id-ID', TANGGAL))}</p>
      ${tabelSkala(r.skala)}
      <div class="gulir"><table>
        <tr><th>NIM</th><th>Nama</th>${mk.map(m => `<th title="${escAttr(m.nama)}">${esc(m.kode)}<br><span class="redup">${esc(m.sks)} SKS</span></th>`).join('')}<th class="num">SKS dinilai</th><th class="num">SKS lulus</th><th class="num">IP</th><th class="num">Belum dinilai</th></tr>
        ${r.mahasiswa.map(b => `<tr>
          <td><a href="?nim=${encodeURIComponent(b.nim)}">${esc(b.nim)}</a></td>
          <td>${esc(b.nama)}</td>
          ${mk.map(m => `<td>${b.nilai[m.kode] ? lencanaHuruf(b.nilai[m.kode]) : '<span class="redup">–</span>'}</td>`).join('')}
          <td class="num">${esc(b.sks_dinilai)}</td><td class="num">${esc(b.sks_lulus)}</td>
          <td class="num">${b.sks_dinilai ? dua(b.ip) : '–'}</td><td class="num">${esc(b.belum_dinilai)}</td></tr>`).join('')}
      </table></div>
      <p class="redup">"–" berarti belum dinilai, bukan E. IP dihitung dari mata kuliah yang sudah dinilai.</p>
    </div>`;
}

function tombolCetak() {
  return '<p class="tidak-cetak"><button class="sekunder" id="cetak">Cetak / Simpan PDF</button></p>';
}

async function tampilRapor(nim) {
  const wadah = document.getElementById('hasil');
  wadah.innerHTML = '<p class="redup">Menyusun rapor…</p>';
  try {
    const r = await apiGet(`/api/rapor/${encodeURIComponent(nim)}`, { auth: true });
    wadah.innerHTML = tombolCetak() + htmlRapor(r);
    document.getElementById('cetak').addEventListener('click', () => window.print());
  } catch (err) {
    wadah.innerHTML = pesanGagal(err);
  }
}

async function tampilRekap(prodi, angkatan, semester) {
  const wadah = document.getElementById('hasil');
  wadah.innerHTML = '<p class="redup">Menyusun rekap…</p>';
  try {
    const r = await apiGet(`/api/rapor/prodi/${encodeURIComponent(prodi)}/${encodeURIComponent(angkatan)}/${encodeURIComponent(semester)}`, { auth: true });
    wadah.innerHTML = tombolCetak() + htmlRekap(r);
    document.getElementById('cetak').addEventListener('click', () => window.print());
  } catch (err) {
    wadah.innerHTML = pesanGagal(err);
  }
}

// Rekap nilai satu angkatan adalah laporan tingkat prodi: hanya untuk kaprodi
// (prodinya) dan admin. Dosen biasa tetap bisa membuka rapor per NIM.
let sayaAktif = null;

function formDosen(prodi, nimAwal, bolehRekap) {
  return `
    <div class="kartu tidak-cetak">
      <h3>Rapor Mahasiswa</h3>
      <form id="form-nim">
        <label>NIM <input name="nim" required maxlength="30" list="daftar-nim" autocomplete="off" placeholder="Ketik NIM atau nama" value="${escAttr(nimAwal || '')}"></label>
        <datalist id="daftar-nim"></datalist>
        <p class="meta" id="keterangan-nim">Daftar pilihan diambil dari roster${prodiBawaan(sayaAktif) ? ` ${esc(prodiBawaan(sayaAktif).toUpperCase())}` : ''}.</p>
        <button>Tampilkan Rapor</button>
      </form>
    </div>
    ${bolehRekap ? `<div class="kartu tidak-cetak">
      <h3>Rekap Nilai Semester</h3>
      <p class="meta">Satu baris per mahasiswa di roster, kolomnya mata kuliah semester itu.</p>
      <form id="form-rekap">
        <label>Prodi <select name="prodi">${prodi.map(p => `<option value="${escAttr(p.kode)}">${esc(p.nama)}</option>`).join('')}</select></label>
        <label>Angkatan <input name="angkatan" required maxlength="9" placeholder="2026"></label>
        <label>Semester <select name="semester">${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">${s}</option>`).join('')}</select></label>
        <button>Tampilkan Rekap</button>
      </form>
    </div>` : '<p class="meta tidak-cetak">Rekap nilai satu angkatan adalah laporan prodi untuk kaprodi dan admin.</p>'}
    <div id="hasil"></div>`;
}

// Pilihan NIM dari roster prodi bawaan (admin: semua prodi) — bantuan isian
// saja; NIM tetap boleh diketik langsung. Gagal memuat tidak menghalangi.
async function isiDaftarNim() {
  const daftar = document.getElementById('daftar-nim');
  try {
    const prodi = prodiBawaan(sayaAktif);
    const { mahasiswa = [] } = await apiGet(`/api/mahasiswa${prodi ? `?prodi=${encodeURIComponent(prodi)}` : ''}`, { auth: true });
    daftar.innerHTML = mahasiswa.map(m => `<option value="${escAttr(m.nim)}">${esc(m.nama)} · ${esc(String(m.prodi_kode || '').toUpperCase())} ${esc(m.angkatan)}</option>`).join('');
  } catch {
    document.getElementById('keterangan-nim').textContent = 'Daftar roster tidak bisa dimuat; ketik NIM langsung.';
  }
}

async function muat(saya) {
  sayaAktif = saya;
  const nimQuery = new URLSearchParams(location.search).get('nim');

  if (saya.peran === 'dosen') {
    const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
    // Kaprodi: hanya prodi yang dipimpin; admin: semua prodi.
    const boleh = prodiPimpinan(saya);
    isi.innerHTML = formDosen(boleh ? prodi.filter(p => boleh.includes(p.kode)) : prodi, nimQuery, adalahPimpinan(saya));
    isiDaftarNim();
    document.getElementById('form-nim').addEventListener('submit', e => {
      e.preventDefault();
      const nim = new FormData(e.target).get('nim').trim();
      history.replaceState(null, '', `?nim=${encodeURIComponent(nim)}`);
      tampilRapor(nim);
    });
    const formRekap = document.getElementById('form-rekap');
    if (formRekap) {
      pilihProdiBawaan(formRekap.querySelector('select[name="prodi"]'), saya);
      formRekap.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        history.replaceState(null, '', 'rapor.html');
        tampilRekap(fd.get('prodi'), fd.get('angkatan').trim(), fd.get('semester'));
      });
    }
    if (nimQuery) await tampilRapor(nimQuery);
    return;
  }

  if (!saya.nim) {
    isi.innerHTML = keadaanKosong({
      judul: 'Nomor ini belum tercatat di roster mahasiswa',
      keterangan: 'Rapor disusun dari NIM Anda di roster, jadi NIM dan nomor WhatsApp Anda perlu didaftarkan dulu.',
      siapa: 'dosen atau kaprodi prodi Anda (halaman Roster Mahasiswa)',
      aksi: { href: 'saya.html', label: 'Kembali ke Beranda Saya' },
    });
    return;
  }
  // Mahasiswa selalu melihat rapornya sendiri; ?nim= diabaikan.
  isi.innerHTML = '<div id="hasil"></div>';
  await tampilRapor(saya.nim);
}

async function mulai() {
  const saya = await sayaHalaman(isi);
  if (saya === undefined) return;
  if (!saya) {
    isi.innerHTML = keadaanKosong({ judul: 'Sesi login Anda sudah berakhir', keterangan: 'Tekan Masuk lagi di pojok kanan atas untuk membuka rapor.' });
    return;
  }
  try {
    await muat(saya);
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
