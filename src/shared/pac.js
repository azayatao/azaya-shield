// Pembuat PAC script untuk proxy. Murni (tanpa API Chrome) supaya bisa dites di Node.
//
// Catatan desain:
//  - Tidak memakai isInNet()/dnsResolve(): keduanya melakukan DNS lookup lokal untuk setiap host
//    (membocorkan nama situs ke DNS asli). Pengecekan jaringan lokal dilakukan dengan regex pada host.
//  - Default "fail closed": kalau proxy mati, koneksi gagal — TIDAK jatuh ke koneksi langsung (IP asli).

export const SCHEMES = Object.freeze({
  http: "PROXY",
  https: "HTTPS",
  socks5: "SOCKS5",
  socks4: "SOCKS",
});

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function isValidHost(host) {
  if (!host || host.length > 253) return false;
  const labels = host.split(".");
  if (labels.some((label) => !label || label.length > 63 || !LABEL_RE.test(label))) return false;
  if (/^\d+(?:\.\d+){3}$/.test(host)) {
    return labels.every((label) => Number(label) <= 255);
  }
  return true;
}

/** Validasi profil proxy. Mengembalikan teks error, atau "" jika valid. */
export function validateProfile(p) {
  if (!p || typeof p !== "object") return "Profil tidak valid.";
  if (!Object.hasOwn(SCHEMES, p.scheme)) return "Jenis proxy tidak dikenal.";
  if (!isValidHost(String(p.host ?? ""))) return "Host harus berupa domain atau alamat IPv4 yang valid (tanpa http://).";
  const port = Number(p.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "Port harus 1–65535.";
  if (p.username && (p.scheme === "socks5" || p.scheme === "socks4")) {
    return "Chrome tidak mendukung login untuk proxy SOCKS. Pakai proxy HTTP/HTTPS, atau SOCKS tanpa login.";
  }
  return "";
}

const cleanDomains = (list) =>
  (Array.isArray(list) ? list : []).map((d) => String(d).trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+$/.test(d));

/**
 * @param {object} o
 * @param {{scheme:string,host:string,port:number|string}} o.profile
 * @param {"all"|"sites"} o.mode   all = semua situs lewat proxy; sites = hanya situs di `sites`
 * @param {string[]} o.sites       dipakai di mode "sites"
 * @param {string[]} o.bypass      dipakai di mode "all": situs yang tetap langsung
 * @param {boolean} o.failClosed
 */
export function buildPac({ profile, mode = "all", sites = [], bypass = [], failClosed = true }) {
  const err = validateProfile(profile);
  if (err) throw new Error(err);

  const route = `${SCHEMES[profile.scheme]} ${profile.host}:${Number(profile.port)}`;
  const proxied = failClosed ? route : `${route}; DIRECT`;

  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  var sites = ${JSON.stringify(cleanDomains(sites))};
  var bypass = ${JSON.stringify(cleanDomains(bypass))};
  function inList(list) {
    for (var i = 0; i < list.length; i++) {
      if (host === list[i] || host.slice(-(list[i].length + 1)) === "." + list[i]) return true;
    }
    return false;
  }
  // jaringan lokal & alamat loopback selalu langsung
  if (host.indexOf(".") === -1 || host === "localhost" ||
      /^(127\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.)/.test(host) ||
      /\\.(local|lan|internal)$/.test(host)) return "DIRECT";
  // server proxy itu sendiri tidak boleh lewat proxy
  if (host === ${JSON.stringify(String(profile.host).toLowerCase())}) return "DIRECT";
  ${
    mode === "sites"
      ? `if (inList(sites)) return ${JSON.stringify(proxied)};
  return "DIRECT";`
      : `if (inList(bypass)) return "DIRECT";
  return ${JSON.stringify(proxied)};`
  }
}
`;
}
