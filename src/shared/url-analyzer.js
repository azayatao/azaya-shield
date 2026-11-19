// Analisis heuristik URL untuk mendeteksi phishing.
// Modul murni (tanpa API chrome.*) → dipakai di service worker, popup, dan dites di Node.
//
// Skor makin tinggi = makin mencurigakan. Ambang default ada di settings.js:
//   >= 30 → peringatan,  >= 60 → diblokir.

export const THRESHOLDS = Object.freeze({ warn: 30, block: 60 });

// Suffix 2-level yang umum (pengganti Public Suffix List yang terlalu besar untuk dibundel).
const TWO_LEVEL_SUFFIXES = new Set([
  "co.id", "ac.id", "go.id", "or.id", "web.id", "sch.id", "my.id", "net.id", "mil.id",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp",
  "co.kr", "co.in", "com.br", "com.mx", "com.ar", "com.sg", "com.my", "com.ph", "com.vn",
  "co.th", "com.hk", "com.tw", "com.cn", "com.tr", "co.za",
]);

// TLD yang sangat sering disalahgunakan untuk phishing/spam.
const SUSPICIOUS_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "top", "xyz", "click", "link", "zip", "mov", "work",
  "support", "loan", "win", "bid", "icu", "cyou", "rest", "monster", "buzz", "sbs",
  "cam", "country", "kim", "men", "party", "review",
]);

// Kata pemancing yang sering muncul di hostname phishing (pakai stem).
const KEYWORDS = [
  "login", "signin", "sign-in", "verif", "secur", "account", "update", "confirm",
  "wallet", "billing", "password", "unlock", "suspend", "recover", "banking",
  "helpdesk", "claim", "reward", "bonus",
];

const RISKY_EXTENSION = /\.(exe|msi|scr|bat|cmd|apk|jar|vbs|ps1|iso|lnk)$/i;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const CC_SUFFIX = /^(?:[a-z]{2}|(?:com|co|net|org)\.[a-z]{2})$/;

const brand = (name, domains, ccTld = false) => ({ name, domains, ccTld });

