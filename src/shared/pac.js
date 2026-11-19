// PAC generator. Kept pure so routing decisions can be tested without Chrome.
// Never uses DNS-resolution PAC helpers. failClosed defaults to true: no DIRECT fallback
// for routes selected for proxying. Explicit local-network routes and sites-mode exclusions
// intentionally remain DIRECT; this is browser proxying, not a device-wide VPN.

export const SCHEMES = Object.freeze({
  http: "PROXY",
  https: "HTTPS",
  socks5: "SOCKS5",
  socks4: "SOCKS",
});

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function isValidHost(host) {
  if (typeof host !== "string" || !host || host.length > 253 || /\s|[\\/:;"'`]/.test(host)) return false;
  const labels = host.split(".");
  if (labels.some((label) => !label || label.length > 63 || !LABEL_RE.test(label))) return false;
  if (/^\d+(?:\.\d+){3}$/.test(host)) return labels.every((label) => Number(label) <= 255);
  return true;
}

export function validateProfile(profile) {
  if (!profile || typeof profile !== "object") return "Profil tidak valid.";
  if (!Object.hasOwn(SCHEMES, profile.scheme)) return "Jenis proxy tidak dikenal.";
  if (!isValidHost(String(profile.host ?? ""))) return "Host harus domain/IPv4 valid tanpa skema atau path.";
  const port = Number(profile.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "Port harus 1–65535.";
  if ((profile.scheme === "socks5" || profile.scheme === "socks4") && (profile.username || profile.password)) {
    return "Chrome tidak mendukung autentikasi username/password untuk proxy SOCKS.";
  }
  return "";
}

function validDomain(domain) {
  if (!domain || domain.length > 253) return false;
  const labels = domain.split(".");
  return labels.every((label) => label.length > 0 && label.length <= 63 && LABEL_RE.test(label));
}

const cleanDomains = (list) =>
  [...new Set((Array.isArray(list) ? list : []).map((value) => String(value).trim().toLowerCase()).filter(validDomain))];

export function buildPac({ profile, mode = "all", sites = [], bypass = [], failClosed = true }) {
  const error = validateProfile(profile);
  if (error) throw new Error(error);
  if (mode !== "all" && mode !== "sites") throw new Error("Mode proxy tidak dikenal.");

  const route = `${SCHEMES[profile.scheme]} ${profile.host}:${Number(profile.port)}`;
  const selectedRoute = failClosed === false ? `${route}; DIRECT` : route;
  const proxyHost = JSON.stringify(String(profile.host).toLowerCase());

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
  function isPrivateIPv4(value) {
    return /^(0\\.|10\\.|127\\.|169\\.254\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|100\\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\\.)/.test(value);
  }
  function isLocalIPv6(value) {
    value = value.replace(/^\\[|\\]$/g, "");
    return value === "::1" || /^f[cd][0-9a-f]{0,2}:/i.test(value) || /^fe[89ab][0-9a-f]:/i.test(value);
  }
  // Local names and private/link-local networks intentionally bypass the proxy.
  if (host.indexOf(".") === -1 || host === "localhost" || /\\.(local|lan|internal)$/.test(host) || isPrivateIPv4(host) || isLocalIPv6(host)) return "DIRECT";
  // Avoid routing the proxy endpoint through itself.
  if (host === ${proxyHost}) return "DIRECT";
  ${mode === "sites"
    ? `if (inList(sites)) return ${JSON.stringify(selectedRoute)};\n  return "DIRECT";`
    : `if (inList(bypass)) return "DIRECT";\n  return ${JSON.stringify(selectedRoute)};`}
}
`;
}
