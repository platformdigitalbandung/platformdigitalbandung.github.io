import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, apiPostBerkasToken } from './api.js';
import { hitungHalaman } from './pdfmateri.js';
import { esc } from './ui.js';

// Panel isi kelas: formulir materi dan penyusun kuis gerbang yang dibuka di
// DALAM halaman kelas (keputusan developer Arfan 2026-09-26: isi dibuat lewat
// panel di kelas, bukan pindah halaman). Prodi, rumpun, dan mata kuliah
// diambil dari kelasnya, jadi tidak dipilih ulang. Penyusun soal juga dipakai
// halaman kuis (kuis.js) supaya satu kode.
//
// Kewenangan tetap dicek backend (pengajar kelas rumpun/mata kuliah itu atau
// kaprodinya).

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

// ===== Penyusun soal (bersama kuis.js) =====

let nomorSoal = 0;

/** Satu pilihan jawaban; bulatan di depannya menandai jawaban benar. */
export function htmlPilihan(namaRadio, teks, benar) {
  return `<div class="pilihan-kuis">
    <label class="tanda-benar" title="Tandai sebagai jawaban benar"><input type="radio" name="${namaRadio}"${benar ? ' checked' : ''} aria-label="Tandai sebagai jawaban benar"></label>
    <input type="text" class="teks-pilihan" required maxlength="500" placeholder="Teks pilihan" value="${escAttr(teks)}">
    <button type="button" class="sekunder" data-aksi="hapus-pilihan" aria-label="Hapus pilihan">×</button>
  </div>`;
}

/** Satu soal pilihan ganda (2–6 pilihan). */
export function htmlSoal(soal = { pertanyaan: '', pilihan: ['', '', '', ''], indeks_benar: -1 }) {
  nomorSoal += 1;
  const nama = `benar-${nomorSoal}`;
  return `<fieldset class="soal-kuis">
    <legend>Soal</legend>
    <label>Pertanyaan <textarea class="teks-pertanyaan" rows="2" required maxlength="2000">${esc(soal.pertanyaan)}</textarea></label>
    <p class="redup">Tulis pilihan jawaban, lalu tandai bulatan di depan jawaban yang benar.</p>
    <div class="daftar-pilihan">${soal.pilihan.map((p, j) => htmlPilihan(nama, p, j === soal.indeks_benar)).join('')}</div>
    <p><button type="button" class="sekunder" data-aksi="tambah-pilihan" data-radio="${nama}">+ Pilihan</button>
      <button type="button" class="sekunder" data-aksi="hapus-soal">Hapus Soal</button></p>
  </fieldset>`;
}

/** Nomori ulang legenda soal di dalam wadah. */
export function nomoriSoal(wadah) {
  wadah.querySelectorAll('.soal-kuis legend').forEach((l, i) => { l.textContent = `Soal ${i + 1}`; });
}

/** Tambah satu soal ke wadah soal. */
export function tambahSoal(wadah, soal) {
  wadah.insertAdjacentHTML('beforeend', htmlSoal(soal));
  nomoriSoal(wadah);
}

/** Baca soal apa adanya; kelengkapannya diperiksa backend (kuisgerbang.NormalkanKuis). */
export function bacaSoal(wadah) {
  return [...wadah.querySelectorAll('.soal-kuis')].map(f => {
    const baris = [...f.querySelectorAll('.pilihan-kuis')];
    return {
      pertanyaan: f.querySelector('.teks-pertanyaan').value,
      pilihan: baris.map(b => b.querySelector('.teks-pilihan').value),
      indeks_benar: baris.findIndex(b => b.querySelector('input[type=radio]').checked),
    };
  });
}

