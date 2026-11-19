// Tes perlindungan email dan login situs (tanpa browser): node scripts/test-email-guard.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { containsProtectedEmail, parseProtectedEmailList } from "../src/shared/email-guard.js";

const parsed = parseProtectedEmailList("  Main.User@example.com\nmain.user@example.com\nnot-an-email");
assert.deepEqual(parsed.emails, ["main.user@example.com"]);
assert.deepEqual(parsed.invalid, ["not-an-email"]);
assert.equal(containsProtectedEmail(["MAIN.USER@EXAMPLE.COM"], parsed.emails), true);
assert.equal(containsProtectedEmail(["another@example.com"], parsed.emails), false);
assert.equal(containsProtectedEmail(["contact me at main.user@example.com please"], parsed.emails), true);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "src/content/email-guard.js"), "utf8");
const listeners = {};
const nodes = [];
function makeNode(tag) {
  const node = {
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    handlers: {},
    append(...children) { this.children.push(...children); },
    attachShadow() { return makeNode("shadow-root"); },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    remove() { this.removed = true; },
  };
  nodes.push(node);
  return node;
}
const document = {
  addEventListener(type, handler) { listeners[type] = handler; },
  createElement: makeNode,
  documentElement: { append() {} },
};
const settings = {
  emailGuardEnabled: true,
  protectedEmails: ["main.user@example.com"],
  loginGuardEnabled: false,
  loginGuardSites: [],
};
let onStorageChanged;
const messages = [];
const chrome = {
  storage: {
    local: { get: async () => ({ ...settings }) },
    onChanged: { addListener: (listener) => { onStorageChanged = listener; } },
  },
  runtime: { sendMessage: async (message) => { messages.push(message); return { ok: true }; } },
};
let reSubmitted = false;
let secondSubmitPrevented = true;
class FakeHTMLFormElement {}
FakeHTMLFormElement.prototype.requestSubmit = function requestSubmit() {
  reSubmitted = true;
  const retry = makeSubmitEvent(this);
  listeners.submit(retry);
  secondSubmitPrevented = retry.prevented;
};
vm.runInNewContext(source, {
  document,
  chrome,
  console,
  location: { hostname: "study.example.com" },
  HTMLFormElement: FakeHTMLFormElement,
});
await new Promise((resolve) => setTimeout(resolve, 0));

const form = Object.assign(Object.create(FakeHTMLFormElement.prototype), {
  tagName: "FORM",
  querySelectorAll: () => [{ value: "MAIN.USER@example.com" }],
});
function makeSubmitEvent(target) {
  return {
    target,
    submitter: null,
    prevented: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() {},
  };
}
const original = makeSubmitEvent(form);
listeners.submit(original);
assert.equal(original.prevented, true);
const allowOnce = nodes.find((node) => node.textContent === "Izinkan sekali");
assert.ok(allowOnce);
allowOnce.handlers.click();
assert.equal(reSubmitted, true);
assert.equal(secondSubmitPrevented, false);

settings.loginGuardEnabled = true;
settings.loginGuardSites = ["study.example.com"];
onStorageChanged({ loginGuardEnabled: {}, loginGuardSites: {} }, "local");
await new Promise((resolve) => setTimeout(resolve, 0));
const passwordForm = Object.assign(Object.create(FakeHTMLFormElement.prototype), {
  tagName: "FORM",
  querySelector: () => ({ value: "password" }),
  querySelectorAll: () => [{ value: "student@example.net" }],
});
const passwordSubmit = makeSubmitEvent(passwordForm);
listeners.submit(passwordSubmit);
assert.equal(passwordSubmit.prevented, true);
const closeTab = nodes.find((node) => node.textContent === "Tutup tab");
assert.ok(closeTab);
closeTab.handlers.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(messages[0]?.type, "CLOSE_CURRENT_TAB");

console.log("email/login guard: 12 tes lulus");
