// Parser feed URLhaus (satu URL per baris). Modul murni → bisa dites di Node.

import { getRegistrableDomain, isLegitDomain } from "./url-analyzer.js";

/** Ambil hostname unik. Domain brand resmi dibuang supaya situs besar tidak salah terblokir. */
export function parseFeed(text) {
  const hosts = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const url = new URL(line);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const host = url.hostname.toLowerCase();
      if (host && !isLegitDomain(getRegistrableDomain(host))) hosts.add(host);
    } catch { /* baris rusak, lewati */ }
  }
  return [...hosts];
}
