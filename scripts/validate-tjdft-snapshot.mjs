const snapshotPath = "public/data/tjdft-snapshot.json";
const raw = await Deno.readTextFile(snapshotPath);
const snapshot = JSON.parse(raw);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(snapshot && typeof snapshot === "object", "Snapshot precisa ser um objeto JSON.");
assert(Number.isFinite(Number(snapshot.schema_version)), "schema_version ausente ou inválido.");
assert(snapshot.source && typeof snapshot.source === "object", "source ausente.");
assert(typeof snapshot.source.title === "string" && snapshot.source.title.trim(), "source.title ausente.");
assert(typeof snapshot.source.page_url === "string" && /^https:\\/\\//.test(snapshot.source.page_url), "source.page_url inválida.");
assert(typeof snapshot.source.content_hash === "string" && snapshot.source.content_hash.trim(), "source.content_hash ausente.");
assert(["synced", "live", "fallback"].includes(snapshot.source.status), "source.status não reconhecido.");
assert(snapshot.dashboard && typeof snapshot.dashboard === "object", "dashboard ausente.");
assert(Array.isArray(snapshot.materials?.days), "materials.days ausente.");
assert(Array.isArray(snapshot.materials?.legislation), "materials.legislation ausente.");
assert(Array.isArray(snapshot.materials?.future), "materials.future ausente.");
assert(Array.isArray(snapshot.execution?.c01?.days), "execution.c01.days ausente.");
assert(Array.isArray(snapshot.execution?.c01?.subjects), "execution.c01.subjects ausente.");
assert(snapshot.execution?.c01?.totals && typeof snapshot.execution.c01.totals === "object", "execution.c01.totals ausente.");

const forbidden = [
  /ntn_[a-z0-9]+/i,
  /sbp_[a-z0-9]+/i,
  /service_role/i,
  /tjdft_notion_token/i,
];
assert(!forbidden.some((pattern) => pattern.test(raw)), "Snapshot contém credencial ou nome de segredo proibido.");

console.log("Snapshot TJDFT válido: " + snapshot.materials.days.length + " dias, " + snapshot.execution.c01.days.length + " execuções.");
