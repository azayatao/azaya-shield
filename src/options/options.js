import { getSettings, setSettings } from "../shared/settings.js";
import { normalizeHostList } from "../shared/hosts.js";
import { validateProfile } from "../shared/pac.js";
import { parseProtectedEmailList } from "../shared/email-guard.js";

const $ = (selector) => document.querySelector(selector);

async function renderFeedInfo() {
  const { feedMeta } = await chrome.storage.local.get("feedMeta");
  const info = $("#feedInfo");
  if (!feedMeta?.updatedAt && !feedMeta?.error) {
    info.textContent = "Belum pernah diperbarui.";
    return;
  }
  const parts = [];
  if (feedMeta.updatedAt) {
    parts.push(`${feedMeta.count.toLocaleString("id-ID")} host • diperbarui ${new Date(feedMeta.updatedAt).toLocaleString("id-ID")}`);
  }
  if (feedMeta.error) parts.push(`update terakhir gagal: ${feedMeta.error}`);
  info.textContent = parts.join(" — ");
}

async function renderHides() {
  const { customHides = {} } = await chrome.storage.local.get("customHides");
  const list = $("#hidesList");
  const sites = Object.entries(customHides).filter(([, v]) => v.selectors?.length);
  if (!sites.length) {
    list.replaceChildren(Object.assign(document.createElement("p"), { className: "muted small", textContent: "Belum ada." }));
    return;
  }
  list.replaceChildren(...sites.map(([site, entry]) => {
    const wrap = document.createElement("div");
    wrap.className = "hides-site";
    const title = document.createElement("h3");
    title.textContent = site;
    if (entry.unlockScroll) {
      title.append(Object.assign(document.createElement("span"), { className: "meta", textContent: " • buka kunci scroll aktif" }));
    }
    wrap.append(title);
    for (const selector of entry.selectors) {
      const row = document.createElement("div");
      row.className = "hides-item";
      const code = Object.assign(document.createElement("code"), { textContent: selector });
      const del = Object.assign(document.createElement("button"), { className: "btn", textContent: "Hapus" });
      del.addEventListener("click", async () => {
        const { customHides: fresh = {} } = await chrome.storage.local.get("customHides");
        const cur = fresh[site];
        if (cur) {
          cur.selectors = cur.selectors.filter((s) => s !== selector);
          if (!cur.selectors.length) delete fresh[site];
        }
        await setSettings({ customHides: fresh });
        renderHides();
      });
      row.append(code, del);
      wrap.append(row);
    }
    return wrap;
  }));
}

// ---------- Lokasi palsu -----------------------------------------------------------------------------
const PRESETS = [
  ["Jakarta (Monas)", -6.1754, 106.8272],
  ["Surabaya (Tugu Pahlawan)", -7.2459, 112.7378],
  ["Bandung (Gedung Sate)", -6.9025, 107.6186],
  ["Denpasar", -8.6705, 115.2126],
  ["Singapura", 1.3521, 103.8198],
  ["Tokyo", 35.6762, 139.6503],
];

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const fmt = (n) => Number(n).toFixed(5);

function showManualError(text) {
  const p = $("#manualError");
  p.hidden = !text;
  p.textContent = text ?? "";
}

