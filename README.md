# PDB : Platform Digital Bandung

**LMS (Learning Management System) dengan arsitektur biaya-infrastruktur mendekati nol**,
dibangun di atas layanan gratis/nyaris-gratis dari GitHub, tanpa server, tanpa VM,
dan tanpa biaya storage/CDN tambahan.

Live di **https://platform.digitalbdg.ac.id** — deploy otomatis lewat GitHub Pages
setiap kali ada perubahan di branch `main`.

**Daftar isi:** [Ringkasan Untuk Investor](#ringkasan-untuk-investor) ·
[Arsitektur](#arsitektur) · [Stack Teknologi](#stack-teknologi) ·
[Status Saat Ini](#status-saat-ini) · [Roadmap](#roadmap)

## Ringkasan Untuk Investor

Model bisnis LMS konvensional terbebani biaya infrastruktur yang naik sejalan
jumlah pengguna: server aplikasi, storage file tugas/video, CDN, dan database
terkelola. PDB dirancang untuk **memutus korelasi itu** dengan memanfaatkan
layanan yang sudah gratis di skala kecil–menengah:

| Komponen              | Layanan yang dipakai                          | Biaya                    |
|-----------------------|------------------------------------------------|--------------------------|
| Hosting frontend + CDN| GitHub Pages                                    | Gratis                   |
| Kode & rilis backend  | GitHub (repo publik `apkflydev`)                | Gratis                   |
| Compute backend       | Fly.io (`apk.fly.dev`)                          | Gratis (free tier)       |
| Database              | MongoDB (Atlas free tier)                       | Gratis                   |
| Storage file/tugas    | GitHub **private repository** (via GHPAT)       | Gratis (kuota repo Git)  |
| Hosting video         | YouTube (unlisted/private)                      | Gratis                   |
| Domain                | `.ac.id` milik institusi                        | Sudah dimiliki           |

Hasilnya: biaya infrastruktur inti untuk menjalankan LMS ini **secara praktis
Rp0** sampai skala mulai menekan batas free tier masing-masing layanan —
titik di mana biaya baru mulai muncul jauh lebih tinggi dibanding menyewa
server/CDN/storage sejak awal. Ini memungkinkan margin yang lebih sehat dan
runway lebih panjang tanpa perlu putaran pendanaan besar hanya untuk
"menyalakan server".

## Arsitektur

PDB punya **dua kanal antarmuka** ke satu backend yang sama: website (Portal Tugas)
untuk penggunaan biasa, dan **Iteung** — bot WhatsApp platform ini — untuk pengguna
yang lebih suka menyelesaikan tugas tanpa buka browser sama sekali (*Task-Oriented
User Interface*: bukan chatbot ngobrol bebas, tapi kumpulan perintah spesifik per
tugas, seperti "buat tugas", "cek laporan", "kumpul jawaban").

```mermaid
flowchart LR
    W["Website — statis\nGitHub Pages\nVanilla JS ESM + CrootJS"]
    I["Iteung — bot WhatsApp\nTask-Oriented UI"]
    AU["WhatsAuth\nSSO nomor WhatsApp"]
    B["Backend — GoCroot (Golang)\nFly.io · apk.fly.dev"]
    C[("MongoDB\ndata")]
    D[["GitHub Private Repo\nstorage file · via GHPAT"]]
    E[["YouTube\nvideo private/unlisted"]]

    W -- "HTTPS / JSON" --> B
    I -- "webhook pesan masuk" --> B
    W -. "login via QR/magic-link" .-> AU
    AU -- "PASETO v4\n(identitas = nomor WA)" --> B
    B --> C
    B --> D
    B --> E
    B -. "balasan chat" .-> I
```

Tidak ada framework/bundler di frontend — murni ES Modules (`<script type="module">`)
yang di-import langsung oleh browser, sehingga tidak ada langkah build/CI yang
bisa gagal sebelum deploy, dan tidak ada dependency toolchain yang perlu di-maintain.

### Pipeline Iteung (WhatsApp)

Satu backend Go yang sama menangani pesan WhatsApp masuk lewat pipeline 4 tahap
(pola arsitektur AIteung — [aiteung.if.co.id](https://aiteung.if.co.id/) — yang
dipakai ulang di sini untuk Portal Tugas):

```mermaid
flowchart LR
    M["Pesan WhatsApp masuk"] --> A1["1. Auth Service\nvalidasi nomor via WhatsAuth"]
    A1 --> A2["2. Typo Normalization\nkoreksi ejaan/singkatan"]
    A2 --> A3["3. Module Routing\ncocokkan kata kunci → modul"]
    A3 --> A4["4. Response Generator\njalankan aksi, susun balasan"]
    A4 --> R["Balasan teks ke WhatsApp"]
```

1. **Auth Service** — nomor pengirim diverifikasi lewat WhatsAuth (lihat di bawah);
   untuk perintah dosen, nomor tsb juga dicek terhadap daftar dosen yang berwenang.
2. **Typo Normalization** — koreksi ejaan/singkatan umum sebelum kata kunci dicocokkan.
3. **Module Routing** — kata kunci (mis. "buat tugas", "kumpul tugas", "laporan
   kemiripan") diarahkan ke modul Portal Tugas yang sama dengan yang dipakai website
   (satu basis kode, satu sumber kebenaran data).
4. **Response Generator** — modul mengeksekusi aksi (Mongo, storage GitHub, mesin
   kemiripan) lalu menyusun balasan sebagai teks WhatsApp, bukan JSON.

### WhatsAuth — identitas lintas-produk

Login dosen di website tidak pakai akun/password baru yang terpisah, melainkan
**WhatsAuth**: bukti kepemilikan nomor WhatsApp lewat scan QR atau magic-link,
mekanisme SSO yang sama yang dipakai produk lain di ekosistem ini
([wa.my.id](https://wa.my.id/)). Token PASETO yang dihasilkan membawa nomor WA
sebagai identitas; nomor itu lalu dicocokkan ke daftar dosen berwenang di Mongo
sebelum boleh membuat tugas atau melihat laporan kemiripan. Password khusus tetap
disediakan sebagai jalur cadangan.

## Stack Teknologi

- **Frontend** — Vanilla JavaScript (ES Modules), tanpa framework/bundler.
  Library ringan: [CrootJS](https://jscroot.if.co.id/) ([croot.js.org](https://croot.js.org/)).
  Di-deploy otomatis sebagai static site oleh GitHub Pages.
- **Backend** — [GoCroot](https://github.com/platformdigitalbandung/apkflydev) (Golang),
  live di `apk.fly.dev`, dijalankan di Fly.io.
- **Database** — MongoDB.
- **Storage** — GitHub **private repository**, diakses backend lewat GitHub
  Personal Access Token (GHPAT). Menggantikan kebutuhan object storage
  berbayar (S3/GCS) untuk file tugas mahasiswa.
- **Video** — di-hosting sebagai video privat/unlisted di YouTube, menghindari
  biaya bandwidth streaming.
- **Autentikasi** — [PASETO](https://paseto.io/) v4 (public), alternatif token
  yang lebih aman dari JWT (tidak rentan terhadap kesalahan konfigurasi
  algoritma `alg`). Identitas dosen = **WhatsAuth** (nomor WhatsApp), bukan
  akun/password terpisah — lihat penjelasan di atas.
- **Iteung** — bot WhatsApp platform ini, antarmuka kedua di luar website untuk
  perintah bertarget-tugas (*Task-Oriented UI*), memakai basis kode & data yang
  sama dengan Portal Tugas — lihat [aiteung.if.co.id](https://aiteung.if.co.id/).

## Status Saat Ini

Modul yang sudah berjalan: **Portal Tugas** — mahasiswa mengumpulkan tugas,
dosen membuat tugas lewat Halaman Dosen, dilengkapi pemeriksaan kemiripan
(similarity check) antar-kiriman sebagai alat bantu deteksi indikasi plagiasi
(keputusan akhir tetap di tangan dosen, bukan otomatis divonis oleh sistem).
Backend Go/MongoDB/PASETO/storage-GitHub sudah ditulis dan lolos build,
menunggu provisioning secret sebelum deploy ke Fly.io.

**Sedang dibangun**: integrasi WhatsAuth (login dosen via nomor WhatsApp,
menggantikan password sebagai jalur utama) dan Iteung (antarmuka WhatsApp
Task-Oriented UI untuk dosen & mahasiswa) — lihat [Arsitektur](#arsitektur).

## Roadmap

- Migrasi alamat backend dari tunnel sementara (Cloudflare Quick Tunnel) ke
  domain permanen di bawah `digitalbdg.ac.id`.
- WhatsAuth + Iteung (lihat di atas) — sedang berjalan.
- Modul materi kuliah & presensi.
- Modul nilai & rapor digital.
