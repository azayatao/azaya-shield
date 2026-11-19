// Helper kecil untuk urusan hostname.

/** true jika host == entry atau subdomain dari entry. */
export function hostMatches(host, entry) {
  return host === entry || host.endsWith("." + entry);
}

export function inList(host, list) {
  return list.some((entry) => hostMatches(host, entry));
}

/** Ubah input bebas ("https://www.foo.com/x") jadi "foo.com". String kosong = tidak valid. */
export function normalizeHostInput(line) {
  let s = String(line).trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0];
  s = s.replace(/^.*@/, "").replace(/:\d+$/, "").replace(/^www\./, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : "";
}

export function normalizeHostList(text) {
  return [...new Set(String(text).split(/\r?\n/).map(normalizeHostInput).filter(Boolean))];
}
