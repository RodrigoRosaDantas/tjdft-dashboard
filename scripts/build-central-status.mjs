import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const snapshot = JSON.parse(await readFile(new URL("public/data/tjdft-snapshot.json", ROOT), "utf8"));
const op = snapshot?.operational || {};
const trail = op?.trail || {};
const next = trail?.next || null;
const items = Array.isArray(trail?.items) ? trail.items : [];
const studied = items.filter(x => x?.last_execution).sort((a,b)=>String(b.last_execution).localeCompare(String(a.last_execution)));
const latest = studied[0] || null;
const questions = op?.questions || {};
const datedReviews = Array.isArray(op?.reviews?.dated) ? op.reviews.dated : [];
const reviewDates = datedReviews.map(x=>x?.date).filter(Boolean).sort();
const today = new Date().toISOString().slice(0,10);
const reviewsDue = datedReviews.filter(x=>String(x?.date||"").slice(0,10) <= today).length;
const syncedAt = snapshot?.source?.component_synced_at?.operational || snapshot?.source?.synced_at || new Date().toISOString();
const sourceStatus = snapshot?.source?.status || "partial";
const evidence = sourceStatus === "synced" && op?.integrity?.sequence_valid !== false ? "confirmed" : "partial";
const topTopics = (Array.isArray(op?.errors?.top) ? op.errors.top : []).slice(0,3).map(x=>x?.topic).filter(Boolean);
const notes = [];
if (topTopics.length) notes.push(`Erros ativos: ${topTopics.join(" · ")}`);
if (sourceStatus !== "synced") notes.push("Snapshot TJDFT marcado como parcial; os componentes operacionais podem ter frescor diferente.");

const contract = {
  schemaVersion: 1,
  projectId: "tjdft",
  publishedAt: syncedAt.slice(0,10),
  source: { kind: "public-project-state", ref: "data/tjdft-snapshot.json#operational", status: sourceStatus, updatedAt: syncedAt },
  state: {
    phase: snapshot?.dashboard?.phase || "Preparação",
    cycle: "Português Primeiro + RLM Preventivo",
    currentUnit: latest?.code || null,
    nextAction: next ? `${next.code} — ${next.title.replace(/^\S+\s+—\s+/, "")}` : null,
    nextActionKind: next ? "operational" : "none",
    alerts: sourceStatus === "synced" ? [] : ["O snapshot TJDFT está parcial; confira a origem antes de tratar todos os componentes como igualmente atuais."]
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
    completedSessions: Number.isFinite(op?.continuity?.activities_with_evidence) ? op.continuity.activities_with_evidence : studied.length,
    totalSessions: Number.isFinite(trail?.total) ? trail.total : null,
    notes
  }
};

await writeFile(new URL("public/central-status.json", ROOT), `${JSON.stringify(contract,null,2)}\n`, "utf8");
console.log(`TJDFT central-status: ${latest?.code || "sem execução"} -> ${next?.code || "sem próxima unidade"}.`);
