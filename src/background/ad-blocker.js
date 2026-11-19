// Mengatur ruleset declarativeNetRequest (iklan & pelacak) dan allowlist per situs.

/** Sinkronkan ruleset statis dengan pengaturan pengguna. */
export async function syncRulesets(settings) {
  const enable = [];
  const disable = [];
  (settings.adBlock ? enable : disable).push("ads");
  (settings.trackerBlock ? enable : disable).push("trackers");
  // Stub hanya aktif bersama rule blokirnya (stub prioritasnya lebih tinggi dari blokir).
  (settings.adBlock && settings.stubScripts ? enable : disable).push("stubs_ads");
  (settings.trackerBlock && settings.stubScripts ? enable : disable).push("stubs_trackers");
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable,
  });
}

/**
 * Situs di allowlist → semua request di halaman itu dibebaskan (priority lebih tinggi dari rule block).
 * Semua rule dinamis milik extension ini adalah allowlist, jadi aman diganti total.
 */
export async function syncAllowlist(hosts) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = hosts.map((host, i) => ({
    id: i + 1,
    priority: 100,
    action: { type: "allowAllRequests" },
    condition: { requestDomains: [host], resourceTypes: ["main_frame", "sub_frame"] },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules,
  });
}

/** Tampilkan jumlah request yang diblokir per tab sebagai badge ikon. */
export function enableBadgeCounter() {
  return chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
}
