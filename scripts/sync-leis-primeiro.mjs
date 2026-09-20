import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LEIS_PAGE_ID = "3e0cf5a2-6731-812c-8d95-f6ce4b6c9706";
const EXECUTION_PAGE_ID = "3d5cf5a2-6731-811e-9584-e8841d7e4786";
const LEGISLATION_DATA_SOURCE_ID = "a8e16328-4587-4ace-93e5-5b994ee3389b";
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const token = (process.env.TJDFT_NOTION_TOKEN || process.env.NOTION_TOKEN)?.trim();
const outputPath = path.resolve("public/data/leis-primeiro.json");

if (!token) throw new Error("NOTION_TOKEN is not configured.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (endpoint, init = {}, attempt = 0) => {
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
};

const [page, databasePages] = await Promise.all([
  request("/pages/" + LEIS_PAGE_ID),
  queryDataSource(LEGISLATION_DATA_SOURCE_ID),
]);

if (compactId(page.parent?.page_id) !== compactId(EXECUTION_PAGE_ID)) {
  throw new Error("Leis Primeiro must remain a direct child of Execução diária — TJDFT.");
}

const bankRows = databasePages
  .map(parseBankRow)
  .filter((row) => row && row.study_url && row.operational_order > 0)
  .sort((a, b) => a.operational_order - b.operational_order);

const expectedCodes = Array.from({ length: 26 }, (_, index) => "L" + String(index + 1).padStart(2, "0"));
const actualCodes = bankRows.map((row) => row.code);
const missingCodes = expectedCodes.filter((code) => !actualCodes.includes(code));
const duplicateCodes = actualCodes.filter((code, index) => actualCodes.indexOf(code) !== index);
if (bankRows.length !== 26 || missingCodes.length || duplicateCodes.length) {
  throw new Error("Expected exactly L01-L26 current records. Found " + actualCodes.join(", ") + ". Missing: " + missingCodes.join(", ") + ".");
}

const lawCodeByPageId = new Map(bankRows.map((row) => [compactId(row.study_url), row.code]));
const contentByCode = new Map();

for (const row of bankRows) {
  const tree = await getBlockTree(compactId(row.study_url));
  const html = renderBlocks(tree, lawCodeByPageId).trim();
  const content = html.length >= 40 ? html : fallbackContent(row);
  if (row.active && content.length < 40) {
    throw new Error("Study content for " + row.code + " is unexpectedly empty.");
  }
  contentByCode.set(row.code, content);
  console.log(row.code + ": conteúdo interno sincronizado (" + content.length + " caracteres HTML).");
}

const laws = bankRows.map((row) => ({
  code: row.code,
  page_id: compactId(row.study_url),
  title: row.title,
  material: row.material,
  group: groupFor(row.code),
  record_kind: recordKind(row),
  active: row.active,
  notion_url: row.study_url,
  internal_path: "./" + row.code.toLowerCase() + "/",
  bank_record_url: row.url,
  operational_order: row.operational_order,
  priority: row.priority,
  official_url: row.official_url,
  status: row.status,
  question_target: row.question_target,
  operational_target_total: row.question_target,
  questions_done: row.questions_done,
  flashcards_done: row.flashcards_done,
  flashcards_meta: row.flashcards_meta,
  next_step: row.action,
  cargos: row.cargos,
  action: row.action,
  cut: row.cut,
  alert: row.alert,
  block: row.block,
  observations: row.observations,
  version: row.version,
  orientation_read: row.orientation_read,
  d0: row.d0,
  d7: row.d7,
  d20: row.d20,
  last_audit: row.last_audit || row.last_check,
  last_check: row.last_check,
  next_review: row.next_review,
  page_edited_at: null,
  content_html: contentByCode.get(row.code),
}));

const priorities = bankRows.reduce((acc, row) => {
  acc[row.priority || "Sem prioridade"] = (acc[row.priority || "Sem prioridade"] || 0) + 1;
  return acc;
}, {});
const activeLaws = laws.filter((law) => law.record_kind === "active");
const radarRows = laws.filter((law) => law.record_kind !== "active");

