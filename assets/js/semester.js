import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, isLoggedIn, arahkanKeLogin } from './api.js';
import { sayaSekarang, punyaPeran } from './akun.js';
import { esc, halamanUntuk, keadaanKosong, labelTabel } from './ui.js';

// Siapkan Semester (kaprodi) — keputusan developer Arfan 2026-09-26: satu
// halaman untuk persiapan semester prodi, menggantikan Kelola Kelas
// (kelas.html?kelola=, kini dialihkan ke sini) dan menu Kalender prodi.
// Urutannya: kurikulum lengkap → kalender terbit (kelas dibuat otomatis) →
// pengajar tiap kelas dari semua dosen aktif → peserta diperiksa.
//   semester.html?prodi=<kode>   kaprodi prodi itu mengubah; admin hanya membaca
// Draft kalender dan sesinya tetap disusun di kalender.html (tautan di langkah 2).

const isi = document.getElementById('isi');
const paramProdi = (new URLSearchParams(location.search).get('prodi') || '').toLowerCase();

function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
function tanggal(iso) {
  const d = new Date(iso);
  if (isNaN(d) || d.getFullYear() < 2000) return '';
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });
}
function pesan(jenis, teks) {
  const el = document.getElementById('pesan-kelola');
  if (el) el.innerHTML = teks ? `<div class="pesan ${jenis}">${teks}</div>` : '';
}
function setKepala(judul, sub, remah) {
  document.getElementById('judul-kelas').textContent = judul;
  document.getElementById('sub-kelas').textContent = sub;
  document.getElementById('remah').innerHTML = remah;
  document.title = `${judul} — Platform Digital Bandung`;
}
const namaPengajar = (k) => (k.pengajar_orang || []).map(p => p.nama).join(', ');

let prodi = '';
let boleh = false;
// kelas & kalender terbit: GET /api/kelas?prodi=; kalenderSemua (termasuk
// draft): GET /api/kalender?prodi=&draft=1; kurikulum: butir agenda kaprodi.
let data = { kelas: [], kalender: [], kalenderSemua: [], pilihan: [], kurikulum: undefined };

async function muat() {
  const [daftar, semua, pilihan, agenda] = await Promise.all([
    apiGet(`/api/kelas?prodi=${encodeURIComponent(prodi)}`),
    apiGet(`/api/kalender?prodi=${encodeURIComponent(prodi)}&draft=1`).catch(() => ({ kalender: [] })),
    boleh ? apiGet(`/api/kelas/pilihan-pengajar?prodi=${encodeURIComponent(prodi)}`).catch(() => ({ dosen: [] })) : Promise.resolve({ dosen: [] }),
    boleh ? apiGet('/api/beranda/agenda').catch(() => null) : Promise.resolve(null),
  ]);
  data.kelas = daftar.kelas || [];
  data.kalender = daftar.kalender || [];
  data.kalenderSemua = (semua.kalender || []).filter(k => k.prodi_kode === prodi)
    .sort((a, b) => new Date(b.tanggal_mulai) - new Date(a.tanggal_mulai));
  data.pilihan = pilihan.dosen || [];
  // undefined = tidak diketahui (admin, atau agenda gagal dimuat); null = lengkap.
  data.kurikulum = agenda ? ((agenda.kaprodi || []).find(b => b.jenis === 'kurikulum_belum_lengkap' && (!b.prodi_kode || b.prodi_kode === prodi)) || null) : undefined;
}

// ======================= Langkah =======================

