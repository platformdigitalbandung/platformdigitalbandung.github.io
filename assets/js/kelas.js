import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, apiPostBerkasToken, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, punyaPeran } from './akun.js';
import { esc, halamanUntuk, keadaanKosong, labelTabel, istilah } from './ui.js';

// Kelas (model Google Classroom) — keputusan developer Arfan 2026-09-25.
// Satu halaman, tiga tampilan:
//   kelas.html              → Kelas Saya (kartu kelas per periode)
//   kelas.html?id=<kelas>   → isi kelas: Beranda (pengumuman, grup WhatsApp,
//                             minggu berjalan) · Tugas Kelas · Anggota · Nilai
//   kelas.html?kelola=<prodi> → Kelola Kelas (kaprodi; admin hanya membaca)
// Peran di kelas (peserta/pengajar/kaprodi/admin) dihitung backend; halaman ini
// hanya tidak menawarkan aksi yang pasti ditolak.

const isi = document.getElementById('isi');
const param = new URLSearchParams(location.search);
const idKelas = param.get('id');
const kelolaProdi = (param.get('kelola') || '').toLowerCase();

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
const WIB = { timeZone: 'Asia/Jakarta' };
function tanggal(iso, jam = false) {
  const d = new Date(iso);
  if (isNaN(d) || d.getFullYear() < 2000) return '';
  return d.toLocaleString('id-ID', jam
    ? { ...WIB, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { ...WIB, day: 'numeric', month: 'short', year: 'numeric' }) + (jam ? ' WIB' : '');
}
function angka(v) { return v === null || v === undefined ? '—' : (Math.round(v * 100) / 100).toLocaleString('id-ID'); }
function pesan(id, jenis, teks) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = teks ? `<div class="pesan ${jenis}">${teks}</div>` : '';
}
function setKepala(judul, sub, remah) {
  document.getElementById('judul-kelas').textContent = judul;
  document.getElementById('sub-kelas').textContent = sub;
  document.getElementById('remah').innerHTML = remah;
  document.title = `${judul} — Platform Digital Bandung`;
}
const namaPengajar = (k) => (k.pengajar_orang || []).map(p => p.nama).join(', ');
const labelPeran = { peserta: 'peserta', pengajar: 'pengajar', kaprodi: 'kaprodi', admin: 'admin (baca)' };

// ======================= Kelas Saya =======================

function kartuKelas(k) {
  const pengajar = namaPengajar(k);
  return `<a class="kartu kartu-kelas" href="kelas.html?id=${encodeURIComponent(k.id)}">
    <h3>${esc(k.nama)}</h3>
    <p class="baris-kecil">${esc(k.prodi_nama || k.prodi_kode.toUpperCase())} · semester ${esc(k.semester)} · angkatan ${esc(k.angkatan)}</p>
    <p class="baris-kecil">${k.mk_kode ? 'Mata kuliah lepas' : `Rumpun ${esc(k.rumpun_kode)}${k.rumpun_nama ? ` — ${esc(k.rumpun_nama)}` : ''}`}</p>
    <p class="baris-kecil">${pengajar ? `Pengajar: ${esc(pengajar)}` : '<span class="lencana sedang">belum ada pengajar</span>'}</p>
    <p class="baris-kecil">${esc(k.jumlah_peserta)} peserta · <span class="lencana">${esc(labelPeran[k.peran] || k.peran)}</span></p>
  </a>`;
}

function gridPerPeriode(daftar) {
  const kelompok = new Map();
  for (const k of daftar) {
    const kunci = k.periode || 'Tanpa periode';
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci).push(k);
  }
  // Periode terbaru di atas: kelas periode lalu tetap tampil (mahasiswa yang
  // naik semester tetap tercatat di kelas lamanya supaya nilainya tidak hilang).
  const urutan = p => {
    const m = /^(Ganjil|Genap) (\d{4})/.exec(p);
    return m ? Number(m[2]) * 2 + (m[1] === 'Genap' ? 1 : 0) : -1;
  };
  return [...kelompok.entries()].sort((a, b) => urutan(b[0]) - urutan(a[0])).map(([periode, ks]) =>
    `<h2 class="judul-periode">${esc(periode)}</h2><div class="grid-kelas">${ks.map(kartuKelas).join('')}</div>`).join('');
}

async function tampilDaftar(saya) {
  // Tanpa pemilih peran (2026-09-26): admin yang tidak mengajar dan tidak
  // memimpin prodi melihat pilihan prodi (hanya baca); selain itu semua kelas
  // yang diikuti, diajar, dan kelas prodi yang dipimpin.
  const kaprodi = punyaPeran(saya, 'kaprodi');
  const { kelas = [], kaprodi_prodi: kaprodiProdi = [] } = await apiGet('/api/kelas/saya');
  if (punyaPeran(saya, 'admin') && !kaprodi && !kelas.length) {
    const { prodi = [] } = await apiGet('/api/kurikulum/prodi');
    setKepala('Kelas', 'Kelas semua prodi (hanya baca untuk admin)', '<a href="./">Beranda</a> / Kelas');
    isi.innerHTML = `<div class="kartu"><h3>Pilih program studi</h3>
      <p class="meta">Admin melihat kelas semua prodi tanpa mengubahnya; kelas disusun kaprodi masing-masing.</p>
      <p class="cta-row">${(prodi || []).map(p => `<a class="aksi sekunder" href="kelas.html?kelola=${encodeURIComponent(p.kode)}">${esc(p.nama)}</a>`).join('')}</p></div>`;
    return;
  }
  const daftar = kelas;
  const mahasiswa = punyaPeran(saya, 'mahasiswa');
  const kelola = kaprodi && kaprodiProdi.length
    ? `<p class="cta-row">${kaprodiProdi.map(p => `<a class="aksi" href="kelas.html?kelola=${encodeURIComponent(p)}">Kelola kelas ${esc(p.toUpperCase())}</a>`).join('')}</p>` : '';
  if (!daftar.length) {
    isi.innerHTML = kelola + (mahasiswa
      ? keadaanKosong({
        judul: 'Belum ada kelas',
        keterangan: 'Kelas dibuka otomatis setelah kaprodi menerbitkan kalender semester prodi, angkatan, dan semester Anda di roster.',
        siapa: 'kaprodi prodi Anda',
        aksi: { href: 'kalender.html', label: 'Lihat kalender' },
      })
      : keadaanKosong({
        judul: kaprodi ? 'Belum ada kelas di prodi Anda' : 'Anda belum menjadi pengajar kelas mana pun',
        keterangan: kaprodi
          ? 'Kelas dibuat otomatis saat kalender semester diterbitkan. Terbitkan kalendernya, atau buka Kelola Kelas untuk membuat kelas.'
          : 'Kaprodi menunjuk pengajar tiap kelas. Hubungi kaprodi prodi tempat Anda mengajar.',
        siapa: 'kaprodi',
        aksi: kaprodi ? { href: 'kalender.html', label: 'Buka kalender' } : null,
      }));
    return;
  }
  isi.innerHTML = kelola + gridPerPeriode(daftar);
}

