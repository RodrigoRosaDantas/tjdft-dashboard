import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173/tjdft-dashboard").replace(/\/$/, "");
const output = process.env.VISUAL_QA_OUTPUT || "artifacts/visual";
const sizes = [
  { width:360, height:800 },
  { width:390, height:844 },
  { width:412, height:915 },
  { width:768, height:1024 },
  { width:1024, height:1366 },
  { width:1440, height:900 },
];
const strategic = [
  ["home", ""], ["hoje", "hoje"], ["mentor", "mentor"], ["trilha", "trilha"],
  ["agenda", "agenda"], ["revisoes", "revisoes"], ["erros", "erros"],
  ["desempenho", "desempenho"], ["riscos", "riscos"], ["tecnico", "tecnico"],
  ["analista", "analista"], ["qualidade-dados", "qualidade-dados"],
  ["sincronizacao", "sincronizacao"], ["painel-legado", "painel-legado"],
  ["portugues-rlm", "portugues-rlm"], ["p01", "portugues-rlm/p01"],
  ["rl01", "portugues-rlm/rl01"], ["rev01", "portugues-rlm/rev01"],
  ["portugues-flashcards", "portugues-rlm/flashcards"], ["leis", "leis"],
  ["l01", "leis/l01"], ["l24-historica", "leis/l24"], ["leis-flashcards", "leis/flashcards"],
];

const portuguese = JSON.parse(await readFile("public/data/portugues-rlm.json", "utf8"));
const laws = JSON.parse(await readFile("public/data/leis-primeiro.json", "utf8"));
const allMobile = [
  ...strategic,
  ...portuguese.units.map((unit) => [unit.code.toLowerCase(), `portugues-rlm/${unit.code.toLowerCase()}`]),
  ...laws.laws.map((law) => [law.code.toLowerCase(), `leis/${law.code.toLowerCase()}`]),
];
const mobileNames = new Set();
const mobileRoutes = allMobile.filter(([name]) => !mobileNames.has(name) && mobileNames.add(name));
const runs = [
  ...mobileRoutes.map(([name, path]) => ({ name, path, size:sizes[0] })),
  ...strategic.flatMap(([name, path]) => sizes.slice(1).map((size) => ({ name, path, size }))),
];

await mkdir(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ serviceWorkers:"block", reducedMotion:"reduce" });
const page = await context.newPage();
const failures = [];
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

for (const run of runs) {
  const tag = `${run.size.width}x${run.size.height}`;
  const url = `${baseUrl}/${run.path ? `${run.path}/` : ""}`;
  await page.setViewportSize(run.size);
  try {
    const response = await page.goto(url, { waitUntil:"domcontentloaded", timeout:30000 });
    if (!response || response.status() >= 400) {
      failures.push(`${url}: HTTP ${response?.status() ?? "sem resposta"}`);
      continue;
    }
    await page.waitForFunction(() => !/\bCarregando\b/i.test(document.body?.innerText || ""), { timeout:10000 });
    await page.evaluate(() => document.fonts?.ready);
    const checks = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const allIds = [...document.querySelectorAll("[id]")].map((node) => node.id).filter(Boolean);
      const duplicates = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
      const missingAnchors = [...document.querySelectorAll("a[href]")].flatMap((anchor) => {
        const target = new URL(anchor.href, location.href);
        if (target.origin !== location.origin || target.pathname !== location.pathname || !target.hash || target.hash === "#") return [];
        const id = decodeURIComponent(target.hash.slice(1));
        return document.getElementById(id) ? [] : [id];
      });
      const headingIds = [...document.querySelectorAll("article.study-html h2[id], article.study-html h3[id]")].map((heading) => heading.id);
      return {
        title:document.title,
        bodyText:(body?.innerText || "").trim(),
        bodyTextLength:(body?.innerText || "").trim().length,
        viewport:window.innerWidth,
        documentWidth:Math.max(root.scrollWidth, body?.scrollWidth || 0),
        duplicates,
        missingAnchors:[...new Set(missingAnchors)],
        headingIds,
      };
    });
    if (checks.bodyTextLength < 40 || /\bNot Found\b/i.test(checks.title)) failures.push(`${url}: página sem conteúdo ou Not Found`);
    const contentCode = run.path.match(/(?:portugues-rlm|leis)\/([^/]+)$/)?.[1];
    if (contentCode && !["flashcards"].includes(contentCode) && !checks.bodyText.includes(contentCode.toUpperCase())) {
      failures.push(`${url}: o código ${contentCode.toUpperCase()} não carregou no corpo da unidade`);
    }
    if (contentCode && !["flashcards"].includes(contentCode) && !checks.bodyText.includes("Snapshot publicado")) {
      failures.push(`${url}: unidade sem estado de conteúdo publicado`);
    }
    if (checks.documentWidth > checks.viewport + 1) failures.push(`${url} @ ${tag}: overflow horizontal ${checks.documentWidth}px > ${checks.viewport}px`);
    if (checks.duplicates.length) failures.push(`${url}: IDs duplicados (${checks.duplicates.slice(0,5).join(", ")})`);
    if (checks.missingAnchors.length) failures.push(`${url}: âncoras ausentes (${checks.missingAnchors.slice(0,5).join(", ")})`);
    if (new Set(checks.headingIds).size !== checks.headingIds.length) failures.push(`${url}: IDs repetidos em títulos de conteúdo`);
    const file = `${output}/${run.name}-${tag}.png`;
    await page.screenshot({ path:file, animations:"disabled", caret:"hide" });
    console.log(`VISUAL ${run.name} ${tag} ${checks.documentWidth}/${checks.viewport}px`);
  } catch (error) {
    failures.push(`${url} @ ${tag}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await browser.close();
if (pageErrors.length) failures.push(...pageErrors.map((message) => `JavaScript pageerror: ${message}`));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Visual QA verde: ${runs.length} capturas; ${mobileRoutes.length} rotas a 360px e ${strategic.length} rotas em seis resoluções.`);
}
