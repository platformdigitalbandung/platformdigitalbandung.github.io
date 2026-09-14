import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, peranAktif } from './akun.js';
import { esc, keadaanKosong, prodiBawaan } from './ui.js';

// Daftar tugas. Mahasiswa melihat status pengumpulannya sendiri per tugas
// (sudah_kirim/kirim_terakhir, dicocokkan backend lewat NIM roster pada token);
// dosen melihat jumlah kiriman dan tautan ke laporan kemiripan. ID tugas tidak
// ditampilkan — cukup ada di tautan.

const isi = document.getElementById('isi');

// Tugas milik satu prodi (sejak 2026-09-15). Mahasiswa hanya menerima tugas
// prodinya dari backend; staf melihat semua tugas beserta labelnya.
const labelProdi = (kode) => kode ? String(kode).toUpperCase() : 'tanpa prodi';

// Pengantar halaman sesuai peran aktif: kalimat statis di HTML ditulis untuk
// mahasiswa, padahal dosen, kaprodi, dan admin juga membuka halaman ini.
function tulisPengantar(saya) {
  const p = document.querySelector('.kepala-halaman p:not(.remah)');
  if (!p || !saya) return;
  const peran = peranAktif(saya);
  if (peran === 'dosen' || peran === 'kaprodi') {
    p.innerHTML = 'Daftar tugas semua prodi — buat tugas baru di <a href="dosen.html">Buat Tugas &amp; Laporan Kemiripan</a>';
  } else if (peran === 'admin') {
    p.textContent = 'Ringkasan tugas semua prodi beserta jumlah kiriman (hanya baca)';
  } else {
    p.textContent = 'Kumpulkan jawaban dan lihat tugas prodi Anda yang sudah atau belum dikirim';
  }
}

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

function kartuTugas(t, dosen, admin) {
  const href = `tugas.html?id=${encodeURIComponent(t.id)}`;
  return `
    <div class="kartu kartu-tugas">
      <div class="tugas-kepala">
        <h3>${esc(t.judul)}</h3>
        ${dosen ? `<span class="meta">${esc(labelProdi(t.prodi_kode))} · ${esc(t.n_kiriman)} kiriman</span>` : statusKirim(t)}
      </div>
      ${t.deskripsi ? `<p class="meta tugas-deskripsi">${esc(t.deskripsi)}</p>` : ''}
      <p class="cta-row">${dosen
        ? (admin ? '' : `<a class="aksi sekunder" href="dosen.html?laporan=${encodeURIComponent(t.id)}">Laporan Kemiripan</a>`)
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
  const admin = Boolean(saya && peranAktif(saya) === 'admin');
  tulisPengantar(saya);
  if (!tugas.length) {
    isi.innerHTML = dosen
      ? keadaanKosong({
        judul: 'Belum ada tugas',
        keterangan: 'Tugas yang dibuat dosen tampil di sini, lengkap dengan prodi dan jumlah kiriman mahasiswa.',
        aksi: admin ? null : { href: 'dosen.html', label: 'Buat Tugas' },
      })
      : keadaanKosong({
        judul: 'Belum ada tugas',
        keterangan: `Tugas prodi ${labelProdi(prodiBawaan(saya))} muncul di sini setelah dosen membuatnya. Status "sudah dikumpulkan" tampil per tugas setelah Anda mengirim jawaban.`,
        siapa: 'dosen pengampu',
        aksi: { href: 'materi.html', label: 'Buka materi minggu ini' },
      });
  } else {
    const belum = dosen ? 0 : tugas.filter(t => t.sudah_kirim === false).length;
    const ringkas = dosen ? '' : `<p class="redup ringkas-tugas">${tugas.length} tugas · ${belum ? `${belum} belum dikumpulkan` : 'semua sudah dikumpulkan'}</p>`;
    isi.innerHTML = ringkas + tugas.map(t => kartuTugas(t, dosen, admin)).join('');
  }
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">Daftar tugas tidak bisa dimuat: ${esc(err.message)}</div>`;
}
