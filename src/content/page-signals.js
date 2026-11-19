// Kumpulkan sinyal dari isi halaman (form password, iframe tersembunyi, judul) → kirim ke background.
// Penilaian risiko dilakukan di background; script ini hanya mengamati.

(() => {
  if (window.top !== window) return;

  let lastReported = "";
  let reportTimer = 0;

  function collect() {
    const passwordInputs = [...document.querySelectorAll('input[type="password"]')];
    const forms = new Set(passwordInputs.map((input) => input.form).filter(Boolean));

    const formActions = [...forms].map((form) => {
      try {
        return new URL(form.getAttribute("action") || location.href, location.href).href;
      } catch {
        return location.href;
      }
    });

    const hiddenIframes = [...document.querySelectorAll("iframe[src]")].filter((frame) => {
      try {
        if (new URL(frame.src, location.href).hostname === location.hostname) return false;
      } catch {
        return false;
      }
      const style = getComputedStyle(frame);
      return frame.offsetWidth <= 1 || frame.offsetHeight <= 1 || style.display === "none" || style.visibility === "hidden";
    }).length;

    return {
      hasPassword: passwordInputs.length > 0,
      formActions,
      title: document.title ?? "",
      heading: document.querySelector("h1")?.textContent?.trim().slice(0, 120) ?? "",
      hiddenIframes,
    };
  }

  async function report() {
    const signals = collect();
    // Hanya kirim kalau ada sesuatu yang layak dinilai (hemat, tidak membangunkan service worker terus).
    if (!signals.hasPassword && signals.hiddenIframes < 2) return;
    const signature = JSON.stringify(signals);
    if (signature === lastReported) return;
    lastReported = signature;
    try {
      const verdict = await chrome.runtime.sendMessage({ type: "PAGE_SIGNALS", signals });
      if (lastReported === signature && verdict?.level === "warn") showBanner(verdict.reasons);
    } catch {
      if (lastReported === signature) lastReported = "";
    }
  }

  function scheduleReport() {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(report, 500);
  }

  function showBanner(reasons) {
    if (document.getElementById("azaya-shield-banner")) return;
    const host = document.createElement("div");
    host.id = "azaya-shield-banner";
    const root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      .bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647; display: flex; gap: 12px;
             align-items: center; padding: 10px 16px; background: #b45309; color: #fff;
             font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
      .msg { flex: 1; }
      button { background: rgba(255,255,255,.2); color: #fff; border: 0; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
    `;
    const bar = document.createElement("div");
    bar.className = "bar";
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = `⚠ Azaya Shield: halaman ini mencurigakan — jangan masukkan password atau data pribadi. (${reasons.slice(0, 2).join("; ")})`;
    const close = document.createElement("button");
    close.textContent = "Tutup";
    close.addEventListener("click", () => host.remove());
    bar.append(msg, close);
    root.append(style, bar);
    document.documentElement.appendChild(host);
  }

  new MutationObserver(scheduleReport).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["action", "class", "hidden", "src", "style", "type"],
  });
  report();
})();
