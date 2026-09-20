import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist/client");
const isGithubPages = process.env.GITHUB_PAGES === "1";
const rawBasePath = process.env.GITHUB_PAGES_BASE_PATH?.trim() || "";
const normalizedBasePath = rawBasePath.replace(/^\/+|\/+$/g, "");
const basePath = normalizedBasePath ? `/${normalizedBasePath}` : "";
const assetRoot = `${basePath}/assets/`;

await mkdir(outputDirectory, { recursive: true });

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function rewriteAssetUrls(content) {
  // Keep the rewrite idempotent: a second preparation pass must not become
  // /tjdft-dashboard/tjdft-dashboard/assets/...
  return content.replace(
    /(^|[^A-Za-z0-9_./-])(?:\/assets\/|\.\/assets\/)/g,
    `$1${assetRoot}`,
  );
}

async function rewriteGeneratedFiles() {
  for (const filePath of await listFiles(outputDirectory)) {
    if (!filePath.endsWith(".html") && !filePath.endsWith(".rsc")) continue;
    const content = await readFile(filePath, "utf8");
    const rewritten = rewriteAssetUrls(content);
    if (rewritten !== content) await writeFile(filePath, rewritten, "utf8");
  }
}

async function moveFlatRoutePages() {
  const htmlFiles = (await listFiles(outputDirectory))
    .filter((filePath) => filePath.endsWith(".html"))
    .filter((filePath) => !["index.html", "404.html"].includes(path.basename(filePath)));

  for (const filePath of htmlFiles) {
    const routeName = path.basename(filePath, ".html");
    const targetDirectory = path.join(path.dirname(filePath), routeName);
    const targetPath = path.join(targetDirectory, "index.html");
    await mkdir(targetDirectory, { recursive: true });
    await rename(filePath, targetPath);
  }
}

async function assertPagesRoutes() {
  const requiredRoutes = [
    "index.html",
    "leis/index.html",
    "leis/l01/index.html",
    "leis/l02/index.html",
    "leis/flashcards/index.html",
    "portugues-rlm/index.html",
    "portugues-rlm/p01/index.html",
    "portugues-rlm/rl01/index.html",
    "portugues-rlm/rev01/index.html",
    "portugues-rlm/flashcards/index.html",
  ];

  for (const route of requiredRoutes) {
    await access(path.join(outputDirectory, route));
  }

  const flatRouteFiles = [
    "leis.html",
    "leis/l01.html",
    "leis/l02.html",
    "leis/flashcards.html",
    "portugues-rlm.html",
    "portugues-rlm/p01.html",
    "portugues-rlm/rl01.html",
    "portugues-rlm/rev01.html",
    "portugues-rlm/flashcards.html",
  ];
  for (const route of flatRouteFiles) {
    try {
      await access(path.join(outputDirectory, route));
    } catch {
      continue;
    }
    throw new Error(`GitHub Pages route permaneceu achatada: ${route}`);
  }
}

if (isGithubPages) {
  await moveFlatRoutePages();
  await rewriteGeneratedFiles();
  await assertPagesRoutes();
}

await writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8");
