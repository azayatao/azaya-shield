// Otak deteksi ancaman: gabungkan heuristik URL, blocklist, Safe Browsing, dan sinyal halaman.

import { getSettings, setSettings } from "../shared/settings.js";
import { analyzeUrl, levelForScore } from "../shared/url-analyzer.js";
import { analyzePageSignals } from "../shared/page-analyzer.js";
import { isBlocklisted } from "./blocklist.js";
import { checkSafeBrowsing } from "./safe-browsing.js";

const WARNING_PAGE = "src/pages/warning.html";
const statusKey = (tabId) => `tabStatus:${tabId}`;

// ------------------------------------------------------------------ evaluasi

/**
 * @param {string} url
 * @param {object} settings
 * @param {{network?: boolean}} opts network=false → lewati Safe Browsing (dipakai saat analisis ulang)
 */
export async function evaluateUrl(url, settings, { network = true } = {}) {
  const base = analyzeUrl(url);
  if (base.skipped) return { level: "safe", score: 0, reasons: [], hostname: base.hostname, skipped: true };

  let score = base.score;
  const reasons = [...base.reasons];

  const listed = await isBlocklisted(base.hostname, settings.customBlocklist, settings.useUrlhaus);
  if (listed) {
    score += 100;
    reasons.push({
      code: "blocklist",
      points: 100,
      label: listed === "custom" ? "Ada di daftar blokir buatanmu" : "Terdaftar di database malware URLhaus",
    });
  } else if (network && settings.safeBrowsingKey) {
    const threat = await checkSafeBrowsing(url, settings.safeBrowsingKey);
    if (threat) {
      score += 100;
      reasons.push({ code: "safe-browsing", points: 100, label: `Google Safe Browsing menandai situs ini: ${threat}` });
    }
  }

  return {
    level: levelForScore(score, settings.warnThreshold, settings.blockThreshold),
    score,
    reasons,
    hostname: base.hostname,
  };
}

// ------------------------------------------------------------------ bypass & status tab

async function getBypassList() {
  const { bypassHosts = [] } = await chrome.storage.session.get("bypassHosts");
  return bypassHosts;
}

const isBypassed = async (host) => (await getBypassList()).includes(host);

/** Hanya halaman peringatan milik extension ini yang boleh meminta bypass. */
export async function addBypass(host, sender) {
  const fromWarningPage =
    sender?.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(WARNING_PAGE));
  if (!fromWarningPage || typeof host !== "string" || !host) return { ok: false };
  const list = await getBypassList();
  if (!list.includes(host)) await chrome.storage.session.set({ bypassHosts: [...list, host] });
  return { ok: true };
}

async function saveStatus(tabId, url, verdict) {
  await chrome.storage.session.set({ [statusKey(tabId)]: { ...verdict, url, at: Date.now() } });
}

async function readStatus(tabId) {
  const data = await chrome.storage.session.get(statusKey(tabId));
  return data[statusKey(tabId)] ?? null;
}

export const forgetTab = (tabId) => chrome.storage.session.remove(statusKey(tabId));

export async function getTabStatus(tabId, url) {
  const stored = await readStatus(tabId);
  if (stored && stored.url === url) return stored;
  const settings = await getSettings();
  return { ...(await evaluateUrl(url, settings, { network: false })), url, at: undefined };
}

// ------------------------------------------------------------------ aksi

export function buildWarningUrl(url, verdict) {
  const query = new URLSearchParams({
    url,
    score: String(verdict.score),
    reasons: JSON.stringify(verdict.reasons.map((r) => r.label)),
  });
  return `${chrome.runtime.getURL(WARNING_PAGE)}?${query}`;
}

async function blockTab(tabId, url, verdict) {
  const { threatsBlocked } = await getSettings();
  await setSettings({ threatsBlocked: threatsBlocked + 1 });
  try {
    await chrome.tabs.update(tabId, { url: buildWarningUrl(url, verdict) });
  } catch { /* tab sudah ditutup */ }
}

async function applyBadge(tabId, verdict) {
  if (verdict?.level !== "warn") return;
  try {
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#f59e0b" });
  } catch { /* tab sudah ditutup */ }
}

/** Badge per-tab di-reset browser saat navigasi commit, jadi pasang ulang dari status tersimpan. */
export async function restoreBadge(tabId) {
  await applyBadge(tabId, await readStatus(tabId));
}

// ------------------------------------------------------------------ entry point

/** Dipanggil sebelum navigasi main-frame. */
export async function guardNavigation(tabId, url) {
  const settings = await getSettings();
  if (!settings.threatProtection) return;

  const verdict = await evaluateUrl(url, settings);
  if (verdict.skipped) return;
  if (verdict.level === "block" && (await isBypassed(verdict.hostname))) verdict.level = "warn";

  await saveStatus(tabId, url, verdict);
  if (verdict.level === "block") await blockTab(tabId, url, verdict);
  else await applyBadge(tabId, verdict);
}

/** Dipanggil content script setelah halaman termuat. @returns verdict ringkas untuk banner, atau null. */
export async function onPageSignals(tab, signals) {
  if (!tab?.id || !tab.url || !signals) return null;
  const settings = await getSettings();
  if (!settings.threatProtection) return null;

  const base = await evaluateUrl(tab.url, settings, { network: false });
  if (base.skipped) return null;

  const page = analyzePageSignals(tab.url, signals, base.score);
  if (page.reasons.length === 0) return null; // tidak ada informasi baru

  const score = base.score + page.score;
  let level = levelForScore(score, settings.warnThreshold, settings.blockThreshold);
  if (level === "block" && (await isBypassed(base.hostname))) level = "warn";

  const verdict = { level, score, reasons: [...base.reasons, ...page.reasons], hostname: base.hostname };
  await saveStatus(tab.id, tab.url, verdict);

  if (level === "block") {
    await blockTab(tab.id, tab.url, verdict);
  } else if (level === "warn") {
    await applyBadge(tab.id, verdict);
  }
  return level === "safe" ? null : { level, reasons: verdict.reasons.map((r) => r.label) };
}
