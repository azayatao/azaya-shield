# Kebijakan Keamanan

## Versi yang didukung

| Versi | Didukung |
| ----- | -------- |
| 1.3.x | ✅ |
| < 1.3 | ❌ |

## Melaporkan kerentanan

Jangan buka issue publik untuk masalah keamanan. Gunakan **Security → Report a vulnerability** di repo ini (laporan privat lewat GitHub).

Sertakan: versi ekstensi, versi browser, langkah untuk mereproduksi, dan dampaknya. Ini proyek pribadi, jadi balasan dilakukan sebisanya tanpa jaminan waktu.

## Yang termasuk

- Lokasi atau IP asli bocor padahal lokasi palsu atau proxy aktif
- Skrip situs bisa menyuntik konfigurasi atau membaca data ekstensi
- Kredensial proxy atau pengaturan terbaca pihak lain
- XSS atau eksekusi kode di halaman ekstensi (popup, pengaturan, peringatan, lab)
- Guard email atau login yang bisa dilewati lewat form biasa

## Yang tidak termasuk

- Situs yang tetap mendeteksi ad blocker atau lolos dari stub
- Deteksi lewat fingerprint browser, cookie, atau sesi login
- Pengiriman form lewat `fetch`/XHR yang tidak ditangkap guard (batasan yang sudah didokumentasikan)
- Keamanan server proxy pihak ketiga
