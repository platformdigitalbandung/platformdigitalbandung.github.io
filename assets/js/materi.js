import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { buatPelacak } from './pelacak.js';
import { pasangPDF } from './pdfmateri.js';

// Materi Pekan Ini (mahasiswa). Progres dikirim ke POST /api/progresmateri;
// server yang memutuskan: NIM dari roster lewat token, materi harus milik
// prodi/rumpun/minggu mahasiswa, dan persen yang tersimpan tidak pernah turun.
// Halaman ini hanya melaporkan apa yang terjadi di pemutar, di wadah bacaan,
// dan di pembaca PDF.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Batas kirim: event dari pemutar datang terus-menerus, tapi server hanya
// menyimpan nilai terbesar — mengirim tiap detik cuma membebani backend.
const LANGKAH_VIDEO = 5;     // kirim tiap naik >= 5 poin persen
const LANGKAH_BACAAN = 10;   // kirim tiap naik >= 10 poin persen
const LANGKAH_BERKAS = 10;   // kirim tiap naik >= 10 poin persen
const JEDA_POLL_MS = 10000;  // cek posisi video tiap 10 detik selama diputar

let konteks = { rumpun: '', minggu: 0 };
const pelacak = new Map(); // materi_id -> { terkirim, tersimpan, berhenti }

function pelacakUntuk(id, tersimpanAwal) {
  if (!pelacak.has(id)) pelacak.set(id, { terkirim: tersimpanAwal, tersimpan: tersimpanAwal, berhenti: false });
  return pelacak.get(id);
}

function tampilkanProgres(id) {
  const p = pelacak.get(id);
  const bar = document.querySelector(`progress[data-id="${id}"]`);
  const teks = document.querySelector(`.teks-progres[data-id="${id}"]`);
  if (bar && p) bar.value = p.tersimpan;
  if (teks && p) teks.textContent = `${Math.round(p.tersimpan)}% tercatat`;
}

// halamanTerakhir hanya diisi materi berkas; video dan bacaan memanggil tanpa
// argumen itu, jadi badan permintaannya tetap sama persis seperti sebelumnya.
async function kirimProgres(id, persen, langkah, halamanTerakhir) {
  const p = pelacak.get(id);
  if (!p || p.berhenti) return;
  persen = Math.max(0, Math.min(100, persen));
  // Hanya kirim kalau naik cukup jauh dari yang terakhir dikirim, atau baru tuntas.
  if (persen < p.terkirim + langkah && !(persen >= 100 && p.terkirim < 100)) return;
  p.terkirim = persen;
  try {
    const badan = {
      rumpun_kode: konteks.rumpun, minggu: konteks.minggu, materi_id: id, persen_selesai: persen,
    };
    if (halamanTerakhir > 0) badan.halaman_terakhir = Math.floor(halamanTerakhir);
    const r = await apiPostJson('/api/progresmateri', badan);
    p.tersimpan = r.persen_selesai; // nilai yang TERSIMPAN (terbesar), bukan yang dikirim
    tampilkanProgres(id);
  } catch (err) {
    // 404/422 = masalah data (roster, katalog tidak cocok): mengulang tidak akan
    // berhasil, jadi pelacakan materi ini dihentikan alih-alih mengirim terus.
    if (err.status === 404 || err.status === 422) {
      p.berhenti = true;
      const teks = document.querySelector(`.teks-progres[data-id="${id}"]`);
      if (teks) teks.textContent = `progres tidak tercatat: ${err.message}`;
    } else {
      p.terkirim = Math.max(0, persen - langkah); // jaringan gagal: izinkan dicoba lagi
    }
  }
}

// --- YouTube IFrame API, dimuat sekali dari modul (bukan script inline) ---
let apiYouTube = null;
function muatAPIYouTube() {
  if (apiYouTube) return apiYouTube;
  apiYouTube = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('Pemutar YouTube tidak bisa dimuat'));
    document.head.appendChild(s);
  });
  return apiYouTube;
}

function persenVideo(pemutar) {
  const durasi = pemutar.getDuration();
  return durasi > 0 ? (pemutar.getCurrentTime() / durasi) * 100 : 0;
}

