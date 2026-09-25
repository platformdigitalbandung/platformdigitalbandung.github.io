// Halaman yang dipensiunkan saat alur LMS berbasis kelas dirapikan (keputusan
// developer Arfan 2026-09-26) tinggal mengalihkan tautan lama dan bookmark.
// Tujuan dibaca dari <meta name="alih" content="...">. Tautan lama laporan
// kemiripan dari bot (dosen.html?laporan=<id>) diarahkan ke halaman tugasnya.
const laporan = new URLSearchParams(location.search).get('laporan');
const meta = document.querySelector('meta[name="alih"]');
if (laporan && /^[0-9a-f]{24}$/i.test(laporan)) {
  location.replace(`tugas.html?id=${laporan}#kemiripan`);
} else {
  location.replace((meta && meta.getAttribute('content')) || './');
}
