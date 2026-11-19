// Stub pelacak umum: Hotjar (hj), Microsoft Clarity (clarity), Bing UET (uetq).
(function () {
  try {
    var w = window;
    if (typeof w.hj !== "function") { w.hj = function () {}; w.hj.q = []; }
    w._hjSettings = w._hjSettings || {};
    if (typeof w.clarity !== "function") w.clarity = function () {};
    if (!w.uetq || Array.isArray(w.uetq)) w.uetq = { push: function () { return 0; } };
  } catch (e) {}
})();
