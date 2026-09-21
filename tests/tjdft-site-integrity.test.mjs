import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function headingText(html) {
  return [...String(html || "").matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => match[1].replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ").trim())
    .join(" | ");
}

test("preserva o recorte legislativo TJDFT", async () => {
  const snapshot = JSON.parse(await read("public/data/leis-primeiro.json"));
  const expectedCodes = Array.from({ length: 26 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`);
  assert.deepEqual(snapshot.laws.map((law) => law.code), expectedCodes);
  assert.equal(snapshot.summary.active_records, 23);
  assert.equal(snapshot.summary.support_records, 1);
  assert.equal(snapshot.summary.historical_records, 2);
  assert.equal(snapshot.laws.find((law) => law.code === "L23")?.record_kind, "support");
  assert.equal(snapshot.laws.find((law) => law.code === "L22")?.record_kind, "historical");
  assert.equal(snapshot.laws.find((law) => law.code === "L24")?.record_kind, "historical");
  assert.doesNotMatch(JSON.stringify(snapshot), /\b(?:SEEDF|TDAS|EDAS|SEDES)\b/i);
});

test("preserva a esteira intercalada de Português + RLM", async () => {
  const snapshot = JSON.parse(await read("public/data/portugues-rlm.json"));
  const expected = [
    "P01", "P02", "P03", "RL01", "P04", "REV01", "P05", "P06", "RL02", "P07", "P08", "REV02",
    "P09", "RL03", "P10", "P11", "P12", "REV03", "RL04", "P13", "P14", "P15", "RL05", "REV04",
    "P16", "P17", "P18", "RL06", "RL07", "REV05", "RL08", "RL09", "RL10", "RL11", "RL12", "REV06", "RL13",
  ];
  assert.deepEqual(snapshot.sequence, expected);
  assert.deepEqual(snapshot.units.map((unit) => unit.code), expected);
  assert.equal(snapshot.units.length, 37);
  assert.equal(snapshot.summary.content_units, 31);
  assert.equal(snapshot.summary.review_units, 6);
  assert.equal(snapshot.units.filter((unit) => unit.material_ready).length, snapshot.summary.material_ready);
  assert.doesNotMatch(JSON.stringify(snapshot), /\b(?:SEEDF|TDAS|EDAS|SEDES)\b/i);
  const publicKeys = snapshot.units.flatMap((unit) => Object.keys(unit));
  for (const privateKey of ["Histórico pessoal", "status", "d0", "d7", "d20"]) {
    assert.equal(publicKeys.includes(privateKey), false, `Campo privado exposto: ${privateKey}`);
  }
  for (const unit of snapshot.units) {
    assert.doesNotMatch(unit.content_html || "", /NAVEGAÇÃO|NAVEGAÇÃO DA TRILHA|FIM DO (?:P|RL|REV)\d+/i, unit.code);
    assert.doesNotMatch(headingText(unit.content_html), /(?:Controle operacional|Sinal do histórico pessoal|Histórico e prioridade)/i, unit.code);
    assert.doesNotMatch(unit.content_html || "", /controle\s+operacional|O controle registra|Sinal do histórico pessoal|Leitura correta desse histórico|histórico pessoal/i, unit.code);
    const headingIds = [...(unit.content_html || "").matchAll(/<h[23]\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
    const indexBlock = (unit.content_html || "").match(/<details\b[^>]*\bstudy-index\b[^>]*>[\s\S]*?<\/details>/i)?.[0] || "";
    const indexHrefs = [...indexBlock.matchAll(/href="#([^"]+)"/gi)].map((match) => match[1]);
    assert.ok(indexBlock, `Índice da aula ausente: ${unit.code}`);
    assert.deepEqual(indexHrefs, headingIds, `Índice sem correspondência com os títulos: ${unit.code}`);
  }
});

test("mantém a navegação principal separada da sequência D01–D14", async () => {
  const source = await read("app/dashboard-client.tsx");
  const navigationBlock = source.slice(source.indexOf("const navigation"), source.indexOf("const sectionIds"));
  assert.deepEqual(
    [...navigationBlock.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]),
    ["inicio", "estudar", "fases", "cargos", "progresso", "materiais", "pre-edital"],
  );
  assert.doesNotMatch(navigationBlock, /D0[1-9]|D1[0-4]/);
});

test("entrega conforto de leitura, foco e fallback offline", async () => {
  const [layout, dashboard, lawDetail, flashcards, lawsPage, preferences, serviceWorker, registration, manifest] = await Promise.all([
    read("app/layout.tsx"),
    read("app/dashboard-client.tsx"),
    read("app/leis/[code]/law-detail-client.tsx"),
    read("app/leis/flashcards/page.tsx"),
    read("app/leis/page.tsx"),
    read("public/reading-preferences.js"),
    read("public/sw.js"),
    read("public/sw-register.js"),
    read("public/manifest.webmanifest"),
  ]);
  assert.match(layout, /reading-preferences\.js/);
  assert.match(layout, /sw-register\.js/);
  assert.match(dashboard, /FOCUS_TIMER_STORAGE_KEY/);
  assert.match(dashboard, /visibilitychange/);
  assert.match(dashboard, /hashchange/);
  assert.match(dashboard, /aria-current/);
  assert.match(dashboard, /STUDY_CHECKLIST_STORAGE_KEY/);
  assert.match(dashboard, /daily-checklist/);
  assert.match(lawDetail, /ReadingSettings/);
  assert.match(flashcards, /ReadingSettings/);
  assert.match(flashcards, /extractFlashcardHtml/);
  assert.match(flashcards, /extractFlashcardPairs/);
  assert.match(flashcards, /CARD_PROGRESS_STORAGE_KEY/);
  assert.match(flashcards, /Filtrar flashcards por lei/);
  assert.match(flashcards, /D20/);
  assert.match(lawsPage, /formatLawCodeRanges/);
  assert.match(lawsPage, /setMapOpen\(true\)/);
  assert.match(lawsPage, /open=\{mapOpen\}/);
  assert.match(preferences, /tjdft-dashboard:reading-preferences:v1/);
  assert.doesNotMatch(preferences, /innerHTML\s*=/);
  assert.match(serviceWorker, /network-first/i);
  assert.match(serviceWorker, /tjdft-pages-v2/);
  assert.match(serviceWorker, /search\s*=\s*""/);
  assert.match(registration, /navigator\.serviceWorker\.register/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"scope": "\.\/"/);
});

test("encontra flashcards reais no snapshot ativo", async () => {
  const snapshot = JSON.parse(await read("public/data/leis-primeiro.json"));
  const activeLaws = snapshot.laws.filter((law) => law.record_kind === "active");
  assert.equal(activeLaws.length, 23);
  for (const law of activeLaws) {
    assert.match(law.content_html || "", /<h[23][^>]*>[\s\S]*Flashcards[\s\S]*<\/h[23]>/i, law.code);
    assert.match(law.content_html || "", /(?:Frente:|class="study-toggle")/i, law.code);
  }
});

test("a preparação de Pages rejeita rotas achatadas", async () => {
  const source = await read("scripts/prepare-github-pages.mjs");
  for (const route of ["leis/index.html", "leis/l01/index.html", "leis/l02/index.html", "leis/flashcards/index.html"]) {
    assert.match(source, new RegExp(route.replaceAll("/", "\\/")));
  }
  for (const route of ["portugues-rlm/index.html", "portugues-rlm/p01/index.html", "portugues-rlm/rl01/index.html", "portugues-rlm/rev01/index.html", "portugues-rlm/flashcards/index.html"]) {
    assert.match(source, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(source, /GitHub Pages route permaneceu achatada/);
});

test("mantém a sincronização viva com fallback e publicação controlada", async () => {
  const [edgeFunction, workflow, backendWorkflow, panel, dashboard, editalExport] = await Promise.all([
    read("supabase/functions/tjdft-notion/index.ts"),
    read(".github/workflows/sync-notion.yml"),
    read(".github/workflows/deploy-supabase.yml"),
    read("app/sync-workflow-panel.tsx"),
    read("app/dashboard-client.tsx"),
    read("scripts/export-edital-verticalizado.ts"),
  ]);
  assert.match(edgeFunction, /FORCE_REFRESH_COOLDOWN_MS/);
  assert.match(edgeFunction, /refreshPromise/);
  assert.match(edgeFunction, /buildSnapshot\(token\)/);
  assert.match(edgeFunction, /Access-Control-Expose-Headers/);
  assert.doesNotMatch(edgeFunction, /github->supabase/);
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /git pull --rebase origin main/);
  assert.doesNotMatch(workflow, /app\/leis\/\*\*/);
  assert.match(backendWorkflow, /TJDFT_NOTION_TOKEN: \$\{\{ secrets\.TJDFT_NOTION_TOKEN \}\}/);
  assert.match(backendWorkflow, /supabase secrets set --env-file/);
  assert.match(backendWorkflow, /umask 077/);
  assert.match(panel, /Atualizar agora/);
  assert.match(panel, /Backup do GitHub carregado/);
  assert.match(panel, /Acompanhar workflow/);
  assert.match(dashboard, /Notion · ao vivo/);
  assert.match(dashboard, /GitHub · backup/);
  assert.match(dashboard, /SNAPSHOT_REQUEST_TIMEOUT_MS/);
  assert.match(dashboard, /AbortController/);
  assert.match(dashboard, /clearTimeout\(timeout\)/);
  assert.match(editalExport, /stableSnapshot/);
  assert.match(editalExport, /previousSnapshot\?\.generatedAt/);
  assert.match(workflow, /deno run --allow-net --allow-env --allow-read --allow-write scripts\/export-edital-verticalizado\.ts/);
});