// ======================= Kelola Kelas =======================

let kelolaData = { kelas: [], kalender: [], pilihan: [], prodi: '' };

// Pilihan pengajar: semua dosen aktif yang sudah mengisi email kampus (sejak
// 2026-09-26 tanpa centang pengampu). Yang sudah terpilih di atas; kolom cari
// menyaring daftar yang panjang.
function opsiPengajar(terpilih) {
  if (!kelolaData.pilihan.length) {
    return '<p class="redup">Belum ada dosen aktif yang mengisi email kampus. Dosen mengisinya sendiri di halaman Roster &amp; Email Dosen.</p>';
  }
  const urut = [...kelolaData.pilihan].sort((a, b) => Number(terpilih.includes(b.email)) - Number(terpilih.includes(a.email)));
  return `<input type="search" class="cari-pengajar" placeholder="Cari nama atau email dosen…" aria-label="Cari dosen">
    <div class="pilih-pengajar">${urut.map(d => `<label data-cari="${escAttr(`${d.nama || ''} ${d.email}`.toLowerCase())}"><input type="checkbox" name="pengajar" value="${escAttr(d.email)}"${terpilih.includes(d.email) ? ' checked' : ''}>${esc(d.nama || d.email)} <span class="redup">&nbsp;${esc(d.email)}</span></label>`).join('')}</div>`;
}

function formKelas(k, boleh) {
  if (!boleh) {
    return `<tr><td><a href="kelas.html?id=${encodeURIComponent(k.id)}">${esc(k.nama)}</a></td><td>${esc(namaPengajar(k) || '—')}</td><td class="num">${esc(k.jumlah_peserta)}</td><td></td></tr>`;
  }
  return `<tr data-id="${escAttr(k.id)}">
    <td><input name="nama" maxlength="120" value="${escAttr(k.nama)}" aria-label="Nama kelas">
      <p class="redup">${k.mk_kode ? `Mata kuliah ${esc(k.mk_kode)}` : `Rumpun ${esc(k.rumpun_kode)}`} · <a href="kelas.html?id=${encodeURIComponent(k.id)}">Buka kelas</a></p></td>
    <td>${opsiPengajar(k.pengajar || [])}</td>
    <td><label>Peserta tambahan (NIM, pisahkan koma) <input name="tambahan" value="${escAttr((k.peserta_tambahan || []).join(', '))}"></label>
      <label>Dikeluarkan dari kelas (NIM) <input name="keluar" value="${escAttr((k.peserta_keluar || []).join(', '))}"></label>
      <p class="redup">${esc(k.jumlah_peserta)} peserta</p></td>
    <td><div class="aksi-sel"><button type="button" data-aksi="simpan-kelas">Simpan</button>
      <button type="button" class="bahaya" data-aksi="hapus-kelas">Hapus</button></div></td>
  </tr>`;
}

function renderKelola(boleh, pesanAwal = '') {
  const { kelas, kalender, prodi } = kelolaData;
  const perKal = kalender.map(kal => {
    const ks = kelas.filter(k => k.kalender_id === kal.id);
    return `<div class="kartu">
      <h3>Angkatan ${esc(kal.angkatan)} · semester ${esc(kal.semester)} <span class="redup">· ${esc(kal.periode)}</span></h3>
      ${boleh ? `<p class="cta-row"><button type="button" class="sekunder" data-aksi="otomatis" data-kalender="${escAttr(kal.id)}">Buat kelas yang belum ada</button></p>` : ''}
      ${ks.length ? `<div class="gulir"><table class="tabel-kelola">
        <thead><tr><th>Kelas</th><th>Pengajar</th><th>Peserta</th><th></th></tr></thead>
        <tbody>${ks.map(k => formKelas(k, boleh)).join('')}</tbody></table></div>`
      : '<div class="kosong">Belum ada kelas untuk kalender ini.</div>'}
    </div>`;
  }).join('');
  isi.innerHTML = `<div id="pesan-kelola">${pesanAwal}</div>
    ${kalender.length ? perKal : keadaanKosong({
      judul: `Belum ada kalender terbit untuk ${prodi.toUpperCase()}`,
      keterangan: 'Kelas dibuka per kalender semester yang sudah diterbitkan. Terbitkan kalender dulu; kelasnya dibuat otomatis.',
      siapa: `kaprodi ${prodi.toUpperCase()}`,
      aksi: { href: 'kalender.html', label: 'Buka kalender' },
    })}
    ${boleh && kalender.length ? `<div class="kartu"><h3>Tambah Kelas</h3>
      <p class="meta">Untuk kelas yang tidak dibuat otomatis (mis. setelah dihapus, atau rumpun semester lain). Rumpun berproyek dibuka sebagai satu kelas; rumpun tanpa proyek pengikat (wadah mata kuliah lepas) dibuka per mata kuliah.</p>
      <form id="form-tambah-kelas" class="saringan">
        <label>Kalender <select name="kalender_id">${kalender.map(k => `<option value="${escAttr(k.id)}">Angkatan ${esc(k.angkatan)} · smt ${esc(k.semester)} · ${esc(k.periode)}</option>`).join('')}</select></label>
        <label>Rumpun <select name="rumpun_kode" id="tambah-rumpun"></select></label>
        <label>Mata kuliah <select name="mk_kode" id="tambah-mk"><option value="">(seluruh rumpun)</option></select></label>
        <label>Nama (opsional) <input name="nama" maxlength="120"></label>
        <button>Tambah Kelas</button>
      </form></div>` : ''}`;
  isi.querySelectorAll('table').forEach(t => labelTabel(t));
}