function langkah() {
  const { kelas, kalenderSemua, kurikulum } = data;
  const terbit = kalenderSemua.filter(k => k.diterbitkan).length;
  const draf = kalenderSemua.length - terbit;
  const tanpaPengajar = kelas.filter(k => !(k.pengajar || []).length).length;
  const tanpaPeserta = kelas.filter(k => !k.jumlah_peserta).length;
  const butir = [
    {
      judul: 'Kurikulum lengkap', href: 'kurikulum.html', label: 'Buka kurikulum',
      selesai: kurikulum === undefined ? null : !kurikulum,
      status: kurikulum === undefined ? 'Rumpun, mata kuliah, CPL, dan ritme mingguan diisi di halaman Kurikulum.'
        : kurikulum ? kurikulum.keterangan : 'Kurikulum lengkap.',
    },
    {
      judul: 'Kalender semester terbit', href: '#kalender', label: 'Ke kalender',
      selesai: terbit > 0,
      status: terbit ? `${terbit} kalender terbit${draf ? `, ${draf} draft menunggu diterbitkan` : ''}.`
        : draf ? `${draf} draft menunggu diterbitkan.` : 'Belum ada kalender semester.',
    },
    {
      judul: 'Pengajar tiap kelas', href: '#kelas', label: 'Ke kelas',
      selesai: kelas.length > 0 && !tanpaPengajar,
      status: !kelas.length ? 'Kelas dibuka otomatis setelah kalender terbit.'
        : tanpaPengajar ? `${tanpaPengajar} dari ${kelas.length} kelas belum punya pengajar.` : `Semua ${kelas.length} kelas punya pengajar.`,
    },
    {
      judul: 'Peserta tiap kelas', href: '#peserta', label: 'Ke peserta',
      selesai: kelas.length > 0 && !tanpaPeserta,
      status: !kelas.length ? 'Menunggu kelas dibuka.'
        : tanpaPeserta ? `${tanpaPeserta} kelas belum punya peserta.` : `Semua ${kelas.length} kelas punya peserta.`,
    },
  ];
  const sekarang = butir.findIndex(b => b.selesai === false);
  return `<div class="kartu"><h3>Langkah semester ${esc(prodi.toUpperCase())}</h3>
    <ol class="langkah-semester">${butir.map((b, i) => {
      const tanda = b.selesai === true ? ['rendah', 'selesai'] : i === sekarang ? ['sedang', 'langkah berikutnya'] : b.selesai === false ? ['', 'belum'] : ['', 'periksa'];
      return `<li class="${b.selesai === true ? 'selesai' : i === sekarang ? 'sekarang' : ''}">
        <div><b>${esc(b.judul)}</b> <span class="lencana ${tanda[0]}">${esc(tanda[1])}</span></div>
        <div class="meta">${esc(b.status)} <a href="${escAttr(b.href)}">${esc(b.label)}</a></div></li>`;
    }).join('')}</ol></div>`;
}

// ======================= 2. Kalender =======================

function kartuKalender() {
  const { kalenderSemua, kelas } = data;
  const baris = kalenderSemua.map(k => {
    const n = kelas.filter(x => x.kalender_id === k.id).length;
    const aksi = k.diterbitkan
      ? `<span class="redup">${n} kelas</span>`
      : `<div class="aksi-sel"><a class="aksi sekunder" href="kalender.html?prodi=${encodeURIComponent(prodi)}">Periksa sesi</a>${boleh ? `<button type="button" data-aksi="terbitkan" data-id="${escAttr(k.id)}">Terbitkan</button>` : ''}</div>`;
    return `<tr><td>${esc(k.angkatan)}</td><td class="num">${esc(k.semester)}</td><td>${esc(tanggal(k.tanggal_mulai))}</td>
      <td class="num">${esc(new Set((k.sesi || []).map(s => s.minggu)).size)}</td>
      <td>${k.diterbitkan ? '<span class="lencana rendah">terbit</span>' : '<span class="lencana sedang">draft</span>'}</td><td>${aksi}</td></tr>`;
  }).join('');
  return `<h2 class="judul-periode" id="kalender">2. Kalender semester</h2>
    <div class="kartu">
      <p class="meta">Draft kalender dibuat dari ritme mingguan prodi dan sesinya diperiksa di halaman Kalender. Setelah <b>Terbitkan</b>, jadwal terlihat mahasiswa dan dosen, dan kelas semester itu dibuka otomatis. Kalender yang sudah terbit tidak bisa disunting lagi.</p>
      ${kalenderSemua.length ? `<div class="gulir"><table>
        <thead><tr><th>Angkatan</th><th class="num">Semester</th><th>Mulai</th><th class="num">Minggu</th><th>Status</th><th></th></tr></thead>
        <tbody>${baris}</tbody></table></div>` : '<div class="kosong">Belum ada kalender semester untuk prodi ini.</div>'}
      ${boleh ? `<p class="cta-row"><a class="aksi sekunder" href="kalender.html?prodi=${encodeURIComponent(prodi)}">Buat draft kalender</a></p>` : ''}
    </div>`;
}

