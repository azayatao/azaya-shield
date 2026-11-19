// Analisis sinyal dari isi halaman (dikumpulkan content script page-signals.js).
// Modul murni → bisa dites di Node.

import { BRANDS, getRegistrableDomain, isLegitDomain, isPrivateHost } from "./url-analyzer.js";

/**
 * @param {string} pageUrl
 * @param {{hasPassword:boolean, formActions:string[], title:string, heading:string, hiddenIframes:number}} signals
 * @param {number} urlScore skor heuristik URL yang sudah ada
 */
export function analyzePageSignals(pageUrl, signals, urlScore = 0) {
  const out = { score: 0, reasons: [] };
  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return out;
  }
  const host = url.hostname.toLowerCase();
  const registrable = getRegistrableDomain(host);
  if (isPrivateHost(host) || isLegitDomain(registrable)) return out;

  const add = (code, label, points) => {
    out.score += points;
    out.reasons.push({ code, label, points });
  };

  if (signals.hasPassword) {
    if (urlScore >= 15) add("pw-suspicious-host", "Meminta password di situs yang sudah terlihat mencurigakan", 20);

    let external = false;
    let insecure = false;
    for (const action of signals.formActions ?? []) {
      try {
        const a = new URL(action);
        if (getRegistrableDomain(a.hostname.toLowerCase()) !== registrable) external = true;
        if (a.protocol === "http:") insecure = true;
      } catch { /* abaikan action yang tidak valid */ }
    }
    if (external) add("pw-external-action", "Form password mengirim data ke domain lain", 30);
    if (insecure) add("pw-insecure-action", "Form password dikirim tanpa enkripsi (HTTP)", 25);
  }

  const text = `${signals.title ?? ""} ${signals.heading ?? ""}`.toLowerCase();
  const claimed = BRANDS.find((b) =>
    b.name.length > 5 ? text.includes(b.name) : new RegExp(`\\b${b.name}\\b`).test(text),
  );
  if (claimed) {
    add(
      "brand-in-page",
      `Halaman membawa nama '${claimed.name}' tapi domainnya bukan milik resminya`,
      signals.hasPassword ? 25 : 8,
    );
  }

  if ((signals.hiddenIframes ?? 0) >= 2) add("hidden-iframes", "Ada beberapa iframe tersembunyi dari domain lain", 10);

  return out;
}
