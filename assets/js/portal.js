import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, peranAktif } from './akun.js';
import { esc, keadaanKosong, prodiBawaan } from './ui.js';

// Daftar tugas — gabungan semua kelas (sejak 2026-09-25, keputusan #8: menu
// lama tetap ada di samping tab Tugas Kelas). Mahasiswa: tugas prodinya dan
// tugas kelas yang ia ikuti, dikelompokkan "Perlu dikerjakan" dan "Sudah
// diserahkan" (status dari backend lewat NIM roster pada token). Dosen:
// "Perlu dinilai" dari kelas yang diajarnya, lalu semua tugas.

const isi = document.getElementById('isi');
const labelProdi = (kode) => kode ? String(kode).toUpperCase() : 'tanpa prodi';

function tulisPengantar(saya) {
  const p = document.querySelector('.kepala-halaman p:not(.remah)');
  if (!p || !saya) return;
  const peran = peranAktif(saya);
  if (peran === 'dosen' || peran === 'kaprodi') {
    p.innerHTML = 'Tugas yang perlu dinilai dan semua tugas — tugas bertenggat dibuat di halaman <a href="kelas.html">Kelas</a>';
  } else if (peran === 'admin') {
    p.textContent = 'Ringkasan tugas semua prodi beserta jumlah kiriman (hanya baca)';
  } else {
    p.textContent = 'Tugas dari semua kelas Anda: yang perlu dikerjakan dan yang sudah diserahkan';
  }
}

function waktu(iso) {
  const d = new Date(iso);
  return isNaN(d) || d.getFullYear() < 2000 ? '' : d.toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}
const lewat = (t) => t.tenggat && new Date(t.tenggat) < new Date();

function asal(t, namaKelas) {
  if (t.kelas_id && namaKelas[t.kelas_id]) return `Kelas ${esc(namaKelas[t.kelas_id])}`;
  return `Tugas prodi ${esc(labelProdi(t.prodi_kode))}`;
}

function kartuMahasiswa(t, namaKelas) {
  const href = `tugas.html?id=${encodeURIComponent(t.id)}`;
  const status = t.sudah_kirim
    ? `<span class="lencana rendah">Sudah diserahkan${t.kirim_terakhir ? ` ${esc(waktu(t.kirim_terakhir))}` : ''}</span>`
    : (lewat(t) ? '<span class="lencana tinggi">Lewat tenggat</span>' : '<span class="lencana sedang">Belum diserahkan</span>');
  return `<div class="kartu kartu-tugas">
    <div class="tugas-kepala"><h3>${esc(t.judul)}</h3>${status}</div>
    <p class="meta">${asal(t, namaKelas)}${t.tenggat ? ` · tenggat ${esc(waktu(t.tenggat))}` : ''}</p>
    ${t.deskripsi ? `<p class="meta tugas-deskripsi">${esc(t.deskripsi)}</p>` : ''}
    <p class="cta-row"><a class="aksi${t.sudah_kirim ? ' sekunder' : ''}" href="${esc(href)}">${t.sudah_kirim ? 'Lihat / Kirim Ulang' : 'Kerjakan'}</a></p>
  </div>`;
}

function kartuStaf(t, admin, namaKelas) {
  return `<div class="kartu kartu-tugas">
    <div class="tugas-kepala"><h3>${esc(t.judul)}</h3><span class="meta">${esc(t.n_kiriman)} kiriman</span></div>
    <p class="meta">${asal(t, namaKelas)}${t.tenggat ? ` · tenggat ${esc(waktu(t.tenggat))}` : ''}</p>
    ${t.deskripsi ? `<p class="meta tugas-deskripsi">${esc(t.deskripsi)}</p>` : ''}
    ${admin ? '' : `<p class="cta-row"><a class="aksi sekunder" href="tugas.html?id=${encodeURIComponent(t.id)}">Buka &amp; Nilai</a><a class="aksi sekunder" href="dosen.html?laporan=${encodeURIComponent(t.id)}">Laporan Kemiripan</a></p>`}
  </div>`;
}

