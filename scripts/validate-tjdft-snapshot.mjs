const snapshotPath = "public/data/tjdft-snapshot.json";
const lawsPath = "public/data/leis-primeiro.json";
const bankPath = "public/data/legislation-bank.json";
const editalPath = "public/data/tjdft-edital.json";
const portuguesePath = "public/data/portugues-rlm.json";

const snapshotRaw = await Deno.readTextFile(snapshotPath);
const lawsRaw = await Deno.readTextFile(lawsPath);
const bankRaw = await Deno.readTextFile(bankPath);
const editalRaw = await Deno.readTextFile(editalPath);
const portugueseRaw = await Deno.readTextFile(portuguesePath);
const publicDataRaw = [snapshotRaw, lawsRaw, bankRaw, editalRaw, portugueseRaw].join("\n");
const snapshot = JSON.parse(snapshotRaw);
const lawsSnapshot = JSON.parse(lawsRaw);
const bankSnapshot = JSON.parse(bankRaw);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(snapshot && typeof snapshot === "object", "Snapshot precisa ser um objeto JSON.");
assert(Number.isFinite(Number(snapshot.schema_version)), "schema_version ausente ou inválido.");
assert(snapshot.source && typeof snapshot.source === "object", "source ausente.");
assert(typeof snapshot.source.title === "string" && snapshot.source.title.trim(), "source.title ausente.");
assert(typeof snapshot.source.page_url === "string" && snapshot.source.page_url.startsWith("https://"), "source.page_url inválida.");
assert(typeof snapshot.source.content_hash === "string" && snapshot.source.content_hash.trim(), "source.content_hash ausente.");
assert(["synced", "live", "partial", "fallback"].includes(snapshot.source.status), "source.status não reconhecido.");
if (snapshot.source.component_sources) {
  const expectedComponents = ["materials", "execution", "operational"];
  const allowedOrigins = ["notion", "snapshot", "mixed", "partial", "unavailable"];
  assert(expectedComponents.every((key) => allowedOrigins.includes(snapshot.source.component_sources[key])), "Origem de componente do snapshot inválida.");
  if (snapshot.source.status === "partial") {
    assert(expectedComponents.some((key) => snapshot.source.component_sources[key] !== "notion"), "Snapshot parcial sem componente degradado.");
    assert(snapshot.source.component_synced_at && typeof snapshot.source.component_synced_at === "object", "Snapshot parcial sem datas por componente.");
    assert(/parcial/i.test(snapshot.notice || ""), "Snapshot parcial sem aviso público.");
  }
  if (snapshot.source.status === "synced") {
    assert(expectedComponents.every((key) => snapshot.source.component_sources[key] === "notion"), "Snapshot publicado como sincronizado contém componente reutilizado ou indisponível.");
  }
}
assert(snapshot.dashboard && typeof snapshot.dashboard === "object", "dashboard ausente.");
assert(Array.isArray(snapshot.materials?.days), "materials.days ausente.");
assert(Array.isArray(snapshot.materials?.legislation), "materials.legislation ausente.");
assert(Array.isArray(snapshot.materials?.future), "materials.future ausente.");
assert(Array.isArray(snapshot.execution?.c01?.days), "execution.c01.days ausente.");
assert(Array.isArray(snapshot.execution?.c01?.subjects), "execution.c01.subjects ausente.");
assert(snapshot.execution?.c01?.totals && typeof snapshot.execution.c01.totals === "object", "execution.c01.totals ausente.");

if (Number(snapshot.schema_version) >= 2) {
  assert(snapshot.operational && typeof snapshot.operational === "object", "operational ausente no snapshot v2.");
  assert(snapshot.operational.trail?.total === 37, "operational.trail precisa preservar 37 posições.");
  assert(snapshot.operational.trail?.sequence_valid === true, "operational.trail divergiu da Ordem 1–37.");
  assert(Array.isArray(snapshot.operational.trail?.items), "operational.trail.items ausente.");
  assert(Array.isArray(snapshot.operational.questions?.by_subject), "operational.questions.by_subject ausente.");
  assert(Array.isArray(snapshot.operational.errors?.top), "operational.errors.top ausente.");
  assert(Array.isArray(snapshot.operational.reviews?.dated), "operational.reviews.dated ausente.");
  assert(snapshot.operational.coverage?.tecnico && snapshot.operational.coverage?.analista, "Cobertura separada por cargo ausente.");
  assert(!snapshot.operational.errors.top.some((item) => /Resolvido|Arquivado/i.test(String(item.state || ""))), "Erro encerrado vazou para a fila ativa.");
  const operationalRaw = JSON.stringify(snapshot.operational);
  for (const privateField of ["Histórico pessoal", "\"Questão\":", "\"Observações\":"]) {
    assert(!operationalRaw.includes(privateField), "Snapshot operacional expôs campo bruto privado: " + privateField);
  }
}

