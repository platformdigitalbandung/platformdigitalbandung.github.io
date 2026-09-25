// Menu navigasi — SATU sumber untuk nav atas di layar lebar (header
// nav.navutama) dan bilah navigasi bawah + lembar "Menu" di HP (<= 720px).
//
// Sejak 2026-09-26 (keputusan developer Arfan; membalik menu per peran aktif
// dan pemilih peran 2026-09-15): TIDAK ada pemilih peran. Menu utama
// ditentukan peran dasar (mahasiswa atau dosen), lalu ditambah bagian sesuai
// jabatan yang DIPEGANG — "Prodi" untuk kaprodi, "Admin" untuk admin — dan
// "Lainnya" untuk pekerjaan yang jarang dibuka. Materi, kuis, dan tugas tidak
// punya menu sendiri lagi: semuanya dibuka dari dalam kelas.
//
// Tamu, sesi berakhir, dan nomor yang belum terdaftar TIDAK mendapat menu
// aplikasi (keputusan pemilik produk 2026-09-15). Kewenangan tetap diputuskan
// backend; menu hanya memilih tautan yang relevan.
//
// Modul ini sengaja tidak meng-import akun.js/ui.js (akun.js yang memanggil
// modul ini), supaya tidak ada import melingkar.

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// Butir menu: [href, label pendek, label lengkap, keterangan, ikon].
const B = {
  beranda: ['./', 'Beranda', 'Beranda', 'Yang perlu dikerjakan hari ini', 'beranda'],
  kelas: ['kelas.html', 'Kelas', 'Kelas', 'Materi, kuis, tugas, pengumuman, dan nilai per kelas', 'kelas'],
  jadwal: ['kalender.html', 'Jadwal', 'Jadwal', 'Kalender semester', 'kalender'],
  nilai: ['rapor.html', 'Nilai', 'Nilai', 'Rapor per semester dan IPK', 'nilai'],
  dasbor: ['dasbor.html', 'Dasbor', 'Dasbor belajar', 'Beban belajar dan capaian CPL', 'dasbor'],
  rekaman: ['rekaman.html', 'Rekaman', 'Rekaman sesi', 'Kelas daring yang terekam', 'rekaman'],
  kerja: ['kerja.html', 'Proyek kerja', 'Proyek kerja / magang', 'Pekerjaan di tempat kerja yang diakui sebagai proyek', 'kerja'],
  rpl: ['rpl.html', 'RPL', 'Rekognisi pembelajaran lampau', 'Pengakuan pengalaman kerja', 'rpl'],
  autograder: ['autograder.html', 'Autograder', 'Hasil autograder', 'Tes otomatis kode praktikum', 'kode'],
  semuaTugas: ['portal.html', 'Tugas', 'Semua tugas', 'Tugas dari semua kelas', 'tugas'],
  // Dosen
  ujian: ['ujian.html', 'Ujian', 'Pengawas ujian', 'Jadwal dan kehadiran ujian', 'ujian'],
  kerjaDosen: ['kerja.html', 'Proyek kerja', 'Proyek kerja bimbingan', 'Putusan dan tinjauan', 'kerja'],
  rplDosen: ['rpl.html', 'RPL', 'Tinjau RPL', 'Pengajuan yang menunggu', 'rpl'],
  roster: ['akademik.html', 'Roster', 'Roster dan email dosen', 'Data mahasiswa dan email kampus Anda', 'roster'],
  raporDosen: ['rapor.html', 'Rapor', 'Rapor mahasiswa', 'Rapor per NIM', 'nilai'],
  rekamanDosen: ['rekaman.html', 'Rekaman', 'Rekaman sesi', 'Terbitkan sebelum tenggat', 'rekaman'],
  autograderDosen: ['autograder.html', 'Autograder', 'Autograder', 'Hasil tes otomatis dan bobot', 'kode'],
  kurikulumBaca: ['kurikulum.html', 'Kurikulum', 'Kurikulum', 'Program studi dan data kurikulumnya', 'kurikulum'],
  // Kaprodi (bagian Prodi)
  kurikulum: ['kurikulum.html', 'Kurikulum', 'Kurikulum program studi', 'Rumpun, mata kuliah, CPL, dan ritme', 'kurikulum'],
  pengguna: ['pengguna.html', 'Pengguna', 'Pengguna', 'Mahasiswa dan dosen, reset kata sandi', 'pengguna'],
  pantauKerja: ['kaprodi.html', 'Proyek kerja', 'Pantau proyek kerja', 'Tinjauan tengah semester', 'laporan'],
  kepatuhan: ['kepatuhan.html', 'Kepatuhan', 'Laporan kepatuhan', 'Menit per mata kuliah untuk akreditasi', 'kepatuhan'],
  rekapRapor: ['rapor.html', 'Rapor', 'Rekap rapor angkatan', 'Nilai huruf dan IP per semester', 'nilai'],
  rekapRekaman: ['rekaman.html', 'Rekaman', 'Rekap rekaman', 'Sesi daring yang terlambat direkam', 'rekaman'],
  // Admin
  kaprodiAdmin: ['jabatan.html', 'Kaprodi', 'Kelola kaprodi', 'Tetapkan atau ganti kaprodi tiap prodi', 'kaprodi'],
  prodiBaru: ['kurikulum.html?baru=1', 'Prodi baru', 'Program studi baru', 'Buat prodi, lalu serahkan ke kaprodinya', 'prodi'],
};

