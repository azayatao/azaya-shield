// Stub Google Analytics (analytics.js / ga.js): ga(), _gaq, dataLayer, dan tracker palsu.
(function () {
  try {
    var w = window;
    if (w.ga && w.ga.__azayaStub) return;

    var tracker = {
      get: function () { return undefined; },
      set: function () {},
      send: function () {},
    };
    var queued = Array.isArray(w.ga && w.ga.q) ? w.ga.q.slice() : [];

    function ga() {
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === "function") {
          try { arguments[i](tracker); } catch (e) {}
        }
      }
    }
    ga.__azayaStub = true;
    ga.loaded = true;
    ga.create = function () { return tracker; };
    ga.getByName = function () { return tracker; };
    ga.getAll = function () { return [tracker]; };
    ga.remove = function () {};
    w.ga = ga;
    w.GoogleAnalyticsObject = "ga";
    for (var i = 0; i < queued.length; i++) ga.apply(null, queued[i]);

    // ga.js (versi lama)
    var q = Array.isArray(w._gaq) ? w._gaq : [];
    w._gaq = {
      push: function () {
        for (var i = 0; i < arguments.length; i++) {
          try { if (typeof arguments[i] === "function") arguments[i](); } catch (e) {}
        }
        return 0;
      },
      _getAsyncTracker: function () { return tracker; },
    };
    w._gat = { _getTracker: function () { return tracker; }, _createTracker: function () { return tracker; } };
    w._gaq.push.apply(w._gaq, q);

    w.dataLayer = w.dataLayer || [];
  } catch (e) {}
})();
