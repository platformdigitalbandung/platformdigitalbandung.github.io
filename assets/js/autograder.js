import { apiGet, apiPutJson } from './api.js';
import { esc, istilah, keadaanKosong } from './ui.js';
import { sayaHalaman, sedangMengajar } from './hal-dosen.js';

// Hasil Autograder. Mahasiswa melihat kirimannya sendiri (NIM dari roster lewat
// nomor pada token, query nim diabaikan backend); dosen/admin melihat siapa pun
// dan mengatur pembagian bobot di dalam komponen autograder. Kewenangannya
// dicek backend (403).
//
// Yang disimpan backend hanya angka mentah — skor dihitung saat dibaca dari
// bobot yang sedang berlaku, jadi halaman ini tidak pernah menyimpan skor.

const isi = document.getElementById('isi');
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function angka(n, desimal = 1) {
  return typeof n === 'number' ? n.toLocaleString('id-ID', { maximumFractionDigits: desimal }) : '–';
}
function waktuWIB(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '–' : `${d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB`;
}
function persen(n) { return typeof n === 'number' ? `${angka(n * 100, 0)}%` : '–'; }

let dosen = false; // staf: dosen, termasuk pemegang jabatan (melihat semua kiriman)
let aturBobot = false; // peran aktif dosen/kaprodi; admin hanya membaca
let bobot = { tes_dosen: 0.7, coverage: 0.3 };

function lencanaHasil(h) {
  if (h.build_gagal) return '<span class="lencana tinggi">build gagal</span>';
  if (h.kesimpulan && h.kesimpulan !== 'success') return `<span class="lencana sedang">${esc(h.kesimpulan)}</span>`;
  if (h.tes_dosen_total > 0 && h.tes_dosen_lulus < h.tes_dosen_total) return '<span class="lencana sedang">ada tes gagal</span>';
  return '<span class="lencana rendah">lulus</span>';
}

function selTesDosen(h) {
  if (!h.tes_dosen_total) return '<span class="redup">tidak ada tes dosen</span>';
  const gagal = (h.tes_dosen_gagal || []).filter(Boolean);
  return `${esc(h.tes_dosen_lulus)}/${esc(h.tes_dosen_total)}` +
    (gagal.length ? `<br><span class="redup">gagal: ${esc(gagal.join(', '))}</span>` : '');
}

function selAsal(h) {
  const repo = esc(h.repo || '–');
  const commit = h.commit_sha ? `<code>${esc(h.commit_sha.slice(0, 7))}</code>` : '';
  return `${repo}${h.pr_nomor ? ` PR #${esc(h.pr_nomor)}` : ''}${commit ? `<br><span class="redup">${commit}</span>` : ''}`;
}

function tabelHasil(daftar) {
  if (!daftar.length) {
    return dosen
      ? keadaanKosong({
        judul: 'Belum ada hasil autograder',
        keterangan: 'Hasil muncul otomatis begitu mahasiswa membuka Pull Request di repo tugas yang memakai workflow autograder. Hasil yang username GitHub-nya belum ada di roster tetap tersimpan dan muncul di sini dengan NIM kosong.',
        siapa: 'mahasiswa (membuka Pull Request) dan dosen (mengisi username GitHub di roster)',
        aksi: { href: 'akademik.html', label: 'Buka Roster Mahasiswa' },
      })
      : keadaanKosong({
        judul: 'Belum ada hasil autograder untuk Anda',
        keterangan: 'Hasil muncul otomatis beberapa saat setelah Anda membuka Pull Request di repo tugas. Kalau tidak juga muncul, username GitHub Anda mungkin belum tercatat di roster — itu yang menghubungkan kiriman ke NIM Anda.',
        siapa: 'dosen Anda (mengisi username GitHub di roster)',
        aksi: { href: 'forum.html', label: 'Tanya di Forum' },
      });
  }
  return `<div class="gulir"><table>
    <thead><tr>
      <th>Waktu</th>${dosen ? '<th>Mahasiswa</th>' : ''}<th>Asal kiriman</th>
      <th class="num">Tes dosen</th><th class="num">Tes semua</th><th class="num">Coverage</th>
      <th class="num">Skor</th><th>Status</th>
    </tr></thead>
    ${daftar.map(h => `<tr>
      <td>${waktuWIB(h.diterima)}</td>
      ${dosen ? `<td>${h.nim ? esc(h.nim) : '<span class="redup">belum terpetakan</span>'}<br><span class="redup">${esc(h.github_username)}</span></td>` : ''}
      <td>${selAsal(h)}</td>
      <td class="num">${selTesDosen(h)}</td>
      <td class="num">${h.tes_semua_total ? `${esc(h.tes_semua_lulus)}/${esc(h.tes_semua_total)}` : '–'}</td>
      <td class="num">${angka(h.persen_baris)}%</td>
      <td class="num"><b>${angka(h.skor, 2)}</b></td>
      <td>${lencanaHasil(h)}</td>
    </tr>`).join('')}
  </table></div>`;
}

