import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const [snapshot, portuguese] = await Promise.all([
  readFile(new URL("public/data/tjdft-snapshot.json", ROOT), "utf8").then(JSON.parse),
  readFile(new URL("public/data/portugues-rlm.json", ROOT), "utf8").then(JSON.parse),
]);

const op = snapshot?.operational || {};
const trail = op?.trail || {};
const next = trail?.next || null;
const items = Array.isArray(trail?.items) ? trail.items : [];
const studied = items
  .filter((item) => item?.last_execution)
  .sort((left, right) => String(right.last_execution).localeCompare(String(left.last_execution)));
const latest = studied[0] || null;

function dateOnly(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

const timeCredits = [];
const creditIds = new Set();
function addTimeCredit({ kind, date, unit, trail, sourceRef }) {
  const normalizedDate = dateOnly(date);
  const normalizedUnit = String(unit || "").trim();
  if (!normalizedDate || !normalizedUnit || !["reading", "study"].includes(kind)) return;
  const id = `tjdft:${kind}:${normalizedUnit}:${normalizedDate}`;
  if (creditIds.has(id)) return;
  creditIds.add(id);
  timeCredits.push({
    id,
    date: normalizedDate,
    kind,
    unit: normalizedUnit,
    trail,
    minutes: 60,
    sourceRef,
  });
}

for (const item of studied) {
  addTimeCredit({
    kind: "study",
    date: item.last_execution,
    unit: item.code,
    trail: item.track || "Português Primeiro + RLM Preventivo",
    sourceRef: "data/tjdft-snapshot.json#operational.trail.items",
  });
}

for (const day of Array.isArray(snapshot?.execution?.c01?.days) ? snapshot.execution.c01.days : []) {
  if (day?.executed_at && /conclu|executad/i.test(String(day?.status || ""))) {
    addTimeCredit({
      kind: "study",
      date: day.executed_at,
      unit: day.day,
      trail: "Ciclo diário TJDFT",
      sourceRef: "data/tjdft-snapshot.json#execution.c01.days",
    });
  }
}
timeCredits.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.unit.localeCompare(b.unit));

const questions = op?.questions || {};
const datedReviews = Array.isArray(op?.reviews?.dated) ? op.reviews.dated : [];
const reviewDates = datedReviews.map((item) => item?.date).filter(Boolean).sort();
const today = new Date().toISOString().slice(0, 10);
const reviewsDue = datedReviews.filter((item) => String(item?.date || "").slice(0, 10) <= today).length;

const source = snapshot?.source || {};
const syncedAt = source?.component_synced_at?.operational || source?.synced_at || new Date().toISOString();
const componentSources = source?.component_sources || {};
const operationalStatus = source?.operational_status ||
  (componentSources.execution === "notion" && componentSources.operational === "notion"
    ? "live"
    : source?.status === "live" ? "live" : "partial");

const editorialTotal = Number(portuguese?.summary?.units);
const editorialReady = Number(portuguese?.summary?.material_ready);
const editorialSequence = Array.isArray(portuguese?.sequence) ? portuguese.sequence : [];
const editorialHealthy =
  Number.isFinite(editorialTotal) &&
  editorialTotal > 0 &&
  Number.isFinite(editorialReady) &&
  editorialReady === editorialTotal &&
  editorialSequence.length === editorialTotal;
const sequenceHealthy = op?.integrity?.sequence_valid !== false;
const contractSynced = operationalStatus === "live" && editorialHealthy && sequenceHealthy;
const contractStatus = contractSynced ? "synced" : "partial";
const evidence = contractSynced ? "confirmed" : "partial";

const topTopics = (Array.isArray(op?.errors?.top) ? op.errors.top : [])
  .slice(0, 3)
  .map((item) => item?.topic)
  .filter(Boolean);

const notes = [];
if (topTopics.length) notes.push(`Erros ativos: ${topTopics.join(" · ")}`);
if (operationalStatus !== "live") notes.push("Execução ou trilha operacional não estão integralmente atualizadas pelo Notion.");
if (!editorialHealthy) {
  const readyLabel = Number.isFinite(editorialReady) ? editorialReady : "?";
  const totalLabel = Number.isFinite(editorialTotal) ? editorialTotal : "?";
  notes.push(`Materiais canônicos de Português + RLM incompletos no snapshot editorial (${readyLabel}/${totalLabel}).`);
}
if (!sequenceHealthy) notes.push("A sequência operacional 1–37 não passou na validação de integridade.");

const alerts = [];
if (operationalStatus !== "live") {
  alerts.push("Execução/trilha TJDFT estão parciais; confira a sincronização antes de usar métricas operacionais.");
}
if (!editorialHealthy) {
  alerts.push("O snapshot editorial de Português + RLM não está completo; a Central não confirma o contrato.");
}
if (!sequenceHealthy) {
  alerts.push("A sequência canônica TJDFT apresentou divergência e precisa de correção.");
}

const contract = {
  schemaVersion: 1,
  projectId: "tjdft",
  publishedAt: syncedAt.slice(0, 10),
  source: {
    kind: "public-project-state",
    ref: "data/tjdft-snapshot.json#operational",
    status: contractStatus,
    updatedAt: syncedAt,
  },
  state: {
    phase: snapshot?.dashboard?.phase || "Preparação",
    cycle: "Português Primeiro + RLM Preventivo",
    currentUnit: latest?.code || null,
    nextAction: next ? `${next.code} — ${next.title.replace(/^\S+\s+—\s+/, "")}` : null,
    nextActionKind: next ? "operational" : "none",
    alerts,
  },
  study: {
    evidence,
    sourceRef: "data/tjdft-snapshot.json#operational",
    updatedAt: syncedAt,
    trail: next?.track || latest?.track || "Português Primeiro + RLM Preventivo",
    lastCompletedUnit: latest?.code || null,
    nextUnit: next?.code || null,
    lastStudiedAt: latest?.last_execution || null,
    questionsDone: Number.isFinite(questions?.total) ? questions.total : null,
    correct: Number.isFinite(questions?.correct) ? questions.correct : null,
    errors: Number.isFinite(questions?.errors) ? questions.errors : null,
    doubts: Number.isFinite(questions?.doubts) ? questions.doubts : null,
    accuracy: Number.isFinite(questions?.precision) ? questions.precision : null,
    reviewsDue,
    nextReviewAt: reviewDates[0] || null,
    activeErrors: Number.isFinite(op?.errors?.active_count) ? op.errors.active_count : null,
    completedSessions: Number.isFinite(op?.continuity?.activities_with_evidence)
      ? op.continuity.activities_with_evidence
      : studied.length,
    totalSessions: Number.isFinite(trail?.total) ? trail.total : null,
    timeCredits,
    notes,
  },
};

await writeFile(new URL("public/central-status.json", ROOT), `${JSON.stringify(contract, null, 2)}\n`, "utf8");
console.log(
  `TJDFT central-status: ${latest?.code || "sem execução"} -> ${next?.code || "sem próxima unidade"} · ${contractStatus}.`,
);
