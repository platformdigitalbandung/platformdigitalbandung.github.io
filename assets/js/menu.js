// Menu navigasi per peran aktif — SATU sumber untuk:
//   - nav atas di layar lebar (header nav.navutama, diisi di sini),
//   - bilah navigasi bawah + lembar "Lainnya"/"Laporan" di HP (<= 720px),
//   - daftar Layanan di Beranda (LAYANAN, dipakai index.js).
// Tamu, sesi berakhir, dan nomor yang belum terdaftar TIDAK mendapat menu
// aplikasi: semua halaman di dalamnya butuh masuk (keputusan pemilik produk
// 2026-09-15). Peran dan kewenangan tetap diputuskan backend; menu hanya
// memilih tautan yang relevan untuk peran aktif (pemilih peran di akun.js).
//
// Modul ini sengaja tidak meng-import akun.js/ui.js (akun.js yang memanggil
// modul ini), supaya tidak ada import melingkar.

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Menu layanan per peran aktif (Beranda). Laporan tingkat prodi (kaprodi.html,
// kepatuhan.html, rekap rapor, SLA forum, rekap rekaman) hanya untuk kaprodi
// dan admin — halamannya sendiri berganti ke tampilan laporan untuk peran itu,
// dan backend tetap menolak 403 untuk yang lain.
export const LAYANAN = {
  mahasiswa: [
    ['Pembelajaran', [
      ['materi.html', 'Materi pekan ini', 'Video dan bacaan asinkron'],
      ['kuis.html', 'Kuis gerbang', 'Syarat sebelum sesi Jumat'],
      ['forum.html', 'Forum tanya dosen', 'Target jawaban 1×24 jam'],
      ['rekaman.html', 'Rekaman sesi', 'Kelas daring yang terlewat'],
      ['portal.html', 'Tugas', 'Kumpulkan dan pantau tugas'],
      ['kalender.html', 'Kalender akademik', 'Jadwal semester'],
    ]],
    ['Nilai dan kemajuan', [
      ['dasbor.html', 'Dasbor belajar', 'Beban belajar dan capaian CPL'],
      ['nilai.html', 'Nilai proyek', 'Rincian per mata kuliah'],
      ['rapor.html', 'Rapor', 'IP per semester dan IPK'],
      ['autograder.html', 'Hasil autograder', 'Tes otomatis kode praktikum'],
    ]],
    ['Administrasi', [
      ['kerja.html', 'Proyek kerja / magang', 'Konversi pekerjaan jadi kredit'],
      ['rpl.html', 'Rekognisi pembelajaran lampau', 'Pengakuan pengalaman kerja'],
    ]],
  ],
  dosen: [
    ['Pengajaran', [
      ['kelola-materi.html', 'Kelola materi', 'Video dan bacaan per minggu'],
      ['kuis.html', 'Kuis gerbang', 'Susun soal dan cek kelulusan'],
      ['dosen.html', 'Buat tugas', 'Termasuk laporan kemiripan'],
      ['forum.html', 'Forum tanya mahasiswa', 'Pertanyaan yang menunggu jawaban'],
      ['rekaman.html', 'Rekaman sesi', 'Terbitkan sebelum tenggat'],
    ]],
    ['Penilaian', [
      ['proyek.html', 'Proyek blok', 'Anggota dan nilai per mata kuliah'],
      ['ujian.html', 'Pengawas ujian', 'Jadwal dan kehadiran'],
      ['autograder.html', 'Autograder', 'Hasil tes otomatis dan bobot'],
      ['rapor.html', 'Rapor mahasiswa', 'Rapor per NIM'],
      ['rpl.html', 'Tinjau RPL', 'Pengajuan yang menunggu'],
      ['kerja.html', 'Proyek kerja bimbingan', 'Putusan dan tinjauan'],
    ]],
    ['Akademik', [
      ['kalender.html', 'Kalender akademik', 'Jadwal semester'],
      ['akademik.html', 'Roster dan email dosen', 'Data mahasiswa dan email kampus Anda'],
      ['kurikulum.html', 'Kurikulum', 'Program studi dan data kurikulumnya'],
    ]],
  ],
  kaprodi: [
    ['Kurikulum dan pengajar', [
      ['kurikulum.html', 'Kurikulum program studi', 'Rumpun, mata kuliah, CPL, dan ritme'],
      ['pengampu.html', 'Dosen pengampu prodi', 'Centang dosen yang mengajar di prodi Anda'],
      ['kalender.html', 'Kalender akademik', 'Susun dan terbitkan kalender prodi Anda'],
    ]],
    ['Laporan prodi', [
      ['kaprodi.html', 'Pantau proyek kerja', 'Tinjauan tengah semester'],
      ['kepatuhan.html', 'Laporan kepatuhan', 'Menit per mata kuliah untuk akreditasi'],
      ['rapor.html', 'Rekap rapor angkatan', 'Nilai huruf dan IP per semester'],
      ['forum.html', 'SLA forum', 'Pertanyaan yang lewat target jawaban'],
      ['rekaman.html', 'Rekap rekaman', 'Sesi daring yang terlambat direkam'],
    ]],
  ],
  admin: [
    ['Penyiapan', [
      ['jabatan.html', 'Kelola kaprodi', 'Tetapkan atau ganti kaprodi tiap prodi'],
      ['kurikulum.html', 'Program studi baru', 'Buat prodi, lalu serahkan ke kaprodinya'],
    ]],
    ['Laporan semua prodi', [
      ['kaprodi.html', 'Pantau proyek kerja', 'Tinjauan tengah semester'],
      ['kepatuhan.html', 'Laporan kepatuhan', 'Menit per mata kuliah untuk akreditasi'],
      ['rapor.html', 'Rekap rapor angkatan', 'Nilai huruf dan IP per semester'],
      ['forum.html', 'SLA forum', 'Pertanyaan yang lewat target jawaban'],
      ['rekaman.html', 'Rekap rekaman', 'Sesi daring yang terlambat direkam'],
    ]],
  ],
};

// Navigasi per peran:
//   bar  — bilah bawah HP (maks. 4, ditambah tombol grup),
//   atas — nav atas layar lebar (ditambah tombol grup berisi sisa `grup`),
//   grup — lembar "Lainnya"/"Laporan": pekerjaan yang lebih jarang dibuka.
// Alasan pemilihan: bar berisi pekerjaan mingguan tiap peran (mahasiswa belajar
// dan mengumpulkan; dosen menyiapkan materi, tugas, dan menjawab forum; kaprodi
// menyiapkan kurikulum, pengampu, kalender; admin menyiapkan kaprodi dan prodi).
// Laporan dikumpulkan dalam satu grup karena dibuka berkala, bukan harian.
export const NAV = {
  mahasiswa: {
    bar: ['./', 'kalender.html', 'materi.html', 'portal.html'],
    atas: ['./', 'kalender.html', 'materi.html', 'kuis.html', 'portal.html', 'forum.html'],
    grup: { label: 'Lainnya', ikon: 'lainnya', href: ['kuis.html', 'forum.html', 'rekaman.html', 'nilai.html', 'rapor.html', 'dasbor.html', 'kerja.html', 'rpl.html', 'autograder.html'] },
  },
  dosen: {
    bar: ['./', 'kelola-materi.html', 'dosen.html', 'forum.html'],
    atas: ['./', 'kelola-materi.html', 'dosen.html', 'kuis.html', 'forum.html', 'kalender.html'],
    grup: { label: 'Lainnya', ikon: 'lainnya', href: ['kuis.html', 'kalender.html', 'proyek.html', 'rekaman.html', 'ujian.html', 'akademik.html', 'rapor.html', 'rpl.html', 'kerja.html', 'autograder.html', 'kurikulum.html'] },
  },
  kaprodi: {
    bar: ['./', 'kurikulum.html', 'pengampu.html', 'kalender.html'],
    atas: ['./', 'kurikulum.html', 'pengampu.html', 'kalender.html'],
    grup: { label: 'Laporan', ikon: 'laporan', href: ['kaprodi.html', 'kepatuhan.html', 'rapor.html', 'forum.html', 'rekaman.html'] },
    catatan: 'Menu mengajar — materi, kuis, tugas, dan penilaian — ada di peran dosen.',
  },
  admin: {
    bar: ['./', 'jabatan.html', 'kurikulum.html'],
    atas: ['./', 'jabatan.html', 'kurikulum.html'],
    grup: { label: 'Laporan', ikon: 'laporan', href: ['kaprodi.html', 'kepatuhan.html', 'rapor.html', 'forum.html', 'rekaman.html'] },
    catatan: 'Admin hanya menyiapkan prodi dan kaprodinya. Menu mengajar ada di peran dosen.',
  },
};

// Label pendek untuk nav (layar lebar dan bilah bawah).
const PENDEK = {
  './': 'Beranda', 'kalender.html': 'Kalender', 'materi.html': 'Materi', 'portal.html': 'Tugas',
  'kuis.html': 'Kuis', 'forum.html': 'Forum', 'kelola-materi.html': 'Materi', 'dosen.html': 'Tugas',
  'kurikulum.html': 'Kurikulum', 'pengampu.html': 'Pengampu', 'jabatan.html': 'Kaprodi',
};
const PENDEK_PERAN = { admin: { 'kurikulum.html': 'Prodi baru' } };

// Ikon garis 24px, digambar sendiri (stroke = currentColor).
const IKON = {
  beranda: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-5.5h4v5.5"/>',
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  materi: '<path d="M4.5 4.5h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2h-6z"/><path d="M19.5 4.5h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z"/>',
  tugas: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v2.5H9z"/><path d="m9 13 2 2 4-4"/>',
  kuis: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  forum: '<path d="M4 5h16v10.5H10l-4.5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  kurikulum: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  pengampu: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/>',
  kaprodi: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/><path d="m10 16.5 2 2 2-2"/>',
  prodi: '<path d="M3 9.5 12 4l9 5.5-9 5.5z"/><path d="M6.5 11.5V16c3 2.5 8 2.5 11 0v-4.5"/>',
  laporan: '<path d="M4 20.5h16"/><path d="M7 17V11M12 17V6.5M17 17v-4"/>',
  lainnya: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>',
  rekaman: '<rect x="3.5" y="6" width="12" height="12" rx="2"/><path d="m15.5 10.5 5-3v9l-5-3z"/>',
  nilai: '<path d="M6 20.5V14M12 20.5V9M18 20.5V4"/>',
  dokumen: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>',
  dasbor: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-5"/><path d="M4 18h16"/>',
  kerja: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
  rpl: '<circle cx="12" cy="9" r="5"/><path d="m9 13.5-1.5 7 4.5-2.5 4.5 2.5-1.5-7"/>',
  kode: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 5l-3 14"/>',
  proyek: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  ujian: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v2.5H9z"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  roster: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  kepatuhan: '<path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  tutup: '<path d="M6 6l12 12M18 6 6 18"/>',
  panah: '<path d="m9 6 6 6-6 6"/>',
};
const IKON_HALAMAN = {
  './': 'beranda', 'kalender.html': 'kalender', 'materi.html': 'materi', 'kelola-materi.html': 'materi',
  'portal.html': 'tugas', 'dosen.html': 'tugas', 'kuis.html': 'kuis', 'forum.html': 'forum',
  'kurikulum.html': 'kurikulum', 'pengampu.html': 'pengampu', 'jabatan.html': 'kaprodi',
  'rekaman.html': 'rekaman', 'nilai.html': 'nilai', 'rapor.html': 'nilai', 'kaprodi.html': 'laporan',
  'kepatuhan.html': 'kepatuhan', 'dasbor.html': 'dasbor', 'kerja.html': 'kerja', 'rpl.html': 'rpl',
  'autograder.html': 'kode', 'proyek.html': 'proyek', 'ujian.html': 'ujian', 'akademik.html': 'roster',
};
const IKON_PERAN = { admin: { 'kurikulum.html': 'prodi' } };

export function svgIkon(nama) {
  return `<svg class="ikon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IKON[nama] || IKON.dokumen}</svg>`;
}

/** Nama berkas halaman ini dengan bentuk yang sama seperti href menu ("./" untuk beranda). */
export function halamanIni() {
  const akhir = location.pathname.split('/').pop();
  return !akhir || akhir === 'index.html' ? './' : akhir;
}

function labelPendek(peran, href) { return (PENDEK_PERAN[peran] || {})[href] || PENDEK[href] || href; }
function ikonHalaman(peran, href) { return (IKON_PERAN[peran] || {})[href] || IKON_HALAMAN[href] || 'dokumen'; }
function layananUntuk(peran, href) {
  for (const [, butir] of LAYANAN[peran] || []) {
    const b = butir.find(([h]) => h === href);
    if (b) return { label: b[1], ket: b[2] };
  }
  return { label: labelPendek(peran, href), ket: '' };
}

// ===== Lembar (bottom sheet) =====
let latar = null;
let lembarTerbuka = null;
let pemicuTerakhir = null;

function pastikanLatar() {
  if (latar) return latar;
  latar = document.createElement('div');
  latar.className = 'lembar-latar';
  latar.hidden = true;
  latar.addEventListener('click', () => tutupLembar());
  document.body.appendChild(latar);
  document.addEventListener('keydown', e => {
    if (!lembarTerbuka) return;
    if (e.key === 'Escape') { e.preventDefault(); tutupLembar(); return; }
    if (e.key !== 'Tab') return;
    const fokus = [...lembarTerbuka.querySelectorAll('a[href], button:not([disabled]), select, input')].filter(el => !el.closest('[hidden]'));
    if (!fokus.length) return;
    const pertama = fokus[0], terakhir = fokus[fokus.length - 1];
    if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir.focus(); }
    else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
  });
  return latar;
}

