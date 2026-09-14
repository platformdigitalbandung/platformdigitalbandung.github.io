import { apiGet, apiPostJson, apiDeleteJson } from './api.js';
import { adalahPimpinan, prodiPimpinan } from './akun.js';
import { esc, istilah, keadaanKosong, labelTabel, prodiBawaan } from './ui.js';
import { sayaHalaman, sedangMengajar } from './hal-dosen.js';

// Rekaman Sesi Sinkron. Semua pemegang token bisa melihat rekaman per kalender
// terbit; dosen menerbitkan/menghapus rekaman dan melihat rekap keterlambatan.
// Kewenangannya dicek backend (403).
//
// Mahasiswa hanya melihat kalender prodinya; dosen/kaprodi mulai dari kalender
// prodinya dan hanya mereka yang melihat formulir terbit (peran aktif admin
// hanya membaca rekap). Tabel sesi menjadi kartu di HP supaya tombol Terbitkan
// tidak tersembunyi di area gulir.

const isi = document.getElementById('isi');
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

let saya = null;
let dosen = false;
let pimpinan = false;
let kalenderAktif = '';
// Boleh menerbitkan/menghapus rekaman kalender yang sedang dibuka: peran aktif
// mengajar DAN prodi kalender termasuk prodi mengajar (pengampu atau kaprodi) —
// keputusan pemilik produk 2026-09-15. Backend tetap menolak 403.
let bolehTulis = false;

function bolehTerbitkan(prodiKalender) {
  const mengajar = ((saya && saya.prodi_mengajar) || []).map(k => String(k).toLowerCase());
  return dosen && mengajar.includes(String(prodiKalender || '').toLowerCase());
}

