import { apiGet, apiPostJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';

// Rekaman Sesi Sinkron. Semua pemegang token bisa melihat rekaman per kalender
// terbit; dosen menerbitkan/menghapus rekaman dan melihat rekap keterlambatan.
// Kewenangannya dicek backend (403).

const isi = document.getElementById('isi');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

// Tanggal sesi disimpan sebagai tengah malam UTC dari tanggal kalendernya, jadi
// dibaca dalam UTC; tenggat dan waktu terbit adalah waktu nyata, dibaca WIB.
function tanggalSesi(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function waktuWIB(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : `${d.toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB`;
}

const STATUS = {
  'terbit-tepat': ['rendah', 'terbit tepat waktu'],
  'terbit-terlambat': ['sedang', 'terbit terlambat'],
  'belum-ada': ['tinggi', 'belum ada, lewat tenggat'],
  'menunggu': ['', 'menunggu, tenggat belum lewat'],
  'belum-berlangsung': ['', 'sesi belum berlangsung'],
};
function lencana(status) {
  const [kelas, label] = STATUS[status] || ['', status];
  return `<span class="lencana ${kelas}">${esc(label)}</span>`;
}

let dosen = false;
let kalenderAktif = '';

function selRekaman(s) {
  const r = s.rekaman;
  if (r) {
    return `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(r.youtube_id)}" target="_blank" rel="noopener">${esc(r.judul || 'Tonton rekaman')}</a>
      <br><span class="redup">terbit ${waktuWIB(r.diterbitkan_pada)}</span>
      ${dosen ? `<br><button type="button" class="sekunder hapus-rekaman" data-id="${escAttr(r.id)}">Hapus</button>` : ''}`;
  }
  if (dosen && s.status !== 'belum-berlangsung') {
    return `<form class="form-terbit" data-sesi="${escAttr(s.sesi_index)}">
      <input name="url_video" required placeholder="Tautan YouTube" aria-label="Tautan YouTube">
      <input name="judul" maxlength="150" placeholder="Judul (opsional)" aria-label="Judul rekaman">
      <button>Terbitkan</button></form>`;
  }
  return '<span class="redup">–</span>';
}

function tabelSesi(d) {
  if (!d.sesi.length) return '<div class="kosong">Kalender ini tidak punya sesi daring sinkron.</div>';
  // Dosen punya form terbit di dalam sel: tabel-sunting membuat inputnya ringkas.
  return `<div class="gulir"><table${dosen ? ' class="tabel-sunting"' : ''}>
    <tr><th class="num">Minggu</th><th>Sesi</th><th>Status</th><th>Tenggat terbit</th><th>Rekaman</th></tr>
    ${d.sesi.map(s => `<tr>
      <td class="num">${esc(s.minggu)}</td>
      <td>${esc(tanggalSesi(s.tanggal))}</td>
      <td>${lencana(s.status)}</td>
      <td>${waktuWIB(s.tenggat)}</td>
      <td>${selRekaman(s)}</td></tr>`).join('')}
  </table></div>`;
}

async function muatKalender(id) {
  kalenderAktif = id;
  const wadah = document.getElementById('daftar-rekaman');
  wadah.innerHTML = '<p class="redup">Memuat sesi…</p>';
  try {
    const d = await apiGet(`/api/rekaman/kalender/${encodeURIComponent(id)}`, { auth: true });
    wadah.innerHTML = `<div class="kartu">
      <h3>${esc(d.prodi_kode.toUpperCase())} · angkatan ${esc(d.angkatan)} · semester ${esc(d.semester)}</h3>
      ${tabelSesi(d)}
      <div id="hasil-rekaman"></div></div>`;
    history.replaceState(null, '', `?kalender=${encodeURIComponent(id)}`);
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function pesan(html) {
  const el = document.getElementById('hasil-rekaman');
  if (el) el.innerHTML = html;
}

async function terbitkan(form) {
  const fd = new FormData(form);
  const tombol = form.querySelector('button');
  tombol.disabled = true;
  try {
    const r = await apiPostJson('/api/rekaman', {
      kalender_id: kalenderAktif, sesi_index: Number(form.dataset.sesi),
      url_video: fd.get('url_video').trim(), judul: (fd.get('judul') || '').trim(),
    });
    await muatKalender(kalenderAktif);
    pesan(r.terlambat
      ? `<div class="pesan gagal">Rekaman terbit, tetapi melewati tenggat ${waktuWIB(r.tenggat)} dan tercatat terlambat.</div>`
      : '<div class="pesan sukses">Rekaman terbit tepat waktu.</div>');
    if (dosen) muatRekap();
  } catch (err) {
    tombol.disabled = false;
    pesan(`<div class="pesan gagal">Gagal menerbitkan: ${esc(err.message)}</div>`);
  }
}

async function hapus(id) {
  if (!window.confirm('Hapus rekaman ini? Menerbitkan ulang akan mencatat waktu terbit yang baru.')) return;
  try {
    await apiDeleteJson(`/api/rekaman/${encodeURIComponent(id)}`);
    await muatKalender(kalenderAktif);
    if (dosen) muatRekap();
  } catch (err) {
    pesan(`<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`);
  }
}

async function muatRekap() {
  const wadah = document.getElementById('rekap-rekaman');
  try {
    const { kalender = [] } = await apiGet('/api/rekaman/rekap', { auth: true });
    const perlu = kalender.flatMap(k => k.perlu_perhatian.map(s => ({ ...s, k })));
    wadah.innerHTML = `<div class="kartu">
      <h3>Rekap Keterlambatan Rekaman</h3>
      <p class="meta">Jatuh tempo = sesi yang tenggatnya sudah lewat atau rekamannya sudah terbit.</p>
      ${kalender.length ? `<div class="gulir"><table>
        <tr><th>Kalender</th><th class="num">Jatuh tempo</th><th class="num">Tepat</th><th class="num">Terlambat</th><th class="num">Belum ada</th><th class="num">Menunggu</th></tr>
        ${kalender.map(k => `<tr><td>${esc(k.prodi_kode.toUpperCase())} ${esc(k.angkatan)} sem ${esc(k.semester)}</td>
          <td class="num">${esc(k.jatuh_tempo)}</td><td class="num">${esc(k.terbit_tepat)}</td><td class="num">${esc(k.terbit_terlambat)}</td>
          <td class="num">${esc(k.belum_ada)}</td><td class="num">${esc(k.menunggu)}</td></tr>`).join('')}
      </table></div>` : '<div class="kosong">Belum ada kalender terbit.</div>'}
      ${perlu.length ? `<h4>Perlu perhatian</h4><ul>${perlu.map(s => `<li>${esc(s.k.prodi_kode.toUpperCase())} ${esc(s.k.angkatan)} sem ${esc(s.k.semester)} · minggu ${esc(s.minggu)} (${esc(tanggalSesi(s.tanggal))}) — ${lencana(s.status)}</li>`).join('')}</ul>` : ''}
    </div>`;
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">Rekap: ${esc(err.message)}</div>`;
  }
}

async function muat() {
  const saya = await apiGet('/api/proyekblok/saya', { auth: true });
  dosen = saya.peran === 'dosen';
  const { kalender = [] } = await apiGet('/api/kalender');
  if (!kalender.length) {
    isi.innerHTML = '<div class="kosong">Belum ada kalender semester yang diterbitkan.</div>';
    return;
  }
  isi.innerHTML = `
    ${dosen ? '<div id="rekap-rekaman"><p class="redup">Memuat rekap…</p></div>' : ''}
    <div class="kartu">
      <h3>Pilih Kalender</h3>
      <form id="form-kalender">
        <label>Kalender terbit
          <select name="kalender">${kalender.map(k => `<option value="${escAttr(k.id)}">${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)}</option>`).join('')}</select></label>
        <button>Tampilkan Sesi</button>
      </form>
    </div>
    <div id="daftar-rekaman"></div>`;

  const form = document.getElementById('form-kalender');
  const pilih = form.querySelector('select');
  const awal = new URLSearchParams(location.search).get('kalender');
  if (awal && [...pilih.options].some(o => o.value === awal)) pilih.value = awal;
  form.addEventListener('submit', e => { e.preventDefault(); muatKalender(pilih.value); });

  const daftar = document.getElementById('daftar-rekaman');
  daftar.addEventListener('submit', e => {
    if (!e.target.classList.contains('form-terbit')) return;
    e.preventDefault();
    terbitkan(e.target);
  });
  daftar.addEventListener('click', e => {
    const b = e.target.closest('button.hapus-rekaman');
    if (b) hapus(b.dataset.id);
  });

  if (dosen) muatRekap();
  await muatKalender(pilih.value);
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
