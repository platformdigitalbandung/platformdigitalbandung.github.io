// Pembaca PDF untuk materi berkas (dipakai halaman mahasiswa) dan penghitung
// halaman untuk halaman dosen.
//
// pdf.js dimuat DINAMIS dari CDN di dalam modul ini — bukan lewat <script> di
// HTML — mengikuti pola muatAPIYouTube() di materi.js: halaman yang tidak punya
// materi berkas tidak ikut mengunduh pustakanya, dan konvensi crootjs melarang
// <script> tambahan di HTML.
//
// Versinya DIPATOK (bukan @latest, sama seperti impor crootjs): 3.11.174 adalah
// rilis pdf.js terakhir yang menyediakan build UMD (pdf.min.js + worker senama)
// di cdnjs; rilis 4.x ke atas hanya mengirim .mjs. Worker-nya wajib versi yang
// sama dengan pustakanya, atau pdf.js menolak memuat dokumen.
const PDFJS_VERSI = '3.11.174';
const PDFJS_DASAR = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSI}`;
const PESAN_GAGAL_MUAT = 'Pembaca PDF tidak bisa dimuat, berkas ini tidak bisa ditampilkan.';

let apiPDF = null;
function muatPDFJS() {
  if (apiPDF) return apiPDF;
  apiPDF = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement('script');
    s.src = `${PDFJS_DASAR}/pdf.min.js`;
    s.onload = () => {
      if (!window.pdfjsLib) { reject(new Error(PESAN_GAGAL_MUAT)); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_DASAR}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error(PESAN_GAGAL_MUAT));
    document.head.appendChild(s);
  });
  return apiPDF;
}

// Isi berkas datang sebagai base64 di dalam JSON (repo storage-nya privat, jadi
// peramban tidak bisa mengambilnya langsung dari GitHub), sedangkan pdf.js minta
// byte mentah.
function dariBase64(b64) {
  const biner = atob(b64 || '');
  const buf = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i += 1) buf[i] = biner.charCodeAt(i);
  return buf;
}

/**
 * Menghitung jumlah halaman sebuah PDF di peramban. Dipakai halaman dosen:
 * penyebut progres mahasiswa ditetapkan saat mengunggah, bukan ditebak peramban
 * mahasiswa.
 * @param {ArrayBuffer|Uint8Array} data isi berkas PDF.
 * @returns {Promise<number>} jumlah halaman.
 */
export async function hitungHalaman(data) {
  const pdfjsLib = await muatPDFJS();
  const dok = await pdfjsLib.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise;
  const jumlah = dok.numPages;
  await dok.destroy();
  return jumlah;
}

/**
 * Menampilkan PDF di dalam `wadah`: satu halaman sekali tampil, dengan tombol
 * Sebelumnya/Berikutnya dan penunjuk "Halaman n dari m". Seluruh elemennya
 * dibuat dari JS (konvensi crootjs: tanpa markup inline, tanpa atribut onclick).
 *
 * @param {HTMLElement} wadah  elemen yang isinya akan diganti.
 * @param {object} opsi
 * @param {string} opsi.base64 isi berkas PDF dalam base64.
 * @param {number} [opsi.halaman] jumlah halaman menurut catatan dosen; hanya
 *                 dipakai kalau dokumennya sendiri tidak bisa ditanya.
 * @param {function} [opsi.onHalaman] dipanggil tiap halaman berpindah, termasuk
 *                 halaman pertama, dengan nomor halamannya.
 * @returns {Promise<{total: number, berhenti: function(): void}>}
 */
export async function pasangPDF(wadah, { base64, halaman, onHalaman } = {}) {
  let pdfjsLib;
  try {
    pdfjsLib = await muatPDFJS();
  } catch (err) {
    // Gagal memuat pustakanya tidak boleh berakhir dengan wadah kosong tanpa
    // keterangan — mahasiswa harus tahu kenapa berkasnya tidak muncul.
    wadah.textContent = '';
    const p = document.createElement('p');
    p.className = 'pesan gagal';
    p.textContent = err.message || PESAN_GAGAL_MUAT;
    wadah.appendChild(p);
    throw err;
  }

  const dok = await pdfjsLib.getDocument({ data: dariBase64(base64) }).promise;
  const total = dok.numPages || Number(halaman) || 1;

  wadah.textContent = '';
  const kanvas = document.createElement('canvas');
  kanvas.className = 'pdf-kanvas';
  // Lebar tampilan diatur CSS (.pdf-kanvas { width: 100% }), jadi tidak ada
  // atribut style di sini; width/height kanvas adalah ukuran bitmapnya.
  const nav = document.createElement('div');
  nav.className = 'pdf-nav';
  const tSebelum = document.createElement('button');
  tSebelum.type = 'button';
  tSebelum.className = 'sekunder';
  tSebelum.textContent = 'Sebelumnya';
  const tBerikut = document.createElement('button');
  tBerikut.type = 'button';
  tBerikut.className = 'sekunder';
  tBerikut.textContent = 'Berikutnya';
  const penunjuk = document.createElement('span');
  penunjuk.className = 'redup';
  nav.append(tSebelum, penunjuk, tBerikut);
  wadah.append(kanvas, nav);

  let kini = 0;       // halaman yang benar-benar sedang tampil
  let diminta = 0;    // halaman terakhir yang diminta, termasuk yang masih dirender
  let tugas = null;   // RenderTask pdf.js yang sedang berjalan
  let dibuang = false;

  async function tampilkan(n) {
    const nomor = Math.min(Math.max(1, Math.floor(n)), total);
    // Tombol dikunci menurut halaman yang DIMINTA, bukan yang sudah selesai
    // dirender, supaya dua klik beruntun tetap melangkah dua halaman.
    diminta = nomor;
    tSebelum.disabled = nomor <= 1;
    tBerikut.disabled = nomor >= total;
    const hal = await dok.getPage(nomor);
    // Bitmap dirender selebar wadahnya dikali kerapatan layar supaya tetap tajam
    // di HP; CSS yang menyusutkannya kembali ke lebar wadah (terbaca di 360px).
    const dasar = hal.getViewport({ scale: 1 });
    const lebar = wadah.clientWidth || 360;
    const kerapatan = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = hal.getViewport({ scale: (lebar * kerapatan) / dasar.width });
    // Render lama dibatalkan SEBELUM kanvasnya dipakai lagi: pdf.js menolak dua
    // render sekaligus di satu kanvas.
    if (tugas) { tugas.cancel(); tugas = null; }
    kanvas.width = Math.floor(viewport.width);
    kanvas.height = Math.floor(viewport.height);
    const tugasKini = hal.render({ canvasContext: kanvas.getContext('2d'), viewport });
    tugas = tugasKini;
    try {
      await tugasKini.promise;
    } catch (err) {
      // Pembatalan terjadi setiap kali halaman diganti sebelum render selesai.
      if (err && err.name === 'RenderingCancelledException') return;
      throw err;
    } finally {
      if (tugas === tugasKini) tugas = null;
    }
    if (dibuang) return;
    kini = nomor;
    penunjuk.textContent = `Halaman ${nomor} dari ${total}`;
    if (typeof onHalaman === 'function') onHalaman(nomor);
  }

  function pindah(delta) {
    const tujuan = (diminta || kini) + delta;
    if (tujuan < 1 || tujuan > total) return;
    tampilkan(tujuan).catch(() => { penunjuk.textContent = 'Halaman ini gagal ditampilkan.'; });
  }
  tSebelum.addEventListener('click', () => pindah(-1));
  tBerikut.addEventListener('click', () => pindah(1));

  await tampilkan(1);

  return {
    total,
    berhenti() {
      dibuang = true;
      if (tugas) { tugas.cancel(); tugas = null; }
      dok.destroy().catch(() => { /* dokumen memang sedang dibuang */ });
    },
  };
}
