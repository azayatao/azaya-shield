import assert from "node:assert/strict";
import vm from "node:vm";
import { buildPac, validateProfile } from "../src/shared/pac.js";

const route = (pac, host) => vm.runInNewContext(`${pac};FindProxyForURL("https://${host}/", ${JSON.stringify(host)})`);
const profile = { scheme: "http", host: "proxy.example.com", port: 8080 };

assert.equal(validateProfile(profile), "");
assert.equal(route(buildPac({ profile }), "example.org"), "PROXY proxy.example.com:8080");
assert.equal(route(buildPac({ profile, mode: "sites", sites: ["example.org"] }), "www.example.org"), "PROXY proxy.example.com:8080");
assert.equal(route(buildPac({ profile, mode: "all", bypass: ["bank.co.id"] }), "ib.bank.co.id"), "DIRECT");
assert.equal(route(buildPac({ profile, mode: "all", bypass: ["bank.co.id"] }), "notbank.co.id"), "PROXY proxy.example.com:8080");
assert.equal(route(buildPac({ profile, failClosed: false }), "example.org"), "PROXY proxy.example.com:8080; DIRECT");
for (const host of ["localhost", "printer.local", "10.0.0.1", "192.168.1.2", "172.20.0.1", "100.64.0.1", "169.254.2.3", "proxy.example.com"]) {
  assert.equal(route(buildPac({ profile }), host), "DIRECT", host);
}
for (const bad of [
  { ...profile, host: 'x"; return "DIRECT' },
  { ...profile, host: "bad..example.com" },
  { ...profile, port: 70000 },
  { ...profile, scheme: "toString" },
  { ...profile, scheme: "socks5", username: "u" },
]) assert.notEqual(validateProfile(bad), "");
assert.throws(() => buildPac({ profile, mode: "weird" }));
const filtered = buildPac({ profile, mode: "sites", sites: ['evil.com"); return "DIRECT', "ok.com"] });
assert.ok(!filtered.includes("evil"));
assert.ok(!/dnsResolve|isInNet|isResolvable/.test(buildPac({ profile })));
console.log("PAC security tests passed.");
