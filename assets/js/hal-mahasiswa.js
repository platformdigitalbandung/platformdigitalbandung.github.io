import { apiGet } from './api.js';
import { esc } from './ui.js';

// Helper bersama halaman kelompok mahasiswa (Materi, Kuis Gerbang, Dasbor).
//
// Minggu berjalan diambil dari agenda beranda (GET /api/beranda/agenda):
// backend yang tahu angkatan dan semester mahasiswa, jadi kalender yang
// dipakai pasti kalender miliknya. Agenda juga memberi butir
// `kalender_belum_terbit` bila kalender semesternya belum diterbitkan kaprodi.
// Kalender terbit prodi (GET /api/kalender?prodi=) hanya dipakai untuk
// keterangan tanggal dan rumpun minggu itu (lihat catatan di bawah).

function tanggalPendek(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * @returns {Promise<{terbit: boolean, minggu: number, rumpun: string[], rentang: string}>}
 *   terbit  — kalender semester mahasiswa sudah diterbitkan
 *   minggu  — minggu berjalan (0 = hari ini di luar jadwal kalender)
 *   rumpun  — kode rumpun yang dijadwalkan minggu itu ([] = tidak diketahui / semua)
 *   rentang — "14 Sep – 20 Sep" untuk minggu berjalan ("" bila tidak diketahui)
 */
export async function pekanMahasiswa(prodi) {
  const [agenda, kal] = await Promise.allSettled([
    apiGet('/api/beranda/agenda'),
    apiGet(`/api/kalender?${new URLSearchParams({ prodi })}`),
  ]);
  const kalender = kal.status === 'fulfilled' ? (kal.value.kalender || []) : null;
  let terbit;
  let minggu = 0;
  if (agenda.status === 'fulfilled') {
    const a = agenda.value || {};
    minggu = Number(a.minggu_berjalan) || 0;
    terbit = !(a.mahasiswa || []).some(b => b.jenis === 'kalender_belum_terbit');
  } else if (kalender) {
    terbit = kalender.length > 0;
  } else {
    throw agenda.reason;
  }

  // Kalender prodi yang punya minggu itu. Kalau prodi punya beberapa kalender
  // terbit (angkatan/semester lain), keterangan hanya dipakai bila semuanya
  // sepakat soal tanggal dan rumpun minggu itu — halaman tidak menebak.
  let rumpun = [];
  let rentang = '';
  if (terbit && minggu > 0 && kalender && kalender.length) {
    const calon = kalender.map(k => {
      const sesi = (k.sesi || []).filter(s => s.minggu === minggu);
      const tanggal = sesi.map(s => new Date(s.tanggal)).filter(d => !isNaN(d)).sort((a, b) => a - b);
      return {
        rumpun: [...new Set(sesi.map(s => s.rumpun_kode).filter(Boolean))].sort(),
        rentang: tanggal.length ? `${tanggalPendek(tanggal[0])} – ${tanggalPendek(tanggal[tanggal.length - 1])}` : '',
      };
    }).filter(c => c.rentang);
    const sama = (f) => calon.length && calon.every(c => f(c) === f(calon[0]));
    if (sama(c => c.rentang)) rentang = calon[0].rentang;
    if (sama(c => c.rumpun.join(','))) rumpun = calon[0].rumpun;
  }
  return { terbit, minggu, rumpun, rentang };
}

// Datalist NIM untuk dosen: dari roster prodi tempat ia mengajar (semua bila
// belum tercatat mengajar). Gagal memuat tidak menghalangi isian manual.
export async function isiDatalistNIM(datalist, prodiMengajar) {
  if (!datalist) return;
  try {
    const daftarProdi = (prodiMengajar || []).length ? prodiMengajar : [''];
    const hasil = await Promise.all(daftarProdi.map(p =>
      apiGet(`/api/mahasiswa${p ? `?${new URLSearchParams({ prodi: p })}` : ''}`).then(r => r.mahasiswa || [])));
    datalist.innerHTML = hasil.flat().map(m =>
      `<option value="${esc(m.nim)}">${esc(m.nama)} · ${esc(String(m.prodi_kode || '').toUpperCase())}</option>`).join('');
  } catch (_) { /* isian NIM tetap bisa diketik manual */ }
}

