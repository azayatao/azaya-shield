# Azaya Shield — Anti Phishing & Ad Block

Extension Manifest V3 untuk Chrome, Edge, Brave, dan Opera (versi 111+).

## Cara pasang (mode developer)

1. Ekstrak zip ini ke sebuah folder (jangan dihapus setelah dipasang).
2. Buka `chrome://extensions` (Edge: `edge://extensions`).
3. Nyalakan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked** → pilih folder `azaya-shield` (yang berisi `manifest.json`).
5. Pin ikon perisai di toolbar supaya popup-nya gampang dibuka.

## Fitur

**Mode belajar — lindungi email**
- Simpan alamat yang ingin dijaga di Pengaturan. Saat aktif, submit form biasa yang memuat alamat tersebut dicegah dan memerlukan konfirmasi satu kali sebelum diteruskan.
- Guard login dapat dibatasi ke domain pilihan; submit form yang memiliki kolom password dibatalkan, dengan opsi tutup tab atau izinkan sekali. Ini tidak menghapus cookie atau mengeluarkan akun dari sesi situs.
- Batasan: guard hanya menangkap event `submit` bawaan form. Pengiriman lewat `fetch`/XHR (situs SPA) atau `form.submit()` dari skrip tidak tertangkap. Kalau pengaturan belum sempat termuat, form dibiarkan lewat (tidak diblokir).
- Pencocokan dilakukan lokal. Ini bukan anonimisasi: sesi login, cookie, IP, fingerprint, atau pengiriman lewat JavaScript khusus tetap dapat mengidentifikasi akun.

**Ad blocker**
- Memblokir request ke ±80 domain jaringan iklan dan ±40 domain pelacak lewat `declarativeNetRequest` (rule dihitung browser, bukan JavaScript, jadi cepat dan hemat memori).
- Filter kosmetik: menyembunyikan kotak iklan yang lolos (AdSense, GPT, Taboola, dll).
- Badge di ikon menunjukkan jumlah request yang diblokir di tab aktif.
- Tombol "Jeda ad blocker di situs ini" di popup untuk situs yang rusak kalau diblokir.

**Melawan dinding anti-adblock (baru di v1.1)**

Situs mendeteksi ad blocker lewat dua cara: (1) skrip iklan gagal dimuat, (2) elemen "umpan" (`.adsbox`, `.ad-banner`, …) ikut disembunyikan. v1.1 menutup keduanya:
- **Stub skrip** — AdSense, GPT, Amazon apstag, Google Analytics, Hotjar, Clarity, dll tidak diblokir mentah-mentah, tapi dialihkan (`declarativeNetRequest` redirect) ke file palsu di `stubs/` yang membuat skripnya tampak "berhasil dimuat". Slot AdSense ditandai `unfilled`, sama seperti perilaku Google sendiri.
- **Kosmetik tersamar** — selector generik (`.adsbox`, `.ad-banner`, …) tidak lagi dipasang di stylesheet. Elemen iklan asli baru disembunyikan setelah ±2,5 detik dan hanya kalau berisi iframe/gambar dan berukuran wajar; umpan (kosong, 1px, di luar layar) tidak disentuh. Slot jaringan iklan disembunyikan dengan `opacity:0` (kotaknya tetap ada), stylesheet dipasang lewat `adoptedStyleSheets` (tidak ada tag `<style>` yang bisa dicari). Bisa dimatikan di Pengaturan ("Mode tersamar") untuk kembali ke perilaku v1.0.
- **Element picker** — kalau dinding tetap muncul: buka popup → "Sembunyikan elemen di halaman ini…", klik overlay-nya (▲ Induk / ▼ Anak untuk menyesuaikan), centang "Buka kunci scroll", lalu Sembunyikan. Tersimpan per situs dan bisa dikelola di Pengaturan. Tetap aktif walau ad blocker dijeda di situs itu.

**Proxy / ganti IP (baru di v1.3)**

