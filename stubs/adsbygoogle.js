// Stub adsbygoogle.js — meniru perilaku asli: window.adsbygoogle jadi objek { loaded: true, push }.
// Slot <ins class="adsbygoogle"> ditandai "unfilled" (iklan tidak terisi), persis seperti yang
// dilakukan Google sendiri, sehingga detektor tidak membaca ini sebagai "diblokir".
(function () {
  try {
    var w = window;
    if (w.adsbygoogle && w.adsbygoogle.loaded === true && !Array.isArray(w.adsbygoogle)) return;
    var pending = Array.isArray(w.adsbygoogle) ? w.adsbygoogle.slice() : [];

    function markSlots() {
      try {
        var slots = document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])");
        for (var i = 0; i < slots.length; i++) {
          slots[i].setAttribute("data-adsbygoogle-status", "done");
          slots[i].setAttribute("data-ad-status", "unfilled");
        }
      } catch (e) {}
    }

    var stub = {
      loaded: true,
      push: function () { markSlots(); return 0; },
    };
    w.adsbygoogle = stub;
    for (var i = 0; i < pending.length; i++) stub.push(pending[i]);

    // CSS yang memang dipasang Google untuk slot yang tidak terisi.
    if (document && document.createElement && (document.head || document.documentElement)) {
      var st = document.createElement("style");
      st.textContent = 'ins.adsbygoogle[data-ad-status="unfilled"]{display:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}
})();