// ======================= 3. Kelas dan pengajar =======================

// Pilihan pengajar: semua dosen aktif yang sudah mengisi email kampus (sejak
// 2026-09-26 tanpa centang pengampu). Yang sudah terpilih di atas; kolom cari
// menyaring daftar yang panjang.
function opsiPengajar(terpilih) {
  if (!data.pilihan.length) {
    return '<p class="redup">Belum ada dosen aktif yang mengisi email kampus. Dosen mengisinya sendiri di halaman Roster &amp; Email Dosen.</p>';
  }
  const urut = [...data.pilihan].sort((a, b) => Number(terpilih.includes(b.email)) - Number(terpilih.includes(a.email)));
  return `<input type="search" class="cari-pengajar" placeholder="Cari nama atau email dosen…" aria-label="Cari dosen">
    <div class="pilih-pengajar">${urut.map(d => `<label data-cari="${escAttr(`${d.nama || ''} ${d.email}`.toLowerCase())}"><input type="checkbox" name="pengajar" value="${escAttr(d.email)}"${terpilih.includes(d.email) ? ' checked' : ''}>${esc(d.nama || d.email)} <span class="redup">&nbsp;${esc(d.email)}</span></label>`).join('')}</div>`;
}

function lencanaPeserta(k) {
  return k.jumlah_peserta ? `${esc(k.jumlah_peserta)} peserta` : '<span class="lencana tinggi">0 peserta</span>';
}

// Jumlah minggu kalender (minggu sesi terbesar), untuk batas rentang blok.
function jumlahMinggu(kalenderId) {
  const kal = data.kalenderSemua.find(k => k.id === kalenderId);
  return kal ? Math.max(0, ...(kal.sesi || []).map(s => s.minggu)) : 0;
}

function teksBlok(k) {
  return k.minggu_mulai ? `minggu ${k.minggu_mulai}–${k.minggu_selesai}` : 'seluruh semester';
}

// Sistem blok (2026-09-26): rumpun berurutan, mis. R1 minggu 1–8 lalu R2
// minggu 9–16. Kosong = seluruh minggu kalender.
function isianBlok(k) {
  const maks = jumlahMinggu(k.kalender_id) || 52;
  return `<div class="isian-blok"><span>Minggu</span>
      <input type="number" name="minggu_mulai" min="1" max="${maks}" value="${k.minggu_mulai || ''}" aria-label="Minggu mulai" placeholder="1">
      <span>sampai</span>
      <input type="number" name="minggu_selesai" min="1" max="${maks}" value="${k.minggu_selesai || ''}" aria-label="Minggu selesai" placeholder="${maks}"></div>`;
}

function formKelas(k) {
  if (!boleh) {
    return `<tr><td><a href="kelas.html?id=${encodeURIComponent(k.id)}">${esc(k.nama)}</a><p class="redup">${esc(teksBlok(k))}</p></td><td>${esc(namaPengajar(k) || '—')}</td><td>${lencanaPeserta(k)}</td><td></td></tr>`;
  }
  return `<tr data-id="${escAttr(k.id)}">
    <td><input name="nama" maxlength="120" value="${escAttr(k.nama)}" aria-label="Nama kelas">
      <p class="redup">${k.mk_kode ? `Mata kuliah ${esc(k.mk_kode)}` : `Rumpun ${esc(k.rumpun_kode)}`} · <a href="kelas.html?id=${encodeURIComponent(k.id)}">Buka kelas</a></p>
      ${isianBlok(k)}</td>
    <td>${(k.pengajar || []).length ? '' : '<p><span class="lencana sedang">belum ada pengajar</span></p>'}${opsiPengajar(k.pengajar || [])}</td>
    <td><label>Peserta tambahan (NIM, pisahkan koma) <input name="tambahan" value="${escAttr((k.peserta_tambahan || []).join(', '))}"></label>
      <label>Dikeluarkan dari kelas (NIM) <input name="keluar" value="${escAttr((k.peserta_keluar || []).join(', '))}"></label>
      <p class="redup">${lencanaPeserta(k)}</p></td>
    <td><div class="aksi-sel"><button type="button" data-aksi="simpan-kelas">Simpan</button>
      <button type="button" class="bahaya" data-aksi="hapus-kelas">Hapus</button></div></td>
  </tr>`;
}

