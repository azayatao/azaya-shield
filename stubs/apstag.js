// Stub Amazon apstag (header bidding): callback tetap dipanggil supaya halaman tidak menunggu.
(function () {
  try {
    var w = window;
    if (w.apstag && w.apstag.__azayaStub) return;
    w.apstag = {
      __azayaStub: true,
      init: function () {},
      fetchBids: function (cfg, cb) { if (typeof cb === "function") setTimeout(function () { cb([]); }, 0); },
      setDisplayBids: function () {},
      targetingKeys: function () { return []; },
      renderImp: function () {},
      punt: function () {},
      _Q: [],
    };
  } catch (e) {}
})();
