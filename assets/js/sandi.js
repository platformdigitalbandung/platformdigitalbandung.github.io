import { getCookie, deleteCookie } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.12/cookie.min.js';
import { redirect } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.12/url.min.js';
import { apiGet, apiPutJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, tanpaNomorWA } from './akun.js';
import { esc } from './ui.js';
import { htmlHubungkanWA, pasangHubungkanWA } from './hubungkanwa.js';

// Ganti Kata Sandi — untuk siapa pun yang terdaftar (mahasiswa roster atau
// dosen). Status dari GET /api/akun/sandi; penggantian lewat PUT
// /api/akun/sandi. Sejak keputusan developer Rolly 2026-09-28: kata sandi
// awal berpola dilarang, kata sandi wajib berklasifikasi kuat (diperiksa
// backend — pemeriksaan di sini hanya membantu), halaman ini membuatkan kata
// sandi acak yang kuat bila diminta, dan akun yang belum punya kata sandi
// (masuk lewat WhatsApp) membuat kata sandi pertamanya tanpa kata sandi lama.

const isi = document.getElementById('isi');
const PANJANG_MIN = 12;
const SYARAT = [
  { kunci: 'panjang', teks: `minimal ${PANJANG_MIN} karakter`, cek: s => [...s].length >= PANJANG_MIN },
  { kunci: 'kecil', teks: 'huruf kecil', cek: s => /\p{Ll}/u.test(s) },
  { kunci: 'besar', teks: 'huruf besar', cek: s => /\p{Lu}/u.test(s) },
  { kunci: 'angka', teks: 'angka', cek: s => /\p{Nd}/u.test(s) },
  { kunci: 'simbol', teks: 'simbol (mis. - ! ? #)', cek: s => /[^\p{L}\p{Nd}]/u.test(s) },
  { kunci: 'ulang', teks: 'tanpa karakter sama 4 kali berturut-turut', cek: s => s.length > 0 && !/(.)\1{3}/u.test(s) },
];

// Huruf kata sandi acak, sama dengan backend (katasandi.Acak): tanpa l/1/I dan o/O/0.
const HURUF = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function kataSandiAcak() {
  for (;;) {
    const angka = new Uint32Array(12);
    crypto.getRandomValues(angka);
    let s = '';
    angka.forEach((n, i) => {
      if (i > 0 && i % 4 === 0) s += '-';
      // Bias modulo 2^32 terhadap 56 huruf diabaikan (±1e-8).
      s += HURUF[n % HURUF.length];
    });
    if (SYARAT.every(x => x.cek(s))) return s;
  }
}

function kartuStatus(st) {
  let tanda = '<span class="lencana rendah">dibuat sendiri</span>';
  if (st.wajib_ganti) tanda = '<span class="lencana tinggi">wajib diganti</span>';
  else if (!st.perlu_sandi_lama) tanda = '<span class="lencana sedang">belum ada</span>';
  return `
    <div class="kartu">
      <h3>Akun Anda</h3>
      <p>Masuk dengan <b>${st.peran === 'mahasiswa' ? 'NIM' : 'email kampus'}</b>: <b>${esc(st.identitas || '—')}</b></p>
      <p>Kata sandi: ${tanda}</p>
      ${st.wajib_ganti ? `<div class="pesan gagal">${esc(st.alasan_ganti || 'Kata sandi Anda wajib diganti.')} Halaman lain terbuka lagi setelah kata sandi baru tersimpan.</div>` : ''}
      ${!st.perlu_sandi_lama && !st.wajib_ganti && st.identitas ? '<p class="meta">Akun Anda belum punya kata sandi. Buat di bawah supaya Anda bisa masuk dengan NIM atau email kampus selain lewat WhatsApp.</p>' : ''}
      ${!st.identitas ? `<div class="pesan gagal">${esc(st.alasan || 'Akun ini belum bisa masuk dengan kata sandi.')}</div>` : ''}
    </div>`;
}