async function pasangVideo(m) {
  const YT = await muatAPIYouTube();
  let interval = null;
  const pemutar = new YT.Player(`yt-${m.id}`, {
    host: 'https://www.youtube-nocookie.com',
    videoId: m.youtube_id,
    playerVars: { rel: 0, modestbranding: 1 },
    events: {
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          if (!interval) interval = setInterval(() => kirimProgres(m.id, persenVideo(pemutar), LANGKAH_VIDEO), JEDA_POLL_MS);
        } else {
          clearInterval(interval); interval = null;
          if (e.data === YT.PlayerState.ENDED) kirimProgres(m.id, 100, LANGKAH_VIDEO);
          else if (e.data === YT.PlayerState.PAUSED) kirimProgres(m.id, persenVideo(pemutar), LANGKAH_VIDEO);
        }
      },
    },
  });
  // Menutup tab di tengah video: kirim posisi terakhir.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pemutar.getDuration) {
      kirimProgres(m.id, persenVideo(pemutar), LANGKAH_VIDEO);
    }
  });
}

function pasangBacaan(m) {
  const wadah = document.querySelector(`.bacaan[data-id="${m.id}"]`);
  if (!wadah) return;
  const ukur = () => {
    const tinggi = wadah.scrollHeight - wadah.clientHeight;
    // Teks yang lebih pendek dari wadahnya sudah terbaca seluruhnya begitu tampil.
    return tinggi <= 0 ? 100 : ((wadah.scrollTop + wadah.clientHeight) / wadah.scrollHeight) * 100;
  };
  let jeda = null;
  wadah.addEventListener('scroll', () => {
    if (jeda) return;
    jeda = setTimeout(() => { jeda = null; kirimProgres(m.id, ukur(), LANGKAH_BACAAN); }, 2000);
  });
  kirimProgres(m.id, ukur(), LANGKAH_BACAAN);
}

// --- Materi berkas (PDF) ---
// Berkasnya ada di repo storage GitHub yang PRIVAT, jadi peramban tidak bisa
// mengambilnya langsung: backend yang membacanya dan mengirimkan isinya sebagai
// base64 di dalam JSON, lewat apiGet (semua REST wajib lewat crootjs).
// Penyebut progresnya jumlah halaman yang ditetapkan dosen saat mengunggah,
// dan halaman baru dihitung selesai setelah benar-benar dilihat beberapa detik
// dengan tab terbuka (lihat pelacak.js).
const pelacakBerkas = [];

async function pasangBerkas(m) {
  const wadah = document.querySelector(`.pdf[data-id="${m.id}"]`);
  if (!wadah) return;
  // Keadaan "Memuat berkas…" sudah dipasang kartunya; berkas besar bisa perlu
  // beberapa detik, dan pasangPDF yang menggantinya begitu halaman 1 terender.
  // getJSON crootjs memutus permintaan setelah 15 detik: PDF sangat besar di
  // jaringan lambat akan jatuh ke pesan galat di bawah, bukan menggantung.
  const d = await apiGet(`/api/materi/${encodeURIComponent(m.id)}/berkas`, { auth: true });
  const total = Number(d.halaman) || 0;
  const pel = buatPelacak({
    total,
    onMaju: ({ persen, unitTerakhir }) => kirimProgres(m.id, persen, LANGKAH_BERKAS, unitTerakhir),
  });
  pelacakBerkas.push(pel);
  await pasangPDF(wadah, { base64: d.isi_base64, halaman: total, onHalaman: (n) => pel.lihat(n) });
}

function badanMateri(m) {
  if (m.jenis === 'video') return `<div class="video"><div id="yt-${esc(m.id)}"></div></div>`;
  if (m.jenis === 'berkas') return `<div class="pdf" data-id="${esc(m.id)}"><p class="redup">Memuat berkas…</p></div>`;
  return `<div class="bacaan" data-id="${esc(m.id)}">${(m.isi || '').split(/\n\s*\n/).map(par => `<p>${esc(par.trim())}</p>`).join('')}</div>`;
}

function labelJenis(m) {
  if (m.jenis === 'video') return 'Video';
  if (m.jenis === 'berkas') {
    const rincian = [m.nama_berkas, m.halaman ? `${m.halaman} halaman` : ''].filter(Boolean).map(esc).join(' · ');
    return `Berkas PDF${rincian ? ` · ${rincian}` : ''}`;
  }
  return 'Bacaan';
}

