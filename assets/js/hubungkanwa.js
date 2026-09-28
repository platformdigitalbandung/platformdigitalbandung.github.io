import { apiPostJson } from './api.js';
import { esc } from './ui.js';

// Hubungkan WhatsApp (keputusan developer Rolly 2026-09-28): mahasiswa yang
// masuk dengan kata sandi tetapi belum punya nomor WhatsApp di roster
// menghubungkan nomornya sendiri, supaya bisa masuk lewat WhatsApp bila lupa
// kata sandi. Nomor tidak diketik di sini: POST /api/akun/wa/kode memberi kode
// sekali pakai, lalu mahasiswa mengirim "hubungkan wa | KODE" ke bot DARI
// nomor itu — WhatsApp yang membuktikan nomornya miliknya.

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

export function htmlHubungkanWA() {
  return `<div class="blok-langkah" id="hubungkan-wa">
    <h3>Hubungkan WhatsApp</h3>
    <p class="meta">Nomor WhatsApp Anda belum tercatat di platform. Hubungkan supaya Anda bisa masuk lewat WhatsApp bila lupa kata sandi, dan memakai layanan platform lewat WhatsApp.</p>
    <p class="cta-row"><button type="button" class="aksi" data-aksi="hubungkan-wa">Hubungkan WhatsApp</button></p>
    <div class="hasil-hubungkan" aria-live="polite"></div>
  </div>`;
}

// pasangHubungkanWA memasang penangan tombol di wadah (sekali per halaman).
export function pasangHubungkanWA(wadah) {
  if (!wadah) return;
  wadah.addEventListener('click', async (e) => {
    const tombol = e.target.closest('[data-aksi="hubungkan-wa"]');
    if (!tombol) return;
    const hasil = tombol.closest('#hubungkan-wa').querySelector('.hasil-hubungkan');
    tombol.disabled = true;
    try {
      const k = await apiPostJson('/api/akun/wa/kode', {});
      hasil.innerHTML = `<p>Buka tautan di bawah <b>dari HP yang memakai nomor WhatsApp Anda</b>, lalu tekan <b>Kirim</b> di WhatsApp. Kode berlaku ${esc(k.berlaku_menit)} menit dan hanya bisa dipakai sekali.</p>
        <p class="cta-row"><a class="aksi" href="${escAttr(k.tautan)}" target="_blank" rel="noopener">Buka WhatsApp</a></p>
        <p class="meta">Atau kirim pesan <code>${esc(k.pesan)}</code> ke nomor bot secara manual. Setelah bot membalas bahwa nomor terhubung, keluar lalu masuk lagi.</p>`;
    } catch (err) {
      hasil.innerHTML = err.status === 409
        ? '<div class="pesan sukses">Nomor WhatsApp Anda sudah terhubung. Keluar lalu masuk lagi supaya platform mengenalinya.</div>'
        : `<div class="pesan gagal">${esc(err.message)}</div>`;
    } finally {
      tombol.disabled = false;
    }
  });
}
