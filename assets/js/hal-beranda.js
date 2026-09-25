import { apiGet } from './api.js';
import { esc } from './ui.js';

// Bantuan bersama Beranda (index.js) dan Beranda Saya (saya.js): checklist
// langkah yang belum selesai per peran yang dipegang — audit UX 2026-09-14
// (U09, §3.3); sejak 2026-09-26 tampil di Beranda "Hari ini".
//
// Status tiap langkah dihitung dari data yang sudah ada: GET /api/proyekblok/saya
// (email, prodi_mengajar, kaprodi_prodi, prodi_kode) dan butir GET
// /api/beranda/agenda peran itu. Butir agenda yang masih ada berarti langkahnya
// belum selesai. `selesai: null` = langkah rutin tanpa status (mis. pantau
// laporan) — tidak ikut menentukan apakah checklist disembunyikan.
// Hanya tampilan; kewenangan tetap diputuskan backend.

const ada = (butir, jenis) => butir.find(b => b.jenis === jenis);
const besar = s => String(s || '').toUpperCase();

/** Terdaftar sebagai dosen, atau mahasiswa yang ada di roster (prodi_kode terisi). */
export function terdaftar(saya) {
  return !!saya && (saya.peran === 'dosen' || (saya.peran === 'mahasiswa' && !!saya.prodi_kode));
}

/**
 * Langkah awal satu peran. `agenda` boleh null (gagal dimuat): semua status
 * jadi null supaya tidak ada yang diklaim selesai atau belum tanpa data.
 * Tiap langkah: { kunci, judul, keterangan, status, href, label, selesai, jenis }
 * — `jenis`: butir agenda yang statusnya diwakili langkah itu.
 */
