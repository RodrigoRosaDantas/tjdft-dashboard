import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";
const CENTRAL_PAGE_ID = "3d5cf5a2-6731-81aa-8acb-ebd128dada89";
const MATERIALS_PAGE_ID = "3d5cf5a2-6731-8119-924b-ebf5bf243d0d";
const SEQUENTIAL_MATERIALS_PAGE_ID = "3d5cf5a2-6731-81aa-f70e-a6e75d78dad";
const CYCLE_PAGE_ID = "3d6cf5a2-6731-8173-814f-f0d8b20134e5";
const DAYS_DATA_SOURCE_ID = "a06ef2a6-c492-4800-a556-8ebf562b1e4e";
const QUESTIONS_DATA_SOURCE_ID = "76f5f5ec-fc73-4f6e-86b1-69eeeb6cdc37";
const ERRORS_DATA_SOURCE_ID = "b4abcf79-27a8-46bc-a917-739a1e1811c4";
const CACHE_TTL_MS = 60_000;
const MAX_NOTION_CONCURRENCY = 4;

const allowedOrigins = new Set([
  "https://rodrigorosadantas.github.io",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://terminal.local:4173",
]);

type AnyRecord = Record<string, any>;
type DashboardSnapshot = AnyRecord;

let cachedSnapshot: { expiresAt: number; value: DashboardSnapshot } | null = null;

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const adminKey = readAdminKey();
const supabaseAdmin = projectUrl && adminKey
  ? createClient(projectUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const publishedSnapshotUrl =
  "https://raw.githubusercontent.com/RodrigoRosaDantas/tjdft-dashboard/main/public/data/tjdft-snapshot.json";

function readAdminKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as AnyRecord;
      if (typeof parsed.default === "string" && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to the legacy service role key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function publicKeys() {
  const keys = new Set<string>();
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) keys.add(anon);
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (publishable) {
    try {
      const parsed = JSON.parse(publishable) as AnyRecord;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.length > 0) keys.add(value);
      }
    } catch {
      // Legacy anon remains supported.
    }
  }
  return keys;
}

function authorized(request: Request) {
  const apiKey = request.headers.get("apikey");
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const candidate = apiKey || bearer;
  return Boolean(candidate && publicKeys().has(candidate));
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
      ? origin
      : "https://rodrigorosadantas.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(value: unknown, status: number, headers: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, ...extra },
  });
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AnyRecord;
  const source = candidate.source;
  const dashboard = candidate.dashboard;
  return Boolean(
    source &&
      dashboard &&
      source.kind === "notion" &&
      typeof source.title === "string" &&
      typeof source.page_id === "string" &&
      typeof source.page_url === "string" &&
      typeof dashboard.phase === "string" &&
      typeof dashboard.cycle === "string" &&
      typeof dashboard.next_action === "string" &&
      typeof dashboard.planned_questions === "number" &&
      typeof dashboard.projected_questions === "number" &&
      typeof dashboard.verticalized_axes === "number" &&
      typeof dashboard.jobs === "number",
  );
}

async function loadStoredSnapshot() {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("tjdft_dashboard_snapshots")
    .select("snapshot")
    .eq("id", "current")
    .maybeSingle();
  if (error) throw new Error("snapshot_read_failed");
  return isDashboardSnapshot(data?.snapshot) ? data.snapshot : null;
}

async function persistSnapshot(snapshot: DashboardSnapshot) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from("tjdft_dashboard_snapshots")
    .upsert({
      id: "current",
      snapshot,
      content_hash: snapshot.source?.content_hash ?? null,
      source_last_edited_time: snapshot.source?.last_edited_time ?? null,
      synced_at: snapshot.source?.synced_at ?? new Date().toISOString(),
    });
  if (error) throw new Error("snapshot_write_failed");
}

