// Tes sinyal halaman dinamis (tanpa browser): node scripts/test-page-signals.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(ROOT, "src/content/page-signals.js"), "utf8");
const passwordInputs = [];
const reports = [];
let onMutation;
const page = {
  top: null,
  document: {
    title: "Halaman",
    documentElement: { appendChild() {} },
    querySelectorAll(selector) {
      if (selector === 'input[type="password"]') return passwordInputs;
      return [];
    },
    querySelector() { return null; },
    getElementById() { return null; },
  },
  location: { href: "https://contoh.invalid/login", hostname: "contoh.invalid" },
  URL,
  chrome: {
    runtime: {
      sendMessage: async (message) => {
        reports.push(message);
        return { level: "safe" };
      },
    },
  },
  setTimeout,
  clearTimeout,
  MutationObserver: class {
    constructor(callback) { onMutation = callback; }
    observe() {}
  },
};
page.top = page;
page.window = page;
vm.runInNewContext(source, page);

await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(reports.length, 0);

passwordInputs.push({ form: { getAttribute: () => "/submit" } });
onMutation();
await new Promise((resolve) => setTimeout(resolve, 550));
assert.equal(reports.length, 1);
assert.equal(reports[0].signals.formActions.length, 1);
assert.equal(reports[0].signals.formActions[0], "https://contoh.invalid/submit");

passwordInputs[0].form.getAttribute = () => "https://collector.invalid/submit";
onMutation();
await new Promise((resolve) => setTimeout(resolve, 550));
assert.equal(reports.length, 2);
assert.equal(reports[1].signals.formActions.length, 1);
assert.equal(reports[1].signals.formActions[0], "https://collector.invalid/submit");

console.log("page signals: 2 tes lulus");
