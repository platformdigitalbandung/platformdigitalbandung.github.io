import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong, istilah } from './ui.js';
import { isiDatalistNIM, pekanMahasiswa } from './hal-mahasiswa.js';

// Dasbor Belajar. Mahasiswa melihat dasbornya sendiri (NIM dari
// /api/proyekblok/saya, dibuktikan backend lewat nomor pada token); dosen boleh
// melihat dasbor mahasiswa mana pun lewat isian NIM atau ?nim=. Kewenangannya
// tetap dicek backend — mahasiswa yang mengetik NIM orang lain ditolak 403.

const isi = document.getElementById('isi');
function satuDesimal(n) { return typeof n === 'number' ? n.toFixed(1) : '–'; }

const LENCANA = {
  'tercapai': ['rendah', 'tercapai'],
  'belum': ['sedang', 'belum'],
  'ditopang-jalur-lain': ['', 'ditopang jalur lain'],
};

// Domain CPL dari kurikulum (mis. keterampilan_khusus) ditampilkan manusiawi.
function labelDomain(kode) {
  const t = String(kode || '').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

let prodiDilihat = ''; // prodi pemilik dasbor (mahasiswa sendiri), untuk teks keadaan kosong

// 422 dari rute dasbor artinya "datanya belum lengkap" (kalender belum terbit,
// prodi belum punya CPL) — keadaan yang wajar, bukan halaman yang rusak. 404
// dan lainnya memang kegagalan.
function kartuGagal(judul, err) {
  if (err && err.status === 422) {
    const PRODI = prodiDilihat ? prodiDilihat.toUpperCase() : 'prodi';
    const pesan = String(err.message || '');
    let kosong;
    if (/kalender terbit/i.test(pesan)) {
      kosong = keadaanKosong({
        judul: 'Beban belajar belum bisa dihitung',
        keterangan: `Beban belajar minggu ini dihitung dari kalender semester. Angkanya muncul di sini setelah kaprodi ${PRODI} menerbitkan kalender semester Anda.`,
        siapa: `kaprodi ${PRODI}`,
        aksi: { href: 'kalender.html', label: 'Lihat kalender' },
      });
    } else if (/di luar rentang/i.test(pesan)) {
      kosong = keadaanKosong({
        judul: 'Tidak ada minggu perkuliahan hari ini',
        keterangan: 'Hari ini di luar jadwal kalender semester (perkuliahan belum mulai atau sudah selesai). Beban belajar tampil lagi saat minggu perkuliahan berjalan.',
        aksi: { href: 'kalender.html', label: 'Lihat kalender' },
      });
    } else if (/capaian pembelajaran/i.test(pesan)) {
      kosong = keadaanKosong({
        judul: 'CPL prodi belum terdaftar',
        keterangan: `Capaian pembelajaran dihitung terhadap CPL di kurikulum. Kartu ini terisi setelah kaprodi ${PRODI} mendaftarkan CPL prodinya.`,
        siapa: `kaprodi ${PRODI}`,
        aksi: { href: 'kurikulum.html', label: 'Lihat kurikulum' },
      });
    } else {
      kosong = `<div class="kosong">Belum bisa dihitung: ${esc(pesan)}.</div>`;
    }
    return `<div class="kartu"><h3>${esc(judul)}</h3>${kosong}</div>`;
  }
  return `<div class="kartu"><h3>${esc(judul)}</h3>
    <div class="pesan gagal">${esc(err ? err.message : 'Gagal memuat.')}</div></div>`;
}

function kartuBeban(b) {
  return `
    <div class="kartu">
      <h3>Beban Belajar Minggu ke-${esc(b.minggu)}</h3>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(b.menit_total)}</span><span class="label">menit terjadwal</span></div>
        <div class="stat"><span class="angka">${satuDesimal(b.sks)}</span><span class="label">SKS${b.kapasitas_sks ? ` dari kapasitas ${satuDesimal(b.kapasitas_sks)}` : ''}</span></div>
      </div>
      <p class="meta">${b.tanggal_mulai ? `Mulai ${esc(b.tanggal_mulai)} · ` : ''}Hari berjadwal: ${(b.hari || []).map(esc).join(', ') || '–'}</p>
      ${b.catatan ? `<p class="redup">Catatan: ${esc(b.catatan)}</p>` : ''}
    </div>`;
}

function buktiCPL(c) {
  const bagian = [];
  if ((c.rumpun_bukti || []).length) bagian.push(`nilai: ${c.rumpun_bukti.map(esc).join(', ')}`);
  if ((c.rumpun_bukti_rpl || []).length) bagian.push(`RPL: ${c.rumpun_bukti_rpl.map(esc).join(', ')}`);
  if ((c.penopang_lain || []).length) bagian.push(`ditopang: ${c.penopang_lain.map(esc).join(', ')}`);
  return bagian.join(' · ') || '–';
}

function kartuCPL(r) {
  const daftar = r.daftar || [];
  return `
    <div class="kartu">
      <h3>Capaian Pembelajaran Lulusan (${istilah('cpl', 'CPL')})</h3>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(r.tercapai)} / ${esc(r.dapat_dinilai)}</span><span class="label">CPL tercapai dari yang dinilai lewat proyek</span></div>
        <div class="stat"><span class="angka">${esc(r.ditopang_jalur_lain)}</span><span class="label">ditopang jalur lain</span></div>
      </div>
      <p class="meta">Penyebutnya ${esc(r.dapat_dinilai)}, bukan ${esc(r.total)}: ${esc(r.ditopang_jalur_lain)} CPL sengaja tidak dipetakan ke rumpun mana pun dan dinilai di luar kelas rumpun, jadi tidak adil dihitung "belum tercapai".</p>
      ${!r.tercapai ? '<p class="redup">Belum ada CPL tercapai. CPL dihitung tercapai setelah nilai akhir kelas rumpun buktinya lengkap dan lulus, atau setelah pengajuan RPL Anda disetujui. Lihat tab Nilai tiap <a href="kelas.html">kelas</a> dan <a href="rapor.html">Rapor</a>.</p>' : ''}
      ${r.tercapai_hanya_rpl ? `<p class="redup">${esc(r.tercapai_hanya_rpl)} dari yang tercapai buktinya hanya RPL (pengakuan pengalaman kerja), tanpa nilai kelas.</p>` : ''}
      ${daftar.length ? `<div class="gulir"><table>
          <tr><th>CPL</th><th>Domain</th><th>Status</th><th>Bukti</th></tr>
          ${daftar.map(c => {
            const [kelas, label] = LENCANA[c.status] || ['', c.status];
            return `<tr><td>${esc(c.cpl_kode)}</td><td>${esc(labelDomain(c.domain))}</td>
              <td><span class="lencana ${kelas}">${esc(label)}</span></td><td>${buktiCPL(c)}</td></tr>`;
          }).join('')}
        </table></div>` : '<p class="redup">Belum ada CPL terdaftar.</p>'}
    </div>`;
}

// `pekan` (hanya untuk dasbor mahasiswa sendiri): kalau kalender semesternya
// belum terbit atau hari ini di luar jadwal, beban belajar tidak diminta ke
// backend — jawabannya pasti 422 dan hanya mengotori konsol.
async function tampil(nim, judul, pekan = null) {
  const wadah = document.getElementById('dasbor');
  wadah.innerHTML = `<p class="redup">${esc(judul)} · NIM ${esc(nim)}</p><p class="redup">Memuat…</p>`;
  const kode = encodeURIComponent(nim);
  // Dimuat terpisah: satu kartu yang belum bisa dihitung (mis. kalender belum
  // terbit) tidak boleh ikut mengosongkan kartu yang lain.
  const tanpaBeban = pekan && !pekan.terbit ? 'belum ada kalender terbit'
    : pekan && !pekan.minggu ? 'tanggal hari ini di luar rentang kalender' : '';
  const [beban, cpl] = await Promise.allSettled([
    tanpaBeban ? Promise.reject(Object.assign(new Error(tanpaBeban), { status: 422 }))
      : apiGet(`/api/dasbor/beban-belajar/${kode}`, { auth: true }),
    apiGet(`/api/dasbor/cpl/${kode}`, { auth: true }),
  ]);
  wadah.innerHTML = `<p class="redup">${esc(judul)} · NIM ${esc(nim)}</p>`
    + (beban.status === 'fulfilled' ? kartuBeban(beban.value) : kartuGagal('Beban Belajar', beban.reason))
    + (cpl.status === 'fulfilled' ? kartuCPL(cpl.value) : kartuGagal('Capaian Pembelajaran (CPL)', cpl.reason));
}

function formDosen(nimAwal) {
  return `
    <div class="kartu">
      <h3>Lihat Dasbor Mahasiswa</h3>
      <p class="meta">Sebagai dosen, Anda bisa melihat dasbor mahasiswa mana pun. Ketik NIM atau nama untuk memilih dari roster.</p>
      <form id="form-nim">
        <label>NIM <input name="nim" required maxlength="30" list="daftar-nim" autocomplete="off" placeholder="Ketik NIM atau nama" value="${esc(nimAwal || '')}"></label>
        <datalist id="daftar-nim"></datalist>
        <button>Tampilkan</button>
      </form>
    </div>`;
}

async function muat() {
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda sudah berakhir atau backend tidak terjangkau. Tekan Masuk lagi di pojok kanan atas.</div>';
    return;
  }
  const nimQuery = new URLSearchParams(location.search).get('nim');

  if (saya.peran === 'dosen') {
    isi.innerHTML = formDosen(nimQuery) + '<div id="dasbor"></div>';
    isiDatalistNIM(document.getElementById('daftar-nim'), saya.prodi_mengajar);
    document.getElementById('form-nim').addEventListener('submit', e => {
      e.preventDefault();
      const nim = new FormData(e.target).get('nim').trim();
      history.replaceState(null, '', `?nim=${encodeURIComponent(nim)}`);
      tampil(nim, 'Dasbor mahasiswa');
    });
    if (nimQuery) await tampil(nimQuery, 'Dasbor mahasiswa');
    return;
  }

  if (!saya.nim) {
    isi.innerHTML = keadaanKosong({
      judul: 'Nomor ini belum tercatat di roster mahasiswa',
      keterangan: 'Dasbor belajar dihitung per NIM. Dasbor terisi setelah pengelola prodi mendaftarkan NIM dan nomor WhatsApp Anda di roster.',
      siapa: 'pengelola program studi',
      aksi: { href: './', label: 'Kembali ke Beranda' },
    });
    return;
  }
  // Mahasiswa selalu melihat dasbornya sendiri; ?nim= diabaikan supaya tidak
  // ada kesan bisa membuka dasbor orang lain.
  prodiDilihat = saya.prodi_kode || '';
  isi.innerHTML = '<div id="dasbor"></div>';
  const pekan = saya.prodi_kode ? await pekanMahasiswa(saya.prodi_kode).catch(() => null) : null;
  await tampil(saya.nim, 'Dasbor Anda', pekan);
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