async function isiPilihanTambah() {
  const selR = document.getElementById('tambah-rumpun');
  if (!selR) return;
  const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kelolaData.prodi)}/rumpun`);
  selR.innerHTML = (rumpun || []).map(r => `<option value="${escAttr(r.kode)}" data-proyek="${r.proyek_pengikat ? '1' : ''}">${esc(r.kode)} — ${esc(r.nama)} (smt ${esc(r.semester)})${r.proyek_pengikat ? '' : ' · mata kuliah lepas'}</option>`).join('');
  const isiMK = async () => {
    const selMK = document.getElementById('tambah-mk');
    const { matakuliah = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(kelolaData.prodi)}/matakuliah?rumpun=${encodeURIComponent(selR.value)}`);
    selMK.innerHTML = '<option value="">(seluruh rumpun)</option>' + (matakuliah || []).map(m => `<option value="${escAttr(m.kode)}">${esc(m.nama)}</option>`).join('');
  };
  selR.addEventListener('change', isiMK);
  await isiMK();
}

async function muatKelola() {
  const [daftar, pilihan] = await Promise.all([
    apiGet(`/api/kelas?prodi=${encodeURIComponent(kelolaData.prodi)}`),
    kelolaBoleh ? apiGet(`/api/kelas/pilihan-pengajar?prodi=${encodeURIComponent(kelolaData.prodi)}`).catch(() => ({ dosen: [] })) : Promise.resolve({ dosen: [] }),
  ]);
  kelolaData.kelas = daftar.kelas || [];
  kelolaData.kalender = daftar.kalender || [];
  kelolaData.pilihan = pilihan.dosen || [];
}

let kelolaBoleh = false;

