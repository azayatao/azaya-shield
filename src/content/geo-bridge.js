// Jembatan lokasi palsu: membaca pengaturan dari chrome.storage (dunia terisolasi) dan
// mengirimkannya ke geo-spoof-main.js (main world) lewat event DOM berisi string JSON.

(() => {
  const CFG_EVENT = "__azg";
  const REQ_EVENT = "__azgq";
  const READY_EVENT = "__azgr";

  async function currentConfig() {
    const s = await chrome.storage.local.get({ fakeLocation: false, fakePlaces: [], fakePlaceId: "", fakeAccuracy: 25 });
    if (!s.fakeLocation) return { enabled: false };
    const place = s.fakePlaces.find((p) => p.id === s.fakePlaceId);
    // Aktif tapi belum ada tempat terpilih → tolak permintaan lokasi, jangan bocorkan yang asli.
    if (!place) return { enabled: true, block: true };
    return { enabled: true, lat: place.lat, lon: place.lon, accuracy: s.fakeAccuracy };
  }

  async function send(nonce) {
    try {
      if (typeof nonce !== "string" || !nonce) return;
      const detail = JSON.stringify({ nonce, config: await currentConfig() });
      window.dispatchEvent(new CustomEvent(CFG_EVENT, { detail }));
    } catch { /* konteks ekstensi tidak valid (mis. ekstensi di-reload) */ }
  }

  window.addEventListener(REQ_EVENT, (event) => send(event.detail));
  window.dispatchEvent(new CustomEvent(READY_EVENT));
})();
