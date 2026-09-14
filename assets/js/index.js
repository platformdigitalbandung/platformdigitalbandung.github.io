import { apiGet } from './api.js';
import { sayaSekarang, peranAktif, labelPeran } from './akun.js';
import { esc, keadaanKosong } from './ui.js';
import { LAYANAN } from './menu.js';
import { terdaftar as sudahTerdaftar, langkahMulai, semuaSelesai, ringkasMulai, htmlDaftarMulai, jenisTercakup, muatTugasMahasiswa } from './hal-beranda.js';

// Beranda LMS. Isinya bergantung pada peran aktif (pemilih peran di bilah atas,
// akun.js): admin, kaprodi, dosen, atau mahasiswa — masing-masing punya agenda
// "perlu dikerjakan" dan "akan datang", menu layanan, dan daftar prodi sendiri.
// Agenda dihitung backend (GET /api/beranda/agenda) hanya untuk peran yang
// benar-benar dipegang; beranda sekadar memilih bagian yang ditampilkan.
// Sebelum masuk beranda cuma menampilkan sambutan (keputusan pemilik produk
// 2026-09-14; backend juga menolak tanpa token). Tidak ada form login di sini —
// tombol Masuk di bilah atas (akun.js) mengarahkan ke /login/.

const ZONA = 'Asia/Jakarta';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Tanggal sesi disimpan sebagai tengah malam UTC dari tanggal kalendernya, jadi
// 10 karakter pertama ISO-nya adalah tanggal yang dimaksud.
function tanggalSesi(iso) { return String(iso || '').slice(0, 10); }
function hariIniYMD() { return new Date().toLocaleDateString('en-CA', { timeZone: ZONA }); }
function tampilTanggal(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}
function selisihHari(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 86400000); }
function waktuWIB(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: ZONA }) + ' WIB';
}

const KEGIATAN = {
  asinkron: ['Belajar mandiri', 'asinkron'],
  daring_sinkron: ['Kelas daring bersama dosen', 'daring'],
  opsional_luring_daring: ['Praktikum dan kerja proyek', 'luring/daring'],
  bebas: ['Tanpa agenda akademik', ''],
};

// Menu layanan per peran aktif: satu sumber dengan navigasi (menu.js), supaya
// Beranda, nav atas, dan bilah bawah HP tidak pernah berbeda.

const CATATAN_PERAN = {
  kaprodi: 'Menu mengajar — materi, kuis, tugas, dan penilaian — ada di peran dosen. Ganti lewat pemilih peran di pojok kanan atas.',
  admin: 'Admin hanya menyiapkan prodi dan kaprodinya. Menu mengajar ada di peran dosen, lewat pemilih peran di pojok kanan atas.',
};

function htmlKelompok(judul, butir) {
  return `<div class="kelompok"><h3>${esc(judul)}</h3><ul class="daftar-layanan">
    ${butir.map(([href, nama, ket]) => `<li><a href="${href}"><b>${esc(nama)}</b><span>${esc(ket)}</span></a></li>`).join('')}
  </ul></div>`;
}

function tampilLayanan(peran) {
  document.getElementById('layanan').innerHTML = (LAYANAN[peran] || []).map(([j, b]) => htmlKelompok(j, b)).join('');
  const catatan = document.getElementById('catatan-peran');
  catatan.textContent = CATATAN_PERAN[peran] || '';
  catatan.hidden = !CATATAN_PERAN[peran];
}