function bagianKelas() {
  const { kelas, kalender } = data;
  const perKal = kalender.map(kal => {
    const ks = kelas.filter(k => k.kalender_id === kal.id);
    return `<div class="kartu">
      <h3>Angkatan ${esc(kal.angkatan)} · semester ${esc(kal.semester)} <span class="redup">· ${esc(kal.periode)}</span></h3>
      ${boleh ? `<p class="cta-row"><button type="button" class="sekunder" data-aksi="otomatis" data-kalender="${escAttr(kal.id)}">Buat kelas yang belum ada</button></p>` : ''}
      ${ks.length ? `<div class="gulir"><table class="tabel-kelola">
        <thead><tr><th>Kelas</th><th>Pengajar</th><th>Peserta</th><th></th></tr></thead>
        <tbody>${ks.map(formKelas).join('')}</tbody></table></div>`
      : '<div class="kosong">Belum ada kelas untuk kalender ini.</div>'}
    </div>`;
  }).join('');
  return `<h2 class="judul-periode" id="kelas">3. Kelas dan pengajar</h2>
    <p class="meta">Kelas dibuka otomatis saat kalender terbit: satu per rumpun berproyek, atau per mata kuliah untuk rumpun mata kuliah lepas. Pilih pengajarnya dari semua dosen aktif (ketik di kolom cari untuk menyaring), lalu <b>Simpan</b> di baris kelas itu. Dosen yang ditunjuk otomatis tercatat mengajar di prodi ini.</p>
    <p class="meta"><b>Sistem blok:</b> bila rumpun berjalan berurutan (mis. rumpun pertama minggu 1–8, kedua minggu 9–16), isi <b>Minggu … sampai …</b> di baris kelasnya. Kosongkan keduanya untuk kelas yang berjalan sepanjang semester, mis. jalur kontinu.</p>
    ${kalender.length ? perKal : keadaanKosong({
      judul: `Belum ada kalender terbit untuk ${prodi.toUpperCase()}`,
      keterangan: 'Kelas dibuka per kalender semester yang sudah diterbitkan. Terbitkan kalender di langkah 2; kelasnya dibuat otomatis.',
      siapa: `kaprodi ${prodi.toUpperCase()}`,
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
}

// ======================= 4. Peserta =======================

function bagianPeserta() {
  const { kelas, kalender } = data;
  if (!kelas.length) return '';
  const kosong = kelas.filter(k => !k.jumlah_peserta);
  const namaKal = (id) => {
    const kal = kalender.find(k => k.id === id);
    return kal ? `angkatan ${kal.angkatan} · semester ${kal.semester}` : '';
  };
  return `<h2 class="judul-periode" id="peserta">4. Cek peserta</h2>
    <div class="kartu">
      <p class="meta">Peserta kelas otomatis mahasiswa roster berstatus aktif dengan prodi, angkatan, dan semester kalender kelas itu. Mahasiswa di luar itu ditambahkan lewat <b>Peserta tambahan</b> di baris kelasnya; yang tidak ikut dikeluarkan lewat <b>Dikeluarkan dari kelas</b>.</p>
      ${kosong.length ? `<div class="pesan gagal">${kosong.length} kelas belum punya peserta — biasanya roster angkatan dan semester itu belum diisi, atau semester mahasiswanya belum dinaikkan.</div>
        <ul class="daftar-ringkas">${kosong.map(k => `<li>${esc(k.nama)}<span class="kecil">${esc(namaKal(k.kalender_id))}</span></li>`).join('')}</ul>
        ${boleh ? '<p class="cta-row"><a class="aksi sekunder" href="pengguna.html#mahasiswa">Periksa roster mahasiswa</a></p>' : ''}`
      : `<p>Semua ${kelas.length} kelas punya peserta.</p>`}
    </div>`;
}

// ======================= Render & aksi =======================

function render(pesanAwal = '') {
  isi.innerHTML = `<div id="pesan-kelola">${pesanAwal}</div>${langkah()}${kartuKalender()}${bagianKelas()}${bagianPeserta()}`;
  isi.querySelectorAll('table').forEach(t => labelTabel(t));
  isiPilihanTambah();
}

async function isiPilihanTambah() {
  const selR = document.getElementById('tambah-rumpun');
  if (!selR) return;
  try {
    const { rumpun = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(prodi)}/rumpun`);
    selR.innerHTML = (rumpun || []).map(r => `<option value="${escAttr(r.kode)}" data-proyek="${r.proyek_pengikat ? '1' : ''}">${esc(r.kode)} — ${esc(r.nama)} (smt ${esc(r.semester)})${r.proyek_pengikat ? '' : ' · mata kuliah lepas'}</option>`).join('');
    const isiMK = async () => {
      const selMK = document.getElementById('tambah-mk');
      const { matakuliah = [] } = await apiGet(`/api/kurikulum/prodi/${encodeURIComponent(prodi)}/matakuliah?rumpun=${encodeURIComponent(selR.value)}`);
      selMK.innerHTML = '<option value="">(seluruh rumpun)</option>' + (matakuliah || []).map(m => `<option value="${escAttr(m.kode)}">${esc(m.nama)}</option>`).join('');
    };
    selR.addEventListener('change', isiMK);
    await isiMK();
  } catch (err) { pesan('gagal', `Pilihan rumpun tidak termuat: ${esc(err.message)}`); }
}

