import { resolveSnapshotProvenance, type ComponentSources } from "./provenance.ts";

Deno.test("origem íntegra só é live quando os componentes vieram do Notion", () => {
  const components: ComponentSources = {
    materials: "notion",
    execution: "notion",
    operational: "notion",
  };
  const result = resolveSnapshotProvenance(components);
  if (result.status !== "live") throw new Error("Esperava status live para dados integralmente consultados no Notion.");
  if (result.operational_status !== "live") throw new Error("Saúde operacional íntegra deve ser live.");
  if (result.partial_components.length !== 0) throw new Error("Snapshot integral não pode listar componentes parciais.");
  if (result.operational_partial_components.length !== 0) throw new Error("Snapshot operacional integral não pode listar componentes parciais.");
});

Deno.test("reutilização e ausência de componentes são expostas como snapshot parcial", () => {
  const components: ComponentSources = {
    materials: "mixed",
    execution: "snapshot",
    operational: "unavailable",
  };
  const result = resolveSnapshotProvenance(components);
  if (result.status !== "partial") throw new Error("Fallback ou componente ausente não pode ser marcado live.");
  if (result.operational_status !== "partial") throw new Error("Execução ou trilha degradadas precisam rebaixar a saúde operacional.");
  if (JSON.stringify(result.partial_components) !== JSON.stringify(["materials", "execution", "operational"])) {
    throw new Error("Os componentes degradados precisam permanecer identificáveis.");
  }
  if (!/snapshot anterior do GitHub/.test(result.notice) || !/indisponível/.test(result.notice)) {
    throw new Error("O aviso precisa explicar fallback e ausência de dados.");
  }
});


Deno.test("material legado misto não rebaixa execução e trilha atuais", () => {
  const components: ComponentSources = {
    materials: "mixed",
    execution: "notion",
    operational: "notion",
  };
  const result = resolveSnapshotProvenance(components);
  if (result.status !== "partial") throw new Error("O snapshot global deve continuar transparente sobre a origem mista dos materiais legados.");
  if (result.operational_status !== "live") throw new Error("Execução e trilha atuais, ambas no Notion, devem permanecer live.");
  if (JSON.stringify(result.operational_partial_components) !== JSON.stringify([])) {
    throw new Error("Materiais legados não pertencem à saúde operacional.");
  }
});