async function savePlace({ label, lat, lon }) {
  lat = Number(lat);
  lon = Number(lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return showManualError("Latitude harus angka antara -90 dan 90.");
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return showManualError("Longitude harus angka antara -180 dan 180.");
  showManualError("");
  const s = await getSettings();
  const place = { id: crypto.randomUUID(), label: (label || "").trim().slice(0, 80) || `${fmt(lat)}, ${fmt(lon)}`, lat, lon };
  await setSettings({ fakePlaces: [...s.fakePlaces, place], fakePlaceId: place.id, fakeLocation: true });
  $("#fakeLocation").checked = true;
  await renderPlaces();
}

async function renderPlaces() {
  const s = await getSettings();
  const list = $("#placeList");
  if (!s.fakePlaces.length) {
    list.replaceChildren(el("p", { className: "muted small", textContent: "Belum ada tempat tersimpan." }));
    return;
  }
  list.replaceChildren(...s.fakePlaces.map((p) => {
    const radio = el("input", { type: "radio", name: "place", checked: p.id === s.fakePlaceId, ariaLabel: p.label });
    radio.addEventListener("change", async () => {
      await setSettings({ fakePlaceId: p.id, fakeLocation: true });
      $("#fakeLocation").checked = true;
    });
    const del = el("button", { className: "btn", textContent: "Hapus" });
    del.addEventListener("click", async () => {
      const cur = await getSettings();
      await setSettings({
        fakePlaces: cur.fakePlaces.filter((x) => x.id !== p.id),
        fakePlaceId: cur.fakePlaceId === p.id ? "" : cur.fakePlaceId,
      });
      renderPlaces();
    });
    return el("label", { className: "place-item" }, radio,
      el("span", { className: "info" }, el("div", { className: "name", textContent: p.label }), el("div", { className: "coords", textContent: `${fmt(p.lat)}, ${fmt(p.lon)}` })),
      del);
  }));
}

async function searchPlace() {
  const q = $("#placeSearch").value.trim();
  const box = $("#placeResults");
  if (!q) return;
  box.replaceChildren(el("p", { className: "muted small", textContent: "Mencari…" }));
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=id&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();
    if (!results.length) {
      box.replaceChildren(el("p", { className: "muted small", textContent: "Tidak ada hasil. Coba kata kunci lain atau isi koordinat manual." }));
      return;
    }
    box.replaceChildren(...results.map((r) => {
      const use = el("button", { className: "btn", textContent: "Pakai" });
      use.addEventListener("click", async () => {
        await savePlace({ label: r.name || r.display_name.split(",")[0], lat: r.lat, lon: r.lon });
        box.replaceChildren();
      });
      return el("div", { className: "place-item" },
        el("span", { className: "info" }, el("div", { className: "name", textContent: r.display_name }), el("div", { className: "coords", textContent: `${fmt(r.lat)}, ${fmt(r.lon)}` })),
        use);
    }));
  } catch (err) {
    box.replaceChildren(el("p", { className: "muted small", textContent: `Pencarian gagal (${err.message}). Isi koordinat manual sebagai gantinya.` }));
  }
}

function setupGeo(s) {
  $("#fakeLocation").checked = s.fakeLocation;
  $("#fakeAccuracy").value = s.fakeAccuracy;
  $("#fakeLocation").addEventListener("change", (e) => setSettings({ fakeLocation: e.target.checked }));
  $("#fakeAccuracy").addEventListener("change", (e) => {
    const v = Math.min(5000, Math.max(5, Number(e.target.value) || 25));
    e.target.value = v;
    setSettings({ fakeAccuracy: v });
  });

  $("#placeSearchBtn").addEventListener("click", searchPlace);
  $("#placeSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") searchPlace(); });

  // paste "−6.2088, 106.8456" ke kolom latitude → otomatis terbagi
  $("#manualLat").addEventListener("input", (e) => {
    const m = e.target.value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { e.target.value = m[1]; $("#manualLon").value = m[2]; }
  });
  $("#manualAdd").addEventListener("click", async () => {
    await savePlace({ label: $("#manualLabel").value, lat: $("#manualLat").value.replace(",", "."), lon: $("#manualLon").value.replace(",", ".") });
    if (!$("#manualError").textContent) $("#manualLabel").value = $("#manualLat").value = $("#manualLon").value = "";
  });

  $("#presets").replaceChildren(
    el("span", { className: "muted small", textContent: "Cepat:" }),
    ...PRESETS.map(([label, lat, lon]) => {
      const b = el("button", { className: "btn", textContent: label });
      b.addEventListener("click", () => savePlace({ label, lat, lon }));
      return b;
    }),
  );
  return renderPlaces();
}

// ---------- Proxy (ganti IP) ------------------------------------------------------------------------
function showPxError(text) {
  const p = $("#pxError");
  p.hidden = !text;
  p.textContent = text ?? "";
}