/** Membuat lembar kosong (role=dialog). Isi diletakkan di `.lembar-isi`. */
export function buatLembar(id, judul) {
  pastikanLatar();
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('section');
  el.id = id;
  el.className = 'lembar';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', `${id}-judul`);
  el.innerHTML = `<div class="lembar-kepala"><h2 id="${id}-judul">${esc(judul)}</h2>
    <button type="button" class="lembar-tutup" aria-label="Tutup">${svgIkon('tutup')}</button></div>
    <div class="lembar-isi"></div>`;
  el.querySelector('.lembar-tutup').addEventListener('click', () => tutupLembar());
  document.body.appendChild(el);
  return el;
}

export function bukaLembar(el, pemicu) {
  if (lembarTerbuka && lembarTerbuka !== el) tutupLembar(false);
  pemicuTerakhir = pemicu || null;
  lembarTerbuka = el;
  pastikanLatar().hidden = false;
  el.hidden = false;
  document.body.classList.add('lembar-terbuka');
  if (pemicu) pemicu.setAttribute('aria-expanded', 'true');
  const fokus = el.querySelector('.lembar-isi a[href], .lembar-isi button, .lembar-tutup');
  if (fokus) fokus.focus();
}

export function tutupLembar(kembalikanFokus = true) {
  if (!lembarTerbuka) return;
  lembarTerbuka.hidden = true;
  if (latar) latar.hidden = true;
  document.body.classList.remove('lembar-terbuka');
  if (pemicuTerakhir) {
    pemicuTerakhir.setAttribute('aria-expanded', 'false');
    if (kembalikanFokus) pemicuTerakhir.focus();
  }
  lembarTerbuka = null;
  pemicuTerakhir = null;
}