function isiBobot() {
  const rumus = `Skor = ${persen(bobot.tes_dosen)} × (tes dosen lulus ÷ total) + ${persen(bobot.coverage)} × coverage`;
  return `
      <p class="meta">${esc(rumus)}. Build gagal selalu 0. Kalau soal tidak punya tes dosen sama sekali, porsi tes dialihkan ke coverage — itu kelalaian penyusun soal, bukan kesalahan mahasiswa.</p>
      <p class="catatan-istilah">${istilah('coverage')} = persentase baris kode yang dijalankan oleh tes.</p>
      <p class="redup">Yang diatur di sini pembagian <b>di dalam</b> komponen autograder. Besar komponennya terhadap nilai rumpun sudah 15% menurut kurikulum dan tidak diatur dari sini.</p>
      ${aturBobot ? `<form id="form-bobot">
        <label>Porsi tes dosen <input name="tes_dosen" type="number" min="0" max="1" step="0.05" value="${escAttr(bobot.tes_dosen)}" required></label>
        <label>Porsi coverage <input name="coverage" type="number" min="0" max="1" step="0.05" value="${escAttr(bobot.coverage)}" required></label>
        <button>Simpan Bobot</button>
      </form>
      <div id="pesan-bobot"></div>` : ''}
      ${dosen && !aturBobot ? '<p class="meta">Anda sedang memakai peran admin: pembagian bobot diatur di peran dosen.</p>' : ''}
      ${bobot.diubah_oleh ? `<p class="redup">Terakhir diubah ${waktuWIB(bobot.diperbarui)} oleh ${esc(bobot.diubah_oleh)}.</p>` : '<p class="redup">Belum pernah diatur — memakai nilai bawaan.</p>'}`;
}

// Dosen melihat pembagian bobot sebagai kartu di atas (bisa diatur); mahasiswa
// melihat hasilnya dulu, penjelasan skor dilipat di bawah (audit UX U18).
function kartuBobot() {
  if (!dosen) {
    return `<details class="kartu cara-skor"><summary>Bagaimana skor dihitung?</summary>
      <p>Skor terutama ditentukan oleh <b>tes dosen</b> yang lulus; sisanya dari seberapa banyak kode Anda yang dijalankan oleh tes.</p>
      ${isiBobot()}</details>`;
  }
  return `<div class="kartu"><h3>Pembagian Bobot</h3>${isiBobot()}</div>`;
}

function formSaring() {
  return `
    <div class="kartu">
      <h3>Saring</h3>
      <form id="form-saring">
        <label>NIM <input name="nim" placeholder="mis. 2026TRPL006" aria-label="NIM"></label>
        <label>Repo <input name="repo" placeholder="platformdigitalbandung/nama-repo" aria-label="Repo"></label>
        <button>Tampilkan</button>
      </form>
    </div>`;
}

async function muatHasil(nim = '', repo = '') {
  const wadah = document.getElementById('daftar-hasil');
  wadah.innerHTML = '<p class="redup">Memuat hasil…</p>';
  const q = new URLSearchParams();
  if (nim) q.set('nim', nim);
  if (repo) q.set('repo', repo);
  try {
    const d = await apiGet('/api/autograder' + (q.toString() ? `?${q}` : ''), { auth: true });
    if (d.bobot) bobot = d.bobot;
    wadah.innerHTML = tabelHasil(d.hasil || []);
  } catch (err) {
    wadah.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

async function simpanBobot(form) {
  const pesan = document.getElementById('pesan-bobot');
  const data = new FormData(form);
  const baru = { tes_dosen: Number(data.get('tes_dosen')), coverage: Number(data.get('coverage')) };
  pesan.innerHTML = '<p class="redup">Menyimpan…</p>';
  try {
    bobot = await apiPutJson('/api/autograder/bobot', baru);
    await muatHasil();
    document.getElementById('kartu-bobot').innerHTML = kartuBobot();
    pasangFormBobot();
    document.getElementById('pesan-bobot').innerHTML = '<div class="pesan sukses">Bobot tersimpan. Skor seluruh hasil ikut dihitung ulang.</div>';
  } catch (err) {
    pesan.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

function pasangFormBobot() {
  const form = document.getElementById('form-bobot');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); simpanBobot(form); });
}

async function muat(saya) {
  dosen = saya.peran === 'dosen';
  aturBobot = dosen && sedangMengajar(saya);
  try {
    bobot = await apiGet('/api/autograder/bobot', { auth: true });
  } catch {
    // Bobot bawaan sudah dipegang di atas; halaman tetap berguna tanpanya.
  }
  isi.innerHTML = dosen
    ? `<p class="catatan-istilah">${istilah('autograder', 'Autograder')} menguji kode kiriman mahasiswa secara otomatis.</p>
      <div id="kartu-bobot">${kartuBobot()}</div>${formSaring()}<div id="daftar-hasil"></div>`
    : `<div id="daftar-hasil"></div><div id="kartu-bobot">${kartuBobot()}</div>`;
  pasangFormBobot();
  const saring = document.getElementById('form-saring');
  if (saring) {
    saring.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(saring);
      muatHasil(String(d.get('nim') || '').trim(), String(d.get('repo') || '').trim());
    });
  }
  await muatHasil();
}

async function mulai() {
  const saya = await sayaHalaman(isi);
  if (saya === undefined) return;
  if (!saya) {
    isi.innerHTML = keadaanKosong({ judul: 'Sesi login Anda sudah berakhir', keterangan: 'Tekan Masuk lagi di pojok kanan atas untuk membuka hasil autograder.' });
    return;
  }
  try {
    await muat(saya);
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}

mulai();
