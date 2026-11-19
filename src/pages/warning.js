const params = new URLSearchParams(location.search);

// Validasi: hanya http(s) yang boleh dijadikan tujuan (cegah javascript:/data: lewat parameter).
function parseTarget(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const target = parseTarget(params.get("url") ?? "");

let reasons = [];
try {
  const parsed = JSON.parse(params.get("reasons") ?? "[]");
  if (Array.isArray(parsed)) reasons = parsed.map(String);
} catch { /* abaikan */ }

document.querySelector("#target").textContent = target ? target.href : "(alamat tidak valid)";
document.querySelector("#reasons").replaceChildren(
  ...reasons.map((text) => Object.assign(document.createElement("li"), { textContent: text })),
);
document.querySelector("#score").textContent = `Skor risiko: ${params.get("score") ?? "?"} (ambang blokir: 60)`;

document.querySelector("#back").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    chrome.tabs.getCurrent((tab) => chrome.tabs.update(tab.id, { url: "chrome://newtab/" }));
  }
});

const proceed = document.querySelector("#proceed");
if (!target) proceed.disabled = true;
proceed.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "BYPASS", host: target.hostname });
  location.replace(target.href);
});
