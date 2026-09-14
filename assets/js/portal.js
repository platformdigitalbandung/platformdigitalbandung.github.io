import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong } from './ui.js';

// Daftar tugas. Mahasiswa melihat status pengumpulannya sendiri per tugas
// (sudah_kirim/kirim_terakhir, dicocokkan backend lewat NIM roster pada token);
// dosen melihat jumlah kiriman dan tautan ke laporan kemiripan. ID tugas tidak
// ditampilkan — cukup ada di tautan.

const isi = document.getElementById('isi');

function waktuKirim(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

function statusKirim(t) {
  if (t.sudah_kirim === undefined) return '';
  return t.sudah_kirim
    ? `<span class="lencana rendah">Sudah dikumpulkan${t.kirim_terakhir ? ` ${esc(waktuKirim(t.kirim_terakhir))}` : ''}</span>`
    : '<span class="lencana sedang">Belum dikumpulkan</span>';
}

function kartuTugas(t, dosen) {
  const href = `tugas.html?id=${encodeURIComponent(t.id)}`;
  return `
    <div class="kartu kartu-tugas">
      <div class="tugas-kepala">
        <h3>${esc(t.judul)}</h3>
        ${dosen ? `<span class="meta">${esc(t.n_kiriman)} kiriman</span>` : statusKirim(t)}
      </div>
      ${t.deskripsi ? `<p class="meta tugas-deskripsi">${esc(t.deskripsi)}</p>` : ''}
      <p class="cta-row">${dosen
        ? '<a class="aksi sekunder" href="dosen.html">Laporan Kemiripan</a>'
        : `<a class="aksi${t.sudah_kirim ? ' sekunder' : ''}" href="${esc(href)}">${t.sudah_kirim ? 'Kirim Ulang Jawaban' : 'Kumpulkan Jawaban'}</a>`}</p>
    </div>`;
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else try {
  const [{ tugas = [] }, saya] = await Promise.all([apiGet('/api/tugas'), sayaSekarang]);
  // Pengumpulan khusus mahasiswa di roster (backend menolak yang lain), jadi
  // dosen tidak ditawari tombol Kumpulkan Jawaban — cukup ke laporan kemiripan.
  const dosen = Boolean(saya && saya.peran === 'dosen');
  if (!tugas.length) {
    isi.innerHTML = dosen
      ? keadaanKosong({
        judul: 'Belum ada tugas',
        keterangan: 'Tugas yang Anda buat tampil di sini, lengkap dengan jumlah kiriman mahasiswa.',
        aksi: { href: 'dosen.html', label: 'Buat Tugas' },
      })
      : keadaanKosong({
        judul: 'Belum ada tugas',
        keterangan: 'Tugas muncul di sini setelah dosen membuatnya. Status "sudah dikumpulkan" tampil per tugas setelah Anda mengirim jawaban.',
        siapa: 'dosen pengampu',
        aksi: { href: 'materi.html', label: 'Buka materi minggu ini' },
      });
  } else {
    const belum = dosen ? 0 : tugas.filter(t => t.sudah_kirim === false).length;
    const ringkas = dosen ? '' : `<p class="redup ringkas-tugas">${tugas.length} tugas · ${belum ? `${belum} belum dikumpulkan` : 'semua sudah dikumpulkan'}</p>`;
    isi.innerHTML = ringkas + tugas.map(t => kartuTugas(t, dosen)).join('');
  }
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">Daftar tugas tidak bisa dimuat: ${esc(err.message)}</div>`;
}