async function tampilKelola(saya) {
  const admin = punyaPeran(saya, 'admin');
  const dipimpin = (saya.kaprodi_prodi || []).map(p => p.toLowerCase());
  kelolaBoleh = punyaPeran(saya, 'kaprodi') && dipimpin.includes(kelolaProdi);
  if (!kelolaBoleh && !admin) {
    if (!halamanUntuk(saya, ['kaprodi', 'admin'], { judul: 'Kelola Kelas', pesan: 'Kelas prodi disusun kaprodinya.' })) return;
    if (!dipimpin.includes(kelolaProdi)) {
      isi.innerHTML = '<div class="pesan gagal">Kaprodi hanya mengelola kelas prodinya sendiri.</div>';
      return;
    }
  }
  kelolaData.prodi = kelolaProdi;
  setKepala(`Kelola Kelas ${kelolaProdi.toUpperCase()}`, kelolaBoleh ? 'Tunjuk pengajar, atur peserta, dan buka kelas tiap periode' : 'Kelas prodi ini (hanya baca untuk admin)',
    `<a href="./">Beranda</a> / <a href="kelas.html">Kelas</a> / Kelola ${esc(kelolaProdi.toUpperCase())}`);
  await muatKelola();
  renderKelola(kelolaBoleh);
  await isiPilihanTambah();

  isi.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-aksi]');
    if (!b || !kelolaBoleh) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'otomatis') {
      b.disabled = true;
      try {
        const r = await apiPostJson('/api/kelas/otomatis', { kalender_id: b.dataset.kalender });
        await muatKelola();
        renderKelola(true, `<div class="pesan sukses">${r.dibuat ? `${esc(r.dibuat)} kelas baru dibuat.` : 'Semua kelas kalender ini sudah ada.'}</div>`);
        await isiPilihanTambah();
      } catch (err) { pesan('pesan-kelola', 'gagal', esc(err.message)); b.disabled = false; }
      return;
    }
    const tr = b.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.dataset.id;
    const k = kelolaData.kelas.find(x => x.id === id);
    if (aksi === 'simpan-kelas') {
      const pisah = (s) => String(s || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const body = {
        nama: tr.querySelector('input[name=nama]').value,
        pengajar: [...tr.querySelectorAll('input[name=pengajar]:checked')].map(c => c.value),
        peserta_tambahan: pisah(tr.querySelector('input[name=tambahan]').value),
        peserta_keluar: pisah(tr.querySelector('input[name=keluar]').value),
      };
      b.disabled = true;
      try {
        await apiPutJson(`/api/kelas/${encodeURIComponent(id)}`, body);
        await muatKelola();
        renderKelola(true, `<div class="pesan sukses">Kelas ${esc(body.nama)} tersimpan.</div>`);
        await isiPilihanTambah();
      } catch (err) { pesan('pesan-kelola', 'gagal', `Gagal menyimpan ${esc(k ? k.nama : '')}: ${esc(err.message)}`); b.disabled = false; }
    } else if (aksi === 'hapus-kelas') {
      if (!window.confirm(`Hapus kelas ${k ? k.nama : ''}?`)) return;
      try {
        await apiDeleteJson(`/api/kelas/${encodeURIComponent(id)}`);
      } catch (err) {
        if (err.status !== 422 || !window.confirm(`${err.message}\n\nTetap hapus kelas ini?`)) {
          if (err.status !== 422) pesan('pesan-kelola', 'gagal', esc(err.message));
          return;
        }
        try { await apiDeleteJson(`/api/kelas/${encodeURIComponent(id)}?konfirmasi=hapus`); } catch (e2) { pesan('pesan-kelola', 'gagal', esc(e2.message)); return; }
      }
      await muatKelola();
      renderKelola(true, '<div class="pesan sukses">Kelas dihapus. Tombol "Buat kelas yang belum ada" membuatnya lagi bila perlu.</div>');
      await isiPilihanTambah();
    }
  });
  isi.addEventListener('input', (e) => {
    if (!e.target.classList.contains('cari-pengajar')) return;
    const q = e.target.value.trim().toLowerCase();
    e.target.nextElementSibling.querySelectorAll('label').forEach(l => {
      l.hidden = Boolean(q) && !l.dataset.cari.includes(q) && !l.querySelector('input').checked;
    });
  });
  isi.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-tambah-kelas') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const k = await apiPostJson('/api/kelas', { kalender_id: fd.get('kalender_id'), rumpun_kode: fd.get('rumpun_kode'), mk_kode: fd.get('mk_kode') || '', nama: fd.get('nama') || '' });
      await muatKelola();
      renderKelola(true, `<div class="pesan sukses">Kelas ${esc(k.nama)} dibuka.</div>`);
      await isiPilihanTambah();
    } catch (err) { pesan('pesan-kelola', 'gagal', esc(err.message)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

// ======================= Isi Kelas =======================

let detail = null;
let isiKelas = null;
let buku = null;
let pengumuman = null;
const mengajar = () => detail && (detail.peran === 'pengajar' || detail.peran === 'kaprodi');

function tautanMateri(m) {
  if (mengajar()) return 'kelola-materi.html';
  const q = new URLSearchParams({ rumpun: m.rumpun_kode, minggu: String(m.minggu) });
  if (detail.mk_kode) q.set('mk', detail.mk_kode);
  return `materi.html?${q}`;
}
function tautanKuis(minggu) {
  const q = new URLSearchParams({ rumpun: detail.rumpun_kode, minggu: String(minggu) });
  if (detail.mk_kode) q.set('mk', detail.mk_kode);
  if (mengajar()) q.set('prodi', detail.prodi_kode);
  return `kuis.html?${q}`;
}
function tautanBuatMateri(minggu) {
  const q = new URLSearchParams({ prodi: detail.prodi_kode, rumpun: detail.rumpun_kode, minggu: String(minggu || 1) });
  if (detail.mk_kode) q.set('mk', detail.mk_kode);
  return `kelola-materi.html?${q}`;
}

function lencanaTugas(t) {
  switch (t.status) {
    case 'dinilai': return `<span class="lencana rendah">dinilai ${esc(angka(t.nilai))}/${esc(angka(t.nilai_maks || 100))}</span>`;
    case 'diserahkan': return '<span class="lencana rendah">diserahkan</span>';
    case 'terlambat': return '<span class="lencana sedang">diserahkan terlambat</span>';
    default: {
      const lewat = t.tenggat && new Date(t.tenggat) < new Date();
      return lewat ? '<span class="lencana tinggi">lewat tenggat</span>' : '<span class="lencana">ditugaskan</span>';
    }
  }
}

function butirTugas(t) {
  const tenggat = t.tenggat ? `Tenggat ${esc(tanggal(t.tenggat, true))}` : 'Tanpa tenggat';
  const kanan = mengajar()
    ? `<span class="butir-ket">${esc(t.diserahkan)} diserahkan · ${esc(t.dinilai)} dinilai</span>
       <a class="aksi sekunder" href="tugas.html?id=${encodeURIComponent(t.id)}">Nilai</a>`
    : `${lencanaTugas(t)} <a class="aksi${t.status && t.status !== 'ditugaskan' ? ' sekunder' : ''}" href="tugas.html?id=${encodeURIComponent(t.id)}">${t.status && t.status !== 'ditugaskan' ? 'Lihat' : 'Kerjakan'}</a>`;
  return `<div class="butir-isi"><div><div class="butir-judul">${esc(t.judul)}</div><div class="butir-ket">${tenggat}${t.lampiran_nama ? ' · ada lampiran' : ''}</div></div>
    <div class="aksi-sel">${kanan}</div></div>`;
}

function butirKuis(q) {
  const kanan = mengajar()
    ? `<span class="butir-ket">${esc(q.dikerjakan)} sudah mengerjakan</span><a class="aksi sekunder" href="${escAttr(tautanKuis(q.minggu))}">Susun</a>`
    : `${q.skor !== undefined && q.skor !== null
      ? (q.lulus ? `<span class="lencana rendah">lulus ${esc(angka(q.skor))}%</span>` : `<span class="lencana tinggi">belum lulus ${esc(angka(q.skor))}%</span>`)
      : '<span class="lencana">belum dikerjakan</span>'} <a class="aksi${q.skor !== undefined && q.skor !== null ? ' sekunder' : ''}" href="${escAttr(tautanKuis(q.minggu))}">${q.skor !== undefined && q.skor !== null ? 'Ulangi' : 'Kerjakan'}</a>`;
  return `<div class="butir-isi"><div><div class="butir-judul">Kuis minggu ${esc(q.minggu)}</div><div class="butir-ket">${esc(q.jumlah_soal)} soal · ambang lulus ${esc(angka(q.ambang_lulus))}%</div></div><div class="aksi-sel">${kanan}</div></div>`;
}

function butirMateri(m) {
  const jenis = { video: 'Video', bacaan: 'Bacaan', berkas: 'PDF' }[m.jenis] || m.jenis;
  return `<div class="butir-isi"><div><div class="butir-judul">${esc(m.judul)}</div><div class="butir-ket">${esc(jenis)}${m.deskripsi ? ` · ${esc(m.deskripsi)}` : ''}</div></div>
    <div class="aksi-sel"><a class="aksi sekunder" href="${escAttr(tautanMateri(m))}">${mengajar() ? 'Kelola' : 'Buka'}</a></div></div>`;
}

// Grup WhatsApp kelas: tautan undangan untuk semua anggota; tautan pembuatan
// (wa.me ke bot dengan pesan terisi) untuk pengajar selama grupnya belum ada.
function kartuGrup() {
  const g = detail.grup_wa || {};
  if (g.ada) {
    return `<div class="kartu"><h3>Grup WhatsApp kelas</h3>
      <p class="meta">Diskusi kelas, pengumuman, dan pengingat tenggat tugas dikirim ke grup ini.</p>
      ${g.tautan_undangan ? `<p class="cta-row"><a class="aksi" href="${escAttr(g.tautan_undangan)}" target="_blank" rel="noopener">Gabung grup WhatsApp kelas</a></p>`
        : '<p class="redup">Tautan undangan belum tersedia; minta pengajar mengirimkannya.</p>'}
    </div>`;
  }
  if (g.tautan_buat) {
    return `<div class="kartu"><h3>Grup WhatsApp kelas</h3>
      <p class="meta">Kelas ini belum punya grup WhatsApp. Tombol di bawah membuka WhatsApp ke bot dengan pesan yang sudah terisi — tekan Kirim. Bot membuat grup bernama kelas ini, menjadikan Anda admin, dan membalas tautan undangannya. Pengumuman dan pengingat tenggat tugas kemudian dikirim bot ke grup itu.</p>
      <p class="cta-row"><a class="aksi sekunder" href="${escAttr(g.tautan_buat)}" target="_blank" rel="noopener">Buat grup WhatsApp kelas</a></p>
    </div>`;
  }
  return `<div class="kartu"><h3>Grup WhatsApp kelas</h3><p class="redup">Grup WhatsApp kelas ini belum dibuat pengajar.</p></div>`;
}

function kartuPengumuman() {
  const bisa = mengajar();
  const adaGrup = Boolean(detail.grup_wa && detail.grup_wa.ada);
  const form = bisa ? `<form id="form-pengumuman">
      <label>Pengumuman baru <textarea name="isi" rows="3" maxlength="3000" required></textarea></label>
      <label class="pilihan-sebaris"><input type="checkbox" name="kirim_grup"${adaGrup ? ' checked' : ' disabled'}> Kirim juga ke grup WhatsApp kelas${adaGrup ? '' : ' (grup belum dibuat)'}</label>
      <div class="cta-row"><button>Umumkan</button></div>
    </form>` : '';
  const daftar = (pengumuman || []).length
    ? pengumuman.map(p => `<div class="butir-pengumuman">
        <p class="meta">${esc(p.oleh_nama || 'Pengajar')} · ${esc(tanggal(p.dibuat, true))}${p.ke_grup ? ' · terkirim ke grup WhatsApp' : ''}</p>
        <p class="teks-panjang">${esc(p.isi)}</p>
        ${bisa ? `<p class="cta-row"><button type="button" class="sekunder" data-aksi="hapus-pengumuman" data-id="${escAttr(p.id)}">Hapus</button></p>` : ''}
      </div>`).join('')
    : '<p class="redup">Belum ada pengumuman.</p>';
  return `<div class="kartu"><h3>Pengumuman</h3>${form}<div id="hasil-pengumuman"></div>${daftar}</div>`;
}

function tabBeranda() {
  const semuaTugas = [...(isiKelas.minggu || []).flatMap(w => w.tugas), ...(isiKelas.tugas_tanpa_minggu || [])];
  const sekarang = new Date();
  const mingguIni = (isiKelas.minggu || []).find(w => w.minggu === detail.minggu_ini);
  let utama;
  if (mengajar()) {
    const perlu = semuaTugas.filter(t => t.diserahkan > t.dinilai);
    utama = `<div class="kartu"><h3>Perlu dinilai</h3>${perlu.length
      ? perlu.map(butirTugas).join('')
      : '<p class="redup">Tidak ada kiriman yang menunggu nilai.</p>'}</div>`;
  } else {
    const perlu = semuaTugas.filter(t => t.status === 'ditugaskan')
      .sort((a, b) => (a.tenggat ? new Date(a.tenggat) : Infinity) - (b.tenggat ? new Date(b.tenggat) : Infinity));
    utama = `<div class="kartu"><h3>Perlu dikerjakan</h3>${perlu.length
      ? perlu.map(butirTugas).join('')
      : '<p class="redup">Semua tugas kelas ini sudah Anda serahkan.</p>'}</div>`;
  }
  const minggu = mingguIni ? `<div class="kartu"><h3>Minggu ${esc(mingguIni.minggu)} <span class="redup">· mulai ${esc(tanggal(mingguIni.mulai))}</span></h3>
      ${mingguIni.materi.length ? `<h4>Materi</h4>${mingguIni.materi.map(butirMateri).join('')}` : ''}
      ${mingguIni.kuis.length ? `<h4>Kuis</h4>${mingguIni.kuis.map(butirKuis).join('')}` : ''}
      ${mingguIni.tugas.length ? `<h4>Tugas</h4>${mingguIni.tugas.map(butirTugas).join('')}` : ''}
      ${!mingguIni.materi.length && !mingguIni.kuis.length && !mingguIni.tugas.length ? '<p class="redup">Belum ada materi, kuis, atau tugas untuk minggu ini.</p>' : ''}
    </div>` : `<div class="kartu"><h3>Minggu berjalan</h3><p class="redup">${detail.jumlah_minggu ? (sekarang < new Date(detail.minggu_awal) ? 'Perkuliahan kelas ini belum mulai.' : 'Kalender kelas ini sudah selesai.') : 'Kalender kelas ini tidak ditemukan.'}</p></div>`;
  const mk = (detail.mata_kuliah || []).map(m => `${esc(m.nama)} (${esc(m.sks)} SKS)`).join(', ');
  const tentang = `<div class="kartu"><h3>Tentang kelas</h3>
    <p class="meta">${esc(detail.prodi_nama || detail.prodi_kode.toUpperCase())} · angkatan ${esc(detail.angkatan)} · semester ${esc(detail.semester)} · ${esc(detail.periode)}</p>
    <p>${detail.mk_kode ? 'Mata kuliah' : `${istilah('rumpun', 'Rumpun')} ${esc(detail.rumpun_kode)} — ${esc(detail.rumpun_nama || '')}. Mata kuliah`}: ${mk || '—'}</p>
    <p>Pengajar: ${esc(namaPengajar(detail)) || '<span class="lencana sedang">belum ditunjuk kaprodi</span>'}</p>
  </div>`;
  return kartuPengumuman() + minggu + utama + kartuGrup() + tentang;
}

function formTugasBaru() {
  const minggu = detail.minggu_ini || 1;
  return `<div class="kartu" id="kartu-tugas-baru" hidden>
    <h3>Tugas Baru</h3>
    <form id="form-tugas-baru">
      <label>Judul <input name="judul" required maxlength="200"></label>
      <label>Petunjuk <textarea name="deskripsi" rows="4" maxlength="5000"></textarea></label>
      <div class="saringan">
        <label>Minggu <input type="number" name="minggu" min="0" max="52" value="${esc(minggu)}"></label>
        <label>Tenggat (WIB) <input type="datetime-local" name="tenggat"></label>
        <label>Nilai maksimal <input type="number" name="nilai_maks" min="1" max="1000" value="100"></label>
      </div>
      <label>Lampiran soal (opsional: pdf, docx, pptx, xlsx, txt, md, zip, gambar; maks 20 MiB) <input type="file" id="lampiran-baru" name="berkas"></label>
      <div class="cta-row"><button>Tugaskan</button><button type="button" class="sekunder" data-aksi="batal-tugas">Batal</button></div>
    </form>
    <div id="hasil-tugas-baru"></div>
  </div>`;
}

function tabTugasKelas() {
  const buat = mengajar() ? `<div class="bilah-buat">
      <b>+ Buat</b>
      <button type="button" data-aksi="buka-tugas">Tugas</button>
      <a class="aksi sekunder" href="${escAttr(tautanBuatMateri(detail.minggu_ini))}">Materi</a>
      <a class="aksi sekunder" href="${escAttr(tautanKuis(detail.minggu_ini || 1))}">Kuis</a>
    </div>${formTugasBaru()}` : '';
  const minggu = (isiKelas.minggu || []).map(w => {
    const jumlah = w.materi.length + w.kuis.length + w.tugas.length;
    const buka = w.minggu === detail.minggu_ini || (!detail.minggu_ini && w.minggu === 1);
    return `<details class="minggu-kelas"${buka ? ' open' : ''}>
      <summary>Minggu ${esc(w.minggu)}${w.minggu === detail.minggu_ini ? ' <span class="lencana">minggu ini</span>' : ''}
        <span class="redup">${w.mulai ? `mulai ${esc(tanggal(w.mulai))} · ` : ''}${jumlah ? `${w.materi.length} materi · ${w.kuis.length} kuis · ${w.tugas.length} tugas` : 'kosong'}</span></summary>
      <div class="isi-minggu">
        ${w.materi.length ? `<h4>Materi</h4>${w.materi.map(butirMateri).join('')}` : ''}
        ${w.kuis.length ? `<h4>Kuis</h4>${w.kuis.map(butirKuis).join('')}` : ''}
        ${w.tugas.length ? `<h4>Tugas</h4>${w.tugas.map(butirTugas).join('')}` : ''}
        ${jumlah ? '' : `<p class="redup">Belum ada isi.${mengajar() ? ` <a href="${escAttr(tautanBuatMateri(w.minggu))}">Tambah materi minggu ini</a>` : ''}</p>`}
      </div>
    </details>`;
  }).join('');
  const lepas = (isiKelas.tugas_tanpa_minggu || []).length
    ? `<div class="kartu"><h3>Tugas tanpa minggu</h3>${isiKelas.tugas_tanpa_minggu.map(butirTugas).join('')}</div>` : '';
  return buat + (minggu || keadaanKosong({ judul: 'Belum ada isi kelas', keterangan: 'Materi, kuis, dan tugas kelas ini tampil per minggu kalender.' })) + lepas;
}

function tabAnggota() {
  const peserta = detail.peserta || [];
  return `<div class="kartu"><h3>Pengajar</h3>
      ${(detail.pengajar_orang || []).length
        ? `<ul class="daftar-ringkas">${detail.pengajar_orang.map(p => `<li>${esc(p.nama)}<span class="kecil">${esc(p.email)}</span></li>`).join('')}</ul>`
        : '<p class="redup">Belum ada pengajar. Kaprodi menunjuk pengajar di Kelola Kelas.</p>'}
      ${detail.peran === 'kaprodi' ? `<p class="cta-row"><a class="aksi sekunder" href="kelas.html?kelola=${encodeURIComponent(detail.prodi_kode)}">Kelola Kelas</a></p>` : ''}
    </div>
    <div class="kartu"><h3>Peserta (${esc(peserta.length)})</h3>
      <p class="meta">Otomatis dari roster: mahasiswa aktif ${esc(detail.prodi_kode.toUpperCase())} angkatan ${esc(detail.angkatan)} semester ${esc(detail.semester)}, ditambah peserta tambahan — ditambahkan kaprodi, atau peserta yang sejak itu pindah semester/status sehingga tetap tercatat di kelas ini.</p>
      ${peserta.length ? `<div class="gulir"><table><thead><tr><th>NIM</th><th>Nama</th><th>Status</th><th>Sumber</th></tr></thead><tbody>
        ${peserta.map(p => `<tr><td>${esc(p.nim)}</td><td>${esc(p.nama)}</td><td>${esc(p.status)}</td><td>${p.sumber === 'tambahan' ? 'tambahan' : 'roster'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="redup">Belum ada peserta.</p>'}
    </div>`;
}

const JENIS = { manual: 'diisi pengajar', tugas: 'otomatis: rata-rata tugas', kuis: 'otomatis: rata-rata kuis' };

function barisBobot(b = { kunci: '', nama: '', jenis: 'manual', bobot: 0 }) {
  return `<tr class="baris-bobot" data-kunci="${escAttr(b.kunci)}">
    <td><input type="text" name="nama" value="${escAttr(b.nama)}" maxlength="60" aria-label="Nama komponen"></td>
    <td><select name="jenis" aria-label="Jenis">${Object.entries(JENIS).map(([k, l]) => `<option value="${k}"${k === b.jenis ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
    <td><input type="number" name="bobot" min="1" max="100" step="0.5" value="${escAttr(b.bobot)}" aria-label="Bobot"></td>
    <td><button type="button" class="sekunder" data-aksi="hapus-komponen" aria-label="Hapus komponen">×</button></td>
  </tr>`;
}

function kartuBobot() {
  const boleh = mengajar();
  const total = (detail.bobot || []).reduce((a, b) => a + b.bobot, 0);
  if (!boleh) {
    return `<div class="kartu"><h3>Komponen nilai</h3><ul class="daftar-ringkas">${(buku.komponen || []).map(k => `<li>${esc(k.nama)} <span class="kecil">${esc(angka(k.bobot))}% · ${esc(JENIS[k.jenis] || k.jenis)}</span></li>`).join('')}</ul></div>`;
  }
  return `<div class="kartu"><h3>Komponen dan Bobot Nilai</h3>
    <p class="meta">Jumlah bobot harus tepat 100. Komponen <b>tugas</b> dan <b>kuis</b> dihitung otomatis; komponen lain diisi di tabel buku nilai.</p>
    <div class="gulir"><table class="tabel-bobot"><thead><tr><th>Komponen</th><th>Jenis</th><th>Bobot (%)</th><th></th></tr></thead>
      <tbody id="isi-bobot">${(detail.bobot || []).map(barisBobot).join('')}</tbody></table></div>
    <p>Total: <span class="total-bobot" id="total-bobot">${esc(angka(total))}</span>%</p>
    <div class="cta-row"><button type="button" class="sekunder" data-aksi="tambah-komponen">+ Komponen</button><button type="button" data-aksi="simpan-bobot">Simpan Bobot</button></div>
    <div id="hasil-bobot"></div></div>`;
}

function tabNilai() {
  const komp = buku.komponen || [];
  if (detail.peran === 'peserta') {
    const b = (buku.baris || [])[0];
    if (!b) return '<div class="pesan info">Nilai Anda belum tersedia.</div>';
    return `<div class="kartu"><h3>Nilai Saya</h3>
      <div class="gulir"><table><thead><tr><th>Komponen</th><th class="num">Bobot</th><th class="num">Nilai</th></tr></thead><tbody>
      ${komp.map(k => `<tr><td>${esc(k.nama)} <span class="redup">(${esc(JENIS[k.jenis] || k.jenis)})</span></td><td class="num">${esc(angka(k.bobot))}%</td><td class="num">${esc(angka(b.komponen[k.kunci]))}</td></tr>`).join('')}
      </tbody></table></div>
      <p>${b.lengkap ? `Nilai akhir: <b>${esc(angka(b.nilai_akhir))}</b> (${esc(b.huruf)})` : `Nilai sementara: <b>${esc(angka(b.sementara))}</b> — nilai akhir muncul setelah semua komponen terisi.`}</p>
      ${(buku.tugas || []).length ? `<h4>Nilai per tugas</h4><ul class="daftar-ringkas">${buku.tugas.map(t => `<li>${esc(t.judul)}<span class="kecil">${esc(angka(b.tugas[t.id]))}</span></li>`).join('')}</ul>` : ''}
      <details class="cara-skor"><summary>Bagaimana nilai dihitung?</summary><ul>${(buku.catatan || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
    </div>`;
  }
  const bisaIsi = mengajar();
  const manual = komp.filter(k => k.jenis === 'manual');
  const baris = (buku.baris || []).map(b => `<tr data-nim="${escAttr(b.nim)}">
    <td>${esc(b.nim)}</td><td>${esc(b.nama)}</td>
    ${komp.map(k => k.jenis === 'manual' && bisaIsi
      ? `<td class="num"><input type="number" min="0" max="100" step="0.01" name="${escAttr(k.kunci)}" value="${b.komponen[k.kunci] ?? ''}" aria-label="${escAttr(k.nama)} ${escAttr(b.nama)}"></td>`
      : `<td class="num">${esc(angka(b.komponen[k.kunci]))}</td>`).join('')}
    <td class="num">${esc(angka(b.sementara))}</td>
    <td class="num">${b.lengkap ? `<b>${esc(angka(b.nilai_akhir))}</b> ${esc(b.huruf)}` : '<span class="redup">belum lengkap</span>'}</td>
    ${bisaIsi && manual.length ? '<td><button type="button" class="sekunder" data-aksi="simpan-nilai">Simpan</button></td>' : ''}
  </tr>`).join('');
  const perTugas = (buku.tugas || []).length ? `<div class="kartu"><h3>Nilai per Tugas</h3>
    <p class="meta">Skala 0–100 (nilai ÷ nilai maksimal × 100). Hanya kiriman yang sudah dikembalikan yang dihitung.</p>
    <div class="gulir"><table class="buku-nilai"><thead><tr><th>NIM</th><th>Nama</th>${buku.tugas.map(t => `<th class="num">${esc(t.judul)}</th>`).join('')}</tr></thead><tbody>
    ${(buku.baris || []).map(b => `<tr><td>${esc(b.nim)}</td><td>${esc(b.nama)}</td>${buku.tugas.map(t => `<td class="num">${esc(angka(b.tugas[t.id]))}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>` : '';
  return kartuBobot() + `<div class="kartu"><h3>Buku Nilai</h3>
    <div id="hasil-nilai"></div>
    ${(buku.baris || []).length ? `<div class="gulir"><table class="buku-nilai"><thead><tr><th>NIM</th><th>Nama</th>
      ${komp.map(k => `<th class="num">${esc(k.nama)}<br><span class="redup">${esc(angka(k.bobot))}%</span></th>`).join('')}
      <th class="num">Sementara</th><th class="num">Akhir</th>${bisaIsi && manual.length ? '<th></th>' : ''}</tr></thead><tbody>${baris}</tbody></table></div>`
      : '<p class="redup">Belum ada peserta.</p>'}
    <details class="cara-skor"><summary>Bagaimana nilai dihitung?</summary><ul>${(buku.catatan || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
  </div>` + perTugas;
}

const TAB = [['beranda', 'Beranda'], ['tugas', 'Tugas Kelas'], ['anggota', 'Anggota'], ['nilai', 'Nilai']];
function tabAktif() {
  const h = location.hash.replace('#', '');
  return TAB.some(([k]) => k === h) ? h : 'beranda';
}

async function renderDetail() {
  const tab = tabAktif();
  let badan = '<p class="redup">Memuat…</p>';
  isi.innerHTML = `
    <div class="kartu kepala-kelas"><p class="meta">${esc(detail.prodi_nama || detail.prodi_kode.toUpperCase())} · ${esc(detail.periode)} · Anda: <span class="lencana">${esc(labelPeran[detail.peran] || detail.peran)}</span></p>
      <p class="meta">${detail.minggu_ini ? `Minggu ${esc(detail.minggu_ini)} dari ${esc(detail.jumlah_minggu)}` : ''} · ${esc(detail.jumlah_peserta)} peserta</p></div>
    <div class="tab-halaman" role="tablist" aria-label="Isi kelas">
      ${TAB.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-selected="${k === tab}" aria-controls="panel-kelas"${k === tab ? '' : ' tabindex="-1"'}>${l}</button>`).join('')}
    </div>
    <div id="panel-kelas" role="tabpanel" aria-labelledby="tab-${tab}">${badan}</div>`;
  try {
    if ((tab === 'beranda' || tab === 'tugas') && !isiKelas) isiKelas = await apiGet(`/api/kelas/${encodeURIComponent(idKelas)}/isi`);
    if (tab === 'beranda' && pengumuman === null) ({ pengumuman = [] } = await apiGet(`/api/kelas/${encodeURIComponent(idKelas)}/pengumuman`));
    if (tab === 'nilai' && !buku) buku = await apiGet(`/api/kelas/${encodeURIComponent(idKelas)}/nilai`);
    badan = { beranda: tabBeranda, tugas: tabTugasKelas, anggota: tabAnggota, nilai: tabNilai }[tab]();
  } catch (err) {
    badan = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
  const panel = document.getElementById('panel-kelas');
  panel.innerHTML = badan;
  panel.querySelectorAll('table').forEach(t => { if (!t.classList.contains('tabel-bobot') && !t.classList.contains('buku-nilai')) labelTabel(t); });
}

function hitungTotalBobot() {
  const total = [...document.querySelectorAll('#isi-bobot input[name=bobot]')].reduce((a, i) => a + (Number(i.value) || 0), 0);
  const el = document.getElementById('total-bobot');
  if (el) {
    el.textContent = angka(total);
    el.classList.toggle('salah', Math.abs(total - 100) > 1e-6);
  }
}

async function tampilDetail() {
  detail = await apiGet(`/api/kelas/${encodeURIComponent(idKelas)}`);
  setKepala(detail.nama, detail.mk_kode ? `Mata kuliah ${detail.mk_nama || detail.mk_kode}` : `Rumpun ${detail.rumpun_kode}${detail.rumpun_nama ? ` — ${detail.rumpun_nama}` : ''}`,
    `<a href="./">Beranda</a> / <a href="kelas.html">Kelas</a> / ${esc(detail.nama)}`);
  await renderDetail();

  isi.addEventListener('click', async (e) => {
    const tabBtn = e.target.closest('button[data-tab]');
    if (tabBtn) {
      history.replaceState(null, '', `#${tabBtn.dataset.tab}`);
      await renderDetail();
      document.getElementById(`tab-${tabBtn.dataset.tab}`).focus();
      return;
    }
    const b = e.target.closest('button[data-aksi]');
    if (!b) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'buka-tugas') {
      const kartu = document.getElementById('kartu-tugas-baru');
      kartu.hidden = false;
      kartu.querySelector('input[name=judul]').focus();
    } else if (aksi === 'hapus-pengumuman') {
      if (!window.confirm('Hapus pengumuman ini? Pesan yang sudah terkirim ke grup WhatsApp tidak ikut ditarik.')) return;
      try {
        await apiDeleteJson(`/api/kelas/${encodeURIComponent(idKelas)}/pengumuman/${encodeURIComponent(b.dataset.id)}`);
        pengumuman = null;
        await renderDetail();
      } catch (err) { pesan('hasil-pengumuman', 'gagal', esc(err.message)); }
    } else if (aksi === 'batal-tugas') {
      document.getElementById('kartu-tugas-baru').hidden = true;
    } else if (aksi === 'tambah-komponen') {
      document.getElementById('isi-bobot').insertAdjacentHTML('beforeend', barisBobot());
      hitungTotalBobot();
    } else if (aksi === 'hapus-komponen') {
      b.closest('tr').remove();
      hitungTotalBobot();
    } else if (aksi === 'simpan-bobot') {
      const bobot = [...document.querySelectorAll('#isi-bobot tr.baris-bobot')].map(tr => ({
        kunci: tr.dataset.kunci || '', nama: tr.querySelector('[name=nama]').value.trim(),
        jenis: tr.querySelector('[name=jenis]').value, bobot: Number(tr.querySelector('[name=bobot]').value) || 0,
      }));
      try {
        const r = await apiPutJson(`/api/kelas/${encodeURIComponent(idKelas)}/bobot`, { bobot });
        detail.bobot = r.bobot;
        buku = null;
        await renderDetail();
        pesan('hasil-nilai', 'sukses', 'Bobot tersimpan; buku nilai dihitung ulang.');
      } catch (err) { pesan('hasil-bobot', 'gagal', esc(err.message)); }
    } else if (aksi === 'simpan-nilai') {
      const tr = b.closest('tr[data-nim]');
      const komponen = {};
      tr.querySelectorAll('input[type=number]').forEach(i => { komponen[i.name] = i.value === '' ? null : Number(i.value); });
      b.disabled = true;
      try {
        await apiPutJson(`/api/kelas/${encodeURIComponent(idKelas)}/nilai/${encodeURIComponent(tr.dataset.nim)}`, { komponen });
        buku = await apiGet(`/api/kelas/${encodeURIComponent(idKelas)}/nilai`);
        await renderDetail();
        pesan('hasil-nilai', 'sukses', `Nilai ${esc(tr.dataset.nim)} tersimpan.`);
      } catch (err) { pesan('hasil-nilai', 'gagal', esc(err.message)); b.disabled = false; }
    }
  });
  isi.addEventListener('input', (e) => { if (e.target.closest('#isi-bobot')) hitungTotalBobot(); });
  isi.addEventListener('keydown', (e) => {
    if (!e.target.closest('.tab-halaman') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const i = TAB.findIndex(([k]) => k === tabAktif());
    const j = (i + (e.key === 'ArrowRight' ? 1 : TAB.length - 1)) % TAB.length;
    document.getElementById(`tab-${TAB[j][0]}`).click();
  });
  isi.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-pengumuman') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const tombol = e.target.querySelector('button');
    tombol.disabled = true;
    try {
      const r = await apiPostJson(`/api/kelas/${encodeURIComponent(idKelas)}/pengumuman`, { isi: fd.get('isi'), kirim_grup: fd.get('kirim_grup') === 'on' });
      pengumuman = null;
      await renderDetail();
      if (r.grup && r.grup !== 'terkirim') pesan('hasil-pengumuman', 'gagal', `Pengumuman terbit di halaman kelas. ${esc(r.grup)}`);
      else pesan('hasil-pengumuman', 'sukses', r.grup === 'terkirim' ? 'Pengumuman terbit dan terkirim ke grup WhatsApp kelas.' : 'Pengumuman terbit.');
    } catch (err) {
      pesan('hasil-pengumuman', 'gagal', esc(err.message));
      tombol.disabled = false;
    }
  });
  isi.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-tugas-baru') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const tombol = e.target.querySelector('button');
    tombol.disabled = true;
    try {
      const t = await apiPostJson(`/api/kelas/${encodeURIComponent(idKelas)}/tugas`, {
        judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '', minggu: Number(fd.get('minggu')) || 0,
        tenggat: fd.get('tenggat') || '', nilai_maks: Number(fd.get('nilai_maks')) || 100,
      });
      const berkas = document.getElementById('lampiran-baru');
      let catatan = '';
      if (berkas && berkas.files.length) {
        try {
          await apiPostBerkasToken(`/api/tugas/${encodeURIComponent(t.id)}/lampiran`, {}, 'lampiran-baru', 'berkas');
        } catch (err) { catatan = ` Tetapi lampirannya gagal diunggah: ${esc(err.message)} — unggah ulang dari halaman tugas.`; }
      }
      isiKelas = null;
      history.replaceState(null, '', '#tugas');
      await renderDetail();
      document.getElementById('panel-kelas').insertAdjacentHTML('afterbegin', `<div class="pesan ${catatan ? 'gagal' : 'sukses'}">Tugas "${esc(t.judul)}" ditugaskan ke ${esc(detail.jumlah_peserta)} peserta.${catatan}</div>`);
    } catch (err) {
      pesan('hasil-tugas-baru', 'gagal', esc(err.message));
      tombol.disabled = false;
    }
  });
}

// ======================= Mulai =======================

async function muat() {
  const saya = await sayaSekarang;
  if (!saya) {
    halamanUntuk(null, ['mahasiswa', 'dosen', 'kaprodi', 'admin'], { judul: 'Kelas' });
    return;
  }
  if (kelolaProdi) return tampilKelola(saya);
  if (idKelas) return tampilDetail();
  return tampilDaftar(saya);
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    await muat();
  } catch (err) {
    isi.innerHTML = err.status === 403 || err.status === 404
      ? keadaanKosong({ judul: 'Kelas tidak bisa dibuka', keterangan: err.message, aksi: { href: 'kelas.html', label: 'Kembali ke Kelas Saya' } })
      : `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
