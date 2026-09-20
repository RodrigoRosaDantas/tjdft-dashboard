const snapshotPath = "public/data/tjdft-snapshot.json";
const lawsPath = "public/data/leis-primeiro.json";
const bankPath = "public/data/legislation-bank.json";

const snapshotRaw = await Deno.readTextFile(snapshotPath);
const lawsRaw = await Deno.readTextFile(lawsPath);
const bankRaw = await Deno.readTextFile(bankPath);
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
assert(["synced", "live", "fallback"].includes(snapshot.source.status), "source.status não reconhecido.");
assert(snapshot.dashboard && typeof snapshot.dashboard === "object", "dashboard ausente.");
assert(Array.isArray(snapshot.materials?.days), "materials.days ausente.");
assert(Array.isArray(snapshot.materials?.legislation), "materials.legislation ausente.");
assert(Array.isArray(snapshot.materials?.future), "materials.future ausente.");
assert(Array.isArray(snapshot.execution?.c01?.days), "execution.c01.days ausente.");
assert(Array.isArray(snapshot.execution?.c01?.subjects), "execution.c01.subjects ausente.");
assert(snapshot.execution?.c01?.totals && typeof snapshot.execution.c01.totals === "object", "execution.c01.totals ausente.");

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
  /ntn_[a-z0-9]+/i,
  /sbp_[a-z0-9]+/i,
  /service_role/i,
  /tjdft_notion_token/i,
];
assert(!forbidden.some((pattern) => pattern.test(snapshotRaw + lawsRaw + bankRaw)), "Snapshot contém credencial ou nome de segredo proibido.");

console.log("Snapshots TJDFT válidos: " + snapshot.materials.days.length + " dias, " + snapshot.execution.c01.days.length + " execuções, " + lawsSnapshot.laws.length + " leis.");
