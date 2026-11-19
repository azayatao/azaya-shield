// Pengelola proxy: menerapkan profil proxy terpilih ke Chrome (chrome.proxy) dan mengisi login proxy.
// Ini yang mengubah IP publikmu — IP baru adalah milik server proxy yang kamu pakai.

import { buildPac, validateProfile } from "../shared/pac.js";

export function activeProfile(s) {
  return s.proxyProfiles.find((p) => p.id === s.proxyProfileId) ?? null;
}

async function setWebRtcPolicy(restrict) {
  if (!chrome.privacy?.network?.webRTCIPHandlingPolicy) return;
  const setting = chrome.privacy.network.webRTCIPHandlingPolicy;
  // Cegah WebRTC membocorkan IP asli di luar proxy.
  if (restrict) await setting.set({ value: "disable_non_proxied_udp" });
  else await setting.clear({});
}

/** Terapkan pengaturan proxy. Mengembalikan { active, message }. */
export async function applyProxy(s) {
  const profile = activeProfile(s);
  const wanted = s.proxyMode !== "off" && profile && !validateProfile(profile);

  if (!wanted) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    await setWebRtcPolicy(false);
    return { active: false, message: "Proxy mati — memakai koneksi langsung." };
  }

  const pacScript = buildPac({
    profile,
    mode: s.proxyMode,
    sites: s.proxySites,
    bypass: s.proxyBypass,
    failClosed: s.proxyFailClosed,
  });
  await chrome.proxy.settings.set({ value: { mode: "pac_script", pacScript: { data: pacScript } }, scope: "regular" });
  await setWebRtcPolicy(s.proxyBlockWebRTC);
  return { active: true, message: `Proxy aktif: ${profile.label}` };
}

// ---- login proxy (HTTP/HTTPS) ---------------------------------------------------------------
// Dipanggil Chrome saat proxy meminta kredensial. Satu kali percobaan per request, supaya salah
// password tidak membuat perulangan tanpa akhir.
export function registerProxyAuth(getSettings) {
  const tried = new Set();
  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      if (!details.isProxy) return callback({});
      if (tried.has(details.requestId)) return callback({ cancel: true });
      tried.add(details.requestId);
      if (tried.size > 500) tried.clear();
      getSettings()
        .then((s) => {
          const p = activeProfile(s);
          if (p?.username) callback({ authCredentials: { username: p.username, password: p.password ?? "" } });
          else callback({});
        })
        .catch(() => callback({}));
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"],
  );
}
