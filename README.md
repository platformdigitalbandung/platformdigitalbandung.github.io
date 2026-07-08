# platformdigitalbandung.github.io — Portal Tugas ADB (frontend)

Frontend statis Portal Tugas Akademi Digital Bandung, deploy otomatis ke GitHub
Pages di **https://platform.digitalbdg.ac.id**.

- Backend: repo [`rlm`](https://github.com/platformdigitalbandung/rlm)
  (FastAPI), dijalankan di server lokal kampus dan diekspos lewat **cloudflared
  tunnel** di `https://rlm.ll.my.id`.
- Alamat backend bisa diganti tanpa deploy ulang lewat tautan "alamat backend"
  di footer (tersimpan di `localStorage`).

Halaman:
- `index.html` — daftar tugas (publik)
- `tugas.html?id=N` — form kirim jawaban mahasiswa (.txt/.docx/.pdf, maks 5 MB)
- `dosen.html` — login dosen (HTTP Basic), buat tugas, laporan kemiripan

Murni HTML/CSS/JS tanpa build step; push ke `main` = deploy.