function selRekaman(s) {
  const r = s.rekaman;
  if (r) {
    return `<div><a href="https://www.youtube.com/watch?v=${encodeURIComponent(r.youtube_id)}" target="_blank" rel="noopener">${esc(r.judul || 'Tonton rekaman')}</a>
      <br><span class="redup">terbit ${waktuWIB(r.diterbitkan_pada)}</span>
      ${bolehTulis ? `<br><button type="button" class="sekunder hapus-rekaman" data-id="${escAttr(r.id)}">Hapus</button>` : ''}</div>`;
  }
  if (bolehTulis && s.status !== 'belum-berlangsung') {
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
  return `<div class="gulir"><table${bolehTulis ? ' class="tabel-sunting"' : ''}>
    <thead><tr><th class="num">Minggu</th><th>Sesi</th><th>Status</th><th>Tenggat terbit</th><th>Rekaman</th></tr></thead><tbody>
    ${d.sesi.map(s => `<tr>
      <td class="num">${esc(s.minggu)}</td>
      <td>${esc(tanggalSesi(s.tanggal))}</td>
      <td>${lencana(s.status)}</td>
      <td>${waktuWIB(s.tenggat)}</td>
      <td>${selRekaman(s)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

async function muatKalender(id) {
  kalenderAktif = id;
  const wadah = document.getElementById('daftar-rekaman');
  wadah.innerHTML = '<p class="redup">Memuat sesi…</p>';
  try {
    const d = await apiGet(`/api/rekaman/kalender/${encodeURIComponent(id)}`, { auth: true });
    bolehTulis = bolehTerbitkan(d.prodi_kode);
    const P = esc(d.prodi_kode.toUpperCase());
    const catatanTulis = dosen && !bolehTulis
      ? `<div class="pesan info">Rekaman kalender ${P} hanya diterbitkan atau dihapus dosen pengampu ${P} atau kaprodi ${P}. Anda bisa melihatnya saja.</div>`
      : '';
    wadah.innerHTML = `<div class="kartu">
      <h3>${P} · angkatan ${esc(d.angkatan)} · semester ${esc(d.semester)}</h3>
      ${catatanTulis}
      <p class="catatan-istilah">${istilah('daring sinkron', 'Sesi daring sinkron')}: rekamannya diterbitkan dosen paling lambat pada tenggat terbit.</p>
      ${tabelSesi(d)}
      <div id="hasil-rekaman"></div></div>`;
    const tabel = wadah.querySelector('table');
    if (tabel) labelTabel(tabel);
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
    if (pimpinan) muatRekap();
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
    if (pimpinan) muatRekap();
  } catch (err) {
    pesan(`<div class="pesan gagal">Gagal menghapus: ${esc(err.message)}</div>`);
  }
}

// Rekap tingkat prodi: admin semua prodi (tanpa query); kaprodi per prodi yang
// dipimpin, dikirim eksplisit karena backend memberi pemegang jabatan admin
// semua prodi walau peran aktifnya kaprodi.
async function ambilRekap() {
  const boleh = prodiPimpinan(saya);
  if (!boleh) return (await apiGet('/api/rekaman/rekap', { auth: true })).kalender || [];
  const hasil = await Promise.all(boleh.map(k => apiGet(`/api/rekaman/rekap?prodi=${encodeURIComponent(k)}`, { auth: true })));
  return hasil.flatMap(r => r.kalender || []);
}

async function muatRekap() {
  const wadah = document.getElementById('rekap-rekaman');
  const boleh = prodiPimpinan(saya);
  const lingkup = boleh ? boleh.map(k => k.toUpperCase()).join(', ') : 'semua prodi';
  try {
    const kalender = await ambilRekap();
    const perlu = kalender.flatMap(k => k.perlu_perhatian.map(s => ({ ...s, k })));
    wadah.innerHTML = `<div class="kartu">
      <h3>Rekap Keterlambatan Rekaman · ${esc(lingkup)}</h3>
      <p class="meta">Jatuh tempo = sesi yang tenggatnya sudah lewat atau rekamannya sudah terbit.</p>
      ${kalender.length ? `<div class="gulir"><table>
        <thead><tr><th>Kalender</th><th class="num">Jatuh tempo</th><th class="num">Tepat</th><th class="num">Terlambat</th><th class="num">Belum ada</th><th class="num">Menunggu</th></tr></thead>
        ${kalender.map(k => `<tr><td>${esc(k.prodi_kode.toUpperCase())} ${esc(k.angkatan)} sem ${esc(k.semester)}</td>
          <td class="num">${esc(k.jatuh_tempo)}</td><td class="num">${esc(k.terbit_tepat)}</td><td class="num">${esc(k.terbit_terlambat)}</td>
          <td class="num">${esc(k.belum_ada)}</td><td class="num">${esc(k.menunggu)}</td></tr>`).join('')}
      </table></div>` : keadaanKosong({
        judul: `Belum ada kalender terbit untuk ${lingkup}`,
        keterangan: 'Rekap rekaman dihitung dari sesi daring sinkron di kalender semester yang sudah diterbitkan.',
        siapa: boleh ? `kaprodi ${lingkup} (menerbitkan kalender)` : 'kaprodi tiap prodi (menerbitkan kalender)',
        aksi: { href: 'kalender.html', label: 'Buka Kalender' },
      })}
      ${perlu.length ? `<h4>Perlu perhatian</h4><ul>${perlu.map(s => `<li>${esc(s.k.prodi_kode.toUpperCase())} ${esc(s.k.angkatan)} sem ${esc(s.k.semester)} · minggu ${esc(s.minggu)} (${esc(tanggalSesi(s.tanggal))}) — ${lencana(s.status)}</li>`).join('')}</ul>` : ''}
    </div>`;
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">Rekap: ${esc(err.message)}</div>`;
  }
}

function labelKalender(k) {
  return `${esc(k.prodi_kode.toUpperCase())} · angkatan ${esc(k.angkatan)} · semester ${esc(k.semester)}`;
}

async function muat() {
  const mahasiswa = saya.peran !== 'dosen';
  // Formulir terbit hanya untuk peran aktif dosen/kaprodi; admin membaca rekap.
  dosen = sedangMengajar(saya);
  // Rekap keterlambatan adalah laporan tingkat prodi: kaprodi (prodinya) dan admin.
  pimpinan = adalahPimpinan(saya);
  const prodiSaya = prodiBawaan(saya);
  let { kalender = [] } = await apiGet('/api/kalender');

  if (mahasiswa) {
    // Mahasiswa hanya melihat kalender prodinya, bukan kalender prodi lain.
    if (!saya.prodi_kode) {
      isi.innerHTML = keadaanKosong({
        judul: 'Nomor ini belum tercatat di roster mahasiswa',
        keterangan: 'Rekaman ditampilkan per kalender prodi Anda, jadi prodi Anda perlu tercatat di roster dulu.',
        siapa: 'dosen atau kaprodi prodi Anda (halaman Roster Mahasiswa)',
        aksi: { href: 'saya.html', label: 'Kembali ke Beranda Saya' },
      });
      return;
    }
    kalender = kalender.filter(k => k.prodi_kode === saya.prodi_kode);
    if (!kalender.length) {
      const P = saya.prodi_kode.toUpperCase();
      isi.innerHTML = keadaanKosong({
        judul: `Kalender semester ${P} belum diterbitkan`,
        keterangan: `Rekaman kelas daring muncul di sini per sesi setelah kaprodi ${P} menerbitkan kalender dan dosen mengunggah rekamannya.`,
        siapa: `kaprodi ${P}`,
        aksi: [{ href: 'materi.html', label: 'Buka Materi' }, { href: 'forum.html', label: 'Tanya di Forum' }],
      });
      return;
    }
  }

  if (!kalender.length) {
    isi.innerHTML = (pimpinan ? '<div id="rekap-rekaman"><p class="redup">Memuat rekap…</p></div>' : '') + keadaanKosong({
      judul: 'Belum ada kalender semester yang diterbitkan',
      keterangan: 'Rekaman diterbitkan per sesi daring sinkron di kalender semester.',
      siapa: 'kaprodi tiap prodi (menerbitkan kalender)',
      aksi: { href: 'kalender.html', label: 'Buka Kalender' },
    });
    if (pimpinan) muatRekap();
    return;
  }

  const milik = prodiSaya ? kalender.filter(k => k.prodi_kode === prodiSaya) : kalender;
  const lain = prodiSaya ? kalender.filter(k => k.prodi_kode !== prodiSaya) : [];
  const opsi = (daftar) => daftar.map(k => `<option value="${escAttr(k.id)}">${labelKalender(k)}</option>`).join('');
  const pilihan = mahasiswa || !prodiSaya
    ? opsi(kalender)
    : `${milik.length ? `<optgroup label="Prodi ${esc(prodiSaya.toUpperCase())}">${opsi(milik)}</optgroup>` : ''}${lain.length ? `<optgroup label="Prodi lain">${opsi(lain)}</optgroup>` : ''}`;
  const prodiTanpaKalender = !mahasiswa && prodiSaya && !milik.length;

  isi.innerHTML = `
    ${pimpinan ? '<div id="rekap-rekaman"><p class="redup">Memuat rekap…</p></div>' : ''}
    <div class="kartu">
      <h3>${mahasiswa ? `Rekaman Kelas ${esc(saya.prodi_kode.toUpperCase())}` : 'Pilih Kalender'}</h3>
      ${mahasiswa ? '<p class="meta">Hanya kalender prodi Anda yang ditampilkan.</p>' : ''}
      ${prodiTanpaKalender ? `<div class="pesan info">Kalender ${esc(prodiSaya.toUpperCase())} belum diterbitkan kaprodinya, jadi belum ada sesi untuk diberi rekaman. Kalender prodi lain di bawah hanya bisa dilihat; rekamannya diterbitkan dosen pengampu prodi itu.</div>` : ''}
      <form id="form-kalender">
        <label>Kalender terbit
          <select name="kalender">${pilihan}</select></label>
        <button>Tampilkan Sesi</button>
      </form>
    </div>
    <div id="daftar-rekaman"></div>`;

  const form = document.getElementById('form-kalender');
  const pilih = form.querySelector('select');
  const awal = new URLSearchParams(location.search).get('kalender');
  const dariTautan = Boolean(awal && [...pilih.options].some(o => o.value === awal));
  if (dariTautan) pilih.value = awal;
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

  if (pimpinan) muatRekap();
  // Kalender prodi lain tidak dibuka otomatis (dengan tombol Terbitkan-nya)
  // kecuali diminta lewat tautan.
  if (dariTautan || !prodiTanpaKalender) await muatKalender(pilih.value);
}

async function mulai() {
  const s = await sayaHalaman(isi);
  if (s === undefined) return;
  if (!s) {
    isi.innerHTML = keadaanKosong({ judul: 'Sesi login Anda sudah berakhir', keterangan: 'Tekan Masuk lagi di pojok kanan atas untuk membuka rekaman.' });
    return;
  }
  saya = s;
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
