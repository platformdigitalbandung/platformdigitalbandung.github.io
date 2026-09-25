import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong, istilah } from './ui.js';
import { pekanMahasiswa } from './hal-mahasiswa.js';
import { buatPelacak } from './pelacak.js';
import { pasangPDF } from './pdfmateri.js';

// Materi Pekan Ini (mahasiswa). Progres dikirim ke POST /api/progresmateri;
// server yang memutuskan: NIM dari roster lewat token, materi harus milik
// prodi/rumpun/minggu mahasiswa, dan persen yang tersimpan tidak pernah turun.
// Halaman ini hanya melaporkan apa yang terjadi di pemutar, di wadah bacaan,
// dan di pembaca PDF.

const isi = document.getElementById('isi');

// Batas kirim: event dari pemutar datang terus-menerus, tapi server hanya
// menyimpan nilai terbesar — mengirim tiap detik cuma membebani backend.
const LANGKAH_VIDEO = 5;     // kirim tiap naik >= 5 poin persen
const LANGKAH_BACAAN = 10;   // kirim tiap naik >= 10 poin persen
const LANGKAH_BERKAS = 10;   // kirim tiap naik >= 10 poin persen
const JEDA_POLL_MS = 10000;  // cek posisi video tiap 10 detik selama diputar

// materi_id -> { terkirim, tersimpan, berhenti, rumpun, minggu }. Rumpun dan
// minggu ikut disimpan per materi karena satu tampilan bisa memuat beberapa rumpun.
const pelacak = new Map();

function pelacakUntuk(m, tersimpanAwal) {
  if (!pelacak.has(m.id)) {
    pelacak.set(m.id, { terkirim: tersimpanAwal, tersimpan: tersimpanAwal, berhenti: false, rumpun: m.rumpun_kode, minggu: m.minggu });
  }
  return pelacak.get(m.id);
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
      rumpun_kode: p.rumpun, minggu: p.minggu, materi_id: id, persen_selesai: persen,
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

// --- Video: aturan ala LMS korporat (keputusan pemilik produk 2026-09-19) ---
// * Dijeda otomatis saat tab ditinggal, jendela berpindah ke aplikasi lain,
//   atau videonya di-scroll keluar layar; hanya satu video berputar sekaligus.
// * Kecepatan dikunci 1x: perubahan dari menu pemutar dikembalikan.
// * Tidak bisa dilompati ke depan melewati bagian yang sudah ditonton (boleh
//   mundur/mengulang). Progres = bagian terjauh yang benar-benar ditonton,
//   bukan posisi putar — melompat ke akhir tidak lagi tercatat 100%.
// Pemutar YouTube tidak bisa menyembunyikan tombolnya, jadi aturan ditegakkan
// dengan memeriksa posisi tiap detik dan mengembalikannya.
const TOLERANSI_DTK = 2;      // selisih wajar antar-cek tiap detik
const pemutarAktif = [];      // { pemutar, lepas } per video yang terpasang

function jedaSemuaKecuali(pemutar) {
  pemutarAktif.forEach(p => { if (p.pemutar !== pemutar && p.pemutar.pauseVideo) p.pemutar.pauseVideo(); });
}

function lepasSemuaVideo() {
  pemutarAktif.splice(0).forEach(p => p.lepas());
}

function tampilkanPeringatan(id, teks) {
  const el = document.querySelector(`.peringatan-video[data-id="${id}"]`);
  if (!el) return;
  el.textContent = teks;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 6000);
}

