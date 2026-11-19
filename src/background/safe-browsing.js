// Google Safe Browsing (Lookup API v4) — opsional, aktif kalau pengguna mengisi API key di Pengaturan.
// Privasi: URL lengkap yang dibuka dikirim ke Google saat fitur ini aktif.

const ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const CACHE_TTL = 30 * 60 * 1000;
const TIMEOUT_MS = 2500;

const cache = new Map(); // url → { at, result }

const LABELS = {
  MALWARE: "malware",
  SOCIAL_ENGINEERING: "phishing / penipuan",
  UNWANTED_SOFTWARE: "software tak diinginkan",
  POTENTIALLY_HARMFUL_APPLICATION: "aplikasi berpotensi berbahaya",
};

/** @returns {Promise<string|null>} label ancaman (Indonesia) atau null kalau bersih/gagal. */
export async function checkSafeBrowsing(url, apiKey) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        client: { clientId: "azaya-shield", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: Object.keys(LABELS),
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const type = data.matches?.[0]?.threatType;
    const result = type ? LABELS[type] ?? type.toLowerCase() : null;
    cache.set(url, { at: Date.now(), result });
    return result;
  } catch {
    return null; // timeout / offline → jangan ganggu browsing
  } finally {
    clearTimeout(timer);
  }
}
