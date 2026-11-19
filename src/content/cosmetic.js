// Filter kosmetik Azaya Shield v1.1 — menyembunyikan sisa iklan TANPA memicu deteksi anti-adblock.
//
// Cara anti-adblock biasanya bekerja: bikin elemen "umpan" (class .adsbox, .ad-banner, dll),
// lalu cek apakah ia disembunyikan (display:none / tinggi 0). Karena itu v1.1:
//   1. Selector generik (.adsbox, .ad-banner, …) TIDAK lagi ditaruh di stylesheet. Elemen umpan
//      tidak pernah disentuh; elemen iklan asli hanya disembunyikan setelah jeda singkat dan
//      hanya jika isinya memang konten iklan (iframe/gambar/dll) dan ukurannya wajar.
//   2. Selector khusus jaringan iklan disembunyikan dengan opacity:0 (kotaknya tetap ada, jadi
//      pengecekan offsetHeight/display tetap "normal"), bukan display:none.
//   3. Stylesheet dipasang lewat adoptedStyleSheets — tidak ada <style> yang bisa ditemukan
//      lewat querySelector.
//   4. Mode klasik (v1) masih ada: matikan "Mode tersamar" di Pengaturan.
//
// Elemen yang kamu pilih sendiri lewat element picker (popup → "Sembunyikan elemen") selalu
// diterapkan, bahkan kalau ad blocker dijeda di situs itu.

(async () => {
  // Spesifik jaringan iklan — aman karena detektor jarang memakainya sebagai umpan.
  const NETWORK = [
    "ins.adsbygoogle", ".adsbygoogle",
    "[id^='div-gpt-ad']", "[id^='google_ads_iframe']", "[id^='aswift_']",
    "[data-ad-slot]", "[data-ad-client]", "[data-google-query-id]",
    "iframe[src*='doubleclick.net']", "iframe[src*='googlesyndication.com']", "iframe[src*='adservice.google']",
    "[id^='taboola-']", ".trc_related_container", ".OUTBRAIN",
  ];
  // Nama class generik — sering dipakai sebagai umpan, jadi ditangani lewat sweep() di bawah.
  const GENERIC = [
    ".ad-banner", ".ad-container", ".ad-wrapper", ".ad-slot", ".ad-unit", ".ad-placeholder",
    ".advertisement", ".advert", ".adsbox", ".banner-ad", ".sponsored-ad", ".google-ad", ".dfp-ad",
    "#ad-banner", "#ad-container",
    "[aria-label='Advertisement']", "[aria-label='advertisement']",
  ];

  const host = location.hostname;
  const hostMatches = (h, entry) => h === entry || h.endsWith("." + entry);

  const cfg = await chrome.storage.local.get({
    adBlock: true,
    cosmeticFilter: true,
    stealthCosmetic: true,
    adAllowlist: [],
    customHides: {},
  });

  function injectCSS(css) {
    if (!css) return;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch {
      const el = document.createElement("style"); // fallback tanpa id
      el.textContent = css;
      (document.head || document.documentElement).appendChild(el);
    }
  }

  // --- 1. Elemen pilihan pengguna (selalu aktif) -------------------------------------------
  const mine = Object.entries(cfg.customHides).filter(([key]) => hostMatches(host, key)).map(([, v]) => v);
  const userSelectors = mine.flatMap((v) => v.selectors ?? []);
  let userCSS = userSelectors.length ? `${userSelectors.join(",\n")} { display: none !important; }\n` : "";
  if (mine.some((v) => v.unlockScroll)) {
    // Overlay anti-adblock biasanya mengunci scroll dan mem-blur halaman.
    userCSS += "html, body { overflow: auto !important; filter: none !important; }\n";
  }
  injectCSS(userCSS);

  // --- 2. Filter kosmetik otomatis ---------------------------------------------------------
  if (!cfg.adBlock || !cfg.cosmeticFilter) return;
  if (cfg.adAllowlist.some((entry) => hostMatches(host, entry))) return;

  if (!cfg.stealthCosmetic) {
    // Mode klasik (perilaku v1.0)
    injectCSS(`${[...NETWORK, ...GENERIC].join(",\n")} { display: none !important; }`);
    return;
  }

  // Mode tersamar
  injectCSS(`${NETWORK.join(",\n")} { opacity: 0 !important; pointer-events: none !important; }`);

  const SETTLE_MS = 2500; // beri waktu detektor selesai memeriksa umpannya
  const REAL_CONTENT = "iframe, img, ins, video, canvas, object, embed, a[href]";
  const GENERIC_SEL = GENERIC.join(",");
  const firstSeen = new WeakMap();
  const done = new WeakSet();

  function looksLikeRealAd(el) {
    if (!el.querySelector(REAL_CONTENT)) return false; // umpan biasanya kosong / hanya teks
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) return false;    // umpan biasanya 1px
    if (r.right < -200 || r.bottom < -200 || r.left > innerWidth + 2000) return false; // umpan sering di luar layar
    return true;
  }

  function sweep() {
    const now = Date.now();
    for (const el of document.querySelectorAll(GENERIC_SEL)) {
      if (done.has(el)) continue;
      if (!firstSeen.has(el)) { firstSeen.set(el, now); continue; }
      if (now - firstSeen.get(el) < SETTLE_MS) continue;
      if (!looksLikeRealAd(el)) continue;
      el.style.setProperty("display", "none", "important");
      done.add(el);
    }
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sweep, SETTLE_MS / 2);
  };

  const start = () => {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    schedule();
    setInterval(sweep, SETTLE_MS); // elemen yang muncul tanpa mutasi baru tetap tersapu
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
