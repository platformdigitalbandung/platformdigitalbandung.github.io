import { apiGet, apiPostJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Kuis Gerbang. Mahasiswa mengerjakan kuis rumpun/minggu; NIM-nya diambil
// server dari roster lewat token, bukan dikirim dari sini. Dosen melihat status
// kuis mahasiswa lewat isian NIM. Kunci jawaban tidak pernah sampai ke
// peramban — backend membuangnya sebelum membalas.

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function satuDesimal(n) { return typeof n === 'number' ? n.toFixed(1) : '–'; }

let kuisAktif = null;

async function rumpunSemuaProdi() {
  const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
  const hasil = [];
  for (const p of prodi) {
    const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(p.kode)}/rumpun`);
    rumpun.forEach(r => hasil.push({ kode: r.kode, nama: r.nama, prodi: p.kode }));
  }
  return hasil;
}

function lencanaLulus(lulus) {
  return lulus ? '<span class="lencana rendah">lulus</span>' : '<span class="lencana tinggi">belum lulus</span>';
}

function kartuPilih(rumpun, mingguAwal) {
  return `
    <div class="kartu">
      <h3>Pilih Kuis</h3>
      <form id="form-pilih">
        <label>Rumpun
          <select name="rumpun" required>
            ${rumpun.map(r => `<option value="${esc(r.kode)}">${esc(r.kode)} — ${esc(r.nama)} (${esc(r.prodi)})</option>`).join('')}
          </select></label>
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${esc(mingguAwal)}"></label>
        <button>Muat Kuis</button>
      </form>
      <div id="kuis"></div>
    </div>`;
}

async function muatKuis(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const wadah = document.getElementById('kuis');
  wadah.innerHTML = '<p class="redup">Memuat kuis…</p>';
  try {
    kuisAktif = await apiGet(`/api/kuisgerbang/${encodeURIComponent(fd.get('rumpun'))}/${encodeURIComponent(fd.get('minggu'))}`, { auth: true });
    const soal = kuisAktif.soal || [];
    if (!soal.length) {
      wadah.innerHTML = '<div class="kosong">Kuis ini belum punya soal.</div>';
      return;
    }
    wadah.innerHTML = `
      <p class="meta">${soal.length} soal · ambang lulus ${satuDesimal(kuisAktif.ambang_lulus || 60)}%</p>
      <form id="form-jawab">
        ${soal.map((s, i) => `
          <h4>${i + 1}. ${esc(s.pertanyaan)}</h4>
          ${(s.pilihan || []).map((p, j) => `
            <label><input type="radio" name="s${i}" value="${j}" required> ${esc(p)}</label>`).join('')}`).join('')}
        <button>Kirim Jawaban</button>
      </form>
      <div id="hasil-jawab"></div>`;
    document.getElementById('form-jawab').addEventListener('submit', kirimJawaban);
  } catch (err) {
    // 404 = belum ada kuis untuk rumpun/minggu itu: keadaan wajar, bukan rusak.
    wadah.innerHTML = err.status === 404
      ? `<div class="kosong">${esc(err.message)}.</div>`
      : `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function kirimJawaban(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const soal = kuisAktif.soal || [];
  const jawaban = soal.map((_, i) => Number(fd.get(`s${i}`)));
  const hasil = document.getElementById('hasil-jawab');
  hasil.innerHTML = '<p class="redup">Mengirim…</p>';
  try {
    const r = await apiPostJson(`/api/kuisgerbang/${encodeURIComponent(kuisAktif.id)}/submit`, { jawaban_idx: jawaban });
    hasil.innerHTML = `<div class="pesan ${r.lulus ? 'sukses' : 'gagal'}">Skor <b>${satuDesimal(r.skor)}%</b> — ${lencanaLulus(r.lulus)}.
      ${r.lulus ? '' : ' Pelajari lagi materinya lalu kerjakan ulang; hasil terbaru akan menimpa yang ini.'}</div>`;
    muatRiwayat(r.nim);
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Jawaban gagal dikirim: ${esc(err.message)}</div>`;
  }
}

async function muatRiwayat(nim) {
  const wadah = document.getElementById('riwayat');
  if (!wadah || !nim) return;
  wadah.innerHTML = '<p class="redup">Memuat riwayat…</p>';
  try {
    const { jawaban = [] } = await apiGet(`/api/mahasiswa/${encodeURIComponent(nim)}/kuisgerbang/status`, { auth: true });
    wadah.innerHTML = jawaban.length ? `<div class="gulir"><table>
        <tr><th>Kuis</th><th class="num">Skor</th><th>Status</th></tr>
        ${jawaban.map(j => `<tr><td>#${esc(String(j.kuis_id).slice(-6))}</td>
          <td class="num">${satuDesimal(j.skor)}%</td><td>${lencanaLulus(j.lulus)}</td></tr>`).join('')}
      </table></div>
      <p class="redup">Satu baris per kuis — percobaan terakhir menimpa yang sebelumnya.</p>`
      : '<div class="kosong">Belum ada kuis yang dikerjakan.</div>';
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function kartuDosen(nimAwal) {
  return `
    <div class="kartu">
      <h3>Status Kuis Mahasiswa</h3>
      <p class="meta">Cek apakah seorang mahasiswa sudah lulus kuis gerbang sebelum sesi Jumat. Daftar NIM ada di <a href="akademik.html">Roster Mahasiswa &amp; NIP</a>.</p>
      <form id="form-nim">
        <label>NIM <input name="nim" required maxlength="30" value="${esc(nimAwal || '')}"></label>
        <button>Tampilkan</button>
      </form>
      <div id="riwayat"></div>
    </div>`;
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  if (saya.peran === 'dosen') {
    isi.innerHTML = kartuDosen(new URLSearchParams(location.search).get('nim'));
    document.getElementById('form-nim').addEventListener('submit', e => {
      e.preventDefault();
      muatRiwayat(new FormData(e.target).get('nim').trim());
    });
    return;
  }
  if (!saya.nim) {
    isi.innerHTML = '<div class="kosong">Nomor ini belum tercatat di roster mahasiswa, jadi jawaban kuis tidak bisa dicatat atas nama siapa pun. Hubungi pengelola prodi.</div>';
    return;
  }
  // Minggu bawaan dari kalender terbit lewat dasbor; kalau kalendernya belum
  // terbit (422), mahasiswa mengisi minggunya sendiri.
  let mingguAwal = 1;
  try {
    const beban = await apiGet(`/api/dasbor/beban-belajar/${encodeURIComponent(saya.nim)}`, { auth: true });
    if (beban.minggu) mingguAwal = beban.minggu;
  } catch (_) { /* kalender belum terbit: biarkan 1 */ }

  const rumpun = await rumpunSemuaProdi();
  isi.innerHTML = kartuPilih(rumpun, mingguAwal)
    + '<div class="kartu"><h3>Riwayat Kuis Anda</h3><div id="riwayat"></div></div>';
  document.getElementById('form-pilih').addEventListener('submit', muatKuis);
  muatRiwayat(saya.nim);
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
