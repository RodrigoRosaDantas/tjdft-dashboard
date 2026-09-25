import { readFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile("public/data/portugues-rlm.json", "utf8"));
const expectedSequence = [
  "P01", "P02", "P03", "RL01", "P04", "REV01", "P05", "P06", "RL02", "P07", "P08", "REV02",
  "P09", "RL03", "P10", "P11", "P12", "REV03", "RL04", "P13", "P14", "P15", "RL05", "REV04",
  "P16", "P17", "P18", "RL06", "RL07", "REV05", "RL08", "RL09", "RL10", "RL11", "RL12", "REV06", "RL13",
];

if (!Array.isArray(snapshot.units) || snapshot.units.length !== expectedSequence.length) {
  throw new Error(`Snapshot Português/RLM deve ter ${expectedSequence.length} unidades.`);
}
if (JSON.stringify(snapshot.sequence) !== JSON.stringify(expectedSequence)) {
  throw new Error("A sequência pública não corresponde à Ordem da esteira canônica.");
}

const units = [...snapshot.units].sort((left, right) => left.canonical_order - right.canonical_order);
const headingText = (html) => [...String(html || "").matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
  .map((match) => match[1].replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ").trim())
  .join(" | ");
if (JSON.stringify(units.map((unit) => unit.code)) !== JSON.stringify(expectedSequence)) {
  throw new Error("As unidades não estão ordenadas por Ordem da esteira.");
}
if (new Set(units.map((unit) => unit.code)).size !== units.length) {
  throw new Error("Há códigos duplicados no snapshot Português/RLM.");
}
if (new Set(units.map((unit) => unit.canonical_order)).size !== units.length || units.some((unit, index) => unit.canonical_order !== index + 1)) {
  throw new Error("Ordem da esteira deve conter exatamente os valores 1–37.");
}

for (const unit of units) {
  if (!/^P\d{2}$|^RL\d{2}$|^REV\d{2}$/.test(unit.code)) throw new Error(`Código inválido: ${unit.code}`);
  if (!unit.title || !unit.notion_url || !unit.internal_path) throw new Error(`Unidade incompleta: ${unit.code}`);
  if (typeof unit.material_ready !== "boolean") throw new Error(`Material pronto inválido: ${unit.code}`);
  if (typeof unit.content_html !== "string" || unit.content_html.length < 40) throw new Error(`Conteúdo ausente: ${unit.code}`);
  if (/NAVEGAÇÃO|NAVEGAÇÃO DA TRILHA|FIM DO (?:P|RL|REV)\d+/i.test(unit.content_html)) throw new Error(`Navegação operacional exposta: ${unit.code}`);
  if (/(?:Controle operacional|Sinal do histórico pessoal|Histórico e prioridade)/i.test(headingText(unit.content_html))) throw new Error(`Seção privada exposta: ${unit.code}`);
  if (/controle\s+operacional|O controle registra|Sinal do histórico pessoal|Leitura correta desse histórico|histórico pessoal/i.test(unit.content_html)) throw new Error(`Histórico privado exposto: ${unit.code}`);

  const headingIds = [...unit.content_html.matchAll(/<h[23]\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
  const indexBlock = unit.content_html.match(/<details\b[^>]*\bstudy-index\b[^>]*>[\s\S]*?<\/details>/i)?.[0] || "";
  const indexHrefs = [...indexBlock.matchAll(/href="#([^"]+)"/gi)].map((match) => match[1]);
  if (!indexBlock || indexHrefs.length !== headingIds.length || indexHrefs.some((href) => !headingIds.includes(href))) {
    throw new Error(`Índice da aula incompleto ou sem âncoras: ${unit.code}`);
  }
}

const publicKeys = snapshot.units.flatMap((unit) => Object.keys(unit));
for (const privateField of ["Histórico pessoal", "status", "d0", "d7", "d20"]) {
  if (publicKeys.includes(privateField)) throw new Error(`Campo privado exposto no snapshot: ${privateField}`);
}
const serialized = JSON.stringify(snapshot);
if (/\b(?:SEEDF|TDAS|EDAS|SEDES|TCE[\s-]?GO|HABACUQUE)\b/i.test(serialized)) {
  throw new Error("O snapshot Português/RLM contém referência de outro projeto.");
}

const readyCount = units.filter((unit) => unit.material_ready).length;
if (snapshot.summary?.material_ready !== readyCount) throw new Error("Resumo de Material pronto divergente.");
if (snapshot.summary?.units !== units.length) throw new Error("Resumo de unidades divergente.");

console.log(`Snapshot Português/RLM válido: ${units.length} unidades; ${readyCount} materiais prontos.`);
