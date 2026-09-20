import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const output = path.join(process.cwd(), "dist", "client");

async function html(route) {
  return readFile(path.join(output, route), "utf8");
}

test("exporta as rotas de Pages como diretórios", async () => {
  const routes = [
    "index.html",
    "leis/index.html",
    "leis/l01/index.html",
    "leis/l02/index.html",
    "leis/flashcards/index.html",
    ...Array.from({ length: 24 }, (_, index) => `leis/l${String(index + 3).padStart(2, "0")}/index.html`),
  ];
  for (const route of routes) await access(path.join(output, route));
  for (const route of ["leis.html", "leis/l01.html", "leis/l02.html", "leis/flashcards.html"]) {
    await assert.rejects(access(path.join(output, route)));
  }
});

test("renderiza os marcadores públicos principais", async () => {
  const [home, laws] = await Promise.all([html("index.html"), html("leis/index.html")]);
  assert.match(home, /law-fab/);
  assert.match(home, /href="\.\/leis\/"/);
  assert.match(home, /reading-preferences\.js/);
  assert.match(home, /sw-register\.js/);
  assert.match(laws, /Leis Primeiro/);
  assert.match(laws, /L01–L26/);
  assert.match(laws, /data-reading-settings/);
  assert.match(laws, /reading-settings-trigger/);
});
