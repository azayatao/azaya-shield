import { getSettings, setSettings } from "../shared/settings.js";
import { getRegistrableDomain } from "../shared/url-analyzer.js";
import { hostMatches } from "../shared/hosts.js";
import { validateProfile } from "../shared/pac.js";
import { pickRandomProxyProfile } from "../shared/proxy-profiles.js";

const $ = (selector) => document.querySelector(selector);
const WARNING_URL = chrome.runtime.getURL("src/pages/warning.html");

const LEVELS = {
  safe: ["Aman", "Tidak ada tanda bahaya yang terdeteksi."],
  warn: ["Mencurigakan", "Hati-hati — jangan masukkan password atau data pribadi."],
  block: ["Berbahaya", "Situs ini diblokir oleh Azaya Shield."],
  skip: ["Tidak dianalisis", "Halaman internal browser atau jaringan lokal."],
};

function renderStatus(level, reasons = []) {
  const [title, sub] = LEVELS[level];
  $("#status").className = `status ${level}`;
  $("#statusTitle").textContent = title;
  $("#statusSub").textContent = sub;
  $("#reasons").replaceChildren(
    ...reasons.map((text) => Object.assign(document.createElement("li"), { textContent: text })),
  );
}

function bindToggles(settings) {
  document.querySelectorAll("input[data-key]").forEach((input) => {
    input.checked = Boolean(settings[input.dataset.key]);
    input.addEventListener("change", () => setSettings({ [input.dataset.key]: input.checked }));
  });
}

async function countBlockedOnPage(tabId, since) {
  try {
    const query = since ? { tabId, minTimeStamp: since } : { tabId };
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules(query);
    return rulesMatchedInfo.filter((m) => m.rule.rulesetId !== "_dynamic").length;
  } catch {
    return null; // kena rate limit / tidak tersedia
  }
}

function setupPauseButton(tab, url, settings) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  const button = $("#pauseSite");
  const paused = () => settings.adAllowlist.some((entry) => hostMatches(host, entry));
  const label = () => (button.textContent = paused() ? "Aktifkan lagi ad blocker di situs ini" : "Jeda ad blocker di situs ini");

  button.hidden = false;
  label();
  button.addEventListener("click", async () => {
    const entry = /^[\d.]+$/.test(host) ? host : getRegistrableDomain(host);
    settings.adAllowlist = paused()
      ? settings.adAllowlist.filter((e) => !hostMatches(host, e))
      : [...settings.adAllowlist, entry];
    await setSettings({ adAllowlist: settings.adAllowlist });
    await chrome.runtime.sendMessage({ type: "SYNC_RULES" }); // pastikan rule sudah terpasang sebelum reload
    label();
    chrome.tabs.reload(tab.id);
  });
}

function setupPicker(tab, host, settings) {
  $("#pickerBox").hidden = false;

  const refresh = () => {
    const mine = Object.entries(settings.customHides ?? {}).filter(([key]) => hostMatches(host, key));
    const total = mine.reduce((n, [, v]) => n + (v.selectors?.length ?? 0), 0);
    $("#hidesInfo").hidden = total === 0;
    $("#hidesCount").textContent = `${total} elemen disembunyikan di situs ini`;
  };
  refresh();

  $("#pickElement").addEventListener("click", async () => {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content/picker.js"] });
      window.close(); // tutup popup supaya halaman bisa diklik
    } catch (err) {
      $("#pickElement").textContent = "Tidak bisa dipakai di halaman ini";
      $("#pickElement").disabled = true;
      console.warn(err);
    }
  });

  $("#clearHides").addEventListener("click", async (e) => {
    e.preventDefault();
    const hides = { ...(settings.customHides ?? {}) };
    for (const key of Object.keys(hides)) if (hostMatches(host, key)) delete hides[key];
    settings.customHides = hides;
    await setSettings({ customHides: hides });
    refresh();
    chrome.tabs.reload(tab.id);
  });
}

