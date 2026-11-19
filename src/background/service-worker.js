// Service worker Azaya Shield — hanya merangkai modul; logika ada di file masing-masing.

import { getSettings } from "../shared/settings.js";
import { syncRulesets, syncAllowlist, enableBadgeCounter } from "./ad-blocker.js";
import { updateFeed } from "./blocklist.js";
import { applyProxy, registerProxyAuth } from "./proxy.js";
import {
  guardNavigation,
  restoreBadge,
  onPageSignals,
  getTabStatus,
  addBypass,
  forgetTab,
} from "./threat-guard.js";

const FEED_ALARM = "azaya-feed-update";

async function syncAdRules() {
  const s = await getSettings();
  await syncRulesets(s);
  await syncAllowlist(s.adAllowlist);
}

async function syncProxy() {
  return applyProxy(await getSettings());
}

// Pendengar login proxy harus didaftarkan saat service worker dimulai (bukan di dalam fungsi async).
registerProxyAuth(getSettings);

async function bootstrap() {
  await Promise.allSettled([syncAdRules(), enableBadgeCounter(), syncProxy()]);
  if (!(await chrome.alarms.get(FEED_ALARM))) {
    chrome.alarms.create(FEED_ALARM, { delayInMinutes: 1, periodInMinutes: 720 }); // tiap 12 jam
  }
}

chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(bootstrap);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FEED_ALARM) updateFeed().catch(console.warn);
});

// Pengaturan berubah dari popup/opsi → sinkronkan rule iklan.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("adBlock" in changes || "trackerBlock" in changes || "stubScripts" in changes || "adAllowlist" in changes) {
    syncAdRules().catch(console.warn);
  }
});

const PROXY_KEYS = ["proxyMode", "proxyProfiles", "proxyProfileId", "proxySites", "proxyBypass", "proxyFailClosed", "proxyBlockWebRTC"];
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && PROXY_KEYS.some((k) => k in changes)) syncProxy().catch(console.warn);
});

// Cek setiap navigasi halaman utama (bukan iframe).
const HTTP_ONLY = { url: [{ schemes: ["http", "https"] }] };

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) guardNavigation(details.tabId, details.url).catch(console.warn);
}, HTTP_ONLY);

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) restoreBadge(details.tabId).catch(console.warn);
}, HTTP_ONLY);

chrome.tabs.onRemoved.addListener((tabId) => forgetTab(tabId));

// Pesan dari content script / popup / halaman peringatan / opsi.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  route(msg, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: String(err?.message ?? err) }));
  return true; // respons async
});

async function route(msg, sender) {
  switch (msg?.type) {
    case "PAGE_SIGNALS":
      return onPageSignals(sender.tab, msg.signals);
    case "GET_TAB_STATUS":
      return getTabStatus(msg.tabId, msg.url);
    case "BYPASS":
      return addBypass(msg.host, sender);
    case "SYNC_RULES":
      await syncAdRules();
      return { ok: true };
    case "SYNC_PROXY":
      return syncProxy();
    case "CLOSE_CURRENT_TAB":
      if (sender?.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) || !/^https?:/.test(sender.url ?? "")) {
        return { ok: false };
      }
      await chrome.tabs.remove(sender.tab.id);
      return { ok: true };
    case "UPDATE_FEED":
      return updateFeed({ force: true });
    default:
      return null;
  }
}