const snapshot = {
  schema_version: 4,
  source: {
    kind: "notion",
    title: pageTitle(page) || "Leis Primeiro | TJDFT",
    page_id: LEIS_PAGE_ID,
    page_url: page.url || notionPageUrl(LEIS_PAGE_ID),
    last_edited_time: page.last_edited_time || null,
    synced_at: new Date().toISOString(),
    data_source_id: LEGISLATION_DATA_SOURCE_ID,
    internal_pages: true,
  },
  summary: {
    pages: laws.length,
    bank_records: bankRows.length,
    mapped_law_records: activeLaws.length,
    active_records: activeLaws.length,
    support_records: laws.filter((law) => law.record_kind === "support").length,
    historical_records: laws.filter((law) => law.record_kind === "historical").length,
    radar_records: radarRows.length,
    priorities,
  },
  study_sequence: [
    "Orientação — leia o recorte prioritário, a vigência e o bloco sugerido da unidade.",
    "Lei seca — abra a fonte oficial vigente e leia diretamente o recorte indicado.",
    "Questões — cumpra a Questões-meta do banco canônico do TJDFT e registre o resultado.",
    "Flashcards — use os cartões da unidade para recuperação ativa, sem fabricar desempenho.",
    "D0 — feche leitura, questões, correções, cartões e registro real.",
    "D7/D20 — revise em paralelo e atualize a data da próxima revisão.",
  ],
  advance_rule: "Avance na fila ativa após orientação + leitura oficial + questões + flashcards + D0; D7/D20 seguem em paralelo. Registros de apoio e históricos não bloqueiam a trilha.",
  laws,
  radars: radarRows.map((law) => ({
    operational_order: law.operational_order,
    code: law.code,
    title: law.title,
    priority: law.priority,
    official_url: law.official_url,
    status: law.status,
    record_kind: law.record_kind,
    question_target: law.question_target,
    cargos: law.cargos,
    action: law.action,
    cut: law.cut,
    alert: law.alert,
    url: law.notion_url,
  })),
  audit_notes: [
    "L01-L21, L25 e L26 são as unidades legislativas ativas; L23 permanece como apoio de requisito.",
    "L22 e L24 permanecem como arquivo histórico e não entram na fila de estudo.",
    "As páginas individuais vêm do Notion; o banco operacional continua sendo o registro canônico.",
    "Técnico e Analista podem compartilhar a fonte, mas não compartilham execução, domínio ou desempenho.",
    "Metas e marcadores permanecem sem execução até haver estudo real.",
    "O GitHub é espelho versionado; o Notion permanece como fonte operacional.",
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
const previousSnapshot = await readPreviousSnapshot(outputPath);
if (previousSnapshot?.source?.synced_at && snapshotContent(previousSnapshot) === snapshotContent(snapshot)) {
  snapshot.source.synced_at = previousSnapshot.source.synced_at;
}
await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log("Leis Primeiro atualizado: " + laws.length + " páginas Lxx, " + activeLaws.length + " ativas, " + radarRows.length + " fora da fila.");

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

async function getAllChildren(blockId) {
  const results = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const response = await request("/blocks/" + blockId + "/children?" + query);
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

async function queryDataSource(dataSourceId) {
  const results = [];
  let cursor = null;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const response = await request("/data_sources/" + dataSourceId + "/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
    results.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return results;
}

function renderBlocks(blocks, lawMap) {
  let html = "";
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (["bulleted_list_item", "numbered_list_item"].includes(block.type)) {
      const type = block.type;
      const tag = type === "bulleted_list_item" ? "ul" : "ol";
      const items = [];
      while (index < blocks.length && blocks[index].type === type) {
        const item = blocks[index];
        items.push(`<li>${richTextHtml(item[type]?.rich_text, lawMap)}${renderBlocks(item.__children || [], lawMap)}</li>`);
        index += 1;
      }
      index -= 1;
      html += `<${tag}>${items.join("")}</${tag}>`;
      continue;
    }
    html += renderBlock(block, lawMap);
  }
  return html;
}

function renderBlock(block, lawMap) {
  const type = block.type;
  const data = block[type] || {};
  const plainText = (data.rich_text || []).map((item) => item.plain_text || item.text?.content || "").join("").trim();
  const text = richTextHtml(data.rich_text, lawMap);
  const children = renderBlocks(block.__children || [], lawMap);
  if (type === "callout" && (/^Navegação:/i.test(plainText) || /^Fim da L\d{2}:/i.test(plainText) || /CONTROLE OPERACIONAL/i.test(plainText))) return "";
  if (type === "toggle" && /Navegar por seções/i.test(plainText)) return "";
  if (type === "paragraph") return text ? `<p>${text}</p>${children}` : children;
  if (type === "heading_1") return `<h2>${text}</h2>${children}`;
  if (type === "heading_2") return `<h2>${text}</h2>${children}`;
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
    const rows = (block.__children || []).filter((item) => item.type === "table_row").map((row, rowIndex) => {
      const cells = (row.table_row?.cells || []).map((cell) => `${rowIndex === 0 && data.has_column_header ? "<th>" : "<td>"}${richTextHtml(cell, lawMap)}${rowIndex === 0 && data.has_column_header ? "</th>" : "</td>"}`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<div class="study-table-wrap"><table>${rows}</table></div>`;
  }
  if (type === "bookmark" || type === "link_preview") {
    const url = data.url || "";
    return url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)} ↗</a></p>` : children;
  }
  if (type === "image") {
    if (data.type === "external" && data.external?.url) {
      const caption = richTextHtml(data.caption, lawMap);
      return `<figure><img src="${escapeHtml(data.external.url)}" alt="${escapeHtml((data.caption || []).map((item) => item.plain_text || "").join(""))}" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
    return `<div class="study-media-note">🖼️ Imagem anexada no Notion. Use “Abrir no Notion” se precisar consultar o arquivo original.</div>`;
  }
  if (type === "child_page") {
    const code = lawMap.get(compactId(block.id));
    const href = code ? `../${code.toLowerCase()}/` : notionPageUrl(block.id);
    return `<p><a href="${escapeHtml(href)}">${escapeHtml(data.title || "Página vinculada")} →</a></p>`;
  }
  if (type === "synced_block" || type === "column" || type === "column_list") return children;
  return children || (text ? `<p>${text}</p>` : "");
}

function richTextHtml(items = [], lawMap) {
  return (items || []).map((item) => {
    let value = item.type === "equation" ? escapeHtml(item.equation?.expression || "") : escapeHtml(item.plain_text || item.text?.content || "");
    const annotations = item.annotations || {};
    if (annotations.code) value = `<code>${value}</code>`;
    if (annotations.bold) value = `<strong>${value}</strong>`;
    if (annotations.italic) value = `<em>${value}</em>`;
    if (annotations.underline) value = `<u>${value}</u>`;
    if (annotations.strikethrough) value = `<s>${value}</s>`;
    const href = item.href || item.text?.link?.url || "";
    if (href) {
      const internal = internalLawHref(href, lawMap);
      value = internal
        ? `<a href="${escapeHtml(internal)}">${value}</a>`
        : `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${value}</a>`;
    }
    return value;
  }).join("");
}

function internalLawHref(url, lawMap) {
  const compact = String(url || "").match(/[0-9a-f]{32}/i)?.[0]?.toLowerCase();
  const code = compact ? lawMap.get(compact) : null;
  return code ? `../${code.toLowerCase()}/` : "";
}

function parseBankRow(page) {
  const properties = page.properties || {};
  const material = propertyText(properties, "Material ou norma");
  const match = material.match(/^(L\d{2})\s*[—–-]\s*(.*)$/i);
  const operationalOrder = propertyNumber(properties, "Ordem");
  const studyUrl = propertyUrlOrText(properties, "Página de estudo");
  if (!match || !operationalOrder || !studyUrl) return null;
  return {
    url: page.url || notionPageUrl(page.id),
    study_url: studyUrl,
    code: match[1].toUpperCase(),
    material,
    title: material,
    operational_order: operationalOrder,
    active: propertyCheckbox(properties, "Leis Primeiro"),
    priority: propertyText(properties, "Prioridade"),
    official_url: propertyUrlOrText(properties, "Fonte oficial"),
    status: propertyText(properties, "Status"),
    question_target: propertyNumber(properties, "Questões-meta"),
    questions_done: propertyRollupNumber(properties, "Questões feitas"),
    flashcards_done: propertyNumber(properties, "Flashcards feitos"),
    flashcards_meta: propertyNumber(properties, "Flashcards-meta"),
    next_step: propertyText(properties, "Ação atual"),
    cargos: propertyCargoList(properties),
    action: propertyText(properties, "Ação atual"),
    cut: propertyText(properties, "Recorte prioritário"),
    alert: propertyText(properties, "Vigência / alerta"),
    block: propertyText(properties, "Bloco sugerido"),
    observations: propertyText(properties, "Observações"),
    version: propertyText(properties, "Versão ou alteração"),
    orientation_read: propertyCheckbox(properties, "Orientação lida"),
    d0: propertyCheckbox(properties, "D0"),
    d7: propertyCheckbox(properties, "D7"),
    d20: propertyCheckbox(properties, "D20"),
    last_audit: propertyDate(properties, "Última auditoria"),
    last_check: propertyDate(properties, "Última checagem"),
    next_review: propertyDate(properties, "Próxima revisão"),
  };
}

function recordKind(row) {
  if (row.active) return "active";
  if (row.code === "L23") return "support";
  return "historical";
}

function groupFor(code) {
  const number = Number(String(code).replace(/^L/i, ""));
  if (number <= 9) return "Núcleo comum";
  if (number === 10) return "Específico dos dois cargos";
  if (number === 11) return "Analista — específico";
  if (number === 12) return "Analista — conhecimentos básicos";
  if (number >= 13 && number <= 19) return "Técnico — específico";
  if (number === 20 || number === 21) return "Técnico — conhecimentos básicos";
  if (number === 22 || number === 24) return "Arquivo histórico";
  if (number === 23) return "Apoio do cargo";
  if (number >= 25) return "Técnico — específico";
  return "Outros";
}

function fallbackContent(row) {
  if (row.code === "L24") {
    return "<h2>Arquivo histórico — não estudar</h2><p>A Lei nº 10.520/2002 está revogada. Esta unidade permanece apenas para rastreabilidade; para licitações e contratos vigentes, estude a <a href=\"../l06/\">L06 — Lei nº 14.133/2021</a>.</p><p><strong>Não gerar leitura, questões, flashcards ou revisão para a L24.</strong></p>";
  }
  return "<h2>" + escapeHtml(groupFor(row.code)) + "</h2><p>" + escapeHtml(row.observations || row.alert || "Consulte o registro operacional no Notion.") + "</p>";
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

function propertyRollupNumber(properties, name) {
  const rollup = properties?.[name]?.rollup;
  if (!rollup) return 0;
  if (rollup.type === "number" && typeof rollup.number === "number") return rollup.number;
  if (Array.isArray(rollup.array)) return rollup.array.reduce((sum, item) => {
    if (item?.type === "number" && typeof item.number === "number") return sum + item.number;
    if (item?.type === "formula" && typeof item.formula?.number === "number") return sum + item.formula.number;
    return sum;
  }, 0);
  return 0;
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

function propertyCargoList(properties) {
  const property = properties?.["Cargo-alvo"];
  if (property?.multi_select) return property.multi_select.map((item) => item.name).filter(Boolean);
  return propertyText(properties, "Cargo-alvo").split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean);
}

function propertyCheckbox(properties, name) {
  return Boolean(properties?.[name]?.checkbox);
}

function propertyDate(properties, name) {
  return properties?.[name]?.date?.start || null;
}

function pageTitle(page) {
  const title = Object.values(page?.properties || {}).find((property) => property?.type === "title" || property?.title);
  return title?.title?.map((item) => item.plain_text || item.text?.content || "").join("") || "";
}

function notionPageUrl(value) {
  return "https://app.notion.com/p/" + compactId(value);
}

function compactId(value) {
  return String(value || "").replaceAll("-", "").toLowerCase();
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function groupForNumber(number) {
  return groupFor("L" + String(number).padStart(2, "0"));
}
