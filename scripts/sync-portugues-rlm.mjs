import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_PAGE_ID = "3e1cf5a2-6731-8168-b5c8-d18590be25bf";
const EXECUTION_PAGE_ID = "3d5cf5a2-6731-811e-9584-e8841d7e4786";
const DATA_SOURCE_ID = "f89ae5e0-4cc3-49f7-ae82-6c84f38a81e5";
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const outputPath = path.resolve("public/data/portugues-rlm.json");
const token = (process.env.TJDFT_NOTION_TOKEN || process.env.NOTION_TOKEN)?.trim();

if (!token) throw new Error("NOTION_TOKEN is not configured.");

const expectedSequence = [
  "P01", "P02", "P03", "RL01", "P04", "REV01", "P05", "P06", "RL02", "P07", "P08", "REV02",
  "P09", "RL03", "P10", "P11", "P12", "REV03", "RL04", "P13", "P14", "P15", "RL05", "REV04",
  "P16", "P17", "P18", "RL06", "RL07", "REV05", "RL08", "RL09", "RL10", "RL11", "RL12", "REV06", "RL13",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(endpoint, init = {}, attempt = 0) {
  const response = await fetch(NOTION_API_BASE + endpoint, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  if (response.status === 429 && attempt < 6) {
    const retryAfter = Number(response.headers.get("retry-after") || 1);
    await sleep(Math.max(500, retryAfter * 1000));
    return request(endpoint, init, attempt + 1);
  }
  if (!response.ok) throw new Error("Notion API " + response.status + ": " + body.slice(0, 300));
  return JSON.parse(body);
}

const page = await request("/pages/" + ROOT_PAGE_ID);
const databasePages = await queryDataSource(DATA_SOURCE_ID);

if (compactId(page.parent?.page_id) !== compactId(EXECUTION_PAGE_ID)) {
  throw new Error("Português Primeiro + RLM deve continuar como filho direto de Execução diária — TJDFT.");
}

const rows = databasePages.map(parseRow).filter(Boolean);
const actualSequence = rows
  .slice()
  .sort((left, right) => left.canonical_order - right.canonical_order)
  .map((row) => row.code);
const duplicateCodes = actualSequence.filter((code, index) => actualSequence.indexOf(code) !== index);
const missingCodes = expectedSequence.filter((code) => !actualSequence.includes(code));
const unexpectedCodes = actualSequence.filter((code) => !expectedSequence.includes(code));
const duplicateOrders = rows
  .map((row) => row.canonical_order)
  .filter((order, index, all) => all.indexOf(order) !== index);

if (
  rows.length !== expectedSequence.length
  || missingCodes.length
  || unexpectedCodes.length
  || duplicateCodes.length
  || duplicateOrders.length
  || !actualSequence.every((code, index) => code === expectedSequence[index])
) {
  throw new Error(
    "Esteira Português/RLM inválida. "
    + `Encontrados ${rows.length} registros; sequência: ${actualSequence.join(", ")}; `
    + `faltantes: ${missingCodes.join(", ") || "nenhum"}; inesperados: ${unexpectedCodes.join(", ") || "nenhum"}.`,
  );
}

const codeByPageId = new Map(rows.map((row) => [compactId(row.study_url), row.code]));
const contentByCode = new Map();

for (const row of rows.slice().sort((left, right) => left.canonical_order - right.canonical_order)) {
  const tree = await getBlockTree(apiId(row.study_url));
  const rendered = sanitizePublicStudyHtml(renderBlocks(tree, codeByPageId).trim());
  const content = rendered.length >= 80 ? rendered : fallbackContent(row);
  if (row.material_ready && content.length < 500) {
    throw new Error(`Material pronto sem conteúdo suficiente: ${row.code}.`);
  }
  contentByCode.set(row.code, content);
  console.log(`${row.code}: ${content.length} caracteres HTML; pronto=${row.material_ready ? "sim" : "não"}.`);
}

const units = rows
  .slice()
  .sort((left, right) => left.canonical_order - right.canonical_order)
  .map((row) => ({
    code: row.code,
    page_id: compactId(row.study_url),
    title: row.title,
    track: row.track,
    layer: row.layer,
    block: row.block,
    canonical_order: row.canonical_order,
    track_order: row.track_order,
    priority: row.priority,
    meta_initial: row.meta_initial,
    material_ready: row.material_ready,
    notion_url: row.study_url,
    internal_path: `./${row.code.toLowerCase()}/`,
    content_html: contentByCode.get(row.code),
  }));

const snapshot = {
  schema_version: 1,
  source: {
    kind: "notion",
    title: pageTitle(page) || "Português Primeiro + RLM Preventivo | TJDFT",
    page_id: ROOT_PAGE_ID,
    page_url: page.url || notionPageUrl(ROOT_PAGE_ID),
    last_edited_time: page.last_edited_time || null,
    synced_at: new Date().toISOString(),
    data_source_id: DATA_SOURCE_ID,
  },
  summary: {
    units: units.length,
    content_units: units.filter((unit) => unit.track !== "Revisão integrada").length,
    review_units: units.filter((unit) => unit.track === "Revisão integrada").length,
    material_ready: units.filter((unit) => unit.material_ready).length,
    tracks: units.reduce((counts, unit) => {
      counts[unit.track] = (counts[unit.track] || 0) + 1;
      return counts;
    }, {}),
  },
  sequence: expectedSequence,
  advance_rule: "A ordem pública segue exclusivamente Ordem da esteira. Material pronto é checkpoint editorial, não registro de estudo; Status, D0, D7 e D20 continuam no Notion.",
  study_sequence: [
    "Teoria — leia o material da página-filho na ordem indicada.",
    "Macetes e alertas — destaque contrastes, exceções e armadilhas de banca.",
    "Questões — resolva a meta planejada e registre o motivo de cada erro.",
    "Flashcards — use recuperação ativa para regras, contrastes e erros reaplicáveis.",
    "D0 — registre a sessão real no Notion depois de concluir teoria, questões e erros.",
    "D7/D20 — mantenha as revisões em paralelo sem alterar a sequência editorial.",
  ],
  audit_notes: [
    "A sequência intercalada Pxx/RLxx/REVxx é a fonte pública de navegação.",
    "O snapshot público não expõe os campos de histórico e execução privada.",
    "Material pronto é uma marca editorial e não significa que a unidade foi estudada.",
    "O Notion permanece como fonte operacional; o GitHub é o espelho versionado; o site é a interface de leitura.",
  ],
  units,
};

await mkdir(path.dirname(outputPath), { recursive: true });
const previousSnapshot = await readPreviousSnapshot(outputPath);
if (previousSnapshot?.source?.synced_at && snapshotContent(previousSnapshot) === snapshotContent(snapshot)) {
  snapshot.source.synced_at = previousSnapshot.source.synced_at;
}
await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`Português/RLM atualizado: ${units.length} unidades, ${snapshot.summary.material_ready} materiais prontos.`);

async function readPreviousSnapshot(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function snapshotContent(value) {
  return JSON.stringify(value, (key, nested) => key === "synced_at" ? undefined : nested);
}

async function queryDataSource(dataSourceId) {
  const results = [];
  let cursor = null;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const response = await request(`/data_sources/${dataSourceId}/query`, { method: "POST", body: JSON.stringify(body) });
    results.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return results.filter((row) => !row.archived);
}

async function getAllChildren(blockId) {
  const results = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const response = await request(`/blocks/${blockId}/children?${query}`);
    results.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return results;
}

async function getBlockTree(blockId) {
  const blocks = await getAllChildren(blockId);
  for (const block of blocks) {
    if (block.has_children && !["child_page", "child_database"].includes(block.type)) {
      block.__children = await getBlockTree(block.id);
    } else {
      block.__children = [];
    }
  }
  return blocks;
}

function renderBlocks(blocks, codeByPageId) {
  let html = "";
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (["bulleted_list_item", "numbered_list_item"].includes(block.type)) {
      const tag = block.type === "bulleted_list_item" ? "ul" : "ol";
      const items = [];
      while (index < blocks.length && blocks[index].type === block.type) {
        const item = blocks[index];
        const data = item[item.type] || {};
        items.push(`<li>${richTextHtml(data.rich_text, codeByPageId)}${renderBlocks(item.__children || [], codeByPageId)}</li>`);
        index += 1;
      }
      index -= 1;
      html += `<${tag}>${items.join("")}</${tag}>`;
      continue;
    }
    html += renderBlock(block, codeByPageId);
  }
  return html;
}

function renderBlock(block, codeByPageId) {
  const type = block.type;
  const data = block[type] || {};
  const plainText = (data.rich_text || []).map((item) => item.plain_text || item.text?.content || "").join("").trim();
  const text = richTextHtml(data.rich_text, codeByPageId);
  const children = renderBlocks(block.__children || [], codeByPageId);

  if (type === "callout" && /^(?:Navegação:|Fim da (?:P|RL|REV)\d+|CONTROLE OPERACIONAL)/i.test(plainText)) return "";
  if (type === "toggle" && /Navegar por seções|CONTROLE OPERACIONAL/i.test(plainText)) return "";
  if (type === "paragraph") return text ? `<p>${text}</p>${children}` : children;
  if (type === "heading_1" || type === "heading_2") return `<h2>${text}</h2>${children}`;
  if (type === "heading_3") return `<h3>${text}</h3>${children}`;
  if (type === "quote") return `<blockquote>${text}${children}</blockquote>`;
  if (type === "callout") {
    const icon = data.icon?.type === "emoji" ? `${escapeHtml(data.icon.emoji)} ` : "";
    return `<aside class="study-callout">${icon}${text}${children}</aside>`;
  }
  if (type === "divider") return "<hr>";
  if (type === "toggle") return `<details class="study-toggle"><summary>${text || "Ver conteúdo"}</summary>${children}</details>`;
  if (type === "to_do") return `<div class="study-todo"><span>${data.checked ? "☑" : "☐"}</span><span>${text}</span></div>${children}`;
  if (type === "code") return `<pre><code>${escapeHtml((data.rich_text || []).map((item) => item.plain_text || "").join(""))}</code></pre>${children}`;
  if (type === "equation") return `<div class="study-equation">${escapeHtml(data.expression || "")}</div>${children}`;
  if (type === "table") {
    const rows = (block.__children || [])
      .filter((item) => item.type === "table_row")
      .map((row, rowIndex) => {
        const cells = (row.table_row?.cells || []).map((cell) => {
          const tag = rowIndex === 0 && data.has_column_header ? "th" : "td";
          return `<${tag}>${richTextHtml(cell, codeByPageId)}</${tag}>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
    return `<div class="study-table-wrap"><table>${rows}</table></div>`;
  }
  if (type === "bookmark" || type === "link_preview") {
    const url = safeUrl(data.url);
    return url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)} ↗</a></p>` : children;
  }
  if (type === "image") {
    const url = data.type === "external" ? safeUrl(data.external?.url) : "";
    const caption = richTextHtml(data.caption, codeByPageId);
    return url
      ? `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml((data.caption || []).map((item) => item.plain_text || "").join(""))}" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`
      : `<div class="study-media-note">🖼️ Imagem anexada no Notion. Use “Abrir no Notion” se precisar consultar o arquivo original.</div>`;
  }
  if (type === "child_page") {
    const code = codeByPageId.get(compactId(block.id));
    return code ? `<p><a href="../${code.toLowerCase()}/">${escapeHtml(data.title || "Página vinculada")} →</a></p>` : children;
  }
  if (["synced_block", "column", "column_list"].includes(type)) return children;
  return children || (text ? `<p>${text}</p>` : "");
}

function richTextHtml(items = [], codeByPageId) {
  return (items || []).map((item) => {
    let value = item.type === "equation"
      ? escapeHtml(item.equation?.expression || "")
      : escapeHtml(item.plain_text || item.text?.content || "");
    const annotations = item.annotations || {};
    if (annotations.code) value = `<code>${value}</code>`;
    if (annotations.bold) value = `<strong>${value}</strong>`;
    if (annotations.italic) value = `<em>${value}</em>`;
    if (annotations.underline) value = `<u>${value}</u>`;
    if (annotations.strikethrough) value = `<s>${value}</s>`;
    const href = item.href || item.text?.link?.url || "";
    if (href) {
      const code = codeByPageId.get(compactId(href));
      const link = code ? `../${code.toLowerCase()}/` : safeUrl(href);
      if (link) value = code ? `<a href="${escapeHtml(link)}">${value}</a>` : `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${value}</a>`;
    }
    return value;
  }).join("");
}

function parseRow(page) {
  const properties = page.properties || {};
  const code = propertyText(properties, "Código").toUpperCase();
  const title = propertyText(properties, "Unidade");
  const studyUrl = propertyUrlOrText(properties, "Página de estudo");
  const canonicalOrder = propertyNumber(properties, "Ordem da esteira");
  if (!/^P\d{2}$|^RL\d{2}$|^REV\d{2}$/i.test(code) || !title || !studyUrl || canonicalOrder < 1) return null;
  return {
    code,
    title,
    study_url: studyUrl,
    track: propertyText(properties, "Trilha"),
    layer: propertyText(properties, "Camada"),
    block: propertyText(properties, "Bloco 5+1"),
    canonical_order: canonicalOrder,
    track_order: propertyNumber(properties, "Ordem"),
    priority: propertyText(properties, "Prioridade"),
    meta_initial: propertyNumber(properties, "Meta inicial"),
    material_ready: propertyCheckbox(properties, "Material pronto"),
  };
}

function fallbackContent(row) {
  const state = row.material_ready
    ? "O conteúdo editorial foi marcado como pronto, mas o espelho ainda não trouxe blocos suficientes. Abra a fonte operacional para conferir a página completa."
    : "Esta unidade ainda está em desenvolvimento editorial. O site mostra a posição oficial na esteira e o Notion permanece como fonte de trabalho.";
  return `<h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(state)}</p><p><a href="${escapeHtml(row.study_url)}" target="_blank" rel="noreferrer">Abrir a página completa no Notion ↗</a></p>`;
}

function propertyText(properties, name) {
  const property = properties?.[name];
  if (!property) return "";
  if (property.title) return property.title.map((item) => item.plain_text || item.text?.content || "").join("").trim();
  if (property.rich_text) return property.rich_text.map((item) => item.plain_text || item.text?.content || "").join("").trim();
  if (property.select) return property.select?.name || "";
  if (property.status) return property.status?.name || "";
  if (property.formula?.type === "string") return property.formula.string || "";
  return "";
}

function propertyNumber(properties, name) {
  const value = properties?.[name]?.number;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function propertyUrlOrText(properties, name) {
  const property = properties?.[name];
  if (!property) return "";
  if (property.url) return property.url;
  if (property.rich_text) {
    for (const item of property.rich_text) {
      const href = item.href || item.text?.link?.url;
      if (href) return href;
      const value = item.plain_text || item.text?.content || "";
      if (/^https?:\/\//i.test(value)) return value;
    }
  }
  return "";
}

function propertyCheckbox(properties, name) {
  return Boolean(properties?.[name]?.checkbox);
}

function pageTitle(page) {
  const property = Object.values(page?.properties || {}).find((item) => item?.type === "title" || item?.title);
  return property?.title?.map((item) => item.plain_text || item.text?.content || "").join("") || "";
}

function notionPageUrl(value) {
  return "https://app.notion.com/p/" + compactId(value);
}

function compactId(value) {
  const raw = String(value || "");
  const match = raw.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{32}/i);
  return (match ? match[0] : raw.replaceAll("-", "")).replaceAll("-", "").toLowerCase();
}

function apiId(value) {
  const compact = compactId(value);
  if (compact.length !== 32) return value;
  return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

function safeUrl(value) {
  const url = String(value || "");
  return /^https?:\/\//i.test(url) ? url : "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeProjectHtml(value = "") {
  return String(value)
    .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll(/ on[a-z]+="[^"]*"/gi, "")
    .replaceAll(/ on[a-z]+='[^']*'/gi, "");
}

function sanitizePublicStudyHtml(value = "") {
  let html = sanitizeProjectHtml(value);

  // The Notion pages contain operational material that belongs only in the
  // private control database. Keep the public copy focused on the lesson.
  html = removeHtmlSections(html, (heading) => /controle\s+operacional|sinal\s+do\s+hist[óo]rico\s+pessoal|hist[óo]rico\s+e\s+prioridade/i.test(stripHtml(heading)));
  html = html.replace(/<aside\b[^>]*class=["']study-callout["'][^>]*>[\s\S]*?<\/aside>/gi, (aside) => {
    const plainText = stripHtml(aside);
    return /navega[çc][ãa]o|fim\s+do\b/i.test(plainText) ? "" : aside;
  });
  html = html.replace(/<(p|blockquote|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
    const plainText = stripHtml(block);
    return /o\s+controle\s+registra|sinal\s+do\s+hist[óo]rico|leitura\s+correta\s+desse\s+hist[óo]rico/i.test(plainText)
      ? ""
      : block;
  });

  // Preserve the pedagogical label without publishing a personal-history
  // marker that can reveal the source of the prioritisation.
  html = html.replace(/hist[óo]rico\s+pessoal/gi, "diagnóstico editorial");
  return html.replace(/\s{2,}/g, " ").trim();
}

function removeHtmlSections(html, shouldRemove) {
  const headingPattern = /<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/gi;
  const matches = [...html.matchAll(headingPattern)];
  if (!matches.length) return html;

  let output = "";
  let cursor = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? html.length;
    output += html.slice(cursor, start);
    if (!shouldRemove(match[0])) output += html.slice(start, nextStart);
    cursor = nextStart;
  }
  return output + html.slice(cursor);
}

function stripHtml(value = "") {
  return String(value)
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&nbsp;/gi, " ")
    .replaceAll(/&amp;/gi, "&")
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'")
    .replaceAll(/\s+/g, " ")
    .trim();
}
