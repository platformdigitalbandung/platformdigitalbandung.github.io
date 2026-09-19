// Pelacak progres per unit (halaman PDF, dan nanti unit lain kalau dibutuhkan).
//
// Kenapa tinggal di repo ini, bukan di crootjs: crootjs 0.0.11 — versi terbaru
// saat berkas ini ditulis — sama sekali tidak punya modul pelacak, PDF, atau
// pemutar. Modulnya hanya api, auth, config, cookie, debounce, element, image,
// loading, mongo, storage, stp, template, toast, trace, url, useragent,
// validate, dan websocket (diperiksa di croot.js.org/docs dan di daftar berkas
// rilis crootjs/lib). Repo ini pun cuma punya akses BACA ke crootjs/lib, jadi
// pelacak ini ditulis di sini dulu; kalau ternyata berguna untuk project lain,
// usulkan ke tim crootjs supaya dirilis sebagai modul resmi (pdb/README.md:
// perbaikan lib dilaporkan ke tim crootjs, bukan di-workaround diam-diam).
//
// Konvensi crootjs yang diikuti: modul ES, satu tanggung jawab, dan TIDAK ada
// efek samping saat diimpor — listener baru dipasang ketika buatPelacak()
// dipanggil, dan dilepas lagi oleh .berhenti().

// Alasan pelacak ini ada: progres materi harus mencerminkan waktu yang benar-
// benar dihabiskan membaca. Menandai halaman "selesai" begitu tampil membuat
// progres 100% cukup dengan menekan "Berikutnya" berkali-kali, dan menghitung
// waktu saat tab disembunyikan membuat progres jalan sendiri sementara
// mahasiswanya mengerjakan hal lain. Karena itu penghitung hanya berjalan
// selama tab terlihat (document.visibilityState === 'visible'), jendelanya
// sedang aktif (tidak berpindah ke aplikasi lain), dan — bila pemanggil
// melaporkannya lewat tampak() — materinya ada di layar, bukan sudah di-scroll
// ke bagian lain halaman (2026-09-19, perilaku ala LMS korporat).

/**
 * Membuat pelacak baru.
 *
 * @param {object} opsi
 * @param {number} opsi.total    jumlah unit seluruhnya (penyebut persen).
 * @param {number} [opsi.minDetik=3] lama satu unit harus terlihat (kumulatif,
 *                               dalam keadaan tab terlihat) sebelum dihitung selesai.
 * @param {function} [opsi.onMaju] dipanggil HANYA saat persen naik, dengan
 *                               { persen, unitTerakhir, unitSelesai }.
 * @returns {{lihat: function(number): void, tampak: function(boolean): void, berhenti: function(): void}}
 */
export function buatPelacak({ total, minDetik = 3, onMaju } = {}) {
  const jumlahUnit = Math.max(0, Math.floor(Number(total) || 0));
  const ambangMs = Math.max(0, Number(minDetik) || 0) * 1000;

  const terkumpul = new Map(); // unit -> milidetik terlihat yang sudah terkumpul
  const selesai = new Set();   // unit yang sudah melewati ambang
  let unitKini = null;
  let sejak = 0;      // waktu mulai penghitung berjalan; 0 = penghitung berhenti
  let timer = null;   // setTimeout, BUKAN setInterval: tidak ada detak yang jalan
                      // terus-menerus saat tab disembunyikan.
  let persen = 0;
  let mati = false;
  let diLayar = true;          // dilaporkan pemanggil lewat tampak()
  let jendelaAktif = document.hasFocus();

  const terlihat = () => document.visibilityState === 'visible' && jendelaAktif && diLayar;

  // Menghentikan penghitung dan menyimpan waktu yang sudah berjalan ke unitnya.
  function jeda() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (unitKini === null || sejak === 0) return;
    terkumpul.set(unitKini, (terkumpul.get(unitKini) || 0) + (Date.now() - sejak));
    sejak = 0;
  }

  // Menjalankan penghitung untuk unit yang sedang dilihat, kalau tabnya terlihat
  // dan unitnya belum selesai.
  function jalan() {
    if (mati || unitKini === null || sejak !== 0) return;
    if (!terlihat() || selesai.has(unitKini)) return;
    sejak = Date.now();
    timer = setTimeout(tandaiSelesai, Math.max(0, ambangMs - (terkumpul.get(unitKini) || 0)));
  }

  function tandaiSelesai() {
    timer = null;
    sejak = 0;
    if (mati || unitKini === null || selesai.has(unitKini)) return;
    terkumpul.set(unitKini, ambangMs);
    selesai.add(unitKini);
    hitung();
  }

  // Persen tidak pernah turun — sama seperti persen_selesai di server.
  function hitung() {
    if (jumlahUnit <= 0) return;
    const baru = Math.min(100, (selesai.size / jumlahUnit) * 100);
    if (baru <= persen) return;
    persen = baru;
    if (typeof onMaju === 'function') {
      onMaju({ persen, unitTerakhir: unitKini, unitSelesai: selesai.size });
    }
  }

  function padaVisibilitas() {
    if (terlihat()) jalan(); else jeda();
  }
  const padaFokus = () => { jendelaAktif = true; padaVisibilitas(); };
  const padaBlur = () => { jendelaAktif = false; padaVisibilitas(); };
  document.addEventListener('visibilitychange', padaVisibilitas);
  window.addEventListener('focus', padaFokus);
  window.addEventListener('blur', padaBlur);

  return {
    // Menandai unit ke-`unit` sedang dilihat sekarang. Waktu unit sebelumnya
    // disimpan dulu, jadi bolak-balik halaman tidak menghanguskan hitungannya.
    lihat(unit) {
      if (mati) return;
      const n = Number(unit);
      if (!Number.isFinite(n)) return;
      if (n === unitKini) { jalan(); return; }
      jeda();
      unitKini = n;
      jalan();
    },
    // Dilaporkan pemanggil (mis. IntersectionObserver): apakah materinya
    // sedang tampil di layar. Di-scroll ke bagian lain = penghitung berhenti.
    tampak(ya) {
      if (mati) return;
      diLayar = Boolean(ya);
      padaVisibilitas();
    },
    // Melepas timer dan listener. Wajib dipanggil sebelum wadahnya dibuang,
    // supaya listener visibilitychange tidak menumpuk tiap materi dimuat ulang.
    berhenti() {
      if (mati) return;
      mati = true;
      jeda();
      document.removeEventListener('visibilitychange', padaVisibilitas);
      window.removeEventListener('focus', padaFokus);
      window.removeEventListener('blur', padaBlur);
    },
  };
}
