import { apiGet } from './api.js';
import { sayaSekarang, peranAktif, labelPeran } from './akun.js';

// Beranda LMS. Isinya bergantung pada peran aktif (pemilih peran di bilah atas,
// akun.js): admin, kaprodi, dosen, atau mahasiswa — masing-masing punya agenda
// "perlu dikerjakan" dan "akan datang", menu layanan, dan daftar prodi sendiri.
// Agenda dihitung backend (GET /api/beranda/agenda) hanya untuk peran yang
// benar-benar dipegang; beranda sekadar memilih bagian yang ditampilkan.
// Sebelum masuk beranda cuma menampilkan sambutan (keputusan pemilik produk
// 2026-09-14; backend juga menolak tanpa token). Tidak ada form login di sini —
// tombol Masuk di bilah atas (akun.js) mengarahkan ke /login/.

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

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

// Menu layanan per peran aktif. Laporan tingkat prodi (kaprodi.html,
// kepatuhan.html, rekap rapor, SLA forum, rekap rekaman) hanya untuk kaprodi
// dan admin — halamannya sendiri berganti ke tampilan laporan untuk peran itu,
// dan backend tetap menolak 403 untuk yang lain.
const LAYANAN = {
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

// ===== Agenda =====

// Tautan agenda datang dari backend; hanya halaman situs ini yang diikuti.
function tautanAman(t) {
  return /^[a-z0-9-]+\.html(?:[?#][\w=&%.,:+\-/]*)?$/i.test(String(t || '')) ? t : 'saya.html';
}

function urutAgenda(daftar) {
  const waktu = b => (b.tenggat ? Date.parse(b.tenggat) || Infinity : Infinity);
  return daftar.map((b, i) => [b, i])
    .sort(([a, i], [b, j]) => (Number(!!b.mendesak) - Number(!!a.mendesak)) || (waktu(a) - waktu(b)) || (i - j))
    .map(([b]) => b);
}

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
      ${b.jumlah > 0 ? `<span class="agenda-jumlah" aria-label="${esc(b.jumlah)} butir">${esc(b.jumlah)}</span>` : '<span class="agenda-jumlah kosong-jumlah" aria-hidden="true">•</span>'}
      <span class="agenda-teks"><b>${esc(b.judul)}</b>${label}${rincian ? `<span class="agenda-rincian">${rincian}</span>` : ''}</span>
    </a></li>`;
}

function htmlDaftarAgenda(daftar) {
  return `<ul class="daftar-agenda">${urutAgenda(daftar).map(htmlButir).join('')}</ul>`;
}

const KOSONG_PERLU = {
  admin: 'Tidak ada yang perlu dikerjakan. Semua prodi sudah punya kaprodi dan penyiapan sudah beres.',
  kaprodi: 'Tidak ada yang perlu dikerjakan untuk prodi Anda saat ini.',
  dosen: 'Tidak ada yang perlu dikerjakan. Pertanyaan, rekaman, dan pengajuan sudah tertangani.',
  mahasiswa: 'Tidak ada yang perlu dikerjakan. Materi, kuis, dan tugas pekan ini sudah beres.',
};

function tampilAgenda(agenda, peran) {
  const bagian = Array.isArray(agenda[peran]) ? agenda[peran] : [];
  const perlu = bagian.filter(b => b.sifat === 'perlu');
  const akan = bagian.filter(b => b.sifat === 'akan');
  document.getElementById('agenda-perlu').innerHTML = perlu.length
    ? htmlDaftarAgenda(perlu)
    : `<p class="pesan-kosong agenda-beres">${esc(KOSONG_PERLU[peran] || 'Tidak ada yang perlu dikerjakan.')}</p>`;
  const mendesak = perlu.filter(b => b.mendesak).length;
  document.getElementById('jumlah-perlu').textContent = perlu.length
    ? `${perlu.length} hal${mendesak ? ` · ${mendesak} mendesak` : ''}` : '';
  document.getElementById('agenda-akan').innerHTML = akan.length
    ? htmlDaftarAgenda(akan)
    : '<p class="pesan-kosong">Belum ada agenda terjadwal.</p>';
}

async function muatAgenda(peran) {
  try {
    const agenda = await apiGet('/api/beranda/agenda', { auth: true });
    tampilAgenda(agenda || {}, peran);
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
const terdaftar = saya && (saya.peran === 'dosen' || (saya.peran === 'mahasiswa' && saya.prodi_kode));
if (terdaftar) {
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
  muatAgenda(peran);
  muatProdi(lingkup, peran);
  if (peran !== 'admin') muatJadwal(lingkup);
} else {
  if (saya) {
    document.getElementById('pesan-belum-masuk').textContent =
      'Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen. Hubungi pengelola program studi untuk didaftarkan.';
  }
  document.getElementById('panel-belum-masuk').hidden = false;
}