assert(lawsSnapshot && lawsSnapshot.schema_version >= 4, "Snapshot Leis Primeiro desatualizado.");
assert(Array.isArray(lawsSnapshot.laws) && lawsSnapshot.laws.length === 26, "Leis Primeiro precisa conter exatamente L01-L26.");
const lawCodes = lawsSnapshot.laws.map((law) => law.code);
const expectedLawCodes = Array.from({ length: 26 }, (_, index) => "L" + String(index + 1).padStart(2, "0"));
assert(expectedLawCodes.every((code) => lawCodes.includes(code)), "Leis Primeiro não contém todos os códigos L01-L26.");
assert(new Set(lawCodes).size === 26, "Leis Primeiro contém códigos duplicados.");
assert(lawsSnapshot.summary?.active_records === 23, "Leis Primeiro precisa ter 23 unidades ativas.");
assert(lawsSnapshot.laws.filter((law) => law.record_kind === "active").every((law) => String(law.content_html || "").length >= 40), "Unidade ativa sem conteúdo interno.");
const l22 = lawsSnapshot.laws.find((law) => law.code === "L22");
const l23 = lawsSnapshot.laws.find((law) => law.code === "L23");
const l24 = lawsSnapshot.laws.find((law) => law.code === "L24");
assert(l22?.record_kind === "historical" && l22?.active === false, "L22 precisa permanecer histórica e fora da fila.");
assert(l23?.record_kind === "support" && l23?.active === false, "L23 precisa permanecer como apoio e fora da fila ativa.");
assert(l24?.record_kind === "historical" && l24?.active === false, "L24 precisa permanecer histórica e fora da fila.");
assert(bankSnapshot && Array.isArray(bankSnapshot.rows) && bankSnapshot.rows.length === 26, "Banco legislativo precisa conter exatamente 26 registros.");
assert(bankSnapshot.summary?.active_records === 23, "Banco legislativo precisa ter 23 registros ativos.");

const forbidden = [
  /ntn_[a-z0-9]{8,}/i,
  /gh[pousr]_[a-z0-9_]{20,}/i,
  /sb_secret_[a-z0-9_-]+/i,
  /service_role/i,
  /tjdft_notion_token/i,
  /eyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\./i,
];
assert(!forbidden.some((pattern) => pattern.test(publicDataRaw)), "Dados públicos contêm credencial ou nome de segredo proibido.");

const forbiddenProjectReferences = [
  /\bSEEDF\b/i,
  /\bTDAS\b/i,
  /\bEDAS\b/i,
  /\bSEDES\b/i,
  /\bTCE[\s-]?GO\b/i,
  /\bHABACUQUE\b/i,
];
assert(!forbiddenProjectReferences.some((pattern) => pattern.test(publicDataRaw)), "Snapshot público contém referência de outro projeto.");
assert(!/\bCTJ-00[12]\b/i.test(lawsRaw + bankRaw), "Snapshot legislativo contém referência à estrutura legada CTJ-002.");

const legacyDayPath = /(^|\/)d(?:0[1-9]|1[0-4])\/?$/i;
assert(lawsSnapshot.laws.every((law) => !legacyDayPath.test(String(law.internal_path || "")) && !/^D(?:0[1-9]|1[0-4])$/i.test(String(law.code || ""))), "Snapshot legislativo contém estrutura legada D01-D14.");
assert(lawsSnapshot.summary?.support_records === 1 && lawsSnapshot.summary?.historical_records === 2, "Classificação de apoio/histórico da legislação está inconsistente.");
assert(bankSnapshot.summary?.support_records === 1 && bankSnapshot.summary?.historical_records === 2, "Classificação do banco legislativo está inconsistente.");

console.log("Snapshots TJDFT válidos: " + snapshot.materials.days.length + " dias, " + snapshot.execution.c01.days.length + " execuções, " + lawsSnapshot.laws.length + " leis.");