// ===== Navigasi =====
function htmlDaftarMenu(peran, hrefs, ini) {
  return `<ul class="daftar-menu">${hrefs.map(href => {
    const { label, ket } = layananUntuk(peran, href);
    const aktif = href === ini;
    return `<li><a href="${href}"${aktif ? ' class="aktif" aria-current="page"' : ''}>${svgIkon(ikonHalaman(peran, href))}
      <span class="daftar-menu-teks"><b>${esc(label)}</b>${ket ? `<small>${esc(ket)}</small>` : ''}</span>${svgIkon('panah')}</a></li>`;
  }).join('')}</ul>`;
}

function htmlCatatanGrup(cfg, bisaGantiDosen) {
  if (!cfg.catatan) return '';
  return `<div class="menu-catatan"><p>${esc(cfg.catatan)}</p>${bisaGantiDosen ? '<button type="button" class="tautan-tombol" data-ganti-peran="dosen">Pakai peran dosen</button>' : ''}</div>`;
}

function pasangGantiPeran(wadah, gantiPeran) {
  wadah.querySelectorAll('[data-ganti-peran]').forEach(b => b.addEventListener('click', () => gantiPeran(b.dataset.gantiPeran)));
}

let klikLuarTerpasang = false;

/**
 * Mengisi nav atas dan membuat bilah bawah + lembar grup untuk peran aktif.
 * `peran` null/kosong (tamu, sesi berakhir, nomor belum terdaftar, backend
 * tak terjangkau): nav dikosongkan dan bilah bawah tidak dibuat.
 */
