export interface PlannedMaterial {
  label: string;
  detail: string;
}

export function normalizeDay(value: string) {
  const match = value.match(/^\s*D(0[1-9]|1[0-4])\b/i);
  return match ? "D" + match[1] : null;
}

export function findDay(value: string) {
  const match = value.match(/\bD(0[1-9]|1[0-4])\b/i);
  return match ? "D" + match[1] : null;
}

export function extractPlannedMaterials(text: string): {
  items: PlannedMaterial[];
  complete: boolean;
} {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const currentCycle = /ctj-002.{0,80}\b14 dias/.test(normalized);
  const currentStatus =
    /ctj-002 continua sendo o unico ciclo ativo e permanece planejado/.test(normalized);
  const notYetCreated =
    /roteiro de cobertura, nao paginas\/ciclos ja criados/.test(normalized);
  const technicianCount = normalized.match(/\b(\d+)\s+ciclos?\s+do tecnico\b/)?.[1];
  const analystCount = normalized.match(/\b(\d+)\s+ciclos?\s+do analista\b/)?.[1];
  const laterLayers = normalized.includes("consolidacao") &&
    normalized.includes("revisoes") &&
    normalized.includes("discursivas");
  const items: PlannedMaterial[] = [];

  if (currentCycle && currentStatus) {
    items.push({
      label: "CTJ-002 · D01–D14",
      detail: "Único ciclo ativo, ainda Planejado; D01 é a primeira unidade a executar.",
    });
  }
  if (technicianCount && notYetCreated) {
    items.push({
      label: technicianCount + " ciclos previstos — Técnico",
      detail: "Roteiro de cobertura por cargo; não são páginas ou ciclos executáveis já criados no Notion.",
    });
  }
  if (analystCount && notYetCreated) {
    items.push({
      label: analystCount + " ciclos previstos — Analista",
      detail: "Roteiro de cobertura por cargo; não são páginas ou ciclos executáveis já criados no Notion.",
    });
  }
  if (laterLayers) {
    items.push({
      label: "Consolidação, revisões e discursivas",
      detail: "Etapas posteriores; revisões baseadas em erros reais e discursivas separadas por cargo.",
    });
  }

  return {
    items,
    complete: currentCycle && currentStatus && Boolean(technicianCount) &&
      Boolean(analystCount) && notYetCreated && laterLayers,
  };
}