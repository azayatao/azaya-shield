import { evaluateLabScenario, LAB_SCENARIOS } from "../shared/lab-scenarios.js";

const $ = (selector) => document.querySelector(selector);
const labels = { safe: "Aman", warn: "Peringatan", block: "Diblokir oleh ambang simulasi" };

function renderResult(result, container) {
  const article = document.createElement("article");
  article.className = "result";

  const title = document.createElement("h3");
  title.textContent = result.title;
  article.append(title);

  const level = document.createElement("p");
  level.className = `level-${result.level}`;
  level.textContent = `${labels[result.level]} — skor ${result.score}`;
  article.append(level);

  const url = document.createElement("p");
  url.textContent = `URL dummy: ${result.url}`;
  article.append(url);

  if (result.reasons.length) {
    const list = document.createElement("ul");
    for (const reason of result.reasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      list.append(item);
    }
    article.append(list);
  } else {
    const reason = document.createElement("p");
    reason.textContent = "Tidak ada indikator ancaman pada skenario ini.";
    article.append(reason);
  }
  container.append(article);
}

function run(ids) {
  const results = $("#results");
  results.replaceChildren();
  for (const id of ids) renderResult(evaluateLabScenario(id), results);
}

const scenarioList = $("#scenarioList");
for (const scenario of LAB_SCENARIOS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn scenario";

  const title = document.createElement("strong");
  title.textContent = scenario.title;
  const description = document.createElement("small");
  description.textContent = scenario.description;
  button.append(title, description);
  button.addEventListener("click", () => run([scenario.id]));
  scenarioList.append(button);
}

$("#runAll").addEventListener("click", () => run(LAB_SCENARIOS.map((scenario) => scenario.id)));