export function pasangNavigasi({ peran, gantiPeran, bisaGantiDosen = false }) {
  const navAtas = document.querySelector('.appbar .navutama');
  const cfg = NAV[peran];
  document.querySelectorAll('.navbawah').forEach(el => el.remove());
  document.body.classList.remove('ada-navbawah');
  if (!navAtas || !cfg) {
    if (navAtas) navAtas.innerHTML = '';
    return;
  }
  const ini = halamanIni();
  const diGrup = cfg.grup.href.includes(ini);

  // Nav atas: item utama + tombol grup (dropdown) berisi sisanya.
  const sisaAtas = cfg.grup.href.filter(h => !cfg.atas.includes(h));
  const grupAtasAktif = sisaAtas.includes(ini) && !cfg.atas.includes(ini);
  navAtas.innerHTML = cfg.atas.map(href => {
    const aktif = href === ini;
    return `<a href="${href}"${aktif ? ' class="aktif" aria-current="page"' : ''}>${esc(labelPendek(peran, href))}</a>`;
  }).join('') + (sisaAtas.length ? `<div class="nav-grup">
      <button type="button" class="nav-grup-tombol${grupAtasAktif ? ' aktif' : ''}" aria-expanded="false" aria-controls="nav-turun">${esc(cfg.grup.label)}<svg class="ikon-kecil" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="nav-turun" id="nav-turun" hidden>${htmlDaftarMenu(peran, sisaAtas, ini)}${htmlCatatanGrup(cfg, bisaGantiDosen)}</div>
    </div>` : '');
  const tombolTurun = navAtas.querySelector('.nav-grup-tombol');
  if (tombolTurun) {
    const turun = navAtas.querySelector('.nav-turun');
    const tutupTurun = () => { turun.hidden = true; tombolTurun.setAttribute('aria-expanded', 'false'); };
    tombolTurun.addEventListener('click', e => {
      e.stopPropagation();
      const buka = turun.hidden;
      turun.hidden = !buka;
      tombolTurun.setAttribute('aria-expanded', String(buka));
    });
    turun.addEventListener('keydown', e => { if (e.key === 'Escape') { tutupTurun(); tombolTurun.focus(); } });
    pasangGantiPeran(turun, gantiPeran);
    if (!klikLuarTerpasang) {
      klikLuarTerpasang = true;
      document.addEventListener('click', e => {
        document.querySelectorAll('.nav-grup').forEach(g => {
          if (g.contains(e.target)) return;
          const t = g.querySelector('.nav-turun'); const b = g.querySelector('.nav-grup-tombol');
          if (t && !t.hidden) { t.hidden = true; b.setAttribute('aria-expanded', 'false'); }
        });
      });
    }
  }

  // Bilah bawah (HP): item bar + tombol grup yang membuka lembar.
  const bar = document.createElement('nav');
  bar.className = `navbawah kolom-${cfg.bar.length + 1}`;
  bar.setAttribute('aria-label', 'Navigasi utama');
  bar.innerHTML = cfg.bar.map(href => {
    const aktif = href === ini;
    return `<a href="${href}"${aktif ? ' class="aktif" aria-current="page"' : ''}>${svgIkon(ikonHalaman(peran, href))}<span>${esc(labelPendek(peran, href))}</span></a>`;
  }).join('') + `<button type="button" class="${diGrup && !cfg.bar.includes(ini) ? 'aktif' : ''}" aria-haspopup="dialog" aria-expanded="false" aria-controls="lembar-grup">${svgIkon(cfg.grup.ikon)}<span>${esc(cfg.grup.label)}</span></button>`;
  document.body.appendChild(bar);
  document.body.classList.add('ada-navbawah');

  const lembar = buatLembar('lembar-grup', cfg.grup.label);
  lembar.querySelector('h2').textContent = cfg.grup.label;
  const isiLembar = lembar.querySelector('.lembar-isi');
  isiLembar.innerHTML = htmlDaftarMenu(peran, cfg.grup.href, ini) + htmlCatatanGrup(cfg, bisaGantiDosen);
  pasangGantiPeran(isiLembar, gantiPeran);
  const tombolGrup = bar.querySelector('button');
  tombolGrup.addEventListener('click', () => bukaLembar(lembar, tombolGrup));
}

// Bilah bawah disembunyikan selama papan ketik HP kemungkinan terbuka (fokus
// di isian teks), supaya tidak menutupi isian yang sedang diketik.
const JENIS_BUKAN_KETIK = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);
function isianKetik(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !JENIS_BUKAN_KETIK.has((el.type || '').toLowerCase());
}
document.addEventListener('focusin', e => {
  if (isianKetik(e.target) && window.matchMedia('(max-width: 720px)').matches) document.body.classList.add('papan-ketik');
});
document.addEventListener('focusout', () => {
  setTimeout(() => { if (!isianKetik(document.activeElement)) document.body.classList.remove('papan-ketik'); }, 0);
});
