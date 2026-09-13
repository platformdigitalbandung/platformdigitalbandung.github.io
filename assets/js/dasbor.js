import { apiGet, isLoggedIn, arahkanKeLogin } from './api.js';

// Dasbor Belajar. Mahasiswa melihat dasbornya sendiri (NIM dari
// /api/proyekblok/saya, dibuktikan backend lewat nomor pada token); dosen boleh
// melihat dasbor mahasiswa mana pun lewat isian NIM atau ?nim=. Kewenangannya
// tetap dicek backend — mahasiswa yang mengetik NIM orang lain ditolak 403.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function satuDesimal(n) { return typeof n === 'number' ? n.toFixed(1) : '–'; }

const LENCANA = {
  'tercapai': ['rendah', 'tercapai'],
  'belum': ['sedang', 'belum'],
  'ditopang-jalur-lain': ['', 'ditopang jalur lain'],
};

// 422 dari rute dasbor artinya "datanya belum lengkap" (kalender belum terbit,
// prodi belum punya CPL) — keadaan yang wajar, bukan halaman yang rusak. 404
// dan lainnya memang kegagalan.
function kartuGagal(judul, err) {
  if (err && err.status === 422) {
    return `<div class="kartu"><h3>${esc(judul)}</h3>
      <div class="kosong">Belum bisa dihitung: ${esc(err.message)}.</div></div>`;
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
      <h3>Capaian Pembelajaran (CPL)</h3>
      <div class="stat-row">
        <div class="stat"><span class="angka">${esc(r.tercapai)} / ${esc(r.dapat_dinilai)}</span><span class="label">CPL tercapai dari yang dinilai lewat proyek</span></div>
        <div class="stat"><span class="angka">${esc(r.ditopang_jalur_lain)}</span><span class="label">ditopang jalur lain</span></div>
      </div>
      <p class="meta">Penyebutnya ${esc(r.dapat_dinilai)}, bukan ${esc(r.total)}: ${esc(r.ditopang_jalur_lain)} CPL sengaja tidak dipetakan ke rumpun mana pun dan dinilai di luar proyek blok, jadi tidak adil dihitung "belum tercapai".</p>
      ${r.tercapai_hanya_rpl ? `<p class="redup">${esc(r.tercapai_hanya_rpl)} dari yang tercapai buktinya hanya RPL (pengakuan pengalaman kerja), tanpa nilai proyek blok.</p>` : ''}
      ${daftar.length ? `<div class="gulir"><table>
          <tr><th>CPL</th><th>Domain</th><th>Status</th><th>Bukti</th></tr>
          ${daftar.map(c => {
            const [kelas, label] = LENCANA[c.status] || ['', c.status];
            return `<tr><td>${esc(c.cpl_kode)}</td><td>${esc(c.domain)}</td>
              <td><span class="lencana ${kelas}">${esc(label)}</span></td><td>${buktiCPL(c)}</td></tr>`;
          }).join('')}
        </table></div>` : '<p class="redup">Belum ada CPL terdaftar.</p>'}
    </div>`;
}

async function tampil(nim, judul) {
  const wadah = document.getElementById('dasbor');
  wadah.innerHTML = `<p class="redup">${esc(judul)} · NIM ${esc(nim)}</p><p class="redup">Memuat…</p>`;
  const kode = encodeURIComponent(nim);
  // Dimuat terpisah: satu kartu yang belum bisa dihitung (mis. kalender belum
  // terbit) tidak boleh ikut mengosongkan kartu yang lain.
  const [beban, cpl] = await Promise.allSettled([
    apiGet(`/api/dasbor/beban-belajar/${kode}`, { auth: true }),
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
      <p class="meta">Sebagai dosen, Anda bisa melihat dasbor mahasiswa mana pun. Daftar NIM ada di halaman <a href="akademik.html">Roster Mahasiswa &amp; NIP</a>.</p>
      <form id="form-nim">
        <label>NIM <input name="nim" required maxlength="30" value="${esc(nimAwal || '')}"></label>
        <button>Tampilkan</button>
      </form>
    </div>`;
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  const nimQuery = new URLSearchParams(location.search).get('nim');

  if (saya.peran === 'dosen') {
    isi.innerHTML = formDosen(nimQuery) + '<div id="dasbor"></div>';
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
    isi.innerHTML = '<div class="kosong">Nomor ini belum tercatat di roster mahasiswa. Dasbor baru bisa dihitung setelah pengelola prodi mendaftarkan NIM dan nomor WhatsApp Anda.</div>';
    return;
  }
  // Mahasiswa selalu melihat dasbornya sendiri; ?nim= diabaikan supaya tidak
  // ada kesan bisa membuka dasbor orang lain.
  isi.innerHTML = '<div id="dasbor"></div>';
  await tampil(saya.nim, 'Dasbor Anda');
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
