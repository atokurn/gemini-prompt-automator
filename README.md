# Gemini Prompt Automator

Ekstensi Chrome untuk otomatisasi input prompt dari file Excel ke Chat Gemini dengan interval waktu yang dapat dikonfigurasi.

## Fitur Utama

### 1. Input Prompt dari Excel
- Baca file .xlsx, ambil daftar prompt dari kolom tertentu
- Simpan file ke chrome.storage.local agar bisa di-load ulang nanti

### 2. Interval Waktu Otomatis
- Bisa diatur statis (misal 30 detik) atau acak dalam rentang tertentu (misal 10–60 detik)
- Timer tetap aktif meski tab ditutup

### 3. Perulangan Prompt
- Mode 1: Ulangi setiap baris N kali, lalu lanjut ke baris berikutnya
- Mode 2: Setelah semua baris selesai, mulai lagi dari awal
- Kombinasi mode 1 & 2 didukung

### 4. Visual Timer & State di UI
- Tampilkan countdown dan status eksekusi (idle, sending, waiting, error, done) di popup ekstensi

### 5. Auto Input ke Chat Gemini
- Eksekusi via content_script, masukkan prompt ke chat box Gemini
- Klik tombol "Send" otomatis

### 6. Eksekusi Background
- Gunakan background.js / service worker agar tetap berjalan saat pindah tab
- Komunikasi antara popup.js, background.js, dan content_script.js menggunakan chrome.runtime.sendMessage dan chrome.storage

### 7. Auto Download Gambar
- Jika Gemini merespons dengan gambar, deteksi elemen gambar dan unduh otomatis (jika autoDownload diaktifkan)
- Simpan nama file sesuai waktu atau isi prompt

### 8. Recent Errors dan Logging
- Tampilkan error terakhir di UI
- Simpan state transition log ke chrome.storage.local

### 9. Load/Save Konfigurasi
- Semua setting (interval, mode, file terakhir) disimpan otomatis dan bisa dimuat ulang saat ekstensi dibuka kembali

## Cara Menggunakan

### Instalasi

1. Buka Chrome dan navigasi ke `chrome://extensions/`
2. Aktifkan "Developer mode" (Mode Pengembang) di pojok kanan atas
3. Klik "Load unpacked" (Muat yang belum dikemas) dan pilih folder ekstensi ini
4. Ekstensi akan muncul di toolbar Chrome

### Penggunaan

1. Klik ikon ekstensi untuk membuka popup
2. Pilih file Excel (.xlsx) yang berisi daftar prompt (kolom pertama akan digunakan)
3. Atur pengaturan interval dan pengulangan sesuai kebutuhan
4. Klik tombol "Mulai" untuk memulai otomatisasi
5. Buka tab Gemini di Chrome (https://gemini.google.com)
6. Ekstensi akan otomatis mengirimkan prompt sesuai interval yang diatur

### Format File Excel

File Excel harus memiliki format sebagai berikut:
- Prompt harus berada di kolom pertama (kolom A)
- Setiap baris akan dianggap sebagai satu prompt terpisah
- Baris kosong akan dilewati

## Pengaturan

### Interval Waktu
- **Tipe Interval**: Pilih antara interval tetap atau acak
- **Interval Tetap**: Waktu tunggu dalam detik antara setiap prompt
- **Interval Acak**: Rentang waktu minimum dan maksimum dalam detik

### Pengulangan
- **Ulangi setiap prompt**: Berapa kali setiap prompt diulang sebelum pindah ke prompt berikutnya
- **Ulangi semua prompt**: Jika diaktifkan, akan mulai dari awal setelah semua prompt selesai

### Lainnya
- **Unduh gambar otomatis**: Jika diaktifkan, gambar yang muncul dalam respons Gemini akan diunduh secara otomatis

## Status Eksekusi

- **idle**: Ekstensi tidak aktif
- **sending**: Sedang mengirim prompt ke Gemini
- **waiting**: Menunggu interval waktu sebelum prompt berikutnya
- **error**: Terjadi kesalahan saat mengirim prompt
- **done**: Semua prompt telah selesai dieksekusi

## Troubleshooting

- Pastikan tab Gemini terbuka saat ekstensi berjalan
- Jika terjadi error, periksa tab Log untuk informasi lebih lanjut
- Jika ekstensi tidak berjalan dengan baik, coba muat ulang ekstensi atau restart browser

## Catatan

- Ekstensi ini hanya berfungsi pada situs https://gemini.google.com
- Penggunaan ekstensi ini harus sesuai dengan Syarat Layanan Google Gemini