// Perintah bot WhatsApp per peran (audit UX U20). Kaprodi dan admin belum punya
// perintah laporan lewat WhatsApp, jadi panelnya disembunyikan untuk mereka.
const PERINTAH_WA = {
  mahasiswa: [
    ['kalender minggu ini', 'Jadwal minggu ini'],
    ['daftar tugas', 'Tugas yang masih terbuka'],
    ['nilai saya', 'Rekap nilai proyek'],
    ['tanya forum | rumpun R1 | minggu 3 | Apa maksud kuis gerbang?', 'Bertanya ke dosen: rumpun, minggu, lalu pertanyaan'],
  ],
  dosen: [
    ['forum belum dijawab', 'Pertanyaan mahasiswa yang menunggu jawaban'],
    ['daftar proyek saya', 'Proyek blok yang Anda bimbing'],
    ['status proyek kerja', 'Proyek kerja bimbingan dan statusnya'],
    ['daftar tugas', 'Tugas yang masih terbuka'],
  ],
};

function tampilWhatsApp(peran) {
  const perintah = PERINTAH_WA[peran];
  document.getElementById('panel-wa').hidden = !perintah;
  if (!perintah) return;
  document.getElementById('perintah-wa').innerHTML = perintah
    .map(([kode, ket]) => `<li><code>${esc(kode)}</code><span class="kecil">${esc(ket)}</span></li>`).join('');
}

// ===== Agenda =====

