// Element picker — dipakai untuk menyembunyikan overlay / pop-up bandel (mis. anti-adblock wall).
// Disuntik hanya saat diminta dari popup (chrome.scripting.executeScript), bukan content script permanen.
//
// Cara pakai: arahkan kursor ke elemen → klik → sesuaikan dengan ▲ Induk / ▼ Anak → Sembunyikan.
// Pintasan: ↑ induk • ↓ anak • Enter sembunyikan • Esc batal.
// Hasilnya disimpan per situs di chrome.storage.local (customHides) dan diterapkan oleh cosmetic.js.

(() => {
  if (window.__azayaPickerActive) return;
  window.__azayaPickerActive = true;

  // ---------- pembuat selector ------------------------------------------------------------
  const esc = (s) => CSS.escape(s);
  const unique = (sel, el) => {
    try {
      const found = document.querySelectorAll(sel);
      return found.length === 1 && found[0] === el;
    } catch {
      return false;
    }
  };
  const stableId = (el) =>
    el.id && !/\d{4,}/.test(el.id) && !/^[0-9a-f]{8,}$/i.test(el.id) && unique("#" + esc(el.id), el);
  const stableClasses = (el) =>
    [...el.classList].filter(
      (c) => c.length <= 32 && !/\d{3,}/.test(c) && !/^(css|sc|jsx|styled|emotion|svelte)[-_]/i.test(c) && !/^[_-]/.test(c),
    );

  function part(el) {
    let p = el.localName;
    const classes = stableClasses(el).slice(0, 2);
    if (classes.length) p += classes.map((c) => "." + esc(c)).join("");
    const parent = el.parentElement;
    if (parent) {
      const same = [...parent.children].filter((n) => n.localName === el.localName);
      if (same.length > 1) p += `:nth-of-type(${same.indexOf(el) + 1})`;
    }
    return p;
  }

  function buildSelector(el) {
    if (stableId(el)) return "#" + esc(el.id);
    const own = el.localName + stableClasses(el).slice(0, 3).map((c) => "." + esc(c)).join("");
    if (own.includes(".") && unique(own, el)) return own;

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node !== el && stableId(node)) {
        parts.unshift("#" + esc(node.id));
        break;
      }
      parts.unshift(part(node));
      const sel = parts.join(" > ");
      if (unique(sel, el)) return sel;
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // ---------- UI (shadow DOM tertutup supaya CSS situs tidak mengganggu) --------------------
  const root = document.createElement("div");
  root.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = root.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .box { position: fixed; border: 2px solid #14b8a6; background: rgba(20,184,166,.18); border-radius: 3px; pointer-events: none; display: none; }
      .tag { position: fixed; font: 11px/1.2 ui-monospace, Consolas, monospace; background: #0b1220; color: #5eead4; padding: 3px 6px; border-radius: 4px; pointer-events: none; display: none; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .panel { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(520px, 94vw); box-sizing: border-box;
        background: #121b2e; color: #e6edf7; border: 1px solid #223050; border-radius: 12px; padding: 12px 14px;
        font: 13px/1.45 system-ui, "Segoe UI", sans-serif; box-shadow: 0 10px 40px rgba(0,0,0,.5); pointer-events: auto; }
      .panel b { color: #5eead4; }
      .sel { margin: 8px 0; padding: 6px 8px; background: #0b1220; border-radius: 6px; font: 12px ui-monospace, Consolas, monospace; word-break: break-all; color: #cbd5e1; min-height: 1.4em; }
      .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      button { font: inherit; padding: 6px 11px; border-radius: 7px; border: 1px solid #223050; background: #18233b; color: #e6edf7; cursor: pointer; }
      button:hover:not(:disabled) { border-color: #14b8a6; }
      button:disabled { opacity: .4; cursor: default; }
      button.go { background: #14b8a6; border-color: #14b8a6; color: #04211e; font-weight: 600; }
      label { display: flex; gap: 6px; align-items: center; margin-top: 8px; color: #8b9ab5; cursor: pointer; }
      .spacer { flex: 1; }
    </style>
    <div class="box"></div>
    <div class="tag"></div>
    <div class="panel">
      <div id="hint"><b>Pilih elemen</b> yang mau disembunyikan — arahkan kursor lalu klik. <span style="color:#8b9ab5">Esc untuk batal.</span></div>
      <div class="sel" id="sel" hidden></div>
      <div class="row" id="actions" hidden>
        <button id="parent" title="Pilih elemen induk (↑)">▲ Induk</button>
        <button id="child" title="Pilih elemen anak (↓)">▼ Anak</button>
        <button id="repick">Pilih ulang</button>
        <span class="spacer"></span>
        <button id="cancel">Batal</button>
        <button id="ok" class="go">Sembunyikan</button>
      </div>
      <label id="unlockRow" hidden><input type="checkbox" id="unlock"> Buka kunci scroll &amp; hilangkan blur halaman</label>
    </div>`;
  document.documentElement.appendChild(root);

  const $ = (s) => shadow.querySelector(s);
  const box = $(".box"), tag = $(".tag");

  // ---------- state ----------------------------------------------------------------------------
  let hovered = null;
  let target = null;          // elemen terpilih (setelah klik)
  const childStack = [];      // riwayat untuk tombol "Anak"

  const isUsable = (el) => el && el !== document.documentElement && el !== document.body && el !== root;

  function place(el) {
    if (!el) { box.style.display = tag.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    tag.textContent = el.localName + (el.id ? "#" + el.id : "") + (el.classList[0] ? "." + el.classList[0] : "");
    Object.assign(tag.style, { display: "block", left: Math.max(4, r.left) + "px", top: Math.max(4, r.top - 22) + "px" });
  }

  function select(el) {
    target = el;
    place(el);
    const sel = buildSelector(el);
    $("#sel").hidden = false;
    $("#sel").textContent = sel;
    $("#hint").innerHTML = "<b>Elemen terpilih.</b> Kalau yang tersorot belum pas, gunakan ▲ Induk / ▼ Anak.";
    $("#actions").hidden = false;
    $("#unlockRow").hidden = false;
    $("#ok").disabled = !isUsable(el);
    $("#parent").disabled = !el.parentElement || !isUsable(el.parentElement);
    $("#child").disabled = !childStack.length;
    // Kalau halaman terkunci scroll-nya (ciri khas overlay), centang otomatis.
    const locked = [document.documentElement, document.body].some((n) => n && getComputedStyle(n).overflow === "hidden");
    $("#unlock").checked = locked;
  }

  function cleanup() {
    for (const [type, fn, opt] of listeners) window.removeEventListener(type, fn, opt);
    root.remove();
    window.__azayaPickerActive = false;
  }

  async function confirm() {
    if (!target || !isUsable(target)) return;
    const selector = $("#sel").textContent;
    const unlockScroll = $("#unlock").checked;
    const key = location.hostname.replace(/^www\./, "");

    const { customHides = {} } = await chrome.storage.local.get("customHides");
    const entry = customHides[key] ?? { selectors: [], unlockScroll: false };
    if (!entry.selectors.includes(selector)) entry.selectors.push(selector);
    entry.unlockScroll = entry.unlockScroll || unlockScroll;
    customHides[key] = entry;
    await chrome.storage.local.set({ customHides });

    // Terapkan langsung tanpa reload.
    const css = `${selector} { display: none !important; }` + (unlockScroll ? "\nhtml, body { overflow: auto !important; filter: none !important; }" : "");
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch {
      const el = document.createElement("style");
      el.textContent = css;
      document.documentElement.appendChild(el);
    }
    cleanup();
  }

  // ---------- event ----------------------------------------------------------------------------
  const onMove = (e) => {
    if (target || e.target === root) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!isUsable(el)) { hovered = null; place(null); return; }
    hovered = el;
    place(el);
  };
  const swallow = (e) => {
    if (e.target === root) return; // klik di panel kita sendiri
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onClick = (e) => {
    if (e.target === root) return;
    swallow(e);
    if (target) return; // sudah terpilih; gunakan tombol panel
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (isUsable(el)) { childStack.length = 0; select(el); }
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); cleanup(); }
    else if (target && e.key === "ArrowUp") { e.preventDefault(); goParent(); }
    else if (target && e.key === "ArrowDown") { e.preventDefault(); goChild(); }
    else if (target && e.key === "Enter") { e.preventDefault(); confirm(); }
  };
  const onScrollResize = () => place(target || hovered);

  function goParent() {
    const p = target?.parentElement;
    if (p && isUsable(p)) { childStack.push(target); select(p); }
  }
  function goChild() {
    const c = childStack.pop();
    if (c) select(c);
  }

  const listeners = [
    ["mousemove", onMove, true],
    ["click", onClick, true],
    ["mousedown", swallow, true],
    ["mouseup", swallow, true],
    ["pointerdown", swallow, true],
    ["pointerup", swallow, true],
    ["keydown", onKey, true],
    ["scroll", onScrollResize, true],
    ["resize", onScrollResize, true],
  ];
  for (const [type, fn, opt] of listeners) window.addEventListener(type, fn, opt);

  $("#parent").addEventListener("click", goParent);
  $("#child").addEventListener("click", goChild);
  $("#repick").addEventListener("click", () => {
    target = null;
    childStack.length = 0;
    $("#sel").hidden = $("#actions").hidden = $("#unlockRow").hidden = true;
    $("#hint").innerHTML = "<b>Pilih elemen</b> yang mau disembunyikan — arahkan kursor lalu klik.";
    place(null);
  });
  $("#cancel").addEventListener("click", cleanup);
  $("#ok").addEventListener("click", confirm);
})();
