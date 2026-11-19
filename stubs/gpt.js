// Stub Google Publisher Tag (gpt.js). Semua metode googletag.* aman dipanggil dan bisa dirantai.
(function () {
  try {
    var w = window;
    if (w.googletag && w.googletag.__azayaStub) return;

    var chain; // objek no-op yang bisa dirantai tanpa batas
    var special = {
      getSlots: function () { return []; },
      getSlotElementId: function () { return ""; },
      getAdUnitPath: function () { return ""; },
      getTargeting: function () { return []; },
      getTargetingKeys: function () { return []; },
      getResponseInformation: function () { return null; },
      isEmpty: function () { return true; },
      toString: function () { return ""; },
      valueOf: function () { return 0; },
    };
    chain = new Proxy(function () {}, {
      get: function (_, key) {
        if (key === "then") return undefined;
        if (key === Symbol.toPrimitive) return function () { return ""; };
        if (key === "length") return 0;
        if (Object.prototype.hasOwnProperty.call(special, key)) return special[key];
        return chain;
      },
      apply: function () { return chain; },
      construct: function () { return chain; },
    });

    var old = w.googletag && Array.isArray(w.googletag.cmd) ? w.googletag.cmd.slice() : [];
    var base = {
      __azayaStub: true,
      apiReady: true,
      pubadsReady: true,
      cmd: {
        push: function () {
          for (var i = 0; i < arguments.length; i++) {
            try { if (typeof arguments[i] === "function") arguments[i](); } catch (e) {}
          }
          return 0;
        },
      },
      pubads: function () { return chain; },
      companionAds: function () { return chain; },
      content: function () { return chain; },
      defineSlot: function () { return chain; },
      defineOutOfPageSlot: function () { return chain; },
      defineUnit: function () { return chain; },
      sizeMapping: function () { return chain; },
      enableServices: function () {},
      display: function () {},
      destroySlots: function () { return true; },
      getVersion: function () { return "azaya-stub"; },
      openConsole: function () {},
    };
    w.googletag = new Proxy(base, {
      get: function (target, key) { return key in target ? target[key] : chain; },
    });
    base.cmd.push.apply(base.cmd, old);
  } catch (e) {}
})();
