// Lokasi palsu — berjalan di "main world" (dunia yang sama dengan skrip situs) pada document_start.
// Menimpa navigator.geolocation supaya situs yang meminta lokasi mendapat koordinat pilihan pengguna.
// Konfigurasi datang dari geo-bridge.js (dunia terisolasi, yang bisa membaca chrome.storage) lewat event DOM.
//
// Prinsip aman: kalau konfigurasi belum sampai, permintaan MENUNGGU (bukan diteruskan ke GPS asli).
// Kalau fitur aktif tapi belum ada tempat yang dipilih, permintaan ditolak (PERMISSION_DENIED),
// supaya lokasi asli tidak pernah bocor karena lupa memilih.

(() => {
  "use strict";
  const w = window;
  const CFG_EVENT = "__azg";   // bridge → main : konfigurasi (JSON string)
  const REQ_EVENT = "__azgq";  // main → bridge : minta konfigurasi
  const READY_EVENT = "__azgr"; // bridge → main : siap menerima permintaan konfigurasi
  const proto = w.Geolocation && w.Geolocation.prototype;
  if (!proto) return;

  const nonceBytes = new Uint8Array(16);
  w.crypto.getRandomValues(nonceBytes);
  const configNonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  // ---- menyamarkan fungsi tiruan agar toString() terlihat "native" ------------------------------
  const natives = new WeakMap();
  const origToString = Function.prototype.toString;
  const fakeToString = function toString() {
    const text = natives.get(this);
    return text !== undefined ? text : origToString.call(this);
  };
  natives.set(fakeToString, "function toString() { [native code] }");
  Object.defineProperty(Function.prototype, "toString", { value: fakeToString, writable: true, configurable: true, enumerable: false });
  const mask = (fn, name, length) => {
    Object.defineProperty(fn, "name", { value: name, configurable: true });
    Object.defineProperty(fn, "length", { value: length, configurable: true });
    natives.set(fn, `function ${name}() { [native code] }`);
    return fn;
  };
  const install = (target, name, fn) =>
    Object.defineProperty(target, name, { value: fn, writable: true, enumerable: true, configurable: true });

  // ---- konfigurasi ---------------------------------------------------------------------------
  let cfg = null;
  const waiting = [];
  let timeoutId = 0;
  let configRequested = false;

  w.addEventListener(READY_EVENT, () => {
    if (configRequested) return;
    configRequested = true;
    w.dispatchEvent(new CustomEvent(REQ_EVENT, { detail: configNonce }));
  });

  w.addEventListener(CFG_EVENT, (e) => {
    try {
      if (cfg) return;
      const message = JSON.parse(e.detail);
      if (message?.nonce !== configNonce) return;
      const c = message.config;
      if (!c || typeof c !== "object" || typeof c.enabled !== "boolean") return;
      if (c.enabled && !c.block) {
        if (!Number.isFinite(c.lat) || c.lat < -90 || c.lat > 90 ||
            !Number.isFinite(c.lon) || c.lon < -180 || c.lon > 180) return;
      }
      cfg = c;
      clearTimeout(timeoutId);
      for (const fn of waiting.splice(0)) fn();
    } catch { /* abaikan */ }
  });

  function whenReady(fn) {
    if (cfg) return fn();
    waiting.push(fn);
    if (!timeoutId) {
      // Konfigurasi tak kunjung datang → tolak (jangan bocorkan lokasi asli).
      timeoutId = setTimeout(() => {
        if (!cfg) cfg = { enabled: true, block: true };
        for (const f of waiting.splice(0)) f();
      }, 3000);
    }
  }

  // ---- membangun objek posisi ---------------------------------------------------------------
  const rand = () => Math.random();
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2; // ≈ -1..1, condong ke tengah

  function jittered(lat, lon, accuracy) {
    const meters = accuracy / 3;
    const dLat = (gauss() * meters) / 111320;
    const dLon = (gauss() * meters) / (111320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
    return [lat + dLat, lon + dLon];
  }

  function define(obj, props) {
    for (const [k, v] of Object.entries(props)) {
      Object.defineProperty(obj, k, { value: v, enumerable: true, configurable: true, writable: false });
    }
  }

  function makePosition() {
    const accuracy = Math.min(5000, Math.max(5, Number(cfg.accuracy) || 25));
    const [lat, lon] = jittered(cfg.lat, cfg.lon, accuracy);
    const coords = Object.create((w.GeolocationCoordinates && w.GeolocationCoordinates.prototype) || Object.prototype);
    define(coords, {
      latitude: lat, longitude: lon, accuracy,
      altitude: null, altitudeAccuracy: null, heading: null, speed: null,
    });
    Object.defineProperty(coords, "toJSON", {
      value: () => ({ latitude: lat, longitude: lon, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null }),
      configurable: true,
    });
    const pos = Object.create((w.GeolocationPosition && w.GeolocationPosition.prototype) || Object.prototype);
    define(pos, { coords, timestamp: Date.now() });
    Object.defineProperty(pos, "toJSON", {
      value: () => ({ coords: coords.toJSON(), timestamp: pos.timestamp }),
      configurable: true,
    });
    return pos;
  }

  function makeDeniedError() {
    const err = Object.create((w.GeolocationPositionError && w.GeolocationPositionError.prototype) || Object.prototype);
    define(err, { code: 1, message: "User denied Geolocation" });
    return err;
  }

  const later = (fn) => setTimeout(fn, 80 + rand() * 250); // GPS asli tidak membalas instan

  // ---- penimpaan metode ---------------------------------------------------------------------
  const orig = {
    getCurrentPosition: proto.getCurrentPosition,
    watchPosition: proto.watchPosition,
    clearWatch: proto.clearWatch,
  };
  const watches = new Map(); // id palsu → { timer, realId }
  let nextId = 900000;       // jauh dari id asli (kecil) supaya tidak bentrok

  function respond(success, error) {
    if (cfg.block) {
      if (typeof error === "function") error(makeDeniedError());
      return false;
    }
    if (typeof success === "function") success(makePosition());
    return true;
  }

  const getCurrentPosition = {
    getCurrentPosition(success, error, options) {
      if (arguments.length < 1) {
        throw new TypeError("Failed to execute 'getCurrentPosition' on 'Geolocation': 1 argument required, but only 0 present.");
      }
      whenReady(() => {
        if (!cfg.enabled) return orig.getCurrentPosition.call(this, success, error, options);
        later(() => respond(success, error));
      });
    },
  }.getCurrentPosition;

  const watchPosition = {
    watchPosition(success, error, options) {
      if (arguments.length < 1) {
        throw new TypeError("Failed to execute 'watchPosition' on 'Geolocation': 1 argument required, but only 0 present.");
      }
      const id = nextId++;
      const entry = { timer: 0, realId: null };
      watches.set(id, entry);
      whenReady(() => {
        if (!watches.has(id)) return; // sudah di-clear
        if (!cfg.enabled) {
          entry.realId = orig.watchPosition.call(this, success, error, options);
          return;
        }
        const tick = () => respond(success, error);
        later(tick);
        if (!cfg.block) entry.timer = setInterval(tick, 8000 + rand() * 4000);
      });
      return id;
    },
  }.watchPosition;

  const clearWatch = {
    clearWatch(id) {
      const entry = watches.get(id);
      if (!entry) return orig.clearWatch.apply(this, arguments);
      clearInterval(entry.timer);
      if (entry.realId !== null) orig.clearWatch.call(this, entry.realId);
      watches.delete(id);
    },
  }.clearWatch;

  install(proto, "getCurrentPosition", mask(getCurrentPosition, "getCurrentPosition", 1));
  install(proto, "watchPosition", mask(watchPosition, "watchPosition", 1));
  install(proto, "clearWatch", mask(clearWatch, "clearWatch", 1));

  // ---- Permissions API: laporkan "granted" supaya situs tidak mengira lokasi diblokir --------------
  const P = w.Permissions && w.Permissions.prototype;
  if (P && typeof P.query === "function") {
    const origQuery = P.query;
    const query = {
      query(desc) {
        const result = origQuery.apply(this, arguments);
        if (!desc || desc.name !== "geolocation") return result;
        return result.then(
          (status) =>
            new Promise((resolve) =>
              whenReady(() => {
                if (cfg.enabled) {
                  const state = cfg.block ? "denied" : "granted";
                  try { Object.defineProperty(status, "state", { get: () => state, configurable: true }); } catch { /* abaikan */ }
                }
                resolve(status);
              }),
            ),
        );
      },
    }.query;
    install(P, "query", mask(query, "query", 1));
  }

})();