function kartuMateri(m) {
  const tersimpan = pelacak.get(m.id)?.tersimpan || 0;
  const badan = badanMateri(m);
  return `
    <div class="kartu">
      <h3>${esc(m.judul)}</h3>
      <p class="meta">${labelJenis(m)}${m.deskripsi ? ` · ${esc(m.deskripsi)}` : ''}</p>
      ${badan}
      <progress class="progres" max="100" value="${tersimpan}" data-id="${esc(m.id)}"></progress>
      <p class="redup teks-progres" data-id="${esc(m.id)}">${Math.round(tersimpan)}% tercatat</p>
    </div>`;
}

async function muatMateri(e, nim, prodi) {
  if (e) e.preventDefault();
  const fd = new FormData(document.getElementById('form-pilih'));
  konteks = { rumpun: fd.get('rumpun'), minggu: Number(fd.get('minggu')) };
  const wadah = document.getElementById('daftar-materi');
  wadah.innerHTML = '<p class="redup">Memuat materi…</p>';
  // Kartu lama dibuang: pelacak halamannya ikut dihentikan supaya listener
  // visibilitychange-nya tidak menumpuk tiap saringan diganti.
  pelacakBerkas.splice(0).forEach(pel => pel.berhenti());
  pelacak.clear();
  try {
    const q = new URLSearchParams({ prodi, rumpun: konteks.rumpun, minggu: String(konteks.minggu) });
    const [{ materi = [] }, { progres = [] }] = await Promise.all([
      apiGet(`/api/materi?${q}`, { auth: true }),
      apiGet(`/api/mahasiswa/${encodeURIComponent(nim)}/progres?minggu=${konteks.minggu}`, { auth: true }),
    ]);
    if (!materi.length) {
      wadah.innerHTML = '<div class="kosong">Belum ada materi untuk rumpun dan minggu ini. Dosen menambahkannya lewat halaman Kelola Materi.</div>';
      return;
    }
    const tersimpan = new Map(progres.map(p => [p.materi_id, p.persen_selesai]));
    materi.forEach(m => pelacakUntuk(m.id, tersimpan.get(m.id) || 0));
    wadah.innerHTML = materi.map(kartuMateri).join('');
    for (const m of materi) {
      if (m.jenis === 'video') {
        pasangVideo(m).catch(err => {
          const t = document.querySelector(`.teks-progres[data-id="${m.id}"]`);
          if (t) t.textContent = err.message;
        });
      } else if (m.jenis === 'berkas') {
        pasangBerkas(m).catch(err => {
          const w = document.querySelector(`.pdf[data-id="${m.id}"]`);
          if (w) w.innerHTML = `<div class="pesan gagal">Berkas tidak bisa ditampilkan: ${esc(err.message)}</div>`;
        });
      } else {
        pasangBacaan(m);
      }
    }
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran === 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk mahasiswa</h3>
      <p class="meta">Katalog materi dikelola dosen lewat halaman Kelola Materi.</p>
      <a class="aksi" href="kelola-materi.html">Kelola Materi</a></div>`;
    return;
  }
  if (!saya.nim) {
    isi.innerHTML = '<div class="kosong">Nomor ini belum tercatat di roster mahasiswa, jadi progres materi tidak bisa dicatat atas nama siapa pun. Hubungi pengelola prodi.</div>';
    return;
  }
  if (!saya.prodi_kode) {
    isi.innerHTML = '<div class="kosong">Program studi Anda belum tercatat di roster mahasiswa, jadi materi prodi Anda belum bisa ditentukan. Hubungi pengelola prodi.</div>';
    return;
  }
  const prodi = saya.prodi_kode;
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(prodi)}/rumpun`);

  // Minggu bawaan dari kalender terbit lewat dasbor; kalau belum terbit, 1.
  let mingguAwal = 1;
  try {
    const beban = await apiGet(`/api/dasbor/beban-belajar/${encodeURIComponent(saya.nim)}`, { auth: true });
    if (beban.minggu) mingguAwal = beban.minggu;
  } catch (_) { /* kalender belum terbit */ }

  isi.innerHTML = `
    <div class="kartu">
      <h3>Pilih Rumpun &amp; Minggu</h3>
      <form id="form-pilih">
        <label>Rumpun <select name="rumpun" required>
          ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')}
        </select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(mingguAwal)}"></label>
        <button>Tampilkan Materi</button>
      </form>
    </div>
    <div id="daftar-materi"></div>`;
  document.getElementById('form-pilih').addEventListener('submit', e => muatMateri(e, saya.nim, prodi));
  if (rumpun.length) await muatMateri(null, saya.nim, prodi);
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
