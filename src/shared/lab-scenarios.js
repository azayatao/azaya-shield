import { analyzePageSignals } from "./page-analyzer.js";
import { analyzeUrl, levelForScore } from "./url-analyzer.js";

export const LAB_SCENARIOS = Object.freeze([
  {
    id: "ordinary-page",
    title: "Halaman biasa",
    description: "Tidak ada sinyal login atau indikator ancaman.",
    url: "https://news.example.test/",
    signals: { hasPassword: false, formActions: [], title: "Berita", heading: "Berita hari ini", hiddenIframes: 0 },
  },
  {
    id: "lookalike-brand",
    title: "Domain meniru brand",
    description: "Domain tiruan dan judul halaman mengaku sebagai layanan terkenal.",
    url: "https://google-login.example.test/",
    signals: { hasPassword: false, formActions: [], title: "Google", heading: "Masuk ke Google", hiddenIframes: 0 },
  },
  {
    id: "credential-exfiltration",
    title: "Form login mencurigakan",
    description: "Sinyal dummy menunjukkan form mengirim ke domain lain; tidak ada formulir atau kredensial sungguhan.",
    url: "https://paypal-secure-login.example.test/verify",
    signals: {
      hasPassword: true,
      formActions: ["https://collector.example.invalid/submit"],
      title: "PayPal - verifikasi akun",
      heading: "Verifikasi akun",
      hiddenIframes: 0,
    },
  },
]);

export function evaluateLabScenario(id) {
  const scenario = LAB_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Skenario lab tidak dikenal: ${id}`);

  const urlResult = analyzeUrl(scenario.url);
  const pageResult = analyzePageSignals(scenario.url, scenario.signals, urlResult.score);
  const score = urlResult.score + pageResult.score;

  return {
    ...scenario,
    score,
    level: levelForScore(score),
    reasons: [...urlResult.reasons, ...pageResult.reasons].map((reason) => reason.label),
  };
}