/** Tangani tombol penyusun soal; true bila tombolnya milik penyusun. */
export function aksiSoal(b, wadah) {
  switch (b.dataset.aksi) {
    case 'tambah-soal': tambahSoal(wadah); return true;
    case 'hapus-soal': b.closest('.soal-kuis').remove(); nomoriSoal(wadah); return true;
    case 'tambah-pilihan': {
      const daftar = b.closest('.soal-kuis').querySelector('.daftar-pilihan');
      if (daftar.children.length < 6) daftar.insertAdjacentHTML('beforeend', htmlPilihan(b.dataset.radio, '', false));
      return true;
    }
    case 'hapus-pilihan': {
      const daftar = b.closest('.daftar-pilihan');
      if (daftar.children.length > 2) b.closest('.pilihan-kuis').remove();
      return true;
    }
    default: return false;
  }
}

// ===== Berkas materi (bersama kelola-materi.js) =====

// Batas yang sama dengan yang dijaga backend; diperiksa di sini juga supaya
// dosen tidak menunggu unggahan besar cuma untuk ditolak di ujung.
export const UKURAN_MAKS = 20 * 1024 * 1024;
export const UKURAN_MAKS_LABEL = '20 MiB';

/** Pesan galat berkas PDF materi, atau "" bila layak diunggah. */
export function periksaBerkas(berkas) {
  if (berkas.size > UKURAN_MAKS) {
    return `Berkas ${Math.round(berkas.size / (1024 * 1024))} MiB melebihi batas ${UKURAN_MAKS_LABEL}.`;
  }
  const namaPDF = /\.pdf$/i.test(berkas.name);
  if (berkas.type !== 'application/pdf' && !namaPDF) return 'Hanya berkas PDF yang bisa diunggah.';
  return '';
}

/**
 * Unggah PDF materi yang sudah tersimpan ke /api/materi/<id>/berkas. Jumlah
 * halaman dihitung pdf.js di peramban sebagai cadangan (server menghitung
 * sendiri). Melempar Error bila berkas tidak terbaca atau unggahan gagal.
 */
export async function unggahBerkasMateri(id, idInput, berkas) {
  const halaman = await hitungHalaman(await berkas.arrayBuffer());
  if (!halaman) throw new Error('jumlah halamannya tidak terbaca');
  return apiPostBerkasToken(`/api/materi/${encodeURIComponent(id)}/berkas`, { halaman: String(halaman) }, idInput, 'berkas');
}

// ===== Panel materi =====

function keteranganKonteks(k) {
  return `Kelas ${esc(k.namaKelas)} · rumpun ${esc(k.rumpun_kode)}${k.mk_kode ? ` · mata kuliah ${esc(k.mk_kode)}` : ''}`;
}

/**
 * Panel tambah/ubah materi untuk satu kelas. `konteks`: { namaKelas,
 * prodi_kode, rumpun_kode, mk_kode, minggu }. `materi` null = materi baru.
 * `selesai(pesanHTML, { gagal, minggu })` dipanggil sesudah tersimpan atau
 * terhapus (minggu = minggu materinya, supaya halaman membuka minggu itu);
 * `batal()` saat panel ditutup tanpa perubahan.
 */