// "Perlu dinilai": tugas kelas yang diajar dengan kiriman peserta yang belum
// dinilai (jumlah dari GET /api/kelas/:id/isi).
async function perluDinilai(kelas) {
  const diajar = kelas.filter(k => k.peran === 'pengajar' || k.peran === 'kaprodi');
  const hasil = await Promise.all(diajar.map(k => apiGet(`/api/kelas/${encodeURIComponent(k.id)}/isi`).then(r => ({ k, r })).catch(() => null)));
  const out = [];
  for (const h of hasil.filter(Boolean)) {
    const semua = [...(h.r.minggu || []).flatMap(w => w.tugas), ...(h.r.tugas_tanpa_minggu || [])];
    for (const t of semua) if (t.diserahkan > t.dinilai) out.push({ ...t, kelas_nama: h.k.nama });
  }
  return out;
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else try {
  const [{ tugas = [] }, saya, kelasSaya] = await Promise.all([
    apiGet('/api/tugas'), sayaSekarang, apiGet('/api/kelas/saya').catch(() => ({ kelas: [] })),
  ]);
  const kelas = kelasSaya.kelas || [];
  const namaKelas = Object.fromEntries(kelas.map(k => [k.id, k.nama]));
  const dosen = Boolean(saya && saya.peran === 'dosen');
  const admin = Boolean(saya && peranAktif(saya) === 'admin');
  tulisPengantar(saya);
  if (dosen) {
    const perlu = admin ? [] : await perluDinilai(kelas);
    const kartuPerlu = admin ? '' : `<div class="kartu"><h3>Perlu dinilai</h3>${perlu.length
      ? perlu.map(t => `<div class="butir-isi"><div><div class="butir-judul">${esc(t.judul)}</div><div class="butir-ket">Kelas ${esc(t.kelas_nama)} · ${esc(t.diserahkan - t.dinilai)} kiriman belum dinilai</div></div>
          <div class="aksi-sel"><a class="aksi" href="tugas.html?id=${encodeURIComponent(t.id)}">Nilai</a></div></div>`).join('')
      : '<p class="redup">Tidak ada kiriman yang menunggu nilai di kelas Anda.</p>'}</div>`;
    isi.innerHTML = kartuPerlu + (tugas.length
      ? `<h2 class="judul-periode">Semua tugas</h2>${tugas.map(t => kartuStaf(t, admin, namaKelas)).join('')}`
      : keadaanKosong({
        judul: 'Belum ada tugas',
        keterangan: 'Tugas bertenggat dibuat pengajar dari tab Tugas Kelas di halaman kelas.',
        aksi: admin ? null : { href: 'kelas.html', label: 'Buka Kelas' },
      }));
  } else if (!tugas.length) {
    isi.innerHTML = keadaanKosong({
      judul: 'Belum ada tugas',
      keterangan: `Tugas kelas dan tugas prodi ${labelProdi(prodiBawaan(saya))} muncul di sini setelah pengajar membuatnya.`,
      siapa: 'pengajar kelas',
      aksi: [{ href: 'kelas.html', label: 'Buka Kelas Saya' }, { href: 'materi.html', label: 'Buka materi minggu ini' }],
    });
  } else {
    const urut = (a, b) => (a.tenggat ? new Date(a.tenggat) : Infinity) - (b.tenggat ? new Date(b.tenggat) : Infinity);
    const belum = tugas.filter(t => !t.sudah_kirim).sort(urut);
    const sudah = tugas.filter(t => t.sudah_kirim);
    isi.innerHTML = `<p class="redup ringkas-tugas">${tugas.length} tugas · ${belum.length ? `${belum.length} perlu dikerjakan` : 'semua sudah diserahkan'}</p>
      ${belum.length ? `<h2 class="judul-periode">Perlu dikerjakan</h2>${belum.map(t => kartuMahasiswa(t, namaKelas)).join('')}` : ''}
      ${sudah.length ? `<h2 class="judul-periode">Sudah diserahkan</h2>${sudah.map(t => kartuMahasiswa(t, namaKelas)).join('')}` : ''}`;
  }
} catch (err) {
  isi.innerHTML = `<div class="pesan gagal">Daftar tugas tidak bisa dimuat: ${esc(err.message)}</div>`;
}