async function pasangVideo(m, persenAwal) {
  const YT = await muatAPIYouTube();
  let durasi = 0;
  let terjauh = 0;          // detik terjauh yang ditonton wajar
  let penjaga = null;       // cek posisi & kecepatan tiap detik selama diputar
  let kirimBerkala = null;
  const persenTonton = () => (durasi > 0 ? Math.min(100, (terjauh / durasi) * 100) : 0);
  // Mendekati akhir dianggap tuntas (pemutar sering berhenti sepersekian detik sebelum durasi).
  const kirim = () => kirimProgres(m.id, terjauh >= durasi - TOLERANSI_DTK && durasi > 0 ? 100 : persenTonton(), LANGKAH_VIDEO);

  const pemutar = new YT.Player(`yt-${m.id}`, {
    host: 'https://www.youtube-nocookie.com',
    videoId: m.youtube_id,
    // disablekb: pintasan papan ketik (panah untuk melompat, < > untuk kecepatan) dimatikan.
    playerVars: { rel: 0, modestbranding: 1, disablekb: 1, playsinline: 1 },
    events: {
      onReady: () => {
        durasi = pemutar.getDuration() || 0;
        terjauh = durasi * Math.min(100, Math.max(0, persenAwal || 0)) / 100;
      },
      onPlaybackRateChange: (e) => {
        if (e.data !== 1) {
          pemutar.setPlaybackRate(1);
          tampilkanPeringatan(m.id, 'Kecepatan video dikunci 1×.');
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          if (!durasi) durasi = pemutar.getDuration() || 0;
          jedaSemuaKecuali(pemutar);
          if (!penjagaBoleh()) { pemutar.pauseVideo(); return; }
          if (!penjaga) penjaga = setInterval(jaga, 1000);
          if (!kirimBerkala) kirimBerkala = setInterval(kirim, JEDA_POLL_MS);
          return;
        }
        clearInterval(penjaga); penjaga = null;
        clearInterval(kirimBerkala); kirimBerkala = null;
        if (e.data === YT.PlayerState.ENDED) {
          // Sampai di akhir karena melompat: kembalikan ke bagian terjauh yang ditonton.
          if (durasi > 0 && terjauh < durasi - TOLERANSI_DTK) {
            pemutar.seekTo(terjauh, true);
            pemutar.pauseVideo();
            tampilkanPeringatan(m.id, 'Video tidak bisa dilompati. Lanjutkan dari bagian terakhir yang Anda tonton.');
            return;
          }
          terjauh = durasi;
        }
        kirim();
      },
    },
  });

  function jaga() {
    const kini = pemutar.getCurrentTime ? pemutar.getCurrentTime() : 0;
    if (kini > terjauh + TOLERANSI_DTK) {
      pemutar.seekTo(terjauh, true);
      tampilkanPeringatan(m.id, 'Video tidak bisa dilompati. Lanjutkan dari bagian terakhir yang Anda tonton.');
      return;
    }
    if (kini > terjauh) terjauh = kini;
    if (pemutar.getPlaybackRate && pemutar.getPlaybackRate() !== 1) pemutar.setPlaybackRate(1);
  }

  // Boleh berputar hanya selagi tab terlihat, jendela aktif, dan videonya di layar.
  let diLayar = true;
  function penjagaBoleh() {
    // Mengeklik pemutar memindahkan fokus ke iframe-nya — itu bukan meninggalkan halaman.
    const fokusDiPemutar = document.activeElement && document.activeElement.tagName === 'IFRAME';
    return document.visibilityState === 'visible' && (document.hasFocus() || fokusDiPemutar) && diLayar;
  }
  function periksa() {
    if (!pemutar.getPlayerState || pemutar.getPlayerState() !== YT.PlayerState.PLAYING) return;
    if (!penjagaBoleh()) {
      pemutar.pauseVideo();
      tampilkanPeringatan(m.id, 'Video dijeda karena Anda meninggalkan halaman materi. Tekan putar untuk melanjutkan.');
    }
  }
  // blur jendela diperiksa sesaat kemudian: saat pemutar diklik, fokus pindah ke iframe lebih dulu.
  const padaBlur = () => setTimeout(periksa, 0);
  document.addEventListener('visibilitychange', periksa);
  window.addEventListener('blur', padaBlur);
  const wadahVideo = document.getElementById(`yt-${m.id}`)?.closest('.video') || document.getElementById(`yt-${m.id}`);
  let pengamat = null;
  if (wadahVideo && 'IntersectionObserver' in window) {
    pengamat = new IntersectionObserver(([ent]) => { diLayar = ent.isIntersecting; periksa(); }, { threshold: 0.5 });
    pengamat.observe(wadahVideo);
  }
  pemutarAktif.push({
    pemutar,
    lepas() {
      clearInterval(penjaga); clearInterval(kirimBerkala);
      document.removeEventListener('visibilitychange', periksa);
      window.removeEventListener('blur', padaBlur);
      if (pengamat) pengamat.disconnect();
    },
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

async function pasangBerkas(m, halamanAwal) {
  const wadah = document.querySelector(`.pdf[data-id="${m.id}"]`);
  if (!wadah) return;
  // Keadaan "Memuat berkas…" sudah dipasang kartunya; berkas besar bisa perlu
  // beberapa detik, dan pasangPDF yang menggantinya begitu halaman 1 terender.
  // getJSON crootjs memutus permintaan setelah 15 detik: PDF sangat besar di
  // jaringan lambat akan jatuh ke pesan galat di bawah, bukan menggantung.
  const d = await apiGet(`/api/materi/${encodeURIComponent(m.id)}/berkas`, { auth: true });
  const total = Number(d.halaman) || 0;
  // Halaman berikutnya baru terbuka setelah halaman yang sedang dibaca dihitung
  // selesai; halaman yang pernah dibuka (halaman_terakhir di server) tetap terbuka.
  let pdf = null;
  // halaman_terakhir = halaman terakhir yang sudah dihitung selesai, jadi halaman sesudahnya ikut terbuka.
  let terbuka = Math.max(1, (Math.floor(halamanAwal) || 0) + 1);
  const pel = buatPelacak({
    total,
    onMaju: ({ persen, unitTerakhir }) => {
      terbuka = Math.max(terbuka, unitTerakhir + 1);
      if (pdf) pdf.buka(terbuka);
      kirimProgres(m.id, persen, LANGKAH_BERKAS, unitTerakhir);
    },
  });
  pelacakBerkas.push(pel);
  // Di-scroll ke materi lain = waktu baca berhenti.
  if ('IntersectionObserver' in window) {
    const pengamat = new IntersectionObserver(([ent]) => pel.tampak(ent.isIntersecting), { threshold: 0.3 });
    pengamat.observe(wadah);
    pelacakBerkas.push({ berhenti: () => pengamat.disconnect() });
  }
  pdf = await pasangPDF(wadah, { base64: d.isi_base64, halaman: total, terbukaSampai: terbuka, onHalaman: (n) => pel.lihat(n) });
  pdf.buka(terbuka);
}

function badanMateri(m) {
  if (m.jenis === 'video') return `<div class="video"><div id="yt-${esc(m.id)}"></div></div><p class="peringatan-video" data-id="${esc(m.id)}" role="status" hidden></p>`;
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

// Materi satu minggu. Rumpun kosong = semua rumpun; `rumpunBerlaku` (bila
// diketahui dari kalender) menyaring ke rumpun yang dijadwalkan minggu itu.
async function muatMateri({ nim, prodi, rumpun = '', mk = '', minggu, rumpunBerlaku = [], namaRumpun = {} }) {
  const wadah = document.getElementById('daftar-materi');
  if (!minggu || minggu < 1) {
    wadah.innerHTML = '<div class="pesan gagal">Isi minggu dengan angka mulai dari 1.</div>';
    return;
  }
  wadah.innerHTML = '<p class="redup">Memuat materi…</p>';
  // Kartu lama dibuang: pelacak halamannya ikut dihentikan supaya listener
  // visibilitychange-nya tidak menumpuk tiap saringan diganti.
  pelacakBerkas.splice(0).forEach(pel => pel.berhenti());
  lepasSemuaVideo();
  pelacak.clear();
  try {
    const q = new URLSearchParams({ prodi, minggu: String(minggu) });
    if (rumpun) q.set('rumpun', rumpun);
    const [{ materi: semua = [] }, { progres = [] }] = await Promise.all([
      apiGet(`/api/materi?${q}`, { auth: true }),
      apiGet(`/api/mahasiswa/${encodeURIComponent(nim)}/progres?minggu=${minggu}`, { auth: true }),
    ]);
    // mk: materi satu mata kuliah lepas (tautan dari halaman kelas mata kuliah).
    const materi = (semua || [])
      .filter(m => rumpun || !rumpunBerlaku.length || rumpunBerlaku.includes(m.rumpun_kode))
      .filter(m => !mk || String(m.mk_kode || '').toUpperCase() === mk.toUpperCase());
    if (!materi.length) {
      const untuk = rumpun ? `rumpun ${rumpun} minggu ${minggu}` : `minggu ${minggu}`;
      wadah.innerHTML = keadaanKosong({
        judul: `Belum ada materi ${untuk}`,
        keterangan: 'Pengajar kelas belum menambahkan materinya ke katalog. Materi langsung tampil di halaman ini begitu ditambahkan.',
        siapa: `pengajar kelas ${prodi.toUpperCase()}`,
        aksi: [{ href: 'kalender.html', label: 'Lihat kalender' }],
      });
      return;
    }
    const tersimpan = new Map(progres.map(p => [p.materi_id, p.persen_selesai]));
    const halamanTersimpan = new Map(progres.map(p => [p.materi_id, p.halaman_terakhir || 0]));
    materi.forEach(m => pelacakUntuk(m, tersimpan.get(m.id) || 0));
    // Dikelompokkan per rumpun (urutan katalog dipertahankan dalam tiap rumpun).
    const kelompok = new Map();
    materi.forEach(m => {
      if (!kelompok.has(m.rumpun_kode)) kelompok.set(m.rumpun_kode, []);
      kelompok.get(m.rumpun_kode).push(m);
    });
    wadah.innerHTML = [...kelompok.entries()].map(([kode, daftar]) => `
      <section class="kelompok-rumpun">
        <h2 class="judul-rumpun">${esc(kode)}${namaRumpun[kode] ? ` — ${esc(namaRumpun[kode])}` : ''}</h2>
        ${daftar.map(kartuMateri).join('')}
      </section>`).join('');
    for (const m of materi) {
      if (m.jenis === 'video') {
        pasangVideo(m, tersimpan.get(m.id) || 0).catch(err => {
          const t = document.querySelector(`.teks-progres[data-id="${m.id}"]`);
          if (t) t.textContent = err.message;
        });
      } else if (m.jenis === 'berkas') {
        pasangBerkas(m, halamanTersimpan.get(m.id) || 0).catch(err => {
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
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda sudah berakhir atau backend tidak terjangkau. Tekan Masuk lagi di pojok kanan atas.</div>';
    return;
  }
  if (saya.peran === 'dosen') {
    isi.innerHTML = `<div class="kartu"><h3>Halaman ini untuk mahasiswa</h3>
      <p class="meta">Katalog materi dikelola dosen lewat halaman Kelola Materi.</p>
      <a class="aksi" href="kelola-materi.html">Kelola Materi</a></div>`;
    return;
  }
  if (!saya.nim) {
    isi.innerHTML = keadaanKosong({
      judul: 'Nomor ini belum tercatat di roster mahasiswa',
      keterangan: 'Materi dan progres belajar dicatat atas nama NIM. Setelah nomor WhatsApp Anda didaftarkan di roster, materi prodi Anda tampil di sini.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  if (!saya.prodi_kode) {
    isi.innerHTML = keadaanKosong({
      judul: 'Program studi Anda belum tercatat di roster',
      keterangan: 'Materi disusun per program studi, jadi belum bisa ditentukan materi mana yang untuk Anda.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  const prodi = saya.prodi_kode;
  const PRODI = prodi.toUpperCase();
  const [pekan, { rumpun = [] }] = await Promise.all([
    pekanMahasiswa(prodi),
    apiGet(`/api/kurikulum/prodi/${encodeURIComponent(prodi)}/rumpun`),
  ]);

  if (!pekan.terbit) {
    isi.innerHTML = keadaanKosong({
      judul: `Kalender semester ${PRODI} belum diterbitkan`,
      keterangan: 'Materi dibuka per minggu mengikuti kalender semester. Begitu kaprodi menerbitkan kalender Anda, materi minggu berjalan langsung tampil di halaman ini tanpa perlu memilih apa pun.',
      siapa: `kaprodi ${PRODI}`,
      aksi: [{ href: 'kalender.html', label: 'Lihat kalender' }],
    });
    return;
  }

  const namaRumpun = Object.fromEntries((rumpun || []).map(r => [r.kode, r.nama]));
  const mingguAwal = pekan.minggu || 1;
  const judulPekan = pekan.minggu
    ? `Minggu ${pekan.minggu}${pekan.rentang ? ` · ${esc(pekan.rentang)}` : ''}`
    : 'Pilih minggu';
  const keterangan = pekan.minggu
    ? `Materi ${pekan.rumpun.length ? `rumpun ${pekan.rumpun.map(esc).join(', ')}` : 'semua rumpun'} yang dijadwalkan minggu ini. Selesaikan sebelum sesi Jumat.`
    : 'Hari ini di luar jadwal kalender semester Anda (perkuliahan belum mulai atau sudah selesai). Pilih minggu yang ingin dibuka.';

  isi.innerHTML = `
    <div class="kartu kartu-pekan">
      <h3>${judulPekan}</h3>
      <p class="meta">${keterangan}</p>
      <div class="meta">Materi dikelompokkan per ${istilah('rumpun')}.</div>
      <details class="minggu-lain"${pekan.minggu ? '' : ' open'}>
        <summary>Lihat minggu atau rumpun lain</summary>
        <form id="form-pilih">
          <label>Rumpun <select name="rumpun">
            <option value="">Semua rumpun</option>
            ${(rumpun || []).map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)}</option>`).join('')}
          </select></label>
          <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(mingguAwal)}"></label>
          <button>Tampilkan Materi</button>
        </form>
      </details>
    </div>
    <div id="daftar-materi"></div>`;
  document.getElementById('form-pilih').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    muatMateri({ nim: saya.nim, prodi, rumpun: fd.get('rumpun') || '', minggu: Number(fd.get('minggu')), namaRumpun });
  });
  // Tautan dari halaman Kelas: ?rumpun=R1&minggu=3[&mk=KODE] langsung membuka
  // materi itu (form ikut diisi supaya pilihan tampak).
  const q = new URLSearchParams(location.search);
  const rumpunQ = q.get('rumpun') || '';
  const mingguQ = Number(q.get('minggu')) || 0;
  if (rumpunQ || mingguQ) {
    const form = document.getElementById('form-pilih');
    if (rumpunQ && [...form.rumpun.options].some(o => o.value === rumpunQ)) form.rumpun.value = rumpunQ;
    if (mingguQ) form.minggu.value = String(mingguQ);
    await muatMateri({ nim: saya.nim, prodi, rumpun: rumpunQ, mk: q.get('mk') || '', minggu: mingguQ || mingguAwal, namaRumpun });
    return;
  }
  await muatMateri({ nim: saya.nim, prodi, minggu: mingguAwal, rumpunBerlaku: pekan.rumpun, namaRumpun });
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
