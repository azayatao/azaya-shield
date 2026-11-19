// Tes lokasi palsu (tanpa browser): node scripts/test-geo.mjs
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "src/content/geo-spoof-main.js"), "utf8");
const BRIDGE_SRC = readFileSync(join(ROOT, "src/content/geo-bridge.js"), "utf8");
let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.stack}`); process.exitCode = 1; }
}

// Lingkungan peramban tiruan: Geolocation asli (mencatat panggilan) + Permissions.
function makeEnv() {
  const calls = { real: 0, realWatch: 0, realClear: [] };
  const target = new EventTarget();
  let config = null;
  let challenge = "";
  class Geolocation {
    getCurrentPosition(ok) { calls.real++; ok?.({ real: true }); }
    watchPosition() { calls.realWatch++; return 7; }
    clearWatch(id) { calls.realClear.push(id); }
  }
  class GeolocationPosition {}
  class GeolocationCoordinates {}
  class GeolocationPositionError {}
  class Permissions { query() { return Promise.resolve({ state: "prompt" }); } }
  target.addEventListener("__azgq", (event) => {
    challenge = event.detail;
    if (config) {
      target.dispatchEvent(new CustomEvent("__azg", {
        detail: JSON.stringify({ nonce: challenge, config }),
      }));
    }
  });
  const ctx = {
    Geolocation, GeolocationPosition, GeolocationCoordinates, GeolocationPositionError, Permissions,
    CustomEvent, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Object, Function, Promise, TypeError, Number,
    Uint8Array, crypto: { getRandomValues: (bytes) => bytes.fill(7) },
    addEventListener: (...a) => target.addEventListener(...a),
    dispatchEvent: (e) => target.dispatchEvent(e),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const geo = new Geolocation();
  const send = (cfg) => {
    config = cfg;
    target.dispatchEvent(new CustomEvent("__azgr"));
  };
  const forge = (cfg, nonce = challenge) => target.dispatchEvent(new CustomEvent("__azg", {
    detail: JSON.stringify({ nonce, config: cfg }),
  }));
  return { ctx, geo, calls, send, forge, perms: new Permissions() };
}
function makeBridgeEnv(settings) {
  const calls = { real: 0 };
  const target = new EventTarget();
  class Geolocation {
    getCurrentPosition(ok) { calls.real++; ok?.({ real: true }); }
    watchPosition() { return 7; }
    clearWatch() {}
  }
  class GeolocationPosition {}
  class GeolocationCoordinates {}
  class GeolocationPositionError {}
  const ctx = {
    Geolocation, GeolocationPosition, GeolocationCoordinates, GeolocationPositionError,
    CustomEvent, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Object, Function, Promise, TypeError, Number,
    Uint8Array, crypto: { getRandomValues: (bytes) => bytes.fill(7) },
    chrome: { storage: { local: { get: async (defaults) => ({ ...defaults, ...settings }) }, onChanged: { addListener() {} } } },
    addEventListener: (...a) => target.addEventListener(...a),
    dispatchEvent: (e) => target.dispatchEvent(e),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  vm.runInContext(BRIDGE_SRC, ctx);
  return { geo: new Geolocation(), calls };
}
const getPos = (geo) => new Promise((resolve, reject) => geo.getCurrentPosition(resolve, reject));
const metersBetween = (a, b, c, d) => Math.hypot((a - c) * 111320, (b - d) * 111320 * Math.cos((a * Math.PI) / 180));

await check("aktif: koordinat dekat tempat pilihan, GPS asli tidak dipanggil", async () => {
  const { geo, calls, send } = makeEnv();
  send({ enabled: true, lat: -7.2459, lon: 112.7378, accuracy: 30 });
  const pos = await getPos(geo);
  assert.equal(calls.real, 0);
  assert.ok(metersBetween(pos.coords.latitude, pos.coords.longitude, -7.2459, 112.7378) < 30);
  assert.equal(pos.coords.accuracy, 30);
  assert.equal(pos.coords.altitude, null);
  assert.equal(typeof pos.timestamp, "number");
  assert.equal(JSON.parse(JSON.stringify(pos)).coords.latitude, pos.coords.latitude);
});

await check("bridge memuat tempat terpilih dari storage setelah reload", async () => {
  const { geo, calls } = makeBridgeEnv({
    fakeLocation: true,
    fakePlaces: [
      { id: "old-place", lat: -7.2459, lon: 112.7378 },
      { id: "new-place", lat: 35.6762, lon: 139.6503 },
    ],
    fakePlaceId: "new-place",
    fakeAccuracy: 25,
  });
  const pos = await getPos(geo);
  assert.equal(calls.real, 0);
  assert.ok(metersBetween(pos.coords.latitude, pos.coords.longitude, 35.6762, 139.6503) < 25);
});

await check("permintaan sebelum konfigurasi tiba ditunda, lalu dijawab", async () => {
  const { geo, calls, send } = makeEnv();
  const p = getPos(geo);
  assert.equal(calls.real, 0);
  send({ enabled: true, lat: 1.3521, lon: 103.8198, accuracy: 20 });
  const pos = await p;
  assert.ok(Math.abs(pos.coords.latitude - 1.3521) < 0.01);
});

await check("nonaktif: diteruskan ke GPS asli", async () => {
  const { geo, calls, send } = makeEnv();
  send({ enabled: false });
  const pos = await getPos(geo);
  assert.equal(calls.real, 1);
  assert.equal(pos.real, true);
});

await check("aktif tapi belum pilih tempat (block): ditolak, tidak bocor", async () => {
  const { geo, calls, send } = makeEnv();
  send({ enabled: true, block: true });
  await assert.rejects(getPos(geo), (err) => err.code === 1);
  assert.equal(calls.real, 0);
});

await check("event halaman tidak bisa mematikan spoof lokasi yang sudah aktif", async () => {
  const { geo, calls, send, forge } = makeEnv();
  send({ enabled: true, lat: -6.1754, lon: 106.8272, accuracy: 25 });
  forge({ enabled: false });
  await getPos(geo);
  assert.equal(calls.real, 0);
});

await check("event konfigurasi tanpa nonce yang benar diabaikan", async () => {
  const { geo, calls, forge, send } = makeEnv();
  forge({ enabled: false }, "nonce-palsu");
  send({ enabled: true, lat: 1.3521, lon: 103.8198, accuracy: 20 });
  await getPos(geo);
  assert.equal(calls.real, 0);
});

await check("watchPosition: callback berulang, clearWatch menghentikan", async () => {
  const { geo, calls, send } = makeEnv();
  send({ enabled: true, lat: -6.1754, lon: 106.8272, accuracy: 25 });
  let n = 0;
  const id = geo.watchPosition(() => n++);
  assert.ok(id >= 900000);
  await new Promise((r) => setTimeout(r, 450));
  assert.ok(n >= 1);
  geo.clearWatch(id);
  assert.equal(calls.realWatch, 0);
  assert.deepEqual(calls.realClear, []);
});

await check("clearWatch id asli diteruskan ke fungsi asli", () => {
  const { geo, calls, send } = makeEnv();
  send({ enabled: true, lat: 0, lon: 0, accuracy: 25 });
  geo.clearWatch(3);
  assert.deepEqual(calls.realClear, [3]);
});

await check("tanpa argumen melempar TypeError seperti aslinya", () => {
  const { geo, send } = makeEnv();
  send({ enabled: true, lat: 0, lon: 0 });
  assert.throws(() => geo.getCurrentPosition(), TypeError);
});

await check("toString fungsi tiruan terlihat native", () => {
  const { geo, ctx, send } = makeEnv();
  send({ enabled: true, lat: 0, lon: 0 });
  const text = vm.runInContext("Function.prototype.toString.call(Geolocation.prototype.getCurrentPosition)", ctx);
  assert.match(text, /\[native code\]/);
  assert.equal(geo.getCurrentPosition.name, "getCurrentPosition");
  assert.equal(geo.getCurrentPosition.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(geo, "getCurrentPosition"), false);
});

await check("Permissions.query('geolocation') → granted saat aktif", async () => {
  const { perms, send } = makeEnv();
  send({ enabled: true, lat: 0, lon: 0 });
  const status = await perms.query({ name: "geolocation" });
  assert.equal(status.state, "granted");
});

await check("lokasi aktif tanpa tempat → ditolak konsisten", async () => {
  const { perms, geo, calls, send } = makeEnv();
  send({ enabled: true, block: true });
  assert.equal((await perms.query({ name: "geolocation" })).state, "denied");
  await assert.rejects(getPos(geo), (err) => err.code === 1);
  assert.equal(calls.real, 0);
});

await check("Permissions.query nonaktif / bukan geolocation: tidak diubah", async () => {
  const { perms, send } = makeEnv();
  send({ enabled: false });
  assert.equal((await perms.query({ name: "geolocation" })).state, "prompt");
  const enabled = makeEnv();
  enabled.send({ enabled: true, lat: 0, lon: 0 });
  assert.equal((await enabled.perms.query({ name: "notifications" })).state, "prompt");
});

await check("posisi berbeda tiap permintaan (jitter), tetap di dekat titik", async () => {
  const { geo, send } = makeEnv();
  send({ enabled: true, lat: -7.2459, lon: 112.7378, accuracy: 60 });
  const a = await getPos(geo), b = await getPos(geo);
  assert.notEqual(a.coords.latitude, b.coords.latitude);
  assert.ok(metersBetween(a.coords.latitude, a.coords.longitude, -7.2459, 112.7378) < 60);
});

if (!process.exitCode) console.log(`lokasi palsu: ${passed} tes lulus`);