// Tautan agenda datang dari backend; hanya halaman situs ini yang diikuti.
function tautanAman(t) {
  return /^[a-z0-9-]+\.html(?:[?#][\w=&%.,:+\-/]*)?$/i.test(String(t || '')) ? t : 'saya.html';
}

// Urutan butir datang dari backend dan ditampilkan apa adanya: bagian kaprodi
// diurut menurut ketergantungan (kurikulum, pengampu, kalender, laporan),
// bagian lain mendesak dan tenggat terdekat dulu.
function htmlButir(b) {
  const label = [
    b.mendesak ? '<span class="lencana tinggi">Mendesak</span>' : '',
    b.prodi_kode ? `<span class="lencana">${esc(String(b.prodi_kode).toUpperCase())}</span>` : '',
  ].join('');
  const rincian = [
    b.keterangan ? esc(b.keterangan) : '',
    b.tenggat ? `Tenggat ${esc(waktuWIB(b.tenggat))}` : '',
  ].filter(Boolean).join(' · ');
  return `<li class="agenda-butir${b.mendesak ? ' mendesak' : ''}">
    <a href="${esc(tautanAman(b.tautan))}">
      ${b.jumlah > 0
        ? `<span class="agenda-jumlah" aria-label="${esc(b.jumlah)} butir">${esc(b.jumlah)}</span>`
        : `<span class="agenda-tanda ${b.sifat === 'akan' ? 'tanda-akan' : 'tanda-perlu'}" aria-hidden="true"></span>`}
      <span class="agenda-teks"><b>${esc(b.judul)}</b>${label}${rincian ? `<span class="agenda-rincian">${rincian}</span>` : ''}</span>
    </a></li>`;
}

function htmlDaftarAgenda(daftar) {
  return `<ul class="daftar-agenda">${daftar.map(htmlButir).join('')}</ul>`;
}

// "Perlu dikerjakan" yang kosong hanya berbunyi "beres" kalau agenda memang
// bisa dihitung. Tanpa kalender terbit (atau di luar minggu perkuliahan) tidak
// ada minggu berjalan, jadi materi dan kuis per minggu belum diperiksa sama
// sekali — itu dikatakan apa adanya (audit UX U02).
function htmlPerluKosong(agenda, peran, bagian, saya, adaDiMulai) {
  const minggu = Number(agenda.minggu_berjalan) || 0;
  const kalender = bagian.find(b => b.jenis === 'kalender_belum_terbit');
  // Butir yang sudah tampil sebagai langkah di "Mulai di sini" tidak diulang;
  // pesannya pun tidak mengklaim semuanya beres.
  const beres = teks => (adaDiMulai
    ? '<p class="pesan-kosong">Tidak ada hal lain yang perlu dikerjakan selain langkah di <b>Mulai di sini</b>.</p>'
    : `<p class="pesan-kosong agenda-beres">${esc(teks)}</p>`);
  if (peran === 'mahasiswa') {
    const prodi = String(saya.prodi_kode || '').toUpperCase();
    if (kalender) {
      return keadaanKosong({
        judul: 'Agenda mingguan belum bisa dihitung',
        keterangan: `Kalender semester ${prodi} belum diterbitkan, jadi materi dan kuis gerbang pekan ini belum ada. Agenda mingguan muncul di sini setelah kaprodi menerbitkan kalender prodi.`,
        siapa: `kaprodi ${prodi}`,
        aksi: [{ href: 'kalender.html', label: 'Lihat kalender' }, { href: 'forum.html', label: 'Tanya di forum' }],
      });
    }
    if (!minggu) {
      return keadaanKosong({
        judul: 'Sedang tidak ada minggu perkuliahan',
        keterangan: 'Materi dan kuis gerbang diperiksa per minggu perkuliahan. Agendanya muncul lagi saat minggu perkuliahan berjalan.',
        aksi: { href: 'kalender.html', label: 'Lihat kalender' },
      });
    }
    return beres(`Tidak ada yang perlu dikerjakan: materi dan kuis gerbang minggu ${minggu} sudah beres.`);
  }
  if (peran === 'dosen') {
    if (kalender) {
      return keadaanKosong({
        judul: 'Agenda mingguan belum bisa dihitung',
        keterangan: `${kalender.judul}. Agenda mingguan (materi dan kuis per minggu) muncul setelah kaprodi menerbitkan kalender prodi. Anda sudah bisa menyiapkan materi dan kuis minggu 1.`,
        siapa: 'kaprodi prodi tempat Anda mengajar',
        aksi: [{ href: 'kelola-materi.html', label: 'Kelola materi' }, { href: 'kuis.html', label: 'Susun kuis' }],
      });
    }
    return beres(minggu
      ? 'Tidak ada yang perlu dikerjakan: pertanyaan forum, rekaman, pengajuan, serta materi dan kuis minggu ini dan depan sudah tertangani.'
      : 'Tidak ada yang perlu dikerjakan saat ini: pertanyaan forum, rekaman, dan pengajuan sudah tertangani. Sedang tidak ada minggu perkuliahan berjalan.');
  }
  if (peran === 'admin') return beres('Tidak ada yang perlu dikerjakan: semua prodi sudah punya kaprodi dan semua dosen aktif sudah mengisi email kampus.');
  return beres('Tidak ada yang perlu dikerjakan untuk prodi Anda saat ini: kurikulum, dosen pengampu, dan kalender sudah siap.');
}

function tampilAgenda(agenda, peran, saya, tercakup) {
  const bagian = Array.isArray(agenda[peran]) ? agenda[peran] : [];
  const tampil = bagian.filter(b => !tercakup.has(b.jenis));
  const perlu = tampil.filter(b => b.sifat === 'perlu');
  const akan = tampil.filter(b => b.sifat === 'akan');
  const adaDiMulai = bagian.some(b => b.sifat === 'perlu' && tercakup.has(b.jenis));
  document.getElementById('agenda-perlu').innerHTML = perlu.length
    ? htmlDaftarAgenda(perlu)
    : htmlPerluKosong(agenda, peran, bagian, saya, adaDiMulai);
  const mendesak = perlu.filter(b => b.mendesak).length;
  document.getElementById('jumlah-perlu').textContent = perlu.length
    ? `${perlu.length} hal${mendesak ? ` · ${mendesak} mendesak` : ''}` : '';
  document.getElementById('agenda-akan').innerHTML = akan.length
    ? htmlDaftarAgenda(akan)
    : '<p class="pesan-kosong">Belum ada agenda terjadwal.</p>';
}

// Checklist "Mulai di sini": langkah awal peran aktif, disembunyikan bila
// semua langkah berstatus sudah selesai (audit UX U09, §3.3).
// Mengembalikan jenis butir agenda yang sudah diwakili checklist (kosong bila
// checklist disembunyikan), supaya agenda tidak mengulangnya.
function tampilMulai(peran, saya, agenda, tugas) {
  const langkah = langkahMulai(peran, saya, agenda, tugas);
  const panel = document.getElementById('panel-mulai');
  if (semuaSelesai(langkah)) { panel.hidden = true; return new Set(); }
  document.getElementById('ringkas-mulai').textContent = ringkasMulai(langkah);
  document.getElementById('mulai').innerHTML = htmlDaftarMulai(langkah);
  panel.hidden = false;
  return jenisTercakup(langkah);
}

async function muatAgenda(peran, saya) {
  try {
    const [agenda, tugas] = await Promise.all([apiGet('/api/beranda/agenda', { auth: true }), muatTugasMahasiswa(peran)]);
    const tercakup = tampilMulai(peran, saya, agenda || {}, tugas);
    tampilAgenda(agenda || {}, peran, saya, tercakup);
  } catch (err) {
    const sebab = err.status === 404 ? '' : ` (${esc(err.message)})`;
    document.getElementById('agenda-perlu').innerHTML = `<p class="pesan-kosong">Agenda belum tersedia${sebab}. Menu layanan di bawah tetap bisa dipakai.</p>`;
    document.getElementById('panel-akan').hidden = true;
  }
}

// ===== Jadwal =====

// Minggu yang ditampilkan: minggu yang memuat hari ini; kalau hari ini tanpa
// sesi, minggu dari sesi terakhir yang lewat (maks. 7 hari). Sebelum semester
// mulai ditampilkan minggu pertama; sesudah berakhir, tidak ada tabel.
function mingguAcuan(sesi, hariIni) {
  const urut = [...sesi].sort((a, b) => tanggalSesi(a.tanggal).localeCompare(tanggalSesi(b.tanggal)));
  if (!urut.length) return { status: 'kosong' };
  const pertama = tanggalSesi(urut[0].tanggal);
  const terakhir = tanggalSesi(urut[urut.length - 1].tanggal);
  if (hariIni < pertama) return { status: 'belum', minggu: urut[0].minggu, mulai: pertama };
  if (hariIni > terakhir) return { status: 'selesai', selesai: terakhir };
  const lewat = urut.filter(s => tanggalSesi(s.tanggal) <= hariIni);
  const acuan = lewat[lewat.length - 1];
  if (selisihHari(hariIni, tanggalSesi(acuan.tanggal)) > 7) return { status: 'jeda' };
  return { status: 'berjalan', minggu: acuan.minggu };
}

function tampilJadwal(kal) {
  const wadah = document.getElementById('jadwal');
  const hariIni = hariIniYMD();
  const acuan = mingguAcuan(kal.sesi || [], hariIni);
  if (acuan.status === 'kosong') { wadah.innerHTML = '<p class="pesan-kosong">Kalender ini belum punya sesi.</p>'; return; }
  if (acuan.status === 'selesai') { wadah.innerHTML = `<p class="pesan-kosong">Masa perkuliahan semester ini berakhir ${esc(tampilTanggal(acuan.selesai))}.</p>`; return; }
  if (acuan.status === 'jeda') { wadah.innerHTML = '<p class="pesan-kosong">Tidak ada sesi terjadwal minggu ini.</p>'; return; }

  const baris = kal.sesi.filter(s => s.minggu === acuan.minggu)
    .sort((a, b) => tanggalSesi(a.tanggal).localeCompare(tanggalSesi(b.tanggal)));
  const catatan = acuan.status === 'belum'
    ? `<p class="pesan-kosong">Perkuliahan dimulai ${esc(tampilTanggal(acuan.mulai))}. Berikut jadwal minggu pertama.</p>` : '';
  wadah.innerHTML = `${catatan}<div class="gulir"><table class="jadwal">
    <tr><th>Hari</th><th>Tanggal</th><th>Kegiatan</th><th>Waktu</th></tr>
    ${baris.map(s => {
      const tgl = tanggalSesi(s.tanggal);
      const [nama, label] = KEGIATAN[s.moda] || [s.moda, ''];
      const kelas = [tgl === hariIni ? 'hari-ini' : '', s.moda === 'bebas' ? 'libur' : ''].filter(Boolean).join(' ');
      return `<tr${kelas ? ` class="${kelas}"` : ''}>
        <td>${esc(s.hari)}${tgl === hariIni ? '<span class="label-moda label-hari-ini">hari ini</span>' : ''}</td>
        <td>${esc(tampilTanggal(tgl))}</td>
        <td>${esc(nama)}${label ? `<span class="label-moda">${esc(label)}</span>` : ''}${s.keterangan ? `<br><span class="redup">${esc(s.keterangan)}</span>` : ''}</td>
        <td class="waktu">${s.jam_mulai ? `${esc(s.jam_mulai)}–${esc(s.jam_selesai || '')}` : '–'}</td></tr>`;
    }).join('')}
  </table></div>`;
  document.getElementById('judul-jadwal').textContent = `Jadwal minggu ${acuan.minggu}`;
}

// prodiLingkup: kode prodi yang relevan untuk peran aktif; null berarti semua.
async function muatJadwal(prodiLingkup) {
  const wadah = document.getElementById('jadwal');
  // Dosen yang belum dicentang pengampu prodi mana pun tidak diberi jadwal semua
  // prodi (keputusan pemilik produk 2026-09-15): jadwal tampil setelah dicentang.
  if (prodiLingkup && !prodiLingkup.length && peranAktif(saya) === 'dosen') {
    wadah.innerHTML = keadaanKosong({
      judul: 'Jadwal tampil setelah Anda dicentang sebagai pengampu',
      keterangan: 'Jadwal mingguan hanya menampilkan kalender prodi tempat Anda mengajar. Minta kaprodi prodi tersebut mencentang nama Anda di halaman Dosen Pengampu Prodi.',
      siapa: 'kaprodi prodi tempat Anda mengajar',
      aksi: { href: 'saya.html#pengampu', label: 'Cara dicentang pengampu' },
    });
    return;
  }
  try {
    const { kalender: semua = [] } = await apiGet('/api/kalender');
    const kalender = prodiLingkup ? semua.filter(k => prodiLingkup.includes(k.prodi_kode)) : semua;
    if (!kalender.length) {
      wadah.innerHTML = prodiLingkup
        ? `<p class="pesan-kosong">Belum ada kalender akademik terbit untuk ${esc(prodiLingkup.join(', ').toUpperCase())}.</p>`
        : '<p class="pesan-kosong">Belum ada kalender akademik yang diterbitkan.</p>';
      return;
    }
    const pilih = document.getElementById('pilih-kalender');
    pilih.innerHTML = kalender.map((k, i) =>
      `<option value="${i}">${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)}</option>`).join('');
    pilih.value = '0';
    pilih.hidden = kalender.length < 2;
    pilih.addEventListener('change', () => tampilJadwal(kalender[Number(pilih.value)]));
    tampilJadwal(kalender[0]);
  } catch (err) {
    wadah.innerHTML = `<p class="pesan-kosong">Jadwal tidak bisa dimuat: ${esc(err.message)}</p>`;
  }
}

// ===== Program studi =====

// Admin melihat ringkasan penyiapan: siapa kaprodi tiap prodi. Nama diambil dari
// GET /api/jabatan/dosen (khusus admin/kaprodi), yang juga mengenali kaprodi
// lama yang masih dirujuk lewat NIP — kaprodi_email saja belum cukup.
async function kaprodiPerProdi() {
  const peta = {};
  try {
    const { dosen = [] } = await apiGet('/api/jabatan/dosen', { auth: true });
    dosen.forEach(d => (d.kaprodi_prodi || []).forEach(k => { peta[k] = d.nama + (d.email ? '' : ' (belum mengisi email)'); }));
  } catch { /* ringkasan tanpa nama kaprodi */ }
  return peta;
}

async function muatProdi(prodiLingkup, peran) {
  const wadah = document.getElementById('prodi');
  try {
    const [{ prodi: semua = [] }, kaprodi] = await Promise.all([
      apiGet('/api/kurikulum/prodi'),
      peran === 'admin' ? kaprodiPerProdi() : Promise.resolve({}),
    ]);
    const prodi = prodiLingkup ? semua.filter(p => prodiLingkup.includes(p.kode)) : semua;
    if (!prodi.length) { wadah.innerHTML = '<li class="redup">Data program studi belum tersedia.</li>'; return; }
    wadah.innerHTML = prodi.map(p => {
      let status = '';
      if (peran === 'admin') {
        const nama = kaprodi[p.kode] || p.kaprodi_email;
        status = nama ? `<span class="kecil">Kaprodi: ${esc(nama)}</span>` : '<span class="lencana sedang">Belum ada kaprodi</span>';
      }
      return `<li>${esc(p.nama)}<span class="kecil">${esc(p.jenjang)} · ${esc(p.sks_total)} SKS · ${esc(p.semester)} semester</span>${status}</li>`;
    }).join('');
  } catch (err) {
    wadah.innerHTML = `<li class="redup">Tidak bisa dimuat: ${esc(err.message)}</li>`;
  }
}

function lingkupProdi(saya, peran) {
  if (peran === 'admin') return null;
  if (peran === 'kaprodi') return saya.kaprodi_prodi || [];
  if (peran === 'mahasiswa') return saya.prodi_kode ? [saya.prodi_kode] : [];
  const mengajar = saya.prodi_mengajar || [];
  return mengajar.length ? mengajar : null;
}

const hariIniTeks = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
document.getElementById('hari-ini').textContent = hariIniTeks;

// Status akun di bilah atas diurus akun.js; beranda cukup memakai hasilnya.
// Belum masuk, token kedaluwarsa, atau nomor tak terdaftar: hanya sambutan.
const saya = await sayaSekarang;
// /api/proyekblok/saya menjawab peran "mahasiswa" juga untuk nomor yang tidak
// terdaftar; prodi_kode hanya terisi untuk mahasiswa yang ada di roster.
if (sudahTerdaftar(saya)) {
  const peran = peranAktif(saya);
  const lingkup = lingkupProdi(saya, peran);
  const label = peran === 'mahasiswa' ? `mahasiswa ${String(saya.prodi_kode || '').toUpperCase()}`.trim() : labelPeran(saya);
  document.getElementById('judul-beranda').textContent = `Beranda ${label}`;
  document.title = `Beranda ${label} — Platform Digital Bandung`;

  const panel = ['panel-perlu', 'panel-akan', 'panel-layanan', 'panel-prodi'];
  // Admin tidak mengajar: tanpa jadwal mingguan, diganti ringkasan prodi di samping.
  if (peran !== 'admin') panel.push('panel-jadwal');
  panel.forEach(id => { document.getElementById(id).hidden = false; });
  if (peran === 'admin') document.getElementById('judul-prodi').textContent = 'Penyiapan program studi';

  tampilLayanan(peran);
  tampilWhatsApp(peran);
  muatAgenda(peran, saya);
  muatProdi(lingkup, peran);
  if (peran !== 'admin') muatJadwal(peran === 'dosen' ? (saya.prodi_mengajar || []) : lingkup);
} else {
  // Tamu dan nomor tak terdaftar diberi tahu siapa yang mendaftarkan: tidak ada
  // pendaftaran mandiri (pdb/README.md bagian Frontend).
  if (saya) {
    document.getElementById('judul-belum-masuk').textContent = 'Nomor belum terdaftar';
    document.getElementById('pesan-belum-masuk').textContent =
      'Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen, jadi belum ada jadwal dan layanan yang bisa ditampilkan.';
  }
  document.getElementById('panel-belum-masuk').hidden = false;
}