async function refreshProxyStatus() {
  const s = await getSettings();
  const line = $("#proxyStatus");
  const profile = s.proxyProfiles.find((p) => p.id === s.proxyProfileId);
  let text;
  if (s.proxyMode === "off") text = "Status: mati — memakai koneksi langsung.";
  else if (!profile) text = "Status: mode aktif tapi belum ada profil terpilih — koneksi tetap langsung.";
  else if (validateProfile(profile)) text = `Status: profil "${profile.label}" tidak valid — koneksi langsung dipakai.`;
  else text = `Status: aktif lewat "${profile.label}" (${profile.host}:${profile.port}).`;
  try {
    const { levelOfControl } = await chrome.proxy.settings.get({});
    if (levelOfControl === "controlled_by_other_extensions") text += " ⚠ Pengaturan proxy dikendalikan ekstensi lain — nonaktifkan dulu ekstensi proxy itu.";
  } catch { /* abaikan */ }
  line.textContent = text;
}

async function renderProxies() {
  const s = await getSettings();
  const list = $("#proxyList");
  if (!s.proxyProfiles.length) {
    list.replaceChildren(el("p", { className: "muted small", textContent: "Belum ada profil proxy." }));
    return;
  }
  list.replaceChildren(...s.proxyProfiles.map((p) => {
    const radio = el("input", { type: "radio", name: "proxy", checked: p.id === s.proxyProfileId, ariaLabel: p.label });
    radio.addEventListener("change", async () => { await setSettings({ proxyProfileId: p.id }); refreshProxyStatus(); });
    const del = el("button", { className: "btn", textContent: "Hapus" });
    del.addEventListener("click", async () => {
      const cur = await getSettings();
      await setSettings({
        proxyProfiles: cur.proxyProfiles.filter((x) => x.id !== p.id),
        proxyProfileId: cur.proxyProfileId === p.id ? "" : cur.proxyProfileId,
      });
      await renderProxies();
      refreshProxyStatus();
    });
    const meta = `${p.scheme.toUpperCase()} • ${p.host}:${p.port}${p.username ? " • login" : ""}`;
    return el("label", { className: "place-item" }, radio,
      el("span", { className: "info" }, el("div", { className: "name", textContent: p.label }), el("div", { className: "coords", textContent: meta })),
      del);
  }));
}

async function addProxy() {
  const profile = {
    id: crypto.randomUUID(),
    label: $("#pxLabel").value.trim().slice(0, 60),
    scheme: $("#pxScheme").value,
    host: $("#pxHost").value.trim().replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, ""),
    port: Number($("#pxPort").value.trim()),
    username: $("#pxUser").value.trim(),
    password: $("#pxPass").value,
  };
  const err = validateProfile(profile);
  if (err) return showPxError(err);
  showPxError("");
  profile.label ||= `${profile.host}:${profile.port}`;
  const s = await getSettings();
  await setSettings({ proxyProfiles: [...s.proxyProfiles, profile], proxyProfileId: profile.id });
  for (const id of ["#pxLabel", "#pxHost", "#pxPort", "#pxUser", "#pxPass"]) $(id).value = "";
  await renderProxies();
  refreshProxyStatus();
}

