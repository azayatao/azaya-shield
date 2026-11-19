// Daftar situs berbahaya: feed URLhaus (abuse.ch) + daftar buatan pengguna.

import { getSettings } from "../shared/settings.js";
import { hostMatches } from "../shared/hosts.js";
import { parseFeed } from "../shared/feed-parser.js";

// Daftar URL malware yang masih online (lisensi CC0), satu URL per baris.
const FEED_URL = "https://urlhaus.abuse.ch/downloads/text_online/";

let feedCache = null; // Set<string> hostname

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "blocklistFeed" in changes) feedCache = null;
});

async function loadFeed() {
  if (feedCache) return feedCache;
  const { blocklistFeed = [] } = await chrome.storage.local.get("blocklistFeed");
  feedCache = new Set(blocklistFeed);
  return feedCache;
}

/** @returns {Promise<string|null>} sumber yang cocok ("custom" | "urlhaus") atau null */
export async function isBlocklisted(hostname, customList = [], useUrlhaus = true) {
  if (customList.some((entry) => hostMatches(hostname, entry))) return "custom";
  if (!useUrlhaus) return null;
  const feed = await loadFeed();
  return feed.has(hostname) ? "urlhaus" : null;
}

export async function updateFeed({ force = false } = {}) {
  const settings = await getSettings();
  if (!settings.useUrlhaus && !force) return { skipped: true };

  const { feedMeta = {} } = await chrome.storage.local.get("feedMeta");
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hosts = parseFeed(await res.text());
    await chrome.storage.local.set({
      blocklistFeed: hosts,
      feedMeta: { updatedAt: Date.now(), count: hosts.length },
    });
    return { ok: true, count: hosts.length };
  } catch (err) {
    const error = String(err?.message ?? err);
    await chrome.storage.local.set({ feedMeta: { ...feedMeta, error, failedAt: Date.now() } });
    return { ok: false, error };
  }
}
