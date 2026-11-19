# Changelog

## Unreleased
- Email guard & login guard (mode belajar), halaman lab skenario dummy, rotasi profil proxy, pengerasan konfigurasi lokasi palsu (nonce), validasi host proxy lebih ketat.
- Perbaikan: form tidak lagi diblokir saat pengaturan email guard belum/gagal dimuat.

## 1.3.0
- Pengelola proxy (ganti IP): profil HTTP/HTTPS/SOCKS, mode semua situs / situs tertentu, fail-closed, pembatasan WebRTC, login proxy, cek IP, dan "samakan lokasi palsu dengan lokasi IP".

## 1.2.0
- Lokasi palsu: pilih tempat sendiri (cari nama, koordinat manual, preset); menimpa `navigator.geolocation` dan `permissions.query`; aman by default (ditolak jika belum ada tempat terpilih).

## 1.1.0
- Stub skrip iklan/pelacak lewat redirect `declarativeNetRequest`.
- Filter kosmetik tersamar (tidak menyentuh elemen umpan anti-adblock).
- Element picker untuk menyembunyikan overlay / dinding anti-adblock.

## 1.0.0
- Ad & tracker blocker (`declarativeNetRequest`), deteksi phishing/malware, popup & halaman pengaturan.
