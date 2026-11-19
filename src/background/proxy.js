// Proxy manager: applies the selected PAC profile and supplies credentials only to
// the exact HTTP(S) proxy endpoint configured by the user.
import { buildPac, validateProfile } from "../shared/pac.js";

const WEBRTC_BACKUP_KEY = "azayaProxyPreviousWebRtcPolicy";
const BLACKHOLE_PAC = 'function FindProxyForURL() { return "PROXY 127.0.0.1:9"; }';

export function activeProfile(settings) {
  const profiles = Array.isArray(settings?.proxyProfiles) ? settings.proxyProfiles : [];
  return profiles.find((profile) => profile && profile.id === settings.proxyProfileId) ?? null;
}

async function proxyControl() {
  try {
    return (await chrome.proxy.settings.get({})).levelOfControl;
  } catch {
    return "not_controllable";
  }
}

async function canControlProxy() {
  const level = await proxyControl();
  return level === "controlled_by_this_extension" || level === "controllable_by_this_extension";
}

async function setWebRtcPolicy(restrict) {
  const setting = chrome.privacy?.network?.webRTCIPHandlingPolicy;
  if (!setting) return { ok: false, message: "Kebijakan WebRTC tidak tersedia di browser ini." };

  const { [WEBRTC_BACKUP_KEY]: backup } = await chrome.storage.local.get(WEBRTC_BACKUP_KEY);
  if (restrict) {
    if (!backup) {
      const current = await setting.get({});
      if (current.levelOfControl === "controlled_by_other_extensions" || current.levelOfControl === "not_controllable") {
        return { ok: false, message: "Kebijakan WebRTC dikendalikan pihak lain; tidak diubah." };
      }
      await chrome.storage.local.set({ [WEBRTC_BACKUP_KEY]: { value: current.value } });
    }
    await setting.set({ value: "disable_non_proxied_udp" });
    return { ok: true };
  }

  if (!backup) return { ok: true };
  const current = await setting.get({});
  if (current.levelOfControl === "controlled_by_this_extension") {
    await setting.set({ value: backup.value });
  }
  await chrome.storage.local.remove(WEBRTC_BACKUP_KEY);
  return { ok: true };
}

function blackholePac() {
  return BLACKHOLE_PAC;
}

/** Apply browser proxy settings. Invalid active configuration fails closed. */
export async function applyProxy(settings) {
  const mode = settings?.proxyMode ?? "off";
  if (mode === "off") {
    if (!(await canControlProxy())) {
      return { active: false, ok: false, message: "Proxy tidak diubah: browser/proxy lain memegang kendali." };
    }
    await chrome.proxy.settings.clear({ scope: "regular" });
    const rtc = await setWebRtcPolicy(false);
    return { active: false, ok: rtc.ok, message: rtc.ok ? "Proxy mati — memakai koneksi langsung." : rtc.message };
  }

  if (mode !== "all" && mode !== "sites") {
    return { active: false, ok: false, message: "Mode proxy tidak dikenal; pengaturan yang ada tidak diubah." };
  }
  if (!(await canControlProxy())) {
    return { active: false, ok: false, message: "Proxy gagal diterapkan: pengaturan dikendalikan browser atau ekstensi lain." };
  }

  const profile = activeProfile(settings);
  const profileError = profile ? validateProfile(profile) : "Belum ada profil proxy yang dipilih.";
  const pacData = profileError
    ? blackholePac()
    : buildPac({
        profile,
        mode,
        sites: settings.proxySites,
        bypass: settings.proxyBypass,
        failClosed: settings.proxyFailClosed !== false,
      });

  await chrome.proxy.settings.set({
    value: { mode: "pac_script", pacScript: { data: pacData } },
    scope: "regular",
  });

  const blockWebRTC = settings.proxyBlockWebRTC !== false;
  const rtc = await setWebRtcPolicy(blockWebRTC);
  if (profileError) {
    return { active: true, ok: false, message: `${profileError} Trafik eksternal diarahkan ke endpoint lokal yang tidak tersedia agar tidak jatuh langsung.` };
  }
  if (!rtc.ok && blockWebRTC) {
    return { active: true, ok: false, message: `PAC proxy diterapkan, tetapi perlindungan WebRTC gagal: ${rtc.message}` };
  }
  return { active: true, ok: true, message: `Proxy diterapkan: ${profile.label || profile.host}. Verifikasi IP/DNS/WebRTC secara terpisah.` };
}

const normalizeHost = (host) => String(host || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

/** Install the proxy auth listener at service-worker top level. */
export function registerProxyAuth(getSettings) {
  const attempted = new Set();
  const filter = { urls: ["<all_urls>"] };
  const release = (details) => attempted.delete(details.requestId);

  chrome.webRequest.onCompleted.addListener(release, filter);
  chrome.webRequest.onErrorOccurred.addListener(release, filter);
  chrome.webRequest.onAuthRequired.addListener((details, callback) => {
    let replied = false;
    const respond = (value) => {
      if (replied) return;
      replied = true;
      callback(value);
    };

    if (!details.isProxy) return respond({});
    const requestId = details.requestId;
    if (attempted.has(requestId)) return respond({ cancel: true });
    attempted.add(requestId);
    if (attempted.size > 1000) attempted.clear();

    getSettings().then((settings) => {
      const profile = activeProfile(settings);
      if (!profile || !["http", "https"].includes(profile.scheme) || !profile.username || !profile.password) {
        return respond({});
      }
      const challenger = details.challenger;
      const expectedHost = normalizeHost(profile.host);
      const actualHost = normalizeHost(challenger?.host);
      const expectedPort = Number(profile.port);
      const actualPort = Number(challenger?.port);
      if (!actualHost || actualHost !== expectedHost || actualPort !== expectedPort) return respond({});
      return respond({ authCredentials: { username: profile.username, password: profile.password } });
    }).catch(() => respond({}));
  }, filter, ["asyncBlocking"]);
}
