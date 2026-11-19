// Tes logika deteksi (tanpa browser): node scripts/test-analyzer.mjs
import assert from "node:assert/strict";
import { analyzeUrl, levelForScore, getRegistrableDomain } from "../src/shared/url-analyzer.js";
import { analyzePageSignals } from "../src/shared/page-analyzer.js";
import { parseFeed } from "../src/shared/feed-parser.js";
import { normalizeHostInput, hostMatches } from "../src/shared/hosts.js";
import { evaluateLabScenario, LAB_SCENARIOS } from "../src/shared/lab-scenarios.js";

let passed = 0;
const level = (url) => levelForScore(analyzeUrl(url).score);
function check(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

// --- situs sah: harus aman -----------------------------------------------------------
const SAFE = [
  "https://www.google.com/", "https://accounts.google.com/signin", "https://mail.google.com/",
  "https://www.microsoft.com/", "https://login.microsoftonline.com/", "https://github.com/anthropics",
  "https://gist.github.com/", "https://www.tokopedia.com/", "https://shopee.co.id/", "https://www.amazon.co.uk/",
  "https://www.google.com.au/", "https://www.amazon.de/", "https://its.ac.id/", "https://www.kompas.com/",
  "https://stackoverflow.com/", "https://en.wikipedia.org/wiki/Phishing", "https://docs.python.org/3/",
  "https://pineapple.com/", "http://localhost:3000/login", "http://192.168.1.10/login",
  "https://www.klikbca.com/", "https://youtube.com/watch?v=abc",
];
for (const url of SAFE) check(`aman: ${url}`, () => assert.equal(level(url), "safe", JSON.stringify(analyzeUrl(url).reasons)));

// --- phishing: harus diblokir ---------------------------------------------------------
const BLOCK = [
  "https://paypal-secure-login.com/verify",
  "https://paypal.com.account-verify.xyz/",
  "https://secure-update-account.paypal.com.verify-id.xyz/signin",
  "https://paypa1.com/login",
  "https://g00gle.com/",
  "https://google.tk/",
  "https://paypal.com@evil.example/",
  "https://mandiri-klik-login.top/",
  "https://arnazon.com/",
];
for (const url of BLOCK) check(`blokir: ${url}`, () => assert.equal(level(url), "block", `skor ${analyzeUrl(url).score}`));

// --- mencurigakan: peringatan saja ------------------------------------------------------
const WARN = [
  "http://192.0.2.1/login.php",
  "https://xn--pypal-4ve.com/",
  "https://gooogle.com/",
  "https://user@some-site.example/",
];
for (const url of WARN) check(`peringatan: ${url}`, () => assert.equal(level(url), "warn", `skor ${analyzeUrl(url).score}`));

// --- non-http & invalid dilewati ----------------------------------------------------------
check("skip chrome://", () => assert.equal(analyzeUrl("chrome://settings").skipped, true));
check("skip url rusak", () => assert.equal(analyzeUrl("bukan url").skipped, true));

// --- registrable domain -----------------------------------------------------------------
check("registrable", () => {
  assert.equal(getRegistrableDomain("a.b.example.com"), "example.com");
  assert.equal(getRegistrableDomain("www.its.ac.id"), "its.ac.id");
  assert.equal(getRegistrableDomain("example.com"), "example.com");
});

// --- sinyal halaman ---------------------------------------------------------------------
check("form password ke domain lain + brand palsu", () => {
  const url = "https://random-site.example/login";
  const page = analyzePageSignals(url, {
    hasPassword: true, formActions: ["https://collector.bad.example/post.php"],
    title: "Sign in to your PayPal account", heading: "", hiddenIframes: 0,
  }, analyzeUrl(url).score);
  assert.ok(page.score >= 55, `skor halaman ${page.score}`);
});
check("situs sah tidak dinilai ulang", () => {
  const page = analyzePageSignals("https://accounts.google.com/", {
    hasPassword: true, formActions: ["https://other.example/"], title: "Google", heading: "", hiddenIframes: 5,
  }, 0);
  assert.equal(page.score, 0);
});
check("blog biasa dengan form login sendiri tidak diblokir", () => {
  const url = "https://blog-saya.example/wp-login.php";
  const page = analyzePageSignals(url, {
    hasPassword: true, formActions: [url], title: "Blog Saya", heading: "Masuk", hiddenIframes: 0,
  }, analyzeUrl(url).score);
  assert.equal(page.score, 0);
});

// --- feed URLhaus -----------------------------------------------------------------------
check("parseFeed", () => {
  const hosts = parseFeed([
    "################", "# komentar", "",
    "http://bad.example/mal.exe", "http://198.51.100.7:8080/x", "https://github.com/foo/bar.exe",
    "ftp://ftp.bad.example/payload", "ini bukan url",
  ].join("\n"));
  assert.deepEqual(hosts.sort(), ["198.51.100.7", "bad.example"]);
});

// --- helper host ------------------------------------------------------------------------
check("normalizeHostInput", () => {
  assert.equal(normalizeHostInput("https://www.Foo.com/path?q=1"), "foo.com");
  assert.equal(normalizeHostInput("  bar.co.id "), "bar.co.id");
  assert.equal(normalizeHostInput("bukan domain"), "");
  assert.equal(hostMatches("a.foo.com", "foo.com"), true);
  assert.equal(hostMatches("notfoo.com", "foo.com"), false);
});

check("skenario lab memakai domain reservasi dan level yang diharapkan", () => {
  const levels = Object.fromEntries(LAB_SCENARIOS.map((scenario) => [
    scenario.id,
    evaluateLabScenario(scenario.id).level,
  ]));
  assert.deepEqual(levels, {
    "ordinary-page": "safe",
    "lookalike-brand": "warn",
    "credential-exfiltration": "block",
  });
  assert.ok(LAB_SCENARIOS.every((scenario) => /\.(test|invalid)\//.test(scenario.url)));
});

console.log(`${passed} tes lulus${process.exitCode ? " — ADA YANG GAGAL" : ""}`);