async function fetchPublishedSnapshot() {
  try {
    const response = await fetch(publishedSnapshotUrl + "?ts=" + Date.now(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const candidate = await response.json();
    return isDashboardSnapshot(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function loadFallbackSnapshot(preferPublished = false) {
  if (preferPublished) {
    const published = await fetchPublishedSnapshot();
    if (published) return published;
  }
  const stored = await loadStoredSnapshot().catch(() => null);
  if (stored) return stored;
  return await fetchPublishedSnapshot();
}

async function notionRequest(token: string, endpoint: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + token);
    headers.set("Notion-Version", NOTION_VERSION);
    headers.set("Content-Type", "application/json");
    const response = await fetch(NOTION_API_BASE + endpoint, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Notion API returned " + response.status);
    return await response.json() as AnyRecord;
  } finally {
    clearTimeout(timeout);
  }
}

type NotionRequest = (endpoint: string, init?: RequestInit) => Promise<AnyRecord>;

function createNotionRequest(token: string): NotionRequest {
  let inFlight = 0;
  const waiting: Array<() => void> = [];
  const acquire = () => new Promise<void>((resolve) => {
    if (inFlight < MAX_NOTION_CONCURRENCY) {
      inFlight++;
      resolve();
    } else {
      waiting.push(resolve);
    }
  });
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  };
  return async (endpoint: string, init: RequestInit = {}) => {
    await acquire();
    try {
      return await notionRequest(token, endpoint, init);
    } finally {
      release();
    }
  };
}

async function getAllChildren(blockId: string, request: NotionRequest) {
  const children: AnyRecord[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const response = await request("/blocks/" + blockId + "/children?" + query.toString());
    children.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return children;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function expandBlocks(blocks: AnyRecord[], request: NotionRequest, depth = 0): Promise<AnyRecord[]> {
  const nested = await mapWithConcurrency(blocks, MAX_NOTION_CONCURRENCY, async (block) => {
    if (!block.has_children || depth >= 3 || block.type === "child_page") return [];
    return expandBlocks(await getAllChildren(block.id, request), request, depth + 1);
  });
  return blocks.flatMap((block, index) => [block, ...nested[index]]);
}

function richTextToMarkdown(items: any[]) {
  return items.map((item) => {
    const text = item.plain_text || item.text?.content || item.mention?.page?.title || "";
    const href = item.href || item.text?.link?.url ||
      (item.mention?.page?.id ? notionPageUrl(item.mention.page.id) : null);
    return href && text ? "[" + text + "](" + href + ")" : text;
  }).join("");
}

function blockToText(block: AnyRecord) {
  const data = block?.[block?.type];
  if (!data) return "";
  if (Array.isArray(data.rich_text)) return richTextToMarkdown(data.rich_text);
  if (block.type === "table_row" && Array.isArray(data.cells)) {
    return data.cells.map((cell: any[]) => richTextToMarkdown(cell)).join(" | ");
  }
  if (block.type === "child_page") return data.title || "";
  return "";
}

async function queryDataSource(dataSourceId: string, request: NotionRequest) {
  const pages: AnyRecord[] = [];
  let cursor: string | null = null;
  do {
    const body: AnyRecord = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const response = await request("/data_sources/" + dataSourceId + "/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
    pages.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return pages;
}

function propertyText(properties: AnyRecord | undefined, name: string) {
  const property = properties?.[name];
  if (!property) return "";
  if (property.type === "title" || property.title) {
    return (property.title || []).map((item: any) => item.plain_text || item.text?.content || "").join("").trim();
  }
  if (property.type === "rich_text" || property.rich_text) {
    return (property.rich_text || []).map((item: any) => item.plain_text || item.text?.content || "").join("").trim();
  }
  if (property.type === "select" || property.select) return property.select?.name || "";
  if (property.type === "status" || property.status) return property.status?.name || "";
  if (property.type === "formula" && property.formula?.type === "string") return property.formula.string || "";
  if (property.type === "multi_select" || property.multi_select) {
    return (property.multi_select || []).map((item: any) => item.name || "").join(", ");
  }
  return "";
}

function propertyNumber(properties: AnyRecord | undefined, names: string | string[]) {
  const candidates = Array.isArray(names) ? names : [names];
  for (const name of candidates) {
    const value = properties?.[name]?.number;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function propertyCheckbox(properties: AnyRecord | undefined, name: string) {
  return properties?.[name]?.checkbox === true;
}

function propertyUrl(properties: AnyRecord | undefined, name: string) {
  return properties?.[name]?.url || "";
}

function propertyDate(properties: AnyRecord | undefined, names: string | string[]) {
  const candidates = Array.isArray(names) ? names : [names];
  for (const name of candidates) {
    const value = properties?.[name]?.date?.start;
    if (value) return value;
  }
  return null;
}

function normalizeDay(value: string) {
  const match = value.match(/\bD(0[1-9]|1[0-4])\b/i);
  return match ? "D" + match[1] : null;
}

function precision(correct: number, done: number) {
  return done > 0 ? correct / done : null;
}

function parseExecutionDay(page: AnyRecord) {
  const properties = page.properties || {};
  const title = propertyText(properties, "Dia de execução") ||
    propertyText(properties, "Dia") || page.url || "";
  const day = normalizeDay(title);
  const cycle = propertyText(properties, "Ciclo");
  if (!day || (cycle && !/CTJ-002|Ciclo 01/i.test(cycle))) return null;
  const planned = propertyNumber(properties, ["Meta de questões", "Meta questões"]);
  const done = propertyNumber(properties, ["Questões reais", "Questões feitas"]);
  const correct = propertyNumber(properties, "Acertos");
  const errors = propertyNumber(properties, "Erros");
  const doubts = propertyNumber(properties, "Acertos com dúvida");
  const status = propertyText(properties, "Status") || "Planejado";
  return {
    day,
    title: title || day,
    status: day === "D01" && done === 0 && /planejado/i.test(status) ? "Próximo" : status,
    type: propertyText(properties, "Tipo de dia") || propertyText(properties, "Tipo") || "Estudo",
    order: propertyNumber(properties, ["Ordem lógica", "Ordem"]),
    planned,
    done,
    correct,
    errors,
    doubts,
    minutes: propertyNumber(properties, ["Minutos reais", "Tempo (min)", "Minutos", "Tempo"]),
    precision: precision(correct, done),
    progress: planned > 0 ? done / planned : 0,
    href: propertyUrl(properties, "Página do dia") || page.url || notionPageUrl(page.id),
    executed_at: propertyDate(properties, ["Data real", "Data execução"]),
  };
}

function buildExecutionSnapshot(
  dayPages: AnyRecord[],
  questionPages: AnyRecord[],
  errorPages: AnyRecord[],
) {
  const days = dayPages.map(parseExecutionDay).filter(Boolean).sort((a, b) =>
    (a?.order || 0) - (b?.order || 0)
  ) as AnyRecord[];

  const questions = questionPages.map((page) => {
    const properties = page.properties || {};
    const dayText = [
      propertyText(properties, "Assunto"),
      propertyText(properties, "Questão"),
      propertyText(properties, "Dia de execução"),
    ].filter(Boolean).join(" ");
    return { page, day: normalizeDay(dayText) };
  }).filter((item) => Boolean(item.day));

  const dayStats = new Map<string, AnyRecord>();
  const subjects = new Map<string, AnyRecord>();
  for (const item of questions) {
    const properties = item.page.properties || {};
    const result = propertyText(properties, "Resultado");
    const done = propertyNumber(properties, ["Questões reais", "Questões feitas"]) ||
      (result && !/não iniciado|planejado|pendente/i.test(result) ? 1 : 0);
    const correct = propertyNumber(properties, "Acertos") ||
      (/correta|certa|acerto/i.test(result) && !/errada|erro/i.test(result) ? 1 : 0);
    const errors = propertyNumber(properties, "Erros") ||
      (/errada|erro/i.test(result) ? 1 : 0);
    const doubts = propertyNumber(properties, "Acertos com dúvida") ||
      (propertyCheckbox(properties, "Acerto com dúvida") ? 1 : 0) ||
      (/dúvida|duvida/i.test(result) ? 1 : 0);
    const stats = dayStats.get(item.day) || { done: 0, correct: 0, errors: 0, doubts: 0 };
    stats.done += done;
    stats.correct += correct;
    stats.errors += errors;
    stats.doubts += doubts;
    dayStats.set(item.day, stats);

    const subject = propertyText(properties, "Matéria") || "Sem matéria";
    const row = subjects.get(subject) || {
      subject,
      planned: 0,
      done: 0,
      correct: 0,
      errors: 0,
      doubts: 0,
      precision: null,
      rows: 0,
    };
    row.planned += propertyNumber(properties, "Meta de questões");
    row.done += done;
    row.correct += correct;
    row.errors += errors;
    row.doubts += doubts;
    row.rows += 1;
    row.precision = precision(row.correct, row.done);
    subjects.set(subject, row);
  }

  const normalizedDays = days.map((day) => {
    const stats = dayStats.get(day.day);
    if (!stats) return day;
    const done = Math.max(day.done, stats.done);
    const correct = day.correct || stats.correct;
    const errors = day.errors || stats.errors;
    const doubts = day.doubts || stats.doubts;
    return {
      ...day,
      done,
      correct,
      errors,
      doubts,
      precision: precision(correct, done),
      progress: day.planned > 0 ? done / day.planned : 0,
    };
  });

  const fallbackSubjects = [
    { subject: "Língua Portuguesa", planned: 44, done: 0, correct: 0, errors: 0, doubts: 0, precision: null, rows: 0 },
    { subject: "Organização Judiciária", planned: 28, done: 0, correct: 0, errors: 0, doubts: 0, precision: null, rows: 0 },
    { subject: "Ética e Conduta", planned: 16, done: 0, correct: 0, errors: 0, doubts: 0, precision: null, rows: 0 },
    { subject: "Checkpoints integrados", planned: 36, done: 0, correct: 0, errors: 0, doubts: 0, precision: null, rows: 0 },
  ];
  const subjectList = subjects.size
    ? Array.from(subjects.values()).sort((a, b) => b.planned - a.planned || a.subject.localeCompare(b.subject))
    : fallbackSubjects;
  const planned = normalizedDays.reduce((sum, day) => sum + day.planned, 0) || 124;
  const fixedMeta = subjectList.reduce((sum, subject) => sum + subject.planned, 0) || planned;
  const totals = normalizedDays.reduce((sum, day) => ({
    planned: sum.planned + day.planned,
    fixed_meta: fixedMeta,
    done: sum.done + day.done,
    correct: sum.correct + day.correct,
    errors: sum.errors + day.errors,
    doubts: sum.doubts + day.doubts,
    minutes: sum.minutes + day.minutes,
    precision: null,
    progress: 0,
  }), {
    planned: 0,
    fixed_meta: fixedMeta,
    done: 0,
    correct: 0,
    errors: 0,
    doubts: 0,
    minutes: 0,
    precision: null,
    progress: 0,
  });
  totals.planned = planned;
  totals.fixed_meta = fixedMeta;
  totals.precision = precision(totals.correct, totals.done);
  totals.progress = planned > 0 ? totals.done / planned : 0;
  const statuses: AnyRecord = {};
  for (const day of normalizedDays) statuses[day.status] = (statuses[day.status] || 0) + 1;
  const activeDay = normalizedDays.find((day) => /próximo|andamento|execução/i.test(day.status))?.day ||
    normalizedDays.find((day) => day.done > 0 && day.done < day.planned)?.day ||
    (normalizedDays[0]?.day || "D01");
  return {
    as_of: new Date().toISOString(),
    c01: {
      days: normalizedDays,
      totals,
      subjects: subjectList,
      statuses,
      active_day: activeDay,
      error_count: errorPages.length,
      question_rows: questions.length,
    },
  };
}

const META_BY_DAY: AnyRecord = {
  D01: "8 C/E · 75–90 min",
  D02: "8 C/E · 75–90 min",
  D03: "8 C/E · 75–90 min",
  D04: "8 C/E · 75–90 min",
  D05: "8 C/E · 75–90 min",
  D06: "8 C/E · 75–90 min",
  D07: "12 C/E · checkpoint",
  D08: "8 C/E · 75–90 min",
  D09: "8 C/E · 75–90 min",
  D10: "8 C/E · 75–90 min",
  D11: "8 C/E · 75–90 min",
  D12: "8 C/E · 75–90 min",
  D13: "10 C/E · 75–90 min",
  D14: "14 C/E · checkpoint",
};

const STATUS_BY_DAY: AnyRecord = {
  D01: "Leitura obrigatória",
  D02: "Leitura obrigatória",
  D03: "Leitura obrigatória",
  D04: "Leitura obrigatória",
  D05: "Leitura obrigatória",
  D06: "Leitura obrigatória",
  D07: "Revisão pelos dados",
  D08: "Leitura obrigatória",
  D09: "Leitura obrigatória",
  D10: "Leitura obrigatória",
  D11: "Leitura obrigatória",
  D12: "Leitura obrigatória",
  D13: "Integração + questões",
  D14: "Checkpoint adaptativo",
};

const TONE_BY_DAY: AnyRecord = {
  D01: "gold",
  D02: "teal",
  D03: "violet",
  D04: "teal",
  D05: "coral",
  D06: "violet",
  D07: "violet",
  D08: "teal",
  D09: "teal",
  D10: "coral",
  D11: "gold",
  D12: "teal",
  D13: "coral",
  D14: "violet",
};

function extractLinks(value: string) {
  return Array.from(value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)).map((match) => ({
    label: match[1].trim(),
    href: match[2].trim(),
  }));
}

function stripMarkup(value: string) {
  return value
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/<mention-page[^>]*\/>/g, "")
    .replace(/\*{1,2}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseReadingDay(line: string, materialPages: Map<string, string>) {
  const normalized = line.replace(/^[-*]\s*/, "").replace(/^\*+/, "").replace(/\*+$/, "").trim();
  const match = normalized.match(/^D(\d{2})\s*[—–-]\s*([^:]+):\s*(.*)$/i);
  if (!match) return null;
  const day = "D" + match[1];
  const rawDetail = match[3].trim();
  return {
    day,
    title: stripMarkup(match[2]),
    detail: stripMarkup(rawDetail),
    meta: META_BY_DAY[day] || "",
    href: materialPages.get(day) || notionPageUrl(CYCLE_PAGE_ID),
    status: STATUS_BY_DAY[day] || "Material do ciclo",
    tone: TONE_BY_DAY[day] || "teal",
    links: extractLinks(rawDetail).filter((link) => !/notion\.so|app\.notion\.com/i.test(link.href)),
  };
}

function extractSequentialMaterials(text: string, sourceUrl: string) {
  return text.split(/\n+/).map((line) => line.trim()).map((line) => {
    const normalized = line.replace(/^\*+/, "").replace(/\*+$/, "").trim();
    const match = normalized.match(
      /^(?:\d+\.\s*)?((?:TJ-MAT-\d+(?:-[A-Z])?)|(?:MS\d{2}))\s*[—–-]\s*(.+)$/i,
    );
    if (!match) return null;
    const code = match[1].toUpperCase();
    const number = Number(code.match(/(\d+)(?:-[A-Z])?$/)?.[1] || 0);
    return {
      code,
      order: number,
      title: stripMarkup(match[2]),
      group: number === 1 ? "Base TJDFT" : number <= 3 ? "Cargo-meta" :
        number === 4 ? "Fontes oficiais" : number === 5 ? "Questões" : "Revisão",
      detail: "Material sequencial atemporal do Notion.",
      href: sourceUrl,
    };
  }).filter(Boolean).sort((a, b) => a.order - b.order);
}

function buildMaterialsSnapshot(
  page: AnyRecord,
  materialsText: string,
  cycleBlocks: AnyRecord[],
  sequencePage: AnyRecord,
  sequenceText: string,
) {
  const materialPages = new Map<string, string>();
  const materialTitles = new Map<string, string>();
  for (const block of cycleBlocks) {
    if (block.type !== "child_page") continue;
    const rawTitle = block.child_page?.title || "";
    const day = normalizeDay(rawTitle);
    if (!day) continue;
    materialPages.set(day, notionPageUrl(block.id));
    materialTitles.set(day, rawTitle.replace(/^D\d{2}\s*[—–-]\s*/i, "").trim());
  }
  const legislation = materialsText.split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^D\d{2}\b/i.test(line))
    .map((line) => parseReadingDay(line, materialPages))
    .filter(Boolean);
  const legislationByDay = new Map(legislation.map((item) => [item.day, item]));
  const days = Array.from(new Set([...materialTitles.keys(), ...legislationByDay.keys()])).map((day) => {
    const law = legislationByDay.get(day);
    return {
      day,
      title: materialTitles.get(day) || law?.title || day,
      detail: law?.title ? "Leitura vinculada: " + law.title + "." : "Material do ciclo no Notion.",
      meta: META_BY_DAY[day] || "",
      href: materialPages.get(day) || notionPageUrl(CYCLE_PAGE_ID),
      tone: TONE_BY_DAY[day] || "teal",
    };
  });
  const future = materialsText.split(/\n+/).map((line) => line.trim())
    .filter((line) => /^(?:[-*]\s*)?(?:\*{1,2})?(?:CTJ|MS)\d/i.test(line))
    .map((line) => ({ label: stripMarkup(line.replace(/^[-*]\s*/, "")), detail: "Fila posterior registrada no Notion." }));
  return {
    source_url: page.url || notionPageUrl(MATERIALS_PAGE_ID),
    last_edited_time: page.last_edited_time || null,
    days,
    legislation,
    future,
    sequence: extractSequentialMaterials(
      sequenceText,
      sequencePage.url || notionPageUrl(SEQUENTIAL_MATERIALS_PAGE_ID),
    ),
  };
}

function pageTitle(page: AnyRecord) {
  return propertyText(page?.properties, "title") || page?.properties?.title?.title
    ?.map((item: any) => item.plain_text || item.text?.content || "").join("") || "";
}

function normalizePageId(value: string) {
  const compact = String(value || "").replaceAll("-", "").trim();
  if (!/^[a-f0-9]{32}$/i.test(compact)) return null;
  return compact.slice(0, 8) + "-" + compact.slice(8, 12) + "-" +
    compact.slice(12, 16) + "-" + compact.slice(16, 20) + "-" + compact.slice(20);
}

function notionPageUrl(value: string) {
  const normalized = normalizePageId(value);
  return "https://app.notion.com/p/" + (normalized || value).replaceAll("-", "");
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() || null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildSnapshot(token: string) {
  const fallback = await fetchPublishedSnapshot();
  const request = createNotionRequest(token);
  const [page, topLevelBlocks] = await Promise.all([
    request("/pages/" + CENTRAL_PAGE_ID),
    getAllChildren(CENTRAL_PAGE_ID, request),
  ]);
  const blocks = await expandBlocks(topLevelBlocks, request);
  const sourceText = blocks.map(blockToText).filter(Boolean).join("\n");

  let materials = null;
  let materialsText = "";
  let sequenceText = "";
  try {
    const [materialsPage, materialBlocks, cycleBlocks, sequencePage, sequenceBlocks] = await Promise.all([
      request("/pages/" + MATERIALS_PAGE_ID),
      getAllChildren(MATERIALS_PAGE_ID, request),
      getAllChildren(CYCLE_PAGE_ID, request),
      request("/pages/" + SEQUENTIAL_MATERIALS_PAGE_ID),
      getAllChildren(SEQUENTIAL_MATERIALS_PAGE_ID, request),
    ]);
    const [expandedMaterials, expandedCycle, expandedSequence] = await Promise.all([
      expandBlocks(materialBlocks, request),
      expandBlocks(cycleBlocks, request),
      expandBlocks(sequenceBlocks, request),
    ]);
    materialsText = expandedMaterials.map(blockToText).filter(Boolean).join("\n");
    sequenceText = expandedSequence.map(blockToText).filter(Boolean).join("\n");
    materials = buildMaterialsSnapshot(materialsPage, materialsText, expandedCycle, sequencePage, sequenceText);
  } catch (error) {
    console.error("TJDFT materials sync unavailable:", error instanceof Error ? error.message : "unknown error");
  }
  if (!materials || materials.days.length < 10) materials = fallback?.materials || materials;
  if (materials && fallback?.materials) {
    if (materials.legislation.length < 10) materials.legislation = fallback.materials.legislation;
    if (materials.sequence.length < 4) materials.sequence = fallback.materials.sequence;
    if (materials.future.length === 0) materials.future = fallback.materials.future;
  }

  let execution = null;
  let executionHashText = "";
  try {
    const [dayPages, questionPages, errorPages] = await Promise.all([
      queryDataSource(DAYS_DATA_SOURCE_ID, request),
      queryDataSource(QUESTIONS_DATA_SOURCE_ID, request),
      queryDataSource(ERRORS_DATA_SOURCE_ID, request),
    ]);
    execution = buildExecutionSnapshot(dayPages, questionPages, errorPages);
    executionHashText = JSON.stringify([dayPages, questionPages, errorPages].map((pages) =>
      pages.map((item) => ({ id: item.id, edited: item.last_edited_time, properties: item.properties }))
    ));
  } catch (error) {
    console.error("TJDFT execution sync unavailable:", error instanceof Error ? error.message : "unknown error");
  }
  if (!execution || execution.c01.days.length < 10) execution = fallback?.execution || execution;

  const contentHash = await sha256(
    [sourceText, materialsText, sequenceText, executionHashText].filter(Boolean).join("\n"),
  );
  const phase = firstMatch(sourceText, /(F-TJ-\d+\s*[—–-]\s*[^\n]+)/i) ||
    fallback?.dashboard?.phase || "F-TJ-01 — Núcleo comum";
  const cycle = firstMatch(sourceText, /(CTJ-\d{3}\s*[—–-]\s*[^\n]+)/i) ||
    fallback?.dashboard?.cycle || "CTJ-002 — Núcleo comum | Ciclo 01 de estudo real";
  const nextAction = firstMatch(sourceText, /PRÓXIMA AÇÃO:\s*([^\n.]+)/i) ||
    fallback?.dashboard?.next_action ||
    "Português: interpretação e coesão + Regimento I";

  return {
    schema_version: 1,
    source: {
      kind: "notion",
      title: pageTitle(page) || fallback?.source?.title || "TJDFT — Central de Comando | Dashboard PRO",
      page_id: CENTRAL_PAGE_ID,
      page_url: page.url || fallback?.source?.page_url || notionPageUrl(CENTRAL_PAGE_ID),
      last_edited_time: page.last_edited_time || fallback?.source?.last_edited_time || null,
      synced_at: new Date().toISOString(),
      content_hash: contentHash,
      status: "live",
    },
    dashboard: {
      phase,
      cycle,
      next_action: nextAction,
      planned_questions: fallback?.dashboard?.planned_questions ?? 124,
      projected_questions: fallback?.dashboard?.projected_questions ?? 124,
      executed_questions: execution?.c01?.totals?.done ?? fallback?.dashboard?.executed_questions ?? 0,
      verticalized_axes: fallback?.dashboard?.verticalized_axes ?? 22,
      jobs: fallback?.dashboard?.jobs ?? 2,
    },
    materials,
    execution,
    notice: "Dados consultados em tempo real no Notion. O site expõe apenas um índice sanitizado de materiais, fontes e execução do CTJ-002.",
  };
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (!authorized(request)) return json({ error: "Não autorizado." }, 401, headers);
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405, headers);

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const token = (Deno.env.get("TJDFT_NOTION_TOKEN") ?? Deno.env.get("NOTION_TOKEN"))?.trim();

  if (!forceRefresh && cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return json(cachedSnapshot.value, 200, headers, {
      "X-TJDFT-Cache": "hit",
      "Cache-Control": "public, max-age=30",
    });
  }

  if (forceRefresh) {
    const published = await fetchPublishedSnapshot();
    if (published) {
      await persistSnapshot(published).catch((error) => {
        console.error(
          "TJDFT GitHub snapshot persistence unavailable:",
          error instanceof Error ? error.message : "unknown error",
        );
      });
      cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: published };
      return json(published, 200, headers, {
        "X-TJDFT-Cache": "github->supabase",
        "Cache-Control": "public, max-age=30",
      });
    }
  }

  if (!token) {
    const fallback = await loadFallbackSnapshot();
    if (!fallback) return json({ error: "API TJDFT temporariamente indisponível." }, 503, headers);
    await persistSnapshot(fallback).catch((error) => {
      console.error(
        "TJDFT GitHub snapshot persistence unavailable:",
        error instanceof Error ? error.message : "unknown error",
      );
    });
    cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: fallback };
    return json(fallback, 200, headers, {
      "X-TJDFT-Cache": "snapshot",
      "Cache-Control": "public, max-age=30",
    });
  }

  try {
    const snapshot = await buildSnapshot(token);
    cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: snapshot };
    await persistSnapshot(snapshot);
    return json(snapshot, 200, headers, {
      "X-TJDFT-Cache": "miss",
      "Cache-Control": "public, max-age=30",
    });
  } catch (error) {
    console.error("TJDFT Notion sync failed:", error instanceof Error ? error.message : "unknown error");
    const fallback = await loadFallbackSnapshot(forceRefresh);
    if (fallback) {
      cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, value: fallback };
      return json(fallback, 200, headers, {
        "X-TJDFT-Cache": "stale",
        "Cache-Control": "public, max-age=30",
      });
    }
    return json({ error: "Não foi possível consultar os dados do Notion TJDFT." }, 502, headers);
  }
});