export function langkahMulai(peran, saya, agenda, tugas = null) {
  const butir = agenda && Array.isArray(agenda[peran]) ? agenda[peran] : [];
  const tahu = !!agenda;
  const cek = nilai => (tahu ? nilai : null);
  const minggu = agenda ? Number(agenda.minggu_berjalan) || 0 : 0;

  if (peran === 'dosen') {
    // Hak menyusun materi/kuis/tugas per kelas sejak 2026-09-25: pengajar kelas
    // (ditunjuk kaprodi) atau kaprodi prodinya.
    const jumlahKelas = Number(saya && saya.jumlah_kelas_diajar) || 0;
    const kaprodi = ((saya && saya.kaprodi_prodi) || []).length > 0;
    const mengajar = jumlahKelas > 0 || kaprodi ? ((saya && saya.prodi_mengajar) || ['?']) : [];
    const kal = ada(butir, 'kalender_belum_terbit');
    const celah = [ada(butir, 'materi_minggu_depan_kosong'), ada(butir, 'kuis_minggu_depan_kosong')].filter(Boolean);
    let statusKatalog = 'Katalog materi dan kuis gerbang minggu ini dan minggu depan sudah terisi.';
    if (!mengajar.length) statusKatalog = 'Bisa dikerjakan setelah kaprodi menunjuk Anda sebagai pengajar kelas.';
    else if (kal) statusKatalog = `${kal.judul}. Anda sudah bisa menyiapkan materi dan kuis minggu 1.`;
    else if (celah.length) statusKatalog = celah.map(c => `${c.judul} (${c.keterangan})`).join('. ');
    return [
      {
        kunci: 'email', judul: 'Isi email kampus',
        keterangan: 'Email kampus adalah identitas dosen: pembimbing, pengawas, dan kaprodi dirujuk lewat email ini. Boleh email institusi asal atau email pribadi.',
        status: saya && saya.email ? `Tercatat: ${saya.email}` : 'Belum diisi.',
        href: 'akademik.html', label: 'Isi email kampus', selesai: !!(saya && saya.email), jenis: ['email_belum_diisi'],
      },
      {
        kunci: 'pengajar', judul: 'Ditunjuk sebagai pengajar kelas',
        keterangan: 'Kaprodi menunjuk pengajar tiap kelas. Hanya pengajar kelas (dan kaprodinya) yang bisa menyusun materi, kuis, tugas, dan nilai kelas itu.',
        status: jumlahKelas ? `Mengajar ${jumlahKelas} kelas.` : (kaprodi ? 'Sebagai kaprodi Anda bisa mengisi semua kelas prodi Anda.' : 'Belum menjadi pengajar kelas mana pun — minta kaprodi menunjuk Anda.'),
        href: 'kelas.html', label: 'Lihat kelas', selesai: mengajar.length > 0, jenis: ['belum_mengajar_kelas'],
      },
      {
        kunci: 'katalog', judul: 'Siapkan materi dan kuis minggu ini',
        keterangan: 'Mahasiswa belajar mandiri dari katalog materi, lalu mengerjakan kuis gerbang sebelum sesi Jumat. Buka kelasnya, lalu tab Tugas Kelas → + Buat → Materi atau Kuis.',
        status: statusKatalog,
        href: 'kelas.html', label: 'Buka kelas saya',
        selesai: cek(mengajar.length > 0 && !kal && !celah.length),
        jenis: ['kalender_belum_terbit', 'materi_minggu_depan_kosong', 'kuis_minggu_depan_kosong'],
      },
    ];
  }

  if (peran === 'kaprodi') {
    const prodi = besar(((saya && saya.kaprodi_prodi) || []).join(', '));
    const prodiUtama = ((saya && saya.kaprodi_prodi) || [])[0] || '';
    const kur = ada(butir, 'kurikulum_belum_lengkap');
    const kal = ada(butir, 'kalender_belum_terbit');
    const tanpaPengajar = ada(butir, 'kelas_tanpa_pengajar');
    return [
      {
        kunci: 'kurikulum', judul: 'Lengkapi kurikulum',
        keterangan: `Rumpun beserta mata kuliahnya, CPL, dan ritme mingguan ${prodi} — dasar kalender, materi, dan laporan.`,
        status: kur ? kur.keterangan : 'Kurikulum lengkap.',
        href: 'kurikulum.html', label: 'Buka kurikulum', selesai: cek(!kur), jenis: ['kurikulum_belum_lengkap'],
      },
      {
        kunci: 'kalender', judul: 'Susun dan terbitkan kalender',
        keterangan: 'Kalender semester disusun dari ritme mingguan. Setelah terbit, jadwal dan agenda mingguan muncul untuk dosen dan mahasiswa.',
        status: kal ? kal.keterangan : 'Kalender sudah terbit.',
        href: `semester.html?prodi=${encodeURIComponent(prodiUtama)}#kalender`, label: 'Siapkan semester', selesai: cek(!kal), jenis: ['kalender_belum_terbit'],
      },
      {
        kunci: 'kelas', judul: 'Tunjuk pengajar tiap kelas',
        keterangan: 'Kelas dibuat otomatis saat kalender terbit — satu per rumpun, atau per mata kuliah untuk mata kuliah lepas. Tunjuk pengajarnya dari dosen aktif, dan sesuaikan peserta bila perlu.',
        status: tanpaPengajar ? tanpaPengajar.judul + '.' : (kal ? 'Menunggu kalender terbit.' : 'Semua kelas yang berjalan sudah punya pengajar.'),
        href: `semester.html?prodi=${encodeURIComponent(prodiUtama)}#kelas`, label: 'Tunjuk pengajar',
        selesai: cek(!tanpaPengajar && !kal), jenis: ['kelas_tanpa_pengajar'],
      },
      {
        kunci: 'laporan', judul: 'Pantau laporan prodi',
        keterangan: 'Proyek kerja, kepatuhan, rekap rapor, dan rekaman — dipantau rutin sepanjang semester.',
        status: '', href: 'kaprodi.html', label: 'Buka laporan', selesai: null,
      },
    ];
  }

  if (peran === 'admin') {
    const tanpa = ada(butir, 'prodi_tanpa_kaprodi');
    const email = [ada(butir, 'rujukan_nip_lama'), ada(butir, 'dosen_tanpa_email')].filter(Boolean);
    return [
      {
        kunci: 'kaprodi', judul: 'Tetapkan kaprodi tiap prodi',
        keterangan: 'Kaprodi yang mengisi kurikulum, menerbitkan kalender, dan menunjuk pengajar kelas prodinya.',
        status: tanpa ? `${tanpa.judul}: ${tanpa.keterangan}` : 'Semua prodi sudah punya kaprodi.',
        href: 'jabatan.html', label: 'Kelola kaprodi', selesai: cek(!tanpa), jenis: ['prodi_tanpa_kaprodi'],
      },
      {
        kunci: 'email', judul: 'Pastikan dosen mengisi email kampus',
        keterangan: 'Dosen tanpa email kampus belum bisa dipilih sebagai kaprodi, pembimbing, atau pengawas.',
        status: email.length ? email.map(b => b.judul).join('. ') + '.' : 'Semua dosen aktif sudah mengisi email kampus.',
        href: 'jabatan.html', label: 'Lihat daftar dosen', selesai: cek(!email.length), jenis: ['rujukan_nip_lama', 'dosen_tanpa_email'],
      },
    ];
  }

  // Mahasiswa.
  const prodi = besar(saya && saya.prodi_kode);
  // Status kumpul tugas dari GET /api/tugas (sudah_kirim per tugas untuk token
  // mahasiswa); null bila daftar tugas tidak termuat → langkah tanpa status.
  const tugasBelum = Array.isArray(tugas) ? tugas.filter(t => t.sudah_kirim === false).length : null;
  const kal = ada(butir, 'kalender_belum_terbit');
  const materi = ada(butir, 'materi_belum_selesai');
  const kuis = ada(butir, 'kuis_belum_lulus');
  // Di luar minggu perkuliahan (kalender terbit tapi belum mulai/sudah usai)
  // materi dan kuis tidak punya status; sebelum kalender terbit: belum.
  const mingguan = belum => (!tahu ? null : kal ? false : minggu ? !belum : null);
  return [
    {
      kunci: 'jadwal', judul: 'Cek jadwal semester',
      keterangan: 'Kalender akademik berisi kegiatan tiap minggu: belajar mandiri, kelas daring, dan tatap muka.',
      status: kal ? `Kalender ${prodi} belum diterbitkan kaprodi.` : 'Kalender prodi Anda sudah terbit.',
      href: 'kalender.html', label: 'Lihat kalender', selesai: cek(!kal), jenis: ['kalender_belum_terbit'],
    },
    {
      kunci: 'materi', judul: 'Selesaikan materi minggu ini',
      keterangan: 'Video dan bacaan asinkron; progresnya tercatat otomatis.',
      status: kal ? 'Muncul setelah kalender terbit.' : !minggu ? 'Tidak ada minggu perkuliahan berjalan.' : materi ? materi.judul : `Materi minggu ${minggu} sudah selesai.`,
      href: 'materi.html', label: 'Buka materi', selesai: mingguan(materi), jenis: ['materi_belum_selesai'],
    },
    {
      kunci: 'kuis', judul: 'Lulus kuis gerbang',
      keterangan: 'Kuis singkat materi pekan itu, dikerjakan sebelum sesi tatap muka Jumat.',
      status: kal ? 'Muncul setelah kalender terbit.' : !minggu ? 'Tidak ada minggu perkuliahan berjalan.' : kuis ? kuis.judul : `Kuis minggu ${minggu} sudah lulus.`,
      href: 'kuis.html', label: 'Kerjakan kuis', selesai: mingguan(kuis), jenis: ['kuis_belum_lulus'],
    },
    {
      // Tanpa tugas sama sekali langkah ini tidak berstatus (bukan "selesai"),
      // supaya tanda centang tidak menyiratkan ada yang sudah dikerjakan.
      kunci: 'tugas', judul: 'Serahkan tugas',
      keterangan: 'Tugas dari kelas Anda dan dari prodi; serahkan sebelum tenggatnya.',
      status: tugasBelum === null ? '' : tugasBelum ? `${tugasBelum} tugas belum diserahkan.` : (tugas.length ? 'Semua tugas sudah diserahkan.' : 'Belum ada tugas dari pengajar kelas.'),
      href: 'portal.html', label: 'Buka daftar tugas', selesai: tugasBelum === null || !tugas.length ? null : tugasBelum === 0,
    },
  ];
}

