import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { adalahPimpinan, prodiPimpinan } from './akun.js';

// Laporan Kepatuhan per Mata Kuliah untuk akreditasi. Khusus dosen/admin —
// kewenangannya dicek backend (403). Ekspornya halaman ini sendiri: tombol
// cetak memakai dialog cetak peramban (simpan sebagai PDF), tanpa berkas di
// server — keputusan pemilik produk 2026-09-13.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function angka(n) { return typeof n === 'number' ? n.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '–'; }

const TANGGAL = { day: 'numeric', month: 'long', year: 'numeric' };

function formPilih(kalender) {
  const opsi = kalender.map(k => {
    const nilai = `${k.prodi_kode}|${k.angkatan}|${k.semester}`;
    return `<option value="${escAttr(nilai)}">${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)}</option>`;
  }).join('');
  return `
    <div class="kartu tidak-cetak">
      <h3>Pilih Kalender Semester</h3>
      <p class="meta">Hanya kalender yang sudah diterbitkan yang bisa dilaporkan: yang dilampirkan ke borang harus jadwal resmi yang dilihat mahasiswa.</p>
      <form id="form-laporan">
        <label>Kalender terbit <select name="kalender" required>${opsi}</select></label>
        <div class="cta-row">
          <button>Tampilkan Laporan</button>
          <button type="button" class="sekunder" id="cetak" hidden>Cetak / Simpan PDF</button>
        </div>
      </form>
    </div>`;
}

function barisMenit(m) {
  return `<td class="num">${angka(m.asinkron)}</td><td class="num">${angka(m.daring_sinkron)}</td>
    <td class="num">${angka(m.opsional_luring_daring)}</td>${m.lain ? `<td class="num">${angka(m.lain)}</td>` : ''}
    <td class="num"><b>${angka(m.total)}</b></td>`;
}

function kepalaMenit(adaLain) {
  return `<th class="num">Asinkron</th><th class="num">Daring sinkron</th><th class="num">Opsional luring/daring</th>${adaLain ? '<th class="num">Lain</th>' : ''}<th class="num">Total</th>`;
}

function tabelMataKuliah(lap) {
  if (!lap.mata_kuliah.length) return '<p class="redup">Tidak ada mata kuliah.</p>';
  return `<div class="gulir"><table>
    <tr><th>Mata kuliah</th><th>Rumpun</th><th class="num">SKS</th><th class="num">Menit/minggu</th><th class="num">Target</th><th class="num">Capaian</th><th>Status</th><th class="num">Dinilai</th><th class="num">Lulus</th><th>CPL</th></tr>
    ${lap.mata_kuliah.map(m => `<tr>
      <td><button type="button" class="lintas" data-kode="${escAttr(m.kode)}" title="Rekap lintas angkatan">${esc(m.nama)}</button><br><span class="redup">${esc(m.kode)}</span></td>
      <td>${esc(m.rumpun_kode)}</td>
      <td class="num">${esc(m.sks)}</td>
      <td class="num">${angka(m.menit_per_minggu)}</td>
      <td class="num">${angka(m.target_menit_per_minggu)}</td>
      <td class="num">${angka(m.persen_target)}%</td>
      <td>${m.memenuhi ? '<span class="lencana rendah">memenuhi</span>' : '<span class="lencana tinggi">belum memenuhi</span>'}</td>
      <td class="num">${esc(m.jumlah_dinilai)}</td>
      <td class="num">${esc(m.jumlah_lulus)}</td>
      <td>${(m.cpl || []).map(esc).join(', ') || '<span class="redup">–</span>'}</td></tr>`).join('')}
  </table></div>`;
}

