// Mencegah alamat email pribadi terkirim lewat submit form tanpa persetujuan eksplisit.

(() => {
  let enabled = false;
  let loginGuardEnabled = false;
  let settingsReady = false;
  let protectedEmails = [];
  let loginGuardSites = [];
  let activeNotice = null;
  const allowedSubmissions = new WeakSet();

  function applySettings(settings) {
    enabled = Boolean(settings.emailGuardEnabled);
    protectedEmails = Array.isArray(settings.protectedEmails)
      ? settings.protectedEmails.filter((email) => typeof email === "string").map((email) => email.trim().toLowerCase()).filter(Boolean)
      : [];
    loginGuardEnabled = Boolean(settings.loginGuardEnabled);
    loginGuardSites = Array.isArray(settings.loginGuardSites)
      ? settings.loginGuardSites.filter((host) => typeof host === "string").map((host) => host.trim().toLowerCase()).filter(Boolean)
      : [];
    settingsReady = true;
  }

  function showWarning(form, submitter, text, { allowOnce = true, closeTab = false } = {}) {
    activeNotice?.remove();

    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      .panel { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); width: min(520px, 94vw);
        box-sizing: border-box; padding: 14px 16px; border: 1px solid #92400e; border-radius: 12px;
        background: #1c1917; color: #fff7ed; box-shadow: 0 8px 32px rgba(0,0,0,.45);
        font: 14px/1.45 system-ui, sans-serif; pointer-events: auto; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      button { border: 1px solid #78716c; border-radius: 7px; padding: 6px 10px; color: inherit;
        background: #292524; font: inherit; cursor: pointer; }
      button.allow { background: #b45309; border-color: #b45309; }
    `;
    const panel = document.createElement("section");
    panel.className = "panel";
    const message = document.createElement("div");
    message.textContent = text;
    const actions = document.createElement("div");
    actions.className = "actions";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Tutup";
    close.addEventListener("click", () => {
      host.remove();
      activeNotice = null;
    });
    actions.append(close);
    if (closeTab) {
      const exit = document.createElement("button");
      exit.type = "button";
      exit.textContent = "Tutup tab";
      exit.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "CLOSE_CURRENT_TAB" })
          .then((response) => {
            if (response?.ok) return;
            message.textContent = "Tab tidak dapat ditutup otomatis. Tutup tab ini secara manual.";
          })
          .catch((error) => {
            console.error("Azaya Shield gagal menutup tab.", error);
            message.textContent = "Tab tidak dapat ditutup otomatis. Tutup tab ini secara manual.";
          });
      });
      actions.append(exit);
    }
    if (allowOnce) {
      const allow = document.createElement("button");
      allow.type = "button";
      allow.className = "allow";
      allow.textContent = "Izinkan sekali";
      allow.addEventListener("click", () => {
        host.remove();
        activeNotice = null;
        const requestSubmit = HTMLFormElement.prototype.requestSubmit;
        if (typeof requestSubmit !== "function") return;
        allowedSubmissions.add(form);
        if (submitter?.form === form) requestSubmit.call(form, submitter);
        else requestSubmit.call(form);
        Promise.resolve().then(() => allowedSubmissions.delete(form));
      });
      actions.append(allow);
    }
    panel.append(message, actions);
    shadow.append(style, panel);
    document.documentElement.append(host);
    activeNotice = host;
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form || form.tagName !== "FORM") return;
    if (allowedSubmissions.has(form)) {
      allowedSubmissions.delete(form);
      return;
    }
    // Pengaturan belum termuat (beberapa milidetik pertama, atau gagal dimuat): jangan ganggu form.
    if (!settingsReady) return;

    const loginGuardMatches = loginGuardEnabled &&
      loginGuardSites.some((entry) => location.hostname.toLowerCase() === entry || location.hostname.toLowerCase().endsWith("." + entry)) &&
      form.querySelector('input[type="password"]');
    const values = enabled && protectedEmails.length
      ? [...form.querySelectorAll("input, textarea, select")].map((control) => String(control.value ?? "").toLowerCase())
      : [];
    const emailGuardMatches = protectedEmails.some((email) => values.some((value) => value.includes(email)));
    if (!loginGuardMatches && !emailGuardMatches) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (loginGuardMatches) {
      showWarning(
        form,
        event.submitter,
        "Situs ini meminta pengiriman form password. Pengiriman dibatalkan; ini tidak mengeluarkan akun dari sesi situs.",
        { closeTab: true },
      );
    } else {
      showWarning(
        form,
        event.submitter,
        "Form ini memuat email yang kamu tandai sebagai pribadi. Pengiriman dibatalkan agar tidak terkirim tanpa sengaja.",
      );
    }
  }, true);

  const defaults = {
    emailGuardEnabled: false,
    protectedEmails: [],
    loginGuardEnabled: false,
    loginGuardSites: [],
  };
  chrome.storage.local.get(defaults)
    .then(applySettings)
    .catch((error) => console.error("Azaya Shield gagal memuat perlindungan email.", error));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!("emailGuardEnabled" in changes) && !("protectedEmails" in changes) &&
        !("loginGuardEnabled" in changes) && !("loginGuardSites" in changes))) return;
    chrome.storage.local.get(defaults)
      .then(applySettings)
      .catch((error) => console.error("Azaya Shield gagal memperbarui perlindungan email.", error));
  });
})();
