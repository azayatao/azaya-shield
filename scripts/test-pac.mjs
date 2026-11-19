// Tes PAC proxy: node scripts/test-pac.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { buildPac, validateProfile } from "../src/shared/pac.js";
import { pickRandomProxyProfile } from "../src/shared/proxy-profiles.js";

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exitCode = 1; }
}
const route = (pac, host) => vm.runInNewContext(pac + `;FindProxyForURL("https://${host}/", "${host}")`);
const profile = { scheme: "http", host: "proxy.example.com", port: 8080 };

check("mode all: semua lewat proxy, lokal & server proxy langsung", () => {
  const pac = buildPac({ profile, mode: "all" });
  assert.equal(route(pac, "example.org"), "PROXY proxy.example.com:8080");
  for (const h of ["localhost", "127.0.0.1", "192.168.1.5", "10.0.0.2", "172.20.1.1", "nas", "printer.local", "proxy.example.com"]) {
    assert.equal(route(pac, h), "DIRECT", h);
  }
  assert.equal(route(pac, "172.32.0.1"), "PROXY proxy.example.com:8080"); // bukan rentang privat
});

check("mode all + bypass (termasuk subdomain, bukan domain mirip)", () => {
  const pac = buildPac({ profile, mode: "all", bypass: ["bank.co.id"] });
  assert.equal(route(pac, "bank.co.id"), "DIRECT");
  assert.equal(route(pac, "ib.bank.co.id"), "DIRECT");
  assert.equal(route(pac, "notbank.co.id"), "PROXY proxy.example.com:8080");
});

check("mode sites: hanya daftar yang lewat proxy", () => {
  const pac = buildPac({ profile, mode: "sites", sites: ["whatismyipaddress.com"] });
  assert.equal(route(pac, "www.whatismyipaddress.com"), "PROXY proxy.example.com:8080");
  assert.equal(route(pac, "google.com"), "DIRECT");
});

check("fail closed vs fallback langsung", () => {
  assert.equal(route(buildPac({ profile, failClosed: true }), "a.com"), "PROXY proxy.example.com:8080");
  assert.equal(route(buildPac({ profile, failClosed: false }), "a.com"), "PROXY proxy.example.com:8080; DIRECT");
});

check("pemetaan jenis proxy", () => {
  const f = (scheme) => route(buildPac({ profile: { ...profile, scheme } }), "a.com");
  assert.equal(f("https"), "HTTPS proxy.example.com:8080");
  assert.equal(f("socks5"), "SOCKS5 proxy.example.com:8080");
  assert.equal(f("socks4"), "SOCKS proxy.example.com:8080");
});

check("validasi profil menolak input berbahaya / tidak masuk akal", () => {
  assert.notEqual(validateProfile({ ...profile, host: 'x"; return "DIRECT' }), "");
  assert.notEqual(validateProfile({ ...profile, host: "http://a.com" }), "");
  assert.notEqual(validateProfile({ ...profile, host: "bad..example.com" }), "");
  assert.notEqual(validateProfile({ ...profile, host: "-bad.example.com" }), "");
  assert.notEqual(validateProfile({ ...profile, host: "256.1.2.3" }), "");
  assert.notEqual(validateProfile({ ...profile, port: 0 }), "");
  assert.notEqual(validateProfile({ ...profile, port: 70000 }), "");
  assert.notEqual(validateProfile({ ...profile, scheme: "ftp" }), "");
  assert.notEqual(validateProfile({ ...profile, scheme: "toString" }), "");
  assert.notEqual(validateProfile({ ...profile, scheme: "socks5", username: "u" }), "");
  assert.equal(validateProfile({ ...profile, username: "u", password: "p" }), "");
  assert.throws(() => buildPac({ profile: { ...profile, host: "a b" } }));
});

check("daftar situs disaring: karakter aneh tidak masuk ke PAC", () => {
  const pac = buildPac({ profile, mode: "sites", sites: ['evil.com"); return "DIRECT', "ok.com"] });
  assert.equal(route(pac, "ok.com"), "PROXY proxy.example.com:8080");
  assert.ok(!pac.includes("evil"));
});

check("PAC tidak memakai fungsi yang memicu DNS lokal", () => {
  const pac = buildPac({ profile });
  assert.ok(!/dnsResolve|isInNet|isResolvable/.test(pac));
});

check("pilih proxy acak menghindari profil aktif dan profil tidak valid", () => {
  const profiles = [
    { id: "current", ...profile },
    { id: "next", ...profile, host: "next.example.com" },
    { id: "bad", ...profile, host: "bad..example.com" },
  ];
  assert.equal(pickRandomProxyProfile(profiles, "current")?.id, "next");
  assert.equal(pickRandomProxyProfile([profiles[2]], "bad"), null);
});

if (!process.exitCode) console.log(`proxy/PAC: ${passed} tes lulus`);
