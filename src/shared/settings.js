// Pengaturan terpusat — dipakai service worker, popup, dan halaman opsi.

export const DEFAULTS = Object.freeze({
  adBlock: true,            // blokir jaringan iklan
  trackerBlock: true,       // blokir pelacak/analitik pihak ketiga
  cosmeticFilter: true,     // sembunyikan kotak iklan yang tersisa di halaman
  stealthCosmetic: true,    // sembunyikan secara tersamar (tidak memicu deteksi anti-adblock)
  stubScripts: true,        // alihkan skrip iklan/pelacak ke stub supaya terlihat "berhasil dimuat"
  fakeLocation: false,      // lokasi palsu untuk Geolocation API
  fakePlaces: [],           // tempat tersimpan: [{ id, label, lat, lon }]
  fakePlaceId: "",          // id tempat yang sedang dipakai
  fakeAccuracy: 25,         // akurasi yang dilaporkan (meter)
  emailGuardEnabled: false, // cegah pengiriman email pribadi secara tidak sengaja
  protectedEmails: [],      // alamat email pribadi yang diperiksa lokal sebelum submit form
  loginGuardEnabled: false, // minta konfirmasi sebelum mengirim form password pada situs terpilih
  loginGuardSites: [],      // host yang dijaga dalam mode belajar
  proxyMode: "off",         // "off" | "all" (semua situs) | "sites" (hanya situs tertentu)
  proxyProfiles: [],        // [{ id, label, scheme, host, port, username, password }]
  proxyProfileId: "",       // profil yang dipakai
  proxySites: [],           // mode "sites": hanya situs ini yang lewat proxy
  proxyBypass: [],          // mode "all": situs ini tetap langsung
  proxyFailClosed: true,    // proxy mati → koneksi gagal (bukan jatuh ke IP asli)
  proxyBlockWebRTC: true,   // cegah WebRTC membocorkan IP asli saat proxy aktif
  customHides: {},          // elemen yang disembunyikan manual per situs: { "situs.com": { selectors: [], unlockScroll } }
  threatProtection: true,   // deteksi phishing/malware
  useUrlhaus: true,         // sinkron daftar malware URLhaus
  safeBrowsingKey: "",      // API key Google Safe Browsing (opsional)
  warnThreshold: 30,        // skor >= ini → peringatan
  blockThreshold: 60,       // skor >= ini → halaman diblokir
  customBlocklist: [],      // domain yang selalu diblokir (daftar sendiri)
  adAllowlist: [],          // situs yang ad blocker-nya dijeda
  threatsBlocked: 0,        // statistik total
});

export async function getSettings() {
  const stored = await chrome.storage.local.get({ ...DEFAULTS });
  return { ...DEFAULTS, ...stored };
}

export function setSettings(patch) {
  return chrome.storage.local.set(patch);
}
