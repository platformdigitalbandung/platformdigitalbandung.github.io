import { setInner } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.12/element.min.js';
import { apiGet, isLoggedIn } from './api.js';

// Halaman "Tentang Program": materi sosialisasi yang dulu menjadi halaman depan.
// Narasi karier per prodi tidak berasal dari data /api/kurikulum (belum dimodelkan
// sebagai struct) — diambil dari presentasi-sosialisasi.html apa adanya.
const KARIER = {
  trpl: 'Software Engineer · Systems Analyst · Software Quality &amp; Security Engineer · IT Project Manager',
  bisdig: 'Digital Marketer · E-Commerce &amp; FinTech Specialist · Digital Business Analyst · Project Manager',
};

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function kartuProdi(p, rumpun) {
  const totalSKS = rumpun.reduce((sum, r) => sum + (r.sks || 0), 0);
  const daftar = rumpun.slice(0, 6).map(r => `<li>${esc(r.kode)} — ${esc(r.nama)}</li>`).join('');
  const lebih = rumpun.length > 6 ? `<li class="redup">+${rumpun.length - 6} rumpun lainnya</li>` : '';
  return `
    <div class="kartu">
      <h3>${esc(p.nama)}</h3>
      <p class="meta">${p.sks_total} SKS · ${p.semester} semester · ${esc(p.jenjang)}</p>
      <p class="meta">${rumpun.length} rumpun berbasis proyek${totalSKS ? ` · ${totalSKS} SKS ritme/tempat-kerja` : ''}</p>
      <ul class="rumpun-list">${daftar}${lebih}</ul>
      ${KARIER[p.kode] ? `<p class="meta">Jadi apa setelah lulus: ${KARIER[p.kode]}</p>` : ''}
    </div>`;
}

// Narasi program di halaman ini publik; kartu program studi diambil dari
// /api/kurikulum yang hanya untuk pengguna terdaftar (keputusan pemilik produk
// 2026-09-14), jadi sebelum masuk cukup diberi keterangan.
async function muatProdi() {
  if (!isLoggedIn()) {
    setInner('prodi', '<p class="redup">Data program studi tampil setelah masuk. Tekan <b>Masuk</b> di pojok kanan atas.</p>');
    return;
  }
  try {
    const { prodi: list = [] } = await apiGet('/api/kurikulum/prodi');
    if (!list.length) { setInner('prodi', '<p class="redup">Data program studi belum tersedia.</p>'); return; }
    const kartuHtml = await Promise.all(list.map(async p => {
      const { rumpun = [] } = await apiGet('/api/kurikulum/prodi/' + encodeURIComponent(p.kode) + '/rumpun').catch(() => ({}));
      return kartuProdi(p, rumpun || []);
    }));
    setInner('prodi', kartuHtml.join(''));
  } catch (err) {
    setInner('prodi', `<p class="redup">Gagal memuat data program studi: ${esc(err.message)}</p>`);
  }
}

muatProdi();
