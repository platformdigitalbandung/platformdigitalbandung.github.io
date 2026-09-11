import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';

// Nilai Proyek Saya (mahasiswa). Kepemilikan NIM dibuktikan backend lewat nomor
// WhatsApp di token: /api/proyekblok/saya memberi NIM pemilik nomor, dan
// /api/mahasiswa/:nim/nilai menolak NIM milik orang lain.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function angka(n) { return typeof n === 'number' ? n.toFixed(2) : '–'; }
function lulus(n) { return n >= 60 ? '<span class="lencana rendah">lulus</span>' : '<span class="lencana tinggi">belum lulus</span>'; }

function tabelNilai(baris) {
  if (!baris.length) return '<p class="redup">Belum ada nilai yang diinput dosen untuk proyek ini.</p>';
  return `<div class="gulir"><table>
      <tr><th>Mata kuliah</th><th class="num">Hasil proyek</th><th class="num">Ujian</th>
        <th class="num">Kuis</th><th class="num">Presentasi</th><th class="num">Nilai akhir</th><th>Status</th></tr>
      ${baris.map(n => `<tr>
        <td>${esc(n.kode_mk)}</td>
        <td class="num">${angka(n.komponen?.hasil_proyek)}</td>
        <td class="num">${angka(n.komponen?.ujian)}</td>
        <td class="num">${angka(n.komponen?.kuis)}</td>
        <td class="num">${angka(n.komponen?.presentasi)}</td>
        <td class="num">${angka(n.nilai_akhir)}</td>
        <td>${lulus(n.nilai_akhir)}</td></tr>`).join('')}
    </table></div>`;
}

function tampil(saya, nilai, rekap) {
  const proyek = saya.proyekblok || [];
  const rata = rekap && rekap.length ? rekap[0].rata_rata : null;
  isi.innerHTML = `
    <p class="redup">NIM ${esc(saya.nim)} · ${proyek.length} proyek blok diikuti${rata !== null ? ` · rata-rata ${angka(rata)}` : ''}</p>
    ${proyek.map(p => `
      <div class="kartu">
        <h3>${esc(p.judul)}</h3>
        <p class="meta">Rumpun ${esc(p.rumpun_kode)} · prodi ${esc(p.prodi_kode)} · angkatan ${esc(p.angkatan)} · ${esc(p.status)}</p>
        ${tabelNilai(nilai.filter(n => n.proyek_blok_id === p.id))}
      </div>`).join('')}`;
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    const saya = await apiGet('/api/proyekblok/saya', { auth: true });
    if (saya.peran === 'dosen') {
      isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk mahasiswa</h3>
        <p class="meta">Nomor ini terdaftar sebagai dosen. Nilai proyek yang Anda bimbing ada di halaman Kelola Proyek Blok.</p>
        <a class="aksi" href="proyek.html">Kelola Proyek Blok</a></div>`;
    } else if (!saya.nim) {
      isi.innerHTML = '<div class="kosong">Nomor ini belum tercatat sebagai anggota proyek blok mana pun. Hubungi dosen pembimbing agar NIM dan nomor WhatsApp Anda didaftarkan sebagai anggota proyek.</div>';
    } else {
      const hasil = await apiGet(`/api/mahasiswa/${encodeURIComponent(saya.nim)}/nilai`, { auth: true });
      tampil(saya, hasil.nilai || [], hasil.rekap || []);
    }
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
