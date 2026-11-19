// Tes perilaku content script email-guard (tanpa browser): node scripts/test-email-guard-content.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/content/email-guard.js"), "utf8");
let passed = 0;

function load(storageGet) {
  let submitHandler;
  const ctx = {
    document: { addEventListener: (type, fn) => type === "submit" && (submitHandler = fn), createElement: () => ({ style: {}, append() {}, addEventListener() {}, attachShadow: () => ({ append() {} }) }), documentElement: { append() {} } },
    chrome: { storage: { local: { get: storageGet }, onChanged: { addListener() {} } }, runtime: {} },
    location: { hostname: "example.com" },
    HTMLFormElement: { prototype: {} },
    Promise, WeakSet, Array, Set, String, Boolean, console: { error() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return (valueInForm) => {
    let prevented = false;
    const form = { tagName: "FORM", querySelector: () => null, querySelectorAll: () => [{ value: valueInForm }] };
    submitHandler({ target: form, preventDefault: () => (prevented = true), stopImmediatePropagation() {}, submitter: null });
    return prevented;
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exitCode = 1; }
}

await check("pengaturan belum termuat: form TIDAK diblokir", async () => {
  const submit = load(() => new Promise(() => {})); // tidak pernah selesai
  assert.equal(submit("saya@mail.com"), false);
});

await check("pengaturan gagal dimuat: form TIDAK diblokir", async () => {
  const submit = load(() => Promise.reject(new Error("gagal")));
  await tick();
  assert.equal(submit("saya@mail.com"), false);
});

await check("fitur mati: form tidak diblokir", async () => {
  const submit = load(async () => ({ emailGuardEnabled: false, protectedEmails: ["saya@mail.com"] }));
  await tick();
  assert.equal(submit("saya@mail.com"), false);
});

await check("fitur aktif + email terlindungi: diblokir; email lain lolos", async () => {
  const submit = load(async () => ({ emailGuardEnabled: true, protectedEmails: ["saya@mail.com"] }));
  await tick();
  assert.equal(submit("Halo SAYA@mail.com"), true);
  assert.equal(submit("orang@lain.com"), false);
});

if (!process.exitCode) console.log(`email-guard (content): ${passed} tes lulus`);
