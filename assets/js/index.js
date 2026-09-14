import { apiGet } from './api.js';
import { sayaSekarang, adalahPimpinan, adalahAdmin } from './akun.js';

// Beranda LMS. Jadwal, layanan, dan program studi hanya untuk dosen/admin dan
// mahasiswa di roster — sebelum itu beranda cuma menampilkan sambutan
// (keputusan pemilik produk 2026-09-14; backend juga menolak tanpa token).
// Tidak ada form login di sini — tombol Masuk di bilah atas (akun.js)
// mengarahkan ke /login/ (pdb/README.md bagian Frontend).

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

const KEGIATAN = {
  asinkron: ['Belajar mandiri', 'asinkron'],
  daring_sinkron: ['Kelas daring bersama dosen', 'daring'],
  opsional_luring_daring: ['Praktikum dan kerja proyek', 'luring/daring'],
  bebas: ['Tanpa agenda akademik', ''],
};

const LAYANAN = {
  mahasiswa: [
    ['Pembelajaran', [
      ['materi.html', 'Materi pekan ini', 'Video dan bacaan asinkron'],
      ['kuis.html', 'Kuis gerbang', 'Syarat sebelum sesi Jumat'],
      ['forum.html', 'Forum tanya dosen', 'Target jawaban 1×24 jam'],
      ['rekaman.html', 'Rekaman sesi', 'Kelas daring yang terlewat'],
      ['portal.html', 'Tugas', 'Kumpulkan dan pantau tugas'],
      ['kalender.html', 'Kalender akademik', 'Jadwal satu semester'],
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
      ['dosen.html', 'Buat tugas', 'Termasuk laporan kemiripan'],
      ['forum.html', 'Forum dan SLA', 'Pertanyaan yang menunggu jawaban'],
      ['rekaman.html', 'Rekaman sesi', 'Terbitkan sebelum tenggat'],
      ['kuis.html', 'Kuis gerbang', 'Susun soal dan cek kelulusan'],
    ]],
    ['Penilaian', [
      ['proyek.html', 'Proyek blok', 'Anggota dan nilai per mata kuliah'],
      ['ujian.html', 'Pengawas ujian', 'Jadwal dan kehadiran'],
      ['autograder.html', 'Autograder', 'Hasil tes otomatis dan bobot'],
      ['rapor.html', 'Rapor dan rekap nilai', 'Per mahasiswa atau per angkatan'],
      ['rpl.html', 'Tinjau RPL', 'Pengajuan yang menunggu'],
      ['kerja.html', 'Proyek kerja bimbingan', 'Putusan dan tinjauan'],
    ]],
    ['Akademik dan mutu', [
      ['kalender.html', 'Kalender akademik', 'Susun dan terbitkan'],
      ['kurikulum.html', 'Kurikulum', 'Rumpun, mata kuliah, CPL prodi Anda'],
      ['akademik.html', 'Roster dan NIP', 'Data mahasiswa'],
      ['kaprodi.html', 'Pantau proyek kerja', 'Tinjauan tengah semester'],
      ['kepatuhan.html', 'Laporan kepatuhan', 'Menit per mata kuliah untuk akreditasi'],
      ['jabatan.html', 'Kelola kaprodi', 'Tetapkan atau ganti kaprodi tiap prodi'],
    ]],
  ],
};

function htmlKelompok(judul, butir) {
  return `<div class="kelompok"><h3>${esc(judul)}</h3><ul class="daftar-layanan">
    ${butir.map(([href, nama, ket]) => `<li><a href="${href}"><b>${esc(nama)}</b><span>${esc(ket)}</span></a></li>`).join('')}
  </ul></div>`;
}

// Laporan tingkat prodi hanya untuk kaprodi dan admin, Kelola Kaprodi hanya
// untuk admin (backend menolak 403) — keduanya mengikuti peran aktif yang
// dipilih di bilah atas (akun.js).
// Kurikulum ikut di sini: hanya kaprodi (prodinya) dan admin yang mengubahnya.
const LAPORAN_PRODI = new Set(['kurikulum.html', 'kaprodi.html', 'kepatuhan.html']);
const KHUSUS_ADMIN = new Set(['jabatan.html']);

function tampilLayanan(saya) {
  const wadah = document.getElementById('layanan');
  const peran = saya && saya.peran;
  if (peran === 'dosen' || peran === 'mahasiswa') {
    const pimpinan = adalahPimpinan(saya);
    const admin = adalahAdmin(saya);
    wadah.innerHTML = LAYANAN[peran]
      .map(([j, b]) => [j, b.filter(([href]) => (pimpinan || !LAPORAN_PRODI.has(href)) && (admin || !KHUSUS_ADMIN.has(href)))])
      .filter(([, b]) => b.length)
      .map(([j, b]) => htmlKelompok(j, b)).join('');
    return;
  }
}

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

async function muatJadwal(prodiSaya) {
  const wadah = document.getElementById('jadwal');
  try {
    const { kalender = [] } = await apiGet('/api/kalender');
    if (!kalender.length) { wadah.innerHTML = '<p class="pesan-kosong">Belum ada kalender akademik yang diterbitkan.</p>'; return; }
    const pilih = document.getElementById('pilih-kalender');
    pilih.innerHTML = kalender.map((k, i) =>
      `<option value="${i}">${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)}</option>`).join('');
    const awal = Math.max(0, kalender.findIndex(k => k.prodi_kode === prodiSaya));
    pilih.value = String(awal);
    pilih.hidden = kalender.length < 2;
    pilih.addEventListener('change', () => tampilJadwal(kalender[Number(pilih.value)]));
    tampilJadwal(kalender[awal]);
  } catch (err) {
    wadah.innerHTML = `<p class="pesan-kosong">Jadwal tidak bisa dimuat: ${esc(err.message)}</p>`;
  }
}

async function muatProdi() {
  const wadah = document.getElementById('prodi');
  try {
    const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
    wadah.innerHTML = prodi.length
      ? prodi.map(p => `<li>${esc(p.nama)}<span class="kecil">${esc(p.jenjang)} · ${esc(p.sks_total)} SKS · ${esc(p.semester)} semester</span></li>`).join('')
      : '<li class="redup">Data program studi belum tersedia.</li>';
  } catch (err) {
    wadah.innerHTML = `<li class="redup">Tidak bisa dimuat: ${esc(err.message)}</li>`;
  }
}

document.getElementById('hari-ini').textContent =
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });

// Status akun di bilah atas diurus akun.js; beranda cukup memakai hasilnya.
// Belum masuk, token kedaluwarsa, atau nomor tak terdaftar: hanya sambutan.
const saya = await sayaSekarang;
// /api/proyekblok/saya menjawab peran "mahasiswa" juga untuk nomor yang tidak
// terdaftar; prodi_kode hanya terisi untuk mahasiswa yang ada di roster.
const terdaftar = saya && (saya.peran === 'dosen' || (saya.peran === 'mahasiswa' && saya.prodi_kode));
if (terdaftar) {
  ['panel-jadwal', 'panel-layanan', 'panel-prodi'].forEach(id => { document.getElementById(id).hidden = false; });
  tampilLayanan(saya);
  muatProdi();
  muatJadwal(saya.prodi_kode);
} else {
  if (saya) {
    document.getElementById('pesan-belum-masuk').textContent =
      'Nomor WhatsApp ini belum terdaftar sebagai mahasiswa atau dosen. Hubungi pengelola program studi untuk didaftarkan.';
  }
  document.getElementById('panel-belum-masuk').hidden = false;
}