function kartuGanti(st) {
  // Kata sandi lama hanya diminta bila akun punya kata sandi tersimpan; akun
  // yang masih memakai kata sandi awal langsung membuat yang baru (2026-09-29).
  const judul = st.perlu_sandi_lama ? 'Ganti Kata Sandi' : (st.wajib_ganti ? 'Buat Kata Sandi Baru' : 'Buat Kata Sandi');
  return `
    <div class="kartu">
      <h3>${judul}</h3>
      <form id="form-ganti" autocomplete="on">
        <input type="text" name="username" autocomplete="username" value="${esc(st.identitas || '')}" hidden>
        ${st.perlu_sandi_lama ? '<label>Kata sandi lama <input type="password" name="sandi_lama" autocomplete="current-password" required></label>' : ''}
        <label>Kata sandi baru <input type="password" name="sandi_baru" autocomplete="new-password" minlength="${PANJANG_MIN}" maxlength="128" required></label>
        <label>Ulangi kata sandi baru <input type="password" name="ulang" autocomplete="new-password" minlength="${PANJANG_MIN}" maxlength="128" required></label>
        <label class="lihat-sandi"><input type="checkbox" name="lihat"> Tampilkan kata sandi</label>
        <p class="meta">Kata sandi harus kuat:</p>
        <ul class="syarat-sandi">${SYARAT.map(x => `<li data-syarat="${x.kunci}">${esc(x.teks)}</li>`).join('')}<li>tidak memuat NIM, email, atau nama Anda</li></ul>
        <p class="cta-row"><button type="button" class="sekunder" data-aksi="acak">Buatkan kata sandi kuat</button></p>
        <div id="hasil-acak" aria-live="polite"></div>
        <button>Simpan Kata Sandi Baru</button>
      </form>
      <div id="hasil-ganti"></div>
    </div>`;
}

function tandaiSyarat(form) {
  const s = String(form.sandi_baru.value || '');
  form.querySelectorAll('[data-syarat]').forEach(li => {
    const x = SYARAT.find(y => y.kunci === li.dataset.syarat);
    li.classList.toggle('terpenuhi', !!(x && x.cek(s)));
  });
}

function lihatSandi(form, tampil) {
  form.querySelectorAll('input[name="sandi_baru"], input[name="ulang"], input[name="sandi_lama"]').forEach(el => { el.type = tampil ? 'text' : 'password'; });
}

async function ganti(e) {
  e.preventDefault();
  const hasil = document.getElementById('hasil-ganti');
  const form = e.target;
  const lama = form.sandi_lama ? String(form.sandi_lama.value || '') : '';
  const baru = String(form.sandi_baru.value || '');
  if (baru !== String(form.ulang.value || '')) {
    hasil.innerHTML = '<div class="pesan gagal">Kata sandi baru dan ulangannya tidak sama.</div>';
    return;
  }
  const kurang = SYARAT.filter(x => !x.cek(baru));
  if (kurang.length) {
    hasil.innerHTML = `<div class="pesan gagal">Kata sandi belum kuat: ${esc(kurang.map(x => x.teks).join(', '))}.</div>`;
    return;
  }
  const tombol = form.querySelector('button:not([type="button"])');
  tombol.disabled = true;
  try {
    await apiPutJson('/api/akun/sandi', { sandi_lama: lama, sandi_baru: baru });
    form.reset();
    const wajib = getCookie('wajib_ganti');
    deleteCookie('wajib_ganti');
    const st = await apiGet('/api/akun/sandi');
    render(st, `<div class="pesan sukses">Kata sandi berhasil disimpan. Mulai sekarang masuk dengan kata sandi baru ini.${wajib ? ' Halaman lain sudah terbuka lagi.' : ''}</div>`);
    if (wajib) {
      const asal = getCookie('login_redirect');
      setTimeout(() => redirect(/^\/(?![/\\])/.test(asal) && !/sandi\.html/.test(asal) ? asal : '/'), 1500);
    }
  } catch (err) {
    hasil.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
  } finally {
    tombol.disabled = false;
  }
}

function render(st, pesan = '') {
  const hubungkan = st.peran === 'mahasiswa' && !st.nomor_wa && tanpaNomorWA()
    ? `<div class="kartu">${htmlHubungkanWA()}</div>` : '';
  isi.innerHTML = kartuStatus(st) + (st.identitas ? kartuGanti(st) : '') + hubungkan;
  const form = document.getElementById('form-ganti');
  if (!form) return;
  form.addEventListener('submit', ganti);
  form.sandi_baru.addEventListener('input', () => tandaiSyarat(form));
  form.lihat.addEventListener('change', () => lihatSandi(form, form.lihat.checked));
  form.querySelector('[data-aksi="acak"]').addEventListener('click', () => {
    const s = kataSandiAcak();
    form.sandi_baru.value = s;
    form.ulang.value = s;
    form.lihat.checked = true;
    lihatSandi(form, true);
    tandaiSyarat(form);
    document.getElementById('hasil-acak').innerHTML = `<p class="meta">Kata sandi baru: <code>${esc(s)}</code> — catat atau simpan di pengelola kata sandi sebelum menekan Simpan.</p>`;
  });
  if (pesan) document.getElementById('hasil-ganti').innerHTML = pesan;
}

async function muat() {
  const saya = await sayaSekarang;
  if (!saya) {
    isi.innerHTML = '<div class="pesan gagal">Sesi Anda berakhir. Masuk lagi untuk mengganti kata sandi.</div>';
    return;
  }
  render(await apiGet('/api/akun/sandi'));
}

pasangHubungkanWA(isi);

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