async function segarkan(teks) {
  await muat();
  render(teks ? `<div class="pesan sukses">${teks}</div>` : '');
}

function pasangAksi() {
  isi.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-aksi]');
    if (!b || !boleh) return;
    const aksi = b.dataset.aksi;
    if (aksi === 'terbitkan') {
      const kal = data.kalenderSemua.find(k => k.id === b.dataset.id);
      if (!window.confirm(`Terbitkan kalender angkatan ${kal ? kal.angkatan : ''} semester ${kal ? kal.semester : ''}? Setelah terbit sesinya tidak bisa disunting, jadwal terlihat mahasiswa dan dosen, dan kelasnya dibuka otomatis.`)) return;
      b.disabled = true;
      try {
        await apiPostJson(`/api/kalender/${encodeURIComponent(b.dataset.id)}/terbitkan`, {});
        const sebelum = data.kelas.length;
        await muat();
        render(`<div class="pesan sukses">Kalender terbit. ${data.kelas.length - sebelum} kelas dibuka otomatis — tunjuk pengajarnya di langkah 3.</div>`);
      } catch (err) { pesan('gagal', `Gagal menerbitkan: ${esc(err.message)}`); b.disabled = false; }
      return;
    }
    if (aksi === 'otomatis') {
      b.disabled = true;
      try {
        const r = await apiPostJson('/api/kelas/otomatis', { kalender_id: b.dataset.kalender });
        await segarkan(r.dibuat ? `${esc(r.dibuat)} kelas baru dibuat.` : 'Semua kelas kalender ini sudah ada.');
      } catch (err) { pesan('gagal', esc(err.message)); b.disabled = false; }
      return;
    }
    const tr = b.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.dataset.id;
    const k = data.kelas.find(x => x.id === id);
    if (aksi === 'simpan-kelas') {
      const pisah = (s) => String(s || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const body = {
        nama: tr.querySelector('input[name=nama]').value,
        // Kosong keduanya = seluruh semester (0 dan 0 menghapus rentang).
        minggu_mulai: Number(tr.querySelector('input[name=minggu_mulai]').value) || 0,
        minggu_selesai: Number(tr.querySelector('input[name=minggu_selesai]').value) || 0,
        pengajar: [...tr.querySelectorAll('input[name=pengajar]:checked')].map(c => c.value),
        peserta_tambahan: pisah(tr.querySelector('input[name=tambahan]').value),
        peserta_keluar: pisah(tr.querySelector('input[name=keluar]').value),
      };
      b.disabled = true;
      try {
        await apiPutJson(`/api/kelas/${encodeURIComponent(id)}`, body);
        await segarkan(`Kelas ${esc(body.nama)} tersimpan.`);
      } catch (err) { pesan('gagal', `Gagal menyimpan ${esc(k ? k.nama : '')}: ${esc(err.message)}`); b.disabled = false; }
    } else if (aksi === 'hapus-kelas') {
      if (!window.confirm(`Hapus kelas ${k ? k.nama : ''}?`)) return;
      try {
        await apiDeleteJson(`/api/kelas/${encodeURIComponent(id)}`);
      } catch (err) {
        if (err.status !== 422 || !window.confirm(`${err.message}\n\nTetap hapus kelas ini?`)) {
          if (err.status !== 422) pesan('gagal', esc(err.message));
          return;
        }
        try { await apiDeleteJson(`/api/kelas/${encodeURIComponent(id)}?konfirmasi=hapus`); } catch (e2) { pesan('gagal', esc(e2.message)); return; }
      }
      await segarkan('Kelas dihapus. Tombol "Buat kelas yang belum ada" membuatnya lagi bila perlu.');
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
      await segarkan(`Kelas ${esc(k.nama)} dibuka.`);
    } catch (err) { pesan('gagal', esc(err.message)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

// ======================= Mulai =======================

async function mulai() {
  const saya = await sayaSekarang;
  if (!halamanUntuk(saya, ['kaprodi', 'admin'], { judul: 'Siapkan Semester', pesan: 'Semester prodi disiapkan kaprodinya.', wadah: isi })) return;
  const admin = punyaPeran(saya, 'admin');
  const dipimpin = punyaPeran(saya, 'kaprodi') ? (saya.kaprodi_prodi || []).map(p => p.toLowerCase()) : [];
  prodi = paramProdi || dipimpin[0] || '';
  if (!prodi) {
    // Admin tanpa prodi yang dipimpin: pilih prodi untuk dilihat.
    const { prodi: semua = [] } = await apiGet('/api/kurikulum/prodi');
    isi.innerHTML = `<div class="kartu"><h3>Pilih program studi</h3>
      <p class="meta">Admin melihat persiapan semester semua prodi tanpa mengubahnya; semester disiapkan kaprodi masing-masing.</p>
      <p class="cta-row">${(semua || []).map(p => `<a class="aksi sekunder" href="semester.html?prodi=${encodeURIComponent(p.kode)}">${esc(p.nama)}</a>`).join('')}</p></div>`;
    return;
  }
  boleh = dipimpin.includes(prodi);
  if (!boleh && !admin) {
    isi.innerHTML = '<div class="pesan gagal">Kaprodi hanya menyiapkan semester prodinya sendiri.</div>';
    return;
  }
  const lain = dipimpin.filter(p => p !== prodi);
  setKepala(`Siapkan Semester ${prodi.toUpperCase()}`,
    boleh ? 'Kalender, kelas, pengajar, dan peserta prodi dalam satu halaman' : 'Persiapan semester prodi ini (hanya baca untuk admin)',
    `<a href="./">Beranda</a> / Siapkan Semester ${esc(prodi.toUpperCase())}${lain.length ? ` · ${lain.map(p => `<a href="semester.html?prodi=${encodeURIComponent(p)}">${esc(p.toUpperCase())}</a>`).join(' · ')}` : ''}`);
  await muat();
  render();
  pasangAksi();
  if (location.hash) {
    const tujuan = document.getElementById(location.hash.slice(1));
    if (tujuan) tujuan.scrollIntoView();
  }
}

if (!isLoggedIn()) {
  arahkanKeLogin();
} else {
  try {
    await mulai();
  } catch (err) {
    isi.innerHTML = `<div class="pesan gagal">${esc(err.message)}</div>`;
  }
}