let lastIp = null;
async function checkIp() {
  const out = $("#ipResult");
  $("#ipToFake").hidden = true;
  out.textContent = "Memeriksa…";
  await new Promise((r) => setTimeout(r, 600)); // beri waktu pengaturan proxy terpasang
  try {
    const res = await fetch("https://ipwho.is/", { cache: "no-store" });
    const d = await res.json();
    if (!d.success) throw new Error(d.message || "gagal");
    lastIp = d;
    out.textContent = `IP: ${d.ip} • ${[d.city, d.region, d.country].filter(Boolean).join(", ")} • zona waktu ${d.timezone?.id ?? "?"}`;
    $("#ipToFake").hidden = !(Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
  } catch (err) {
    out.textContent = `Gagal memeriksa IP (${err.message}). Kalau proxy aktif, mungkin servernya tidak bisa dihubungi atau login salah.`;
  }
}

function setupProxy(s) {
  $("#proxyMode").value = s.proxyMode;
  $("#proxySites").value = s.proxySites.join("\n");
  $("#proxyBypass").value = s.proxyBypass.join("\n");
  $("#proxyFailClosed").checked = s.proxyFailClosed;
  $("#proxyBlockWebRTC").checked = s.proxyBlockWebRTC;

  $("#proxyMode").addEventListener("change", async (e) => { await setSettings({ proxyMode: e.target.value }); refreshProxyStatus(); });
  $("#proxySites").addEventListener("change", (e) => setSettings({ proxySites: normalizeHostList(e.target.value) }));
  $("#proxyBypass").addEventListener("change", (e) => setSettings({ proxyBypass: normalizeHostList(e.target.value) }));
  $("#proxyFailClosed").addEventListener("change", (e) => setSettings({ proxyFailClosed: e.target.checked }));
  $("#proxyBlockWebRTC").addEventListener("change", (e) => setSettings({ proxyBlockWebRTC: e.target.checked }));
  $("#pxAdd").addEventListener("click", addProxy);
  $("#ipCheck").addEventListener("click", checkIp);
  $("#ipToFake").addEventListener("click", async () => {
    if (!lastIp) return;
    await savePlace({ label: [lastIp.city, lastIp.country].filter(Boolean).join(", ") || lastIp.ip, lat: lastIp.latitude, lon: lastIp.longitude });
    await setSettings({ fakeLocation: true });
    $("#fakeLocation").checked = true;
    $("#ipToFake").textContent = "Lokasi palsu disamakan ✓ (zona waktu belum ikut berubah)";
  });
  return Promise.all([renderProxies(), refreshProxyStatus()]);
}

async function load() {
  const s = await getSettings();
  $("#emailGuardEnabled").checked = s.emailGuardEnabled;
  $("#protectedEmails").value = s.protectedEmails.join("\n");
  $("#loginGuardEnabled").checked = s.loginGuardEnabled;
  $("#loginGuardSites").value = s.loginGuardSites.join("\n");
  $("#cosmeticFilter").checked = s.cosmeticFilter;
  $("#stealthCosmetic").checked = s.stealthCosmetic;
  $("#stubScripts").checked = s.stubScripts;
  $("#useUrlhaus").checked = s.useUrlhaus;
  $("#safeBrowsingKey").value = s.safeBrowsingKey;
  $("#customBlocklist").value = s.customBlocklist.join("\n");
  $("#adAllowlist").value = s.adAllowlist.join("\n");
  await renderFeedInfo();
  await renderHides();
}

$("#save").addEventListener("click", async () => {
  const parsedEmails = parseProtectedEmailList($("#protectedEmails").value);
  const emailError = $("#emailGuardError");
  if (parsedEmails.invalid.length) {
    emailError.textContent = `Format email tidak valid: ${parsedEmails.invalid.join(", ")}`;
    emailError.hidden = false;
    return;
  }
  emailError.hidden = true;
  await setSettings({
    emailGuardEnabled: $("#emailGuardEnabled").checked,
    protectedEmails: parsedEmails.emails,
    loginGuardEnabled: $("#loginGuardEnabled").checked,
    loginGuardSites: normalizeHostList($("#loginGuardSites").value),
    cosmeticFilter: $("#cosmeticFilter").checked,
    stealthCosmetic: $("#stealthCosmetic").checked,
    stubScripts: $("#stubScripts").checked,
    useUrlhaus: $("#useUrlhaus").checked,
    safeBrowsingKey: $("#safeBrowsingKey").value.trim(),
    customBlocklist: normalizeHostList($("#customBlocklist").value),
    adAllowlist: normalizeHostList($("#adAllowlist").value),
  });
  await load(); // tampilkan versi yang sudah dinormalkan
  const saved = $("#saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 2000);
});

$("#updateFeed").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Mengunduh…";
  await chrome.runtime.sendMessage({ type: "UPDATE_FEED" });
  button.disabled = false;
  button.textContent = "Perbarui sekarang";
  await renderFeedInfo();
});

getSettings().then((s) => { setupGeo(s); setupProxy(s); });
load();
