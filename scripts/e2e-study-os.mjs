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
  const dashboardGroup = page.locator(".sidebar-routes");
  const dashboardLinks = dashboardGroup.locator("a[href]");
  const dashboardIndex = await findRouteIndex(dashboardLinks,target);
  if (dashboardIndex >= 0) {
    const dashboardMenuButton = page.getByRole("button",{name:/Abrir menu/i});
    if (await dashboardMenuButton.isVisible()) await dashboardMenuButton.click();
    if (!await dashboardGroup.evaluate((node) => node.open)) await dashboardGroup.locator("summary").click();
    await followLink(dashboardLinks.nth(dashboardIndex),target);
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
assert.ok(await page.locator(".site-shell").count(), "a Home não preservou o painel TJDFT conhecido");
assert.match(await page.locator(".hero-card h1").innerText(), /O próximo passo está definido|Retome de onde parou|A próxima ação aguarda dados/i);
const homeJavaScript = await page.evaluate(() => {
  const scripts = performance.getEntriesByType("resource").filter((entry) => {
    const url = new URL(entry.name);
    return url.origin === location.origin && /\.m?js$/.test(url.pathname);
  });
  return { count:scripts.length, bytes:scripts.reduce((total, entry) => total + (entry.decodedBodySize || 0), 0) };
});
assert.ok(homeJavaScript.count > 0, "a Home deve carregar os scripts de hidratação");
assert.ok(homeJavaScript.bytes < 2_000_000, `a Home carregou ${homeJavaScript.bytes} bytes de JavaScript; os catálogos editoriais não devem entrar no bundle inicial`);
const homeActionTitle = await page.locator(".focus-card h3").innerText();
assert.ok(homeActionTitle.trim().length > 0, "a Home deve mostrar a recomendação canônica do núcleo de inteligência");
assert.doesNotMatch(homeActionTitle, /^(P\d{2}|RL\d{2}|REV\d{2}|D\d{2})\s*·\s*\1\b/i, "a ação principal não deve repetir o código da unidade, revisão ou sessão");
await page.getByRole("button", { name:/Abrir menu/i }).click();
await page.locator(".main-nav .nav-item").filter({ hasText:"Materiais" }).click();
await page.locator("#materials-tab-future").click();
const sequenceHref = await page.locator("#sequence-materials .text-button").first().getAttribute("href");
const plannedHref = await page.locator("#future-materials .text-button").first().getAttribute("href");
assert.ok(sequenceHref, "fonte da Biblioteca sequencial ausente");
assert.equal(plannedHref, sequenceHref, "o plano de ciclos deve abrir a Biblioteca sequencial que o originou");
const liveApiPattern = "**/functions/v1/tjdft-notion**";
await context.route(liveApiPattern, (route) => route.abort());
await open("painel-legado");
await page.waitForFunction(() => /GitHub · backup/.test(document.querySelector(".sync-label")?.textContent || ""), { timeout:10000 });
await page.waitForFunction(() => !document.querySelector(".refresh-button")?.disabled, { timeout:10000 });
assert.equal(await page.locator(".sync-error").count(),0,"painel legado deve carregar o backup quando a API ao vivo falha");
const legacyRouteHrefs = await page.locator(".sidebar-route-links a[href]").evaluateAll((links) => links.map((link) => link.href));
assert.ok(legacyRouteHrefs.length > 0,"rotas de estudo ausentes no painel legado");
for (const href of legacyRouteHrefs) {
  const target = new URL(href);
  assert.equal(target.origin,new URL(baseUrl).origin);
  assert.ok(target.pathname.startsWith(basePath),`rota fora do site: ${href}`);
  assert.equal(target.pathname.startsWith(`${basePath}painel-legado/`),false,`rota indevidamente aninhada no painel legado: ${href}`);
}
const legacyMentorLink = page.getByRole("link", { name:/Ver explicação no Mentor/i });
assert.equal(new URL(await legacyMentorLink.getAttribute("href"),page.url()).pathname,`${basePath}mentor/`);
await followLink(legacyMentorLink,`${basePath}mentor/`);
assert.match(await page.locator("h1").first().innerText(),/Mentor/i);
await context.unroute(liveApiPattern);
await open("");
await clickDestination("hoje");
assert.match(await page.locator("h1").first().innerText(), /Hoje/i);
assert.ok(await page.getByRole("link", { name:/Executar agora/i }).count());
await clickDestination("mentor");
assert.match(await page.locator("h1").first().innerText(), /Mentor/i);
assert.ok(await page.getByText(/Por que esta decisão/i).count());
const mentorAction = page.locator(".os-action .os-cta");
assert.ok(await mentorAction.isVisible(),"ação principal do Mentor deve estar acessível");
const mentorHref = await mentorAction.getAttribute("href");
assert.ok(mentorHref,"ação principal do Mentor sem destino");
const mentorTarget = new URL(mentorHref,page.url());
const mentorLabel = await page.locator(".os-action .os-pill").innerText();
const mentorTitle = await page.locator(".os-action h2").innerText();
const mentorUnitCode = mentorTitle.match(/(?:^|[^A-Z0-9])((?:REV|RL|P|L)\d{2})(?=$|[^A-Z0-9])/i)?.[1]?.toUpperCase();
if (/RETOMAR|PRÓXIMA AÇÃO/i.test(mentorLabel) && mentorUnitCode) {
  const section = mentorUnitCode.startsWith("L") ? "leis" : "portugues-rlm";
  assert.equal(mentorTarget.pathname,`${basePath}${section}/${mentorUnitCode.toLowerCase()}/`,"Mentor deve abrir o conteúdo correspondente à sessão ou unidade recomendada");
}
if (mentorTarget.origin === new URL(baseUrl).origin) {
  assert.ok(mentorTarget.pathname.startsWith(basePath),"Mentor aponta para fora do base path do site");
  const destination = mentorTarget.pathname.slice(basePath.length);
  assert.match(destination,/^(?:portugues-rlm\/(?:p|rl|rev)\d{2}|leis\/l\d{2}|painel-legado|erros|revisoes|desempenho|qualidade-dados|trilha)\/$/,"Mentor deve apontar para um destino de estudo ou diagnóstico válido");
  await followLink(mentorAction,mentorTarget.pathname);
  assert.doesNotMatch(await page.locator("h1").first().innerText(),/404|not found|não encontrad/i);
} else {
  assert.equal(mentorTarget.protocol,"https:","fontes externas de retomada devem usar HTTPS");
}
await open("portugues-rlm");
await page.waitForFunction(() => {
  const node = document.querySelector(".laws-sync[data-operational-source]");
  return node && node.getAttribute("data-operational-source") !== "loading";
}, { timeout:10000 });
const operationalSource = await page.locator(".laws-sync[data-operational-source]").getAttribute("data-operational-source");
const renderedNextCode = await page.locator(".laws-sync[data-next-code]").getAttribute("data-next-code");
assert.ok(["live", "supabase", "fallback"].includes(operationalSource || ""), "fonte operacional da trilha não foi resolvida");
const completedCards = await page.locator(".portugues-unit-card").evaluateAll((cards) =>
  cards.filter((card) => /D0 concluído/i.test(card.textContent || ""))
    .map((card) => (card.querySelector(".portugues-unit-topline strong")?.textContent || "").trim())
    .filter(Boolean)
);
if (renderedNextCode) {
  assert.equal(completedCards.includes(renderedNextCode), false, "próxima unidade não pode já estar com D0 concluído");
}
if (operationalSource === "fallback") {
  const operationalExpectation = await page.evaluate(async () => {
    const response = await fetch(new URL("../data/tjdft-snapshot.json?e2e=1", location.href), { cache:"no-store" });
    const snapshot = await response.json();
    return {
      nextCode:snapshot?.operational?.trail?.next?.code || null,
      completedCodes:(snapshot?.operational?.trail?.items || []).filter((item) => item.d0 === true).map((item) => item.code),
      totalQuestions:snapshot?.operational?.questions?.total ?? null,
    };
  });
  assert.equal(renderedNextCode || null, operationalExpectation.nextCode, "fallback da trilha divergiu de operational.trail.next");
  for (const completedCode of operationalExpectation.completedCodes) {
    assert.equal(completedCards.includes(completedCode), true, "D0 do snapshot não refletiu no cartão de " + completedCode);
  }
  if (operationalExpectation.totalQuestions != null) {
    assert.match(await page.locator(".portugues-stats").first().innerText(), new RegExp(String(operationalExpectation.totalQuestions)), "total de questões do snapshot não refletiu na trilha");
  }
}
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
