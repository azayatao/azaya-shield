// Lokasi palsu untuk navigator.geolocation.
// IMPORTANT: this script and its bridge communicate through page-visible DOM events.
// The nonce prevents accidental/stale messages; it is NOT a security boundary against
// hostile page JavaScript. Do not rely on this feature to protect sensitive location data
// from a deliberately adversarial page; see SECURITY-NOTES.md.

(() => {
  "use strict";
  const w = window;
  const CFG_EVENT = "__azg";
  const REQ_EVENT = "__azgq";
  const READY_EVENT = "__azgr";
  const proto = w.Geolocation && w.Geolocation.prototype;
  if (!proto) return;

  const nonceBytes = new Uint8Array(16);
  w.crypto.getRandomValues(nonceBytes);
  const configNonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  // Keep the existing API shape for compatibility, but do not describe this as stealth.
  const natives = new WeakMap();
  const origToString = Function.prototype.toString;
  const mask = (fn, name, length) => {
    Object.defineProperty(fn, "name", { value: name, configurable: true });
    Object.defineProperty(fn, "length", { value: length, configurable: true });
    natives.set(fn, `function ${name}() { [native code] }`);
    return fn;
  };
  const fakeToString = function toString() {
    const text = natives.get(this);
    return text !== undefined ? text : origToString.call(this);
  };
  natives.set(fakeToString, "function toString() { [native code] }");
  Object.defineProperty(Function.prototype, "toString", { value: fakeToString, writable: true, configurable: true, enumerable: false });
  const install = (target, name, fn) => Object.defineProperty(target, name, { value: fn, writable: true, enumerable: true, configurable: true });

  let cfg = null;
  const waiting = [];
  let timeoutId = 0;
  let configRequested = false;

  w.addEventListener(READY_EVENT, () => {
    if (configRequested) return;
    configRequested = true;
    w.dispatchEvent(new CustomEvent(REQ_EVENT, { detail: configNonce }));
  });

  w.addEventListener(CFG_EVENT, (event) => {
    try {
      if (cfg) return;
      const message = JSON.parse(event.detail);
      if (message?.nonce !== configNonce) return;
      const candidate = message.config;
      if (!candidate || typeof candidate !== "object" || typeof candidate.enabled !== "boolean") return;
      if (candidate.enabled && typeof candidate.block !== "boolean") return;
      if (candidate.enabled && !candidate.block) {
        if (!Number.isFinite(candidate.lat) || candidate.lat < -90 || candidate.lat > 90 ||
            !Number.isFinite(candidate.lon) || candidate.lon < -180 || candidate.lon > 180) return;
        if (candidate.accuracy !== undefined && (!Number.isFinite(candidate.accuracy) || candidate.accuracy < 5 || candidate.accuracy > 5000)) return;
      }
      cfg = {
        enabled: candidate.enabled,
        block: candidate.enabled ? candidate.block : false,
        lat: candidate.lat,
        lon: candidate.lon,
        accuracy: candidate.accuracy,
      };
      clearTimeout(timeoutId);
      for (const fn of waiting.splice(0)) fn();
    } catch { /* malformed or stale page event */ }
  });

  function whenReady(fn) {
    if (cfg) return fn();
    waiting.push(fn);
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        if (!cfg) cfg = { enabled: true, block: true };
        for (const queued of waiting.splice(0)) queued();
      }, 3000);
    }
  }

  const rand = () => Math.random();
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2;

  function jittered(lat, lon, accuracy) {
    const meters = accuracy / 3;
    const dLat = (gauss() * meters) / 111320;
    const cosLat = Math.max(0.01, Math.abs(Math.cos((lat * Math.PI) / 180)));
    const dLon = (gauss() * meters) / (111320 * cosLat);
    return [Math.max(-90, Math.min(90, lat + dLat)), Math.max(-180, Math.min(180, lon + dLon))];
  }

  function define(obj, props) {
    for (const [key, value] of Object.entries(props)) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: false });
    }
  }

  function makePosition() {
    const accuracy = Math.min(5000, Math.max(5, Number(cfg.accuracy) || 25));
    const [lat, lon] = jittered(cfg.lat, cfg.lon, accuracy);
    const coords = Object.create((w.GeolocationCoordinates && w.GeolocationCoordinates.prototype) || Object.prototype);
    define(coords, { latitude: lat, longitude: lon, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null });
    Object.defineProperty(coords, "toJSON", { value: () => ({ latitude: lat, longitude: lon, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null }), configurable: true });
    const position = Object.create((w.GeolocationPosition && w.GeolocationPosition.prototype) || Object.prototype);
    define(position, { coords, timestamp: Date.now() });
    Object.defineProperty(position, "toJSON", { value: () => ({ coords: coords.toJSON(), timestamp: position.timestamp }), configurable: true });
    return position;
  }

  function makeDeniedError() {
    const error = Object.create((w.GeolocationPositionError && w.GeolocationPositionError.prototype) || Object.prototype);
    define(error, { code: 1, message: "User denied Geolocation" });
    return error;
  }

  const later = (fn) => setTimeout(fn, 80 + rand() * 250);
  const original = { getCurrentPosition: proto.getCurrentPosition, watchPosition: proto.watchPosition, clearWatch: proto.clearWatch };
  const watches = new Map();
  let nextId = 900000;

  function respond(success, error) {
    if (cfg.block) {
      if (typeof error === "function") error(makeDeniedError());
      return;
    }
    if (typeof success === "function") success(makePosition());
  }

  const getCurrentPosition = {
    getCurrentPosition(success, error, options) {
      if (arguments.length < 1) throw new TypeError("Failed to execute 'getCurrentPosition': 1 argument required.");
      whenReady(() => {
        if (!cfg.enabled) return original.getCurrentPosition.call(this, success, error, options);
        later(() => respond(success, error));
      });
    },
  }.getCurrentPosition;

  const watchPosition = {
    watchPosition(success, error, options) {
      if (arguments.length < 1) throw new TypeError("Failed to execute 'watchPosition': 1 argument required.");
      const id = nextId++;
      const entry = { timer: 0, realId: null };
      watches.set(id, entry);
      whenReady(() => {
        if (!watches.has(id)) return;
        if (!cfg.enabled) {
          entry.realId = original.watchPosition.call(this, success, error, options);
          return;
        }
        later(() => { if (watches.has(id)) respond(success, error); });
        if (!cfg.block) entry.timer = setInterval(() => { if (watches.has(id)) respond(success, error); }, 8000 + rand() * 4000);
      });
      return id;
    },
  }.watchPosition;

  const clearWatch = {
    clearWatch(id) {
      const entry = watches.get(id);
      if (!entry) return original.clearWatch.apply(this, arguments);
      clearInterval(entry.timer);
      if (entry.realId !== null) original.clearWatch.call(this, entry.realId);
      watches.delete(id);
    },
  }.clearWatch;

  install(proto, "getCurrentPosition", mask(getCurrentPosition, "getCurrentPosition", 1));
  install(proto, "watchPosition", mask(watchPosition, "watchPosition", 1));
  install(proto, "clearWatch", mask(clearWatch, "clearWatch", 1));

  const permissionsProto = w.Permissions && w.Permissions.prototype;
  if (permissionsProto && typeof permissionsProto.query === "function") {
    const originalQuery = permissionsProto.query;
    const query = {
      query(descriptor) {
        const result = originalQuery.apply(this, arguments);
        if (!descriptor || descriptor.name !== "geolocation") return result;
        return result.then((status) => new Promise((resolve) => whenReady(() => {
          if (cfg.enabled) {
            const state = cfg.block ? "denied" : "granted";
            try { Object.defineProperty(status, "state", { get: () => state, configurable: true }); } catch { /* browser object may be immutable */ }
          }
          resolve(status);
        })));
      },
    }.query;
    install(permissionsProto, "query", mask(query, "query", 1));
  }
})();
