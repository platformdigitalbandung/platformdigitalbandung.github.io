import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc } from './ui.js';

// Ganti Kata Sandi — untuk siapa pun yang terdaftar (mahasiswa roster atau
// dosen). Identitas masuk dan status templat dari GET /api/akun/sandi;
// penggantian lewat PUT /api/akun/sandi dengan kata sandi lama (templat atau
// yang tersimpan). Aturan kata sandi baru diperiksa backend.

const isi = document.getElementById('isi');
const PANJANG_MIN = 8;

function kartuStatus(st) {
  const tanda = st.templat
    ? '<span class="lencana sedang">kata sandi awal</span>'
    : '<span class="lencana rendah">sudah diganti</span>';
  return `
    <div class="kartu">
      <h3>Akun Anda</h3>
      <p>Masuk dengan <b>${st.peran === 'mahasiswa' ? 'NIM' : 'email kampus'}</b>: <b>${esc(st.identitas || '—')}</b></p>
      <p>Kata sandi: ${tanda}</p>
      ${st.templat ? '<p class="meta">Anda masih memakai kata sandi awal, yang bentuknya diketahui banyak orang. Ganti dengan kata sandi yang hanya Anda ketahui.</p>' : ''}
      ${st.bisa_masuk ? '' : `<div class="pesan gagal">${esc(st.alasan || 'Akun ini belum bisa masuk dengan kata sandi.')}</div>`}
    </div>`;
}

function kartuGanti(st) {
  return `
    <div class="kartu">
      <h3>Ganti Kata Sandi</h3>
      <form id="form-ganti" autocomplete="on">
        <input type="text" name="username" autocomplete="username" value="${esc(st.identitas || '')}" hidden>
        <label>Kata sandi lama <input type="password" name="sandi_lama" autocomplete="current-password" required></label>
        <label>Kata sandi baru <input type="password" name="sandi_baru" autocomplete="new-password" minlength="${PANJANG_MIN}" maxlength="128" required></label>
        <label>Ulangi kata sandi baru <input type="password" name="ulang" autocomplete="new-password" minlength="${PANJANG_MIN}" maxlength="128" required></label>
        <p class="meta">Minimal ${PANJANG_MIN} karakter dan tidak sama dengan kata sandi awal. Kata sandi awal: bagian email sebelum @ ditambah ADB${st.peran === 'mahasiswa' ? ' (tanpa email: NIM ditambah ADB)' : ''}.</p>
        <button>Simpan Kata Sandi Baru</button>
      </form>
      <div id="hasil-ganti"></div>
    </div>`;
}

async function ganti(e) {
  e.preventDefault();
  const hasil = document.getElementById('hasil-ganti');
  const fd = new FormData(e.target);
  const lama = String(fd.get('sandi_lama') || '');
  const baru = String(fd.get('sandi_baru') || '');
  if (baru !== String(fd.get('ulang') || '')) {
    hasil.innerHTML = '<div class="pesan gagal">Kata sandi baru dan ulangannya tidak sama.</div>';
    return;
  }
  if (baru.length < PANJANG_MIN) {
    hasil.innerHTML = `<div class="pesan gagal">Kata sandi baru minimal ${PANJANG_MIN} karakter.</div>`;
    return;
  }
  const tombol = e.target.querySelector('button');
  tombol.disabled = true;
  try {
    await apiPutJson('/api/akun/sandi', { sandi_lama: lama, sandi_baru: baru });
    e.target.reset();
    const st = await apiGet('/api/akun/sandi');
    render(st, '<div class="pesan sukses">Kata sandi berhasil diganti. Mulai sekarang masuk dengan kata sandi baru ini.</div>');
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
  } finally {
    tombol.disabled = false;
  }
}

function render(st, pesan = '') {
  isi.innerHTML = kartuStatus(st) + (st.bisa_masuk ? kartuGanti(st) : '');
  const form = document.getElementById('form-ganti');
  if (form) {
    form.addEventListener('submit', ganti);
    if (pesan) document.getElementById('hasil-ganti').innerHTML = pesan;
  }
}

async function muat() {
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda berakhir. Masuk lagi untuk mengganti kata sandi.</div>';
    return;
  }
  render(await apiGet('/api/akun/sandi'));
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
