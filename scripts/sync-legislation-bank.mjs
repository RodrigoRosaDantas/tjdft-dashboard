import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATABASE_ID = "7231d1250fb844d48e5d888386746ba9";
const DATA_SOURCE_ID = "a8e16328-4587-4ace-93e5-5b994ee3389b";
const API = "https://api.notion.com/v1";
const VERSION = process.env.NOTION_VERSION || "2026-03-11";
const token = (process.env.TJDFT_NOTION_TOKEN || process.env.NOTION_TOKEN)?.trim();
const output = path.resolve("public/data/legislation-bank.json");

if (!token) throw new Error("TJDFT_NOTION_TOKEN is not configured.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(endpoint, init = {}, attempt = 0) {
  const response = await fetch(API + endpoint, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  if (response.status === 429 && attempt < 6) {
    await sleep(Math.max(500, Number(response.headers.get("retry-after") || 1) * 1000));
    return request(endpoint, init, attempt + 1);
  }
  if (!response.ok) throw new Error("Notion API " + response.status + ": " + body.slice(0, 400));
  return JSON.parse(body);
}

async function queryAll() {
  const rows = [];
  let cursor = null;
  do {
    const body = { page_size: 100, sorts: [{ property: "Ordem", direction: "ascending" }] };
    if (cursor) body.start_cursor = cursor;
    const response = await request("/data_sources/" + DATA_SOURCE_ID + "/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
    rows.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return rows;
}

const pages = await queryAll();
const rows = pages.map((page) => {
  const properties = page.properties || {};
  const material = propertyText(properties, "Material ou norma");
  const match = material.match(/^(L\d{2})\s*[—–-]\s*(.*)$/i);
  const operationalOrder = propertyNumber(properties, "Ordem");
  const studyUrl = propertyUrlOrText(properties, "Página de estudo");
  if (!match || !operationalOrder || !studyUrl) return null;
  const code = match[1].toUpperCase();
  const active = propertyCheckbox(properties, "Leis Primeiro");
  return {
    page_id: page.id,
    url: page.url || notionPageUrl(page.id),
    notion_url: studyUrl,
    operational_order: operationalOrder,
    code,
    internal_paths: ["./" + code.toLowerCase() + "/"],
    record_kind: recordKind(code, active),
    active,
    title: material,
    material,
    group: groupFor(code),
    priority: propertyText(properties, "Prioridade"),
    status: propertyText(properties, "Status"),
    action: propertyText(properties, "Ação atual"),
    official_url: propertyUrlOrText(properties, "Fonte oficial"),
    question_target: propertyNumber(properties, "Questões-meta"),
    questions_done: propertyRollupNumber(properties, "Questões feitas"),
    hits: propertyRollupNumber(properties, "Acertos"),
    errors: propertyRollupNumber(properties, "Erros"),
    doubtful_hits: propertyRollupNumber(properties, "Acertos com dúvida"),
    accuracy: propertyFormula(properties, "% de acerto"),
    flashcards_done: propertyNumber(properties, "Flashcards feitos"),
    flashcards_meta: propertyNumber(properties, "Flashcards-meta"),
    flashcards_status: propertyFormula(properties, "Flashcards status"),
    cargos: propertyCargoList(properties),
    orientation_read: propertyCheckbox(properties, "Orientação lida"),
    d0: propertyCheckbox(properties, "D0"),
    d7: propertyCheckbox(properties, "D7"),
    d20: propertyCheckbox(properties, "D20"),
    next_review: propertyDate(properties, "Próxima revisão"),
    next_step: propertyText(properties, "Ação atual"),
    cut: propertyText(properties, "Recorte prioritário"),
    alert: propertyText(properties, "Vigência / alerta"),
    block: propertyText(properties, "Bloco sugerido"),
    observations: propertyText(properties, "Observações"),
    version: propertyText(properties, "Versão ou alteração"),
    last_read: propertyDate(properties, "Última leitura"),
    last_audit: propertyDate(properties, "Última auditoria"),
    last_check: propertyDate(properties, "Última checagem"),
  };
}).filter(Boolean).sort((a, b) => a.operational_order - b.operational_order);

const expectedCodes = Array.from({ length: 26 }, (_, index) => "L" + String(index + 1).padStart(2, "0"));
const actualCodes = rows.map((row) => row.code);
const missingCodes = expectedCodes.filter((code) => !actualCodes.includes(code));
const duplicateCodes = actualCodes.filter((code, index) => actualCodes.indexOf(code) !== index);
if (rows.length !== 26 || missingCodes.length || duplicateCodes.length) {
  throw new Error("Expected exactly L01-L26 current records. Found " + actualCodes.join(", ") + ". Missing: " + missingCodes.join(", ") + ".");
}

const snapshot = {
  schema_version: 2,
  source: {
    kind: "notion",
    database_id: DATABASE_ID,
    database_url: notionPageUrl("6fcef35896774118880a9aa7d15682b6"),
    data_source_id: DATA_SOURCE_ID,
    synced_at: new Date().toISOString(),
  },
  summary: {
    records: rows.length,
    active_records: rows.filter((row) => row.record_kind === "active").length,
    trail_records: rows.filter((row) => row.record_kind === "active").length,
    support_records: rows.filter((row) => row.record_kind === "support").length,
    historical_records: rows.filter((row) => row.record_kind === "historical").length,
    radar_records: rows.filter((row) => row.record_kind !== "active").length,
  },
  rows,
};

await mkdir(path.dirname(output), { recursive: true });
const previousSnapshot = await readPreviousSnapshot(output);
if (previousSnapshot?.source?.synced_at && snapshotContent(previousSnapshot) === snapshotContent(snapshot)) {
  snapshot.source.synced_at = previousSnapshot.source.synced_at;
}
await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log("BANCO — LEGISLAÇÃO TJDFT: " + rows.length + " registros Lxx sincronizados em " + output + ".");

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

function recordKind(code, active) {
  if (active) return "active";
  if (code === "L23") return "support";
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

function propertyCheckbox(properties, name) {
  return Boolean(properties?.[name]?.checkbox);
}

function propertyDate(properties, name) {
  return properties?.[name]?.date?.start || null;
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

function propertyFormula(properties, name) {
  const formula = properties?.[name]?.formula;
  if (!formula) return null;
  if (formula.type === "number") return typeof formula.number === "number" ? formula.number : null;
  if (formula.type === "string") return formula.string || "";
  if (formula.type === "boolean") return Boolean(formula.boolean);
  if (formula.type === "date") return formula.date?.start || null;
  return null;
}

function notionPageUrl(value) {
  return "https://app.notion.com/p/" + compactId(value);
}

function compactId(value) {
  return String(value || "").replaceAll("-", "").toLowerCase();
}