function tabelMenitMataKuliah(lap) {
  const adaLain = lap.mata_kuliah.some(m => m.menit.lain);
  return `<div class="gulir"><table>
    <tr><th>Mata kuliah</th>${kepalaMenit(adaLain)}<th class="num">Minggu aktif</th></tr>
    ${lap.mata_kuliah.map(m => `<tr><td>${esc(m.kode)}</td>${barisMenit(m.menit)}<td class="num">${esc(m.minggu_aktif)}</td></tr>`).join('')}
  </table></div>`;
}

function tabelMingguan(lap) {
  const adaLain = lap.per_minggu.some(w => w.menit.lain);
  return `<div class="gulir"><table>
    <tr><th class="num">Minggu</th><th>Mulai</th>${kepalaMenit(adaLain)}</tr>
    ${lap.per_minggu.map(w => `<tr><td class="num">${esc(w.minggu)}</td><td>${esc(w.tanggal_mulai)}</td>${barisMenit(w.menit)}</tr>`).join('')}
    <tr><td></td><td><b>Semester</b></td>${barisMenit(lap.menit)}</tr>
  </table></div>`;
}

function laporanHtml(lap) {
  const rataMinggu = lap.jumlah_minggu ? lap.menit.total / lap.jumlah_minggu : 0;
  return `
    <div class="kartu">
      <h3>Laporan Kepatuhan ${esc(lap.prodi_kode.toUpperCase())} · Angkatan ${esc(lap.angkatan)} · Semester ${esc(lap.semester)}</h3>
      <p class="meta">Disusun ${esc(new Date().toLocaleDateString('id-ID', TANGGAL))} dari kalender terbit <span class="redup">${esc(lap.kalender_id)}</span> · ${esc(lap.jumlah_minggu)} minggu</p>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(lap.jumlah_memenuhi)} / ${esc(lap.mata_kuliah.length)}</span><span class="label">mata kuliah memenuhi target terjadwal</span></div>
        <div class="stat"><span class="angka">${esc(lap.total_sks)}</span><span class="label">SKS semester ini${lap.kapasitas_sks ? ` · kapasitas ${angka(lap.kapasitas_sks)}` : ''}</span></div>
        <div class="stat"><span class="angka">${angka(rataMinggu)}</span><span class="label">menit terjadwal rata-rata per minggu</span></div>
      </div>
      <p class="meta">Target tiap mata kuliah = SKS × ${esc(lap.menit_per_sks_terjadwal)} menit terjadwal-terbukti per minggu (dari ${esc(lap.menit_per_sks_sndikti)} menit SN-Dikti; sisanya belajar mandiri yang diasumsikan).</p>
      ${lap.cpl_terdaftar ? '' : '<div class="pesan gagal">Prodi ini belum punya capaian pembelajaran (CPL) terdaftar. Kolom CPL kosong karena datanya belum ada.</div>'}

      <h4>Kepatuhan per mata kuliah</h4>
      ${tabelMataKuliah(lap)}
      <div id="rekap-lintas"></div>

      <h4>Menit per moda per mata kuliah (semester)</h4>
      ${tabelMenitMataKuliah(lap)}

      <h4>Menit per minggu</h4>
      ${tabelMingguan(lap)}

      ${lap.catatan.length ? `<h4>Catatan metode</h4><ul>${lap.catatan.map(c => `<li class="redup">${esc(c)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function rekapHtml(r) {
  if (!r.per_angkatan.length) return `<p class="redup">Belum ada angkatan dengan kalender terbit untuk ${esc(r.kode)}.</p>`;
  return `
    <h4>Lintas angkatan: ${esc(r.nama)} (${esc(r.sks)} SKS, semester ${esc(r.semester)})</h4>
    <div class="gulir"><table>
      <tr><th>Angkatan</th><th class="num">Minggu</th><th class="num">Menit/minggu</th><th class="num">Target</th><th class="num">Capaian</th><th>Status</th><th class="num">Dinilai</th><th class="num">Lulus</th></tr>
      ${r.per_angkatan.map(a => `<tr><td>${esc(a.angkatan)}</td><td class="num">${esc(a.jumlah_minggu)}</td>
        <td class="num">${angka(a.baris.menit_per_minggu)}</td><td class="num">${angka(a.baris.target_menit_per_minggu)}</td>
        <td class="num">${angka(a.baris.persen_target)}%</td>
        <td>${a.baris.memenuhi ? '<span class="lencana rendah">memenuhi</span>' : '<span class="lencana tinggi">belum memenuhi</span>'}</td>
        <td class="num">${esc(a.baris.jumlah_dinilai)}</td><td class="num">${esc(a.baris.jumlah_lulus)}</td></tr>`).join('')}
    </table></div>`;
}

let laporanAktif = null;

function pesanGagal(err) {
  // 422 = data belum lengkap (keadaan wajar), selain itu kegagalan.
  const kelas = err && err.status === 422 ? 'kosong' : 'pesan gagal';
  return `<div class="${kelas}">${esc(err ? err.message : 'Gagal memuat.')}</div>`;
}

async function tampilLaporan(nilai) {
  const [prodi, angkatan, semester] = nilai.split('|');
  const wadah = document.getElementById('laporan');
  const tombolCetak = document.getElementById('cetak');
  tombolCetak.hidden = true;
  wadah.innerHTML = '<p class="redup">Menyusun laporan…</p>';
  try {
    laporanAktif = await apiGet(`/api/kepatuhan/prodi/${encodeURIComponent(prodi)}/${encodeURIComponent(angkatan)}/${encodeURIComponent(semester)}`, { auth: true });
    wadah.innerHTML = laporanHtml(laporanAktif);
    tombolCetak.hidden = false;
    history.replaceState(null, '', `?k=${encodeURIComponent(nilai)}`);
  } catch (err) {
    laporanAktif = null;
    wadah.innerHTML = pesanGagal(err);
  }
}

async function tampilRekap(kode) {
  if (!laporanAktif) return;
  const wadah = document.getElementById('rekap-lintas');
  wadah.innerHTML = '<p class="redup">Memuat rekap lintas angkatan…</p>';
  try {
    const r = await apiGet(`/api/kepatuhan/matakuliah/${encodeURIComponent(laporanAktif.prodi_kode)}/${encodeURIComponent(kode)}`, { auth: true });
    wadah.innerHTML = rekapHtml(r);
  } catch (err) {
    wadah.innerHTML = pesanGagal(err);
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (!adalahPimpinan(saya)) {
    isi.innerHTML = '<div class="kosong">Laporan kepatuhan hanya untuk kaprodi, untuk prodinya sendiri. Kaprodi yang sedang memakai peran dosen: pilih peran kaprodi di pojok kanan atas.</div>';
    return;
  }
  const boleh = prodiPimpinan(saya);
  const { kalender: semuaKalender = [] } = await apiGet('/api/kalender');
  const kalender = boleh ? semuaKalender.filter(k => boleh.includes(k.prodi_kode)) : semuaKalender;
  if (!kalender.length) {
    isi.innerHTML = '<div class="kosong">Belum ada kalender semester yang diterbitkan, jadi belum ada yang bisa dilaporkan. Terbitkan kalender di halaman <a href="kalender.html">Kalender</a>.</div>';
    return;
  }
  isi.innerHTML = formPilih(kalender) + '<div id="laporan"></div>';

  const form = document.getElementById('form-laporan');
  const pilih = form.querySelector('select');
  const awal = new URLSearchParams(location.search).get('k');
  if (awal && [...pilih.options].some(o => o.value === awal)) pilih.value = awal;

  form.addEventListener('submit', e => { e.preventDefault(); tampilLaporan(pilih.value); });
  document.getElementById('cetak').addEventListener('click', () => window.print());
  document.getElementById('laporan').addEventListener('click', e => {
    const b = e.target.closest('button.lintas');
    if (b) tampilRekap(b.dataset.kode);
  });
  if (awal) await tampilLaporan(pilih.value);
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
