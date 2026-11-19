// Tes stub & rule (tanpa browser): node scripts/test-stubs.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exitCode = 1; }
}

function sandbox(extra = {}) {
  const slots = [];
  const ctx = {
    document: {
      querySelectorAll: () => slots,
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
      head: { appendChild() {} },
      documentElement: { appendChild() {} },
    },
    setTimeout: (fn) => { fn(); return 0; },
    ...extra,
  };
  ctx.window = ctx;
  return vm.createContext(ctx);
}
const run = (ctx, file) => vm.runInContext(read(`stubs/${file}`), ctx);

check("gpt: cmd lama dijalankan, rantai metode aman", () => {
  let ran = 0;
  const ctx = sandbox({ googletag: { cmd: [() => ran++] } });
  run(ctx, "gpt.js");
  vm.runInContext(`
    googletag.cmd.push(function () {
      googletag.defineSlot('/1/x', [300, 250], 'div-gpt-ad-1').addService(googletag.pubads()).setTargeting('a', 'b');
      googletag.pubads().enableSingleRequest().collapseEmptyDivs().addEventListener('slotRenderEnded', function () {});
      googletag.enableServices();
      googletag.display('div-gpt-ad-1');
      globalThis.__ok = (googletag.apiReady === true) && googletag.pubads().getSlots().length === 0 && String(googletag.pubads()) === '';
    });`, ctx);
  assert.equal(ran, 1);
  assert.equal(ctx.__ok, true);
});

check("adsbygoogle: loaded=true, push aman, antrean lama diproses", () => {
  const ctx = sandbox({ adsbygoogle: [{}, {}] });
  run(ctx, "adsbygoogle.js");
  assert.equal(ctx.adsbygoogle.loaded, true);
  assert.doesNotThrow(() => ctx.adsbygoogle.push({}));
});

check("adsbygoogle: slot ditandai unfilled", () => {
  const attrs = {};
  const slot = { setAttribute: (k, v) => (attrs[k] = v) };
  const ctx = sandbox();
  ctx.document.querySelectorAll = () => [slot];
  run(ctx, "adsbygoogle.js");
  ctx.adsbygoogle.push({});
  assert.equal(attrs["data-ad-status"], "unfilled");
});

check("ga: callback jalan, _gaq & dataLayer ada", () => {
  const ctx = sandbox();
  run(ctx, "ga.js");
  let got;
  ctx.ga("create", "UA-1", "auto");
  ctx.ga((t) => (got = t));
  assert.ok(got && typeof got.send === "function");
  assert.doesNotThrow(() => ctx._gaq.push(["_trackPageview"]));
  assert.ok(Array.isArray(ctx.dataLayer));
});

check("apstag: fetchBids tetap memanggil callback", () => {
  const ctx = sandbox();
  run(ctx, "apstag.js");
  let called = false;
  ctx.apstag.fetchBids({}, () => (called = true));
  assert.equal(called, true);
});

check("trackers & noop: tidak melempar error", () => {
  const ctx = sandbox();
  run(ctx, "trackers.js");
  run(ctx, "noop.js");
  assert.equal(typeof ctx.hj, "function");
  assert.equal(typeof ctx.clarity, "function");
});

check("semua stub idempoten (dimuat dua kali tidak error)", () => {
  for (const f of ["gpt.js", "adsbygoogle.js", "ga.js", "apstag.js", "trackers.js", "noop.js"]) {
    const ctx = sandbox();
    run(ctx, f);
    assert.doesNotThrow(() => run(ctx, f), f);
  }
});

for (const file of ["stubs-ads.json", "stubs-trackers.json"]) {
  check(`rules/${file}: id unik, target stub ada, prioritas > blokir`, () => {
    const rules = JSON.parse(read(`rules/${file}`));
    assert.equal(new Set(rules.map((r) => r.id)).size, rules.length);
    for (const r of rules) {
      assert.equal(r.action.type, "redirect");
      assert.ok(r.priority >= 2, `priority ${r.priority}`);
      assert.ok(existsSync(join(ROOT, r.action.redirect.extensionPath.slice(1))), r.action.redirect.extensionPath);
    }
  });
}

check("manifest: ruleset & file yang dirujuk ada", () => {
  const m = JSON.parse(read("manifest.json"));
  for (const r of m.declarative_net_request.rule_resources) assert.ok(existsSync(join(ROOT, r.path)), r.path);
  assert.ok(m.permissions.includes("scripting"));
  assert.ok(m.web_accessible_resources[0].resources.includes("stubs/*.js"));
  for (const cs of m.content_scripts) for (const f of cs.js) assert.ok(existsSync(join(ROOT, f)), f);
  assert.ok(m.content_scripts.some((cs) => cs.js.includes("src/content/email-guard.js")));
  assert.ok(existsSync(join(ROOT, "src/content/picker.js")));
  for (const f of ["src/pages/lab.html", "src/pages/lab.css", "src/pages/lab.js", "src/shared/lab-scenarios.js"]) {
    assert.ok(existsSync(join(ROOT, f)), f);
  }
});

if (!process.exitCode) console.log(`stubs & rules: ${passed} tes lulus`);
