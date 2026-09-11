import { getJSON } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/api.min.js';
import { setInner } from 'https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.10/element.min.js';
import { API_BASE } from './config.js';

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
      <p class="meta">Jadi apa setelah lulus: ${KARIER[p.kode] || '—'}</p>
    </div>`;
}

getJSON(API_BASE + '/api/kurikulum/prodi', async (res) => {
  // status 0 = jaringan gagal atau timeout (crootjs selalu memanggil callback).
  if (res.status !== 200) {
    setInner('prodi', `<p class="redup">Backend tidak terjangkau (${esc(API_BASE)}).
      Data program studi tidak bisa dimuat saat ini.</p>`);
    return;
  }
  try {
    const list = (res.data && res.data.prodi) || [];
    if (!list.length) { setInner('prodi', '<p class="redup">Data program studi belum tersedia.</p>'); return; }
    const kartuHtml = await Promise.all(list.map(p => new Promise((resolve) => {
      getJSON(API_BASE + '/api/kurikulum/prodi/' + p.kode + '/rumpun', (rres) => {
        resolve(kartuProdi(p, (rres.data && rres.data.rumpun) || []));
      });
    })));
    setInner('prodi', kartuHtml.join(''));
  } catch (err) {
    setInner('prodi', `<p class="redup">Gagal memuat data program studi: ${esc(err.message)}</p>`);
  }
});
