import { apiGet, arahkanKeLogin } from './api.js';
import { sayaSekarang, peranDipegang, labelPeran } from './akun.js';
import { esc } from './ui.js';
import { terdaftar as sudahTerdaftar, langkahMulai, semuaSelesai, htmlDaftarMulai, jenisTercakup } from './hal-beranda.js';

// Beranda "Hari ini" (keputusan developer Arfan 2026-09-26). Satu halaman untuk
// SEMUA peran yang dipegang sekaligus (tanpa pemilih peran):
//   - langkah yang belum selesai (penyiapan admin, semester kaprodi, syarat
//     mengajar dosen) — hilang sendiri begitu beres;
//   - "Perlu dikerjakan": tugas kelas yang belum diserahkan (mahasiswa),
//     kiriman yang perlu dinilai (pengajar), dan agenda backend
//     (GET /api/beranda/agenda, dihitung dari database per peran);
//   - kartu "Kelas saya", jadwal minggu ini, dan "Akan datang".
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

// Perintah bot WhatsApp per peran (audit UX U20). Kaprodi dan admin belum punya
// perintah laporan lewat WhatsApp, jadi panelnya disembunyikan untuk mereka.
const PERINTAH_WA = {
  mahasiswa: [
    ['kalender minggu ini', 'Jadwal minggu ini'],
    ['daftar tugas', 'Tugas yang masih terbuka'],
    ['nilai saya', 'Nilai tiap kelas'],
  ],
  dosen: [
    ['mk diampu', 'Kelas Anda beserta tautan grup WhatsApp-nya'],
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
  return /^[a-z0-9-]+\.html(?:[?#][\w=&%.,:+\-/]*)?$/i.test(String(t || '')) ? t : './';
}

// Urutan butir datang dari backend dan ditampilkan apa adanya: bagian kaprodi
// diurut menurut ketergantungan (kurikulum, kalender, pengajar kelas, laporan),
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

// Tanggal tenggat dekat (<= 24 jam) atau lewat: ditandai mendesak.
function mendesak(iso) { return Boolean(iso) && Date.parse(iso) - Date.now() < 86400000; }

// Tugas kelas yang belum diserahkan (mahasiswa), dari GET /api/tugas yang
// membawa sudah_kirim per tugas untuk token mahasiswa.
function butirTugasMahasiswa(tugas, namaKelas) {
  return (tugas || []).filter(t => t.sudah_kirim === false).map(t => ({
    judul: t.judul,
    keterangan: t.kelas_id && namaKelas[t.kelas_id] ? `Kelas ${namaKelas[t.kelas_id]}` : `Tugas prodi ${String(t.prodi_kode || '').toUpperCase()}`,
    tenggat: t.tenggat || null,
    tautan: `tugas.html?id=${t.id}`,
    sifat: 'perlu',
    mendesak: mendesak(t.tenggat),
    kelas_id: t.kelas_id || '',
  })).sort((a, b) => (a.tenggat ? Date.parse(a.tenggat) : Infinity) - (b.tenggat ? Date.parse(b.tenggat) : Infinity));
}

// Kiriman yang belum dinilai di kelas yang diajar (pengajar atau kaprodinya),
// dari GET /api/kelas/:id/isi (diserahkan vs dinilai per tugas).
async function butirPerluDinilai(kelas) {
  const diajar = kelas.filter(k => k.peran === 'pengajar' || k.peran === 'kaprodi');
  const hasil = await Promise.all(diajar.map(k => apiGet(`/api/kelas/${encodeURIComponent(k.id)}/isi`, { auth: true })
    .then(r => ({ k, r })).catch(() => null)));
  const out = [];
  for (const h of hasil.filter(Boolean)) {
    const semua = [...(h.r.minggu || []).flatMap(w => w.tugas), ...(h.r.tugas_tanpa_minggu || [])];
    for (const t of semua) {
      const n = (t.diserahkan || 0) - (t.dinilai || 0);
      if (n > 0) {
        out.push({ judul: t.judul, keterangan: `Kelas ${h.k.nama} · ${n} kiriman belum dinilai`, jumlah: n,
          tautan: `tugas.html?id=${t.id}`, sifat: 'perlu', kelas_id: h.k.id });
      }
    }
  }
  return out;
}

// Langkah yang belum selesai per peran yang dipegang: penyiapan platform
// (admin), semester prodi (kaprodi), syarat mengajar (dosen). Mengembalikan
// jenis butir agenda yang sudah diwakili langkah, supaya tidak diulang.
const JUDUL_LANGKAH = { admin: 'Penyiapan platform', kaprodi: 'Semester prodi Anda', dosen: 'Syarat mengajar' };
function tampilLangkah(peran, saya, agenda) {
  const blok = [];
  const tercakup = new Set();
  for (const p of ['admin', 'kaprodi', 'dosen'].filter(x => peran.includes(x))) {
    let langkah = langkahMulai(p, saya, agenda, null);
    // Untuk dosen hanya syarat mengajar (email, ditunjuk pengajar); isi kelas
    // mingguan sudah muncul di "Perlu dikerjakan".
    if (p === 'dosen') langkah = langkah.filter(l => l.kunci !== 'katalog');
    if (semuaSelesai(langkah)) continue;
    jenisTercakup(langkah).forEach(j => tercakup.add(j));
    blok.push(`<div class="blok-langkah"><h3>${esc(JUDUL_LANGKAH[p])}</h3>${htmlDaftarMulai(langkah)}</div>`);
  }
  const panel = document.getElementById('panel-mulai');
  panel.hidden = !blok.length;
  document.getElementById('mulai').innerHTML = blok.join('');
  return tercakup;
}

function tampilPerlu(butir, akan) {
  const perlu = [...butir].sort((a, b) => Number(Boolean(b.mendesak)) - Number(Boolean(a.mendesak)));
  document.getElementById('agenda-perlu').innerHTML = perlu.length
    ? htmlDaftarAgenda(perlu)
    : '<p class="pesan-kosong agenda-beres">Tidak ada yang perlu dikerjakan saat ini.</p>';
  const nMendesak = perlu.filter(b => b.mendesak).length;
  document.getElementById('jumlah-perlu').textContent = perlu.length
    ? `${perlu.length} hal${nMendesak ? ` · ${nMendesak} mendesak` : ''}` : '';
  document.getElementById('panel-akan').hidden = !akan.length;
  document.getElementById('agenda-akan').innerHTML = akan.length ? htmlDaftarAgenda(akan) : '';
}

// Kartu kelas ringkas: kelas yang diajar/diikuti dulu, lalu kelas prodi yang
// dipimpin; tiap kartu menyebut berapa hal yang menunggu di kelas itu.
function tampilKelas(kelas, perlu) {
  const wadah = document.getElementById('kelas-saya');
  if (!kelas.length) {
    wadah.innerHTML = '<p class="pesan-kosong">Belum ada kelas. Kelas dibuka setelah kaprodi menerbitkan kalender semester.</p>';
    return;
  }
  const hitung = {};
  perlu.forEach(b => { if (b.kelas_id) hitung[b.kelas_id] = (hitung[b.kelas_id] || 0) + 1; });
  const bobot = k => (k.peran === 'kaprodi' || k.peran === 'admin' ? 1 : 0);
  const urut = [...kelas].sort((a, b) => bobot(a) - bobot(b));
  const LABEL = { peserta: 'peserta', pengajar: 'pengajar', kaprodi: 'kaprodi', admin: 'baca' };
  wadah.innerHTML = `<div class="grid-kelas">${urut.map(k => {
    const n = hitung[k.id] || 0;
    const pengajar = (k.pengajar_orang || []).map(p => p.nama).join(', ');
    return `<a class="kartu kartu-kelas" href="kelas.html?id=${encodeURIComponent(k.id)}">
      <h3>${esc(k.nama)}</h3>
      <p class="baris-kecil">${esc(k.periode || '')} · semester ${esc(k.semester)}${k.peran !== 'peserta' ? ` · <span class="lencana">${esc(LABEL[k.peran] || k.peran)}</span>` : ''}</p>
      <p class="baris-kecil">${pengajar ? `Pengajar: ${esc(pengajar)}` : '<span class="lencana sedang">belum ada pengajar</span>'}</p>
      ${n ? `<p class="baris-kecil"><span class="lencana tinggi">${esc(n)} perlu dikerjakan</span></p>` : ''}
    </a>`;
  }).join('')}</div>`;
}

async function muatBeranda(saya, peran) {
  const mahasiswa = peran.includes('mahasiswa');
  const [agenda, kelasSaya, tugas] = await Promise.all([
    apiGet('/api/beranda/agenda', { auth: true }).catch(() => null),
    apiGet('/api/kelas/saya', { auth: true }).catch(() => ({ kelas: [] })),
    mahasiswa ? apiGet('/api/tugas', { auth: true }).then(r => r.tugas || []).catch(() => []) : Promise.resolve([]),
  ]);
  const kelas = kelasSaya.kelas || [];
  const namaKelas = Object.fromEntries(kelas.map(k => [k.id, k.nama]));
  const tercakup = agenda ? tampilLangkah(peran, saya, agenda) : new Set();
  const dariKelas = mahasiswa ? butirTugasMahasiswa(tugas, namaKelas) : await butirPerluDinilai(kelas);
  const dariAgenda = agenda ? peran.flatMap(p => (Array.isArray(agenda[p]) ? agenda[p] : [])).filter(b => !tercakup.has(b.jenis)) : [];
  // Butir yang sama dari dua peran (mis. rpl_menunggu dosen & kaprodi) cukup sekali.
  const unik = new Map();
  dariAgenda.forEach(b => { if (!unik.has(b.jenis + b.judul)) unik.set(b.jenis + b.judul, b); });
  const agendaUnik = [...unik.values()];
  tampilPerlu([...dariKelas, ...agendaUnik.filter(b => b.sifat === 'perlu')], agendaUnik.filter(b => b.sifat === 'akan'));
  if (!agenda) {
    document.getElementById('agenda-perlu').insertAdjacentHTML('beforeend', '<p class="pesan-kosong">Agenda lain belum bisa dimuat; coba muat ulang.</p>');
  }
  tampilKelas(kelas, dariKelas);
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

// prodiLingkup: kode prodi yang relevan untuk pengguna; null berarti semua.
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

const hariIniTeks = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
document.getElementById('hari-ini').textContent = hariIniTeks;

// Status akun di bilah atas diurus akun.js; beranda cukup memakai hasilnya.
// Belum masuk, token kedaluwarsa, atau nomor tak terdaftar: hanya sambutan.
const saya = await sayaSekarang;
// /api/proyekblok/saya menjawab peran "mahasiswa" juga untuk nomor yang tidak
// terdaftar; prodi_kode hanya terisi untuk mahasiswa yang ada di roster.
if (sudahTerdaftar(saya)) {
  const peran = peranDipegang(saya);
  const label = peran.includes('mahasiswa') ? `mahasiswa ${String(saya.prodi_kode || '').toUpperCase()}`.trim() : labelPeran(saya);
  document.getElementById('judul-beranda').textContent = 'Hari ini';
  document.getElementById('hari-ini').textContent = `${hariIniTeks} · ${label}`;
  document.title = 'Beranda — Platform Digital Bandung';

  ['panel-perlu', 'panel-kelas'].forEach(id => { document.getElementById(id).hidden = false; });
  tampilWhatsApp(peran.includes('mahasiswa') ? 'mahasiswa' : 'dosen');
  muatBeranda(saya, peran);
  // Jadwal: prodi roster (mahasiswa), atau prodi yang dipimpin/diajar (dosen).
  // Admin yang tidak mengajar di prodi mana pun tanpa jadwal.
  const lingkup = peran.includes('mahasiswa')
    ? (saya.prodi_kode ? [saya.prodi_kode] : [])
    : [...new Set([...(saya.kaprodi_prodi || []), ...(saya.prodi_mengajar || [])])];
  if (lingkup.length) {
    document.getElementById('panel-jadwal').hidden = false;
    muatJadwal(lingkup);
  }
  // Admin: ringkasan penyiapan prodi (siapa kaprodinya) di kolom samping.
  if (peran.includes('admin')) {
    document.getElementById('panel-prodi').hidden = false;
    document.getElementById('judul-prodi').textContent = 'Penyiapan program studi';
    muatProdi(null, 'admin');
  }
} else {
  // Tamu dan nomor tak terdaftar diberi tahu siapa yang mendaftarkan: tidak ada
  // pendaftaran mandiri (pdb/README.md bagian Frontend).
  // Nomor yang sudah masuk tapi belum terdaftar tidak perlu tombol Masuk lagi;
  // yang ia butuhkan adalah cara didaftarkan (blok "Belum terdaftar?").
  const sambutan = document.getElementById('panel-belum-masuk');
  if (saya) {
    sambutan.classList.add('belum-terdaftar');
    document.getElementById('judul-belum-masuk').textContent = 'Nomor WhatsApp Anda belum terdaftar';
    document.getElementById('pesan-belum-masuk').textContent =
      'Anda sudah masuk, tetapi nomor ini belum tercatat sebagai mahasiswa atau dosen, jadi jadwal dan layanan belum bisa ditampilkan. Ikuti langkah "Belum terdaftar?" di samping — setelah didaftarkan, keluar lalu masuk lagi.';
  }
  // Tombol Masuk di sambutan hanya mengarahkan ke /login/, sama seperti tombol
  // di bilah atas (akun.js) — tidak ada form login di halaman ini.
  sambutan.querySelectorAll('[data-masuk-sambutan]').forEach(b => b.addEventListener('click', () => arahkanKeLogin()));
  sambutan.hidden = false;
}