/** Daftar tugas untuk checklist mahasiswa (null bila bukan mahasiswa atau gagal dimuat). */
export async function muatTugasMahasiswa(peran) {
  if (peran !== 'mahasiswa') return null;
  try {
    const { tugas = [] } = await apiGet('/api/tugas', { auth: true });
    return Array.isArray(tugas) ? tugas : null;
  } catch {
    return null;
  }
}

/** Semua langkah yang punya status sudah selesai (checklist boleh disembunyikan). */
export function semuaSelesai(langkah) {
  const berstatus = langkah.filter(l => l.selesai !== null);
  return berstatus.length > 0 && berstatus.every(l => l.selesai);
}

/** Jenis butir agenda yang sudah ditampilkan checklist (tidak diulang di agenda). */
export function jenisTercakup(langkah) {
  return new Set(langkah.flatMap(l => l.jenis || []));
}

/** Ringkasan "2 dari 3 selesai" (hanya langkah berstatus). */
export function ringkasMulai(langkah) {
  const berstatus = langkah.filter(l => l.selesai !== null);
  return berstatus.length ? `${berstatus.filter(l => l.selesai).length} dari ${berstatus.length} selesai` : '';
}

function tandaLangkah(l, i) {
  const kelas = l.selesai === true ? 'selesai' : l.selesai === false ? 'belum' : 'rutin';
  const baca = l.selesai === true ? 'Selesai' : l.selesai === false ? 'Belum selesai' : 'Rutin';
  return `<span class="mulai-tanda ${kelas}" aria-hidden="true">${l.selesai === true ? '' : i + 1}</span><span class="tersembunyi">${baca}: </span>`;
}