/** Butir khusus prodi: Kelola Kelas dan kalender prodi yang dipimpin. */
function butirProdi(kode) {
  const K = String(kode).toUpperCase();
  return [
    [`kelas.html?kelola=${encodeURIComponent(kode)}`, 'Kelola kelas', `Kelola kelas ${K}`, 'Tunjuk pengajar, atur peserta, buka kelas tiap periode', 'kelas'],
    [`kalender.html?prodi=${encodeURIComponent(kode)}`, 'Kalender', `Kalender ${K}`, 'Susun dan terbitkan kalender semester', 'kalender'],
  ];
}

/**
 * Menu untuk data GET /api/proyekblok/saya: { utama: [butir], bagian:
 * [{ judul, butir }] }. Bagian urut Prodi, Admin, Lainnya; href yang sudah
 * tampil di bagian sebelumnya (atau di menu utama) tidak diulang.
 */
export function menuUntuk(saya) {
  if (!saya) return null;
  if (saya.peran !== 'dosen') {
    return {
      utama: [B.beranda, B.kelas, B.jadwal, B.nilai],
      bagian: [{ judul: 'Lainnya', butir: [B.semuaTugas, B.dasbor, B.rekaman, B.kerja, B.rpl, B.autograder] }],
    };
  }
  const jab = saya.jabatan || [];
  const bagian = [];
  const dipimpin = saya.kaprodi_prodi || [];
  if (jab.includes('kaprodi') && dipimpin.length) {
    bagian.push({
      judul: `Prodi ${dipimpin.join('/').toUpperCase()}`,
      butir: [...dipimpin.flatMap(butirProdi), B.kurikulum, B.pengguna, B.pantauKerja, B.kepatuhan, B.rekapRapor, B.rekapRekaman],
    });
  }
  if (jab.includes('admin')) {
    bagian.push({ judul: 'Admin', butir: [B.pengguna, B.kaprodiAdmin, B.prodiBaru, B.pantauKerja, B.kepatuhan, B.rekapRapor, B.rekapRekaman] });
  }
  bagian.push({
    judul: 'Lainnya',
    butir: [B.semuaTugas, B.rekamanDosen, B.ujian, B.kerjaDosen, B.rplDosen, B.roster, B.raporDosen, B.autograderDosen, B.kurikulumBaca],
  });
  const utama = [B.beranda, B.kelas, B.jadwal];
  const ada = new Set(utama.map(b => b[0]));
  for (const bg of bagian) {
    bg.butir = bg.butir.filter(b => !ada.has(b[0]));
    bg.butir.forEach(b => ada.add(b[0]));
  }
  return { utama, bagian: bagian.filter(bg => bg.butir.length) };
}

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
  kelas: '<rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M8 20.5h8M12 15.5v5"/><path d="M7 9h6M7 12h4"/>',
  pengguna: '<circle cx="8.5" cy="8" r="3.5"/><path d="M2.5 20a6 6 0 0 1 12 0"/><path d="M15.5 8.5h6M15.5 12.5h6M17.5 16.5h4"/>',
  sandi: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
  tutup: '<path d="M6 6l12 12M18 6 6 18"/>',
  panah: '<path d="m9 6 6 6-6 6"/>',
};

export function svgIkon(nama) {
  return `<svg class="ikon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IKON[nama] || IKON.dokumen}</svg>`;
}

/** Nama berkas halaman ini dengan bentuk yang sama seperti href menu ("./" untuk beranda). */
export function halamanIni() {
  const akhir = location.pathname.split('/').pop();
  return !akhir || akhir === 'index.html' ? './' : akhir;
}

/**
 * Butir menu cocok dengan halaman ini. Href berquery (mis. kelas.html?kelola=trpl)
 * hanya cocok bila query-nya sama; href tanpa query tidak cocok dengan halaman
 * yang dibuka lewat butir berquery (Kelas vs Kelola kelas).
 */