function setupProxy(settings) {
  const select = $("#proxySelect");
  const randomButton = $("#proxyRandom");
  const hint = $("#proxyHint");
  const profiles = settings.proxyProfiles ?? [];
  const validProfiles = profiles.filter((profile) => !validateProfile(profile));
  hint.hidden = false;

  if (!profiles.length) {
    hint.textContent = "Belum ada proxy. Tambahkan di Pengaturan lanjutan.";
    return;
  }
  select.hidden = false;
  const off = Object.assign(document.createElement("option"), { value: "", textContent: "Mati (IP asli)" });
  select.replaceChildren(off, ...profiles.map((p) => {
    const option = Object.assign(document.createElement("option"), {
      value: p.id,
      textContent: validateProfile(p) ? `${p.label} (profil tidak valid)` : p.label,
    });
    option.disabled = Boolean(validateProfile(p));
    return option;
  }));
  randomButton.hidden = false;
  randomButton.disabled = validProfiles.length < 2;
  const activeProfileId = settings.proxyMode !== "off" && profiles.some((p) => p.id === settings.proxyProfileId)
    ? settings.proxyProfileId
    : "";
  select.value = activeProfileId;

  const describe = (mode, id) => {
    if (!id || mode === "off") return "Proxy mati — situs melihat IP aslimu.";
    const profile = profiles.find((p) => p.id === id);
    if (!profile || validateProfile(profile)) return "Profil proxy tidak valid — koneksi langsung dipakai.";
    return mode === "sites" ? "Proxy aktif untuk situs tertentu saja (atur di Pengaturan)." : "Proxy aktif untuk semua situs.";
  };
  hint.textContent = describe(settings.proxyMode, activeProfileId);

  const updateProxy = async (profileId, mode) => {
    await setSettings({ proxyProfileId: profileId, proxyMode: mode });
    const result = await chrome.runtime.sendMessage({ type: "SYNC_PROXY" });
    if (result?.error) throw new Error(result.error);
    if (mode !== "off" && !result?.active) throw new Error(result?.message || "Proxy tidak aktif.");
    settings.proxyProfileId = profileId;
    settings.proxyMode = mode;
  };

  select.addEventListener("change", async () => {
    if (!select.value) {
      try {
        await updateProxy(settings.proxyProfileId, "off");
        hint.textContent = describe("off", "");
      } catch (err) {
        hint.textContent = `Gagal mematikan proxy: ${err.message}`;
      }
      return;
    }
    const mode = settings.proxyMode === "off" ? "all" : settings.proxyMode;
    try {
      await updateProxy(select.value, mode);
      hint.textContent = describe(mode, select.value);
    } catch (err) {
      hint.textContent = `Gagal mengaktifkan proxy: ${err.message}`;
    }
  });

  randomButton.addEventListener("click", async () => {
    const profile = pickRandomProxyProfile(validProfiles, settings.proxyProfileId);
    if (!profile) {
      hint.textContent = "Tidak ada profil proxy valid. Periksa profil di Pengaturan.";
      return;
    }
    const mode = settings.proxyMode === "off" ? "all" : settings.proxyMode;
    randomButton.disabled = true;
    try {
      await updateProxy(profile.id, mode);
      select.value = profile.id;
      hint.textContent = `${describe(mode, profile.id)} Dipilih acak: ${profile.label}.`;
    } catch (err) {
      hint.textContent = `Gagal mengganti proxy: ${err.message}`;
    } finally {
      randomButton.disabled = validProfiles.length < 2;
    }
  });
}

function setupGeo(settings) {
  const select = $("#placeSelect");
  const hint = $("#geoHint");
  const places = settings.fakePlaces ?? [];

  if (!places.length) {
    hint.hidden = false;
    hint.textContent = "Belum ada tempat. Tambahkan di Pengaturan; permintaan lokasi akan ditolak sampai ada tempat terpilih.";
    return;
  }
  select.hidden = false;
  select.replaceChildren(
    ...places.map((p) => Object.assign(document.createElement("option"), { value: p.id, textContent: p.label })),
  );
  select.value = places.some((p) => p.id === settings.fakePlaceId) ? settings.fakePlaceId : "";
  if (!select.value) {
    select.prepend(Object.assign(document.createElement("option"), { value: "", textContent: "— pilih tempat —", selected: true }));
  }
  select.addEventListener("change", async () => {
    if (!select.value) {
      await setSettings({ fakePlaceId: "" });
      return;
    }
    await setSettings({ fakePlaceId: select.value, fakeLocation: true });
    document.querySelector('input[data-key="fakeLocation"]').checked = true;
    hint.textContent = "Lokasi browser aktif. Di Google Maps, klik tombol lokasi saya untuk menguji; tampilan awal bisa memakai lokasi IP. Muat ulang halaman.";
  });
  hint.hidden = false;
  hint.textContent = settings.fakeLocation
    ? "Lokasi browser aktif. Di Google Maps, klik tombol lokasi saya untuk menguji; tampilan awal bisa memakai lokasi IP. Muat ulang halaman."
    : "Pilih tempat untuk mengaktifkan lokasi browser; ini tidak mengubah lokasi IP.";
}

async function init() {
  const settings = await getSettings();
  bindToggles(settings);
  setupGeo(settings);
  setupProxy(settings);
  $("#threatsCount").textContent = settings.threatsBlocked.toLocaleString("id-ID");
  $("#openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  $("#openLab").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/lab.html") });
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return renderStatus("skip");

  // Tab sedang menampilkan halaman peringatan → tampilkan info situs yang diblokir.
  if (tab.url.startsWith(WARNING_URL)) {
    const params = new URL(tab.url).searchParams;
    let reasons = [];
    try { reasons = JSON.parse(params.get("reasons") ?? "[]"); } catch { /* abaikan */ }
    try { $("#host").textContent = new URL(params.get("url")).hostname; } catch { /* abaikan */ }
    $("#adsCount").textContent = "–";
    return renderStatus("block", reasons);
  }

  if (!/^https?:/.test(tab.url)) {
    $("#host").textContent = "Halaman browser";
    return renderStatus("skip");
  }

  $("#host").textContent = new URL(tab.url).hostname;
  setupPauseButton(tab, tab.url, settings);
  setupPicker(tab, new URL(tab.url).hostname, settings);

  const status = await chrome.runtime.sendMessage({ type: "GET_TAB_STATUS", tabId: tab.id, url: tab.url });
  if (!status || status.error || status.skipped) renderStatus("skip");
  else renderStatus(status.level, status.reasons.map((r) => r.label));

  const count = await countBlockedOnPage(tab.id, status?.at);
  $("#adsCount").textContent = count === null ? "–" : String(count);
}

init();
