import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
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
  const [layout, dashboard, lawDetail, flashcards, preferences, serviceWorker, registration, manifest] = await Promise.all([
    read("app/layout.tsx"),
    read("app/dashboard-client.tsx"),
    read("app/leis/[code]/law-detail-client.tsx"),
    read("app/leis/flashcards/page.tsx"),
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
  assert.match(lawDetail, /data-reading-settings/);
  assert.match(flashcards, /data-reading-settings/);
  assert.match(preferences, /tjdft-dashboard:reading-preferences:v1/);
  assert.match(serviceWorker, /network-first/i);
  assert.match(serviceWorker, /tjdft-pages-v1/);
  assert.match(registration, /navigator\.serviceWorker\.register/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"scope": "\.\/"/);
});

test("a preparação de Pages rejeita rotas achatadas", async () => {
  const source = await read("scripts/prepare-github-pages.mjs");
  for (const route of ["leis/index.html", "leis/l01/index.html", "leis/l02/index.html", "leis/flashcards/index.html"]) {
    assert.match(source, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(source, /GitHub Pages route permaneceu achatada/);
});