export function pasangPanelMateri(wadah, konteks, materi, { selesai, batal }) {
  const m = materi || {};
  const jenis = m.jenis || 'video';
  const sembunyi = (j) => (jenis === j ? '' : ' hidden');
  wadah.innerHTML = `<div class="kartu panel-isi">
    <h3>${m.id ? 'Ubah Materi' : 'Materi Baru'}</h3>
    <p class="meta">${keteranganKonteks(konteks)}</p>
    <form class="form-panel-materi">
      <div class="saringan">
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${escAttr(m.minggu ?? konteks.minggu ?? 1)}"></label>
        <label>Urutan dalam minggu <input type="number" name="urutan" min="0" value="${escAttr(m.urutan ?? 0)}"></label>
      </div>
      <label>Judul <input name="judul" required maxlength="200" value="${escAttr(m.judul || '')}"></label>
      <label>Jenis <select name="jenis">
        <option value="video"${jenis === 'video' ? ' selected' : ''}>video</option>
        <option value="bacaan"${jenis === 'bacaan' ? ' selected' : ''}>bacaan</option>
        <option value="berkas"${jenis === 'berkas' ? ' selected' : ''}>berkas (PDF)</option>
      </select></label>
      <label data-bidang="video"${sembunyi('video')}>Tautan atau ID YouTube
        <input name="youtube_id" maxlength="300" value="${escAttr(m.youtube_id || '')}" placeholder="https://youtu.be/…"></label>
      <label data-bidang="bacaan"${sembunyi('bacaan')}>Isi bacaan (teks lengkap; pisahkan paragraf dengan baris kosong)
        <textarea name="isi" rows="10" maxlength="100000">${esc(m.isi || '')}</textarea></label>
      <div data-bidang="berkas"${sembunyi('berkas')}>
        <label>Berkas materi — PDF saja, maksimal ${UKURAN_MAKS_LABEL}
          <input type="file" id="berkas-panel-materi" name="berkas" accept="application/pdf"></label>
        <p class="redup">Slide atau dokumen Word ekspor dulu ke PDF. Jumlah halamannya dihitung otomatis.</p>
        ${m.nama_berkas ? `<p class="meta">Berkas sekarang: <b>${esc(m.nama_berkas)}</b>${m.halaman ? ` · ${esc(m.halaman)} halaman` : ''}. Pilih berkas baru hanya kalau ingin menggantinya.</p>` : ''}
      </div>
      <label>Deskripsi singkat <input name="deskripsi" maxlength="1000" value="${escAttr(m.deskripsi || '')}"></label>
      <div class="cta-row"><button>${m.id ? 'Simpan Perubahan' : 'Tambah Materi'}</button>
        <button type="button" class="sekunder" data-panel="batal">Batal</button>
        ${m.id ? '<button type="button" class="bahaya" data-panel="hapus">Hapus Materi</button>' : ''}</div>
    </form>
    <div class="hasil-panel"></div>
  </div>`;
  const form = wadah.querySelector('form');
  const hasil = wadah.querySelector('.hasil-panel');
  const tulis = (jenisPesan, teks) => { hasil.innerHTML = `<div class="pesan ${jenisPesan}">${teks}</div>`; };
  form.elements.jenis.addEventListener('change', () => {
    wadah.querySelectorAll('[data-bidang]').forEach(el => { el.hidden = el.dataset.bidang !== form.elements.jenis.value; });
  });
  wadah.querySelector('[data-panel="batal"]').addEventListener('click', () => { wadah.innerHTML = ''; if (batal) batal(); });
  const tombolHapus = wadah.querySelector('[data-panel="hapus"]');
  if (tombolHapus) {
    tombolHapus.addEventListener('click', async () => {
      if (!window.confirm(`Hapus materi "${m.judul}"?`)) return;
      try {
        await apiDeleteJson(`/api/materi/${encodeURIComponent(m.id)}`);
      } catch (err) {
        if (err.status !== 422 || !window.confirm(`${err.message}\n\nTetap hapus?`)) { tulis('gagal', esc(err.message)); return; }
        try { await apiDeleteJson(`/api/materi/${encodeURIComponent(m.id)}?konfirmasi=hapus`); } catch (e2) { tulis('gagal', esc(e2.message)); return; }
      }
      selesai(`Materi <b>${esc(m.judul)}</b> dihapus.`, { minggu: m.minggu });
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const jenisIsi = fd.get('jenis');
    const masukan = document.getElementById('berkas-panel-materi');
    const berkas = jenisIsi === 'berkas' && masukan.files.length ? masukan.files[0] : null;
    if (jenisIsi === 'berkas' && !berkas && !m.nama_berkas) {
      tulis('gagal', 'Pilih berkas PDF-nya dulu — materi jenis berkas tidak bisa dibaca mahasiswa tanpa berkas.');
      return;
    }
    if (berkas) {
      const galat = periksaBerkas(berkas);
      if (galat) { tulis('gagal', esc(galat)); return; }
    }
    const body = {
      prodi_kode: konteks.prodi_kode, rumpun_kode: konteks.rumpun_kode, mk_kode: konteks.mk_kode || '',
      minggu: Number(fd.get('minggu')), urutan: Number(fd.get('urutan')) || 0,
      judul: fd.get('judul'), jenis: jenisIsi,
      youtube_id: fd.get('youtube_id') || '', isi: fd.get('isi') || '', deskripsi: fd.get('deskripsi') || '',
    };
    const tombol = form.querySelector('button:not([type])');
    tombol.disabled = true;
    hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
    let simpan;
    try {
      simpan = m.id ? await apiPutJson(`/api/materi/${encodeURIComponent(m.id)}`, body) : await apiPostJson('/api/materi', body);
    } catch (err) {
      tulis('gagal', `Gagal menyimpan: ${esc(err.message)}`);
      tombol.disabled = false;
      return;
    }
    if (berkas) {
      hasil.innerHTML = '<p class="redup">Mengunggah berkas…</p>';
      try {
        await unggahBerkasMateri(simpan.id, 'berkas-panel-materi', berkas);
      } catch (err) {
        // Materinya sudah tercatat: kegagalan unggah harus terlihat, bukan disembunyikan.
        selesai(`Materi <b>${esc(simpan.judul)}</b> tersimpan, tetapi berkasnya belum terunggah (${esc(err.message)}). Tekan <b>Kelola</b> pada materi itu dan pilih berkasnya lagi.`, { gagal: true, minggu: simpan.minggu });
        return;
      }
    }
    selesai(`Materi <b>${esc(simpan.judul)}</b> tersimpan di minggu ${esc(simpan.minggu)}.`, { minggu: simpan.minggu });
  });
  form.elements.judul.focus();
}

// ===== Panel kuis =====

/**
 * Panel susun/sunting kuis gerbang untuk satu kelas dan minggu. `kuis`
 * (bentuk KuisGerbangSunting dari GET /api/kuisgerbang) null = kuis baru.
 * Kuis yang sudah dikerjakan mahasiswa tidak bisa disunting (skornya dihitung
 * dari soal itu); hanya bisa dihapus dengan konfirmasi.
 */
export function pasangPanelKuis(wadah, konteks, kuis, { selesai, batal }) {
  const k = kuis || {};
  const terkunci = (k.dikerjakan || 0) > 0;
  wadah.innerHTML = `<div class="kartu panel-isi">
    <h3>${k.id ? `Kuis Minggu ${esc(k.minggu)}` : 'Kuis Baru'}</h3>
    <p class="meta">${keteranganKonteks(konteks)}</p>
    ${terkunci ? `<div class="pesan info">Kuis ini sudah dikerjakan ${esc(k.dikerjakan)} mahasiswa, jadi soalnya tidak bisa disunting — skor mereka dihitung dari soal itu. Hapus kuisnya (dengan konfirmasi) bila memang perlu diganti.</div>` : ''}
    <form class="form-panel-kuis">
      <div class="saringan">
        <label>Minggu <input type="number" name="minggu" min="1" max="52" required value="${escAttr(k.minggu ?? konteks.minggu ?? 1)}"${k.id ? ' readonly' : ''}></label>
        <label>Ambang lulus (%) <input type="number" name="ambang_lulus" min="0" max="100" step="1" value="${escAttr(k.ambang_lulus || 60)}"></label>
      </div>
      <p class="redup">Satu kuis untuk satu minggu kelas ini. Isi ambang 0 untuk bawaan 60%.</p>
      <div class="daftar-soal-panel"></div>
      ${terkunci ? '' : '<p><button type="button" class="sekunder" data-aksi="tambah-soal">+ Tambah Soal</button></p>'}
      <div class="cta-row">${terkunci ? '' : '<button>Simpan Kuis</button>'}
        <button type="button" class="sekunder" data-panel="batal">${terkunci ? 'Tutup' : 'Batal'}</button>
        ${k.id ? '<button type="button" class="bahaya" data-panel="hapus">Hapus Kuis</button>' : ''}</div>
    </form>
    <div class="hasil-panel"></div>
  </div>`;
  const form = wadah.querySelector('form');
  const daftarSoal = wadah.querySelector('.daftar-soal-panel');
  const hasil = wadah.querySelector('.hasil-panel');
  const tulis = (jenisPesan, teks) => { hasil.innerHTML = `<div class="pesan ${jenisPesan}">${teks}</div>`; };
  if (k.soal && k.soal.length) k.soal.forEach(s => tambahSoal(daftarSoal, s)); else tambahSoal(daftarSoal);
  if (terkunci) form.querySelectorAll('input, textarea, button[data-aksi]').forEach(el => { el.disabled = true; });
  // Pendengar dipasang di kartu yang baru dibuat, bukan di wadah: wadah yang
  // sama dipakai ulang tiap panel dibuka, jadi pendengarnya akan menumpuk.
  const kartu = wadah.querySelector('.panel-isi');
  kartu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-aksi]');
    if (b) aksiSoal(b, daftarSoal);
  });
  wadah.querySelector('[data-panel="batal"]').addEventListener('click', () => { wadah.innerHTML = ''; if (batal) batal(); });
  const tombolHapus = wadah.querySelector('[data-panel="hapus"]');
  if (tombolHapus) {
    tombolHapus.addEventListener('click', async () => {
      if (!window.confirm(`Hapus kuis minggu ${k.minggu}?`)) return;
      try {
        await apiDeleteJson(`/api/kuisgerbang/${encodeURIComponent(k.id)}`);
      } catch (err) {
        if (err.status !== 422 || !window.confirm(`${err.message}\n\nTetap hapus? Jawaban mahasiswa tetap tersimpan.`)) { tulis('gagal', esc(err.message)); return; }
        try { await apiDeleteJson(`/api/kuisgerbang/${encodeURIComponent(k.id)}?konfirmasi=hapus`); } catch (e2) { tulis('gagal', esc(e2.message)); return; }
      }
      selesai(`Kuis minggu ${esc(k.minggu)} dihapus.`, { minggu: k.minggu });
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const soal = bacaSoal(daftarSoal);
    const tanpaKunci = soal.findIndex(s => s.indeks_benar < 0);
    if (tanpaKunci >= 0) { tulis('gagal', `Tandai jawaban benar untuk soal ke-${tanpaKunci + 1}.`); return; }
    const fd = new FormData(form);
    const tombol = form.querySelector('button:not([type])');
    tombol.disabled = true;
    hasil.innerHTML = '<p class="redup">Menyimpan…</p>';
    try {
      const simpan = await apiPostJson('/api/kuisgerbang', {
        prodi_kode: konteks.prodi_kode, rumpun_kode: konteks.rumpun_kode, mk_kode: konteks.mk_kode || '',
        minggu: Number(fd.get('minggu')), ambang_lulus: Number(fd.get('ambang_lulus')) || 0, soal,
      });
      selesai(`Kuis minggu ${esc(simpan.minggu)} tersimpan (${esc(simpan.soal.length)} soal).`, { minggu: simpan.minggu });
    } catch (err) {
      tulis('gagal', esc(err.message));
      tombol.disabled = false;
    }
  });
}

/** Materi lengkap (termasuk isi bacaan) satu id dari katalog kelas itu. */
export async function ambilMateri(konteks, id, minggu) {
  const q = new URLSearchParams({ prodi: konteks.prodi_kode, rumpun: konteks.rumpun_kode, minggu: String(minggu || 0) });
  const { materi = [] } = await apiGet(`/api/materi?${q}`);
  return (materi || []).find(x => x.id === id) || null;
}

/** Kuis (bentuk sunting, dengan kunci) kelas itu pada satu minggu, atau null. */
export async function ambilKuis(konteks, minggu) {
  const q = new URLSearchParams({ prodi: konteks.prodi_kode, rumpun: konteks.rumpun_kode });
  const { kuis = [] } = await apiGet(`/api/kuisgerbang?${q}`);
  const mk = String(konteks.mk_kode || '').toUpperCase();
  return (kuis || []).find(k => Number(k.minggu) === Number(minggu) && String(k.mk_kode || '').toUpperCase() === mk) || null;
}
