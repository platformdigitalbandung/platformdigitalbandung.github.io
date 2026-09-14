import { apiGet, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang } from './akun.js';
import { esc, keadaanKosong } from './ui.js';

const id = new URLSearchParams(location.search).get('id');
const isi = document.getElementById('isi');

function waktuKirim(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

// Status pengumpulan mahasiswa ini, dari daftar tugas (backend mengisi
// sudah_kirim per NIM pada token). Gagal dibaca: status tidak ditampilkan.
async function statusSaya() {
  try {
    const { tugas = [] } = await apiGet('/api/tugas');
    return tugas.find(t => t.id === id) || null;
  } catch (_) {
    return null;
  }
}

function pesanStatus(t) {
  if (!t || t.sudah_kirim === undefined) return '';
  return t.sudah_kirim
    ? `<div class="pesan sukses">Anda sudah mengumpulkan jawaban untuk tugas ini${t.kirim_terakhir ? ` pada ${esc(waktuKirim(t.kirim_terakhir))}` : ''}. Mengunggah lagi menambah kiriman baru; kiriman lama tetap tersimpan.</div>`
    : '<div class="pesan info">Anda belum mengumpulkan jawaban untuk tugas ini.</div>';
}

// Hanya mahasiswa di roster yang bisa mengumpulkan; nama dan NIM kiriman
// diambil backend dari roster lewat token, bukan dari isian form.
if (!isLoggedIn()) {
  arahkanKeLogin();
} else if (!id) {
  isi.innerHTML = keadaanKosong({
    judul: 'Pilih tugas dulu',
    keterangan: 'Halaman ini untuk mengumpulkan jawaban satu tugas. Buka daftar tugas, lalu tekan Kumpulkan Jawaban pada tugas yang dimaksud.',
    aksi: { href: 'portal.html', label: 'Buka Daftar Tugas' },
  });
} else try {
  const [t, saya] = await Promise.all([apiGet(`/api/tugas/${encodeURIComponent(id)}`), sayaSekarang]);
  if (saya && saya.peran === 'dosen') {
    isi.innerHTML = `
    <div class="kartu">
      <h3>${esc(t.judul)}</h3>
      <p>${esc(t.deskripsi) || '<span class="redup">Tanpa deskripsi.</span>'}</p>
    </div>
    <div class="kosong">Pengumpulan jawaban hanya untuk mahasiswa di roster. Kiriman dan laporan kemiripannya ada di <a href="dosen.html">Buat Tugas &amp; Laporan Kemiripan</a>.</div>`;
  } else {
    const status = await statusSaya();
    isi.innerHTML = `
      <div class="kartu">
        <h3>${esc(t.judul)}</h3>
        <p>${esc(t.deskripsi) || '<span class="redup">Tanpa deskripsi.</span>'}</p>
        <div id="status-kirim">${pesanStatus(status)}</div>
      </div>
      <div class="kartu">
        <h3>Kirim Jawaban</h3>
        <form id="form">
          <label>Berkas jawaban (.txt, .docx, atau .pdf, maksimal 5 MB)
            <input type="file" id="berkas" name="berkas" required accept=".txt,.docx,.pdf"></label>
          <button id="kirim">Unggah Jawaban</button>
        </form>
        <div id="hasil"></div>
      </div>
      <p><a class="aksi sekunder" href="portal.html">Kembali ke Daftar Tugas</a></p>`;

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('kirim');
      const hasil = document.getElementById('hasil');
      btn.disabled = true; hasil.innerHTML = '<p class="redup">Mengunggah…</p>';
      try {
        const r = await apiPostBerkasToken(`/api/tugas/${encodeURIComponent(id)}/kirim`, {}, 'berkas', 'berkas');
        hasil.innerHTML = `<div class="pesan sukses">Jawaban terkirim (${esc(r.n_kata)} kata terbaca).
          Nomor bukti kiriman: <code class="nomor-bukti">${esc(r.kiriman_id)}</code></div>`;
        e.target.reset();
        document.getElementById('status-kirim').innerHTML = pesanStatus(await statusSaya());
      } catch (err) {
        hasil.innerHTML = `<div class="pesan gagal">Gagal: ${esc(err.message)}</div>`;
      } finally { btn.disabled = false; }
    });
  }
} catch (err) {
  isi.innerHTML = err.status === 404
    ? keadaanKosong({
      judul: 'Tugas tidak ditemukan',
      keterangan: 'Tugas ini mungkin sudah dihapus, atau tautannya tidak lengkap.',
      aksi: { href: 'portal.html', label: 'Buka Daftar Tugas' },
    })
    : `<div class="pesan gagal">${esc(err.message)}</div>`;
}
