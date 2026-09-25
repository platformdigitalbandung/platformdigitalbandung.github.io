import { apiGet, apiPutJson, apiDeleteJson, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong, labelTabel } from './ui.js';

// Satu tugas. Mahasiswa: petunjuk, tenggat, lampiran soal, status kirimannya
// (nilai dan komentar tampil setelah pengajar mengembalikannya), dan unggah
// jawaban — nama/NIM kiriman diambil backend dari roster lewat token.
// Pengajar kelas (atau kaprodinya): daftar kiriman tiap peserta, lihat
// jawaban, nilai + komentar, simpan draf atau kembalikan, ubah dan hapus tugas.

const id = new URLSearchParams(location.search).get('id');
const isi = document.getElementById('isi');
let tugas = null;

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function waktu(iso) {
  const d = new Date(iso);
  return isNaN(d) || d.getFullYear() < 2000 ? '' : d.toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}
// "2026-10-01T23:59" (WIB) untuk isian datetime-local.
function keIsianWIB(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
}
function angka(v) { return v === null || v === undefined ? '—' : (Math.round(v * 100) / 100).toLocaleString('id-ID'); }
const lewat = (t) => t.tenggat && new Date(t.tenggat) < new Date();

function unduhBase64(nama, b64) {
  const biner = atob(b64);
  const url = URL.createObjectURL(new Blob([Uint8Array.from(biner, c => c.charCodeAt(0))]));
  const a = document.createElement('a');
  a.href = url;
  a.download = nama || 'berkas';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function unduhLampiran(tombol) {
  tombol.disabled = true;
  try {
    const r = await apiGet(`/api/tugas/${encodeURIComponent(id)}/lampiran`);
    unduhBase64(r.nama, r.isi_base64);
  } catch (err) {
    window.alert(`Lampiran tidak bisa diunduh: ${err.message}`);
  } finally { tombol.disabled = false; }
}

function kartuInfo(t) {
  return `<div class="kartu">
    <h3>${esc(t.judul)}</h3>
    <p class="meta">${t.kelas_nama ? `Kelas <a href="kelas.html?id=${encodeURIComponent(t.kelas_id)}">${esc(t.kelas_nama)}</a>` : `Prodi ${esc(t.prodi_kode ? String(t.prodi_kode).toUpperCase() : '—')}`}${t.minggu ? ` · minggu ${esc(t.minggu)}` : ''} · nilai maksimal ${esc(angka(t.nilai_maks || 100))}</p>
    <p>${t.tenggat ? `Tenggat: <b>${esc(waktu(t.tenggat))}</b> ${lewat(t) ? '<span class="lencana tinggi">sudah lewat</span>' : ''}` : '<span class="redup">Tanpa tenggat.</span>'}</p>
    <p class="teks-panjang">${esc(t.deskripsi) || '<span class="redup">Tanpa petunjuk.</span>'}</p>
    ${t.lampiran_nama ? `<p class="cta-row"><button type="button" class="sekunder" data-aksi="unduh-lampiran">Unduh lampiran soal (${esc(t.lampiran_nama)})</button></p>` : ''}
  </div>`;
}

// ===================== Mahasiswa =====================

function statusSaya(t) {
  const s = t.kiriman_saya;
  if (!s) {
    return lewat(t)
      ? '<div class="pesan gagal">Anda belum menyerahkan jawaban dan tenggatnya sudah lewat. Kiriman tetap diterima, tetapi ditandai terlambat.</div>'
      : '<div class="pesan info">Anda belum menyerahkan jawaban.</div>';
  }
  const dasar = `Diserahkan ${esc(waktu(s.dikirim))}${s.terlambat ? ' <span class="lencana sedang">terlambat</span>' : ''} — ${esc(s.filename)}${s.jumlah_kirim > 1 ? ` (kiriman ke-${esc(s.jumlah_kirim)})` : ''}.`;
  if (s.dikembalikan) {
    return `<div class="pesan sukses">${dasar}<br>Nilai: <b>${esc(angka(s.nilai))}</b> dari ${esc(angka(t.nilai_maks || 100))}${s.komentar ? `<br>Komentar pengajar: ${esc(s.komentar)}` : ''}</div>`;
  }
  return `<div class="pesan sukses">${dasar} Menunggu dinilai. Mengunggah lagi menambah kiriman baru; yang dinilai kiriman terakhir.</div>`;
}

async function tampilMahasiswa() {
  isi.innerHTML = kartuInfo(tugas) + `
    <div class="kartu">
      <h3>Jawaban Anda</h3>
      <div id="status-kirim">${statusSaya(tugas)}</div>
      <form id="form">
        <label>Berkas jawaban (.txt, .docx, atau .pdf, maksimal 5 MB)
          <input type="file" id="berkas" name="berkas" required accept=".txt,.docx,.pdf"></label>
        <button id="kirim">${tugas.kiriman_saya ? 'Kirim Ulang Jawaban' : 'Unggah Jawaban'}</button>
      </form>
      <div id="hasil"></div>
    </div>
    <p class="cta-row">${tugas.kelas_id ? `<a class="aksi sekunder" href="kelas.html?id=${encodeURIComponent(tugas.kelas_id)}#tugas">Kembali ke kelas</a>` : ''}<a class="aksi sekunder" href="portal.html">Semua tugas</a></p>`;
  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('kirim');
    const hasil = document.getElementById('hasil');
    btn.disabled = true; hasil.innerHTML = '<p class="redup">Mengunggah…</p>';
    try {
      const r = await apiPostBerkasToken(`/api/tugas/${encodeURIComponent(id)}/kirim`, {}, 'berkas', 'berkas');
      hasil.innerHTML = `<div class="pesan sukses">Jawaban terkirim (${esc(r.n_kata)} kata terbaca)${r.terlambat ? ' — ditandai terlambat' : ''}.
        Nomor bukti kiriman: <code class="nomor-bukti">${esc(r.kiriman_id)}</code></div>`;
      e.target.reset();
      tugas = await apiGet(`/api/tugas/${encodeURIComponent(id)}`);
      document.getElementById('status-kirim').innerHTML = statusSaya(tugas);
    } catch (err) {
      hasil.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}

// ===================== Pengajar =====================

// Laporan kemiripan antar kiriman (dulu di halaman Tugas Prodi & Laporan
// Kemiripan; pindah ke halaman tugas sejak 2026-09-26).
async function tampilKemiripan() {
  const lap = document.getElementById('laporan-kemiripan');
  lap.innerHTML = '<p class="redup">Memuat laporan…</p>';
  try {
    const d = await apiGet(`/api/tugas/${encodeURIComponent(id)}/laporan`, { auth: true });
    const lencana = (band) => band === '-' ? '<span class="redup">–</span>' : `<span class="lencana ${esc(band)}">${esc(band)}</span>`;
    // Nomor urut kiriman menggantikan ObjectID mentah di tampilan.
    const perKiriman = d.per_kiriman || [];
    const pasangan = d.pasangan || [];
    const nomor = new Map(perKiriman.map((r, i) => [r.id, i + 1]));
    const noKiriman = kid => `#${nomor.get(kid) ?? '?'}`;
    const baris = perKiriman.map(r => `
      <tr class="band-${esc(r.band)}"><td class="num">${noKiriman(r.id)}</td>
        <td>${esc(r.nama)} <span class="redup">(${esc(r.nim)})</span></td>
        <td class="num">${r.max_score ?? '–'}</td>
        <td>${r.pasangan_id ? noKiriman(r.pasangan_id) + ' ' + esc(r.pasangan_nama || '') : '–'}</td>
        <td>${lencana(r.band)}</td></tr>`).join('');
    const pas = pasangan.slice(0, 20).map(p => `
      <tr class="band-${esc(p.band)}"><td class="num">${noKiriman(p.a_id)} <span class="redup">${esc(p.a_nama)}</span></td>
        <td class="num">${noKiriman(p.b_id)} <span class="redup">${esc(p.b_nama)}</span></td>
        <td class="num">${esc(p.score)}</td><td>${lencana(p.band)}</td></tr>`).join('');
    lap.innerHTML = `
      <h4>Per kiriman</h4>
      <div class="gulir"><table><thead><tr><th>Kiriman</th><th>Mahasiswa</th><th class="num">Skor maks</th>
        <th>Paling mirip dengan</th><th>Band</th></tr></thead><tbody>${baris || '<tr><td colspan="5">Belum ada kiriman</td></tr>'}</tbody></table></div>
      <h4>Pasangan paling mirip (top 20)</h4>
      <div class="gulir"><table><thead><tr><th>A</th><th>B</th><th class="num">Skor</th><th>Band</th></tr></thead><tbody>${pas || '<tr><td colspan="4">–</td></tr>'}</tbody></table></div>`;
  } catch (err) { lap.innerHTML = `<div class="pesan gagal">Gagal memuat laporan: ${esc(err.message)}</div>`; }
}

let kiriman = [];

function barisKiriman(b) {
  const maks = tugas.nilai_maks || 100;
  const status = !b.kiriman_id ? (lewat(tugas) ? '<span class="lencana tinggi">tidak menyerahkan</span>' : '<span class="lencana">belum menyerahkan</span>')
    : `${b.terlambat ? '<span class="lencana sedang">terlambat</span>' : '<span class="lencana rendah">diserahkan</span>'}<br><span class="redup">${esc(waktu(b.dikirim))}${b.jumlah_kirim > 1 ? ` · ${esc(b.jumlah_kirim)} kiriman` : ''}</span>`;
  return `<tr data-kid="${escAttr(b.kiriman_id || '')}" data-nim="${escAttr(b.nim)}">
    <td>${esc(b.nim)}<br>${esc(b.nama)}</td>
    <td>${status}</td>
    <td>${b.kiriman_id ? `<input type="number" name="nilai" min="0" max="${escAttr(maks)}" step="0.5" value="${b.nilai ?? ''}" aria-label="Nilai ${escAttr(b.nama)}">
      <span class="redup">/ ${esc(angka(maks))}</span>${b.dikembalikan ? '<br><span class="lencana rendah">dikembalikan</span>' : (b.nilai !== undefined && b.nilai !== null ? '<br><span class="lencana">draf</span>' : '')}` : '—'}</td>
    <td>${b.kiriman_id ? `<textarea name="komentar" rows="2" maxlength="3000" aria-label="Komentar untuk ${escAttr(b.nama)}">${esc(b.komentar || '')}</textarea>` : ''}</td>
    <td>${b.kiriman_id ? `<div class="aksi-sel">
      <button type="button" class="sekunder" data-aksi="lihat">Lihat jawaban</button>
      <button type="button" class="sekunder" data-aksi="draf">Simpan draf</button>
      <button type="button" data-aksi="kembalikan">Kembalikan</button></div>` : ''}</td>
  </tr>
  <tr class="baris-jawaban" data-untuk="${escAttr(b.kiriman_id || '')}" hidden><td colspan="5"></td></tr>`;
}

function renderKiriman() {
  const wadah = document.getElementById('daftar-kiriman');
  const diserahkan = kiriman.filter(b => b.kiriman_id).length;
  const dinilai = kiriman.filter(b => b.dikembalikan).length;
  wadah.innerHTML = kiriman.length ? `<p class="meta">${esc(kiriman.length)} peserta · ${esc(diserahkan)} menyerahkan · ${esc(dinilai)} sudah dikembalikan</p>
    <div class="gulir"><table class="tabel-kiriman"><thead><tr><th>Mahasiswa</th><th>Status</th><th>Nilai</th><th>Komentar</th><th></th></tr></thead>
    <tbody>${kiriman.map(barisKiriman).join('')}</tbody></table></div>`
    : '<p class="redup">Belum ada peserta maupun kiriman.</p>';
}

async function muatKiriman() {
  ({ kiriman = [] } = await apiGet(`/api/tugas/${encodeURIComponent(id)}/kiriman`));
  renderKiriman();
}

function formUbah(t) {
  return `<details class="kartu"><summary><b>Ubah tugas</b></summary>
    <form id="form-ubah">
      <label>Judul <input name="judul" required maxlength="200" value="${escAttr(t.judul)}"></label>
      <label>Petunjuk <textarea name="deskripsi" rows="4" maxlength="5000">${esc(t.deskripsi || '')}</textarea></label>
      <div class="saringan">
        <label>Minggu <input type="number" name="minggu" min="0" max="52" value="${escAttr(t.minggu || 0)}"></label>
        <label>Tenggat (WIB) <input type="datetime-local" name="tenggat" value="${escAttr(t.tenggat ? keIsianWIB(t.tenggat) : '')}"></label>
        <label>Nilai maksimal <input type="number" name="nilai_maks" min="1" max="1000" value="${escAttr(t.nilai_maks || 100)}"></label>
      </div>
      <div class="cta-row"><button>Simpan Perubahan</button></div>
    </form>
    <form id="form-lampiran">
      <label>${t.lampiran_nama ? `Ganti lampiran soal (sekarang: ${esc(t.lampiran_nama)})` : 'Lampiran soal'} <input type="file" id="lampiran" name="berkas" required></label>
      <button class="sekunder">Unggah Lampiran</button>
    </form>
    <p class="cta-row"><button type="button" class="bahaya" data-aksi="hapus-tugas">Hapus tugas</button></p>
    <div id="hasil-ubah"></div>
  </details>`;
}

async function tampilPengajar() {
  isi.innerHTML = kartuInfo(tugas) + formUbah(tugas) + `
    <div class="kartu"><h3>Kiriman Peserta</h3>
      <p class="meta"><b>Simpan draf</b> menyimpan nilai tanpa memperlihatkannya; <b>Kembalikan</b> memperlihatkan nilai dan komentar kepada mahasiswa dan memasukkannya ke buku nilai kelas.</p>
      <div id="hasil-nilai"></div>
      <div id="daftar-kiriman"><p class="redup">Memuat…</p></div>
      <p class="cta-row">${tugas.kelas_id ? `<a class="aksi sekunder" href="kelas.html?id=${encodeURIComponent(tugas.kelas_id)}#nilai">Buku nilai kelas</a>` : ''}</p>
    </div>
    <div class="kartu" id="kemiripan"><h3>Laporan Kemiripan</h3>
      <p class="meta">Skor kemiripan antar kiriman (tinggi ≥ 0,85 · sedang ≥ 0,60 · rendah &lt; 0,60) adalah alat bantu prioritas pemeriksaan, bukan vonis plagiat — periksa kirimannya sebelum memutuskan.</p>
      <p class="cta-row"><button type="button" class="sekunder" data-aksi="kemiripan">Tampilkan Laporan</button></p>
      <div id="laporan-kemiripan"></div>
    </div>`;
  await muatKiriman();
  // Tautan bot "laporan tugas <id>" dan tautan lama dosen.html?laporan= membuka #kemiripan.
  if (location.hash === '#kemiripan') {
    document.getElementById('kemiripan').scrollIntoView({ block: 'start' });
    tampilKemiripan();
  }

  isi.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-aksi]');
    if (!b) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'unduh-lampiran') return unduhLampiran(b);
    if (aksi === 'kemiripan') return tampilKemiripan();
    if (aksi === 'hapus-tugas') {
      if (!window.confirm(`Hapus tugas "${tugas.judul}"?`)) return;
      try {
        await apiDeleteJson(`/api/tugas/${encodeURIComponent(id)}`);
      } catch (err) {
        if (err.status !== 422 || !window.confirm(`${err.message}\n\nTetap hapus?`)) {
          if (err.status !== 422) document.getElementById('hasil-ubah').innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
          return;
        }
        await apiDeleteJson(`/api/tugas/${encodeURIComponent(id)}?konfirmasi=hapus`);
      }
      location.href = tugas.kelas_id ? `kelas.html?id=${encodeURIComponent(tugas.kelas_id)}#tugas` : 'portal.html';
      return;
    }
    const tr = b.closest('tr[data-kid]');
    if (!tr) return;
    const kid = tr.dataset.kid;
    if (aksi === 'lihat') {
      const baris = isi.querySelector(`tr.baris-jawaban[data-untuk="${CSS.escape(kid)}"]`);
      if (!baris.hidden) { baris.hidden = true; return; }
      baris.hidden = false;
      const sel = baris.firstElementChild;
      sel.innerHTML = '<p class="redup">Memuat jawaban…</p>';
      try {
        const r = await apiGet(`/api/tugas/kiriman/${encodeURIComponent(kid)}/berkas`);
        sel.innerHTML = `<p><b>${esc(r.nama)}</b> · ${esc(r.n_kata)} kata terbaca
          ${r.isi_base64 ? ' <button type="button" class="sekunder" data-aksi="unduh-jawaban">Unduh berkas</button>' : ''}
          ${r.galat_berkas ? `<br><span class="redup">${esc(r.galat_berkas)}</span>` : ''}</p>
          <div class="teks-jawaban">${esc(r.teks || '').split(/\n{2,}/).map(p => `<p>${p}</p>`).join('')}</div>`;
        sel.dataset.nama = r.nama || 'jawaban';
        sel.dataset.b64 = r.isi_base64 || '';
      } catch (err) { sel.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`; }
      return;
    }
    if (aksi === 'draf' || aksi === 'kembalikan') {
      const v = tr.querySelector('input[name=nilai]').value;
      const body = { nilai: v === '' ? null : Number(v), komentar: tr.querySelector('textarea[name=komentar]').value, kembalikan: aksi === 'kembalikan' };
      if (aksi === 'kembalikan' && body.nilai === null) {
        document.getElementById('hasil-nilai').innerHTML = '<div class="pesan gagal">Isi nilainya dulu sebelum mengembalikan.</div>';
        return;
      }
      b.disabled = true;
      try {
        await apiPutJson(`/api/tugas/${encodeURIComponent(id)}/kiriman/${encodeURIComponent(kid)}/nilai`, body);
        await muatKiriman();
        document.getElementById('hasil-nilai').innerHTML = `<div class="pesan sukses">Nilai ${esc(tr.dataset.nim)} ${aksi === 'kembalikan' ? 'dikembalikan ke mahasiswa' : 'disimpan sebagai draf'}.</div>`;
      } catch (err) {
        document.getElementById('hasil-nilai').innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
        b.disabled = false;
      }
    }
  });
  isi.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-aksi="unduh-jawaban"]');
    if (!b) return;
    const sel = b.closest('td');
    if (sel && sel.dataset.b64) unduhBase64(sel.dataset.nama, sel.dataset.b64);
  });
  isi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hasil = document.getElementById('hasil-ubah');
    if (e.target.id === 'form-ubah') {
      const fd = new FormData(e.target);
      try {
        tugas = { ...tugas, ...(await apiPutJson(`/api/tugas/${encodeURIComponent(id)}`, {
          judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '', minggu: Number(fd.get('minggu')) || 0,
          tenggat: fd.get('tenggat') || '', nilai_maks: Number(fd.get('nilai_maks')) || 100,
        })) };
        hasil.innerHTML = '<div class="pesan sukses">Tugas diperbarui. Muat ulang halaman untuk melihat ringkasannya.</div>';
      } catch (err) { hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`; }
    } else if (e.target.id === 'form-lampiran') {
      try {
        const r = await apiPostBerkasToken(`/api/tugas/${encodeURIComponent(id)}/lampiran`, {}, 'lampiran', 'berkas');
        hasil.innerHTML = `<div class="pesan sukses">Lampiran ${esc(r.lampiran_nama)} tersimpan.</div>`;
        e.target.reset();
      } catch (err) { hasil.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`; }
    }
  });
}

// ===================== Mulai =====================

if (!isLoggedIn()) {
  arahkanKeLogin();
} else if (!id) {
  isi.innerHTML = keadaanKosong({
    judul: 'Pilih tugas dulu',
    keterangan: 'Halaman ini untuk satu tugas. Buka daftar tugas atau halaman kelas, lalu pilih tugasnya.',
    aksi: [{ href: 'portal.html', label: 'Buka Daftar Tugas' }, { href: 'kelas.html', label: 'Kelas Saya' }],
  });
} else try {
  const [t, saya] = await Promise.all([apiGet(`/api/tugas/${encodeURIComponent(id)}`), sayaSekarang]);
  tugas = t;
  if (saya && saya.peran === 'dosen') {
    try {
      await tampilPengajar();
    } catch (err) {
      // Dosen yang bukan pengajar kelas ini: hanya ringkasan tugas.
      isi.innerHTML = kartuInfo(tugas) + `<div class="kosong">${esc(err.status === 403 ? err.message : `Kiriman tidak bisa dimuat: ${err.message}`)}</div>`;
    }
  } else {
    await tampilMahasiswa();
    isi.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-aksi="unduh-lampiran"]');
      if (b) unduhLampiran(b);
    });
  }
  isi.querySelectorAll('table').forEach(tb => { if (!tb.classList.contains('tabel-kiriman')) labelTabel(tb); });
} catch (err) {
  isi.innerHTML = err.status === 404
    ? keadaanKosong({
      judul: 'Tugas tidak ditemukan',
      keterangan: 'Tugas ini mungkin sudah dihapus, tautannya tidak lengkap, atau bukan untuk kelas/prodi Anda.',
      aksi: { href: 'portal.html', label: 'Buka Daftar Tugas' },
    })
    : `<div class="pesan gagal">${esc(err.message)}</div>`;
}
