// Generator rules declarativeNetRequest → rules/ads.json & rules/trackers.json
// Jalankan: node scripts/build-rules.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");

const RESOURCE_TYPES = [
  "script", "image", "xmlhttprequest", "sub_frame", "ping",
  "media", "stylesheet", "object", "font", "websocket", "other",
];

// Domain jaringan iklan (subdomain ikut terblokir otomatis oleh requestDomains).
const AD_DOMAINS = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "adservice.google.com", "adservice.google.co.id", "2mdn.net",
  "adnxs.com", "adsrvr.org", "advertising.com", "taboola.com", "outbrain.com",
  "criteo.com", "criteo.net", "rubiconproject.com", "pubmatic.com", "openx.net",
  "casalemedia.com", "amazon-adsystem.com", "moatads.com", "adform.net",
  "smartadserver.com", "33across.com", "bidswitch.net", "contextweb.com",
  "yieldmo.com", "sharethrough.com", "media.net", "revcontent.com", "mgid.com",
  "zedo.com", "adcolony.com", "popads.net", "popcash.net", "propellerads.com",
  "exoclick.com", "juicyads.com", "trafficjunky.com", "adsterra.com",
  "hilltopads.net", "clickadu.com", "adblade.com", "adroll.com", "undertone.com",
  "teads.tv", "serving-sys.com", "flashtalking.com", "innovid.com", "adition.com",
  "lijit.com", "sovrn.com", "triplelift.com", "indexww.com", "gumgum.com",
  "spotxchange.com", "spotx.tv", "tapad.com", "yieldlab.net", "adskeeper.com",
  "onetag-sys.com", "richaudience.com", "smaato.net", "inmobi.com", "mopub.com",
  "vungle.com", "chartboost.com", "ads.yahoo.com", "adsafeprotected.com",
  "doubleverify.com", "adtng.com", "adnium.com", "bidr.io", "ad-delivery.net",
  "adcash.com", "a-ads.com", "ero-advertising.com", "an.yandex.ru",
  "rtbhouse.com", "adhigh.net", "lkqd.net", "connatix.com", "primis.tech",
  "sekindo.com",
];

// Domain pelacak / analitik pihak ketiga yang aman diblokir (tidak merusak fungsi situs).
const TRACKER_DOMAINS = [
  "google-analytics.com", "analytics.google.com", "stats.g.doubleclick.net",
  "scorecardresearch.com", "quantserve.com", "hotjar.com", "hotjar.io",
  "fullstory.com", "mouseflow.com", "crazyegg.com", "luckyorange.com",
  "clarity.ms", "bat.bing.com", "ads-twitter.com", "analytics.twitter.com",
  "analytics.tiktok.com", "ct.pinterest.com", "px.ads.linkedin.com",
  "snap.licdn.com", "bluekai.com", "demdex.net", "omtrdc.net", "everesttech.net",
  "krxd.net", "exelator.com", "rlcdn.com", "agkn.com", "adsymptotic.com",
  "mathtag.com", "bkrtx.com", "imrworldwide.com", "chartbeat.net",
  "branch.io", "app-measurement.com", "appsflyer.com", "adjust.com",
  "mc.yandex.ru", "mxpnl.com", "heapanalytics.com",
];

// Path khusus (pixel pelacak first-party platform besar).
const TRACKER_URL_FILTERS = [
  "||facebook.com/tr?", "||facebook.com/tr/", "||connect.facebook.net/signals/",
];

// ---------------------------------------------------------------------------------------------
// Stub: alih-alih memblokir, skrip iklan/pelacak penting dialihkan ke file palsu di folder stubs/
// supaya terlihat "berhasil dimuat" (anti-adblock biasanya memeriksa itu).
// Priority: blok = 1, stub umum = 2, stub spesifik = 3 (yang spesifik menang atas yang umum).
// ---------------------------------------------------------------------------------------------
const SCRIPT = ["script"];
const SCRIPT_FETCH = ["script", "xmlhttprequest"]; // fetch()/XHR "umpan" juga dianggap sukses