Extension ini mengatur proxy browser, bukan membuat terowongan VPN system-level atau menyediakan server. IP hanya bisa berubah lewat endpoint proxy yang kamu sediakan (VPS sendiri atau layanan proxy/VPN dengan endpoint HTTP/HTTPS/SOCKS5).
- Tambah beberapa profil di Pengaturan → "Proxy (ganti IP)" untuk endpoint berbeda. Pilih lokasi secara manual dari popup atau tekan **Pilih acak** untuk beralih ke profil valid lain. Pilihan acak berlaku saat tombol ditekan, tidak berputar setiap request; label lokasi tidak menjamin geolokasi IP.
- Pilih mode: semua situs, atau hanya situs tertentu (daftar pengecualian untuk mode "semua", mis. m-banking).
- Memakai PAC script tanpa `dnsResolve`/`isInNet` (tidak membocorkan DNS lokal); jaringan lokal selalu langsung.
- **Fail closed** (default): kalau proxy mati, koneksi gagal — tidak jatuh ke IP asli. WebRTC dibatasi saat proxy aktif supaya tidak membocorkan IP asli.
- Login proxy didukung untuk HTTP/HTTPS (Chrome tidak mendukung login SOCKS). Password disimpan apa adanya di penyimpanan lokal ekstensi.
- Tombol "Cek IP saya sekarang" menampilkan IP/kota/zona waktu (lewat ipwho.is), dan "Samakan lokasi palsu dengan lokasi IP ini" membuat lokasi GPS palsu konsisten dengan IP proxy.
- Operator proxy melihat domain yang kamu buka (isi HTTPS tetap terenkripsi). Hindari proxy gratis publik.
- Tidak mengubah zona waktu/bahasa peramban.

**Lokasi palsu (baru di v1.2)**

Saat situs meminta lokasi (`navigator.geolocation`), mereka mendapat koordinat dari tempat yang kamu pilih; popup izin lokasi Chrome tidak muncul.
- Jika fitur aktif dan tempat sudah dipilih, permintaan lokasi otomatis dijawab dengan koordinat tersebut. Jika belum ada tempat, permintaan ditolak agar lokasi asli tidak bocor.
- Muat ulang halaman setelah mengubah pengaturan atau tempat lokasi; konfigurasi per halaman hanya dibaca sekali untuk mencegah skrip situs memalsukan pembaruan.
- Pilih tempat di Pengaturan: cari nama tempat (lewat OpenStreetMap/Nominatim), isi koordinat manual (bisa paste "lat, lon" dari Google Maps), atau pakai preset kota. Tempat tersimpan, dan tempat aktif bisa diganti cepat dari popup.
- Koordinat digeser sedikit tiap permintaan (sesuai akurasi yang diatur) supaya tidak terlihat statis; `watchPosition` juga didukung.
- Aman by default: kalau fitur aktif tapi belum ada tempat terpilih, permintaan lokasi **ditolak** — lokasi asli tidak pernah diteruskan.
- Fungsi tiruan disamarkan (`toString()` tampak native); `permissions.query("geolocation")` melaporkan `granted` saat lokasi aktif dan tersedia, atau `denied` bila belum ada tempat.
- **Tidak mengubah** lokasi dari alamat IP (butuh VPN/proxy), lokasi level perangkat, atau zona waktu/WebRTC. Zona waktu yang tidak cocok dengan lokasi palsu bisa jadi tanda mencurigakan.

**Deteksi web berbahaya** (4 lapis, skor makin tinggi = makin mencurigakan; ≥30 peringatan, ≥60 diblokir)
1. **Heuristik URL** — alamat IP, trik `@`, punycode, TLD yang sering disalahgunakan, subdomain berlapis, kata pemancing (`login`, `verify`, …), peniruan brand (`paypa1.com`, `paypal-secure-login.xyz`, `mandiri-klik-…`), dan typosquatting. Domain resmi brand dikenal (Google, Microsoft, Shopee, Tokopedia, BCA, dll) tidak dinilai.
2. **Sinyal halaman** — form password yang mengirim data ke domain lain / tanpa HTTPS, judul halaman yang mengaku brand tertentu, iframe tersembunyi. Kalau mencurigakan tapi belum cukup untuk blokir, muncul banner kuning di atas halaman.
3. **Daftar malware URLhaus** (abuse.ch) — diunduh otomatis tiap 12 jam, dicek lokal.
4. **Google Safe Browsing** (opsional) — isi API key di Pengaturan. Catatan privasi: URL yang dibuka dikirim ke Google saat fitur ini aktif.

Kalau situs diblokir, kamu diarahkan ke halaman peringatan berisi alasan-alasannya. Tombol "lanjutkan" membuka blokir sampai browser ditutup.

**Lab edukasi lokal**
- Buka "Lab edukasi" dari popup untuk mencoba skenario aman menggunakan analyzer yang sama. URL simulasi memakai domain reservasi `.test`/`.invalid`; tidak ada request jaringan atau pengumpulan kredensial.

## Batasan (jujur)

