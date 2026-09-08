# PDB : Platform Digital Bandung

**LMS (Learning Management System) dengan arsitektur biaya-infrastruktur mendekati nol**,
dibangun di atas layanan gratis/nyaris-gratis dari GitHub, tanpa server, tanpa VM,
dan tanpa biaya storage/CDN tambahan.

Live di **https://platform.digitalbdg.ac.id** — deploy otomatis lewat GitHub Pages
setiap kali ada perubahan di branch `main`.

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

```
┌─────────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│  Frontend (statis)      │ ────────────────────────▶ │  Backend (GoCroot)       │
│  GitHub Pages           │                            │  Golang, hosted di      │
│  Vanilla JS ESM +       │ ◀──────────────────────── │  Fly.io (apk.fly.dev)   │
│  CrootJS (jscroot)      │                            └───────────┬──────────────┘
└─────────────────────────┘                                        │
                                                    ┌────────────────┼────────────────┐
                                                    ▼                ▼                ▼
                                          ┌──────────────┐  ┌────────────────┐ ┌────────────┐
                                          │  MongoDB     │  │ GitHub Private │ │  YouTube   │
                                          │  (data)      │  │ Repo (storage  │ │  (video    │
                                          │              │  │ file, via GHPAT│ │  private)  │
                                          └──────────────┘  └────────────────┘ └────────────┘
```

Tidak ada framework/bundler di frontend — murni ES Modules (`<script type="module">`)
yang di-import langsung oleh browser, sehingga tidak ada langkah build/CI yang
bisa gagal sebelum deploy, dan tidak ada dependency toolchain yang perlu di-maintain.

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
  algoritma `alg`).

## Status Saat Ini

Modul yang sudah berjalan: **Portal Tugas** — mahasiswa mengumpulkan tugas,
dosen membuat tugas lewat Halaman Dosen, dilengkapi pemeriksaan kemiripan
(similarity check) antar-kiriman sebagai alat bantu deteksi indikasi plagiasi
(keputusan akhir tetap di tangan dosen, bukan otomatis divonis oleh sistem).

## Roadmap

- Migrasi alamat backend dari tunnel sementara (Cloudflare Quick Tunnel) ke
  domain permanen di bawah `digitalbdg.ac.id`.
- Modul materi kuliah & presensi.
- Modul nilai & rapor digital.
- Perluasan autentikasi untuk peran mahasiswa (saat ini autentikasi
  Basic+PASETO baru dipakai penuh di sisi dosen).