const STUBS_ADS = [
  // spesifik (priority 3)
  ["||pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", "adsbygoogle.js", SCRIPT_FETCH, 3],
  ["||googletagservices.com/tag/js/gpt.js", "gpt.js", SCRIPT_FETCH, 3],
  ["||securepubads.g.doubleclick.net/tag/js/gpt.js", "gpt.js", SCRIPT_FETCH, 3],
  ["||pagead2.googlesyndication.com/tag/js/gpt.js", "gpt.js", SCRIPT_FETCH, 3],
  ["||c.amazon-adsystem.com/aax2/apstag.js", "apstag.js", SCRIPT, 3],
  // umum (priority 2): skrip pendukung → no-op
  ["||googlesyndication.com/pagead/", "noop.js", SCRIPT, 2],
  ["||googletagservices.com/", "noop.js", SCRIPT, 2],
  ["||securepubads.g.doubleclick.net/", "noop.js", SCRIPT, 2],
  ["||partner.googleadservices.com/", "noop.js", SCRIPT, 2],
  ["||adservice.google.com/", "noop.js", SCRIPT, 2],
  ["||adservice.google.co.id/", "noop.js", SCRIPT, 2],
  ["||cdn.taboola.com/", "noop.js", SCRIPT, 2],
  ["||widgets.outbrain.com/", "noop.js", SCRIPT, 2],
  ["||static.criteo.net/", "noop.js", SCRIPT, 2],
];

const STUBS_TRACKERS = [
  ["||google-analytics.com/analytics.js", "ga.js", SCRIPT, 3],
  ["||google-analytics.com/ga.js", "ga.js", SCRIPT, 3],
  ["||google-analytics.com/", "noop.js", SCRIPT, 2],
  ["||static.hotjar.com/", "trackers.js", SCRIPT, 2],
  ["||script.hotjar.com/", "trackers.js", SCRIPT, 2],
  ["||clarity.ms/tag/", "trackers.js", SCRIPT, 2],
  ["||bat.bing.com/bat.js", "trackers.js", SCRIPT, 2],
  ["||scorecardresearch.com/beacon.js", "noop.js", SCRIPT, 2],
];

function stubRules(list) {
  return list.map(([urlFilter, file, resourceTypes, priority], i) => ({
    id: i + 1,
    priority,
    action: { type: "redirect", redirect: { extensionPath: `/stubs/${file}` } },
    condition: { urlFilter, resourceTypes },
  }));
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function domainRules(domains, startId) {
  return chunk([...new Set(domains)], 100).map((group, i) => ({
    id: startId + i,
    priority: 1,
    action: { type: "block" },
    condition: { requestDomains: group, resourceTypes: RESOURCE_TYPES },
  }));
}

function urlFilterRules(filters, startId) {
  return filters.map((urlFilter, i) => ({
    id: startId + i,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter, resourceTypes: ["image", "ping", "xmlhttprequest", "script", "sub_frame", "other"] },
  }));
}

const ads = domainRules(AD_DOMAINS, 1);
const trackers = [
  ...domainRules(TRACKER_DOMAINS, 1),
  ...urlFilterRules(TRACKER_URL_FILTERS, 100),
];

writeFileSync(join(OUT, "ads.json"), JSON.stringify(ads, null, 2) + "\n");
writeFileSync(join(OUT, "trackers.json"), JSON.stringify(trackers, null, 2) + "\n");
writeFileSync(join(OUT, "stubs-ads.json"), JSON.stringify(stubRules(STUBS_ADS), null, 2) + "\n");
writeFileSync(join(OUT, "stubs-trackers.json"), JSON.stringify(stubRules(STUBS_TRACKERS), null, 2) + "\n");
console.log(`ads: ${new Set(AD_DOMAINS).size} domain → ${ads.length} rule`);
console.log(`trackers: ${new Set(TRACKER_DOMAINS).size} domain + ${TRACKER_URL_FILTERS.length} pola → ${trackers.length} rule`);
console.log(`stubs: ${STUBS_ADS.length} rule iklan + ${STUBS_TRACKERS.length} rule pelacak`);