- **Anti-adblock tidak bisa dikalahkan 100%.** Stub tidak menolong kalau situs mengecek lewat fetch CORS, memeriksa isi/ukuran iklan yang sebenarnya, atau memvalidasi dari sisi server. Untuk kasus itu pakai element picker, atau jeda ad blocker di situs tersebut.
- Redirect ke stub memakai `use_dynamic_url` pada `web_accessible_resources` (supaya ekstensi tidak mudah dilacak lewat ID tetap). Kalau stub tidak ter-load di versi Chrome-mu, hapus baris `"use_dynamic_url": true` di `manifest.json`.

- **Iklan YouTube / video streaming tidak diblokir.** Itu butuh manipulasi di dalam player dan terus berubah; di luar cakupan versi ini.
- Deteksi phishing berbasis heuristik **bukan antivirus**. Bisa meleset (situs phishing baru dengan domain "bersih") dan sesekali salah tandai (false positive). Aktifkan Safe Browsing untuk akurasi lebih baik.
- Daftar domain iklan/pelacak bawaan itu ringkas. Mau lebih lengkap: tambahkan domain di `scripts/build-rules.mjs` lalu jalankan `node scripts/build-rules.mjs`.
- Daftar suffix domain (`co.id`, `com.au`, …) dibundel secara ringkas, bukan Public Suffix List penuh.

## Struktur

```
manifest.json
rules/                  ads.json, trackers.json, stubs-ads.json, stubs-trackers.json  (hasil generate)
stubs/                  skrip palsu (adsbygoogle, gpt, apstag, ga, trackers, noop)
scripts/
  build-rules.mjs       generator rules iklan/pelacak
  make-icons.py         generator ikon
  test-analyzer.mjs     tes logika deteksi  →  node scripts/test-analyzer.mjs
  test-stubs.mjs        tes stub & rule     →  node scripts/test-stubs.mjs
  test-geo.mjs          tes lokasi palsu    →  node scripts/test-geo.mjs
  test-pac.mjs          tes proxy/PAC       →  node scripts/test-pac.mjs   (semua: npm test)
src/
  background/           proxy.js (penerapan proxy + login), service-worker, ad-blocker, threat-guard, blocklist, safe-browsing
  content/              geo-spoof-main.js + geo-bridge.js (lokasi palsu), cosmetic.js (sembunyikan iklan), picker.js (element picker), page-signals.js (sinyal halaman)
  shared/               url-analyzer, page-analyzer, feed-parser, settings, hosts  (modul murni, bisa dites di Node)
  popup/  pages/  options/  ui/
```

## Ide pengembangan

- Daftar filter yang lebih besar (mis. impor format EasyList lewat konversi ke rule DNR).
- Daftar phishing komunitas (OpenPhish/PhishTank) sebagai feed tambahan.
- Mode "log": lihat request mana saja yang diblokir per halaman.
- Berbagi daftar elemen yang disembunyikan (ekspor/impor).

## Catatan lokasi palsu

Konfigurasi lokasi dikirim ke halaman sekali saat halaman dimuat (dengan nonce acak supaya skrip situs tidak bisa menyuntik konfigurasi palsu). Setelah mengganti tempat atau menyalakan/mematikan fitur, **muat ulang halaman** yang sudah terbuka.

## Privasi: data apa yang keluar dari browser

Ekstensi ini tidak punya server dan tidak mengirim telemetri. Satu-satunya permintaan jaringan yang dibuatnya sendiri:

| Fitur | Dikirim ke | Isinya |
|---|---|---|
| Sinkron daftar malware (opsional) | URLhaus (abuse.ch) | mengunduh daftar; tidak ada data milikmu |
| Google Safe Browsing (opsional, perlu API key) | Google | hash/URL yang diperiksa |
| Cari tempat (lokasi palsu) | OpenStreetMap Nominatim | teks pencarian yang kamu ketik |
| Cek IP saya | ipwho.is | permintaan biasa (mereka melihat IP yang sedang dipakai) |

Pencocokan email/login guard dilakukan lokal; tidak ada yang dikirim. Pengaturan (termasuk profil proxy beserta passwordnya) disimpan di `chrome.storage.local` di komputermu — **tidak** di repo ini. Jangan pernah meng-commit kredensial proxy atau API key.

## Pengembangan

- `npm test` menjalankan semua tes (tanpa dependensi, cukup Node 18+).
- Ubah daftar domain/stub di `scripts/build-rules.mjs`, lalu `npm run build:rules` dan commit hasil `rules/`. CI gagal kalau `rules/` tidak sinkron.
- Rilis: naikkan `version` di `manifest.json` **dan** `package.json`, update `CHANGELOG.md`, lalu `git tag vX.Y.Z && git push origin vX.Y.Z` — GitHub Actions membuat Release berisi zip siap pakai.

## Lisensi

MIT — lihat `LICENSE`.