/** Daftar bernomor untuk panel "Mulai di sini" di Beranda. */
export function htmlDaftarMulai(langkah) {
  return `<ol class="daftar-mulai">${langkah.map((l, i) => `
    <li class="mulai-butir ${l.selesai === true ? 'selesai' : ''}">
      ${tandaLangkah(l, i)}
      <span class="mulai-teks"><b>${esc(l.judul)}</b>
        <span class="mulai-status">${esc(l.status || l.keterangan)}</span></span>
      <span class="mulai-aksi"><a href="${esc(l.href)}">${esc(l.label)}</a>${l.href2 ? `<a href="${esc(l.href2)}">${esc(l.label2)}</a>` : ''}</span>
    </li>`).join('')}</ol>`;
}

/** Kartu langkah untuk Beranda Saya: urutan, status, dan tombol ke halamannya. */
export function htmlKartuLangkah(langkah) {
  return langkah.map((l, i) => {
    const lencana = l.selesai === true ? '<span class="lencana rendah">Selesai</span>'
      : l.selesai === false ? '<span class="lencana sedang">Belum</span>' : '<span class="lencana">Rutin</span>';
    return `<div class="kartu kartu-langkah${l.selesai === true ? ' selesai' : ''}">
      <h3><span class="langkah-no">${i + 1}</span>${esc(l.judul)} ${lencana}</h3>
      <p class="meta">${esc(l.keterangan)}</p>
      ${l.status ? `<p class="langkah-status">${esc(l.status)}</p>` : ''}
      <p class="cta-row"><a class="aksi" href="${esc(l.href)}">${esc(l.label)}</a>${l.href2 ? `<a class="aksi sekunder" href="${esc(l.href2)}">${esc(l.label2)}</a>` : ''}</p>
    </div>`;
  }).join('');
}