function cocok(href) {
  const [berkas, query = ''] = href.split('?');
  if (berkas !== halamanIni()) return false;
  const kini = new URLSearchParams(location.search);
  if (!query) return !kini.has('kelola') && !kini.has('baru');
  return [...new URLSearchParams(query)].every(([k, v]) => kini.get(k) === v);
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
function htmlDaftarMenu(butir) {
  return `<ul class="daftar-menu">${butir.map(([href, , label, ket, ikon]) => {
    const aktif = cocok(href);
    return `<li><a href="${esc(href)}"${aktif ? ' class="aktif" aria-current="page"' : ''}>${svgIkon(ikon)}
      <span class="daftar-menu-teks"><b>${esc(label)}</b>${ket ? `<small>${esc(ket)}</small>` : ''}</span>${svgIkon('panah')}</a></li>`;
  }).join('')}</ul>`;
}

function htmlBagian(bagian, berjudul) {
  return bagian.map(bg => `${berjudul ? `<h3 class="menu-bagian-judul">${esc(bg.judul)}</h3>` : ''}${htmlDaftarMenu(bg.butir)}`).join('');
}

let klikLuarTerpasang = false;

/**
 * Mengisi nav atas (menu utama + satu tombol turun per bagian) dan membuat
 * bilah bawah + lembar "Menu" untuk HP. `saya` null (tamu, sesi berakhir,
 * nomor belum terdaftar, backend tak terjangkau): nav dikosongkan dan bilah
 * bawah tidak dibuat.
 */
export function pasangNavigasi(saya) {
  const navAtas = document.querySelector('.appbar .navutama');
  const menu = menuUntuk(saya);
  document.querySelectorAll('.navbawah').forEach(el => el.remove());
  document.body.classList.remove('ada-navbawah');
  if (!navAtas || !menu) {
    if (navAtas) navAtas.innerHTML = '';
    return;
  }

  // Nav atas: menu utama + tombol turun tiap bagian.
  navAtas.innerHTML = menu.utama.map(([href, pendek]) =>
    `<a href="${esc(href)}"${cocok(href) ? ' class="aktif" aria-current="page"' : ''}>${esc(pendek)}</a>`).join('')
    + menu.bagian.map((bg, i) => {
      const aktif = bg.butir.some(([href]) => cocok(href));
      return `<div class="nav-grup">
        <button type="button" class="nav-grup-tombol${aktif ? ' aktif' : ''}" aria-expanded="false" aria-controls="nav-turun-${i}">${esc(bg.judul)}<svg class="ikon-kecil" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-turun" id="nav-turun-${i}" hidden>${htmlDaftarMenu(bg.butir)}</div>
      </div>`;
    }).join('');
  navAtas.querySelectorAll('.nav-grup').forEach(grup => {
    const tombol = grup.querySelector('.nav-grup-tombol');
    const turun = grup.querySelector('.nav-turun');
    tombol.addEventListener('click', e => {
      e.stopPropagation();
      const buka = turun.hidden;
      navAtas.querySelectorAll('.nav-turun').forEach(t => { t.hidden = true; });
      navAtas.querySelectorAll('.nav-grup-tombol').forEach(b => b.setAttribute('aria-expanded', 'false'));
      turun.hidden = !buka;
      tombol.setAttribute('aria-expanded', String(buka));
    });
    turun.addEventListener('keydown', e => {
      if (e.key === 'Escape') { turun.hidden = true; tombol.setAttribute('aria-expanded', 'false'); tombol.focus(); }
    });
  });
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

  // Bilah bawah (HP): menu utama + tombol "Menu" yang membuka semua bagian.
  const diBagian = menu.bagian.some(bg => bg.butir.some(([href]) => cocok(href)));
  const bar = document.createElement('nav');
  bar.className = `navbawah kolom-${menu.utama.length + 1}`;
  bar.setAttribute('aria-label', 'Navigasi utama');
  bar.innerHTML = menu.utama.map(([href, pendek, , , ikon]) =>
    `<a href="${esc(href)}"${cocok(href) ? ' class="aktif" aria-current="page"' : ''}>${svgIkon(ikon)}<span>${esc(pendek)}</span></a>`).join('')
    + `<button type="button" class="${diBagian ? 'aktif' : ''}" aria-haspopup="dialog" aria-expanded="false" aria-controls="lembar-grup">${svgIkon('lainnya')}<span>Menu</span></button>`;
  document.body.appendChild(bar);
  document.body.classList.add('ada-navbawah');

  const lembar = buatLembar('lembar-grup', 'Menu');
  lembar.querySelector('.lembar-isi').innerHTML = htmlBagian(menu.bagian, true);
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
