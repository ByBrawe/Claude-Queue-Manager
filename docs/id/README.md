# Claude Queue Manager (QM) — Panduan pengguna

[🌐 Indonesian / Bahasa Indonesia](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM mengantrekan tugas di tab **Code** Claude Desktop atau Claude Code CLI. Setiap tugas dimulai sebagai giliran terpisah setelah giliran sebelumnya selesai, tanpa mengalihkan pekerjaan yang sedang berjalan.

## “lanjutkan”

`lanjutkan` adalah teks tugas biasa, bukan perintah khusus QM. Kata kunci `/qm` tetap berbahasa Inggris, tetapi isi tugas dapat ditulis dalam bahasa apa pun.

```text
/qm repeat 5 lanjutkan
```

## Instalasi

Pasang marketplace dan plugin dengan perintah berikut. Lalu buka sesi **Code** lokal baru atau jalankan `/reload-plugins`. Tab Chat biasa tidak didukung.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Memulai dengan aman

Jeda antrean, tambahkan tugas, periksa urutan lewat `/qm`, lalu lanjutkan.

```text
/qm pause
/qm batch Perbaiki pengujian yang gagal || Jalankan build || Ringkas perubahan
/qm
/qm resume
```

## Daftar perintah

| /qm | Daftar perintah |
| --- | --- |
| `/qm` | Buka panel antrean |
| `/qm add lanjutkan` | Tambah satu tugas |
| `/qm repeat 5 lanjutkan` | Ulangi tugas 1–200 kali |
| `/qm batch A \|\| B \|\| C` | Tambah beberapa tugas secara berurutan |
| `/qm front lanjutkan` | Taruh tugas di urutan pertama |
| `/qm pause  /qm resume` | Jeda / lanjutkan |
| `/qm mv 3 1` | Pindahkan tugas tertunda 3 ke posisi 1 |
| `/qm edit 2 lanjutkan` | Ubah tugas tertunda 2 |
| `/qm rm 2` | Hapus tugas tertunda 2 |
| `/qm undo` | Batalkan perubahan terakhir |
| `/qm clear` | Bersihkan hanya tugas tertunda |
| `/qm recover` | Pulihkan tugas setelah crash lalu jeda |
| `/qm help` | Tampilkan bantuan |

## Batas dan catatan

Maksimal **200 tugas per penambahan** dan **500 tugas tertunda**. Setiap tugas dapat memakai kuota model dan konteks; giliran baru tidak otomatis mengosongkan konteks 200K. Jangan ulangi 'lanjutkan' tanpa kondisi berhenti yang jelas. Balasan model tidak menjamin keberhasilan.

## Pemecahan masalah

Jika `/qm` tidak muncul, periksa plugin lalu buka sesi **Code** lokal baru. Nonaktifkan plugin antrean lain dan uji dua tugas pendek terlebih dahulu.

### ZIP

Ekstrak ZIP, simpan folder `Claude-Queue-Manager` di lokasi tetap, lalu jalankan:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Catatan: panduan ini diterjemahkan; antarmuka panel QM tetap berbahasa Inggris.
