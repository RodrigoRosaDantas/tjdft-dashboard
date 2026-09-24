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
    "portugues-rlm/index.html",
    "portugues-rlm/flashcards/index.html",
    ...Array.from({ length: 18 }, (_, index) => `portugues-rlm/p${String(index + 1).padStart(2, "0")}/index.html`),
    ...Array.from({ length: 13 }, (_, index) => `portugues-rlm/rl${String(index + 1).padStart(2, "0")}/index.html`),
    ...Array.from({ length: 6 }, (_, index) => `portugues-rlm/rev${String(index + 1).padStart(2, "0")}/index.html`),
  ];
  for (const route of routes) await access(path.join(output, route));
  for (const route of ["leis.html", "leis/l01.html", "leis/l02.html", "leis/flashcards.html", "portugues-rlm.html", "portugues-rlm/p01.html", "portugues-rlm/rl01.html", "portugues-rlm/rev01.html", "portugues-rlm/flashcards.html"]) {
    await assert.rejects(access(path.join(output, route)));
  }
});

test("renderiza os marcadores públicos principais", async () => {
  const [home, laws, portuguese] = await Promise.all([html("index.html"), html("leis/index.html"), html("portugues-rlm/index.html")]);
  assert.match(home, /study-os/);\n  assert.match(home, /Central de comando/);\n  assert.match(home, /painel-legado/);
  assert.match(home, /href="\.\/leis\/"/);
  assert.match(home, /href="\.\/portugues-rlm\/"/);
  assert.match(home, /reading-preferences\.js/);
  assert.match(home, /sw-register\.js/);
  assert.match(laws, /Leis Primeiro/);
  assert.match(laws, /L01–L26/);
  assert.match(laws, /data-reading-settings/);
  assert.match(laws, /reading-settings-trigger/);
  assert.match(portuguese, /Português Primeiro/);
  assert.match(portuguese, /Ordem da esteira/);
});
