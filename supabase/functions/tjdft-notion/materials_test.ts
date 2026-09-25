import { extractPlannedMaterials, findDay, normalizeDay } from "./materials.ts";

Deno.test("código de dia exige prefixo canônico e não captura o índice", () => {
  if (normalizeDay("D01 — Material | Interpretação") !== "D01") {
    throw new Error("O prefixo D01 de uma página de conteúdo deve ser reconhecido.");
  }
  if (normalizeDay("Índice rápido — Materiais D01–D14") !== null) {
    throw new Error("O índice do ciclo não pode substituir a página de conteúdo D01.");
  }
  if (normalizeDay("Resumo D14") !== null) {
    throw new Error("Um código no meio do título não identifica uma página diária.");
  }
  if (findDay("Assunto registrado para D01") !== "D01") {
    throw new Error("O vínculo de uma questão com uma unidade deve continuar aceitando o código no texto.");
  }
});

Deno.test("plano do Notion distingue ciclo ativo e cobertura ainda não criada", () => {
  const source = [
    "O CTJ-002 tem 14 dias e é somente o núcleo comum inicial.",
    "A arquitetura completa prevista é 1 ciclo atual + 5 ciclos do Técnico + 7 ciclos do Analista, seguida de consolidação, revisões adaptativas e discursivas.",
    "O CTJ-002 continua sendo o único ciclo ativo e permanece Planejado até existir execução real.",
    "Os cinco ciclos do Técnico e os sete ciclos do Analista são um roteiro de cobertura, não páginas/ciclos já criados.",
    "Depois do conteúdo, entram consolidação, revisões baseadas em erros reais e discursivas separadas por cargo.",
  ].join("\n");
  const result = extractPlannedMaterials(source);
  if (!result.complete) throw new Error("A descrição canônica completa deve ser identificada.");
  if (result.items.length !== 4) throw new Error("O plano completo deve produzir quatro cartões explicativos.");
  if (result.items[0].label !== "CTJ-002 · D01–D14") throw new Error("O ciclo atual deve permanecer explícito.");
  if (result.items[1].label !== "5 ciclos previstos — Técnico") throw new Error("A trilha do Técnico deve usar a quantidade da fonte.");
  if (result.items[2].label !== "7 ciclos previstos — Analista") throw new Error("A trilha do Analista deve usar a quantidade da fonte.");
  if (!result.items[1].detail.includes("já criados no Notion")) {
    throw new Error("A cobertura planejada não pode parecer um conjunto de ciclos já criados.");
  }
  if (!result.items[3].detail.includes("erros reais")) throw new Error("As revisões posteriores precisam preservar o vínculo com erros reais.");
});

Deno.test("plano incompleto não inventa contagens nem reaproveita itens vazios", () => {
  const result = extractPlannedMaterials("CTJ-002 está mencionado, mas sem escopo ou cobertura por cargo.");
  if (result.complete) throw new Error("A fonte insuficiente não pode ser declarada completa.");
  if (result.items.length !== 0) throw new Error("Não se deve inventar ciclo, quantidade ou etapa futura.");
});