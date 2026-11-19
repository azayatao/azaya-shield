// Tes daftar blokir URLhaus (tanpa browser): node scripts/test-blocklist.mjs
import assert from "node:assert/strict";

const storage = { blocklistFeed: ["malware.example"] };
globalThis.chrome = {
  storage: {
    local: { get: async () => ({ blocklistFeed: storage.blocklistFeed }) },
    onChanged: { addListener() {} },
  },
};

const { isBlocklisted } = await import("../src/background/blocklist.js");

assert.equal(await isBlocklisted("malware.example", [], true), "urlhaus");
assert.equal(await isBlocklisted("malware.example", [], false), null);
assert.equal(await isBlocklisted("custom.example", ["custom.example"], false), "custom");

console.log("blocklist: 3 tes lulus");