/** Brand yang sering ditiru + domain resminya. ccTld=true → versi negara (google.co.id) dianggap sah. */
export const BRANDS = [
  brand("paypal", ["paypal.com", "paypal.me", "paypalobjects.com"], true),
  brand("google", ["google.com", "googleapis.com", "gstatic.com", "googleusercontent.com", "googlevideo.com", "youtube.com", "youtu.be", "gmail.com", "goo.gl", "ggpht.com", "withgoogle.com"], true),
  brand("facebook", ["facebook.com", "fb.com", "fb.me", "fbcdn.net", "messenger.com", "meta.com"], true),
  brand("instagram", ["instagram.com", "cdninstagram.com"]),
  brand("whatsapp", ["whatsapp.com", "whatsapp.net", "wa.me"]),
  brand("microsoft", ["microsoft.com", "microsoftonline.com", "live.com", "outlook.com", "office.com", "office365.com", "bing.com", "msn.com", "windows.com", "windows.net", "azure.com", "sharepoint.com", "xbox.com", "skype.com", "onedrive.com", "visualstudio.com", "azurewebsites.net", "1drv.ms"], true),
  brand("apple", ["apple.com", "icloud.com", "itunes.com", "mzstatic.com"], true),
  brand("amazon", ["amazon.com", "amazonaws.com", "amzn.to", "amzn.com", "primevideo.com", "audible.com"], true),
  brand("netflix", ["netflix.com", "nflxvideo.net", "nflximg.net"], true),
  brand("twitter", ["twitter.com", "x.com", "t.co", "twimg.com"]),
  brand("linkedin", ["linkedin.com", "licdn.com"]),
  brand("github", ["github.com", "githubusercontent.com", "github.io", "githubassets.com"]),
  brand("dropbox", ["dropbox.com", "dropboxusercontent.com"]),
  brand("discord", ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"]),
  brand("telegram", ["telegram.org", "t.me", "telegram.me"]),
  brand("tiktok", ["tiktok.com", "tiktokcdn.com", "tiktokv.com"]),
  brand("spotify", ["spotify.com", "scdn.co"]),
  brand("yahoo", ["yahoo.com", "yahooapis.com", "yimg.com"], true),
  brand("fedex", ["fedex.com"], true),
  brand("binance", ["binance.com", "binance.us", "bnbstatic.com"]),
  brand("coinbase", ["coinbase.com"]),
  brand("metamask", ["metamask.io"]),
  brand("steamcommunity", ["steamcommunity.com"]),
  brand("steampowered", ["steampowered.com"]),
  // Indonesia
  brand("shopee", ["shopee.co.id", "shopee.com", "shopee.sg", "shopeemobile.com", "shp.ee"], true),
  brand("tokopedia", ["tokopedia.com", "tokopedia.net"]),
  brand("bukalapak", ["bukalapak.com"]),
  brand("lazada", ["lazada.co.id", "lazada.com", "lazada.sg", "lazada.com.my"], true),
  brand("gojek", ["gojek.com", "go-jek.com"]),
  brand("blibli", ["blibli.com"]),
  brand("traveloka", ["traveloka.com"]),
  brand("klikbca", ["klikbca.com", "bca.co.id"]),
  brand("mandiri", ["bankmandiri.co.id", "mandiri.co.id", "mandirisekuritas.co.id"]),
  brand("danamon", ["danamon.co.id"]),
  brand("cimbniaga", ["cimbniaga.co.id"]),
];

const LEGIT_DOMAINS = new Set(BRANDS.flatMap((b) => b.domains));

// ---------------------------------------------------------------- helper domain

export function getRegistrableDomain(hostname) {
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** true jika domain terdaftar sebagai milik brand resmi (termasuk versi negaranya). */
export function isLegitDomain(registrable) {
  if (LEGIT_DOMAINS.has(registrable)) return true;
  const [sld, ...rest] = registrable.split(".");
  const suffix = rest.join(".");
  if (!suffix || SUSPICIOUS_TLDS.has(rest[rest.length - 1])) return false;
  return BRANDS.some((b) => b.ccTld && b.name === sld && CC_SUFFIX.test(suffix));
}

export function isPrivateHost(host) {
  if (host === "localhost" || host === "[::1]") return true;
  if (/\.(local|lan|internal|localhost)$/.test(host)) return true;
  if (!IPV4.test(host)) return false;
  const [a, b] = host.split(".").map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

// ---------------------------------------------------------------- helper string

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Versi "dinormalkan" dari label yang menukar huruf dengan angka/karakter mirip (g00gle → google). */
function homoglyphVariants(s) {
  const base = s.replace(/0/g, "o").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  const variants = new Set([
    base.replace(/1/g, "l"),
    base.replace(/1/g, "i"),
    base.replace(/rn/g, "m"),
    base.replace(/vv/g, "w"),
  ]);
  variants.delete(s);
  return [...variants];
}

/** Nama pendek (<=5 huruf) harus cocok sebagai token utuh supaya "pineapple" ≠ "apple". */
function containsBrand(b, text) {
  if (b.name.length > 5) return text.replace(/-/g, "").includes(b.name);
  return text.split(/[.-]/).includes(b.name);
}

function matchBrand(host, registrable) {
  const sld = registrable.split(".")[0];

  for (const b of BRANDS) {
    if (containsBrand(b, host)) {
      return { code: "brand-in-domain", points: 45, label: `Memakai nama '${b.name}' padahal bukan domain resmi ${b.name}` };
    }
  }
  for (const b of BRANDS) {
    if (homoglyphVariants(sld).some((v) => containsBrand(b, v))) {
      return { code: "homoglyph", points: 60, label: `Meniru '${b.name}' dengan menukar huruf (mis. 1↔l, 0↔o, rn↔m)` };
    }
  }
  const compact = sld.replace(/-/g, "");
  for (const b of BRANDS) {
    if (b.name.length >= 6 && compact.length >= 5 && Math.abs(compact.length - b.name.length) <= 1 && levenshtein(compact, b.name) === 1) {
      return { code: "typosquat", points: 45, label: `Nama mirip '${b.name}' (kemungkinan typosquatting)` };
    }
  }
  return null;
}

// ---------------------------------------------------------------- analisis utama

/**
 * @returns {{score:number, reasons:{code:string,label:string,points:number}[], hostname:string, registrable:string, skipped:boolean}}
 */
export function analyzeUrl(rawUrl) {
  const result = { score: 0, reasons: [], hostname: "", registrable: "", skipped: true };
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return result;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return result;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  result.hostname = host;
  if (isPrivateHost(host)) return result;
  result.skipped = false;

  const add = (code, label, points) => {
    result.score += points;
    result.reasons.push({ code, label, points });
  };

  const isIp = IPV4.test(host) || host.startsWith("[");
  const registrable = isIp ? host : getRegistrableDomain(host);
  result.registrable = registrable;

  if (isIp) add("ip-host", "Alamat berupa IP, bukan nama domain", 35);

  if (url.username) {
    add("userinfo", "URL memakai '@' untuk menyamarkan tujuan asli", 30);
    if (url.username.includes(".")) add("userinfo-domain", "Teks sebelum '@' menyerupai nama domain (trik penyamaran)", 30);
  }

  // Domain resmi brand dikenal → lewati heuristik nama domain.
  if (!isIp && isLegitDomain(registrable)) return result;

  if (!isIp) {
    const labels = host.split(".");
    const tld = labels[labels.length - 1];

    if (labels.some((l) => l.startsWith("xn--"))) {
      add("punycode", "Domain memakai karakter unicode/punycode (bisa meniru situs lain)", 30);
    }
    if (SUSPICIOUS_TLDS.has(tld)) add("tld", `Ekstensi .${tld} sering disalahgunakan untuk phishing`, 15);
    if (labels.length - registrable.split(".").length >= 3) add("subdomains", "Terlalu banyak subdomain bertingkat", 12);
    if (host.length > 45) add("long-host", "Nama domain sangat panjang", 8);
    if ((host.match(/-/g) || []).length >= 3) add("hyphens", "Domain penuh tanda hubung", 10);

    const found = KEYWORDS.filter((k) => host.includes(k));
    if (found.length >= 3) add("keywords", `Domain berisi banyak kata pemancing (${found.join(", ")})`, 25);
    else if (found.length === 2) add("keywords", `Domain berisi kata pemancing (${found.join(", ")})`, 15);
    else if (found.length === 1) add("keywords", `Domain berisi kata pemancing (${found[0]})`, 5);

    const hit = matchBrand(host, registrable);
    if (hit) add(hit.code, hit.label, hit.points);
  }

  const pathQuery = (url.pathname + url.search).toLowerCase();
  if (url.protocol === "http:" && /login|signin|verify|account|password|secure/.test(pathQuery)) {
    add("http-login", "Halaman login/verifikasi tanpa HTTPS", 10);
  }
  if (RISKY_EXTENSION.test(url.pathname)) add("risky-file", "Mengarah ke file yang bisa langsung dijalankan (.exe/.apk/dll)", 15);
  if (rawUrl.length > 200) add("long-url", "URL sangat panjang", 5);

  return result;
}

export function levelForScore(score, warn = THRESHOLDS.warn, block = THRESHOLDS.block) {
  return score >= block ? "block" : score >= warn ? "warn" : "safe";
}
