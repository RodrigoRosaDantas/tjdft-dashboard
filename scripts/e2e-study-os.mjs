import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173/tjdft-dashboard").replace(/\/$/, "");
const basePath = new URL(`${baseUrl}/`).pathname;
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ serviceWorkers:"block", viewport:{ width:412, height:915 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function destinationPath(route) {
  return new URL(route ? `${route}/` : "./", `${baseUrl}/`).pathname;
}

async function waitForPageReady() {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForFunction(() => !/\bCarregando\b/i.test(document.body?.innerText || ""), { timeout:10000 });
}

async function findRouteIndex(links, targetPath) {
  return links.evaluateAll((nodes, path) => nodes.findIndex((node) => {
    try { return new URL(node.href, location.href).pathname === path; } catch { return false; }
  }), targetPath);
}

async function findVisibleDestination(targetPath) {
  return page.locator("a[href]").evaluateAll((links, path) => {
    const matches = links.map((link, index) => {
      try {
        const target = new URL(link.href, location.href);
        const style = getComputedStyle(link);
        const rect = link.getBoundingClientRect();
        if (target.pathname !== path || style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return null;
        const priority = link.closest(".os-bottom-nav") ? 0 : link.closest(".os-menu-panel,.os-side-nav") ? 1 : 2;
        return { index, priority };
      } catch { return null; }
    }).filter(Boolean);
    matches.sort((a,b) => a.priority - b.priority);
    return matches[0]?.index ?? -1;
  }, targetPath);
}

async function followLink(link, target) {
  await Promise.all([
    page.waitForURL((url) => url.pathname === target, { waitUntil:"domcontentloaded", timeout:10000 }),
    link.click({ noWaitAfter:true }),
  ]);
  await waitForPageReady();
}

async function clickDestination(route) {
  const target = await destinationPath(route);
  const mobileMenu = page.locator(".os-mobile-menu");
  const menuSummary = mobileMenu.locator("summary");
  const bottomNav = page.locator(".os-bottom-nav a[href]");
  if (await bottomNav.count() && await bottomNav.first().isVisible()) {
    const quickIndex = await findRouteIndex(bottomNav,target);
    if (quickIndex >= 0) {
      await followLink(bottomNav.nth(quickIndex),target);
      return;
    }
  }
  const drawerLinks = page.locator(".os-menu-panel a[href]");
  const drawerIndex = await findRouteIndex(drawerLinks,target);
  if (drawerIndex >= 0 && await menuSummary.isVisible()) {
    if (!await mobileMenu.evaluate((node) => node.open)) await menuSummary.click();
    await followLink(drawerLinks.nth(drawerIndex),target);
    return;
  }
  const sideLinks = page.locator(".os-side-nav a[href]");
  const sideIndex = await findRouteIndex(sideLinks,target);
  if (sideIndex >= 0 && await sideLinks.first().isVisible()) {
    await followLink(sideLinks.nth(sideIndex),target);
    return;
  }
  const index = await findVisibleDestination(target);
  assert.notEqual(index, -1, `link visível para ${target} ausente em ${page.url()}`);
  await followLink(page.locator("a[href]").nth(index),target);
}
async function open(route) {
  const response = await page.goto(`${baseUrl}/${route ? `${route}/` : ""}`, { waitUntil:"domcontentloaded", timeout:30000 });
  assert.ok(response && response.status() < 400, `HTTP inválido em ${route || "/"}`);
  await waitForPageReady();
}

await open("");
assert.match(await page.locator("h1").first().innerText(), /Central de comando/i);
const homeActionTitle = await page.locator(".os-action h2").innerText();
assert.doesNotMatch(homeActionTitle, /^(P\d{2}|RL\d{2})\s*·\s*\1\b/i, "a ação principal não deve repetir o código da unidade");
await open("painel-legado");
await page.getByRole("button", { name:/Abrir menu/i }).click();
await page.locator(".main-nav .nav-item").filter({ hasText:"Materiais" }).click();
await page.locator("#materials-tab-future").click();
const sequenceHref = await page.locator("#sequence-materials .text-button").first().getAttribute("href");
const plannedHref = await page.locator("#future-materials .text-button").first().getAttribute("href");
assert.ok(sequenceHref, "fonte da Biblioteca sequencial ausente");
assert.equal(plannedHref, sequenceHref, "o plano de ciclos deve abrir a Biblioteca sequencial que o originou");
await open("");
await clickDestination("hoje");
assert.match(await page.locator("h1").first().innerText(), /Hoje/i);
assert.ok(await page.getByRole("link", { name:/Executar agora/i }).count());
await clickDestination("mentor");
assert.match(await page.locator("h1").first().innerText(), /Mentor/i);
assert.ok(await page.getByText(/Por que esta decisão/i).count());
await clickDestination("portugues-rlm/p01");
assert.match(await page.locator("body").innerText(), /P01/);
assert.ok(await page.locator("article.study-html").count(), "material da unidade não carregou");
const sourceLinks = await page.locator("a[target='_blank']").count();
assert.ok(sourceLinks, "a unidade não oferece retorno ao registro canônico do Notion");

const index = page.locator("article.study-html details.study-index").first();
assert.ok(await index.count(), "índice da aula ausente em P01");
await index.locator("summary").click();
const firstAnchor = index.locator("a[href^='#']").first();
assert.ok(await firstAnchor.count(), "índice P01 sem link interno");
await firstAnchor.click();
assert.ok(new URL(page.url()).hash, "clique no índice não alterou a âncora");
assert.equal(await page.evaluate(() => Boolean(document.getElementById(decodeURIComponent(location.hash.slice(1))))), true, "âncora P01 sem seção de destino");
await clickDestination("portugues-rlm/p02");
assert.match(await page.locator("body").innerText(), /P02/);
await clickDestination("portugues-rlm");
await clickDestination("portugues-rlm/rl01");
assert.match(await page.locator("body").innerText(), /RL01/);
await clickDestination("portugues-rlm");
await clickDestination("portugues-rlm/rev01");
assert.match(await page.locator("body").innerText(), /REV01/);

await open("");
await clickDestination("revisoes");
assert.match(await page.locator("h1").first().innerText(), /Revisões/i);
await open("");
await clickDestination("desempenho");
assert.match(await page.locator("h1").first().innerText(), /Desempenho/i);
await open("");
await clickDestination("erros");
assert.match(await page.locator("h1").first().innerText(), /Caderno de erros/i);
await open("");
await clickDestination("riscos");
assert.match(await page.locator("h1").first().innerText(), /Riscos/i);

await open("");
await clickDestination("leis");
assert.match(await page.locator("body").innerText(), /Leis Primeiro/i);
await clickDestination("leis/l01");
assert.match(await page.locator("body").innerText(), /L01/);
await clickDestination("leis");
await clickDestination("leis/flashcards");
assert.match(await page.locator("body").innerText(), /Flashcards/i);

await open("");
await clickDestination("tecnico");
assert.match(await page.locator("h1").first().innerText(), /Técnico/i);
await open("");
await clickDestination("analista");
assert.match(await page.locator("h1").first().innerText(), /Analista/i);
await open("");
await clickDestination("sincronizacao");
assert.match(await page.locator("h1").first().innerText(), /Sincronização/i);
assert.match(await page.locator("body").innerText(), /Origem por componente/i);
assert.match(await page.locator("body").innerText(), /Execução e desempenho/i);
await clickDestination("qualidade-dados");
assert.match(await page.locator("h1").first().innerText(), /Qualidade dos dados/i);

const pwaContext = await browser.newContext({ serviceWorkers:"allow", viewport:{ width:390, height:844 } });
const pwaPage = await pwaContext.newPage();
await pwaPage.goto(`${baseUrl}/`, { waitUntil:"domcontentloaded", timeout:30000 });
const registration = await pwaPage.evaluate(async () => {
  const ready = await navigator.serviceWorker.ready;
  return { scope:ready.scope, active:Boolean(ready.active) };
});
assert.equal(registration.active,true,"service worker não ativou");
assert.equal(new URL(registration.scope).pathname,basePath,"PWA scope não respeita o base path do GitHub Pages");
await pwaPage.goto(`${baseUrl}/`, { waitUntil:"domcontentloaded" });
await pwaPage.goto(`${baseUrl}/portugues-rlm/p01/`, { waitUntil:"domcontentloaded" });
await pwaPage.waitForFunction(() => document.querySelector("article.study-html h2"), { timeout:8000 });
await pwaContext.setOffline(true);
const offlineResponse = await pwaPage.goto(`${baseUrl}/portugues-rlm/p01/`, { waitUntil:"domcontentloaded", timeout:15000 });
assert.ok(offlineResponse && offlineResponse.status() < 400,"PWA não serviu a unidade P01 do cache offline");
await pwaPage.waitForFunction(() => document.querySelector("article.study-html h2") && /\bP01\b/.test(document.body?.innerText || ""), { timeout:10000 });
assert.match(await pwaPage.locator("body").innerText(),/P01/);
await pwaContext.close();

await browser.close();
assert.deepEqual(pageErrors, [], `erros JavaScript: ${pageErrors.join(" | ")}`);
console.log("E2E Study OS verde: Home → Hoje → Mentor → P01/índice → P02 → RL01/REV01 → revisões, desempenho, erros, riscos, Leis/L01/flashcards, Técnico, Analista, Sync e Qualidade.");
